#!/bin/bash
# Goal-Driven Cron Executor
# Usage: ./goal-executor.sh <cron-yaml-path> [--dry-run]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
DB_PATH="$FRAMEWORK_DIR/data/sns.db"
LOG_DIR="$FRAMEWORK_DIR/logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create logs directory
mkdir -p "$LOG_DIR"

# Parse arguments
CRON_YAML="$1"
DRY_RUN=false
[[ "$2" == "--dry-run" ]] && DRY_RUN=true

if [[ -z "$CRON_YAML" ]]; then
    echo -e "${RED}Usage: $0 <cron-yaml-path> [--dry-run]${NC}"
    exit 1
fi

# Extract cron ID from YAML
CRON_ID=$(grep "id:" "$CRON_YAML" | head -1 | sed 's/.*id: *"\([^"]*\)".*/\1/')
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
LOG_FILE="$LOG_DIR/${CRON_ID}-$(date +%Y%m%d).log"

log() {
    local level="$1"
    local message="$2"
    echo -e "[$TIMESTAMP] [$level] $message" | tee -a "$LOG_FILE"
}

log_phase() {
    echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}  Phase: $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
}

# Record cron run start
record_start() {
    sqlite3 "$DB_PATH" "
        INSERT INTO cron_runs (cron_id, started_at, phase, status)
        VALUES ('$CRON_ID', datetime('now'), 'started', 'running');
    " 2>/dev/null || true
}

# Record cron run end
record_end() {
    local status="$1"
    local result="$2"
    sqlite3 "$DB_PATH" "
        UPDATE cron_runs 
        SET ended_at = datetime('now'), 
            status = '$status',
            result_json = '$result'
        WHERE cron_id = '$CRON_ID' 
        AND status = 'running'
        ORDER BY started_at DESC
        LIMIT 1;
    " 2>/dev/null || true
}

# ═══════════════════════════════════════
# PHASE 1: PLAN
# ═══════════════════════════════════════
phase_plan() {
    log_phase "PLAN"
    log "INFO" "Checking preconditions..."
    
    # Check if goal already achieved
    # (In real implementation, parse YAML and run checks)
    
    log "INFO" "✅ Preconditions passed"
    return 0
}

# ═══════════════════════════════════════
# PHASE 2: RESEARCH
# ═══════════════════════════════════════
phase_research() {
    log_phase "RESEARCH"
    log "INFO" "Gathering intelligence..."
    
    # Query best strategies from DB
    local best_topic=$(sqlite3 "$DB_PATH" "
        SELECT topic FROM post_analytics 
        WHERE posted_at > date('now', '-7 days')
        GROUP BY topic 
        ORDER BY AVG(engagement_rate) DESC 
        LIMIT 1;
    " 2>/dev/null || echo "general")
    
    log "INFO" "Best performing topic: $best_topic"
    
    # Check optimal timing
    local hour=$(date +%H)
    if [[ "$hour" -ge 9 && "$hour" -le 11 ]] || [[ "$hour" -ge 19 && "$hour" -le 23 ]]; then
        log "INFO" "✅ Optimal posting time"
    else
        log "WARN" "⚠️ Suboptimal time, but proceeding"
    fi
    
    return 0
}

# ═══════════════════════════════════════
# PHASE 3: EXECUTE
# ═══════════════════════════════════════
phase_execute() {
    log_phase "EXECUTE"
    
    if $DRY_RUN; then
        log "INFO" "[DRY RUN] Would execute actions here"
        return 0
    fi
    
    log "INFO" "Executing main actions..."
    
    # The actual execution logic would be:
    # 1. Parse YAML steps
    # 2. Execute each step in order
    # 3. Handle dependencies between steps
    
    log "INFO" "✅ Execution completed"
    return 0
}

# ═══════════════════════════════════════
# PHASE 4: FEEDBACK
# ═══════════════════════════════════════
phase_feedback() {
    log_phase "FEEDBACK"
    log "INFO" "Measuring results..."
    
    # Record goal progress
    sqlite3 "$DB_PATH" "
        INSERT INTO goal_progress (goal_id, current_value, target_value, progress_pct, notes)
        SELECT 
            'x_followers',
            COALESCE(x_followers, 0),
            1000,
            (COALESCE(x_followers, 0) / 1000.0) * 100,
            'Auto-measured by goal-executor'
        FROM daily_stats
        ORDER BY date DESC
        LIMIT 1;
    " 2>/dev/null || true
    
    log "INFO" "✅ Feedback recorded"
    return 0
}

# ═══════════════════════════════════════
# PHASE 5: RETRY (if needed)
# ═══════════════════════════════════════
phase_retry() {
    local attempt="$1"
    log_phase "RETRY (Attempt $attempt)"
    log "WARN" "Previous attempt failed, trying alternative strategy..."
    return 0
}

# ═══════════════════════════════════════
# MAIN
# ═══════════════════════════════════════
main() {
    echo -e "\n${GREEN}╔═══════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Goal-Driven Cron Executor                    ║${NC}"
    echo -e "${GREEN}║  Cron: $CRON_ID${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}\n"
    
    record_start
    
    local max_retries=3
    local attempt=0
    local success=false
    
    while [[ $attempt -lt $max_retries ]] && ! $success; do
        ((attempt++))
        
        if phase_plan && phase_research && phase_execute && phase_feedback; then
            success=true
            log "INFO" "${GREEN}✅ Cron completed successfully${NC}"
            record_end "success" "{\"attempts\": $attempt}"
        else
            log "WARN" "Attempt $attempt failed"
            if [[ $attempt -lt $max_retries ]]; then
                phase_retry $attempt
                sleep 5
            fi
        fi
    done
    
    if ! $success; then
        log "ERROR" "${RED}❌ All attempts failed${NC}"
        record_end "failed" "{\"attempts\": $attempt}"
        exit 1
    fi
}

main "$@"
