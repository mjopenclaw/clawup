#!/bin/bash
# Framework 동기화 (MDX → AGENTS.md)

TEMPLATE=/Users/mj-molt/projects/openclaw-framework/core/AGENTS.template.mdx
CONFIG=/Users/mj-molt/projects/openclaw-framework/config/config.yaml
DB=/Users/mj-molt/projects/openclaw-framework/data/sns.db
OUTDIR=/Users/mj-molt/.openclaw/workspace
OUTPUT=$OUTDIR/AGENTS.md

# 컴파일
mdx compile "$TEMPLATE" --context "$CONFIG" --db "$DB" -o "$OUTDIR" 2>/dev/null

# 파일명 수정
if [ -f "$OUTDIR/AGENTS.template.md" ]; then
  mv "$OUTDIR/AGENTS.template.md" "$OUTPUT"
  echo "✅ AGENTS.md 동기화 완료 ($(date '+%H:%M:%S'))"
else
  echo "❌ 컴파일 실패"
  exit 1
fi
