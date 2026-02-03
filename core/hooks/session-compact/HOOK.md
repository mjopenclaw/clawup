---
name: session-compact
description: "세션 종료 시 대화를 요약해서 SQLite에 저장. 새 세션에서 context 복구용."
metadata: {"openclaw":{"emoji":"🧠","events":["command:new","command:reset"]}}
---

# Session Compact Hook

대화 context를 잃어버리지 않도록 세션 종료 시 자동으로 요약 저장.

## What It Does

1. `/new` 또는 `/reset` 시 트리거
2. 이전 대화에서 핵심 내용 추출:
   - 요약 (summary)
   - 주요 주제 (topics)
   - 결정사항 (decisions)
   - 할 일 (todos)
3. SQLite DB에 저장 (`~/.openclaw/workspace/context.db`)

## DB Schema

```sql
CREATE TABLE session_summaries (
  id INTEGER PRIMARY KEY,
  session_key TEXT,
  summary TEXT,
  topics TEXT,
  decisions TEXT,
  todos TEXT,
  created_at DATETIME,
  message_count INTEGER,
  source TEXT
);
```

## Usage

새 세션 시작 시 `memory_search`로 최근 context 조회:
```
SELECT summary, topics, decisions, todos 
FROM session_summaries 
ORDER BY created_at DESC 
LIMIT 5
```
