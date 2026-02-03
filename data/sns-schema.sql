-- SNS DB Schema
-- SNS/마케팅 전용 데이터 + 이벤트 큐 시스템

-- ============================================
-- 🎯 EVENT QUEUE (핵심!)
-- ============================================
CREATE TABLE IF NOT EXISTS event_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue_type TEXT NOT NULL,       -- 'follow', 'reply', 'posting'
  platform TEXT NOT NULL,         -- 'x', 'threads'
  
  -- 이벤트 정보
  event_type TEXT,                -- 'like', 'comment', 'mention', 'research'
  event_data TEXT,                -- JSON
  
  -- 대상 정보
  target_user TEXT,               -- 맞팔 대상
  target_post TEXT,               -- 답글 달 포스트
  content TEXT,                   -- 포스팅할 내용
  
  -- 상태
  status TEXT DEFAULT 'pending',  -- pending, processing, done, failed
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- 규칙
  reply_depth INTEGER DEFAULT 0,  -- 대댓글 깊이 (최대 2)
  priority INTEGER DEFAULT 0,     -- 높을수록 먼저 처리
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON event_queue(queue_type, status);
CREATE INDEX IF NOT EXISTS idx_queue_platform ON event_queue(platform, status);

-- ============================================
-- 📊 기존 테이블들
-- ============================================

-- 일일 통계
CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  x_followers INTEGER DEFAULT 0,
  x_following INTEGER DEFAULT 0,
  threads_followers INTEGER DEFAULT 0,
  threads_following INTEGER DEFAULT 0,
  x_posts INTEGER DEFAULT 0,
  threads_posts INTEGER DEFAULT 0,
  blog_posts INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  notes TEXT
);

-- 포스트 기록
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  content TEXT,
  post_id TEXT,
  url TEXT,
  status TEXT DEFAULT 'posted',
  posted_at DATETIME,
  hashtag_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_platform_posted ON posts(platform, posted_at DESC);

-- 활동 로그
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

CREATE INDEX IF NOT EXISTS idx_activity_type_platform ON activity_log(action_type, platform, created_at);

-- 알림
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  platform TEXT NOT NULL,
  actor_handle TEXT,
  actor_followers INTEGER,
  content TEXT,
  in_reply_to TEXT,
  replied INTEGER DEFAULT 0,
  replied_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_unreplied ON notifications(platform, replied, created_at DESC);

-- 팔로잉 기록
CREATE TABLE IF NOT EXISTS following (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  target_handle TEXT NOT NULL,
  followed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_follow_back INTEGER DEFAULT 0,
  UNIQUE(platform, target_handle)
);

-- 팔로우 기록
CREATE TABLE IF NOT EXISTS follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  followed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unfollowed_at DATETIME,
  follow_back INTEGER DEFAULT 0
);

-- 콘텐츠 큐
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

CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status, scheduled_at);

-- 규칙 저장
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

-- 규칙 변경 히스토리
CREATE TABLE IF NOT EXISTS rule_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER,
  rule_type TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  changed_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rule_id) REFERENCES rules(id)
);

-- ============================================
-- 📊 자가 발전 분석 테이블
-- ============================================

-- 포스트 성과 분석
CREATE TABLE IF NOT EXISTS post_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT,
  platform TEXT NOT NULL,           -- x, threads
  content_type TEXT,                -- text, thread, image, link
  topic TEXT,                       -- openclaw, ai, automation 등
  content_length INTEGER,
  hashtag_count INTEGER,
  emoji_count INTEGER,
  posted_at DATETIME,
  hour_posted INTEGER,              -- 0-23
  day_of_week INTEGER,              -- 0-6
  
  -- 성과 지표
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,   -- (likes+replies+retweets)/views
  
  -- 분석
  score REAL DEFAULT 0,             -- 종합 점수
  learnings TEXT,                   -- 이 포스트에서 배운 것
  comments INTEGER DEFAULT 0,
  checked_at DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 댓글/답글 성과 분석
CREATE TABLE IF NOT EXISTS reply_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  target_account TEXT,              -- 답글 단 계정
  target_followers INTEGER,         -- 대상 계정 팔로워 수
  reply_type TEXT,                  -- question, tip, agreement, experience
  content_length INTEGER,
  
  -- 성과
  likes_received INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  followed_back INTEGER DEFAULT 0,  -- 맞팔 여부
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 성장 패턴 분석
CREATE TABLE IF NOT EXISTS growth_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  platform TEXT NOT NULL,
  
  -- 일일 지표
  followers_gained INTEGER DEFAULT 0,
  followers_lost INTEGER DEFAULT 0,
  net_followers INTEGER DEFAULT 0,
  
  posts_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  
  -- 최고 성과
  best_post_id TEXT,
  best_post_engagement INTEGER,
  
  -- 인사이트
  insights TEXT,                    -- JSON
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 자가 발전 규칙
CREATE TABLE IF NOT EXISTS self_improvement_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,           -- content, timing, engagement, growth
  rule TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,      -- 0-1, 검증된 정도
  source TEXT,                      -- 어떤 분석에서 도출됐는지
  active INTEGER DEFAULT 1,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  validated_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_post_analytics_platform ON post_analytics(platform, posted_at);
CREATE INDEX IF NOT EXISTS idx_growth_patterns_date ON growth_patterns(date, platform);
