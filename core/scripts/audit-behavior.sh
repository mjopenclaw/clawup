#!/bin/bash
# 행동 감사 스크립트
# 에이전트의 행동을 검증하고 문제점을 보고

set -e

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
TODAY=$(date +%Y-%m-%d)
ISSUES=0

echo "🔍 행동 감사 시작: $TODAY"
echo "================================"

# 1. 메모리 파일 체크
echo -e "\n${YELLOW}1. 메모리 관리${NC}"
if [ -f "$WORKSPACE/memory/$TODAY.md" ]; then
    LINES=$(wc -l < "$WORKSPACE/memory/$TODAY.md")
    echo -e "${GREEN}✓${NC} 오늘 일지 존재 ($LINES 줄)"
else
    echo -e "${RED}✗${NC} 오늘 일지 없음 - 기록 필요"
    ((ISSUES++))
fi

if [ -f "$WORKSPACE/memory/MEMORY.md" ]; then
    DAYS_OLD=$(( ($(date +%s) - $(stat -f %m "$WORKSPACE/memory/MEMORY.md" 2>/dev/null || stat -c %Y "$WORKSPACE/memory/MEMORY.md" 2>/dev/null || echo 0)) / 86400 ))
    if [ "$DAYS_OLD" -gt 7 ]; then
        echo -e "${YELLOW}!${NC} MEMORY.md가 ${DAYS_OLD}일 전 수정됨 - 업데이트 권장"
    else
        echo -e "${GREEN}✓${NC} MEMORY.md 최근 업데이트됨"
    fi
else
    echo -e "${RED}✗${NC} MEMORY.md 없음"
    ((ISSUES++))
fi

# 2. 피드백 반영 체크
echo -e "\n${YELLOW}2. 피드백 반영${NC}"
if [ -f "$WORKSPACE/memory/feedback-log.md" ]; then
    PENDING=$(grep -c "applied: false" "$WORKSPACE/memory/feedback-log.md" 2>/dev/null || echo 0)
    if [ "$PENDING" -gt 0 ]; then
        echo -e "${RED}✗${NC} 미반영 피드백 ${PENDING}개"
        ((ISSUES++))
    else
        echo -e "${GREEN}✓${NC} 모든 피드백 반영됨"
    fi
else
    echo -e "${GREEN}✓${NC} 피드백 로그 없음 (정상)"
fi

# 3. Cron 효율성 체크
echo -e "\n${YELLOW}3. Cron 효율성${NC}"
CRON_COUNT=$(openclaw cron list 2>/dev/null | jq 'length' 2>/dev/null || echo "?")
if [ "$CRON_COUNT" != "?" ]; then
    if [ "$CRON_COUNT" -gt 10 ]; then
        echo -e "${YELLOW}!${NC} Cron ${CRON_COUNT}개 - 통합 검토 권장"
    else
        echo -e "${GREEN}✓${NC} Cron ${CRON_COUNT}개 (적정)"
    fi
else
    echo -e "${YELLOW}?${NC} Cron 상태 확인 불가"
fi

# 4. 시스템 리소스 체크
echo -e "\n${YELLOW}4. 시스템 리소스${NC}"
if [ -f "$WORKSPACE/core/scripts/check-system.sh" ]; then
    CPU=$("$WORKSPACE/core/scripts/check-system.sh" 2>/dev/null | grep CPU | awk '{print $2}' | tr -d '%' || echo "?")
    MEM=$("$WORKSPACE/core/scripts/check-system.sh" 2>/dev/null | grep Memory | awk '{print $2}' | tr -d '%' || echo "?")
    
    if [ "$CPU" != "?" ] && [ "${CPU%.*}" -gt 80 ]; then
        echo -e "${RED}✗${NC} CPU 높음: ${CPU}%"
        ((ISSUES++))
    else
        echo -e "${GREEN}✓${NC} CPU: ${CPU}%"
    fi
    
    if [ "$MEM" != "?" ] && [ "${MEM%.*}" -gt 85 ]; then
        echo -e "${RED}✗${NC} 메모리 높음: ${MEM}%"
        ((ISSUES++))
    else
        echo -e "${GREEN}✓${NC} Memory: ${MEM}%"
    fi
else
    echo -e "${YELLOW}?${NC} 시스템 체크 스크립트 없음"
fi

# 5. SSOT 체크 (중복 정의 감지)
echo -e "\n${YELLOW}5. SSOT 준수${NC}"
# components 폴더의 mdx 파일들이 존재하는지
if [ -d "$WORKSPACE/core/components" ]; then
    COMPONENT_COUNT=$(find "$WORKSPACE/core/components" -name "*.mdx" | wc -l | tr -d ' ')
    echo -e "${GREEN}✓${NC} 컴포넌트 ${COMPONENT_COUNT}개 관리 중"
else
    echo -e "${YELLOW}!${NC} 컴포넌트 폴더 없음"
fi

# 결과 요약
echo ""
echo "================================"
if [ "$ISSUES" -eq 0 ]; then
    echo -e "${GREEN}✅ 감사 완료: 문제 없음${NC}"
else
    echo -e "${RED}⚠️ 감사 완료: ${ISSUES}개 문제 발견${NC}"
fi

# JSON 출력 옵션
if [ "$1" == "--json" ]; then
    echo ""
    cat <<EOF
{
  "date": "$TODAY",
  "issues": $ISSUES,
  "status": "$([ $ISSUES -eq 0 ] && echo 'ok' || echo 'issues')"
}
EOF
fi

exit $ISSUES
