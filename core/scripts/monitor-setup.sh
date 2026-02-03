#!/bin/bash
# SNS 모니터링 봇 설정
# Usage: ./monitor-setup.sh

BOT_TOKEN="8570226873:AAFpYRf4RA2e8RWj2lLD3_QZOWEeuJrviuE"
CONFIG_FILE="$HOME/projects/openclaw-framework/config/monitor.env"

echo "🔧 SNS 모니터링 봇 설정"
echo ""
echo "1. 텔레그램에서 이 봇에게 /start 메시지를 보내세요:"
echo "   https://t.me/$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe" | jq -r '.result.username')"
echo ""
echo "2. 메시지를 보낸 후 Enter를 누르세요..."
read

# chat_id 가져오기
CHAT_ID=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates" | jq -r '.result[-1].message.chat.id')

if [ -z "$CHAT_ID" ] || [ "$CHAT_ID" == "null" ]; then
  echo "❌ chat_id를 가져올 수 없습니다. 봇에 메시지를 보냈는지 확인하세요."
  exit 1
fi

# 설정 파일 저장
mkdir -p "$(dirname "$CONFIG_FILE")"
echo "# SNS Monitor Config" > "$CONFIG_FILE"
echo "SNS_MONITOR_CHAT_ID=\"${CHAT_ID}\"" >> "$CONFIG_FILE"

echo ""
echo "✅ 설정 완료!"
echo "   Chat ID: ${CHAT_ID}"
echo "   Config: ${CONFIG_FILE}"

# 테스트 메시지 전송
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  -d "text=🎉 SNS 모니터링 봇이 연결되었습니다!" \
  > /dev/null

echo ""
echo "📱 테스트 메시지를 전송했습니다. 텔레그램을 확인하세요!"
