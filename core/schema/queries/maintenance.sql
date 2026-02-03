-- ============================================
-- 스케줄 관리 & 유지보수 쿼리
-- Cron에서 주기적으로 실행
-- ============================================

-- ============================================
-- 1. 오래된 pending 항목 정리
-- ============================================

-- 1-1. content_queue: 7일 이상 된 pending 항목 삭제
DELETE FROM content_queue 
WHERE posted = 0 
AND created_at < datetime('now', '-7 days');

-- 1-2. event_queue: 3일 이상 된 pending 항목 정리
UPDATE event_queue 
SET status = 'expired'
WHERE status = 'pending' 
AND created_at < datetime('now', '-3 days');

-- 1-3. follow_queue: 5일 이상 된 pending 항목 정리
UPDATE follow_queue 
SET status = 'expired'
WHERE status = 'pending' 
AND detected_at < datetime('now', '-5 days');

-- 1-4. reply_queue: 2일 이상 된 pending 항목 정리 (댓글은 신선도 중요)
UPDATE reply_queue 
SET status = 'expired'
WHERE status = 'pending' 
AND detected_at < datetime('now', '-2 days');


-- ============================================
-- 2. 실패한 작업 재시도 마킹
-- ============================================

-- 2-1. cron_runs: 3회 미만 실패한 작업 재시도
UPDATE cron_runs 
SET status = 'pending',
    retry_count = retry_count + 1
WHERE status = 'failed' 
AND retry_count < 3
AND ended_at < datetime('now', '-1 hour');

-- 2-3. event_queue: 실패 후 1시간 지난 항목 재시도 마킹
UPDATE event_queue 
SET status = 'pending',
    processed_at = NULL
WHERE status = 'failed' 
AND processed_at < datetime('now', '-1 hour');


-- ============================================
-- 3. 데이터 정리
-- ============================================

-- 3-1. 완료된 오래된 항목들 정리 (30일)
DELETE FROM event_queue 
WHERE status IN ('done', 'skipped', 'expired') 
AND processed_at < datetime('now', '-30 days');

DELETE FROM follow_queue 
WHERE status = 'done' 
AND processed_at < datetime('now', '-30 days');

DELETE FROM reply_queue 
WHERE status = 'done' 
AND processed_at < datetime('now', '-30 days');

-- 3-2. cron_runs 오래된 로그 정리 (7일)
DELETE FROM cron_runs 
WHERE ended_at < datetime('now', '-7 days');

-- 3-4. session_summaries 오래된 항목 정리 (30일)
DELETE FROM session_summaries 
WHERE created_at < datetime('now', '-30 days');
