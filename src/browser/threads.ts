/**
 * Threads Browser Automation
 * Platform-specific actions for Threads (Meta)
 */

import type { Page } from 'playwright';
import {
  getPage,
  closeBrowser,
  navigateTo,
  waitForSelector,
  clickElement,
  typeText,
  fillInput,
  takeScreenshot,
  humanDelay,
  humanScroll,
  isLoggedIn,
  waitForLogin,
  saveCookies,
  loadCookies,
  getContext,
  type BrowserOptions,
  type ActionResult,
} from './base.js';
import { recordActivity, recordPost } from '../services/database.js';
import logger from '../utils/logger.js';

// ============================================
// Selectors
// ============================================

const SELECTORS = {
  // Login (Instagram-based)
  loginButton: 'a[href*="login"]',
  continueWithInstagram: 'div[role="button"]:has-text("Continue with Instagram")',
  instagramUsernameInput: 'input[name="username"]',
  instagramPasswordInput: 'input[name="password"]',
  instagramLoginSubmit: 'button[type="submit"]',

  // Logged in indicators
  homeIcon: 'a[href="/"]',
  profileIcon: 'svg[aria-label="Profile"]',
  newThreadButton: 'svg[aria-label="Create"]',

  // Compose
  createButton: '[aria-label="Create"]',
  threadTextarea: 'div[contenteditable="true"]',
  postButton: 'div[role="button"]:has-text("Post")',

  // Feed & Posts
  post: 'article',
  postContent: '[data-pressable-container="true"]',

  // Engagement
  likeButton: 'svg[aria-label="Like"]',
  unlikeButton: 'svg[aria-label="Unlike"]',
  repostButton: 'svg[aria-label="Repost"]',
  replyButton: 'svg[aria-label="Reply"]',
  shareButton: 'svg[aria-label="Share"]',

  // Follow
  followButton: 'div[role="button"]:has-text("Follow")',
  followingButton: 'div[role="button"]:has-text("Following")',
  unfollowConfirm: 'button:has-text("Unfollow")',

  // Profile
  profileLink: 'a[href*="/@"]',
  followersCount: 'span:has-text("followers")',
  editProfile: 'div[role="button"]:has-text("Edit profile")',

  // Activity
  activityTab: 'a[href="/activity"]',
  activityItem: '[data-pressable-container="true"]',
};

// ============================================
// Login
// ============================================

export async function loginToThreads(
  username: string,
  password: string,
  options: BrowserOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  try {
    page = await getPage({ ...options, headless: false });
    const context = await getContext(options);

    // Try loading cookies first
    const cookiesLoaded = await loadCookies(context, 'threads');

    await navigateTo(page, 'https://www.threads.net');
    await humanDelay(2000, 3000);

    // Check if already logged in
    const loggedIn = await isLoggedIn(
      page,
      SELECTORS.newThreadButton,
      SELECTORS.loginButton
    );

    if (loggedIn) {
      logger.success('Already logged in to Threads');
      return { success: true, data: { alreadyLoggedIn: true } };
    }

    // Click login / Continue with Instagram
    const continueButton = page.locator(SELECTORS.continueWithInstagram);
    if (await continueButton.isVisible()) {
      await continueButton.click();
      await humanDelay(2000, 3000);
    }

    // Wait for Instagram login form
    await waitForSelector(page, SELECTORS.instagramUsernameInput, 10000);
    await humanDelay(1000, 2000);

    // Enter username
    await fillInput(page, SELECTORS.instagramUsernameInput, username);
    await humanDelay(500, 1000);

    // Enter password
    await fillInput(page, SELECTORS.instagramPasswordInput, password);
    await humanDelay(500, 1000);

    // Click login
    await clickElement(page, SELECTORS.instagramLoginSubmit);
    await humanDelay(3000, 5000);

    // Handle 2FA or verification if needed
    // Wait for successful redirect back to Threads
    const loginSuccess = await waitForSelector(page, SELECTORS.newThreadButton, 30000);

    if (loginSuccess) {
      await saveCookies(context, 'threads');
      logger.success('Logged in to Threads successfully');
      return { success: true };
    }

    // Wait for manual intervention if needed
    logger.warn('Automatic login may require manual intervention (2FA, verification)');
    const manualLogin = await waitForLogin(page, SELECTORS.newThreadButton, 180000);

    if (manualLogin) {
      await saveCookies(context, 'threads');
      return { success: true, data: { manualIntervention: true } };
    }

    return { success: false, error: 'Login failed' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Threads login error:', errorMessage);

    if (page) {
      await takeScreenshot(page, 'threads-login-error');
    }

    return { success: false, error: errorMessage };
  }
}

// ============================================
// Posting
// ============================================

export async function postToThreads(
  content: string,
  options: BrowserOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  try {
    page = await getPage(options);

    await navigateTo(page, 'https://www.threads.net');
    await humanDelay(2000, 3000);

    // Check if logged in
    const loggedIn = await isLoggedIn(
      page,
      SELECTORS.newThreadButton,
      SELECTORS.loginButton
    );

    if (!loggedIn) {
      return { success: false, error: 'Not logged in' };
    }

    // Click create button
    await clickElement(page, SELECTORS.createButton);
    await humanDelay(1500, 2500);

    // Wait for and fill textarea
    await waitForSelector(page, SELECTORS.threadTextarea);
    await humanDelay(500, 1000);

    // Focus and type content
    const textarea = page.locator(SELECTORS.threadTextarea);
    await textarea.click();
    await humanDelay(300, 500);

    // Type content character by character for human-like behavior
    for (const char of content) {
      await page.keyboard.type(char, { delay: 30 + Math.random() * 50 });
    }

    await humanDelay(1000, 2000);

    // Click post button
    await clickElement(page, SELECTORS.postButton);
    await humanDelay(2000, 3000);

    // Record in database
    recordPost('threads', content);
    recordActivity('post', 'threads', { content_length: content.length });

    logger.success('Posted to Threads successfully');
    return { success: true, data: { content } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Threads post error:', errorMessage);

    if (page) {
      await takeScreenshot(page, 'threads-post-error');
    }

    return { success: false, error: errorMessage };
  }
}

// ============================================
// Engagement Actions
// ============================================

export async function likePost(
  page: Page,
  postElement: ReturnType<Page['locator']>
): Promise<ActionResult> {
  try {
    const likeButton = postElement.locator(SELECTORS.likeButton);

    if (await likeButton.isVisible()) {
      await likeButton.click();
      await humanDelay(500, 1500);

      recordActivity('like', 'threads');
      return { success: true };
    }

    // Check if already liked
    const unlikeButton = postElement.locator(SELECTORS.unlikeButton);
    if (await unlikeButton.isVisible()) {
      return { success: false, error: 'Already liked' };
    }

    return { success: false, error: 'Like button not found' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

export async function repostThread(
  page: Page,
  postElement: ReturnType<Page['locator']>
): Promise<ActionResult> {
  try {
    const repostButton = postElement.locator(SELECTORS.repostButton);

    if (await repostButton.isVisible()) {
      await repostButton.click();
      await humanDelay(500, 1000);

      // Click repost option (not quote)
      const repostOption = page.locator('div[role="button"]:has-text("Repost")').first();
      if (await repostOption.isVisible()) {
        await repostOption.click();
        await humanDelay(500, 1500);
      }

      recordActivity('repost', 'threads');
      return { success: true };
    }

    return { success: false, error: 'Repost button not found' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

export async function replyToThread(
  page: Page,
  postElement: ReturnType<Page['locator']>,
  replyContent: string
): Promise<ActionResult> {
  try {
    const replyButton = postElement.locator(SELECTORS.replyButton);

    if (await replyButton.isVisible()) {
      await replyButton.click();
      await humanDelay(1000, 2000);

      // Wait for reply modal/textarea
      await waitForSelector(page, SELECTORS.threadTextarea);
      await humanDelay(500, 1000);

      // Focus and type reply
      const textarea = page.locator(SELECTORS.threadTextarea).last();
      await textarea.click();
      await humanDelay(300, 500);

      for (const char of replyContent) {
        await page.keyboard.type(char, { delay: 30 + Math.random() * 50 });
      }

      await humanDelay(500, 1500);

      // Submit reply
      await clickElement(page, SELECTORS.postButton);
      await humanDelay(1500, 2500);

      recordActivity('reply', 'threads', { content_length: replyContent.length });
      return { success: true, data: { content: replyContent } };
    }

    return { success: false, error: 'Reply button not found' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Follow Actions
// ============================================

export async function followUser(
  username: string,
  options: BrowserOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  try {
    page = await getPage(options);

    // Navigate to user profile
    const profileUrl = username.startsWith('@')
      ? `https://www.threads.net/${username}`
      : `https://www.threads.net/@${username}`;

    await navigateTo(page, profileUrl);
    await humanDelay(2000, 3000);

    // Find and click follow button
    const followButton = page.locator(SELECTORS.followButton).first();

    if (await followButton.isVisible()) {
      await followButton.click();
      await humanDelay(1000, 2000);

      recordActivity('follow', 'threads', { target: username });
      logger.success(`Followed @${username} on Threads`);
      return { success: true, data: { username } };
    }

    // Check if already following
    const followingButton = page.locator(SELECTORS.followingButton).first();
    if (await followingButton.isVisible()) {
      return { success: false, error: 'Already following' };
    }

    return { success: false, error: 'Follow button not found' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Threads follow error for @${username}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function unfollowUser(
  username: string,
  options: BrowserOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  try {
    page = await getPage(options);

    const profileUrl = username.startsWith('@')
      ? `https://www.threads.net/${username}`
      : `https://www.threads.net/@${username}`;

    await navigateTo(page, profileUrl);
    await humanDelay(2000, 3000);

    // Find following button
    const followingButton = page.locator(SELECTORS.followingButton).first();

    if (await followingButton.isVisible()) {
      await followingButton.click();
      await humanDelay(500, 1000);

      // Confirm unfollow
      const confirmButton = page.locator(SELECTORS.unfollowConfirm);
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await humanDelay(1000, 2000);
      }

      recordActivity('unfollow', 'threads', { target: username });
      logger.success(`Unfollowed @${username} on Threads`);
      return { success: true, data: { username } };
    }

    return { success: false, error: 'Not following this user' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Threads unfollow error for @${username}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Activity / Notifications
// ============================================

export interface ThreadsNotification {
  type: 'like' | 'reply' | 'follow' | 'mention' | 'repost' | 'unknown';
  username?: string;
  content?: string;
  timestamp?: string;
}

export async function checkActivity(
  options: BrowserOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  try {
    page = await getPage(options);

    await navigateTo(page, 'https://www.threads.net/activity');
    await humanDelay(2000, 3000);

    // Wait for activity items to load
    await waitForSelector(page, SELECTORS.activityItem, 10000);
    await humanDelay(1000, 2000);

    // Scroll to load more
    await humanScroll(page);
    await humanDelay(1000, 2000);

    // Parse activity items
    const notifications: ThreadsNotification[] = [];
    const items = page.locator(SELECTORS.activityItem);
    const count = await items.count();

    for (let i = 0; i < Math.min(count, 20); i++) {
      const item = items.nth(i);
      const text = await item.textContent();

      if (text) {
        let type: ThreadsNotification['type'] = 'unknown';

        if (text.includes('liked')) type = 'like';
        else if (text.includes('replied')) type = 'reply';
        else if (text.includes('followed')) type = 'follow';
        else if (text.includes('mentioned')) type = 'mention';
        else if (text.includes('reposted')) type = 'repost';

        notifications.push({
          type,
          content: text.substring(0, 200),
        });
      }
    }

    recordActivity('check_notifications', 'threads', { count: notifications.length });

    return {
      success: true,
      data: {
        notifications,
        counts: {
          total: notifications.length,
          likes: notifications.filter((n) => n.type === 'like').length,
          replies: notifications.filter((n) => n.type === 'reply').length,
          follows: notifications.filter((n) => n.type === 'follow').length,
          mentions: notifications.filter((n) => n.type === 'mention').length,
          reposts: notifications.filter((n) => n.type === 'repost').length,
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Check activity error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Profile Stats
// ============================================

export interface ThreadsProfileStats {
  followers: number;
  following: number;
  threads: number;
}

export async function getProfileStats(
  username?: string,
  options: BrowserOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  try {
    page = await getPage(options);

    const profileUrl = username
      ? `https://www.threads.net/@${username.replace('@', '')}`
      : 'https://www.threads.net';

    await navigateTo(page, profileUrl);
    await humanDelay(2000, 3000);

    // If no username, go to own profile
    if (!username) {
      const profileLink = page.locator('a[href^="/@"]').first();
      if (await profileLink.isVisible()) {
        await profileLink.click();
        await humanDelay(2000, 3000);
      }
    }

    // Extract follower count from profile
    const followersElement = page.locator('span:has-text("followers")').first();
    const followersText = await followersElement.textContent();

    const parseCount = (text: string | null): number => {
      if (!text) return 0;
      const match = text.match(/([\d,.]+)\s*(K|M)?/i);
      if (!match) return 0;

      let value = parseFloat(match[1].replace(/,/g, ''));
      if (match[2]?.toUpperCase() === 'K') value *= 1000;
      if (match[2]?.toUpperCase() === 'M') value *= 1000000;

      return Math.round(value);
    };

    const stats: ThreadsProfileStats = {
      followers: parseCount(followersText),
      following: 0, // Threads doesn't prominently show following count
      threads: 0,
    };

    return { success: true, data: stats };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Get profile stats error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Feed Engagement Loop
// ============================================

export interface EngagementOptions extends BrowserOptions {
  maxLikes?: number;
  maxReposts?: number;
  maxReplies?: number;
  replyGenerator?: (postContent: string) => Promise<string>;
}

export async function engageWithFeed(
  options: EngagementOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  const {
    maxLikes = 10,
    maxReposts = 2,
    maxReplies = 3,
    replyGenerator,
    ...browserOptions
  } = options;

  try {
    page = await getPage(browserOptions);

    await navigateTo(page, 'https://www.threads.net');
    await humanDelay(2000, 3000);

    let likes = 0;
    let reposts = 0;
    let replies = 0;

    // Scroll and engage
    for (let scroll = 0; scroll < 5; scroll++) {
      const posts = page.locator(SELECTORS.post);
      const count = await posts.count();

      for (let i = 0; i < count; i++) {
        const post = posts.nth(i);

        // Random engagement decision
        const shouldLike = likes < maxLikes && Math.random() > 0.6;
        const shouldRepost = reposts < maxReposts && Math.random() > 0.9;
        const shouldReply = replies < maxReplies && Math.random() > 0.85 && replyGenerator;

        if (shouldLike) {
          const result = await likePost(page, post);
          if (result.success) {
            likes++;
            await humanDelay(2000, 4000);
          }
        }

        if (shouldRepost) {
          const result = await repostThread(page, post);
          if (result.success) {
            reposts++;
            await humanDelay(3000, 5000);
          }
        }

        if (shouldReply && replyGenerator) {
          const postText = await post.locator(SELECTORS.postContent).textContent();
          if (postText) {
            const replyContent = await replyGenerator(postText);
            const result = await replyToThread(page, post, replyContent);
            if (result.success) {
              replies++;
              await humanDelay(5000, 8000);
            }
          }
        }

        // Check if we've hit all limits
        if (likes >= maxLikes && reposts >= maxReposts && replies >= maxReplies) {
          break;
        }
      }

      // Scroll down
      await humanScroll(page);
      await humanDelay(2000, 4000);
    }

    return {
      success: true,
      data: {
        likes,
        reposts,
        replies,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Feed engagement error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Cleanup
// ============================================

export async function cleanup(): Promise<void> {
  await closeBrowser();
}

// Default export
export default {
  loginToThreads,
  postToThreads,
  likePost,
  repostThread,
  replyToThread,
  followUser,
  unfollowUser,
  checkActivity,
  getProfileStats,
  engageWithFeed,
  cleanup,
};
