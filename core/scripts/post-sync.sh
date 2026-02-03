#!/bin/bash
# X-Threads 동기화 포스팅
# 반드시 양쪽 다 올리거나 둘 다 안 올림

set -e  # 에러 시 중단

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="$HOME/projects/openclaw-framework/data/sns.db"

CONTENT="$1"
if [ -z "$CONTENT" ]; then
  echo "Usage: post-sync.sh \"content\""
  exit 1
fi

# 1. 먼저 DB에 pending 상태로 기록
QUEUE_ID=$(sqlite3 "$DB_PATH" "
  INSERT INTO content_queue (content, platform, posted) VALUES ('$(echo "$CONTENT" | sed "s/'/''/g")', 'both', 0);
  SELECT last_insert_rowid();
")

echo "📝 Queue ID: $QUEUE_ID"

# 2. X 포스팅 (여기서 실제 브라우저/API 호출)
# TODO: 실제 X 포스팅 로직
X_RESULT="pending"

# 3. Threads 포스팅
# TODO: 실제 Threads 포스팅 로직
THREADS_RESULT="pending"

# 4. 둘 다 성공해야 완료 처리
if [ "$X_RESULT" = "success" ] && [ "$THREADS_RESULT" = "success" ]; then
  sqlite3 "$DB_PATH" "UPDATE content_queue SET posted = 1 WHERE id = $QUEUE_ID;"
  
  # 양쪽 posts 테이블에 기록
  sqlite3 "$DB_PATH" "INSERT INTO posts (platform, content) VALUES ('x', '$(echo "$CONTENT" | sed "s/'/''/g")');"
  sqlite3 "$DB_PATH" "INSERT INTO posts (platform, content) VALUES ('threads', '$(echo "$CONTENT" | sed "s/'/''/g")');"
  
  # 알림
  "$SCRIPT_DIR/notify.sh" "post" "x+threads" "$CONTENT"
  
  echo "✅ 양쪽 포스팅 완료"
else
  echo "❌ 포스팅 실패 — 롤백"
  sqlite3 "$DB_PATH" "UPDATE content_queue SET posted = -1 WHERE id = $QUEUE_ID;"
  exit 1
fi
