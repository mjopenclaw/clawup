#!/bin/bash
# X-Threads 동기화 검증
# 불일치 발견 시 알림

DB_PATH="$HOME/projects/openclaw-framework/data/sns.db"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# X에만 있는 포스트 수
X_ONLY=$(sqlite3 "$DB_PATH" "
SELECT COUNT(*) FROM posts x 
WHERE x.platform = 'x' 
AND NOT EXISTS (
  SELECT 1 FROM posts t 
  WHERE t.platform = 'threads' 
  AND t.content = x.content
);")

# Threads에만 있는 포스트 수
THREADS_ONLY=$(sqlite3 "$DB_PATH" "
SELECT COUNT(*) FROM posts t 
WHERE t.platform = 'threads' 
AND NOT EXISTS (
  SELECT 1 FROM posts x 
  WHERE x.platform = 'x' 
  AND x.content = t.content
);")

if [ "$X_ONLY" -gt 0 ] || [ "$THREADS_ONLY" -gt 0 ]; then
  echo "⚠️ 불일치 발견: X만 $X_ONLY개, Threads만 $THREADS_ONLY개"
  
  # 알림
  "$SCRIPT_DIR/notify.sh" "alert" "sync" "⚠️ X-Threads 불일치: X만 ${X_ONLY}개, Threads만 ${THREADS_ONLY}개"
  exit 1
else
  echo "✅ X-Threads 동기화 정상"
  exit 0
fi
