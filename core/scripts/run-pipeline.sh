#!/bin/bash
# run-pipeline.sh - Cron에서 호출하는 파이프라인 실행기
# Usage: ./run-pipeline.sh <pipeline-name>

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PIPELINE_NAME="${1:-growth}"

cd "$FRAMEWORK_DIR"

echo "🔄 [$(date '+%H:%M:%S')] Pipeline: $PIPELINE_NAME"

# 1. mdx compile 먼저 (항상 최신 상태 보장)
echo "📝 Compiling AGENTS.md..."
mdx compile core/AGENTS.template.mdx \
  --context config/config.yaml \
  --db data/sns.db \
  -o ~/.openclaw/workspace/AGENTS.md 2>/dev/null || true

# 2. Pipeline 실행
PIPELINE_FILE="core/pipelines/${PIPELINE_NAME}.mdx"

if [[ ! -f "$PIPELINE_FILE" ]]; then
  echo "❌ Pipeline not found: $PIPELINE_FILE"
  exit 1
fi

echo "🚀 Running pipeline..."
# TODO: mdx run 구현 필요
# 현재는 task-runner.sh로 개별 task 실행
# mdx run "$PIPELINE_FILE" --db data/sns.db --config config/config.yaml

echo "✅ Pipeline completed"
