/**
 * Telegram Service
 * Send notifications and handle approval requests via Telegram
 */

import { loadConfig } from '../core/config-loader.js';
import logger from '../utils/logger.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface SendMessageOptions {
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  disablePreview?: boolean;
  replyToMessageId?: number;
}

interface TelegramResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
  description?: string;
}

// ============================================
// Configuration
// ============================================

function getTelegramConfig(): TelegramConfig | null {
  const config = loadConfig();
  const telegram = config.accounts?.telegram;

  if (!telegram?.enabled) {
    return null;
  }

  if (!telegram.monitor_bot_token || !telegram.monitor_chat_id) {
    logger.warn('Telegram enabled but missing bot_token or chat_id');
    return null;
  }

  return {
    botToken: telegram.monitor_bot_token,
    chatId: telegram.monitor_chat_id,
  };
}

// ============================================
// API Calls
// ============================================

async function callTelegramApi(
  method: string,
  params: Record<string, unknown>,
  botToken: string
): Promise<TelegramResponse> {
  const url = `${TELEGRAM_API_BASE}${botToken}/${method}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = (await response.json()) as TelegramResponse;

    if (!data.ok) {
      logger.error(`Telegram API error: ${data.description}`);
    }

    return data;
  } catch (error) {
    logger.error('Failed to call Telegram API:', error);
    return { ok: false, description: String(error) };
  }
}

// ============================================
// Send Message
// ============================================

export async function sendMessage(
  message: string,
  options: SendMessageOptions = {}
): Promise<{ success: boolean; messageId?: number }> {
  const config = getTelegramConfig();

  if (!config) {
    logger.warn('Telegram not configured, skipping message');
    return { success: false };
  }

  const params: Record<string, unknown> = {
    chat_id: config.chatId,
    text: message,
  };

  if (options.parseMode) {
    params.parse_mode = options.parseMode;
  }

  if (options.disablePreview) {
    params.disable_web_page_preview = true;
  }

  if (options.replyToMessageId) {
    params.reply_to_message_id = options.replyToMessageId;
  }

  const response = await callTelegramApi('sendMessage', params, config.botToken);

  if (response.ok && response.result) {
    return { success: true, messageId: response.result.message_id };
  }

  return { success: false };
}

// ============================================
// Notification Helpers
// ============================================

export async function notify(
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): Promise<boolean> {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  const formattedMessage = `${icons[type]} ${message}`;
  const result = await sendMessage(formattedMessage);
  return result.success;
}

export async function notifyPostSuccess(
  platform: string,
  content: string,
  postUrl?: string
): Promise<boolean> {
  const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;

  let message = `✅ **포스팅 완료**\n\n`;
  message += `**채널**: ${platform}\n`;
  message += `**내용**: ${preview}`;

  if (postUrl) {
    message += `\n\n🔗 ${postUrl}`;
  }

  const result = await sendMessage(message, { parseMode: 'Markdown' });
  return result.success;
}

export async function notifyError(
  context: string,
  error: string
): Promise<boolean> {
  const message = `❌ **에러 발생**\n\n**컨텍스트**: ${context}\n**에러**: ${error}`;
  const result = await sendMessage(message, { parseMode: 'Markdown' });
  return result.success;
}

export async function notifyNewFollower(
  platform: string,
  handle: string,
  followers?: number
): Promise<boolean> {
  let message = `👤 **새 팔로워**\n\n`;
  message += `**채널**: ${platform}\n`;
  message += `**핸들**: ${handle}`;

  if (followers !== undefined) {
    message += `\n**팔로워 수**: ${followers}`;
  }

  const result = await sendMessage(message, { parseMode: 'Markdown' });
  return result.success;
}

// ============================================
// Approval System
// ============================================

interface ApprovalRequest {
  id: string;
  type: 'post' | 'action' | 'rule';
  content: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}

const pendingApprovals = new Map<string, ApprovalRequest>();

export async function requestApproval(
  request: ApprovalRequest
): Promise<{ messageId: number; requestId: string } | null> {
  const config = getTelegramConfig();

  if (!config) {
    logger.warn('Telegram not configured, auto-approving');
    return null;
  }

  // Store the request
  pendingApprovals.set(request.id, request);

  // Format the message
  let message = `📝 **검토 요청**\n\n`;
  message += `**유형**: ${request.type}\n`;

  if (request.channel) {
    message += `**채널**: ${request.channel}\n`;
  }

  message += `\n**내용**:\n\`\`\`\n${request.content}\n\`\`\`\n\n`;
  message += `✅ 승인: \`/approve ${request.id}\`\n`;
  message += `❌ 거부: \`/reject ${request.id}\``;

  const result = await sendMessage(message, { parseMode: 'Markdown' });

  if (result.success && result.messageId) {
    return { messageId: result.messageId, requestId: request.id };
  }

  return null;
}

export function getPendingApproval(requestId: string): ApprovalRequest | undefined {
  return pendingApprovals.get(requestId);
}

export function clearApproval(requestId: string): void {
  pendingApprovals.delete(requestId);
}

// ============================================
// Dashboard & Reports
// ============================================

export async function sendDashboard(dashboardContent: string): Promise<boolean> {
  // Telegram has a 4096 character limit
  if (dashboardContent.length > 4000) {
    // Split into multiple messages
    const chunks = splitMessage(dashboardContent, 4000);

    for (const chunk of chunks) {
      const result = await sendMessage(chunk, { parseMode: 'Markdown' });
      if (!result.success) {
        return false;
      }
    }

    return true;
  }

  const result = await sendMessage(dashboardContent, { parseMode: 'Markdown' });
  return result.success;
}

export async function sendDailySummary(summary: {
  posts: number;
  likes: number;
  follows: number;
  replies: number;
  followerGrowth: number;
}): Promise<boolean> {
  const message = `📊 **일일 요약**

🗓️ ${new Date().toLocaleDateString('ko-KR')}

**활동**
• 포스팅: ${summary.posts}
• 좋아요: ${summary.likes}
• 팔로우: ${summary.follows}
• 답글: ${summary.replies}

**성장**
• 팔로워 변화: ${summary.followerGrowth >= 0 ? '+' : ''}${summary.followerGrowth}`;

  const result = await sendMessage(message, { parseMode: 'Markdown' });
  return result.success;
}

// ============================================
// Utility Functions
// ============================================

function splitMessage(message: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = message;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = remaining.lastIndexOf('\n', maxLength);
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(' ', maxLength);
    }
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks;
}

export function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
}

// ============================================
// Check Bot Status
// ============================================

export async function checkBotStatus(): Promise<{
  ok: boolean;
  username?: string;
}> {
  const config = getTelegramConfig();

  if (!config) {
    return { ok: false };
  }

  const response = await callTelegramApi('getMe', {}, config.botToken);

  if (response.ok && response.result) {
    return {
      ok: true,
      username: (response.result as { username?: string }).username,
    };
  }

  return { ok: false };
}

// Default export
export default {
  sendMessage,
  notify,
  notifyPostSuccess,
  notifyError,
  notifyNewFollower,
  requestApproval,
  getPendingApproval,
  clearApproval,
  sendDashboard,
  sendDailySummary,
  escapeMarkdown,
  checkBotStatus,
};
