-- ============================================
-- SNS.DB 트리거 모음
-- 자동으로 돌아가야 하는 DB 로직
-- ============================================

-- ============================================
-- 1. 중복 방지 트리거
-- ============================================

-- 1-1. content_queue 중복 콘텐츠 방지
-- 같은 content가 pending 상태로 이미 있으면 무시
DROP TRIGGER IF EXISTS prevent_duplicate_content;
CREATE TRIGGER prevent_duplicate_content
BEFORE INSERT ON content_queue
WHEN EXISTS (
    SELECT 1 FROM content_queue 
    WHERE content = NEW.content 
    AND posted = 0
)
BEGIN
    SELECT RAISE(IGNORE);
END;

-- 1-2. posts URL 중복 방지
-- 같은 URL이 이미 있으면 무시 (NULL URL은 허용)
DROP TRIGGER IF EXISTS prevent_duplicate_post_url;
CREATE TRIGGER prevent_duplicate_post_url
BEFORE INSERT ON posts
WHEN NEW.url IS NOT NULL AND EXISTS (
    SELECT 1 FROM posts WHERE url = NEW.url
)
BEGIN
    SELECT RAISE(IGNORE);
END;


-- ============================================
-- 2. 자동 계산 트리거
-- ============================================

-- 2-1. post_analytics engagement_rate 자동 계산 (INSERT)
DROP TRIGGER IF EXISTS calc_engagement_rate_insert;
CREATE TRIGGER calc_engagement_rate_insert
AFTER INSERT ON post_analytics
FOR EACH ROW
WHEN NEW.views > 0
BEGIN
    UPDATE post_analytics 
    SET engagement_rate = ROUND(
        (COALESCE(NEW.likes, 0) + COALESCE(NEW.replies, 0) + COALESCE(NEW.retweets, 0)) * 100.0 / NEW.views, 
        4
    ),
    updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id;
END;

-- 2-2. post_analytics engagement_rate 자동 계산 (UPDATE)
DROP TRIGGER IF EXISTS calc_engagement_rate_update;
CREATE TRIGGER calc_engagement_rate_update
AFTER UPDATE OF likes, replies, retweets, views ON post_analytics
FOR EACH ROW
WHEN NEW.views > 0
BEGIN
    UPDATE post_analytics 
    SET engagement_rate = ROUND(
        (COALESCE(NEW.likes, 0) + COALESCE(NEW.replies, 0) + COALESCE(NEW.retweets, 0)) * 100.0 / NEW.views, 
        4
    ),
    updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id;
END;

-- 2-3. goal_progress progress_pct 자동 계산 (INSERT)
DROP TRIGGER IF EXISTS calc_progress_pct_insert;
CREATE TRIGGER calc_progress_pct_insert
AFTER INSERT ON goal_progress
FOR EACH ROW
WHEN NEW.target_value > 0 AND NEW.progress_pct IS NULL
BEGIN
    UPDATE goal_progress 
    SET progress_pct = ROUND(
        COALESCE(NEW.current_value, 0) * 100.0 / NEW.target_value, 
        2
    )
    WHERE id = NEW.id;
END;

-- 2-4. goal_progress progress_pct 자동 계산 (UPDATE)
DROP TRIGGER IF EXISTS calc_progress_pct_update;
CREATE TRIGGER calc_progress_pct_update
AFTER UPDATE OF current_value, target_value ON goal_progress
FOR EACH ROW
WHEN NEW.target_value > 0
BEGIN
    UPDATE goal_progress 
    SET progress_pct = ROUND(
        COALESCE(NEW.current_value, 0) * 100.0 / NEW.target_value, 
        2
    )
    WHERE id = NEW.id;
END;


-- ============================================
-- 3. 데이터 정합성 트리거
-- ============================================

-- 3-1. posts 날짜 포맷 표준화 & NULL 기본값 (INSERT)
DROP TRIGGER IF EXISTS normalize_posts_insert;
CREATE TRIGGER normalize_posts_insert
BEFORE INSERT ON posts
BEGIN
    SELECT CASE
        WHEN NEW.platform IS NULL OR NEW.platform = '' 
        THEN RAISE(ABORT, 'platform은 필수입니다')
    END;
END;

-- 3-2. content_queue 날짜 포맷 표준화 (INSERT)
DROP TRIGGER IF EXISTS normalize_content_queue_insert;
CREATE TRIGGER normalize_content_queue_insert
AFTER INSERT ON content_queue
FOR EACH ROW
WHEN NEW.scheduled_at IS NOT NULL AND length(NEW.scheduled_at) = 10
BEGIN
    -- YYYY-MM-DD 형식이면 시간 추가
    UPDATE content_queue 
    SET scheduled_at = NEW.scheduled_at || ' 00:00:00'
    WHERE id = NEW.id;
END;

-- 3-3. event_queue 기본값 설정
DROP TRIGGER IF EXISTS normalize_event_queue;
CREATE TRIGGER normalize_event_queue
AFTER INSERT ON event_queue
FOR EACH ROW
WHEN NEW.priority IS NULL
BEGIN
    UPDATE event_queue 
    SET priority = 5
    WHERE id = NEW.id;
END;

-- 3-4. post_analytics 시간 정보 자동 추출
DROP TRIGGER IF EXISTS extract_post_time_info;
CREATE TRIGGER extract_post_time_info
AFTER INSERT ON post_analytics
FOR EACH ROW
WHEN NEW.posted_at IS NOT NULL AND (NEW.hour_posted IS NULL OR NEW.day_of_week IS NULL)
BEGIN
    UPDATE post_analytics 
    SET 
        hour_posted = COALESCE(NEW.hour_posted, CAST(strftime('%H', NEW.posted_at) AS INTEGER)),
        day_of_week = COALESCE(NEW.day_of_week, CAST(strftime('%w', NEW.posted_at) AS INTEGER))
    WHERE id = NEW.id;
END;


-- ============================================
-- 4. updated_at 자동 갱신
-- ============================================

-- 4-1. post_analytics updated_at
DROP TRIGGER IF EXISTS update_post_analytics_timestamp;
CREATE TRIGGER update_post_analytics_timestamp
AFTER UPDATE ON post_analytics
FOR EACH ROW
BEGIN
    UPDATE post_analytics 
    SET updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id AND updated_at = OLD.updated_at;
END;

-- 4-2. projects updated_at
DROP TRIGGER IF EXISTS update_projects_timestamp;
CREATE TRIGGER update_projects_timestamp
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
    UPDATE projects 
    SET updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id AND updated_at = OLD.updated_at;
END;

-- 4-3. resources updated_at
DROP TRIGGER IF EXISTS update_resources_timestamp;
CREATE TRIGGER update_resources_timestamp
AFTER UPDATE ON resources
FOR EACH ROW
BEGIN
    UPDATE resources 
    SET updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id AND updated_at = OLD.updated_at;
END;
