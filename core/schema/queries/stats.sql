-- ============================================
-- 통계 & 분석 쿼리
-- 리포트 생성용
-- ============================================

-- ============================================
-- 1. 콘텐츠 성과 분석
-- ============================================

-- 1-1. 최고 성과 포스트 TOP 10
SELECT 
    platform,
    content_type,
    topic,
    likes,
    replies,
    retweets,
    views,
    engagement_rate,
    posted_at
FROM post_analytics 
ORDER BY engagement_rate DESC 
LIMIT 10;

-- 1-2. 시간대별 engagement 분석
SELECT 
    hour_posted,
    COUNT(*) as post_count,
    ROUND(AVG(engagement_rate), 4) as avg_engagement,
    SUM(likes) as total_likes
FROM post_analytics 
WHERE hour_posted IS NOT NULL
GROUP BY hour_posted 
ORDER BY avg_engagement DESC;

-- 1-3. 요일별 engagement 분석
SELECT 
    CASE day_of_week
        WHEN 0 THEN '일요일'
        WHEN 1 THEN '월요일'
        WHEN 2 THEN '화요일'
        WHEN 3 THEN '수요일'
        WHEN 4 THEN '목요일'
        WHEN 5 THEN '금요일'
        WHEN 6 THEN '토요일'
    END as day_name,
    day_of_week,
    COUNT(*) as post_count,
    ROUND(AVG(engagement_rate), 4) as avg_engagement
FROM post_analytics 
WHERE day_of_week IS NOT NULL
GROUP BY day_of_week 
ORDER BY avg_engagement DESC;

-- 1-4. 토픽별 성과
SELECT 
    topic,
    COUNT(*) as post_count,
    ROUND(AVG(engagement_rate), 4) as avg_engagement,
    SUM(likes) as total_likes,
    SUM(replies) as total_replies
FROM post_analytics 
WHERE topic IS NOT NULL
GROUP BY topic 
ORDER BY avg_engagement DESC;


-- ============================================
-- 2. 큐 상태 모니터링
-- ============================================

-- 2-1. 전체 큐 상태 요약
SELECT 
    'content_queue' as queue_name,
    SUM(CASE WHEN posted = 0 THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN posted = 1 THEN 1 ELSE 0 END) as done
FROM content_queue
UNION ALL
SELECT 
    'event_queue',
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)
FROM event_queue
UNION ALL
SELECT 
    'follow_queue',
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)
FROM follow_queue
UNION ALL
SELECT 
    'reply_queue',
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)
FROM reply_queue;

-- 2-2. event_queue 타입별 상태
SELECT 
    queue_type,
    platform,
    status,
    COUNT(*) as count
FROM event_queue 
GROUP BY queue_type, platform, status 
ORDER BY queue_type, platform, status;


-- ============================================
-- 3. 성장 추이
-- ============================================

-- 3-1. 일별 팔로워 성장
SELECT 
    date,
    x_followers,
    threads_followers,
    x_followers - LAG(x_followers) OVER (ORDER BY date) as x_daily_growth,
    threads_followers - LAG(threads_followers) OVER (ORDER BY date) as threads_daily_growth
FROM daily_stats 
ORDER BY date DESC 
LIMIT 14;

-- 3-2. 주간 활동 요약
SELECT 
    strftime('%Y-W%W', date) as week,
    SUM(x_posts) as x_posts,
    SUM(threads_posts) as threads_posts,
    SUM(total_engagement) as total_engagement,
    MAX(x_followers) as x_followers_end,
    MAX(threads_followers) as threads_followers_end
FROM daily_stats 
GROUP BY strftime('%Y-W%W', date)
ORDER BY week DESC 
LIMIT 8;

-- 3-3. 목표 진행률
SELECT 
    goal_id,
    MAX(measured_at) as last_measured,
    MAX(current_value) as current,
    MAX(target_value) as target,
    MAX(progress_pct) as progress_pct
FROM goal_progress 
GROUP BY goal_id;


-- ============================================
-- 4. 자기 개선 규칙
-- ============================================

-- 4-1. 활성 규칙 목록 (신뢰도순)
SELECT 
    category,
    rule,
    confidence,
    source,
    created_at
FROM self_improvement_rules 
WHERE active = 1 
ORDER BY confidence DESC;

-- 4-2. 카테고리별 규칙 수
SELECT 
    category,
    COUNT(*) as rule_count,
    ROUND(AVG(confidence), 2) as avg_confidence
FROM self_improvement_rules 
WHERE active = 1 
GROUP BY category;
