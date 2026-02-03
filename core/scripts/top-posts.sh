#!/bin/bash
# top-posts.sh - 인기 포스트 출력
# Usage: ./top-posts.sh [--limit N] [--platform x|threads] [--help]

set -e

DB_PATH="${DB_PATH:-$HOME/projects/openclaw-framework/data/sns.db}"

show_help() {
    cat << EOF
사용법: $0 [옵션]

인기 포스트 목록 출력

옵션:
    -n, --limit N             표시할 개수 (기본: 10)
    -p, --platform PLATFORM   플랫폼 필터 (x, threads, all)
    --sort-by METRIC          정렬 기준 (likes, replies, retweets, engagement)
    --days N                  최근 N일 (기본: 전체)
    --full                    전체 내용 표시
    --json                    JSON 형식으로 출력
    -h, --help                이 도움말 표시

예시:
    $0                        # 좋아요 기준 TOP 10
    $0 -n 5 -p x              # X 플랫폼 TOP 5
    $0 --sort-by engagement   # engagement 기준 정렬
    $0 --days 7 --full        # 최근 7일, 전체 내용
EOF
    exit 0
}

# 기본값
LIMIT=10
PLATFORM="all"
SORT_BY="likes"
DAYS=""
FULL_CONTENT=false
JSON_OUTPUT=false

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--limit) LIMIT="$2"; shift 2 ;;
        -p|--platform) PLATFORM="$2"; shift 2 ;;
        --sort-by) SORT_BY="$2"; shift 2 ;;
        --days) DAYS="$2"; shift 2 ;;
        --full) FULL_CONTENT=true; shift ;;
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

# 필터 구성
WHERE_CLAUSES=""

if [[ "$PLATFORM" != "all" ]]; then
    WHERE_CLAUSES="WHERE platform='$PLATFORM'"
fi

if [[ -n "$DAYS" ]]; then
    START_DATE=$(date -v-${DAYS}d +%Y-%m-%d 2>/dev/null || date -d "$DAYS days ago" +%Y-%m-%d)
    if [[ -z "$WHERE_CLAUSES" ]]; then
        WHERE_CLAUSES="WHERE date(created_at) >= '$START_DATE'"
    else
        WHERE_CLAUSES="$WHERE_CLAUSES AND date(created_at) >= '$START_DATE'"
    fi
fi

# 정렬 기준
case $SORT_BY in
    likes) ORDER_BY="likes DESC" ;;
    replies) ORDER_BY="replies DESC" ;;
    retweets) ORDER_BY="retweets DESC" ;;
    engagement) ORDER_BY="(likes + replies + retweets) DESC" ;;
    *) ORDER_BY="likes DESC" ;;
esac

if $JSON_OUTPUT; then
    echo "{"
    echo "  \"filters\": {"
    echo "    \"platform\": \"$PLATFORM\","
    echo "    \"days\": ${DAYS:-\"all\"},"
    echo "    \"sort_by\": \"$SORT_BY\","
    echo "    \"limit\": $LIMIT"
    echo "  },"
    echo "  \"posts\": ["
    
    sqlite3 "$DB_PATH" \
        "SELECT id, platform, content, likes, replies, retweets, created_at
         FROM posts 
         $WHERE_CLAUSES
         ORDER BY $ORDER_BY
         LIMIT $LIMIT" 2>/dev/null | \
    awk -F'|' 'BEGIN{first=1} {
        if(!first) print ","
        first=0
        gsub(/"/, "\\\"", $3)
        printf "    {\"id\": %s, \"platform\": \"%s\", \"content\": \"%s\", \"likes\": %s, \"replies\": %s, \"retweets\": %s, \"created_at\": \"%s\"}", $1, $2, $3, $4, $5, $6, $7
    }'
    
    echo ""
    echo "  ]"
    echo "}"
else
    echo "🏆 인기 포스트 TOP $LIMIT"
    echo "================================"
    echo "🎯 플랫폼: $PLATFORM | 정렬: $SORT_BY"
    [[ -n "$DAYS" ]] && echo "📅 기간: 최근 ${DAYS}일"
    echo ""
    
    COUNT=0
    sqlite3 "$DB_PATH" \
        "SELECT id, platform, content, likes, replies, retweets, created_at
         FROM posts 
         $WHERE_CLAUSES
         ORDER BY $ORDER_BY
         LIMIT $LIMIT" 2>/dev/null | \
    while IFS='|' read -r id platform content likes replies retweets created_at; do
        COUNT=$((COUNT + 1))
        echo "--- #$COUNT ---"
        echo "📱 $platform | ❤️ $likes | 💬 $replies | 🔄 $retweets"
        echo "📅 $created_at"
        if $FULL_CONTENT; then
            echo "📝 $content"
        else
            echo "📝 ${content:0:100}..."
        fi
        echo ""
    done
    
    # 결과 없을 경우
    RESULT_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts $WHERE_CLAUSES" 2>/dev/null || echo "0")
    if [[ "$RESULT_COUNT" == "0" ]]; then
        echo "📭 해당 조건에 맞는 포스트가 없습니다."
    fi
fi
