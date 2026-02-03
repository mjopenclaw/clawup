#!/bin/bash
# check-queue.sh - 대기 중인 콘텐츠 확인
# Usage: ./check-queue.sh [--all] [--platform x|threads] [--help]

set -e

DB_PATH="${DB_PATH:-$HOME/projects/openclaw-framework/data/sns.db}"

show_help() {
    cat << EOF
사용법: $0 [옵션]

대기 중인 콘텐츠 큐 확인

옵션:
    --all                 완료된 것 포함 전체 보기
    --pending             대기 중인 것만 (기본)
    -p, --platform PLAT   플랫폼 필터
    -n, --limit N         표시 개수 (기본: 20)
    --events              이벤트 큐도 함께 표시
    --json                JSON 형식으로 출력
    --clear               완료된 항목 정리
    -h, --help            이 도움말 표시

예시:
    $0                    # 대기 중인 콘텐츠
    $0 --all -n 50        # 전체 50개
    $0 -p x               # X 플랫폼만
    $0 --events           # 이벤트 큐도 표시
    $0 --clear            # 완료 항목 정리
EOF
    exit 0
}

# 기본값
SHOW_ALL=false
PLATFORM=""
LIMIT=20
SHOW_EVENTS=false
JSON_OUTPUT=false
CLEAR_DONE=false

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        --all) SHOW_ALL=true; shift ;;
        --pending) SHOW_ALL=false; shift ;;
        -p|--platform) PLATFORM="$2"; shift 2 ;;
        -n|--limit) LIMIT="$2"; shift 2 ;;
        --events) SHOW_EVENTS=true; shift ;;
        --json) JSON_OUTPUT=true; shift ;;
        --clear) CLEAR_DONE=true; shift ;;
        -h|--help) show_help ;;
        *) echo "알 수 없는 옵션: $1"; exit 1 ;;
    esac
done

# DB 확인
if [[ ! -f "$DB_PATH" ]]; then
    echo "❌ 에러: DB 파일이 없습니다: $DB_PATH"
    exit 1
fi

# 정리 모드
if $CLEAR_DONE; then
    BEFORE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM content_queue WHERE posted=1")
    sqlite3 "$DB_PATH" "DELETE FROM content_queue WHERE posted=1"
    AFTER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM content_queue WHERE posted=1")
    echo "🧹 완료된 항목 정리: $BEFORE개 삭제됨"
    exit 0
fi

# 필터 구성
WHERE_CLAUSE=""
if ! $SHOW_ALL; then
    WHERE_CLAUSE="WHERE posted=0"
fi
if [[ -n "$PLATFORM" ]]; then
    if [[ -z "$WHERE_CLAUSE" ]]; then
        WHERE_CLAUSE="WHERE platform='$PLATFORM'"
    else
        WHERE_CLAUSE="$WHERE_CLAUSE AND platform='$PLATFORM'"
    fi
fi

# 통계
TOTAL_PENDING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM content_queue WHERE posted=0")
TOTAL_DONE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM content_queue WHERE posted=1")
EVENTS_PENDING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM event_queue WHERE status='pending'" 2>/dev/null || echo "0")

if $JSON_OUTPUT; then
    echo "{"
    echo "  \"summary\": {"
    echo "    \"content_pending\": $TOTAL_PENDING,"
    echo "    \"content_done\": $TOTAL_DONE,"
    echo "    \"events_pending\": $EVENTS_PENDING"
    echo "  },"
    echo "  \"content_queue\": ["
    
    sqlite3 "$DB_PATH" \
        "SELECT id, platform, substr(content, 1, 100), scheduled_at, source, posted
         FROM content_queue $WHERE_CLAUSE
         ORDER BY CASE WHEN posted=0 THEN 0 ELSE 1 END, scheduled_at ASC
         LIMIT $LIMIT" 2>/dev/null | \
    awk -F'|' 'BEGIN{first=1} {
        if(!first) print ","
        first=0
        gsub(/"/, "\\\"", $3)
        printf "    {\"id\": %s, \"platform\": \"%s\", \"content\": \"%s\", \"scheduled_at\": \"%s\", \"source\": \"%s\", \"posted\": %s}", $1, $2, $3, $4, $5, $6
    }'
    
    echo ""
    echo "  ]"
    echo "}"
else
    echo "📋 콘텐츠 큐 현황"
    echo "================================"
    echo "📊 요약: 대기 $TOTAL_PENDING개 | 완료 $TOTAL_DONE개 | 이벤트 대기 $EVENTS_PENDING개"
    echo ""
    
    if [[ $TOTAL_PENDING -eq 0 ]] && ! $SHOW_ALL; then
        echo "📭 대기 중인 콘텐츠가 없습니다."
    else
        echo "ID  | 플랫폼  | 예약시간         | 출처    | 상태 | 내용"
        echo "----|---------|------------------|---------|------|-----"
        
        sqlite3 "$DB_PATH" \
            "SELECT id, platform, COALESCE(scheduled_at, '즉시'), source, 
                    CASE WHEN posted=1 THEN '✅' ELSE '⏳' END,
                    substr(content, 1, 40)
             FROM content_queue $WHERE_CLAUSE
             ORDER BY CASE WHEN posted=0 THEN 0 ELSE 1 END, scheduled_at ASC
             LIMIT $LIMIT" 2>/dev/null | \
        while IFS='|' read -r id platform scheduled source status content; do
            printf "%-3s | %-7s | %-16s | %-7s | %-4s | %s...\n" \
                "$id" "$platform" "$scheduled" "$source" "$status" "$content"
        done
    fi
    
    # 이벤트 큐
    if $SHOW_EVENTS; then
        echo ""
        echo "================================"
        echo "📬 이벤트 큐 (대기 중)"
        echo ""
        
        if [[ $EVENTS_PENDING -eq 0 ]]; then
            echo "📭 대기 중인 이벤트가 없습니다."
        else
            echo "타입    | 플랫폼  | 이벤트    | 타겟         | 생성일"
            echo "--------|---------|-----------|--------------|-------"
            
            sqlite3 "$DB_PATH" \
                "SELECT queue_type, platform, event_type, COALESCE(target_user, target_post, '-'), 
                        datetime(created_at)
                 FROM event_queue 
                 WHERE status='pending'
                 ORDER BY created_at ASC
                 LIMIT 10" 2>/dev/null | \
            while IFS='|' read -r qtype platform etype target created; do
                printf "%-7s | %-7s | %-9s | %-12s | %s\n" \
                    "$qtype" "$platform" "$etype" "${target:0:12}" "$created"
            done
        fi
    fi
    
    echo ""
    echo "💡 팁: --all로 전체, --events로 이벤트 큐, --clear로 완료 정리"
fi
