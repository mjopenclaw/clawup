/**
 * OpenClaw Framework - Type Definitions
 */

// ============================================
// Config Types
// ============================================

export interface Config {
  agent: AgentConfig;
  user: UserConfig;
  accounts: AccountsConfig;
  goals: Record<string, GoalConfig>;
  persona: PersonaConfig;
  content_style: ContentStyleConfig;
  system: SystemConfig;
  safety: SafetyConfig;
}

export interface AgentConfig {
  name: string;
  emoji: string;
  language: string;
  timezone: string;
}

export interface UserConfig {
  name: string;
  honorific: string;
}

export interface AccountsConfig {
  x?: PlatformAccount;
  threads?: PlatformAccount;
  telegram?: TelegramAccount;
}

export interface PlatformAccount {
  handle: string;
  enabled: boolean;
}

export interface TelegramAccount {
  monitor_bot_token: string;
  monitor_chat_id: string;
  enabled: boolean;
}

export interface GoalConfig {
  name: string;
  target: number;
  current: number;
  progress: number;
  metric: string;
  query?: string;
  priority: number;
  strategies: string[];
}

export interface PersonaConfig {
  tone: string;
  formality: string;
  traits: string[];
}

export interface ContentStyleConfig {
  preferred: string[];
  avoid: string[];
  rules: ContentRules;
  posting_pipeline: PostingPipelineConfig;
  research_to_content: ResearchToContentConfig;
  good_example: string;
  bad_example: string;
}

export interface ContentRules {
  min_length: number;
  max_emoji: number;
  require_perspective: boolean;
  require_hook: boolean;
  fomo_angle: boolean;
  no_compress: boolean;
  thread_if_long: boolean;
}

export interface PostingPipelineConfig {
  max_chars_per_post: number;
  if_exceeds: string;
  thread_connector: string;
}

export interface ResearchToContentConfig {
  batch_size: number;
  action: string;
  angle: string;
  prompt: string;
}

export interface SystemConfig {
  db_path: string;
  memory_dir: string;
  max_cron_jobs: number;
}

export interface SafetyConfig {
  require_confirmation: string[];
  blocked_commands: string[];
}

// ============================================
// Bounds Types
// ============================================

export interface Bounds {
  sns: SNSBounds;
  income: IncomeBounds;
  evolution: EvolutionBounds;
  system: SystemBounds;
}

export interface SNSBounds {
  posting: {
    max_per_day: number;
    min_interval_minutes: number;
    require_review_above_confidence: number;
  };
  engagement: {
    max_likes_per_day: number;
    max_follows_per_day: number;
    max_unfollows_per_day: number;
    max_comments_per_day: number;
    max_reposts_per_day: number;
    max_dms_per_day: number;
  };
  forbidden_topics: string[];
  forbidden_actions: string[];
}

export interface IncomeBounds {
  max_monthly_spend_usd: number;
  max_single_transaction_usd: number;
  forbidden_categories: string[];
  require_approval: string[];
}

export interface EvolutionBounds {
  confidence: {
    min_to_apply: number;
    auto_apply: number;
    require_approval: number;
  };
  experiments: {
    min_before_rule: number;
    max_concurrent: number;
    max_duration_days: number;
  };
  forbidden_modifications: string[];
  allowed_modifications: AllowedModification[];
}

export interface AllowedModification {
  path: string;
  constraints: string;
}

export interface SystemBounds {
  max_cron_jobs: number;
  max_api_calls_per_hour: number;
  max_llm_tokens_per_day: number;
  forbidden_commands: string[];
  require_confirmation: string[];
}

// ============================================
// Channel Types
// ============================================

export interface ChannelConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  auth: AuthConfig;
  content: ChannelContentConfig;
  actions: Record<string, ActionConfig>;
  metrics?: MetricConfig[];
  targeting?: TargetingConfig;
  cross_posting?: CrossPostingConfig;
}

export interface AuthConfig {
  method: 'browser' | 'api' | 'oauth';
  profile_name?: string;
  login_url?: string;
  home_url?: string;
}

export interface ChannelContentConfig {
  max_length: number;
  min_length?: number;
  tone_ref: string;
  language: string;
  hashtags?: HashtagConfig;
  media?: MediaConfig;
  thread?: ThreadConfig;
}

export interface HashtagConfig {
  enabled: boolean;
  max_count: number;
  position: 'start' | 'end' | 'inline';
  preferred?: string[];
}

export interface MediaConfig {
  images_allowed: boolean;
  max_images: number;
  videos_allowed: boolean;
  max_video_length_seconds: number;
  supported_formats: string[];
}

export interface ThreadConfig {
  supported: boolean;
  max_posts: number;
  connector: string;
  numbering_format?: string;
}

export interface ActionConfig {
  enabled: boolean;
  script: string;
  daily_limit?: number;
  cooldown_minutes?: number;
  selector?: string;
  use_llm?: boolean;
  bounds_ref?: string;
  pre_checks?: string[];
  require_review?: boolean;
  filter?: Record<string, unknown>;
}

export interface MetricConfig {
  id: string;
  name?: string;
  query: string;
}

export interface TargetingConfig {
  follow_targets?: FollowTargetConfig;
  engagement_targets?: EngagementTargetConfig;
}

export interface FollowTargetConfig {
  interests: string[];
  min_followers: number;
  max_followers: number;
  verified_preferred?: boolean;
  language?: string;
}

export interface EngagementTargetConfig {
  topics: string[];
  exclude_topics: string[];
  prefer_recent?: boolean;
}

export interface CrossPostingConfig {
  source_channels: string[];
  target_channels: string[];
  adapt_content: boolean;
  delay_minutes: number;
}

// ============================================
// Rules & State Types
// ============================================

export interface RulesState {
  version: number;
  last_updated: string;
  updated_by: string;
  timing: TimingRules;
  content: ContentRulesState;
  engagement: EngagementRules;
  hashtags: HashtagRules;
  pending_rules: PendingRule[];
  history: RuleHistoryEntry[];
}

export interface TimingRules {
  best_hours: number[];
  avoid_hours: number[];
  avoid_days: string[];
  confidence: number;
  experiments_count: number;
  last_experiment: string | null;
  reason: string;
}

export interface ContentRulesState {
  rules: ContentRule[];
}

export interface ContentRule {
  id: string;
  pattern: string;
  action: string;
  params?: Record<string, unknown>;
  confidence: number;
  experiments?: number;
  positive_results?: number;
  reason: string;
  created_at: string;
  last_validated?: string;
}

export interface EngagementRules {
  auto_follow_back: AutoFollowBackRule;
  reply: ReplyRule;
  like_targeting: LikeTargetingRule;
  repost: RepostRule;
}

export interface AutoFollowBackRule {
  enabled: boolean;
  filter: string;
  delay_minutes: number;
  confidence: number;
  reason: string;
}

export interface ReplyRule {
  style: string;
  delay_minutes: number;
  include_emoji: boolean;
  confidence: number;
}

export interface LikeTargetingRule {
  prefer_topics: string[];
  avoid_topics: string[];
  confidence: number;
}

export interface RepostRule {
  min_likes: number;
  min_quality_score: number;
  prefer_verified: boolean;
  confidence: number;
}

export interface HashtagRules {
  effective_combinations: string[][];
  avoid: string[];
  rules: HashtagRule[];
}

export interface HashtagRule {
  topic: string;
  tags: string[];
  confidence: number;
  avg_engagement_boost: number;
}

export interface PendingRule {
  id: string;
  pattern: string;
  action: string;
  confidence: number;
  experiments_needed: number;
}

export interface RuleHistoryEntry {
  timestamp: string;
  rule_id: string;
  action: 'created' | 'updated' | 'deleted';
  old_value: unknown;
  new_value: unknown;
  reason: string;
}

// ============================================
// Pipeline Types
// ============================================

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  schedule?: ScheduleConfig;
  conditions?: PipelineConditions;
  steps?: PipelineStep[];
  phases?: PipelinePhase[];
  on_complete?: PipelineAction[];
  on_error?: PipelineAction[];
  safety?: PipelineSafety;
  logging?: LoggingConfig;
}

export interface ScheduleConfig {
  cron: string;
  timezone: string;
  enabled: boolean;
}

export interface PipelineConditions {
  time_range?: TimeRange;
  system_checks?: string[];
  timing_check?: TimingCheck;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface TimingCheck {
  use_rules: boolean;
  rules_path: string;
  check: string;
  confidence_threshold: number;
}

export interface PipelineStep {
  name: string;
  action?: string;
  service?: string;
  script?: string;
  query?: string;
  input?: string;
  output?: string;
  params?: Record<string, unknown>;
  condition?: string;
  enabled?: string | boolean;
  on_fail?: OnFailAction;
  on_empty?: OnFailAction;
  for_each?: string;
  max_iterations?: number;
  steps?: PipelineStep[];
}

export interface PipelinePhase {
  name: string;
  description?: string;
  parallel?: boolean;
  depends_on?: string[];
  condition?: string;
  tasks: PipelineTask[];
}

export interface PipelineTask {
  action: string;
  input?: string;
  channels?: string[];
  params?: Record<string, unknown>;
  output?: string;
  use_llm?: boolean;
}

export interface OnFailAction {
  action: string;
  message?: string;
  max_retries?: number;
  service?: string;
  feedback?: string;
}

export interface PipelineAction {
  condition?: string;
  action: string;
  message?: string;
  channel?: string;
  log?: string;
  metric?: string;
  delay_hours?: number;
  task?: string;
  params?: Record<string, unknown>;
}

export interface PipelineSafety {
  rate_limits?: RateLimits;
  daily_limits?: DailyLimits;
  humanize?: HumanizeConfig;
}

export interface RateLimits {
  actions_per_minute: number;
  total_actions_per_run: number;
}

export interface DailyLimits {
  check_before_each_action: boolean;
  stop_on_limit_reached: boolean;
}

export interface HumanizeConfig {
  enabled: boolean;
  random_delays: boolean;
  delay_range_seconds: [number, number];
}

export interface LoggingConfig {
  log_runs?: boolean;
  log_path?: string;
  include_metrics?: boolean;
  include_content?: boolean;
  log_generated_content?: boolean;
}

// ============================================
// Tone Types
// ============================================

export interface ToneConfig {
  tone: {
    id: string;
    name: string;
    description?: string;
    rules: string[];
    examples: ToneExample[];
    forbidden: string[];
    preferred: string[];
    emoji: EmojiConfig;
    sentence: SentenceConfig;
    prompt_hint: string;
  };
}

export interface ToneExample {
  input: string;
  output: string;
  note?: string;
}

export interface EmojiConfig {
  allowed: boolean;
  max_count: number;
  preferred: string[];
  forbidden: string[];
}

export interface SentenceConfig {
  endings: string[];
  connectors: string[];
  max_length: number | null;
}

// ============================================
// Validator Types
// ============================================

export interface ValidatorConfig {
  validator: {
    id: string;
    name?: string;
    description?: string;
    method?: string;
    threshold?: number;
    patterns?: ValidatorPattern[];
    compare_against?: CompareConfig[];
    on_similar?: OnMatchAction;
    on_match?: OnMatchConfig;
    exclude?: ExcludeCondition[];
    settings?: Record<string, unknown>;
    logging?: LoggingConfig;
  };
}

export interface ValidatorPattern {
  id?: string;
  category: string;
  regex: string;
  action: 'block' | 'warn' | 'log';
  severity: 'critical' | 'medium' | 'low';
  message?: string;
}

export interface CompareConfig {
  source: string;
  query?: string;
  path?: string;
  weight?: number;
}

export interface OnMatchAction {
  action: string;
  message?: string;
  alternatives?: string[];
}

export interface OnMatchConfig {
  block?: ActionConfig;
  warn?: ActionConfig;
  log?: ActionConfig;
}

export interface ExcludeCondition {
  condition: string;
  reason: string;
}

// ============================================
// Activity & Metrics Types
// ============================================

export interface ActivityLog {
  id?: number;
  action_type: string;
  platform: string;
  target_id?: string;
  target_author?: string;
  content?: string;
  metadata?: string;
  created_at?: string;
}

export interface Post {
  id?: number;
  platform: string;
  content: string;
  post_id?: string;
  posted_at?: string;
  created_at?: string;
  status: 'pending' | 'posted' | 'failed';
  hashtag_count?: number;
  media_count?: number;
}

export interface PostAnalytics {
  id?: number;
  post_id: string;
  platform: string;
  likes: number;
  reposts: number;
  views: number;
  comments: number;
  engagement_rate: number;
  checked_at?: string;
}

export interface DailyStats {
  id?: number;
  date: string;
  x_followers?: number;
  x_following?: number;
  threads_followers?: number;
  threads_following?: number;
}

// ============================================
// Execution Context
// ============================================

export interface ExecutionContext {
  config: Config;
  bounds: Bounds;
  rules: RulesState;
  channel?: ChannelConfig;
  variables: Record<string, unknown>;
  results: Record<string, unknown>;
}

export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// ============================================
// Browser Automation Types
// ============================================

export interface BrowserAction {
  type: 'click' | 'type' | 'wait' | 'navigate' | 'screenshot';
  selector?: string;
  value?: string;
  url?: string;
  timeout?: number;
}

export interface BrowserResult {
  success: boolean;
  data?: unknown;
  error?: string;
  screenshot?: string;
}

export interface PostResult {
  success: boolean;
  post_id?: string;
  url?: string;
  error?: string;
}
