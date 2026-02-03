#!/bin/bash
# collect-metrics.sh - 팔로워, 포스트 수 등 수집
# Usage: ./collect-metrics.sh [--help]

set -e

DB_PATH="${DB_PATH:-$HOME/projects/openclaw-framework/data/sns.db}"

show_help() {
    cat << EOF
사용법: $0 [옵션]

SNS 메트릭 수집 및 출력

옵션:
    --json      JSON 형식으로 출력
    --save      수집 결과를 DB에 저장
    -h, --help  이 도움말 표시

예시:
    $0              # 기본 메트릭 출력
    $0 --json       # JSON으로 출력
    $0 --save       # 수집 후 daily_stats에 저장
EOF
    exit 0
}

# 옵션 파싱
JSON_OUTPUT=false
SAVE_TO_DB=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --json) JSON_OUTPUT=true; shift ;;
        --save) SAVE_TO_DB=true; shift ;;
        -h|--help) show_help ;;
        *) echo "알 수 없는 옵션: $1"; exit 1 ;;
    esac
done

# DB 존재 확인
if [[ ! -f "$DB_PATH" ]]; then
    echo "❌ 에러: DB 파일이 없습니다: $DB_PATH"
    exit 1
fi

# 오늘 날짜
TODAY=$(date +%Y-%m-%d)

# 메트릭 수집
X_FOLLOWERS=$(sqlite3 "$DB_PATH" "SELECT COALESCE(x_followers, 0) FROM daily_stats ORDER BY date DESC LIMIT 1" 2>/dev/null || echo "0")
THREADS_FOLLOWERS=$(sqlite3 "$DB_PATH" "SELECT COALESCE(threads_followers, 0) FROM daily_stats ORDER BY date DESC LIMIT 1" 2>/dev/null || echo "0")
X_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts WHERE platform='x' AND date(created_at)='$TODAY'" 2>/dev/null || echo "0")
THREADS_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts WHERE platform='threads' AND date(created_at)='$TODAY'" 2>/dev/null || echo "0")
TOTAL_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts" 2>/dev/null || echo "0")
QUEUE_PENDING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM content_queue WHERE posted=0" 2>/dev/null || echo "0")
EVENTS_PENDING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM event_queue WHERE status='pending'" 2>/dev/null || echo "0")

# 출력
if $JSON_OUTPUT; then
    cat << EOF
{
  "date": "$TODAY",
  "x_followers": $X_FOLLOWERS,
  "threads_followers": $THREADS_FOLLOWERS,
  "x_posts_today": $X_POSTS,
  "threads_posts_today": $THREADS_POSTS,
  "total_posts": $TOTAL_POSTS,
  "queue_pending": $QUEUE_PENDING,
  "events_pending": $EVENTS_PENDING
}
EOF
else
    echo "📊 메트릭 현황 ($TODAY)"
    echo "================================"
    echo "👥 팔로워"
    echo "   X: $X_FOLLOWERS"
    echo "   Threads: $THREADS_FOLLOWERS"
    echo ""
    echo "📝 포스트 (오늘)"
    echo "   X: $X_POSTS"
    echo "   Threads: $THREADS_POSTS"
    echo ""
    echo "📈 전체 통계"
    echo "   총 포스트: $TOTAL_POSTS"
    echo "   대기 큐: $QUEUE_PENDING"
    echo "   이벤트 대기: $EVENTS_PENDING"
fi

# DB 저장
if $SAVE_TO_DB; then
    sqlite3 "$DB_PATH" << EOF
INSERT OR REPLACE INTO daily_stats (date, x_followers, threads_followers, x_posts, threads_posts)
VALUES ('$TODAY', $X_FOLLOWERS, $THREADS_FOLLOWERS, 
    (SELECT COUNT(*) FROM posts WHERE platform='x' AND date(created_at)='$TODAY'),
    (SELECT COUNT(*) FROM posts WHERE platform='threads' AND date(created_at)='$TODAY')
);
EOF
    echo ""
    echo "✅ daily_stats 업데이트 완료"
fi
