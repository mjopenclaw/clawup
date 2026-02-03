#!/bin/bash
# Cron 작업 감사 스크립트
# OpenClaw cron 상태 확인 및 분석

set -e

# OpenClaw cron list 실행
CRON_OUTPUT=$(openclaw cron list 2>/dev/null || echo "[]")

# JSON 파싱 (jq 사용 가능 시)
if command -v jq &> /dev/null; then
    CRON_COUNT=$(echo "$CRON_OUTPUT" | jq 'length' 2>/dev/null || echo "0")
    ACTIVE_COUNT=$(echo "$CRON_OUTPUT" | jq '[.[] | select(.enabled == true)] | length' 2>/dev/null || echo "0")
    
    echo "Total Crons: $CRON_COUNT"
    echo "Active: $ACTIVE_COUNT"
    echo "---"
    
    # 각 cron 정보 출력
    echo "$CRON_OUTPUT" | jq -r '.[] | "\(.name // .id): \(if .enabled then "✅" else "❌" end)"' 2>/dev/null || true
else
    # jq 없으면 기본 출력
    echo "Cron list:"
    echo "$CRON_OUTPUT"
fi
