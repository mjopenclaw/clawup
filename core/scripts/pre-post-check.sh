#!/bin/bash
# 포스팅 전 체크 스크립트
# 통과하면 exit 0, 실패하면 exit 1

DB=~/projects/openclaw-framework/data/sns.db
CONTENT="$1"

if [ -z "$CONTENT" ]; then
  echo "❌ 콘텐츠 없음"
  exit 1
fi

# 1. 24시간 내 비슷한 글 체크
SIMILAR=$(sqlite3 "$DB" "
  SELECT COUNT(*) FROM posts 
  WHERE created_at > datetime('now', '-24 hours')
  AND content LIKE '%${CONTENT:0:30}%'
")

if [ "$SIMILAR" -gt 0 ]; then
  echo "❌ 24시간 내 비슷한 글 있음"
  exit 1
fi

# 2. 비율 체크 (conversation 60% 이상 유지)
CONV_RATIO=$(sqlite3 "$DB" "
  SELECT COALESCE(
    (SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue WHERE posted=0)
     FROM content_queue WHERE posted=0 AND source='conversation'), 0
  )
")

# 3. 금지어 체크
if echo "$CONTENT" | grep -qiE "🦞|Moreover|crucial|Great question|합니다$"; then
  echo "❌ 금지어 포함"
  exit 1
fi

# 4. 큐 개수 체크 (10개 초과 시 경고)
QUEUE_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM content_queue WHERE posted=0")
if [ "$QUEUE_COUNT" -gt 10 ]; then
  echo "⚠️ 큐 ${QUEUE_COUNT}개 (정리 필요)"
fi

echo "✅ 체크 통과"
exit 0
