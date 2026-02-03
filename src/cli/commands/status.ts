/**
 * Status Command
 * Display current status, stats, and health of the framework
 */

import { Command } from 'commander';
import logger from '../../utils/logger.js';
import paths from '../../utils/paths.js';
import { loadConfig, loadBounds, loadRules } from '../../core/config-loader.js';
import {
  initDatabase,
  getTodayPostCount,
  getActivityCount,
  getRecentPosts,
  getDailyStats,
} from '../../services/database.js';
import { checkTimingRules, checkDailyLimits } from '../../core/rule-engine.js';
import { existsSync } from 'fs';

interface StatusOptions {
  detailed?: boolean;
  json?: boolean;
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Display current framework status and statistics')
    .option('-d, --detailed', 'Show detailed information')
    .option('--json', 'Output in JSON format')
    .action(async (options: StatusOptions) => {
      await executeStatus(options);
    });
}

async function executeStatus(options: StatusOptions): Promise<void> {
  const { detailed, json } = options;

  // Initialize database if needed
  try {
    initDatabase();
  } catch (error) {
    // DB initialization might fail if schema files don't exist, that's ok
  }

  const status = collectStatus(detailed ?? false);

  if (json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  displayStatus(status, detailed ?? false);
}

interface FrameworkStatus {
  framework: {
    version: string;
    configLoaded: boolean;
    databaseExists: boolean;
    paths: {
      root: string;
      config: string;
      data: string;
    };
  };
  timing: {
    currentHour: number;
    isOptimal: boolean;
    bestHours: number[];
    reason: string;
  };
  channels: Array<{
    id: string;
    enabled: boolean;
    todayPosts: number;
    postLimit: number;
    remaining: number;
  }>;
  activity: {
    today: {
      posts: number;
      likes: number;
      follows: number;
      replies: number;
      comments: number;
    };
    limits: {
      posts: { current: number; limit: number };
      likes: { current: number; limit: number };
      follows: { current: number; limit: number };
    };
  };
  rules: {
    total: number;
    highConfidence: number;
    timing: {
      confidence: number;
      bestHours: number[];
      avoidDays: string[];
    };
  };
  recentPosts: Array<{
    platform: string;
    content: string;
    createdAt: string;
  }>;
}

function collectStatus(detailed: boolean): FrameworkStatus {
  // Load configurations
  let config;
  let bounds;
  let rules;

  try {
    config = loadConfig();
    bounds = loadBounds();
    rules = loadRules();
  } catch (error) {
    // Config may not exist yet
  }

  // Check timing
  const timingCheck = checkTimingRules();

  // Collect channel status
  const channels: FrameworkStatus['channels'] = [];
  const supportedChannels = ['x', 'threads'];

  for (const channelId of supportedChannels) {
    try {
      const todayPosts = getTodayPostCount(channelId);
      const limitCheck = checkDailyLimits('post', channelId);

      channels.push({
        id: channelId,
        enabled: true,
        todayPosts,
        postLimit: limitCheck.limit,
        remaining: limitCheck.remaining,
      });
    } catch {
      channels.push({
        id: channelId,
        enabled: true,
        todayPosts: 0,
        postLimit: bounds?.sns?.posting?.max_per_day ?? 6,
        remaining: bounds?.sns?.posting?.max_per_day ?? 6,
      });
    }
  }

  // Collect activity stats (with fallback if DB not initialized)
  let activity: FrameworkStatus['activity'];
  try {
    activity = {
      today: {
        posts: getTodayPostCount('all'),
        likes: getActivityCount('like', 'all'),
        follows: getActivityCount('follow', 'all'),
        replies: getActivityCount('reply', 'all'),
        comments: getActivityCount('comment', 'all'),
      },
      limits: {
        posts: {
          current: getTodayPostCount('all'),
          limit: bounds?.sns?.posting?.max_per_day ?? 6,
        },
        likes: {
          current: getActivityCount('like', 'all'),
          limit: bounds?.sns?.engagement?.max_likes_per_day ?? 50,
        },
        follows: {
          current: getActivityCount('follow', 'all'),
          limit: bounds?.sns?.engagement?.max_follows_per_day ?? 20,
        },
      },
    };
  } catch {
    activity = {
      today: { posts: 0, likes: 0, follows: 0, replies: 0, comments: 0 },
      limits: {
        posts: { current: 0, limit: bounds?.sns?.posting?.max_per_day ?? 6 },
        likes: { current: 0, limit: bounds?.sns?.engagement?.max_likes_per_day ?? 50 },
        follows: { current: 0, limit: bounds?.sns?.engagement?.max_follows_per_day ?? 20 },
      },
    };
  }

  // Get rules summary
  const contentRules = rules?.content?.rules ?? [];
  const highConfidenceRules = contentRules.filter((r: { confidence: number }) => r.confidence >= 0.7);

  // Get recent posts
  let recentPosts: FrameworkStatus['recentPosts'] = [];
  try {
    const recentPostsData = getRecentPosts(detailed ? 10 : 5);
    recentPosts = recentPostsData.map((p) => ({
      platform: p.platform,
      content: p.content.substring(0, 100) + (p.content.length > 100 ? '...' : ''),
      createdAt: p.posted_at || p.created_at || '',
    }));
  } catch {
    // DB not initialized yet
  }

  return {
    framework: {
      version: '0.1.0',
      configLoaded: !!config,
      databaseExists: existsSync(paths.database),
      paths: {
        root: paths.root,
        config: paths.config,
        data: paths.data,
      },
    },
    timing: {
      currentHour: timingCheck.currentHour,
      isOptimal: timingCheck.isOptimal,
      bestHours: timingCheck.bestHours,
      reason: timingCheck.reason,
    },
    channels,
    activity,
    rules: {
      total: contentRules.length,
      highConfidence: highConfidenceRules.length,
      timing: {
        confidence: rules?.timing?.confidence ?? 0,
        bestHours: rules?.timing?.best_hours ?? [],
        avoidDays: rules?.timing?.avoid_days ?? [],
      },
    },
    recentPosts,
  };
}

function displayStatus(status: FrameworkStatus, detailed: boolean): void {
  console.log('');
  logger.info('═══════════════════════════════════════════');
  logger.info('         OpenClaw Framework Status          ');
  logger.info('═══════════════════════════════════════════');
  console.log('');

  // Framework Status
  logger.info('📦 Framework');
  console.log(`   Version: ${status.framework.version}`);
  console.log(`   Config:  ${status.framework.configLoaded ? '✓ Loaded' : '✗ Not found'}`);
  console.log(`   Database: ${status.framework.databaseExists ? '✓ Exists' : '✗ Not found'}`);
  console.log('');

  // Timing Status
  logger.info('⏰ Timing');
  console.log(`   Current Hour: ${status.timing.currentHour}:00`);
  console.log(`   Optimal:      ${status.timing.isOptimal ? '✓ Yes' : '✗ No'}`);
  console.log(`   Best Hours:   ${status.timing.bestHours.join(', ') || 'Not defined'}`);
  console.log(`   Reason:       ${status.timing.reason}`);
  console.log('');

  // Channel Status
  logger.info('📱 Channels');
  for (const channel of status.channels) {
    const statusIcon = channel.enabled ? '✓' : '✗';
    const remaining = channel.remaining > 0 ? `(${channel.remaining} remaining)` : '(limit reached)';
    console.log(
      `   ${statusIcon} ${channel.id.toUpperCase().padEnd(10)} Posts: ${channel.todayPosts}/${channel.postLimit} ${remaining}`
    );
  }
  console.log('');

  // Activity Summary
  logger.info('📊 Today\'s Activity');
  console.log(`   Posts:    ${status.activity.today.posts}/${status.activity.limits.posts.limit}`);
  console.log(`   Likes:    ${status.activity.today.likes}/${status.activity.limits.likes.limit}`);
  console.log(`   Follows:  ${status.activity.today.follows}/${status.activity.limits.follows.limit}`);
  console.log(`   Replies:  ${status.activity.today.replies}`);
  console.log(`   Comments: ${status.activity.today.comments}`);
  console.log('');

  // Rules Summary
  logger.info('📜 Learned Rules');
  console.log(`   Total Rules:         ${status.rules.total}`);
  console.log(`   High Confidence:     ${status.rules.highConfidence}`);
  console.log(`   Timing Confidence:   ${(status.rules.timing.confidence * 100).toFixed(0)}%`);
  console.log('');

  // Recent Posts
  if (status.recentPosts.length > 0) {
    logger.info('📝 Recent Posts');
    for (const post of status.recentPosts) {
      console.log(`   [${post.platform}] ${post.content}`);
    }
    console.log('');
  }

  // Detailed Information
  if (detailed) {
    logger.info('📁 Paths');
    console.log(`   Root:     ${status.framework.paths.root}`);
    console.log(`   Config:   ${status.framework.paths.config}`);
    console.log(`   Data:     ${status.framework.paths.data}`);
    console.log('');

    logger.info('🎯 Timing Rules');
    console.log(`   Best Hours:  ${status.rules.timing.bestHours.join(', ') || 'None defined'}`);
    console.log(`   Avoid Days:  ${status.rules.timing.avoidDays.join(', ') || 'None'}`);
    console.log('');
  }

  logger.info('═══════════════════════════════════════════');
  console.log('');
}

export default { registerStatusCommand };
