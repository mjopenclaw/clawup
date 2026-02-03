#!/bin/bash
# generate-dashboard.sh - 마크다운 대시보드 자동 생성
# Usage: ./generate-dashboard.sh [--output FILE] [--help]

set -e

DB_PATH="${DB_PATH:-$HOME/projects/openclaw-framework/data/sns.db}"
OUTPUT_PATH="${OUTPUT_PATH:-$HOME/projects/openclaw-framework/memory/dashboard.md}"

show_help() {
    cat << EOF
사용법: $0 [옵션]

마크다운 형식의 대시보드 생성

옵션:
    -o, --output FILE   출력 파일 경로 (기본: memory/dashboard.md)
    --stdout            파일 대신 stdout으로 출력
    -h, --help          이 도움말 표시

예시:
    $0                          # 기본 위치에 저장
    $0 -o ~/dashboard.md        # 특정 위치에 저장
    $0 --stdout                 # 화면에 출력
EOF
    exit 0
}

# 옵션 파싱
STDOUT_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -o|--output) OUTPUT_PATH="$2"; shift 2 ;;
        --stdout) STDOUT_ONLY=true; shift ;;
        -h|--help) show_help ;;
        *) echo "알 수 없는 옵션: $1"; exit 1 ;;
    esac
done

# DB 확인
if [[ ! -f "$DB_PATH" ]]; then
    echo "❌ 에러: DB 파일이 없습니다: $DB_PATH"
    exit 1
fi

# 데이터 수집
TODAY=$(date +%Y-%m-%d)
NOW=$(date "+%Y-%m-%d %H:%M:%S")

LATEST_STATS=$(sqlite3 "$DB_PATH" "SELECT x_followers, threads_followers FROM daily_stats ORDER BY date DESC LIMIT 1" 2>/dev/null || echo "0|0")
X_FOLLOWERS=$(echo "$LATEST_STATS" | cut -d'|' -f1)
THREADS_FOLLOWERS=$(echo "$LATEST_STATS" | cut -d'|' -f2)

# 7일 전 대비 성장
WEEK_AGO=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)
WEEK_STATS=$(sqlite3 "$DB_PATH" "SELECT x_followers, threads_followers FROM daily_stats WHERE date <= '$WEEK_AGO' ORDER BY date DESC LIMIT 1" 2>/dev/null || echo "0|0")
X_WEEK_AGO=$(echo "$WEEK_STATS" | cut -d'|' -f1)
THREADS_WEEK_AGO=$(echo "$WEEK_STATS" | cut -d'|' -f2)
X_GROWTH=$((X_FOLLOWERS - X_WEEK_AGO))
THREADS_GROWTH=$((THREADS_FOLLOWERS - THREADS_WEEK_AGO))

# 오늘 활동
X_POSTS_TODAY=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts WHERE platform='x' AND date(created_at)='$TODAY'" 2>/dev/null || echo "0")
THREADS_POSTS_TODAY=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts WHERE platform='threads' AND date(created_at)='$TODAY'" 2>/dev/null || echo "0")

# 전체 통계
TOTAL_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts" 2>/dev/null || echo "0")
QUEUE_SIZE=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM content_queue WHERE posted=0" 2>/dev/null || echo "0")
EVENTS_PENDING=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM event_queue WHERE status='pending'" 2>/dev/null || echo "0")

# 최근 포스트 (최대 5개)
RECENT_POSTS=$(sqlite3 "$DB_PATH" "SELECT platform, substr(content, 1, 50), created_at FROM posts ORDER BY created_at DESC LIMIT 5" 2>/dev/null || echo "")

# 대시보드 생성
DASHBOARD=$(cat << EOF
# 📊 SNS 대시보드

> 마지막 업데이트: $NOW

---

## 👥 팔로워 현황

| 플랫폼 | 현재 | 주간 변화 |
|--------|------|-----------|
| X (Twitter) | **$X_FOLLOWERS** | $([ $X_GROWTH -ge 0 ] && echo "+$X_GROWTH ↑" || echo "$X_GROWTH ↓") |
| Threads | **$THREADS_FOLLOWERS** | $([ $THREADS_GROWTH -ge 0 ] && echo "+$THREADS_GROWTH ↑" || echo "$THREADS_GROWTH ↓") |

---

## 📝 오늘의 활동

- X 포스트: **$X_POSTS_TODAY**개
- Threads 포스트: **$THREADS_POSTS_TODAY**개

---

## 📈 전체 통계

| 지표 | 값 |
|------|-----|
| 총 포스트 | $TOTAL_POSTS |
| 대기 콘텐츠 | $QUEUE_SIZE |
| 처리 대기 이벤트 | $EVENTS_PENDING |

---

## 📋 최근 포스트

EOF
)

# 최근 포스트 추가
if [[ -n "$RECENT_POSTS" ]]; then
    DASHBOARD+=$'\n| 플랫폼 | 내용 | 시간 |\n'
    DASHBOARD+='|--------|------|------|\n'
    while IFS='|' read -r platform content created_at; do
        DASHBOARD+="| $platform | ${content}... | $created_at |\n"
    done <<< "$RECENT_POSTS"
else
    DASHBOARD+=$'\n*포스트 없음*\n'
fi

DASHBOARD+=$'\n---\n\n*이 대시보드는 자동 생성됩니다.*\n'

# 출력
if $STDOUT_ONLY; then
    echo -e "$DASHBOARD"
else
    mkdir -p "$(dirname "$OUTPUT_PATH")"
    echo -e "$DASHBOARD" > "$OUTPUT_PATH"
    echo "✅ 대시보드 생성 완료: $OUTPUT_PATH"
fi
