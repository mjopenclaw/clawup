-- ============================================
-- Migration 001: 성능 최적화 인덱스 추가
-- 실행일: 자동 생성
-- ============================================

-- 중복 체크용 인덱스
CREATE INDEX IF NOT EXISTS idx_content_queue_content_hash 
ON content_queue(content) WHERE posted = 0;

CREATE INDEX IF NOT EXISTS idx_posts_url 
ON posts(url) WHERE url IS NOT NULL;

-- 날짜 기반 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduled 
ON content_queue(scheduled_at) WHERE posted = 0;

CREATE INDEX IF NOT EXISTS idx_posts_created 
ON posts(created_at);

-- 큐 상태 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_follow_queue_status 
ON follow_queue(status, detected_at);

CREATE INDEX IF NOT EXISTS idx_reply_queue_status 
ON reply_queue(status, detected_at);

-- post_analytics 분석용 인덱스
CREATE INDEX IF NOT EXISTS idx_post_analytics_topic 
ON post_analytics(topic, engagement_rate);

CREATE INDEX IF NOT EXISTS idx_post_analytics_time 
ON post_analytics(hour_posted, day_of_week);

-- goal_progress 조회용
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal 
ON goal_progress(goal_id, measured_at DESC);

-- activity_log 조회용
CREATE INDEX IF NOT EXISTS idx_activity_log_session 
ON activity_log(session_id, timestamp);

-- scheduled_tasks 상태 조회용 (테이블 존재 시에만)
-- CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status 
-- ON scheduled_tasks(status, scheduled_at);
