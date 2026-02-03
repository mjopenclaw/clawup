#!/bin/bash
# 시스템 상태 체크 스크립트
# 사용: ./check-system.sh [--json]

set -e

# CPU 사용량 (macOS/Linux 호환)
get_cpu() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        top -l 1 | grep "CPU usage" | awk '{print $3}' | tr -d '%'
    else
        grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {printf "%.1f", usage}'
    fi
}

# 메모리 사용량 (%)
get_memory() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        vm_stat | awk '
            /Pages active/ {active=$3}
            /Pages inactive/ {inactive=$3}
            /Pages wired/ {wired=$4}
            /Pages free/ {free=$3}
            END {
                used = (active + wired) * 16384
                total = (active + inactive + wired + free) * 16384
                printf "%.1f", (used/total)*100
            }
        ' | tr -d '.'
    else
        # Linux
        free | awk '/Mem:/ {printf "%.1f", $3/$2 * 100}'
    fi
}

# 디스크 사용량 (%)
get_disk() {
    df -h / | tail -1 | awk '{print $5}' | tr -d '%'
}

# 실행 중인 프로세스 수
get_processes() {
    ps aux | wc -l | tr -d ' '
}

# 시스템 가동 시간
get_uptime() {
    uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}'
}

CPU=$(get_cpu)
MEMORY=$(get_memory)
DISK=$(get_disk)
PROCESSES=$(get_processes)
UPTIME=$(get_uptime)

if [[ "$1" == "--json" ]]; then
    cat <<EOF
{
  "cpu": $CPU,
  "memory": $MEMORY,
  "disk": $DISK,
  "processes": $PROCESSES,
  "uptime": "$UPTIME",
  "timestamp": "$(date -Iseconds)"
}
EOF
else
    echo "CPU: ${CPU}%"
    echo "Memory: ${MEMORY}%"
    echo "Disk: ${DISK}%"
    echo "Processes: ${PROCESSES}"
    echo "Uptime: ${UPTIME}"
fi
