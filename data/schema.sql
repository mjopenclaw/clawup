-- ClawUp Framework Database Schema

-- Feedback records
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT DEFAULT (date('now')),
  content TEXT NOT NULL,
  component TEXT,
  applied INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Learnings and insights
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

-- Core principles
CREATE TABLE IF NOT EXISTS principles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  action TEXT NOT NULL,
  target TEXT,
  result TEXT,
  metadata TEXT
);

-- Rules (learned behaviors)
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT,
  rule TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  source TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Experiments
CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hypothesis TEXT NOT NULL,
  method TEXT,
  status TEXT DEFAULT 'pending',
  results TEXT,
  conclusion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Daily stats
CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE DEFAULT (date('now')),
  actions_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_rules_category ON rules(category);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
