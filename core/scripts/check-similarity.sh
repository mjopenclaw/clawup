#!/bin/bash
# 콘텐츠 유사도 체크 래퍼 스크립트
# TF-IDF + 코사인 유사도로 중복 검사
#
# Usage:
#   check-similarity.sh "새 콘텐츠 텍스트"
#   check-similarity.sh --file content.txt
#   echo "콘텐츠" | check-similarity.sh
#
# Exit codes:
#   0: 유사도 60% 미만 (업로드 가능)
#   1: 유사도 60% 이상 (중복 - 업로드 차단)
#   2: 에러

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRAMEWORK_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
VENV_DIR="$FRAMEWORK_DIR/.venv"
PYTHON_SCRIPT="$SCRIPT_DIR/check-similarity.py"

# venv 체크
if [ ! -d "$VENV_DIR" ]; then
    echo "ERROR: venv가 없습니다. 먼저 설정해주세요:" >&2
    echo "  cd $FRAMEWORK_DIR && python3 -m venv .venv && source .venv/bin/activate && pip install scikit-learn" >&2
    exit 2
fi

# venv 활성화 후 Python 스크립트 실행
source "$VENV_DIR/bin/activate"
python "$PYTHON_SCRIPT" "$@"
exit_code=$?
deactivate 2>/dev/null
exit $exit_code
