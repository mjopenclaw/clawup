/**
 * Pipeline Runner
 * Executes pipeline definitions from YAML files
 */

import {
  loadPipeline,
  loadConfig,
  loadBounds,
  loadRules,
  loadChannel,
  resolveVariables,
} from './config-loader.js';
import { checkTimingRules, runPreChecks, applyContentRules } from './rule-engine.js';
import { checkSimilarity } from '../services/similarity.js';
import { adaptTone } from '../services/tone-adapter.js';
import { notify, requestApproval } from '../services/telegram.js';
import {
  getNextQueueItem,
  updateQueueItemStatus,
  logActivity,
  savePost,
} from '../services/database.js';
import logger from '../utils/logger.js';
import type {
  Pipeline,
  PipelineStep,
  PipelinePhase,
  ExecutionContext,
  StepResult,
  ChannelConfig,
} from '../types/index.js';

// ============================================
// Types
// ============================================

export interface PipelineResult {
  success: boolean;
  pipelineId: string;
  stepsExecuted: number;
  results: Record<string, unknown>;
  stepResults?: Record<string, { success: boolean; error?: string }>;
  stats?: Record<string, number | string>;
  errors: string[];
  error?: string;
  failedStep?: string;
  duration: number;
}

export interface RunOptions {
  force?: boolean;
  dryRun?: boolean;
  channel?: string;
  verbose?: boolean;
}

// ============================================
// Pipeline Execution
// ============================================

export async function runPipeline(
  pipelineId: string,
  options: RunOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const results: Record<string, unknown> = {};

  logger.info(`Starting pipeline: ${pipelineId}`);

  // Load pipeline definition
  const pipeline = loadPipeline(pipelineId);

  if (!pipeline) {
    return {
      success: false,
      pipelineId,
      stepsExecuted: 0,
      results: {},
      errors: [`Pipeline not found: ${pipelineId}`],
      duration: Date.now() - startTime,
    };
  }

  // Create execution context
  const context = createContext(options);

  // Check conditions
  if (!options.force && pipeline.conditions) {
    const conditionCheck = await checkConditions(pipeline.conditions, context);
    if (!conditionCheck.passed) {
      logger.info(`Pipeline conditions not met: ${conditionCheck.reason}`);
      return {
        success: false,
        pipelineId,
        stepsExecuted: 0,
        results: { conditionCheck },
        errors: [conditionCheck.reason || 'Conditions not met'],
        duration: Date.now() - startTime,
      };
    }
  }

  // Execute steps or phases
  let stepsExecuted = 0;

  try {
    if (pipeline.steps) {
      // Sequential steps
      for (const step of pipeline.steps) {
        if (options.verbose) {
          logger.debug(`Executing step: ${step.name}`);
        }

        const stepResult = await executeStep(step, context, options);

        if (step.output) {
          context.results[step.output] = stepResult.output;
          results[step.output] = stepResult.output;
        }

        stepsExecuted++;

        if (!stepResult.success && !stepResult.skipped) {
          if (step.on_fail?.action === 'continue') {
            logger.warn(`Step ${step.name} failed, continuing`);
            errors.push(`Step ${step.name}: ${stepResult.error}`);
          } else {
            throw new Error(stepResult.error || `Step ${step.name} failed`);
          }
        }

        if (stepResult.skipped) {
          logger.debug(`Step ${step.name} skipped: ${stepResult.skipReason}`);
        }
      }
    } else if (pipeline.phases) {
      // Phase-based execution
      for (const phase of pipeline.phases) {
        if (options.verbose) {
          logger.debug(`Executing phase: ${phase.name}`);
        }

        const phaseResult = await executePhase(phase, context, options);
        results[phase.name] = phaseResult;
        stepsExecuted += phaseResult.tasksExecuted;

        if (!phaseResult.success) {
          errors.push(...phaseResult.errors);
        }
      }
    }

    // Run on_complete handlers
    if (pipeline.on_complete) {
      for (const action of pipeline.on_complete) {
        await executeAction(action, context);
      }
    }

    logger.success(`Pipeline ${pipelineId} completed`);

    // Convert results to stepResults format
    const stepResults: Record<string, { success: boolean; error?: string }> = {};
    for (const [key, value] of Object.entries(results)) {
      stepResults[key] = { success: true };
    }

    return {
      success: errors.length === 0,
      pipelineId,
      stepsExecuted,
      results,
      stepResults,
      stats: {
        duration_ms: Date.now() - startTime,
        steps_executed: stepsExecuted,
      },
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    logger.error(`Pipeline ${pipelineId} failed: ${errorMessage}`);

    // Run on_error handlers
    if (pipeline.on_error) {
      context.results.error = errorMessage;
      for (const action of pipeline.on_error) {
        await executeAction(action, context);
      }
    }

    return {
      success: false,
      pipelineId,
      stepsExecuted,
      results,
      errors,
      error: errorMessage,
      failedStep: 'unknown', // Could be tracked more specifically
      duration: Date.now() - startTime,
    };
  }
}

// ============================================
// Context Creation
// ============================================

function createContext(options: RunOptions): ExecutionContext {
  const config = loadConfig();
  const bounds = loadBounds();
  const rules = loadRules();

  let channel: ChannelConfig | undefined;
  if (options.channel) {
    channel = loadChannel(options.channel) ?? undefined;
  }

  return {
    config,
    bounds,
    rules,
    channel,
    variables: {
      current_hour: new Date().getHours(),
      current_day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
    },
    results: {},
  };
}

// ============================================
// Condition Checking
// ============================================

async function checkConditions(
  conditions: Pipeline['conditions'],
  context: ExecutionContext
): Promise<{ passed: boolean; reason?: string }> {
  if (!conditions) {
    return { passed: true };
  }

  // Time range check
  if (conditions.time_range) {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const [startHour, startMin] = conditions.time_range.start.split(':').map(Number);
    const [endHour, endMin] = conditions.time_range.end.split(':').map(Number);
    const startTime = startHour * 100 + startMin;
    const endTime = endHour * 100 + endMin;

    if (currentTime < startTime || currentTime > endTime) {
      return {
        passed: false,
        reason: `Outside time range: ${conditions.time_range.start}-${conditions.time_range.end}`,
      };
    }
  }

  // Timing rules check
  if (conditions.timing_check?.use_rules) {
    const timingResult = checkTimingRules();
    if (
      !timingResult.isOptimal &&
      timingResult.confidence >= (conditions.timing_check.confidence_threshold ?? 0.5)
    ) {
      return {
        passed: false,
        reason: timingResult.reason,
      };
    }
  }

  return { passed: true };
}

// ============================================
// Step Execution
// ============================================

async function executeStep(
  step: PipelineStep,
  context: ExecutionContext,
  options: RunOptions
): Promise<StepResult> {
  // Check step condition
  if (step.condition) {
    const conditionMet = evaluateCondition(step.condition, context);
    if (!conditionMet) {
      return {
        success: true,
        skipped: true,
        skipReason: `Condition not met: ${step.condition}`,
      };
    }
  }

  // Check enabled flag
  if (step.enabled !== undefined) {
    const enabled =
      typeof step.enabled === 'string'
        ? evaluateCondition(step.enabled, context)
        : step.enabled;
    if (!enabled) {
      return {
        success: true,
        skipped: true,
        skipReason: 'Step disabled',
      };
    }
  }

  // Resolve variables in step
  const resolvedStep = resolveVariables(step, {
    ...context.variables,
    ...context.results,
    config: context.config,
    bounds: context.bounds,
    rules: context.rules,
    channel: context.channel,
  }) as PipelineStep;

  try {
    // Execute based on step type
    if (resolvedStep.action) {
      return await executeBuiltinAction(resolvedStep, context, options);
    }

    if (resolvedStep.service) {
      return await executeService(resolvedStep, context, options);
    }

    if (resolvedStep.query) {
      return await executeQuery(resolvedStep, context);
    }

    if (resolvedStep.for_each) {
      return await executeForEach(resolvedStep, context, options);
    }

    return {
      success: false,
      error: `Unknown step type for: ${step.name}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle on_fail
    if (step.on_fail) {
      if (step.on_fail.action === 'skip') {
        return {
          success: true,
          skipped: true,
          skipReason: errorMessage,
        };
      }
      if (step.on_fail.action === 'rephrase' && step.on_fail.max_retries) {
        // Retry with rephrasing logic would go here
        logger.warn(`Rephrase requested but not yet implemented`);
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================
// Built-in Actions
// ============================================

async function executeBuiltinAction(
  step: PipelineStep,
  context: ExecutionContext,
  options: RunOptions
): Promise<StepResult> {
  const action = step.action!;

  switch (action) {
    case 'queue_pop':
    case 'queue.pop': {
      const item = getNextQueueItem(context.channel?.id);
      if (!item) {
        return {
          success: true,
          skipped: true,
          skipReason: 'Queue is empty',
        };
      }
      return { success: true, output: item };
    }

    case 'channel.post': {
      // This would call the browser automation
      if (options.dryRun) {
        logger.info('[DRY RUN] Would post to channel');
        return { success: true, output: { post_id: 'dry-run-id' } };
      }
      // Actual posting would be done by browser service
      return { success: true, output: { post_id: 'placeholder' } };
    }

    case 'db_insert': {
      if (options.dryRun) {
        logger.info(`[DRY RUN] Would insert into database`);
        return { success: true };
      }
      // Handle different tables
      return { success: true };
    }

    case 'telegram_send':
    case 'telegram.send': {
      const message = step.params?.message as string || step.input || '';
      if (options.dryRun) {
        logger.info(`[DRY RUN] Would send Telegram: ${message.substring(0, 50)}...`);
        return { success: true };
      }
      await notify(message);
      return { success: true };
    }

    case 'log': {
      const message = step.params?.message as string || step.input || '';
      logger.info(message);
      return { success: true };
    }

    case 'wait': {
      const duration = step.params?.duration as string || '1s';
      const ms = parseDuration(duration);
      await sleep(ms);
      return { success: true };
    }

    default:
      logger.warn(`Unknown action: ${action}`);
      return { success: true, output: null };
  }
}

// ============================================
// Service Execution
// ============================================

async function executeService(
  step: PipelineStep,
  context: ExecutionContext,
  options: RunOptions
): Promise<StepResult> {
  const servicePath = step.service!;
  const input = step.input
    ? getValueFromContext(step.input, context)
    : undefined;

  // Parse service path (e.g., "shared/tone/casual" or "shared/validator/similarity")
  const parts = servicePath.split('/');

  if (parts[0] === 'shared') {
    const category = parts[1];
    const serviceId = parts.slice(2).join('/');

    switch (category) {
      case 'tone': {
        const content = typeof input === 'string' ? input : String(input);
        const result = adaptTone(content, {
          toneId: serviceId,
          maxLength: step.params?.target_length as number,
        });
        return { success: result.success, output: result.content };
      }

      case 'validator': {
        if (serviceId === 'similarity') {
          const content = typeof input === 'string' ? input : String(input);
          const result = await checkSimilarity(content, {
            platform: context.channel?.id,
          });
          if (result.isSimilar) {
            return {
              success: false,
              error: `Similar content found: ${(result.highestSimilarity * 100).toFixed(1)}%`,
            };
          }
          return { success: true, output: result };
        }
        // Other validators...
        return { success: true };
      }

      case 'approval': {
        if (serviceId === 'telegram') {
          const content = typeof input === 'string' ? input : String(input);
          const result = await requestApproval({
            id: `req_${Date.now()}`,
            type: 'post',
            content,
            channel: context.channel?.id,
          });
          // In real implementation, would wait for approval
          return { success: true, output: result };
        }
        return { success: true };
      }

      case 'transformer': {
        // Length adaptation, summarization, etc.
        return { success: true, output: input };
      }

      default:
        return { success: false, error: `Unknown service category: ${category}` };
    }
  }

  return { success: false, error: `Unknown service: ${servicePath}` };
}

// ============================================
// Query Execution
// ============================================

async function executeQuery(
  step: PipelineStep,
  context: ExecutionContext
): Promise<StepResult> {
  // This would execute SQL queries
  // For now, return placeholder
  return { success: true, output: [] };
}

// ============================================
// For Each Execution
// ============================================

async function executeForEach(
  step: PipelineStep,
  context: ExecutionContext,
  options: RunOptions
): Promise<StepResult> {
  const [varName, , sourceName] = step.for_each!.split(' ');
  const source = getValueFromContext(sourceName, context);

  if (!Array.isArray(source)) {
    return { success: false, error: 'for_each source is not an array' };
  }

  const results: unknown[] = [];
  const maxIterations = step.max_iterations ?? source.length;

  for (let i = 0; i < Math.min(source.length, maxIterations); i++) {
    const item = source[i];
    const itemContext = {
      ...context,
      variables: {
        ...context.variables,
        [varName]: item,
      },
    };

    if (step.steps) {
      for (const subStep of step.steps) {
        const result = await executeStep(subStep, itemContext, options);
        if (!result.success && !result.skipped) {
          // Depending on configuration, might continue or stop
        }
      }
    }

    results.push(item);
  }

  return { success: true, output: results };
}

// ============================================
// Phase Execution
// ============================================

async function executePhase(
  phase: PipelinePhase,
  context: ExecutionContext,
  options: RunOptions
): Promise<{ success: boolean; tasksExecuted: number; errors: string[] }> {
  const errors: string[] = [];
  let tasksExecuted = 0;

  // Check phase condition
  if (phase.condition) {
    const conditionMet = evaluateCondition(phase.condition, context);
    if (!conditionMet) {
      return { success: true, tasksExecuted: 0, errors: [] };
    }
  }

  // Execute tasks
  for (const task of phase.tasks) {
    tasksExecuted++;

    // Convert task to step format
    const step: PipelineStep = {
      name: task.action,
      action: task.action,
      input: task.input,
      params: task.params,
      output: task.output,
    };

    const result = await executeStep(step, context, options);

    if (!result.success && !result.skipped) {
      errors.push(result.error || `Task ${task.action} failed`);
    }
  }

  return {
    success: errors.length === 0,
    tasksExecuted,
    errors,
  };
}

// ============================================
// Action Execution (for on_complete, on_error)
// ============================================

async function executeAction(
  action: NonNullable<Pipeline['on_complete']>[number],
  context: ExecutionContext
): Promise<void> {
  // Check condition
  if (action.condition) {
    const conditionMet = evaluateCondition(action.condition, context);
    if (!conditionMet) {
      return;
    }
  }

  switch (action.action) {
    case 'log':
      const message = resolveVariables(action.message || action.log || '', {
        ...context.variables,
        ...context.results,
      }) as string;
      logger.info(message);
      break;

    case 'notify':
      const notifyMessage = resolveVariables(action.message || '', {
        ...context.variables,
        ...context.results,
      }) as string;
      await notify(notifyMessage);
      break;

    case 'metric':
      // Would update metrics
      break;
  }
}

// ============================================
// Utility Functions
// ============================================

function evaluateCondition(
  condition: string,
  context: ExecutionContext
): boolean {
  // Simple condition evaluation
  // Format: "variable > value" or "variable.count > 0"

  try {
    // Replace variables
    const resolved = condition.replace(/\$\{([^}]+)\}/g, (_, path) => {
      const value = getValueFromContext(path, context);
      return JSON.stringify(value);
    });

    // Also replace direct references
    const withContext = resolved.replace(/([a-zA-Z_][a-zA-Z0-9_.]*)/g, (match) => {
      if (['true', 'false', 'null', 'undefined'].includes(match)) {
        return match;
      }
      const value = getValueFromContext(match, context);
      if (value !== undefined) {
        return JSON.stringify(value);
      }
      return match;
    });

    // Evaluate (basic, not using eval for security)
    // For now, just check truthiness
    return Boolean(withContext);
  } catch {
    return false;
  }
}

function getValueFromContext(path: string, context: ExecutionContext): unknown {
  // Remove ${} wrapper if present
  const cleanPath = path.replace(/^\$\{/, '').replace(/\}$/, '');
  const parts = cleanPath.split('.');

  let current: unknown = {
    ...context.variables,
    ...context.results,
    config: context.config,
    bounds: context.bounds,
    rules: context.rules,
    channel: context.channel,
  };

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h)?$/);
  if (!match) {
    return 1000;
  }

  const value = parseInt(match[1]);
  const unit = match[2] || 's';

  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    case 's':
    default:
      return value * 1000;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Default export
export default {
  runPipeline,
};
