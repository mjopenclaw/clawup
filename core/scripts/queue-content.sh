#!/bin/bash
# queue-content.sh - 콘텐츠 큐에 추가
# Usage: ./queue-content.sh <content> [--platform x|threads] [--schedule TIME] [--help]

set -e

DB_PATH="${DB_PATH:-$HOME/projects/openclaw-framework/data/sns.db}"

show_help() {
    cat << EOF
사용법: $0 <content> [옵션]

콘텐츠를 포스팅 큐에 추가

인자:
    content     포스팅할 콘텐츠 (필수)

옵션:
    -p, --platform PLATFORM   대상 플랫폼 (x, threads, all, 기본: all)
    -s, --schedule TIME       예약 시간 (YYYY-MM-DD HH:MM 형식)
    --source SOURCE           콘텐츠 출처 (research, manual, ai)
    --priority N              우선순위 (1-10, 기본: 5)
    -f, --force               중복 체크 스킵 (강제 추가)
    -h, --help                이 도움말 표시

예시:
    $0 "OpenClaw 팁: 자동화하면 시간 절약!"
    $0 "쓰레드용 콘텐츠" -p threads
    $0 "예약 포스트" -s "2024-01-15 19:00"
    $0 "AI 생성 콘텐츠" --source ai --priority 8
EOF
    exit 0
}

# 기본값
PLATFORM="all"
SCHEDULE=""
SOURCE="manual"
PRIORITY=5
CONTENT=""
FORCE=false

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--platform) PLATFORM="$2"; shift 2 ;;
        -s|--schedule) SCHEDULE="$2"; shift 2 ;;
        --source) SOURCE="$2"; shift 2 ;;
        --priority) PRIORITY="$2"; shift 2 ;;
        --force|-f) FORCE=true; shift ;;
        -h|--help) show_help ;;
        -*) echo "알 수 없는 옵션: $1"; exit 1 ;;
        *) 
            if [[ -z "$CONTENT" ]]; then
                CONTENT="$1"
            else
                CONTENT="$CONTENT $1"
            fi
            shift ;;
    esac
done

# 콘텐츠 확인
if [[ -z "$CONTENT" ]]; then
    echo "❌ 에러: 콘텐츠를 입력해주세요."
    echo "사용법: $0 <content> [옵션]"
    echo "도움말: $0 --help"
    exit 1
fi

# DB 확인
if [[ ! -f "$DB_PATH" ]]; then
    echo "❌ 에러: DB 파일이 없습니다: $DB_PATH"
    exit 1
fi

# === 중복 체크 (TF-IDF + 코사인 유사도) ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIMILARITY_SCRIPT="$SCRIPT_DIR/check-similarity.sh"

if [[ "$FORCE" == "false" ]] && [[ -x "$SIMILARITY_SCRIPT" ]]; then
    echo "🔍 중복 체크 중..."
    if ! "$SIMILARITY_SCRIPT" "$CONTENT"; then
        echo ""
        echo "⛔ 업로드 차단: 유사한 콘텐츠가 이미 존재합니다."
        echo "   다른 내용으로 작성하거나, --force 옵션으로 강제 추가할 수 있습니다."
        exit 1
    fi
    echo ""
elif [[ "$FORCE" == "true" ]]; then
    echo "⚠️ --force: 중복 체크 스킵"
else
    echo "⚠️ 경고: 중복 체크 스크립트를 찾을 수 없습니다. 스킵합니다."
fi

# 콘텐츠 이스케이프
ESCAPED_CONTENT=$(echo "$CONTENT" | sed "s/'/''/g")

# 스케줄 처리
if [[ -n "$SCHEDULE" ]]; then
    # 날짜 형식 검증
    if ! date -j -f "%Y-%m-%d %H:%M" "$SCHEDULE" >/dev/null 2>&1; then
        echo "⚠️ 경고: 날짜 형식이 잘못됐을 수 있습니다. (권장: YYYY-MM-DD HH:MM)"
    fi
    SCHEDULE_SQL="'$SCHEDULE'"
else
    SCHEDULE_SQL="NULL"
fi

# 큐에 추가
sqlite3 "$DB_PATH" << EOF
INSERT INTO content_queue (content, platform, scheduled_at, source, posted, created_at)
VALUES ('$ESCAPED_CONTENT', '$PLATFORM', $SCHEDULE_SQL, '$SOURCE', 0, datetime('now'));
EOF

# 추가된 ID 확인
NEW_ID=$(sqlite3 "$DB_PATH" "SELECT last_insert_rowid()")

echo "✅ 콘텐츠가 큐에 추가되었습니다!"
echo ""
echo "📋 상세 정보:"
echo "   ID: $NEW_ID"
echo "   플랫폼: $PLATFORM"
echo "   출처: $SOURCE"
if [[ -n "$SCHEDULE" ]]; then
    echo "   예약: $SCHEDULE"
else
    echo "   예약: 즉시 (다음 Executor 실행 시)"
fi
echo ""
echo "   내용: ${CONTENT:0:100}$([ ${#CONTENT} -gt 100 ] && echo '...')"
echo ""
echo "💡 큐 확인: ./check-queue.sh"
