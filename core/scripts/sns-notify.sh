#!/bin/bash
# SNS 활동 알림 + DB 기록
# Usage: sns-notify.sh <action> <platform> <content> [url]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMEWORK_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
DB_PATH="$FRAMEWORK_DIR/data/sns.db"

ACTION="$1"
PLATFORM="$2"
CONTENT="$3"
URL="${4:-}"

# 1. 텔레그램 알림
"$SCRIPT_DIR/notify.sh" "$ACTION" "$PLATFORM" "$CONTENT"

# 2. DB 기록
case "$ACTION" in
  post)
    sqlite3 "$DB_PATH" "INSERT INTO posts (platform, content, url) VALUES ('$PLATFORM', '$(echo "$CONTENT" | sed "s/'/''/g")', '$URL')"
    ;;
  follow)
    sqlite3 "$DB_PATH" "INSERT INTO follows (platform, username) VALUES ('$PLATFORM', '$(echo "$CONTENT" | sed "s/'/''/g")')"
    ;;
  unfollow)
    sqlite3 "$DB_PATH" "UPDATE follows SET unfollowed_at = datetime('now') WHERE platform = '$PLATFORM' AND username = '$(echo "$CONTENT" | sed "s/'/''/g")' AND unfollowed_at IS NULL"
    ;;
esac

echo "✓ Logged to sns.db"
