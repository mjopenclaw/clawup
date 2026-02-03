# 📊 SNS.DB 스키마 관리

## 구조

```
schema/
├── triggers.sql       # 자동 실행 트리거
├── migrations/        # 스키마 변경 마이그레이션
│   ├── 001_add_indexes.sql
│   └── 002_add_constraints.sql
├── queries/           # 자주 사용하는 쿼리
│   ├── maintenance.sql   # 유지보수 쿼리 (Cron용)
│   └── stats.sql         # 통계/분석 쿼리
└── README.md
```

## 트리거 목록

### 1. 중복 방지
| 트리거 | 테이블 | 설명 |
|--------|--------|------|
| `prevent_duplicate_content` | content_queue | 같은 콘텐츠 중복 추가 방지 |
| `prevent_duplicate_post_url` | posts | 같은 URL 중복 방지 |

### 2. 자동 계산
| 트리거 | 테이블 | 설명 |
|--------|--------|------|
| `calc_engagement_rate_insert` | post_analytics | INSERT 시 engagement_rate 계산 |
| `calc_engagement_rate_update` | post_analytics | UPDATE 시 engagement_rate 재계산 |
| `calc_progress_pct_insert` | goal_progress | INSERT 시 progress_pct 계산 |
| `calc_progress_pct_update` | goal_progress | UPDATE 시 progress_pct 재계산 |

### 3. 데이터 정합성
| 트리거 | 테이블 | 설명 |
|--------|--------|------|
| `normalize_posts_insert` | posts | 필수 필드 검증 |
| `normalize_content_queue_insert` | content_queue | 날짜 포맷 표준화 |
| `normalize_event_queue` | event_queue | 기본값 설정 |
| `extract_post_time_info` | post_analytics | 시간 정보 자동 추출 |

### 4. updated_at 자동 갱신
| 트리거 | 테이블 |
|--------|--------|
| `update_post_analytics_timestamp` | post_analytics |
| `update_projects_timestamp` | projects |
| `update_resources_timestamp` | resources |

## 사용법

### 트리거 적용
```bash
sqlite3 ~/projects/openclaw-framework/data/sns.db < triggers.sql
```

### 마이그레이션 적용
```bash
# 순서대로 실행
sqlite3 ~/projects/openclaw-framework/data/sns.db < migrations/001_add_indexes.sql
sqlite3 ~/projects/openclaw-framework/data/sns.db < migrations/002_add_constraints.sql
```

### 유지보수 쿼리 (Cron)
```bash
# 매일 새벽 4시 실행 권장
sqlite3 ~/projects/openclaw-framework/data/sns.db < queries/maintenance.sql
```

### 통계 쿼리
```bash
# 리포트 생성 시 사용
sqlite3 ~/projects/openclaw-framework/data/sns.db < queries/stats.sql
```

## 주의사항

1. **마이그레이션은 순서대로** - 번호 순서 지키기
2. **백업 먼저** - 마이그레이션 전 `cp sns.db sns.db.bak`
3. **트리거는 멱등성** - 여러 번 실행해도 안전 (DROP IF EXISTS)
4. **002 마이그레이션** - 테이블 재생성하므로 주의
