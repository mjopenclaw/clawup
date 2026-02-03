#!/bin/bash
# 자원 체크 스크립트
# 사용: source check-resources.sh && can_run

# CPU 사용률 (macOS)
get_cpu() {
  top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | tr -d '%' | cut -d. -f1
}

# 메모리 사용률 (macOS)  
get_mem() {
  memory_pressure | grep "System-wide memory free percentage" | awk '{print 100 - $NF}' | cut -d. -f1
}

# 실행 가능 여부 체크
can_run() {
  CPU=$(get_cpu 2>/dev/null || echo "0")
  MEM=$(get_mem 2>/dev/null || echo "0")
  
  if [ "$CPU" -gt 80 ]; then
    echo "⚠️ CPU 과부하: ${CPU}%"
    return 1
  fi
  
  if [ "$MEM" -gt 90 ]; then
    echo "⚠️ 메모리 부족: ${MEM}%"
    return 1
  fi
  
  echo "✅ 자원 OK (CPU: ${CPU}%, MEM: ${MEM}%)"
  return 0
}

# 현재 상태 출력
show_status() {
  CPU=$(get_cpu 2>/dev/null || echo "?")
  MEM=$(get_mem 2>/dev/null || echo "?")
  PROCS=$(ps aux | wc -l)
  
  echo "🖥️ 시스템 상태"
  echo "  CPU: ${CPU}%"
  echo "  MEM: ${MEM}%"
  echo "  프로세스: ${PROCS}"
}

# 직접 실행시 상태 출력
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  show_status
  can_run
fi
