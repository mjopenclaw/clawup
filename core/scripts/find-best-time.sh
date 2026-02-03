#!/bin/bash
# find-best-time.sh - 최적 포스팅 시간 찾기
# Usage: ./find-best-time.sh [--platform x|threads] [--help]

set -e

DB_PATH="${DB_PATH:-$HOME/projects/openclaw-framework/data/sns.db}"

show_help() {
    cat << EOF
사용법: $0 [옵션]

포스트 성과 데이터 기반 최적 포스팅 시간 분석

옵션:
    -p, --platform PLATFORM   플랫폼 필터 (x, threads, all)
    --by-day                  요일별 분석
    --by-hour                 시간별 분석 (기본)
    --json                    JSON 형식으로 출력
    -h, --help                이 도움말 표시

예시:
    $0                        # 시간별 분석
    $0 -p x --by-day          # X 플랫폼 요일별
    $0 --json                 # JSON 출력
EOF
    exit 0
}

# 기본값
PLATFORM="all"
BY_DAY=false
JSON_OUTPUT=false

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--platform) PLATFORM="$2"; shift 2 ;;
        --by-day) BY_DAY=true; shift ;;
        --by-hour) BY_DAY=false; shift ;;
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

# 플랫폼 필터
PLATFORM_FILTER=""
if [[ "$PLATFORM" != "all" ]]; then
    PLATFORM_FILTER="AND platform='$PLATFORM'"
fi

# 요일 이름
day_name() {
    case $1 in
        0) echo "일요일" ;;
        1) echo "월요일" ;;
        2) echo "화요일" ;;
        3) echo "수요일" ;;
        4) echo "목요일" ;;
        5) echo "금요일" ;;
        6) echo "토요일" ;;
    esac
}

if $BY_DAY; then
    # 요일별 분석
    if $JSON_OUTPUT; then
        echo "{"
        echo "  \"analysis_type\": \"by_day\","
        echo "  \"platform\": \"$PLATFORM\","
        echo "  \"data\": ["
        
        sqlite3 "$DB_PATH" \
            "SELECT strftime('%w', created_at) as day, 
                    COUNT(*) as posts, 
                    COALESCE(AVG(likes), 0) as avg_likes
             FROM posts 
             WHERE created_at IS NOT NULL $PLATFORM_FILTER
             GROUP BY strftime('%w', created_at)
             ORDER BY avg_likes DESC" 2>/dev/null | \
        awk -F'|' 'NR>1{print ","} {printf "    {\"day\": %s, \"posts\": %s, \"avg_likes\": %.1f}", $1, $2, $3}'
        
        echo ""
        echo "  ]"
        echo "}"
    else
        echo "📅 요일별 최적 포스팅 시간"
        echo "================================"
        echo "🎯 플랫폼: $PLATFORM"
        echo ""
        echo "요일       | 포스트 | 평균 좋아요"
        echo "-----------|--------|------------"
        
        sqlite3 "$DB_PATH" \
            "SELECT strftime('%w', created_at) as day, 
                    COUNT(*) as posts, 
                    COALESCE(AVG(likes), 0) as avg_likes
             FROM posts 
             WHERE created_at IS NOT NULL $PLATFORM_FILTER
             GROUP BY strftime('%w', created_at)
             ORDER BY avg_likes DESC" 2>/dev/null | \
        while IFS='|' read -r day posts avg_likes; do
            printf "%-10s | %6s | %.1f\n" "$(day_name $day)" "$posts" "$avg_likes"
        done
        
        BEST_DAY=$(sqlite3 "$DB_PATH" \
            "SELECT strftime('%w', created_at)
             FROM posts 
             WHERE created_at IS NOT NULL $PLATFORM_FILTER
             GROUP BY strftime('%w', created_at)
             ORDER BY AVG(likes) DESC LIMIT 1" 2>/dev/null || echo "")
        
        if [[ -n "$BEST_DAY" ]]; then
            echo ""
            echo "🏆 추천: $(day_name $BEST_DAY)이 가장 반응이 좋습니다!"
        fi
    fi
else
    # 시간별 분석
    if $JSON_OUTPUT; then
        echo "{"
        echo "  \"analysis_type\": \"by_hour\","
        echo "  \"platform\": \"$PLATFORM\","
        echo "  \"data\": ["
        
        sqlite3 "$DB_PATH" \
            "SELECT strftime('%H', created_at) as hour, 
                    COUNT(*) as posts, 
                    COALESCE(AVG(likes), 0) as avg_likes
             FROM posts 
             WHERE created_at IS NOT NULL $PLATFORM_FILTER
             GROUP BY strftime('%H', created_at)
             ORDER BY avg_likes DESC" 2>/dev/null | \
        awk -F'|' 'NR>1{print ","} {printf "    {\"hour\": \"%s\", \"posts\": %s, \"avg_likes\": %.1f}", $1, $2, $3}'
        
        echo ""
        echo "  ]"
        echo "}"
    else
        echo "⏰ 시간별 최적 포스팅 시간"
        echo "================================"
        echo "🎯 플랫폼: $PLATFORM"
        echo ""
        echo "시간  | 포스트 | 평균 좋아요"
        echo "------|--------|------------"
        
        sqlite3 "$DB_PATH" \
            "SELECT strftime('%H', created_at) as hour, 
                    COUNT(*) as posts, 
                    COALESCE(AVG(likes), 0) as avg_likes
             FROM posts 
             WHERE created_at IS NOT NULL $PLATFORM_FILTER
             GROUP BY strftime('%H', created_at)
             ORDER BY avg_likes DESC
             LIMIT 10" 2>/dev/null | \
        while IFS='|' read -r hour posts avg_likes; do
            printf "%s:00 | %6s | %.1f\n" "$hour" "$posts" "$avg_likes"
        done
        
        BEST_HOUR=$(sqlite3 "$DB_PATH" \
            "SELECT strftime('%H', created_at)
             FROM posts 
             WHERE created_at IS NOT NULL $PLATFORM_FILTER
             GROUP BY strftime('%H', created_at)
             ORDER BY AVG(likes) DESC LIMIT 1" 2>/dev/null || echo "")
        
        if [[ -n "$BEST_HOUR" ]]; then
            echo ""
            echo "🏆 추천: ${BEST_HOUR}:00 ~ ${BEST_HOUR}:59 시간대가 가장 반응이 좋습니다!"
        fi
    fi
fi
