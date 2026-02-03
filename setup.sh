#!/bin/bash
# OpenClaw Framework Setup Script
# 프레임워크를 초기화하고 필요한 디렉터리/파일을 생성합니다.

set -e

echo "🦞 OpenClaw Framework Setup"
echo "================================"
echo ""

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 체크 함수
check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 found"
        return 0
    else
        echo -e "${RED}✗${NC} $1 not found"
        return 1
    fi
}

# 입력 함수
prompt() {
    local varname=$1
    local message=$2
    local default=$3

    if [ -n "$default" ]; then
        read -p "$(echo -e ${BLUE}$message${NC} [$default]: )" value
        eval "$varname=\"${value:-$default}\""
    else
        read -p "$(echo -e ${BLUE}$message${NC}: )" value
        eval "$varname=\"$value\""
    fi
}

# === Phase 1: 의존성 체크 ===
echo -e "${YELLOW}1. 의존성 체크${NC}"
echo ""

MISSING_DEPS=0

check_command "sqlite3" || MISSING_DEPS=1
check_command "node" || MISSING_DEPS=1

# OpenClaw 체크 (선택적)
if command -v "openclaw" &> /dev/null; then
    echo -e "${GREEN}✓${NC} openclaw found"
else
    echo -e "${YELLOW}!${NC} openclaw not found (optional)"
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo -e "${RED}필수 의존성이 없습니다. 먼저 설치해주세요.${NC}"
    exit 1
fi

echo ""

# === Phase 2: 디렉터리 구조 생성 ===
echo -e "${YELLOW}2. 디렉터리 구조 생성${NC}"
echo ""

# 핵심 디렉터리
directories=(
    "config"
    "state"
    "memory"
    "memory/daily"
    "memory/learnings"
    "memory/plans"
    "data"
    "modules/shared/tone"
    "modules/shared/validator"
    "modules/shared/approval"
    "modules/shared/dashboard"
    "modules/shared/transformer"
    "modules/sns/channels"
    "modules/sns/actions"
    "modules/sns/pipelines"
    "modules/income/sources"
    "modules/income/discovery"
    "modules/income/health-checks"
    "modules/evolution/learners"
    "modules/evolution/analyzers"
    "modules/evolution/planners"
    "core/scripts/browser/x"
    "core/scripts/browser/threads"
)

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "${GREEN}✓${NC} Created $dir"
    else
        echo -e "${BLUE}○${NC} Exists $dir"
    fi
done

echo ""

# === Phase 3: 설정 파일 생성 ===
echo -e "${YELLOW}3. 설정 파일 초기화${NC}"
echo ""

# config.yaml 복사 (없으면)
if [ ! -f "config/config.yaml" ] && [ -f "config/config.example.yaml" ]; then
    cp config/config.example.yaml config/config.yaml
    echo -e "${GREEN}✓${NC} Created config/config.yaml from example"
fi

# bounds.yaml 확인
if [ -f "config/bounds.yaml" ]; then
    echo -e "${GREEN}✓${NC} config/bounds.yaml exists"
else
    echo -e "${YELLOW}!${NC} config/bounds.yaml not found - creating default"
    # 기본 bounds.yaml은 이미 프레임워크에 포함됨
fi

# channels.yaml 확인
if [ -f "config/channels.yaml" ]; then
    echo -e "${GREEN}✓${NC} config/channels.yaml exists"
else
    echo -e "${YELLOW}!${NC} config/channels.yaml not found"
fi

echo ""

# === Phase 4: State 파일 초기화 ===
echo -e "${YELLOW}4. State 파일 초기화${NC}"
echo ""

# rules.yaml 확인
if [ -f "state/rules.yaml" ]; then
    echo -e "${GREEN}✓${NC} state/rules.yaml exists"
else
    echo -e "${YELLOW}!${NC} state/rules.yaml not found"
fi

# strategies.yaml 확인
if [ -f "state/strategies.yaml" ]; then
    echo -e "${GREEN}✓${NC} state/strategies.yaml exists"
else
    echo -e "${YELLOW}!${NC} state/strategies.yaml not found"
fi

# experiments.yaml 확인
if [ -f "state/experiments.yaml" ]; then
    echo -e "${GREEN}✓${NC} state/experiments.yaml exists"
else
    echo -e "${YELLOW}!${NC} state/experiments.yaml not found"
fi

echo ""

# === Phase 5: DB 초기화 ===
echo -e "${YELLOW}5. 데이터베이스 초기화${NC}"
echo ""

DB_PATH="data/agent.db"

# 기존 스키마 적용
if [ -f "data/schema.sql" ]; then
    sqlite3 "$DB_PATH" < data/schema.sql
    echo -e "${GREEN}✓${NC} Applied data/schema.sql"
fi

if [ -f "data/sns-schema.sql" ]; then
    sqlite3 "$DB_PATH" < data/sns-schema.sql
    echo -e "${GREEN}✓${NC} Applied data/sns-schema.sql"
fi

# Evolution 스키마 적용
if [ -f "core/schema/evolution.sql" ]; then
    sqlite3 "$DB_PATH" < core/schema/evolution.sql
    echo -e "${GREEN}✓${NC} Applied core/schema/evolution.sql"
fi

# 마이그레이션 적용
for migration in core/schema/migrations/*.sql; do
    if [ -f "$migration" ]; then
        sqlite3 "$DB_PATH" < "$migration" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Applied $migration"
    fi
done

# 트리거 적용
if [ -f "core/schema/triggers.sql" ]; then
    sqlite3 "$DB_PATH" < core/schema/triggers.sql 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Applied core/schema/triggers.sql"
fi

echo ""

# === Phase 6: Memory 파일 생성 ===
echo -e "${YELLOW}6. Memory 파일 생성${NC}"
echo ""

# MEMORY.md 생성 (없으면)
if [ ! -f "memory/MEMORY.md" ]; then
    cat > memory/MEMORY.md << 'EOF'
# MEMORY.md - 장기 기억

*세션마다 리셋되는 나를 위한 영속 메모리*

---

## 📝 핵심 원칙

*(중요한 교훈, 인사이트 기록)*

---

## 🎯 현재 목표

*(진행 중인 목표와 진행 상황)*

---

## 📊 학습된 규칙

*(실험과 분석을 통해 검증된 규칙들)*

---

## 🔬 진행 중인 실험

*(현재 진행 중인 실험들)*

---

*이 파일은 중요한 것을 배울 때마다 업데이트*
EOF
    echo -e "${GREEN}✓${NC} Created memory/MEMORY.md"
else
    echo -e "${BLUE}○${NC} memory/MEMORY.md exists"
fi

# 대시보드 초기화 (없으면)
if [ ! -f "memory/dashboard.md" ]; then
    cat > memory/dashboard.md << 'EOF'
# 📊 활동 대시보드

> 아직 데이터가 없습니다. 활동 후 자동 생성됩니다.

---

*이 파일은 매일 자동으로 업데이트됩니다.*
EOF
    echo -e "${GREEN}✓${NC} Created memory/dashboard.md"
else
    echo -e "${BLUE}○${NC} memory/dashboard.md exists"
fi

echo ""

# === Phase 7: .gitkeep 파일 생성 ===
echo -e "${YELLOW}7. .gitkeep 파일 생성${NC}"
echo ""

touch memory/daily/.gitkeep
touch memory/learnings/.gitkeep
touch memory/plans/.gitkeep
touch data/.gitkeep

echo -e "${GREEN}✓${NC} Created .gitkeep files"

echo ""

# === Phase 8: 모듈 검증 ===
echo -e "${YELLOW}8. 모듈 검증${NC}"
echo ""

# 핵심 모듈 파일 체크
core_modules=(
    "modules/shared/tone/casual.yaml"
    "modules/shared/validator/similarity.yaml"
    "modules/shared/validator/forbidden.yaml"
    "modules/shared/approval/telegram.yaml"
    "modules/sns/channels/x.yaml"
    "modules/sns/actions/post.yaml"
    "modules/sns/pipelines/engagement.yaml"
    "modules/evolution/learners/docs-learner.yaml"
)

MODULE_COUNT=0
for module in "${core_modules[@]}"; do
    if [ -f "$module" ]; then
        echo -e "${GREEN}✓${NC} $module"
        ((MODULE_COUNT++))
    else
        echo -e "${YELLOW}!${NC} $module not found"
    fi
done

echo ""
echo -e "   핵심 모듈: ${MODULE_COUNT}/${#core_modules[@]} 존재"

echo ""

# === 완료 ===
echo "================================"
echo -e "${GREEN}🎉 설정 완료!${NC}"
echo ""

echo "프레임워크 구조:"
echo "├── config/          설정 파일 (bounds, channels)"
echo "├── state/           학습된 규칙 및 실험"
echo "├── modules/         자동화 모듈"
echo "│   ├── shared/      공유 서비스 (톤, 검증, 승인)"
echo "│   ├── sns/         SNS 자동화"
echo "│   ├── income/      수익 모듈"
echo "│   └── evolution/   자가 발전"
echo "├── memory/          장기 기억"
echo "├── data/            런타임 데이터 (DB)"
echo "└── core/            불변 코드"
echo ""

echo "다음 단계:"
echo "1. config/config.yaml 검토 및 수정"
echo "2. config/bounds.yaml 확인 (안전 경계)"
echo "3. config/channels.yaml에서 SNS 계정 설정"
echo "4. OpenClaw 시작!"
echo ""

# 대화형 설정 (선택)
echo -e "${BLUE}대화형 설정을 시작하시겠습니까? (y/N)${NC}"
read -r INTERACTIVE

if [[ "$INTERACTIVE" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}기본 정보${NC}"
    prompt AGENT_NAME "에이전트 이름" "My AI Assistant"
    prompt X_HANDLE "X 핸들 (@username)"
    prompt THREADS_HANDLE "Threads 핸들"

    echo ""
    echo -e "${YELLOW}텔레그램 설정${NC}"
    prompt TG_BOT_TOKEN "텔레그램 봇 토큰"
    prompt TG_CHAT_ID "텔레그램 채팅 ID"

    echo ""
    echo "설정을 config/config.yaml에 반영하시겠습니까? (y/N)"
    read -r APPLY

    if [[ "$APPLY" =~ ^[Yy]$ ]]; then
        # config.yaml 업데이트 로직 (sed 사용)
        if [ -n "$AGENT_NAME" ]; then
            sed -i '' "s/name: \".*\"/name: \"$AGENT_NAME\"/" config/config.yaml 2>/dev/null || true
        fi
        if [ -n "$X_HANDLE" ]; then
            sed -i '' "s/handle: \"@.*\"/handle: \"$X_HANDLE\"/" config/config.yaml 2>/dev/null || true
        fi
        echo -e "${GREEN}✓${NC} 설정이 업데이트되었습니다."
    fi
fi

echo ""
echo -e "${GREEN}Setup complete!${NC} 🦞"
