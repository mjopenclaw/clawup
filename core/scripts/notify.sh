#!/bin/bash
# SNS 활동 텔레그램 알림
# Usage: ./notify.sh "활동 타입" "플랫폼" "내용"

BOT_TOKEN="8570226873:AAFpYRf4RA2e8RWj2lLD3_QZOWEeuJrviuE"
CHAT_ID="${SNS_MONITOR_CHAT_ID:-}"  # 환경변수 또는 아래서 설정

# chat_id가 없으면 설정 파일에서 읽기
if [ -z "$CHAT_ID" ]; then
  CONFIG_FILE="$HOME/projects/openclaw-framework/config/monitor.env"
  if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
    CHAT_ID="$SNS_MONITOR_CHAT_ID"
  fi
fi

if [ -z "$CHAT_ID" ]; then
  echo "Error: CHAT_ID not set. Run setup first."
  exit 1
fi

ACTION_TYPE="$1"  # post, follow, reply, like, retweet
PLATFORM="$2"     # x, threads
CONTENT="$3"      # 내용

# 이모지 매핑
case "$ACTION_TYPE" in
  post)    EMOJI="📝" ;;
  follow)  EMOJI="👤" ;;
  reply)   EMOJI="💬" ;;
  like)    EMOJI="❤️" ;;
  retweet) EMOJI="🔄" ;;
  unfollow) EMOJI="👋" ;;
  *)       EMOJI="📌" ;;
esac

# 플랫폼 이모지
case "$PLATFORM" in
  x|twitter) PLATFORM_EMOJI="𝕏" ;;
  threads)   PLATFORM_EMOJI="🧵" ;;
  *)         PLATFORM_EMOJI="📱" ;;
esac

# 메시지 포맷
TIMESTAMP=$(date "+%H:%M")
ACTION_UPPER=$(echo "$ACTION_TYPE" | tr '[:lower:]' '[:upper:]')
MESSAGE="${EMOJI} ${PLATFORM_EMOJI} *${ACTION_UPPER}*
━━━━━━━━━━━━━━
${CONTENT}
━━━━━━━━━━━━━━
🕐 ${TIMESTAMP}"

# 텔레그램 전송 (URL 인코딩으로 특수문자/줄바꿈 처리)
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=${MESSAGE}" \
  --data-urlencode "parse_mode=Markdown" \
  > /dev/null

echo "✓ Notified: ${ACTION_TYPE} on ${PLATFORM}"
