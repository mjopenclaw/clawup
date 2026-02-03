#!/bin/bash
# 민제님께 텔레그램 요청 보내기
# Usage: ./request-to-mj.sh "제목" "이유" "급함(low/medium/high)" "필요한정보"

BOT_TOKEN="8570226873:AAFpYRf4RA2e8RWj2lLD3_QZOWEeuJrviuE"
CHAT_ID="8365694200"

TITLE="$1"
REASON="$2"
URGENCY="${3:-medium}"
INFO_NEEDED="$4"

# 급함 이모지
case "$URGENCY" in
  low)    URGENCY_EMOJI="🟢" ;;
  medium) URGENCY_EMOJI="🟡" ;;
  high)   URGENCY_EMOJI="🔴" ;;
  *)      URGENCY_EMOJI="🟡" ;;
esac

MESSAGE="🔔 *[REQUEST]* 민제님, 필요한 게 있어요!

━━━━━━━━━━━━━━
📋 *요청:* ${TITLE}
📝 *이유:* ${REASON}
${URGENCY_EMOJI} *급함:* ${URGENCY}
━━━━━━━━━━━━━━

📌 *필요한 정보:*
${INFO_NEEDED}

━━━━━━━━━━━━━━
💬 inbox/에 정보 남겨주시거나 여기 답장해주세요!"

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  -d "text=${MESSAGE}" \
  -d "parse_mode=Markdown" \
  > /dev/null

echo "✓ Request sent to 민제님: ${TITLE}"
