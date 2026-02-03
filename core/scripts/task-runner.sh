#!/bin/zsh
# task-runner.sh - Task YAML 실행기 (모듈 추상화 지원)
# Usage: ./task-runner.sh <task-name> [args...]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
TASK_NAME="${1:-}"
shift 2>/dev/null || true
TASK_ARGS="$@"

DB_PATH="${DB_PATH:-$FRAMEWORK_DIR/data/sns.db}"
MODULES_FILE="$FRAMEWORK_DIR/config/modules.yaml"

# 변수 저장소 (전역)
typeset -A VARS

# ===== 헬퍼 함수 =====

log() {
  echo "[$(date '+%H:%M:%S')] $1"
}

# 모듈 경로 해석
resolve_module() {
  local MODULE_PATH="$1"
  local MODULE_TYPE=$(echo "$MODULE_PATH" | cut -d'.' -f1)
  local ACTION=$(echo "$MODULE_PATH" | cut -d'.' -f2)
  
  local PROVIDER=$(yq ".$MODULE_TYPE.provider" "$MODULES_FILE")
  local SCRIPT_PATH=$(yq ".$MODULE_TYPE.actions.$ACTION.$PROVIDER" "$MODULES_FILE")
  
  echo "$FRAMEWORK_DIR/$SCRIPT_PATH"
}

# 변수 치환 (${var.field} → 실제 값)
substitute_vars() {
  local TEXT="$1"
  local KEY VAL
  
  for KEY in ${(k)VARS}; do
    VAL="${VARS[$KEY]}"
    # 특수문자 이스케이프
    VAL="${VAL//\\/\\\\}"
    TEXT="${TEXT//\$\{$KEY\}/$VAL}"
  done
  
  echo "$TEXT"
}

# SQL 실행 & 결과 파싱
run_sql() {
  local QUERY="$1"
  local OUTPUT_VAR="$2"
  
  QUERY=$(substitute_vars "$QUERY")
  
  # 결과를 탭 구분으로 가져오기 (JSON 파싱 문제 회피)
  local RESULT COLS
  
  # 컬럼명 + 데이터를 탭 구분으로 가져오기
  local RAW=$(sqlite3 -separator '	' -header "$DB_PATH" "$QUERY" 2>/dev/null)
  COLS=$(echo "$RAW" | head -1)
  RESULT=$(echo "$RAW" | sed -n '2p')
  
  if [[ -n "$OUTPUT_VAR" && -n "$RESULT" ]]; then
    # 컬럼별로 파싱 (탭 구분)
    local i=1
    local COL_ARRAY=(${(s:	:)COLS})
    local VAL_ARRAY=(${(s:	:)RESULT})
    
    for COL in $COL_ARRAY; do
      local VAL="${VAL_ARRAY[$i]}"
      # 줄바꿈 제거
      VAL="${VAL//$'\n'/ }"
      VARS[$OUTPUT_VAR.$COL]="$VAL"
      ((i++))
    done
    VARS[$OUTPUT_VAR]="$RESULT"
  fi
  
  # SELECT: 결과 있으면 성공, UPDATE/INSERT: 실행되면 성공
  if [[ -n "$OUTPUT_VAR" ]]; then
    [[ -n "$RESULT" ]]
  else
    return 0  # UPDATE/INSERT는 항상 성공
  fi
}

# ===== 메인 로직 =====

if [[ -z "$TASK_NAME" ]]; then
  echo "Usage: $0 <task-name> [args...]"
  echo ""
  echo "Available tasks:"
  ls -1 "$FRAMEWORK_DIR/core/tasks/"*.yaml 2>/dev/null | xargs -I{} basename {} .yaml
  exit 1
fi

TASK_FILE="$FRAMEWORK_DIR/core/tasks/${TASK_NAME}.yaml"

if [[ ! -f "$TASK_FILE" ]]; then
  echo "❌ Task not found: $TASK_FILE"
  exit 1
fi

log "🔧 Task: $TASK_NAME"

# yq, jq 체크
for CMD in yq jq; do
  if ! command -v $CMD &>/dev/null; then
    echo "❌ $CMD not installed. Install: brew install $CMD"
    exit 1
  fi
done

# enabled 체크
ENABLED=$(yq '.enabled // true' "$TASK_FILE")
if [[ "$ENABLED" != "true" ]]; then
  log "⏭️ Task disabled"
  exit 0
fi

# ===== Preconditions 체크 =====
log "🔍 Checking preconditions..."

PRECONDITIONS=$(yq -o=json '.preconditions // []' "$TASK_FILE")
PRECOND_COUNT=$(echo "$PRECONDITIONS" | jq 'length')
PRECOND_PASSED=true

for ((i=0; i<PRECOND_COUNT; i++)); do
  PRECOND=$(echo "$PRECONDITIONS" | jq -c ".[$i]")
  TYPE=$(echo "$PRECOND" | jq -r '.type')
  
  if [[ "$TYPE" == "sql" ]]; then
    QUERY=$(echo "$PRECOND" | jq -r '.query')
    EXPECT=$(echo "$PRECOND" | jq -r '.expect // ""')
    
    RESULT=$(sqlite3 "$DB_PATH" "$QUERY" 2>/dev/null | head -1)
    
    if [[ -n "$EXPECT" ]]; then
      if [[ "$EXPECT" == *">"* ]]; then
        THRESHOLD=$(echo "$EXPECT" | grep -oE '[0-9]+$')
        if [[ "$RESULT" -le "$THRESHOLD" ]]; then
          log "  ⏭️ Precondition failed: $EXPECT (got $RESULT)"
          PRECOND_PASSED=false
          break
        fi
      elif [[ "$EXPECT" == *"<"* ]]; then
        THRESHOLD=$(echo "$EXPECT" | grep -oE '[0-9]+$')
        if [[ "$RESULT" -ge "$THRESHOLD" ]]; then
          log "  ⏭️ Precondition failed: $EXPECT (got $RESULT)"
          PRECOND_PASSED=false
          break
        fi
      fi
    fi
  fi
done

if [[ "$PRECOND_PASSED" != "true" ]]; then
  log "⏭️ Preconditions not met, skipping task"
  exit 0
fi

log "✅ Preconditions passed"

# ===== Steps 실행 =====
log "🚀 Running steps..."

STEPS=$(yq -o=json '.steps // []' "$TASK_FILE")
STEP_COUNT=$(echo "$STEPS" | jq 'length')
TASK_SUCCESS=true

for ((i=0; i<STEP_COUNT; i++)); do
  STEP=$(echo "$STEPS" | jq -c ".[$i]")
  STEP_NAME=$(echo "$STEP" | jq -r '.name // "step-'$i'"')
  STEP_TYPE=$(echo "$STEP" | jq -r '.type')
  ON_FAIL=$(echo "$STEP" | jq -r '.on_fail // "stop"')
  OUTPUT_VAR=$(echo "$STEP" | jq -r '.output // ""')
  CONDITION=$(echo "$STEP" | jq -r '.condition // ""')
  
  log "  → $STEP_NAME ($STEP_TYPE)"
  
  # condition 체크
  if [[ -n "$CONDITION" && "$CONDITION" != "null" ]]; then
    COND_RESULT=$(substitute_vars "$CONDITION")
    if [[ "$COND_RESULT" == "false" || "$COND_RESULT" == "0" ]]; then
      log "    ⏭️ Condition not met, skipping"
      continue
    fi
  fi
  
  STEP_RESULT=0
  
  case "$STEP_TYPE" in
    sql)
      QUERY=$(echo "$STEP" | jq -r '.query')
      run_sql "$QUERY" "$OUTPUT_VAR" || STEP_RESULT=$?
      ;;
      
    script|shell)
      COMMAND=$(echo "$STEP" | jq -r '.command')
      ARGS_RAW=$(echo "$STEP" | jq -r '.args // [] | .[]')
      ARGS=""
      while IFS= read -r ARG; do
        [[ -n "$ARG" ]] && ARGS="$ARGS \"$(substitute_vars "$ARG")\""
      done <<< "$ARGS_RAW"
      
      FULL_CMD="$FRAMEWORK_DIR/$COMMAND"
      if [[ -f "$FULL_CMD" ]]; then
        OUTPUT=$(eval "\"$FULL_CMD\" $ARGS" 2>&1) || STEP_RESULT=$?
      else
        OUTPUT=$(eval "$(substitute_vars "$COMMAND") $ARGS" 2>&1) || STEP_RESULT=$?
      fi
      
      if [[ -n "$OUTPUT_VAR" && -n "$OUTPUT" ]]; then
        VARS[$OUTPUT_VAR]="$OUTPUT"
      fi
      ;;
      
    module)
      MODULE_PATH=$(echo "$STEP" | jq -r '.module')
      ARGS_RAW=$(echo "$STEP" | jq -r '.args // [] | .[]')
      ARGS=""
      while IFS= read -r ARG; do
        [[ -n "$ARG" ]] && ARGS="$ARGS \"$(substitute_vars "$ARG")\""
      done <<< "$ARGS_RAW"
      
      RESOLVED_SCRIPT=$(resolve_module "$MODULE_PATH")
      
      if [[ -f "$RESOLVED_SCRIPT" ]]; then
        OUTPUT=$(eval "\"$RESOLVED_SCRIPT\" $ARGS" 2>&1) || STEP_RESULT=$?
        
        if [[ -n "$OUTPUT_VAR" && -n "$OUTPUT" ]]; then
          VARS[$OUTPUT_VAR]="$OUTPUT"
        fi
      else
        log "    ⚠️ Module not found: $RESOLVED_SCRIPT"
        STEP_RESULT=1
      fi
      ;;
      
    *)
      log "    ⚠️ Unknown step type: $STEP_TYPE"
      STEP_RESULT=1
      ;;
  esac
  
  if [[ $STEP_RESULT -ne 0 ]]; then
    log "    ❌ Step failed (exit $STEP_RESULT)"
    
    case "$ON_FAIL" in
      stop)
        TASK_SUCCESS=false
        break
        ;;
      skip)
        log "    ⏭️ Skipping remaining steps"
        break
        ;;
      continue)
        ;;
    esac
  else
    log "    ✅ OK"
  fi
done

# ===== 후처리 =====
if [[ "$TASK_SUCCESS" == "true" ]]; then
  log "✅ Task completed: $TASK_NAME"
  
  ON_SUCCESS=$(yq -o=json '.on_success // []' "$TASK_FILE")
  SUCCESS_COUNT=$(echo "$ON_SUCCESS" | jq 'length')
  
  for ((i=0; i<SUCCESS_COUNT; i++)); do
    ACTION=$(echo "$ON_SUCCESS" | jq -c ".[$i]")
    ACTION_TYPE=$(echo "$ACTION" | jq -r '.type')
    
    case "$ACTION_TYPE" in
      sql)
        QUERY=$(echo "$ACTION" | jq -r '.query')
        QUERY=$(substitute_vars "$QUERY")
        sqlite3 "$DB_PATH" "$QUERY" 2>/dev/null || true
        ;;
      notify)
        MSG=$(echo "$ACTION" | jq -r '.message')
        log "📢 $(substitute_vars "$MSG")"
        ;;
      log)
        MSG=$(echo "$ACTION" | jq -r '.message')
        log "$(substitute_vars "$MSG")"
        ;;
    esac
  done
else
  log "❌ Task failed: $TASK_NAME"
  VARS[error]="Step failed"
  
  ON_FAILURE=$(yq -o=json '.on_failure // []' "$TASK_FILE")
  FAILURE_COUNT=$(echo "$ON_FAILURE" | jq 'length')
  
  for ((i=0; i<FAILURE_COUNT; i++)); do
    ACTION=$(echo "$ON_FAILURE" | jq -c ".[$i]")
    ACTION_TYPE=$(echo "$ACTION" | jq -r '.type')
    
    case "$ACTION_TYPE" in
      sql)
        QUERY=$(echo "$ACTION" | jq -r '.query')
        QUERY=$(substitute_vars "$QUERY")
        sqlite3 "$DB_PATH" "$QUERY" 2>/dev/null || true
        ;;
      log)
        MSG=$(echo "$ACTION" | jq -r '.message')
        log "$(substitute_vars "$MSG")"
        ;;
    esac
  done
  
  exit 1
fi
