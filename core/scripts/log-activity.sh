#!/bin/bash
# log-activity.sh - 활동 로그 기록
# Usage: ./log-activity.sh <type> <platform> <message> [--help]

set -e

DB_PATH="${DB_PATH:-$HOME/projects/openclaw-framework/data/sns.db}"
LOG_PATH="${LOG_PATH:-$HOME/projects/openclaw-framework/memory/activity.log}"

show_help() {
    cat << EOF
사용법: $0 <type> <platform> <message> [옵션]

활동 로그 기록

인자:
    type        활동 유형 (post, reply, follow, unfollow, like, dm, other)
    platform    플랫폼 (x, threads, blog, telegram, all)
    message     로그 메시지

옵션:
    --show          최근 로그 보기
    --show-today    오늘 로그만 보기
    --count N       표시할 로그 수 (기본: 20)
    --db            DB에도 저장 (event_queue)
    -h, --help      이 도움말 표시

예시:
    $0 post x "OpenClaw 팁 포스팅 완료"
    $0 follow threads "@username 맞팔"
    $0 reply x "댓글 3개 작성"
    $0 --show                # 최근 로그 보기
    $0 --show-today          # 오늘 로그만
EOF
    exit 0
}

# 옵션 체크
SHOW_LOGS=false
SHOW_TODAY=false
SAVE_TO_DB=false
COUNT=20

# 먼저 --show 계열 옵션 확인
if [[ "$1" == "--show" ]]; then
    SHOW_LOGS=true
    shift
elif [[ "$1" == "--show-today" ]]; then
    SHOW_TODAY=true
    shift
elif [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_help
fi

# --count 처리
while [[ $# -gt 0 ]] && [[ "$1" == --* ]]; do
    case $1 in
        --count) COUNT="$2"; shift 2 ;;
        --db) SAVE_TO_DB=true; shift ;;
        *) break ;;
    esac
done

# 로그 보기 모드
if $SHOW_LOGS; then
    if [[ ! -f "$LOG_PATH" ]]; then
        echo "📭 로그 파일이 없습니다: $LOG_PATH"
        exit 0
    fi
    echo "📋 최근 활동 로그 (최대 $COUNT개)"
    echo "================================"
    tail -n "$COUNT" "$LOG_PATH"
    exit 0
fi

if $SHOW_TODAY; then
    if [[ ! -f "$LOG_PATH" ]]; then
        echo "📭 로그 파일이 없습니다: $LOG_PATH"
        exit 0
    fi
    TODAY=$(date +%Y-%m-%d)
    echo "📋 오늘의 활동 로그 ($TODAY)"
    echo "================================"
    grep "^\[$TODAY" "$LOG_PATH" 2>/dev/null || echo "오늘 로그 없음"
    exit 0
fi

# 인자 확인
if [[ $# -lt 3 ]]; then
    echo "❌ 에러: 인자가 부족합니다."
    echo "사용법: $0 <type> <platform> <message>"
    echo "도움말: $0 --help"
    exit 1
fi

TYPE="$1"
PLATFORM="$2"
MESSAGE="$3"

# 유효성 검사
VALID_TYPES="post reply follow unfollow like dm other"
VALID_PLATFORMS="x threads blog telegram all"

if [[ ! " $VALID_TYPES " =~ " $TYPE " ]]; then
    echo "⚠️ 경고: 알 수 없는 활동 유형: $TYPE"
fi

if [[ ! " $VALID_PLATFORMS " =~ " $PLATFORM " ]]; then
    echo "⚠️ 경고: 알 수 없는 플랫폼: $PLATFORM"
fi

# 타임스탬프
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# 로그 포맷
LOG_ENTRY="[$TIMESTAMP] [$TYPE] [$PLATFORM] $MESSAGE"

# 로그 디렉토리 생성
mkdir -p "$(dirname "$LOG_PATH")"

# 파일에 기록
echo "$LOG_ENTRY" >> "$LOG_PATH"
echo "✅ 로그 기록: $LOG_ENTRY"

# DB 저장 옵션
if $SAVE_TO_DB; then
    if [[ -f "$DB_PATH" ]]; then
        sqlite3 "$DB_PATH" \
            "INSERT INTO event_queue (queue_type, platform, event_type, status, created_at)
             VALUES ('log', '$PLATFORM', '$TYPE', 'done', datetime('now'))"
        echo "   📊 DB에도 저장됨"
    fi
fi
