// Telegram Notification Service
// Sends notifications and alerts via Telegram bot

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface NotificationIcons {
  info: string;
  success: string;
  warning: string;
  error: string;
}

const icons: NotificationIcons = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

let config: TelegramConfig | null = null;

/**
 * Initialize Telegram service with config
 */
export function init(telegramConfig: TelegramConfig): void {
  config = telegramConfig;
}

/**
 * Send a message via Telegram
 */
export async function send(message: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): Promise<boolean> {
  if (!config?.enabled || !config.botToken || !config.chatId) {
    console.log('[Telegram] Not configured, skipping notification');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: parseMode,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[Telegram] Failed to send:', error);
    return false;
  }
}

/**
 * Notify about successful post
 */
export async function notifyPostSuccess(platform: string, content: string, postUrl?: string): Promise<boolean> {
  const preview = content.length > 100 ? content.slice(0, 100) + '...' : content;
  let message = `${icons.success} **Post Published**\n\n`;
  message += `**Platform**: ${platform}\n`;
  message += `**Content**: ${preview}`;

  if (postUrl) {
    message += `\n\n🔗 ${postUrl}`;
  }

  return send(message);
}

/**
 * Notify about error
 */
export async function notifyError(context: string, error: string): Promise<boolean> {
  const message = `${icons.error} **Error**\n\n**Context**: ${context}\n**Error**: ${error}`;
  return send(message);
}

/**
 * Notify about new follower
 */
export async function notifyNewFollower(platform: string, handle: string, followers?: number): Promise<boolean> {
  let message = `👤 **New Follower**\n\n`;
  message += `**Platform**: ${platform}\n`;
  message += `**Handle**: ${handle}`;

  if (followers !== undefined) {
    message += `\n**Total Followers**: ${followers}`;
  }

  return send(message);
}

/**
 * Request approval for an action
 */
export interface ApprovalRequest {
  id: string;
  type: 'post' | 'reply' | 'follow' | 'other';
  content: string;
  channel?: string;
}

export async function requestApproval(request: ApprovalRequest): Promise<boolean> {
  let message = `📝 **Approval Required**\n\n`;
  message += `**Type**: ${request.type}\n`;

  if (request.channel) {
    message += `**Channel**: ${request.channel}\n`;
  }

  message += `\n**Content**:\n\`\`\`\n${request.content}\n\`\`\`\n\n`;
  message += `${icons.success} Approve: \`/approve ${request.id}\`\n`;
  message += `${icons.error} Reject: \`/reject ${request.id}\``;

  return send(message);
}

/**
 * Send daily summary
 */
export interface DailySummary {
  posts: number;
  likes: number;
  follows: number;
  replies: number;
  followerGrowth: number;
}

export async function sendDailySummary(summary: DailySummary): Promise<boolean> {
  const message = `📊 **Daily Summary**

🗓️ ${new Date().toLocaleDateString('en-US')}

**Activity**
• Posts: ${summary.posts}
• Likes: ${summary.likes}
• Follows: ${summary.follows}
• Replies: ${summary.replies}

**Growth**
• Follower Change: ${summary.followerGrowth >= 0 ? '+' : ''}${summary.followerGrowth}`;

  return send(message);
}

export default {
  init,
  send,
  notifyPostSuccess,
  notifyError,
  notifyNewFollower,
  requestApproval,
  sendDailySummary,
  icons,
};
