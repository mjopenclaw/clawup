// Tone Adapter Service
// Adjusts content tone for different contexts

export type ToneStyle = 'formal' | 'casual' | 'professional' | 'friendly';

export interface ToneConfig {
  style: ToneStyle;
  maxLength?: number;
  addEmoji?: boolean;
}

const defaultConfig: ToneConfig = {
  style: 'casual',
  maxLength: 280,
  addEmoji: true,
};

// Common emoji set for engagement
const engagementEmojis = ['🔥', '✨', '💪', '🙏', '😎', '🎉', '💡', '⭐', '🚀', '👀'];

/**
 * Adapt text to specified tone style
 */
export function adaptTone(text: string, config: Partial<ToneConfig> = {}): string {
  const mergedConfig = { ...defaultConfig, ...config };
  let result = text;

  switch (mergedConfig.style) {
    case 'formal':
      result = toFormal(result);
      break;
    case 'casual':
      result = toCasual(result);
      break;
    case 'professional':
      result = toProfessional(result);
      break;
    case 'friendly':
      result = toFriendly(result);
      break;
  }

  if (mergedConfig.addEmoji && !containsEmoji(result)) {
    result = addRandomEmoji(result);
  }

  if (mergedConfig.maxLength && result.length > mergedConfig.maxLength) {
    result = truncateSmartly(result, mergedConfig.maxLength);
  }

  return result;
}

function toFormal(text: string): string {
  // Remove casual markers, ensure proper punctuation
  let result = text;
  result = result.replace(/!{2,}/g, '.');
  result = result.replace(/\.{3,}/g, '.');
  return result.trim();
}

function toCasual(text: string): string {
  // Make text more conversational
  let result = text;
  result = result.replace(/\. /g, '! ');
  return result.trim();
}

function toProfessional(text: string): string {
  // Clean, concise, no fluff
  let result = text;
  result = result.replace(/!+/g, '.');
  result = result.replace(/\s+/g, ' ');
  return result.trim();
}

function toFriendly(text: string): string {
  // Warm, approachable
  let result = text;
  if (!result.endsWith('!') && !result.endsWith('?')) {
    result = result.replace(/\.$/, '!');
  }
  return result.trim();
}

function containsEmoji(text: string): boolean {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]/u;
  return emojiRegex.test(text);
}

function addRandomEmoji(text: string): string {
  const emoji = engagementEmojis[Math.floor(Math.random() * engagementEmojis.length)];
  return `${text} ${emoji}`;
}

function truncateSmartly(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  // Try to cut at sentence boundary
  const truncated = text.slice(0, maxLength - 3);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastSpace = truncated.lastIndexOf(' ');
  
  const cutPoint = lastPeriod > maxLength * 0.7 ? lastPeriod + 1 : lastSpace;
  
  return text.slice(0, cutPoint).trim() + '...';
}

export default {
  adaptTone,
  toFormal,
  toCasual,
  toProfessional,
  toFriendly,
};
