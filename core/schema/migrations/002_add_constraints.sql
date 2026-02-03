-- ============================================
-- Migration 002: 데이터 정합성 제약 추가
-- 실행일: 자동 생성
-- ============================================

-- 참고: SQLite는 ALTER TABLE로 CHECK 제약 추가 불가
-- 새 테이블 생성 + 데이터 이전 방식으로 처리

-- ============================================
-- 1. posts 테이블 재생성 (URL 유니크 제약)
-- ============================================

-- 기존 데이터 백업
CREATE TABLE IF NOT EXISTS posts_backup AS SELECT * FROM posts;

-- 새 테이블 (제약 포함)
CREATE TABLE IF NOT EXISTS posts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL CHECK(platform IN ('x', 'threads', 'blog', 'telegram')),
    content TEXT,
    url TEXT UNIQUE,
    likes INTEGER DEFAULT 0 CHECK(likes >= 0),
    replies INTEGER DEFAULT 0 CHECK(replies >= 0),
    retweets INTEGER DEFAULT 0 CHECK(retweets >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 데이터 이전 (중복 URL 제외)
INSERT OR IGNORE INTO posts_new 
SELECT * FROM posts;

-- 테이블 교체
DROP TABLE IF EXISTS posts;
ALTER TABLE posts_new RENAME TO posts;


-- ============================================
-- 2. event_queue 상태값 제약
-- ============================================

CREATE TABLE IF NOT EXISTS event_queue_backup AS SELECT * FROM event_queue;

CREATE TABLE IF NOT EXISTS event_queue_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_type TEXT NOT NULL CHECK(queue_type IN ('follow', 'reply', 'posting')),
    platform TEXT NOT NULL CHECK(platform IN ('x', 'threads')),
    event_type TEXT NOT NULL,
    target_user TEXT,
    target_post TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'done', 'skipped', 'failed', 'expired')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    priority INTEGER DEFAULT 5 CHECK(priority BETWEEN 1 AND 10),
    UNIQUE(platform, event_type, target_user, target_post)
);

INSERT OR IGNORE INTO event_queue_new 
SELECT * FROM event_queue;

DROP TABLE IF EXISTS event_queue;
ALTER TABLE event_queue_new RENAME TO event_queue;

-- 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_queue_platform ON event_queue(platform, status);
CREATE INDEX IF NOT EXISTS idx_queue_status ON event_queue(queue_type, status);


-- ============================================
-- 3. post_analytics 수치 제약
-- ============================================

CREATE TABLE IF NOT EXISTS post_analytics_backup AS SELECT * FROM post_analytics;

CREATE TABLE IF NOT EXISTS post_analytics_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT,
    platform TEXT NOT NULL CHECK(platform IN ('x', 'threads', 'blog')),
    content_type TEXT CHECK(content_type IN ('text', 'thread', 'image', 'link', 'video')),
    topic TEXT,
    content_length INTEGER CHECK(content_length >= 0),
    hashtag_count INTEGER DEFAULT 0 CHECK(hashtag_count >= 0),
    emoji_count INTEGER DEFAULT 0 CHECK(emoji_count >= 0),
    posted_at DATETIME,
    hour_posted INTEGER CHECK(hour_posted BETWEEN 0 AND 23),
    day_of_week INTEGER CHECK(day_of_week BETWEEN 0 AND 6),
    
    likes INTEGER DEFAULT 0 CHECK(likes >= 0),
    replies INTEGER DEFAULT 0 CHECK(replies >= 0),
    retweets INTEGER DEFAULT 0 CHECK(retweets >= 0),
    views INTEGER DEFAULT 0 CHECK(views >= 0),
    engagement_rate REAL DEFAULT 0 CHECK(engagement_rate >= 0),
    
    score REAL DEFAULT 0,
    learnings TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO post_analytics_new 
SELECT * FROM post_analytics;

DROP TABLE IF EXISTS post_analytics;
ALTER TABLE post_analytics_new RENAME TO post_analytics;

-- 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_post_analytics_platform ON post_analytics(platform, posted_at);
