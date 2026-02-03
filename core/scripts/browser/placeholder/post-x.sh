#!/bin/bash
# post-x.sh - Placeholder: X 포스팅 (나중에 Playwright로 교체)
# Usage: ./post-x.sh "content"

CONTENT="${1:-}"

if [[ -z "$CONTENT" ]]; then
  echo '{"error": "content required"}'
  exit 1
fi

echo "📝 [Placeholder] X 포스팅 예정: ${CONTENT:0:50}..."

# TODO: 민제님이 Playwright 버전 만들면 교체
# 현재는 성공 리턴만
echo '{"success": true, "placeholder": true, "message": "Playwright 모듈 대기 중"}'
exit 0
