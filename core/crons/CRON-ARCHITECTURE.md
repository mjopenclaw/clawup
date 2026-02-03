# 🔄 Goal-Driven Cron Architecture

> 모든 Cron은 목표를 달성하기 위해 존재한다.

## 핵심 원칙

**각 Cron = 하나의 Goal을 향한 자율 에이전트**

```
┌─────────────────────────────────────────────────────────┐
│                    GOAL-DRIVEN CRON                      │
├─────────────────────────────────────────────────────────┤
│  1. PLAN      → 현재 상태 확인, 목표까지 거리 계산        │
│  2. RESEARCH  → 최적 전략/방법 탐색                      │
│  3. EXECUTE   → 실제 작업 수행                          │
│  4. FEEDBACK  → 결과 측정, DB 기록                      │
│  5. RETRY     → 실패 시 다른 방법으로 재시도             │
└─────────────────────────────────────────────────────────┘
```

## Cron 실행 흐름

```
[Trigger] 
    │
    ▼
┌─────────┐    실패     ┌─────────┐
│  PLAN   │ ─────────▶ │  SKIP   │  (이미 목표 달성 or 리소스 부족)
└────┬────┘            └─────────┘
     │ 진행
     ▼
┌──────────┐   정보 부족  ┌──────────┐
│ RESEARCH │ ◀────────── │ EXECUTE  │
└────┬─────┘             └────┬─────┘
     │ 충분               성공│ │실패
     ▼                       ▼ ▼
┌──────────┐           ┌──────────┐
│ EXECUTE  │           │ FEEDBACK │
└────┬─────┘           └────┬─────┘
     │                      │
     ▼                      ▼
┌──────────┐           ┌─────────┐
│ FEEDBACK │           │  RETRY  │ (최대 3회, 다른 전략으로)
└──────────┘           └─────────┘
```

## Cron 템플릿 (Payload)

```yaml
goal_cron:
  goal_id: "x_followers"           # config.yaml의 goals에서 참조
  max_duration_minutes: 55         # 1시간 미만 강제
  
  plan:
    check_current: true            # 현재 값 DB에서 조회
    check_resources: true          # CPU/메모리 체크
    skip_if_achieved: true         # 목표 달성 시 스킵
    
  research:
    enabled: true
    sources:                       # 리서치 소스
      - "web_search"
      - "memory_search"
      - "db_query"
    cache_hours: 24                # 리서치 결과 캐싱
    
  execute:
    strategies:                    # 순서대로 시도
      - "strategy_1"
      - "strategy_2"
    timeout_minutes: 30
    
  feedback:
    measure_after_minutes: 5       # 실행 후 N분 뒤 측정
    record_to_db: true
    notify_on_success: true
    notify_on_failure: true
    
  retry:
    max_attempts: 3
    backoff_minutes: [5, 15, 30]   # 재시도 간격
    change_strategy: true          # 실패 시 다른 전략 시도
```

## 표준 Cron 목록

### Core Loops (10분마다)

| ID | Goal | 설명 |
|----|------|------|
| `posting-executor` | 콘텐츠 배포 | Queue에서 꺼내서 X+Threads 포스팅 |
| `engagement-watcher` | 상호작용 | 멘션/답글 감지 → 응답 큐 |
| `metrics-collector` | 데이터 수집 | 팔로워/좋아요/RT 수집 → DB |

### Daily

| ID | Goal | 시간 |
|----|------|------|
| `morning-planner` | 일일 계획 | 09:00 |
| `evening-analyzer` | 성과 분석 | 22:00 |
| `content-generator` | 콘텐츠 생성 | 14:00 |

### Weekly

| ID | Goal | 시간 |
|----|------|------|
| `strategy-reviewer` | 전략 검토 | 일 20:00 |
| `framework-improver` | 프레임워크 개선 | 월 04:00 |

## 데이터 기반 의사결정

모든 Cron은 **숫자로 판단**:

```sql
-- 예: 포스팅 전략 선택
SELECT strategy, AVG(engagement_rate) as avg_eng
FROM post_analytics
WHERE posted_at > date('now', '-7 days')
GROUP BY strategy
ORDER BY avg_eng DESC
LIMIT 1;
```

```sql
-- 예: 최적 포스팅 시간
SELECT strftime('%H', posted_at) as hour, AVG(likes) as avg_likes
FROM post_analytics
WHERE posted_at > date('now', '-30 days')
GROUP BY hour
ORDER BY avg_likes DESC
LIMIT 3;
```

## 이식성 (Portability)

프레임워크를 다른 사람에게 이식할 때:

1. `config/config.yaml` 만 수정
2. DB 스키마는 자동 생성
3. Cron payload는 goal_id로 연결 → config 바뀌면 자동 적용

```yaml
# 새 사용자 config.yaml
goals:
  x_followers:
    target: 500          # 자신의 목표로 변경
    strategies:
      - "자신만의 전략"
```

→ Cron들은 그대로, 목표만 다르게 동작

## 메트릭 테이블 (필수)

```sql
CREATE TABLE IF NOT EXISTS cron_runs (
  id INTEGER PRIMARY KEY,
  cron_id TEXT NOT NULL,
  goal_id TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  phase TEXT,           -- plan/research/execute/feedback/retry
  status TEXT,          -- success/failed/skipped
  result_json TEXT,     -- 상세 결과
  retry_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS goal_progress (
  id INTEGER PRIMARY KEY,
  goal_id TEXT NOT NULL,
  measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  current_value REAL,
  target_value REAL,
  progress_pct REAL,    -- (current/target) * 100
  notes TEXT
);
```

## 실행 예시

```
[posting-executor 실행]

1. PLAN
   - Queue 확인: 11개 pending
   - 리소스: CPU 15%, OK
   - 목표: 일일 3개 포스팅 (현재 0개)
   → 진행

2. RESEARCH
   - 최적 시간: 지금 OK (22:00-02:00 고engagement)
   - 최근 성과 좋은 주제: "OpenClaw 팁"
   → 관련 콘텐츠 우선 선택

3. EXECUTE
   - Queue에서 "OpenClaw 팁" 콘텐츠 선택
   - X 포스팅 완료
   - Threads 포스팅 완료
   → 성공

4. FEEDBACK
   - post_id 기록
   - 5분 후 engagement 체크 예약
   - 텔레그램 알림 전송
   → 완료

5. (RETRY 불필요)
```

---

*이 아키텍처는 민제님이 쓰고, AI가 발전시키고, 누구에게나 이식 가능하도록 설계됨.*
