#!/bin/bash
# analyze-posts.sh - 포스트 성과 분석
# Usage: ./analyze-posts.sh [--platform x|threads] [--days N] [--help]

set -e

DB_PATH="${DB_PATH:-$HOME/projects/openclaw-framework/data/sns.db}"

show_help() {
    cat << EOF
사용법: $0 [옵션]

포스트 성과 분석

옵션:
    -p, --platform PLATFORM   플랫폼 필터 (x, threads, all)
    -d, --days N              분석 기간 (기본: 30일)
    --detailed                상세 분석 출력
    --json                    JSON 형식으로 출력
    -h, --help                이 도움말 표시

예시:
    $0                        # 전체 분석
    $0 -p x -d 7              # X 플랫폼 최근 7일
    $0 --detailed             # 상세 분석
EOF
    exit 0
}

# 기본값
PLATFORM="all"
DAYS=30
DETAILED=false
JSON_OUTPUT=false

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--platform) PLATFORM="$2"; shift 2 ;;
        -d|--days) DAYS="$2"; shift 2 ;;
        --detailed) DETAILED=true; shift ;;
        --json) JSON_OUTPUT=true; shift ;;
        -h|--help) show_help ;;
        *) echo "알 수 없는 옵션: $1"; exit 1 ;;
    esac
done

# DB 확인
if [[ ! -f "$DB_PATH" ]]; then
    echo "❌ 에러: DB 파일이 없습니다: $DB_PATH"
    exit 1
fi

# 날짜 계산
START_DATE=$(date -v-${DAYS}d +%Y-%m-%d 2>/dev/null || date -d "$DAYS days ago" +%Y-%m-%d)

# 플랫폼 필터
PLATFORM_FILTER=""
if [[ "$PLATFORM" != "all" ]]; then
    PLATFORM_FILTER="AND platform='$PLATFORM'"
fi

# 기본 통계
TOTAL_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts WHERE date(created_at) >= '$START_DATE' $PLATFORM_FILTER" 2>/dev/null || echo "0")
TOTAL_LIKES=$(sqlite3 "$DB_PATH" "SELECT COALESCE(SUM(likes), 0) FROM posts WHERE date(created_at) >= '$START_DATE' $PLATFORM_FILTER" 2>/dev/null || echo "0")
TOTAL_REPLIES=$(sqlite3 "$DB_PATH" "SELECT COALESCE(SUM(replies), 0) FROM posts WHERE date(created_at) >= '$START_DATE' $PLATFORM_FILTER" 2>/dev/null || echo "0")
TOTAL_RETWEETS=$(sqlite3 "$DB_PATH" "SELECT COALESCE(SUM(retweets), 0) FROM posts WHERE date(created_at) >= '$START_DATE' $PLATFORM_FILTER" 2>/dev/null || echo "0")

# 평균 계산
if [[ $TOTAL_POSTS -gt 0 ]]; then
    AVG_LIKES=$(echo "scale=1; $TOTAL_LIKES / $TOTAL_POSTS" | bc)
    AVG_REPLIES=$(echo "scale=1; $TOTAL_REPLIES / $TOTAL_POSTS" | bc)
    AVG_RETWEETS=$(echo "scale=1; $TOTAL_RETWEETS / $TOTAL_POSTS" | bc)
else
    AVG_LIKES="0"
    AVG_REPLIES="0"
    AVG_RETWEETS="0"
fi

# 플랫폼별 통계
X_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts WHERE platform='x' AND date(created_at) >= '$START_DATE'" 2>/dev/null || echo "0")
THREADS_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts WHERE platform='threads' AND date(created_at) >= '$START_DATE'" 2>/dev/null || echo "0")

if $JSON_OUTPUT; then
    cat << EOF
{
  "period": {
    "start": "$START_DATE",
    "days": $DAYS
  },
  "platform": "$PLATFORM",
  "summary": {
    "total_posts": $TOTAL_POSTS,
    "total_likes": $TOTAL_LIKES,
    "total_replies": $TOTAL_REPLIES,
    "total_retweets": $TOTAL_RETWEETS
  },
  "averages": {
    "likes": $AVG_LIKES,
    "replies": $AVG_REPLIES,
    "retweets": $AVG_RETWEETS
  },
  "by_platform": {
    "x": $X_POSTS,
    "threads": $THREADS_POSTS
  }
}
EOF
else
    echo "📊 포스트 성과 분석"
    echo "================================"
    echo "📅 기간: $START_DATE ~ 오늘 ($DAYS일)"
    echo "🎯 플랫폼: $PLATFORM"
    echo ""
    echo "📈 요약"
    echo "   총 포스트: $TOTAL_POSTS"
    echo "   총 좋아요: $TOTAL_LIKES"
    echo "   총 댓글: $TOTAL_REPLIES"
    echo "   총 리트윗: $TOTAL_RETWEETS"
    echo ""
    echo "📊 평균 (포스트당)"
    echo "   좋아요: $AVG_LIKES"
    echo "   댓글: $AVG_REPLIES"
    echo "   리트윗: $AVG_RETWEETS"
    echo ""
    echo "📱 플랫폼별"
    echo "   X: $X_POSTS 포스트"
    echo "   Threads: $THREADS_POSTS 포스트"
    
    if $DETAILED; then
        echo ""
        echo "================================"
        echo "🏆 인기 포스트 TOP 5"
        echo ""
        sqlite3 -header -column "$DB_PATH" \
            "SELECT platform, substr(content, 1, 40) as content, likes, replies 
             FROM posts 
             WHERE date(created_at) >= '$START_DATE' $PLATFORM_FILTER
             ORDER BY likes DESC 
             LIMIT 5" 2>/dev/null || echo "데이터 없음"
        
        echo ""
        echo "📅 일별 포스팅 현황"
        sqlite3 "$DB_PATH" \
            "SELECT date(created_at) as date, COUNT(*) as posts, SUM(likes) as likes
             FROM posts 
             WHERE date(created_at) >= '$START_DATE' $PLATFORM_FILTER
             GROUP BY date(created_at)
             ORDER BY date DESC
             LIMIT 7" 2>/dev/null | while IFS='|' read -r date posts likes; do
            echo "   $date: $posts 포스트, $likes 좋아요"
        done
    fi
fi
