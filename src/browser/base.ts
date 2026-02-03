/**
 * Browser Automation Base
 * Common utilities for Playwright-based browser automation
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import paths from '../utils/paths.js';
import logger from '../utils/logger.js';

// ============================================
// Types
// ============================================

export interface BrowserOptions {
  headless?: boolean;
  slowMo?: number;
  profileName?: string;
  timeout?: number;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  screenshot?: string;
}

// ============================================
// Browser Management
// ============================================

let browserInstance: Browser | null = null;
let contextInstance: BrowserContext | null = null;

export async function getBrowser(options: BrowserOptions = {}): Promise<Browser> {
  if (browserInstance) {
    return browserInstance;
  }

  const { headless = true, slowMo = 50 } = options;

  browserInstance = await chromium.launch({
    headless,
    slowMo,
  });

  logger.debug('Browser launched');
  return browserInstance;
}

export async function getContext(options: BrowserOptions = {}): Promise<BrowserContext> {
  if (contextInstance) {
    return contextInstance;
  }

  const browser = await getBrowser(options);
  const { profileName = 'default' } = options;

  // User data directory for persistent sessions
  const userDataDir = join(paths.data, 'browser-profiles', profileName);
  if (!existsSync(userDataDir)) {
    mkdirSync(userDataDir, { recursive: true });
  }

  contextInstance = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });

  logger.debug(`Browser context created with profile: ${profileName}`);
  return contextInstance;
}

export async function getPage(options: BrowserOptions = {}): Promise<Page> {
  const context = await getContext(options);
  const page = await context.newPage();

  // Set default timeout
  page.setDefaultTimeout(options.timeout ?? 30000);

  return page;
}

export async function closeBrowser(): Promise<void> {
  if (contextInstance) {
    await contextInstance.close();
    contextInstance = null;
  }

  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }

  logger.debug('Browser closed');
}

// ============================================
// Common Actions
// ============================================

export async function navigateTo(
  page: Page,
  url: string,
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle' = 'domcontentloaded'
): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil });
    return true;
  } catch (error) {
    logger.error(`Failed to navigate to ${url}:`, error);
    return false;
  }
}

export async function waitForSelector(
  page: Page,
  selector: string,
  timeout = 10000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

export async function clickElement(
  page: Page,
  selector: string,
  options: { timeout?: number; force?: boolean } = {}
): Promise<boolean> {
  try {
    await page.click(selector, {
      timeout: options.timeout ?? 10000,
      force: options.force ?? false,
    });
    return true;
  } catch (error) {
    logger.error(`Failed to click ${selector}:`, error);
    return false;
  }
}

export async function typeText(
  page: Page,
  selector: string,
  text: string,
  options: { delay?: number; clear?: boolean } = {}
): Promise<boolean> {
  try {
    if (options.clear) {
      await page.fill(selector, '');
    }
    await page.type(selector, text, { delay: options.delay ?? 50 });
    return true;
  } catch (error) {
    logger.error(`Failed to type in ${selector}:`, error);
    return false;
  }
}

export async function fillInput(
  page: Page,
  selector: string,
  value: string
): Promise<boolean> {
  try {
    await page.fill(selector, value);
    return true;
  } catch (error) {
    logger.error(`Failed to fill ${selector}:`, error);
    return false;
  }
}

export async function takeScreenshot(
  page: Page,
  name: string
): Promise<string | null> {
  try {
    const screenshotDir = join(paths.data, 'screenshots');
    if (!existsSync(screenshotDir)) {
      mkdirSync(screenshotDir, { recursive: true });
    }

    const filename = `${name}-${Date.now()}.png`;
    const filepath = join(screenshotDir, filename);

    await page.screenshot({ path: filepath, fullPage: false });
    return filepath;
  } catch (error) {
    logger.error('Failed to take screenshot:', error);
    return null;
  }
}

// ============================================
// Human-like Behavior
// ============================================

export async function humanDelay(min = 500, max = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export async function humanScroll(page: Page): Promise<void> {
  const scrollAmount = Math.floor(Math.random() * 300) + 100;
  await page.mouse.wheel(0, scrollAmount);
  await humanDelay(200, 500);
}

export async function moveMouseRandomly(page: Page): Promise<void> {
  const x = Math.floor(Math.random() * 800) + 100;
  const y = Math.floor(Math.random() * 400) + 100;
  await page.mouse.move(x, y);
}

// ============================================
// Login Helpers
// ============================================

export async function isLoggedIn(
  page: Page,
  loggedInSelector: string,
  loggedOutSelector: string
): Promise<boolean> {
  try {
    // Wait briefly for page to settle
    await page.waitForTimeout(2000);

    // Check for logged in indicator
    const loggedIn = await page.$(loggedInSelector);
    if (loggedIn) {
      return true;
    }

    // Check for logged out indicator
    const loggedOut = await page.$(loggedOutSelector);
    if (loggedOut) {
      return false;
    }

    // Uncertain state
    return false;
  } catch {
    return false;
  }
}

export async function waitForLogin(
  page: Page,
  loggedInSelector: string,
  timeout = 300000 // 5 minutes
): Promise<boolean> {
  logger.info('Waiting for manual login...');

  try {
    await page.waitForSelector(loggedInSelector, { timeout });
    logger.success('Login detected');
    return true;
  } catch {
    logger.error('Login timeout');
    return false;
  }
}

// ============================================
// Cookie Management
// ============================================

export async function saveCookies(context: BrowserContext, name: string): Promise<void> {
  const cookiesDir = join(paths.data, 'cookies');
  if (!existsSync(cookiesDir)) {
    mkdirSync(cookiesDir, { recursive: true });
  }

  const cookies = await context.cookies();
  const fs = await import('fs/promises');
  await fs.writeFile(
    join(cookiesDir, `${name}.json`),
    JSON.stringify(cookies, null, 2)
  );

  logger.debug(`Cookies saved: ${name}`);
}

export async function loadCookies(
  context: BrowserContext,
  name: string
): Promise<boolean> {
  const cookiePath = join(paths.data, 'cookies', `${name}.json`);

  if (!existsSync(cookiePath)) {
    return false;
  }

  try {
    const fs = await import('fs/promises');
    const data = await fs.readFile(cookiePath, 'utf-8');
    const cookies = JSON.parse(data);
    await context.addCookies(cookies);
    logger.debug(`Cookies loaded: ${name}`);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Error Handling
// ============================================

export function wrapAction<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<ActionResult> {
  return async (...args: T): Promise<ActionResult> => {
    try {
      const data = await fn(...args);
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  };
}

// Default export
export default {
  getBrowser,
  getContext,
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
  moveMouseRandomly,
  isLoggedIn,
  waitForLogin,
  saveCookies,
  loadCookies,
  wrapAction,
};
