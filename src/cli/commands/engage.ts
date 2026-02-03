/**
 * Engage Command
 * Run engagement actions on SNS platforms
 */

import { Command } from 'commander';
import logger from '../../utils/logger.js';
import { loadChannelConfig, loadBounds } from '../../core/config-loader.js';
import { checkDailyLimits } from '../../core/rule-engine.js';
import xBrowser from '../../browser/x.js';
import threadsBrowser from '../../browser/threads.js';

interface EngageOptions {
  channel: string;
  action: string;
  target?: string;
  limit?: string;
  dryRun?: boolean;
}

type EngagementAction = 'like' | 'follow' | 'follow-back' | 'repost' | 'notifications' | 'all';

export function registerEngageCommand(program: Command): void {
  program
    .command('engage')
    .description('Run engagement actions on a SNS channel')
    .requiredOption('-c, --channel <channel>', 'Target channel (x, threads)')
    .requiredOption(
      '-a, --action <action>',
      'Action to perform (like, follow, follow-back, repost, notifications, all)'
    )
    .option('-t, --target <target>', 'Target username (for follow/unfollow)')
    .option('-l, --limit <limit>', 'Maximum number of actions')
    .option('--dry-run', 'Simulate without actually performing actions')
    .action(async (options: EngageOptions) => {
      await executeEngage(options);
    });
}

async function executeEngage(options: EngageOptions): Promise<void> {
  const { channel, action, target, limit, dryRun } = options;

  logger.info(`Running ${action} on ${channel}...`);

  // Load channel configuration
  const channelConfig = loadChannelConfig(channel);
  if (!channelConfig) {
    logger.error(`Channel not found: ${channel}`);
    process.exit(1);
  }

  if (!channelConfig.channel.enabled) {
    logger.error(`Channel is disabled: ${channel}`);
    process.exit(1);
  }

  // Load bounds for limits
  const bounds = loadBounds();
  const engagementBounds = bounds.sns?.engagement;

  // Parse limit
  const maxActions = limit ? parseInt(limit) : undefined;

  // Check daily limits
  const validActions: EngagementAction[] = ['like', 'follow', 'follow-back', 'repost', 'notifications', 'all'];
  if (!validActions.includes(action as EngagementAction)) {
    logger.error(`Invalid action: ${action}`);
    logger.info(`Valid actions: ${validActions.join(', ')}`);
    process.exit(1);
  }

  if (action !== 'notifications' && action !== 'all') {
    const limitCheck = checkDailyLimits(action === 'follow-back' ? 'follow' : action, channel);
    if (!limitCheck.allowed) {
      logger.error(
        `Daily limit reached for ${action}: ${limitCheck.current}/${limitCheck.limit}`
      );
      process.exit(1);
    }
    logger.info(`Daily limit status: ${limitCheck.current}/${limitCheck.limit} (${limitCheck.remaining} remaining)`);
  }

  // Dry run check
  if (dryRun) {
    logger.info('Dry run mode - actions not performed');
    return;
  }

  try {
    switch (action as EngagementAction) {
      case 'notifications':
        await handleNotifications(channel);
        break;
      case 'follow':
        await handleFollow(channel, target);
        break;
      case 'follow-back':
        await handleFollowBack(channel);
        break;
      case 'like':
      case 'repost':
      case 'all':
        await handleFeedEngagement(channel, action, {
          maxLikes: action === 'like' || action === 'all'
            ? maxActions ?? engagementBounds?.max_likes_per_day ?? 20
            : 0,
          maxReposts: action === 'repost' || action === 'all'
            ? maxActions ?? engagementBounds?.max_reposts_per_day ?? 5
            : 0,
        });
        break;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Engagement error: ${errorMessage}`);
    process.exit(1);
  } finally {
    await xBrowser.cleanup();
    await threadsBrowser.cleanup();
  }
}

async function handleNotifications(channel: string): Promise<void> {
  logger.info('Checking notifications...');

  let result;
  switch (channel) {
    case 'x':
      result = await xBrowser.checkNotifications();
      break;
    case 'threads':
      result = await threadsBrowser.checkActivity();
      break;
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }

  if (result.success && result.data) {
    const data = result.data as {
      counts: Record<string, number>;
      notifications: Array<{ type: string; content?: string }>;
    };

    logger.success('Notifications retrieved:');
    console.log('---');
    console.log(`Total: ${data.counts.total}`);
    console.log(`Likes: ${data.counts.likes || 0}`);
    console.log(`Follows: ${data.counts.follows || 0}`);
    console.log(`Replies: ${data.counts.replies || 0}`);
    console.log(`Mentions: ${data.counts.mentions || 0}`);
    console.log('---');

    // Show recent notifications
    if (data.notifications.length > 0) {
      logger.info('Recent activity:');
      for (const notif of data.notifications.slice(0, 5)) {
        console.log(`  [${notif.type}] ${notif.content?.substring(0, 80)}...`);
      }
    }
  } else {
    logger.error(`Failed to check notifications: ${result.error}`);
  }
}

async function handleFollow(channel: string, target?: string): Promise<void> {
  if (!target) {
    logger.error('Target username is required for follow action');
    process.exit(1);
  }

  logger.info(`Following @${target}...`);

  let result;
  switch (channel) {
    case 'x':
      result = await xBrowser.followUser(target);
      break;
    case 'threads':
      result = await threadsBrowser.followUser(target);
      break;
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }

  if (result.success) {
    logger.success(`Followed @${target} successfully!`);
  } else {
    logger.error(`Failed to follow: ${result.error}`);
  }
}

async function handleFollowBack(channel: string): Promise<void> {
  logger.info('Checking for new followers to follow back...');

  // First, get notifications to find new followers
  let notifResult;
  switch (channel) {
    case 'x':
      notifResult = await xBrowser.checkNotifications();
      break;
    case 'threads':
      notifResult = await threadsBrowser.checkActivity();
      break;
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }

  if (!notifResult.success || !notifResult.data) {
    logger.error('Failed to get notifications');
    return;
  }

  const data = notifResult.data as {
    notifications: Array<{ type: string; username?: string }>;
  };

  const newFollowers = data.notifications.filter((n) => n.type === 'follow');

  if (newFollowers.length === 0) {
    logger.info('No new followers to follow back');
    return;
  }

  logger.info(`Found ${newFollowers.length} new followers`);

  // Note: In real implementation, you would extract usernames from notifications
  // and follow them back. This is a placeholder.
  logger.warn('Auto follow-back requires username extraction (not fully implemented)');
}

async function handleFeedEngagement(
  channel: string,
  action: string,
  options: { maxLikes: number; maxReposts: number }
): Promise<void> {
  logger.info(`Running feed engagement (likes: ${options.maxLikes}, reposts: ${options.maxReposts})...`);

  let result;
  switch (channel) {
    case 'x':
      result = await xBrowser.engageWithFeed({
        maxLikes: options.maxLikes,
        maxReposts: options.maxReposts,
        maxReplies: 0, // No replies in basic engage
      });
      break;
    case 'threads':
      result = await threadsBrowser.engageWithFeed({
        maxLikes: options.maxLikes,
        maxReposts: options.maxReposts,
        maxReplies: 0,
      });
      break;
    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }

  if (result.success && result.data) {
    const data = result.data as { likes: number; reposts: number; replies: number };
    logger.success('Engagement completed:');
    console.log('---');
    console.log(`Likes: ${data.likes}`);
    console.log(`Reposts: ${data.reposts}`);
    console.log(`Replies: ${data.replies}`);
    console.log('---');
  } else {
    logger.error(`Engagement failed: ${result.error}`);
  }
}

export default { registerEngageCommand };
