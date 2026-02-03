/**
 * Database Service
 * SQLite database operations using better-sqlite3
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import paths from '../utils/paths.js';
import logger from '../utils/logger.js';
import type { ActivityLog, Post, PostAnalytics, DailyStats } from '../types/index.js';

// ============================================
// Database Instance
// ============================================

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure data directory exists
  const dataDir = dirname(paths.database);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(paths.database);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  logger.debug(`Database connected: ${paths.database}`);
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.debug('Database closed');
  }
}

export function initDatabase(): void {
  getDatabase();
  initializeSchema();
  logger.info('Database initialized');
}

// ============================================
// Schema Initialization
// ============================================

export function initializeSchema(): void {
  const database = getDatabase();

  // Load and execute schema files
  const schemaFiles = [
    join(paths.data, 'schema.sql'),
    join(paths.data, 'sns-schema.sql'),
    join(paths.core, 'schema', 'evolution.sql'),
  ];

  for (const schemaFile of schemaFiles) {
    if (existsSync(schemaFile)) {
      try {
        const schema = readFileSync(schemaFile, 'utf-8');
        database.exec(schema);
        logger.debug(`Applied schema: ${schemaFile}`);
      } catch (error) {
        logger.warn(`Failed to apply schema ${schemaFile}:`, error);
      }
    }
  }

  // Create essential tables if schema files don't exist
  createEssentialTables(database);
}

function createEssentialTables(database: Database.Database): void {
  const essentialSchema = `
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      content TEXT,
      post_id TEXT,
      posted_at DATETIME,
      status TEXT DEFAULT 'posted',
      hashtag_count INTEGER DEFAULT 0,
      media_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      platform TEXT NOT NULL,
      target_id TEXT,
      target_author TEXT,
      content TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS content_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_content TEXT NOT NULL,
      target_channel TEXT,
      status TEXT DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      scheduled_at DATETIME,
      posted_at DATETIME,
      post_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      x_followers INTEGER DEFAULT 0,
      x_following INTEGER DEFAULT 0,
      threads_followers INTEGER DEFAULT 0,
      threads_following INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_type TEXT NOT NULL,
      rule_key TEXT NOT NULL,
      rule_value TEXT NOT NULL,
      confidence REAL DEFAULT 0.5,
      reason TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(rule_type, rule_key)
    );
  `;

  try {
    database.exec(essentialSchema);
  } catch (error) {
    // Tables might already exist, that's fine
  }
}

// ============================================
// Activity Log Operations
// ============================================

export function logActivity(activity: ActivityLog): number {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO activity_log (action_type, platform, target_id, target_author, content, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    activity.action_type,
    activity.platform,
    activity.target_id || null,
    activity.target_author || null,
    activity.content || null,
    activity.metadata || null
  );

  return result.lastInsertRowid as number;
}

export function getActivityCount(
  actionType: string,
  platform: string,
  date?: string
): number {
  const database = getDatabase();
  const dateFilter = date || "date('now')";

  if (platform === 'all') {
    const stmt = database.prepare(`
      SELECT COUNT(*) as count FROM activity_log
      WHERE action_type = ? AND date(created_at) = ${dateFilter}
    `);
    const result = stmt.get(actionType) as { count: number };
    return result.count;
  }

  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM activity_log
    WHERE action_type = ? AND platform = ? AND date(created_at) = ${dateFilter}
  `);

  const result = stmt.get(actionType, platform) as { count: number };
  return result.count;
}

export function getTodayActivityCounts(platform: string): Record<string, number> {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT action_type, COUNT(*) as count
    FROM activity_log
    WHERE platform = ? AND date(created_at) = date('now')
    GROUP BY action_type
  `);

  const rows = stmt.all(platform) as Array<{ action_type: string; count: number }>;
  const counts: Record<string, number> = {};

  for (const row of rows) {
    counts[row.action_type] = row.count;
  }

  return counts;
}

// ============================================
// Post Operations
// ============================================

export function savePost(post: Post): number {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO posts (platform, content, post_id, posted_at, status, hashtag_count, media_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    post.platform,
    post.content,
    post.post_id || null,
    post.posted_at || new Date().toISOString(),
    post.status,
    post.hashtag_count || 0,
    post.media_count || 0
  );

  return result.lastInsertRowid as number;
}

export function getRecentPosts(platformOrLimit?: string | number, limit = 100): Post[] {
  const database = getDatabase();

  // Handle overloaded signature
  if (typeof platformOrLimit === 'number') {
    // Called as getRecentPosts(limit)
    const stmt = database.prepare(`
      SELECT * FROM posts
      ORDER BY posted_at DESC
      LIMIT ?
    `);
    return stmt.all(platformOrLimit) as Post[];
  }

  if (!platformOrLimit) {
    // Called as getRecentPosts() - get all
    const stmt = database.prepare(`
      SELECT * FROM posts
      ORDER BY posted_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as Post[];
  }

  // Called as getRecentPosts(platform, limit)
  const stmt = database.prepare(`
    SELECT * FROM posts
    WHERE platform = ?
    ORDER BY posted_at DESC
    LIMIT ?
  `);

  return stmt.all(platformOrLimit, limit) as Post[];
}

export function getPostsForSimilarityCheck(platform: string): string[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT content FROM posts
    WHERE platform = ? AND status = 'posted'
    ORDER BY posted_at DESC
    LIMIT 100
  `);

  const rows = stmt.all(platform) as Array<{ content: string }>;
  return rows.map((r) => r.content);
}

export function getTodayPostCount(platform: string): number {
  const database = getDatabase();

  if (platform === 'all') {
    const stmt = database.prepare(`
      SELECT COUNT(*) as count FROM posts
      WHERE date(posted_at) = date('now')
    `);
    const result = stmt.get() as { count: number };
    return result.count;
  }

  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM posts
    WHERE platform = ? AND date(posted_at) = date('now')
  `);

  const result = stmt.get(platform) as { count: number };
  return result.count;
}

export function getLastPostTime(platform: string): Date | null {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT posted_at FROM posts
    WHERE platform = ?
    ORDER BY posted_at DESC
    LIMIT 1
  `);

  const result = stmt.get(platform) as { posted_at: string } | undefined;
  return result ? new Date(result.posted_at) : null;
}

// Convenience functions for recording activities from browser modules
export function recordActivity(
  actionType: string,
  platform: string,
  metadata?: Record<string, unknown>
): number {
  return logActivity({
    action_type: actionType,
    platform,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });
}

export function recordPost(platform: string, content: string, postId?: string): number {
  return savePost({
    platform,
    content,
    post_id: postId,
    status: 'posted',
    posted_at: new Date().toISOString(),
  });
}

// ============================================
// Post Analytics Operations
// ============================================

export function savePostAnalytics(analytics: PostAnalytics): number {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO post_analytics
    (post_id, platform, likes, reposts, views, comments, engagement_rate, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const result = stmt.run(
    analytics.post_id,
    analytics.platform,
    analytics.likes,
    analytics.reposts,
    analytics.views,
    analytics.comments,
    analytics.engagement_rate
  );

  return result.lastInsertRowid as number;
}

export function getAverageEngagement(platform: string, days = 7): number {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT AVG(engagement_rate) as avg_engagement
    FROM post_analytics
    WHERE platform = ? AND checked_at > datetime('now', '-' || ? || ' days')
  `);

  const result = stmt.get(platform, days) as { avg_engagement: number | null };
  return result.avg_engagement || 0;
}

// ============================================
// Daily Stats Operations
// ============================================

export function saveDailyStats(stats: DailyStats): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO daily_stats
    (date, x_followers, x_following, threads_followers, threads_following)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    stats.date,
    stats.x_followers || 0,
    stats.x_following || 0,
    stats.threads_followers || 0,
    stats.threads_following || 0
  );
}

export function getDailyStats(days = 7): DailyStats[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM daily_stats
    WHERE date > date('now', '-' || ? || ' days')
    ORDER BY date DESC
  `);

  return stmt.all(days) as DailyStats[];
}

export function getLatestStats(): DailyStats | null {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM daily_stats
    ORDER BY date DESC
    LIMIT 1
  `);

  return (stmt.get() as DailyStats) || null;
}

// ============================================
// Content Queue Operations
// ============================================

export interface ContentQueueItem {
  id?: number;
  raw_content: string;
  target_channel: string;
  status: 'pending' | 'posted' | 'failed' | 'rejected';
  priority: number;
  scheduled_at?: string;
  posted_at?: string;
  post_id?: string;
  created_at?: string;
}

export function addToContentQueue(item: ContentQueueItem): number {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO content_queue
    (raw_content, target_channel, status, priority, scheduled_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    item.raw_content,
    item.target_channel,
    item.status || 'pending',
    item.priority || 0,
    item.scheduled_at || null
  );

  return result.lastInsertRowid as number;
}

export function getNextQueueItem(channel?: string): ContentQueueItem | null {
  const database = getDatabase();
  let query = `
    SELECT * FROM content_queue
    WHERE status = 'pending'
    AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
  `;

  if (channel) {
    query += ` AND target_channel = ?`;
  }

  query += ` ORDER BY priority DESC, created_at ASC LIMIT 1`;

  const stmt = database.prepare(query);
  const result = channel ? stmt.get(channel) : stmt.get();

  return (result as ContentQueueItem) || null;
}

export function updateQueueItemStatus(
  id: number,
  status: string,
  postId?: string
): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    UPDATE content_queue
    SET status = ?, posted_at = datetime('now'), post_id = ?
    WHERE id = ?
  `);

  stmt.run(status, postId || null, id);
}

export function getQueueCount(status = 'pending'): number {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM content_queue WHERE status = ?
  `);

  const result = stmt.get(status) as { count: number };
  return result.count;
}

// ============================================
// Rules & Experiments Operations
// ============================================

export function saveRule(
  ruleType: string,
  ruleKey: string,
  ruleValue: string,
  confidence: number,
  reason: string
): number {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO rules
    (rule_type, rule_key, rule_value, confidence, reason, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);

  const result = stmt.run(ruleType, ruleKey, ruleValue, confidence, reason);
  return result.lastInsertRowid as number;
}

export function logRuleChange(
  ruleId: number,
  ruleType: string,
  ruleKey: string,
  oldValue: string | null,
  newValue: string,
  reason: string,
  changedBy: string
): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO rule_history
    (rule_id, rule_type, rule_key, old_value, new_value, change_reason, changed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(ruleId, ruleType, ruleKey, oldValue, newValue, reason, changedBy);
}

export function getActiveRules(): Array<{
  rule_type: string;
  rule_key: string;
  rule_value: string;
  confidence: number;
}> {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT rule_type, rule_key, rule_value, confidence
    FROM rules
    WHERE status = 'active' AND confidence >= 0.5
    ORDER BY rule_type, confidence DESC
  `);

  return stmt.all() as Array<{
    rule_type: string;
    rule_key: string;
    rule_value: string;
    confidence: number;
  }>;
}

// ============================================
// Notifications Operations
// ============================================

export interface Notification {
  id?: number;
  type: string;
  platform: string;
  actor_handle?: string;
  actor_followers?: number;
  content?: string;
  in_reply_to?: string;
  replied: boolean;
  created_at?: string;
}

export function saveNotification(notification: Notification): number {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO notifications
    (type, platform, actor_handle, actor_followers, content, in_reply_to, replied)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    notification.type,
    notification.platform,
    notification.actor_handle || null,
    notification.actor_followers || null,
    notification.content || null,
    notification.in_reply_to || null,
    notification.replied ? 1 : 0
  );

  return result.lastInsertRowid as number;
}

export function getUnrepliedMentions(platform: string): Notification[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM notifications
    WHERE type IN ('mention', 'reply')
    AND platform = ?
    AND replied = 0
    AND created_at > datetime('now', '-24 hours')
    ORDER BY created_at DESC
  `);

  return stmt.all(platform) as Notification[];
}

export function markAsReplied(notificationId: number): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    UPDATE notifications SET replied = 1, replied_at = datetime('now') WHERE id = ?
  `);
  stmt.run(notificationId);
}

// ============================================
// Following Operations
// ============================================

export interface FollowingRecord {
  id?: number;
  platform: string;
  target_handle: string;
  followed_at?: string;
  is_follow_back?: boolean;
}

export function saveFollowing(record: FollowingRecord): number {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO following
    (platform, target_handle, followed_at, is_follow_back)
    VALUES (?, ?, datetime('now'), ?)
  `);

  const result = stmt.run(
    record.platform,
    record.target_handle,
    record.is_follow_back ? 1 : 0
  );

  return result.lastInsertRowid as number;
}

export function isFollowing(platform: string, handle: string): boolean {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT COUNT(*) as count FROM following
    WHERE platform = ? AND target_handle = ?
  `);

  const result = stmt.get(platform, handle) as { count: number };
  return result.count > 0;
}

// ============================================
// Generic Query Execution
// ============================================

export function executeQuery<T>(sql: string, params: unknown[] = []): T[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.all(...params) as T[];
}

export function executeRun(
  sql: string,
  params: unknown[] = []
): Database.RunResult {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.run(...params);
}

export function executeGet<T>(sql: string, params: unknown[] = []): T | undefined {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

// ============================================
// Transaction Support
// ============================================

export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  return database.transaction(fn)();
}

// Default export
export default {
  getDatabase,
  closeDatabase,
  initDatabase,
  initializeSchema,
  logActivity,
  getActivityCount,
  getTodayActivityCounts,
  savePost,
  getRecentPosts,
  getPostsForSimilarityCheck,
  getTodayPostCount,
  getLastPostTime,
  recordActivity,
  recordPost,
  savePostAnalytics,
  getAverageEngagement,
  saveDailyStats,
  getDailyStats,
  getLatestStats,
  addToContentQueue,
  getNextQueueItem,
  updateQueueItemStatus,
  getQueueCount,
  saveRule,
  logRuleChange,
  getActiveRules,
  saveNotification,
  getUnrepliedMentions,
  markAsReplied,
  saveFollowing,
  isFollowing,
  executeQuery,
  executeRun,
  executeGet,
  transaction,
};
