/**
 * Tone Adapter Service
 * Adapt content to different tones/styles
 */

import { loadTone } from '../core/config-loader.js';
import logger from '../utils/logger.js';
import type { ToneConfig } from '../types/index.js';

// ============================================
// Types
// ============================================

export interface ToneAdaptOptions {
  toneId: string;
  preserveLength?: boolean;
  maxLength?: number;
}

export interface ToneAdaptResult {
  success: boolean;
  content: string;
  toneApplied: string;
  changes?: string[];
}

// ============================================
// Tone Loading
// ============================================

const toneCache = new Map<string, ToneConfig>();

function getTone(toneId: string): ToneConfig | null {
  if (toneCache.has(toneId)) {
    return toneCache.get(toneId)!;
  }

  const tone = loadTone(toneId);
  if (tone) {
    toneCache.set(toneId, tone);
  }

  return tone;
}

// ============================================
// Basic Transformations
// ============================================

// Korean formal to casual endings
const formalToCasualMap: Record<string, string> = {
  '습니다': '음',
  '합니다': '함',
  '입니다': '임',
  '됩니다': '됨',
  '있습니다': '있음',
  '없습니다': '없음',
  '했습니다': '했음',
  '됐습니다': '됐음',
  '하세요': '해',
  '드립니다': '드림',
  '같습니다': '같음',
  '봅니다': '봄',
  '옵니다': '옴',
  '갑니다': '감',
};

const casualToFormalMap: Record<string, string> = Object.fromEntries(
  Object.entries(formalToCasualMap).map(([k, v]) => [v, k])
);

function convertToInformal(text: string): string {
  let result = text;

  for (const [formal, casual] of Object.entries(formalToCasualMap)) {
    const regex = new RegExp(formal, 'g');
    result = result.replace(regex, casual);
  }

  return result;
}

function convertToFormal(text: string): string {
  let result = text;

  for (const [casual, formal] of Object.entries(casualToFormalMap)) {
    const regex = new RegExp(`${casual}(?![가-힣])`, 'g');
    result = result.replace(regex, formal);
  }

  return result;
}

// ============================================
// Emoji Handling
// ============================================

const commonEmojis = ['😊', '👍', '🔥', '✨', '💪', '🙏', '😎', '🎉', '💡', '⭐'];

function countEmojis(text: string): number {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

function removeEmojis(text: string): string {
  return text
    .replace(
      /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function addRandomEmoji(text: string, max = 2): string {
  const current = countEmojis(text);
  if (current >= max) {
    return text;
  }

  const toAdd = Math.min(max - current, 1 + Math.floor(Math.random() * 2));
  const emojis: string[] = [];

  for (let i = 0; i < toAdd; i++) {
    const emoji = commonEmojis[Math.floor(Math.random() * commonEmojis.length)];
    emojis.push(emoji);
  }

  // Add emoji at the end or after punctuation
  if (text.endsWith('.') || text.endsWith('!') || text.endsWith('?')) {
    return text + ' ' + emojis.join('');
  }

  return text + ' ' + emojis.join('');
}

// ============================================
// Slang Conversions
// ============================================

const slangMap: Record<string, string> = {
  '정말': 'ㄹㅇ',
  '진짜': 'ㄹㅇ',
  'ㅋㅋㅋ': 'ㅋㅋ',
  '네': 'ㅇㅇ',
  '예': 'ㅇㅇ',
  '좋아': '굿',
  '알겠어': '오키',
};

function addSlang(text: string): string {
  let result = text;

  // Randomly add ㅋㅋ to positive sentences
  if (Math.random() > 0.5 && !result.includes('ㅋ')) {
    result = result.replace(/([.!])(\s|$)/g, ' ㅋㅋ$1$2');
  }

  return result;
}

function removeSlang(text: string): string {
  let result = text;

  result = result.replace(/ㅋ+/g, '');
  result = result.replace(/ㅎ+/g, '');
  result = result.replace(/ㅠ+/g, '');
  result = result.replace(/ㅜ+/g, '');

  // Replace slang with proper words
  result = result.replace(/ㄹㅇ/g, '정말');
  result = result.replace(/ㅇㅇ/g, '네');

  return result.replace(/\s+/g, ' ').trim();
}

// ============================================
// Main Adaptation Functions
// ============================================

export function adaptToCasual(content: string): ToneAdaptResult {
  const changes: string[] = [];
  let result = content;

  // Convert formal endings to casual
  const beforeConvert = result;
  result = convertToInformal(result);
  if (beforeConvert !== result) {
    changes.push('Converted formal endings to casual');
  }

  // Add some slang
  const beforeSlang = result;
  result = addSlang(result);
  if (beforeSlang !== result) {
    changes.push('Added casual expressions');
  }

  // Add emoji if none
  if (countEmojis(result) === 0 && Math.random() > 0.3) {
    result = addRandomEmoji(result, 2);
    changes.push('Added emoji');
  }

  return {
    success: true,
    content: result,
    toneApplied: 'casual',
    changes,
  };
}

export function adaptToFormal(content: string): ToneAdaptResult {
  const changes: string[] = [];
  let result = content;

  // Remove slang
  const beforeSlang = result;
  result = removeSlang(result);
  if (beforeSlang !== result) {
    changes.push('Removed slang');
  }

  // Convert casual to formal
  const beforeConvert = result;
  result = convertToFormal(result);
  if (beforeConvert !== result) {
    changes.push('Converted to formal endings');
  }

  // Remove excessive emojis (keep max 1)
  const emojiCount = countEmojis(result);
  if (emojiCount > 1) {
    result = removeEmojis(result);
    changes.push('Removed excessive emojis');
  }

  return {
    success: true,
    content: result,
    toneApplied: 'formal',
    changes,
  };
}

export function adaptToWitty(content: string): ToneAdaptResult {
  const changes: string[] = [];
  let result = content;

  // Start with casual base
  result = convertToInformal(result);

  // Add witty elements
  const wittyAdditions = [
    ' (진짜임)',
    ' ㅋㅋ',
    '... 근데 ',
    ' (내 얘기임)',
  ];

  // Randomly add witty parenthetical
  if (Math.random() > 0.5 && !result.includes('(')) {
    const addition =
      wittyAdditions[Math.floor(Math.random() * wittyAdditions.length)];
    if (result.endsWith('.') || result.endsWith('!')) {
      result = result.slice(0, -1) + addition + result.slice(-1);
    } else {
      result += addition;
    }
    changes.push('Added witty expression');
  }

  // Add emoji
  if (countEmojis(result) < 2) {
    result = addRandomEmoji(result, 3);
    changes.push('Added emoji');
  }

  return {
    success: true,
    content: result,
    toneApplied: 'witty',
    changes,
  };
}

// ============================================
// Generic Tone Adaptation
// ============================================

export function adaptTone(
  content: string,
  options: ToneAdaptOptions
): ToneAdaptResult {
  const { toneId, maxLength } = options;

  // Load tone configuration
  const toneConfig = getTone(toneId);

  if (!toneConfig) {
    logger.warn(`Tone not found: ${toneId}, using original content`);
    return {
      success: false,
      content,
      toneApplied: 'none',
    };
  }

  // Apply tone-specific transformation
  let result: ToneAdaptResult;

  switch (toneId) {
    case 'casual':
      result = adaptToCasual(content);
      break;
    case 'formal':
      result = adaptToFormal(content);
      break;
    case 'witty':
      result = adaptToWitty(content);
      break;
    default:
      // For custom tones, apply basic rules
      result = applyToneRules(content, toneConfig);
  }

  // Apply length constraint if specified
  if (maxLength && result.content.length > maxLength) {
    result.content = result.content.substring(0, maxLength - 3) + '...';
    result.changes = result.changes || [];
    result.changes.push(`Truncated to ${maxLength} characters`);
  }

  return result;
}

function applyToneRules(content: string, toneConfig: ToneConfig): ToneAdaptResult {
  const changes: string[] = [];
  let result = content;
  const tone = toneConfig.tone;

  // Check forbidden patterns
  for (const forbidden of tone.forbidden || []) {
    if (result.includes(forbidden)) {
      // Try to find replacement in examples
      const example = tone.examples?.find((e) =>
        e.input.includes(forbidden)
      );
      if (example) {
        result = result.replace(forbidden, example.output);
        changes.push(`Replaced forbidden pattern: ${forbidden}`);
      }
    }
  }

  // Apply emoji rules
  const emojiConfig = tone.emoji;
  if (emojiConfig) {
    const currentCount = countEmojis(result);

    if (!emojiConfig.allowed && currentCount > 0) {
      result = removeEmojis(result);
      changes.push('Removed emojis (not allowed)');
    } else if (emojiConfig.allowed && currentCount > emojiConfig.max_count) {
      // Remove excess emojis
      const emojiRegex =
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
      let count = 0;
      result = result.replace(emojiRegex, (match) => {
        count++;
        return count <= emojiConfig.max_count ? match : '';
      });
      changes.push(`Limited emojis to ${emojiConfig.max_count}`);
    }
  }

  return {
    success: true,
    content: result,
    toneApplied: tone.id,
    changes,
  };
}

// ============================================
// Generate Prompt Hint for LLM
// ============================================

export function getTonePromptHint(toneId: string): string | null {
  const toneConfig = getTone(toneId);

  if (!toneConfig) {
    return null;
  }

  return toneConfig.tone.prompt_hint;
}

// Default export
export default {
  adaptTone,
  adaptToCasual,
  adaptToFormal,
  adaptToWitty,
  getTonePromptHint,
  countEmojis,
  removeEmojis,
};
