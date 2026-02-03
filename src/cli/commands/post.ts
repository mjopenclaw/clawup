/**
 * Post Command
 * Create and publish posts to SNS platforms
 */

import { Command } from 'commander';
import logger from '../../utils/logger.js';
import { loadChannelConfig } from '../../core/config-loader.js';
import { runPreChecks, applyContentRules } from '../../core/rule-engine.js';
import { checkSimilarity } from '../../services/similarity.js';
import { adaptTone } from '../../services/tone-adapter.js';
import xBrowser from '../../browser/x.js';
import threadsBrowser from '../../browser/threads.js';

interface PostOptions {
  channel: string;
  content?: string;
  tone?: string;
  dryRun?: boolean;
  skipChecks?: boolean;
}

export function registerPostCommand(program: Command): void {
  program
    .command('post')
    .description('Create and publish a post to a SNS channel')
    .requiredOption('-c, --channel <channel>', 'Target channel (x, threads)')
    .option('-t, --content <content>', 'Post content')
    .option('--tone <tone>', 'Tone to apply (casual, formal, witty)')
    .option('--dry-run', 'Simulate without actually posting')
    .option('--skip-checks', 'Skip pre-posting checks')
    .action(async (options: PostOptions) => {
      await executePost(options);
    });
}

async function executePost(options: PostOptions): Promise<void> {
  const { channel, content, tone, dryRun, skipChecks } = options;

  logger.info(`Preparing to post to ${channel}...`);

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

  // Get content (from argument or prompt)
  let postContent = content;
  if (!postContent) {
    logger.error('Content is required. Use --content "your post"');
    process.exit(1);
  }

  // Apply tone adaptation
  const toneId = tone || channelConfig.channel.content.tone_ref;
  if (toneId) {
    logger.info(`Applying tone: ${toneId}`);
    const toneResult = adaptTone(postContent, {
      toneId,
      maxLength: channelConfig.channel.content.max_length,
    });

    if (toneResult.success) {
      postContent = toneResult.content;
      if (toneResult.changes?.length) {
        logger.debug(`Tone changes: ${toneResult.changes.join(', ')}`);
      }
    }
  }

  // Apply content rules
  const { content: ruledContent, changes } = applyContentRules(postContent);
  postContent = ruledContent;
  if (changes.length > 0) {
    logger.debug(`Rule changes: ${changes.join(', ')}`);
  }

  // Run pre-checks
  if (!skipChecks) {
    logger.info('Running pre-posting checks...');

    // Check rules and limits
    const preCheck = runPreChecks('post', channel, postContent);
    if (!preCheck.allowed) {
      logger.error(`Pre-check failed: ${preCheck.reason}`);
      process.exit(1);
    }

    // Check similarity
    const similarityResult = await checkSimilarity(postContent, { platform: channel });
    if (similarityResult.isSimilar) {
      logger.error(
        `Similar content detected (${(similarityResult.highestSimilarity * 100).toFixed(1)}% match)`
      );
      logger.error(`Similar post: ${similarityResult.similarPost?.substring(0, 100)}...`);
      process.exit(1);
    }

    logger.success('All pre-checks passed');
  }

  // Check content length
  const maxLength = channelConfig.channel.content.max_length;
  if (postContent.length > maxLength) {
    logger.warn(`Content exceeds max length (${postContent.length}/${maxLength}), truncating...`);
    postContent = postContent.substring(0, maxLength - 3) + '...';
  }

  // Display final content
  logger.info('Final content:');
  console.log('---');
  console.log(postContent);
  console.log('---');
  logger.info(`Length: ${postContent.length}/${maxLength}`);

  // Dry run check
  if (dryRun) {
    logger.info('Dry run mode - post not published');
    return;
  }

  // Execute post based on channel
  try {
    let result;

    switch (channel) {
      case 'x':
        result = await xBrowser.postToX(postContent);
        break;
      case 'threads':
        result = await threadsBrowser.postToThreads(postContent);
        break;
      default:
        logger.error(`Unsupported channel: ${channel}`);
        process.exit(1);
    }

    if (result.success) {
      logger.success(`Posted to ${channel} successfully!`);
    } else {
      logger.error(`Failed to post: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Post error: ${errorMessage}`);
    process.exit(1);
  } finally {
    // Cleanup browser
    await xBrowser.cleanup();
    await threadsBrowser.cleanup();
  }
}

export default { registerPostCommand };
