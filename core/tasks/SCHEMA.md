# Task YAML Schema

## 기본 구조

```yaml
name: task-name           # 필수
description: 설명          # 선택
enabled: true             # 기본 true

# 실행 전 조건 (모두 통과해야 실행)
preconditions:
  - type: sql
    query: "SELECT COUNT(*) > 0 FROM content_queue WHERE posted=0"
  - type: shell
    command: "test -f /path/to/file"

# 실행 단계 (순차)
steps:
  - name: step-name
    type: shell | sql | script
    command: "명령어"      # shell/script일 때
    query: "쿼리"          # sql일 때
    args: []               # 선택
    on_fail: stop | skip | continue  # 기본 stop

# 성공 시 후처리
on_success:
  - type: sql
    query: "UPDATE ... SET status='done'"
  - type: notify
    message: "완료"

# 실패 시 후처리
on_failure:
  - type: log
    message: "실패: ${error}"
```

## 변수

- `${config.xxx}` — config.yaml에서
- `${db.xxx}` — DB 쿼리 결과에서
- `${arg.xxx}` — 호출 시 전달된 인자
- `${env.xxx}` — 환경변수
- `${error}` — 에러 메시지

## 예시

```yaml
name: post-content
description: 콘텐츠 큐에서 가져와 X+Threads에 포스팅

preconditions:
  - type: sql
    query: "SELECT COUNT(*) as cnt FROM content_queue WHERE posted=0"
    expect: "cnt > 0"
  - type: sql  
    query: "SELECT COUNT(*) as cnt FROM posts WHERE date(created_at)=date('now')"
    expect: "cnt < 6"

steps:
  - name: get-content
    type: sql
    query: "SELECT id, content FROM content_queue WHERE posted=0 ORDER BY priority DESC LIMIT 1"
    output: content

  - name: check-duplicate
    type: script
    command: "scripts/check-similarity.py"
    args: ["${content.content}"]
    on_fail: skip

  - name: post-x
    type: script
    command: "scripts/browser/post-x.js"
    args: ["${content.content}"]

  - name: post-threads
    type: script
    command: "scripts/browser/post-threads.js"  
    args: ["${content.content}"]

  - name: mark-posted
    type: sql
    query: "UPDATE content_queue SET posted=1 WHERE id=${content.id}"

on_success:
  - type: sql
    query: "INSERT INTO posts (platform, content) VALUES ('x', '${content.content}')"
  - type: notify
    message: "✅ 포스팅 완료"

on_failure:
  - type: log
    message: "❌ 포스팅 실패: ${error}"
```
