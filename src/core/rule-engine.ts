/**
 * Rule Engine
 * Applies and validates rules from state/rules.yaml
 */

import { loadRules, loadBounds, checkBounds } from './config-loader.js';
import { getActivityCount, getTodayPostCount, getLastPostTime } from '../services/database.js';
import logger from '../utils/logger.js';
import type { RulesState, Bounds, ExecutionContext } from '../types/index.js';

// ============================================
// Types
// ============================================

export interface RuleCheckResult {
  allowed: boolean;
  reason?: string;
  rule?: string;
  confidence?: number;
}

export interface TimingCheckResult {
  isOptimal: boolean;
  currentHour: number;
  bestHours: number[];
  confidence: number;
  reason: string;
}

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  limitType: string;
}

// ============================================
// Rule Loading
// ============================================

let cachedRules: RulesState | null = null;

function getRules(): RulesState {
  if (!cachedRules) {
    cachedRules = loadRules(true);
  }
  return cachedRules;
}

export function refreshRules(): void {
  cachedRules = loadRules(true);
}

// ============================================
// Timing Rules
// ============================================

export function checkTimingRules(forceCheck = false): TimingCheckResult {
  const rules = getRules();
  const bounds = loadBounds();
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });

  const timing = rules.timing;

  // Check if we have enough confidence to apply timing rules
  const minConfidence = bounds.evolution?.confidence?.min_to_apply ?? 0.5;

  if (timing.confidence < minConfidence && !forceCheck) {
    return {
      isOptimal: true, // Don't restrict if we don't have confidence
      currentHour,
      bestHours: timing.best_hours,
      confidence: timing.confidence,
      reason: `Insufficient confidence (${timing.confidence} < ${minConfidence}), allowing`,
    };
  }

  // Check avoid days
  if (timing.avoid_days.includes(currentDay)) {
    return {
      isOptimal: false,
      currentHour,
      bestHours: timing.best_hours,
      confidence: timing.confidence,
      reason: `${currentDay} is in avoid_days list`,
    };
  }

  // Check avoid hours
  if (timing.avoid_hours.includes(currentHour)) {
    return {
      isOptimal: false,
      currentHour,
      bestHours: timing.best_hours,
      confidence: timing.confidence,
      reason: `Hour ${currentHour} is in avoid_hours list`,
    };
  }

  // Check best hours (if defined)
  if (timing.best_hours.length > 0) {
    const isOptimal = timing.best_hours.includes(currentHour);
    return {
      isOptimal,
      currentHour,
      bestHours: timing.best_hours,
      confidence: timing.confidence,
      reason: isOptimal
        ? `Hour ${currentHour} is in best_hours`
        : `Hour ${currentHour} is not in best_hours [${timing.best_hours.join(', ')}]`,
    };
  }

  // No timing rules defined
  return {
    isOptimal: true,
    currentHour,
    bestHours: [],
    confidence: 0,
    reason: 'No timing rules defined',
  };
}

// ============================================
// Daily Limits
// ============================================

export function checkDailyLimits(
  actionType: string,
  platform: string
): LimitCheckResult {
  const bounds = loadBounds();

  // Map action types to bounds keys
  const limitMap: Record<string, { category: string; key: string }> = {
    post: { category: 'posting', key: 'max_per_day' },
    like: { category: 'engagement', key: 'max_likes_per_day' },
    follow: { category: 'engagement', key: 'max_follows_per_day' },
    follow_back: { category: 'engagement', key: 'max_follows_per_day' },
    unfollow: { category: 'engagement', key: 'max_unfollows_per_day' },
    comment: { category: 'engagement', key: 'max_comments_per_day' },
    reply: { category: 'engagement', key: 'max_comments_per_day' },
    repost: { category: 'engagement', key: 'max_reposts_per_day' },
    dm: { category: 'engagement', key: 'max_dms_per_day' },
  };

  const mapping = limitMap[actionType];
  if (!mapping) {
    // Unknown action type, allow
    return {
      allowed: true,
      current: 0,
      limit: Infinity,
      remaining: Infinity,
      limitType: 'unknown',
    };
  }

  // Get current count
  let current: number;
  if (actionType === 'post') {
    current = getTodayPostCount(platform);
  } else {
    current = getActivityCount(actionType, platform);
  }

  // Get limit from bounds
  const check = checkBounds('sns', mapping.category, mapping.key, current + 1);

  return {
    allowed: check.allowed,
    current,
    limit: check.limit,
    remaining: Math.max(0, check.limit - current),
    limitType: mapping.key,
  };
}

// ============================================
// Interval Check
// ============================================

export function checkMinInterval(platform: string): RuleCheckResult {
  const bounds = loadBounds();
  const minInterval = bounds.sns?.posting?.min_interval_minutes ?? 30;

  const lastPost = getLastPostTime(platform);

  if (!lastPost) {
    return { allowed: true };
  }

  const now = new Date();
  const diffMinutes = (now.getTime() - lastPost.getTime()) / (1000 * 60);

  if (diffMinutes < minInterval) {
    return {
      allowed: false,
      reason: `Minimum interval not met. Last post was ${Math.round(diffMinutes)} minutes ago, need ${minInterval} minutes`,
      rule: 'min_interval',
    };
  }

  return { allowed: true };
}

// ============================================
// Content Rules
// ============================================

export function applyContentRules(
  content: string,
  topic?: string
): { content: string; changes: string[] } {
  const rules = getRules();
  const bounds = loadBounds();
  const changes: string[] = [];
  let result = content;

  const minConfidence = bounds.evolution?.confidence?.min_to_apply ?? 0.5;

  for (const rule of rules.content.rules) {
    if (rule.confidence < minConfidence) {
      continue;
    }

    // Check if rule pattern matches
    const patternMatch = checkPattern(rule.pattern, content, topic);

    if (patternMatch) {
      // Apply action
      switch (rule.action) {
        case 'add_hashtags':
          if (rule.params?.hashtags) {
            const hashtags = rule.params.hashtags as string[];
            result = addHashtags(result, hashtags);
            changes.push(`Added hashtags: ${hashtags.join(', ')}`);
          }
          break;

        case 'prefer':
          // This is a preference, not a transformation
          changes.push(`Matched preference rule: ${rule.id}`);
          break;

        case 'avoid':
          logger.warn(`Content matches avoid rule: ${rule.id}`);
          break;
      }
    }
  }

  return { content: result, changes };
}

function checkPattern(
  pattern: string,
  content: string,
  topic?: string
): boolean {
  // Pattern format: "type:value"
  const [type, value] = pattern.split(':');

  switch (type) {
    case 'topic':
      return topic?.toLowerCase() === value?.toLowerCase();

    case 'length':
      if (value === 'short') return content.length < 140;
      if (value === 'medium') return content.length >= 140 && content.length < 280;
      if (value === 'long') return content.length >= 280;
      return false;

    case 'contains':
      return content.toLowerCase().includes(value?.toLowerCase() ?? '');

    case 'regex':
      try {
        const regex = new RegExp(value ?? '', 'i');
        return regex.test(content);
      } catch {
        return false;
      }

    default:
      return false;
  }
}

function addHashtags(content: string, hashtags: string[]): string {
  // Check existing hashtags
  const existingHashtags = content.match(/#\w+/g) || [];
  const existingSet = new Set(existingHashtags.map((h) => h.toLowerCase()));

  // Filter out already present hashtags
  const newHashtags = hashtags.filter(
    (h) => !existingSet.has(h.toLowerCase())
  );

  if (newHashtags.length === 0) {
    return content;
  }

  // Add hashtags at the end
  const hashtagStr = newHashtags.join(' ');
  return `${content}\n\n${hashtagStr}`;
}

// ============================================
// Engagement Rules
// ============================================

export function shouldFollowBack(
  handle: string,
  followers: number,
  isBot: boolean
): RuleCheckResult {
  const rules = getRules();
  const engagement = rules.engagement;

  if (!engagement.auto_follow_back.enabled) {
    return {
      allowed: false,
      reason: 'Auto follow back is disabled',
      rule: 'auto_follow_back.enabled',
    };
  }

  if (isBot) {
    return {
      allowed: false,
      reason: 'Account appears to be a bot',
      rule: 'not_bot',
    };
  }

  // Parse filter (e.g., "followers > 10")
  const filter = engagement.auto_follow_back.filter;
  if (filter.includes('followers >')) {
    const minFollowers = parseInt(filter.match(/followers > (\d+)/)?.[1] ?? '0');
    if (followers < minFollowers) {
      return {
        allowed: false,
        reason: `Follower count (${followers}) below minimum (${minFollowers})`,
        rule: 'min_followers',
      };
    }
  }

  return {
    allowed: true,
    confidence: engagement.auto_follow_back.confidence,
  };
}

export function getReplyDelay(): number {
  const rules = getRules();
  return rules.engagement.reply.delay_minutes;
}

export function getReplyStyle(): string {
  const rules = getRules();
  return rules.engagement.reply.style;
}

// ============================================
// Forbidden Topic Check
// ============================================

export function checkForbiddenTopics(content: string): RuleCheckResult {
  const bounds = loadBounds();
  const forbidden = bounds.sns?.forbidden_topics ?? [];

  for (const topic of forbidden) {
    if (content.toLowerCase().includes(topic.toLowerCase())) {
      return {
        allowed: false,
        reason: `Content contains forbidden topic: ${topic}`,
        rule: 'forbidden_topics',
      };
    }
  }

  return { allowed: true };
}

// ============================================
// Combined Pre-Check
// ============================================

export function runPreChecks(
  actionType: string,
  platform: string,
  content?: string
): RuleCheckResult {
  // Check daily limits
  const limitCheck = checkDailyLimits(actionType, platform);
  if (!limitCheck.allowed) {
    return {
      allowed: false,
      reason: `Daily limit reached for ${actionType}: ${limitCheck.current}/${limitCheck.limit}`,
      rule: limitCheck.limitType,
    };
  }

  // Check min interval for posts
  if (actionType === 'post') {
    const intervalCheck = checkMinInterval(platform);
    if (!intervalCheck.allowed) {
      return intervalCheck;
    }
  }

  // Check forbidden topics if content provided
  if (content) {
    const forbiddenCheck = checkForbiddenTopics(content);
    if (!forbiddenCheck.allowed) {
      return forbiddenCheck;
    }
  }

  return { allowed: true };
}

// ============================================
// Confidence-Based Auto-Apply
// ============================================

export function shouldAutoApply(confidence: number): boolean {
  const bounds = loadBounds();
  const autoApplyThreshold = bounds.evolution?.confidence?.auto_apply ?? 0.7;
  return confidence >= autoApplyThreshold;
}

export function requiresApproval(confidence: number): boolean {
  const bounds = loadBounds();
  const approvalThreshold = bounds.evolution?.confidence?.require_approval ?? 0.9;
  return confidence >= approvalThreshold;
}

// Default export
export default {
  checkTimingRules,
  checkDailyLimits,
  checkMinInterval,
  applyContentRules,
  shouldFollowBack,
  getReplyDelay,
  getReplyStyle,
  checkForbiddenTopics,
  runPreChecks,
  shouldAutoApply,
  requiresApproval,
  refreshRules,
};
