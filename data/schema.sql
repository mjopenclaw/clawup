-- OpenClaw Framework DB Schema
-- 프레임워크 핵심 데이터만

-- 피드백 기록
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT DEFAULT (date('now')),
  content TEXT NOT NULL,
  component TEXT,
  applied INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 학습/교훈 기록
CREATE TABLE IF NOT EXISTS learnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT DEFAULT (date('now')),
  situation TEXT,
  cause TEXT,
  result TEXT,
  lesson TEXT,
  rule_added TEXT,
  applied INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 원칙 저장
CREATE TABLE IF NOT EXISTS principles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 세션 요약 (context 유지)
CREATE TABLE IF NOT EXISTS session_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  topics TEXT,
  decisions TEXT,
  todos TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER,
  source TEXT
);

-- 할 일 관리
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  due_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_ss_created_at ON session_summaries(created_at DESC);
