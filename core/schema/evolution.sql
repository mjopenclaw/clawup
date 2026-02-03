-- evolution.sql - 자가 발전 모듈 스키마
-- 규칙 학습, 실험, 패턴 감지를 위한 테이블들

-- ========================================
-- 1. 규칙 관리
-- ========================================

-- 규칙 정의
CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_type TEXT NOT NULL,              -- timing, content, engagement, hashtag
    rule_key TEXT NOT NULL,               -- best_hours, min_length, etc.
    rule_value TEXT NOT NULL,             -- JSON 값
    confidence REAL DEFAULT 0.0,          -- 0.0 ~ 1.0
    experiments_count INTEGER DEFAULT 0,
    positive_results INTEGER DEFAULT 0,
    negative_results INTEGER DEFAULT 0,
    reason TEXT,
    status TEXT DEFAULT 'active',         -- active, pending, archived
    source TEXT DEFAULT 'manual',         -- manual, pattern_detector, experiment
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_validated DATETIME,
    UNIQUE(rule_type, rule_key)
);

-- 규칙 변경 이력
CREATE TABLE IF NOT EXISTS rule_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL,
    rule_type TEXT NOT NULL,
    rule_key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    old_confidence REAL,
    new_confidence REAL,
    change_reason TEXT,
    changed_by TEXT,                      -- analyzer, experiment, user
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES rules(id)
);

-- ========================================
-- 2. 실험 관리
-- ========================================

-- 실험 정의
CREATE TABLE IF NOT EXISTS experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT UNIQUE NOT NULL,   -- exp_001 형식
    name TEXT NOT NULL,
    hypothesis TEXT NOT NULL,
    variable TEXT NOT NULL,               -- 테스트 대상 변수
    control_description TEXT,
    treatment_description TEXT,
    success_metric TEXT NOT NULL,         -- 측정할 메트릭
    min_samples INTEGER DEFAULT 10,
    max_duration_days INTEGER DEFAULT 14,
    status TEXT DEFAULT 'pending',        -- pending, running, completed, cancelled
    start_date DATE,
    end_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT DEFAULT 'system'
);

-- 실험 결과
CREATE TABLE IF NOT EXISTS experiment_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT NOT NULL,
    group_type TEXT NOT NULL,             -- control, treatment
    sample_date DATE NOT NULL,
    metric_value REAL NOT NULL,
    metadata TEXT,                        -- JSON 추가 데이터
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES experiments(experiment_id)
);

-- 실험 완료 기록
CREATE TABLE IF NOT EXISTS experiment_conclusions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id TEXT NOT NULL,
    result_status TEXT NOT NULL,          -- success, failed, inconclusive
    winner TEXT,                          -- control, treatment, null
    lift REAL,                            -- 효과 크기
    confidence REAL,                      -- 통계적 신뢰도
    control_avg REAL,
    treatment_avg REAL,
    control_samples INTEGER,
    treatment_samples INTEGER,
    p_value REAL,
    promoted_to_rule INTEGER DEFAULT 0,
    rule_id INTEGER,
    conclusion_notes TEXT,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES experiments(experiment_id),
    FOREIGN KEY (rule_id) REFERENCES rules(id)
);

-- ========================================
-- 3. 패턴 감지
-- ========================================

-- 감지된 패턴
CREATE TABLE IF NOT EXISTS detected_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL,           -- time_series, correlation, clustering, rule
    pattern_name TEXT NOT NULL,
    description TEXT,
    condition_json TEXT,                  -- JSON 패턴 조건
    action_json TEXT,                     -- JSON 제안 행동
    confidence REAL,
    statistical_significance REAL,
    sample_size INTEGER,
    effect_size REAL,
    status TEXT DEFAULT 'detected',       -- detected, validated, promoted, rejected
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    validated_at DATETIME,
    promoted_at DATETIME
);

-- ========================================
-- 4. 학습 기록
-- ========================================

-- 학습 로그
CREATE TABLE IF NOT EXISTS learnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE DEFAULT (date('now')),
    category TEXT NOT NULL,               -- timing, content, engagement, strategy
    pattern TEXT NOT NULL,                -- 발견된 패턴
    insight TEXT,                         -- 인사이트 설명
    data_source TEXT,                     -- 데이터 소스
    confidence REAL DEFAULT 0.0,
    applied INTEGER DEFAULT 0,            -- 적용 여부
    applied_to TEXT,                      -- 적용된 규칙/전략 ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 5. 메트릭 분석
-- ========================================

-- 분석 실행 기록
CREATE TABLE IF NOT EXISTS analysis_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analyzer_id TEXT NOT NULL,            -- metrics-analyzer, pattern-detector
    run_date DATE DEFAULT (date('now')),
    data_period_start DATE,
    data_period_end DATE,
    records_analyzed INTEGER,
    patterns_found INTEGER,
    rules_suggested INTEGER,
    status TEXT DEFAULT 'completed',
    duration_seconds REAL,
    report_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 분석 결과 요약
CREATE TABLE IF NOT EXISTS analysis_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_run_id INTEGER NOT NULL,
    insight_type TEXT NOT NULL,           -- finding, recommendation, warning
    category TEXT,
    title TEXT NOT NULL,
    description TEXT,
    impact_level TEXT,                    -- low, medium, high
    action_required INTEGER DEFAULT 0,
    action_taken INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id)
);

-- ========================================
-- 6. 전략 관리
-- ========================================

-- 활성 전략
CREATE TABLE IF NOT EXISTS strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_channels TEXT,                 -- JSON array
    params TEXT,                          -- JSON parameters
    status TEXT DEFAULT 'active',         -- active, paused, testing, archived
    confidence REAL DEFAULT 0.0,
    experiments_count INTEGER DEFAULT 0,
    success_rate REAL,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    validated_at DATETIME,
    archived_at DATETIME
);

-- 전략 성과 기록
CREATE TABLE IF NOT EXISTS strategy_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_id TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    follower_growth INTEGER,
    engagement_rate REAL,
    posts_count INTEGER,
    likes_count INTEGER,
    reposts_count INTEGER,
    comments_count INTEGER,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (strategy_id) REFERENCES strategies(strategy_id)
);

-- ========================================
-- 7. 인덱스
-- ========================================

CREATE INDEX IF NOT EXISTS idx_rules_type ON rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_rules_status ON rules(status);
CREATE INDEX IF NOT EXISTS idx_rule_history_rule ON rule_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiment_results_exp ON experiment_results(experiment_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON detected_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_status ON detected_patterns(status);
CREATE INDEX IF NOT EXISTS idx_learnings_date ON learnings(date);
CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_date ON analysis_runs(run_date);
CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);

-- ========================================
-- 8. 뷰
-- ========================================

-- 활성 규칙 뷰
CREATE VIEW IF NOT EXISTS v_active_rules AS
SELECT
    rule_type,
    rule_key,
    rule_value,
    confidence,
    experiments_count,
    reason,
    updated_at
FROM rules
WHERE status = 'active'
AND confidence >= 0.5
ORDER BY rule_type, confidence DESC;

-- 실험 요약 뷰
CREATE VIEW IF NOT EXISTS v_experiment_summary AS
SELECT
    e.experiment_id,
    e.name,
    e.status,
    e.start_date,
    e.end_date,
    COUNT(CASE WHEN er.group_type = 'control' THEN 1 END) as control_samples,
    COUNT(CASE WHEN er.group_type = 'treatment' THEN 1 END) as treatment_samples,
    AVG(CASE WHEN er.group_type = 'control' THEN er.metric_value END) as control_avg,
    AVG(CASE WHEN er.group_type = 'treatment' THEN er.metric_value END) as treatment_avg
FROM experiments e
LEFT JOIN experiment_results er ON e.experiment_id = er.experiment_id
GROUP BY e.experiment_id;

-- 최근 학습 뷰
CREATE VIEW IF NOT EXISTS v_recent_learnings AS
SELECT
    date,
    category,
    pattern,
    insight,
    confidence,
    applied
FROM learnings
WHERE date >= date('now', '-30 days')
ORDER BY date DESC, confidence DESC;
