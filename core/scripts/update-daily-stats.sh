#!/bin/bash
# update-daily-stats.sh - daily_stats 테이블 업데이트
# Usage: ./update-daily-stats.sh [날짜] [--help]

set -e

DB_PATH="${DB_PATH:-$HOME/projects/openclaw-framework/data/sns.db}"

show_help() {
    cat << EOF
사용법: $0 [날짜] [옵션]

daily_stats 테이블 업데이트

인자:
    날짜        YYYY-MM-DD 형식 (기본: 오늘)

옵션:
    --x-followers N      X 팔로워 수 설정
    --threads-followers N Threads 팔로워 수 설정
    --notes "텍스트"     비고 추가
    --show               현재 상태 출력
    -h, --help           이 도움말 표시

예시:
    $0                              # 오늘 자동 업데이트
    $0 2024-01-15                   # 특정 날짜 업데이트
    $0 --x-followers 150            # X 팔로워 수정
    $0 --notes "신규 콘텐츠 전략 시작"
EOF
    exit 0
}

# 기본값
TARGET_DATE=$(date +%Y-%m-%d)
X_FOLLOWERS=""
THREADS_FOLLOWERS=""
NOTES=""
SHOW_ONLY=false

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        --x-followers) X_FOLLOWERS="$2"; shift 2 ;;
        --threads-followers) THREADS_FOLLOWERS="$2"; shift 2 ;;
        --notes) NOTES="$2"; shift 2 ;;
        --show) SHOW_ONLY=true; shift ;;
        -h|--help) show_help ;;
        [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) TARGET_DATE="$1"; shift ;;
        *) echo "알 수 없는 옵션: $1"; exit 1 ;;
    esac
done

# DB 확인
if [[ ! -f "$DB_PATH" ]]; then
    echo "❌ 에러: DB 파일이 없습니다: $DB_PATH"
    exit 1
fi

# 현재 상태 보기
if $SHOW_ONLY; then
    echo "📅 daily_stats 최근 7일"
    echo "================================"
    sqlite3 -header -column "$DB_PATH" \
        "SELECT date, x_followers, threads_followers, x_posts, threads_posts, notes 
         FROM daily_stats ORDER BY date DESC LIMIT 7"
    exit 0
fi

# 포스트 수 계산
X_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts WHERE platform='x' AND date(created_at)='$TARGET_DATE'" 2>/dev/null || echo "0")
THREADS_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts WHERE platform='threads' AND date(created_at)='$TARGET_DATE'" 2>/dev/null || echo "0")

# 이전 팔로워 수 가져오기 (없으면 사용)
if [[ -z "$X_FOLLOWERS" ]]; then
    X_FOLLOWERS=$(sqlite3 "$DB_PATH" "SELECT COALESCE(x_followers, 0) FROM daily_stats ORDER BY date DESC LIMIT 1" 2>/dev/null || echo "0")
fi
if [[ -z "$THREADS_FOLLOWERS" ]]; then
    THREADS_FOLLOWERS=$(sqlite3 "$DB_PATH" "SELECT COALESCE(threads_followers, 0) FROM daily_stats ORDER BY date DESC LIMIT 1" 2>/dev/null || echo "0")
fi

# 업데이트 실행
if [[ -n "$NOTES" ]]; then
    sqlite3 "$DB_PATH" << EOF
INSERT INTO daily_stats (date, x_followers, threads_followers, x_posts, threads_posts, notes)
VALUES ('$TARGET_DATE', $X_FOLLOWERS, $THREADS_FOLLOWERS, $X_POSTS, $THREADS_POSTS, '$NOTES')
ON CONFLICT(date) DO UPDATE SET
    x_followers = $X_FOLLOWERS,
    threads_followers = $THREADS_FOLLOWERS,
    x_posts = $X_POSTS,
    threads_posts = $THREADS_POSTS,
    notes = '$NOTES';
EOF
else
    sqlite3 "$DB_PATH" << EOF
INSERT INTO daily_stats (date, x_followers, threads_followers, x_posts, threads_posts)
VALUES ('$TARGET_DATE', $X_FOLLOWERS, $THREADS_FOLLOWERS, $X_POSTS, $THREADS_POSTS)
ON CONFLICT(date) DO UPDATE SET
    x_followers = $X_FOLLOWERS,
    threads_followers = $THREADS_FOLLOWERS,
    x_posts = $X_POSTS,
    threads_posts = $THREADS_POSTS;
EOF
fi

echo "✅ daily_stats 업데이트 완료: $TARGET_DATE"
echo "   X: $X_FOLLOWERS 팔로워, $X_POSTS 포스트"
echo "   Threads: $THREADS_FOLLOWERS 팔로워, $THREADS_POSTS 포스트"
[[ -n "$NOTES" ]] && echo "   📝 $NOTES"
