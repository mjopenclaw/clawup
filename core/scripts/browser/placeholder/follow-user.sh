#!/bin/bash
# follow-user.sh - Placeholder: 유저 팔로우
# Usage: ./follow-user.sh <platform> <username>

PLATFORM="${1:-}"
USERNAME="${2:-}"

if [[ -z "$PLATFORM" || -z "$USERNAME" ]]; then
  echo '{"error": "platform and username required"}'
  exit 1
fi

echo "👤 [Placeholder] 팔로우 예정: $USERNAME ($PLATFORM)"
echo '{"success": true, "placeholder": true}'
exit 0
