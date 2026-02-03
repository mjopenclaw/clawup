#!/bin/bash
# check-similarity-placeholder.sh - Placeholder: 유사도 체크
# 실제 구현 전까지 항상 통과
# Usage: ./check-similarity-placeholder.sh "content"

CONTENT="${1:-}"

if [[ -z "$CONTENT" ]]; then
  echo "⚠️ [Placeholder] 콘텐츠 없음"
  exit 0  # 통과 처리
fi

echo "🔍 [Placeholder] 유사도 체크: ${CONTENT:0:30}..."
echo '{"similar": false, "max_similarity": 0, "placeholder": true}'
exit 0  # 항상 통과
