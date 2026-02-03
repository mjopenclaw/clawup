/**
 * X (Twitter) Browser Automation
 * Platform-specific actions for X
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
  // Login
  loginButton: '[data-testid="loginButton"]',
  usernameInput: 'input[autocomplete="username"]',
  passwordInput: 'input[name="password"]',
  loginSubmit: '[data-testid="LoginForm_Login_Button"]',

  // Logged in indicators
  homeTimeline: '[data-testid="primaryColumn"]',
  logoutIndicator: '[data-testid="loginButton"]',
  profileAvatar: '[data-testid="SideNav_AccountSwitcher_Button"]',

  // Compose
  tweetButton: '[data-testid="SideNav_NewTweet_Button"]',
  tweetTextarea: '[data-testid="tweetTextArea_0"]',
  tweetSubmit: '[data-testid="tweetButtonInline"]',

  // Timeline & Posts
  tweet: '[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',

  // Engagement
  likeButton: '[data-testid="like"]',
  unlikeButton: '[data-testid="unlike"]',
  retweetButton: '[data-testid="retweet"]',
  replyButton: '[data-testid="reply"]',
  replyTextarea: '[data-testid="tweetTextArea_0"]',
  replySubmit: '[data-testid="tweetButton"]',

  // Follow
  followButton: '[data-testid="placementTracking"] [role="button"]',
  unfollowButton: '[data-testid="placementTracking"] [data-testid*="unfollow"]',
  followConfirm: '[data-testid="confirmationSheetConfirm"]',

  // Notifications
  notificationsTab: '[href="/notifications"]',
  notificationCell: '[data-testid="cellInnerDiv"]',

  // Profile
  profileLink: '[data-testid="AppTabBar_Profile_Link"]',
  followersCount: '[href$="/followers"] span',
  followingCount: '[href$="/following"] span',
};

// ============================================
// Login
// ============================================

export async function loginToX(
  username: string,
  password: string,
  options: BrowserOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  try {
    page = await getPage({ ...options, headless: false });
    const context = await getContext(options);

    // Try loading cookies first
    const cookiesLoaded = await loadCookies(context, 'x');

    await navigateTo(page, 'https://x.com/home');
    await humanDelay(2000, 3000);

    // Check if already logged in
    const loggedIn = await isLoggedIn(
      page,
      SELECTORS.profileAvatar,
      SELECTORS.logoutIndicator
    );

    if (loggedIn) {
      logger.success('Already logged in to X');
      return { success: true, data: { alreadyLoggedIn: true } };
    }

    // Navigate to login
    await navigateTo(page, 'https://x.com/i/flow/login');
    await humanDelay(2000, 3000);

    // Enter username
    await waitForSelector(page, SELECTORS.usernameInput);
    await humanDelay(500, 1000);
    await typeText(page, SELECTORS.usernameInput, username, { delay: 100 });
    await humanDelay(500, 1000);

    // Click next
    await clickElement(page, 'button[type="button"]:has-text("Next")');
    await humanDelay(1500, 2500);

    // Enter password
    await waitForSelector(page, SELECTORS.passwordInput);
    await typeText(page, SELECTORS.passwordInput, password, { delay: 80 });
    await humanDelay(500, 1000);

    // Click login
    await clickElement(page, SELECTORS.loginSubmit);
    await humanDelay(3000, 5000);

    // Verify login success
    const loginSuccess = await waitForSelector(page, SELECTORS.profileAvatar, 15000);

    if (loginSuccess) {
      await saveCookies(context, 'x');
      logger.success('Logged in to X successfully');
      return { success: true };
    }

    // Wait for manual intervention if needed (2FA, CAPTCHA, etc.)
    logger.warn('Automatic login may require manual intervention');
    const manualLogin = await waitForLogin(page, SELECTORS.profileAvatar, 120000);

    if (manualLogin) {
      await saveCookies(context, 'x');
      return { success: true, data: { manualIntervention: true } };
    }

    return { success: false, error: 'Login failed' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('X login error:', errorMessage);

    if (page) {
      await takeScreenshot(page, 'x-login-error');
    }

    return { success: false, error: errorMessage };
  }
}

// ============================================
// Posting
// ============================================

export async function postToX(
  content: string,
  options: BrowserOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  try {
    page = await getPage(options);

    await navigateTo(page, 'https://x.com/home');
    await humanDelay(2000, 3000);

    // Check if logged in
    const loggedIn = await isLoggedIn(
      page,
      SELECTORS.profileAvatar,
      SELECTORS.logoutIndicator
    );

    if (!loggedIn) {
      return { success: false, error: 'Not logged in' };
    }

    // Click compose button
    await clickElement(page, SELECTORS.tweetButton);
    await humanDelay(1000, 2000);

    // Wait for and fill textarea
    await waitForSelector(page, SELECTORS.tweetTextarea);
    await humanDelay(500, 1000);

    // Type content with human-like delays
    await typeText(page, SELECTORS.tweetTextarea, content, { delay: 50 });
    await humanDelay(1000, 2000);

    // Submit
    await clickElement(page, SELECTORS.tweetSubmit);
    await humanDelay(2000, 3000);

    // Record in database
    recordPost('x', content);
    recordActivity('post', 'x', { content_length: content.length });

    logger.success('Posted to X successfully');
    return { success: true, data: { content } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('X post error:', errorMessage);

    if (page) {
      await takeScreenshot(page, 'x-post-error');
    }

    return { success: false, error: errorMessage };
  }
}

// ============================================
// Engagement Actions
// ============================================

export async function likePost(
  page: Page,
  tweetElement: ReturnType<Page['locator']>
): Promise<ActionResult> {
  try {
    const likeButton = tweetElement.locator(SELECTORS.likeButton);

    if (await likeButton.isVisible()) {
      await likeButton.click();
      await humanDelay(500, 1500);

      recordActivity('like', 'x');
      return { success: true };
    }

    return { success: false, error: 'Like button not found or already liked' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

export async function repostTweet(
  page: Page,
  tweetElement: ReturnType<Page['locator']>
): Promise<ActionResult> {
  try {
    const retweetButton = tweetElement.locator(SELECTORS.retweetButton);

    if (await retweetButton.isVisible()) {
      await retweetButton.click();
      await humanDelay(500, 1000);

      // Click repost option (not quote)
      await page.click('[data-testid="retweetConfirm"]');
      await humanDelay(500, 1500);

      recordActivity('repost', 'x');
      return { success: true };
    }

    return { success: false, error: 'Retweet button not found' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

export async function replyToTweet(
  page: Page,
  tweetElement: ReturnType<Page['locator']>,
  replyContent: string
): Promise<ActionResult> {
  try {
    const replyButton = tweetElement.locator(SELECTORS.replyButton);

    if (await replyButton.isVisible()) {
      await replyButton.click();
      await humanDelay(1000, 2000);

      // Wait for reply modal
      await waitForSelector(page, SELECTORS.replyTextarea);
      await humanDelay(500, 1000);

      // Type reply
      await typeText(page, SELECTORS.replyTextarea, replyContent, { delay: 50 });
      await humanDelay(500, 1500);

      // Submit
      await clickElement(page, SELECTORS.replySubmit);
      await humanDelay(1500, 2500);

      recordActivity('reply', 'x', { content_length: replyContent.length });
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

    await navigateTo(page, `https://x.com/${username}`);
    await humanDelay(2000, 3000);

    // Find and click follow button
    const followButton = page.locator('[data-testid$="-follow"]').first();

    if (await followButton.isVisible()) {
      await followButton.click();
      await humanDelay(1000, 2000);

      recordActivity('follow', 'x', { target: username });
      logger.success(`Followed @${username}`);
      return { success: true, data: { username } };
    }

    // Check if already following
    const unfollowButton = page.locator('[data-testid$="-unfollow"]').first();
    if (await unfollowButton.isVisible()) {
      return { success: false, error: 'Already following' };
    }

    return { success: false, error: 'Follow button not found' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Follow error for @${username}:`, errorMessage);
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

    await navigateTo(page, `https://x.com/${username}`);
    await humanDelay(2000, 3000);

    // Find unfollow button
    const unfollowButton = page.locator('[data-testid$="-unfollow"]').first();

    if (await unfollowButton.isVisible()) {
      await unfollowButton.click();
      await humanDelay(500, 1000);

      // Confirm unfollow
      const confirmButton = page.locator(SELECTORS.followConfirm);
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await humanDelay(1000, 2000);
      }

      recordActivity('unfollow', 'x', { target: username });
      logger.success(`Unfollowed @${username}`);
      return { success: true, data: { username } };
    }

    return { success: false, error: 'Not following this user' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Unfollow error for @${username}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Notifications
// ============================================

export interface XNotification {
  type: 'mention' | 'like' | 'retweet' | 'follow' | 'reply' | 'unknown';
  username?: string;
  content?: string;
  timestamp?: string;
}

export async function checkNotifications(
  options: BrowserOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  try {
    page = await getPage(options);

    await navigateTo(page, 'https://x.com/notifications');
    await humanDelay(2000, 3000);

    // Wait for notifications to load
    await waitForSelector(page, SELECTORS.notificationCell, 10000);
    await humanDelay(1000, 2000);

    // Scroll to load more
    await humanScroll(page);
    await humanDelay(1000, 2000);

    // Parse notifications
    const notifications: XNotification[] = [];
    const cells = page.locator(SELECTORS.notificationCell);
    const count = await cells.count();

    for (let i = 0; i < Math.min(count, 20); i++) {
      const cell = cells.nth(i);
      const text = await cell.textContent();

      if (text) {
        let type: XNotification['type'] = 'unknown';

        if (text.includes('liked')) type = 'like';
        else if (text.includes('retweeted') || text.includes('reposted')) type = 'retweet';
        else if (text.includes('followed')) type = 'follow';
        else if (text.includes('replied')) type = 'reply';
        else if (text.includes('@')) type = 'mention';

        notifications.push({
          type,
          content: text.substring(0, 200),
        });
      }
    }

    recordActivity('check_notifications', 'x', { count: notifications.length });

    return {
      success: true,
      data: {
        notifications,
        counts: {
          total: notifications.length,
          mentions: notifications.filter((n) => n.type === 'mention').length,
          likes: notifications.filter((n) => n.type === 'like').length,
          follows: notifications.filter((n) => n.type === 'follow').length,
          replies: notifications.filter((n) => n.type === 'reply').length,
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Check notifications error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================
// Profile Stats
// ============================================

export interface XProfileStats {
  followers: number;
  following: number;
  tweets: number;
}

export async function getProfileStats(
  username?: string,
  options: BrowserOptions = {}
): Promise<ActionResult> {
  let page: Page | null = null;

  try {
    page = await getPage(options);

    const profileUrl = username
      ? `https://x.com/${username}`
      : 'https://x.com/home';

    await navigateTo(page, profileUrl);
    await humanDelay(2000, 3000);

    // If no username, go to own profile
    if (!username) {
      await clickElement(page, SELECTORS.profileLink);
      await humanDelay(2000, 3000);
    }

    // Extract stats
    const followersText = await page.locator('[href$="/verified_followers"] span, [href$="/followers"] span').first().textContent();
    const followingText = await page.locator('[href$="/following"] span').first().textContent();

    const parseCount = (text: string | null): number => {
      if (!text) return 0;
      const cleaned = text.replace(/,/g, '').trim();
      if (cleaned.endsWith('K')) return parseFloat(cleaned) * 1000;
      if (cleaned.endsWith('M')) return parseFloat(cleaned) * 1000000;
      return parseInt(cleaned) || 0;
    };

    const stats: XProfileStats = {
      followers: parseCount(followersText),
      following: parseCount(followingText),
      tweets: 0, // Would need to parse from profile
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
  replyGenerator?: (tweetContent: string) => Promise<string>;
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

    await navigateTo(page, 'https://x.com/home');
    await humanDelay(2000, 3000);

    let likes = 0;
    let reposts = 0;
    let replies = 0;

    // Scroll and engage
    for (let scroll = 0; scroll < 5; scroll++) {
      const tweets = page.locator(SELECTORS.tweet);
      const count = await tweets.count();

      for (let i = 0; i < count; i++) {
        const tweet = tweets.nth(i);

        // Random engagement decision
        const shouldLike = likes < maxLikes && Math.random() > 0.6;
        const shouldRepost = reposts < maxReposts && Math.random() > 0.9;
        const shouldReply = replies < maxReplies && Math.random() > 0.85 && replyGenerator;

        if (shouldLike) {
          const result = await likePost(page, tweet);
          if (result.success) {
            likes++;
            await humanDelay(2000, 4000);
          }
        }

        if (shouldRepost) {
          const result = await repostTweet(page, tweet);
          if (result.success) {
            reposts++;
            await humanDelay(3000, 5000);
          }
        }

        if (shouldReply && replyGenerator) {
          const tweetText = await tweet.locator(SELECTORS.tweetText).textContent();
          if (tweetText) {
            const replyContent = await replyGenerator(tweetText);
            const result = await replyToTweet(page, tweet, replyContent);
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
  loginToX,
  postToX,
  likePost,
  repostTweet,
  replyToTweet,
  followUser,
  unfollowUser,
  checkNotifications,
  getProfileStats,
  engageWithFeed,
  cleanup,
};
