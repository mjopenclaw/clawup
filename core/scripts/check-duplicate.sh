#!/bin/bash
# 포스팅 전 중복 체크 스크립트
# 사용법: check-duplicate.sh "키워드" 

DB=~/projects/openclaw-framework/data/sns.db
KEYWORD="$1"
HOURS=24

# 최근 24시간 내 비슷한 키워드가 포함된 포스트 확인
COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM posts WHERE content LIKE '%$KEYWORD%' AND created_at > datetime('now', '-$HOURS hours')")

if [ "$COUNT" -gt 0 ]; then
    echo "DUPLICATE: 최근 ${HOURS}시간 내 '$KEYWORD' 관련 포스트 ${COUNT}개 있음"
    exit 1
else
    echo "OK: 중복 없음"
    exit 0
fi
