/**
 * Configuration Loader
 * Loads and validates YAML configuration files
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import yaml from 'js-yaml';
import { z } from 'zod';
import paths, { getChannelPath, getTonePath, getValidatorPath } from '../utils/paths.js';
import logger from '../utils/logger.js';
import type {
  Config,
  Bounds,
  ChannelConfig,
  RulesState,
  Pipeline,
  ToneConfig,
  ValidatorConfig,
} from '../types/index.js';

// ============================================
// YAML Loading Utilities
// ============================================

export function loadYaml<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) {
      logger.warn(`File not found: ${filePath}`);
      return null;
    }

    const content = readFileSync(filePath, 'utf-8');
    return yaml.load(content) as T;
  } catch (error) {
    logger.error(`Failed to load YAML: ${filePath}`, error);
    return null;
  }
}

export function loadYamlOrThrow<T>(filePath: string): T {
  const result = loadYaml<T>(filePath);
  if (result === null) {
    throw new Error(`Failed to load required file: ${filePath}`);
  }
  return result;
}

// ============================================
// Config Loaders
// ============================================

let cachedConfig: Config | null = null;
let cachedBounds: Bounds | null = null;
let cachedRules: RulesState | null = null;

export function loadConfig(forceReload = false): Config {
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  cachedConfig = loadYamlOrThrow<Config>(paths.configYaml);
  return cachedConfig;
}

export function loadBounds(forceReload = false): Bounds {
  if (cachedBounds && !forceReload) {
    return cachedBounds;
  }

  cachedBounds = loadYamlOrThrow<Bounds>(paths.boundsYaml);
  return cachedBounds;
}

export function loadRules(forceReload = false): RulesState {
  if (cachedRules && !forceReload) {
    return cachedRules;
  }

  cachedRules = loadYamlOrThrow<RulesState>(paths.rulesYaml);
  return cachedRules;
}

// ============================================
// Channel Loaders
// ============================================

export function loadChannel(channelId: string): ChannelConfig | null {
  const channelPath = getChannelPath(channelId);
  const data = loadYaml<{ channel: ChannelConfig }>(channelPath);
  return data?.channel || null;
}

// Alias for loadChannel for compatibility
export function loadChannelConfig(channelId: string): { channel: ChannelConfig } | null {
  const channelPath = getChannelPath(channelId);
  return loadYaml<{ channel: ChannelConfig }>(channelPath);
}

export function loadAllChannels(): Map<string, ChannelConfig> {
  const channelsDir = `${paths.snsModules}/channels`;
  const channels = new Map<string, ChannelConfig>();

  if (!existsSync(channelsDir)) {
    return channels;
  }

  const files = readdirSync(channelsDir).filter(
    (f) => f.endsWith('.yaml') && !f.startsWith('_')
  );

  for (const file of files) {
    const channelId = file.replace('.yaml', '');
    const channel = loadChannel(channelId);
    if (channel && channel.enabled) {
      channels.set(channelId, channel);
    }
  }

  return channels;
}

export function getEnabledChannels(): ChannelConfig[] {
  const channels = loadAllChannels();
  return Array.from(channels.values()).filter((c) => c.enabled);
}

// ============================================
// Tone Loaders
// ============================================

export function loadTone(toneId: string): ToneConfig | null {
  const tonePath = getTonePath(toneId);
  return loadYaml<ToneConfig>(tonePath);
}

// ============================================
// Validator Loaders
// ============================================

export function loadValidator(validatorId: string): ValidatorConfig | null {
  const validatorPath = getValidatorPath(validatorId);
  return loadYaml<ValidatorConfig>(validatorPath);
}

// ============================================
// Pipeline Loaders
// ============================================

export function loadPipeline(pipelineId: string): Pipeline | null {
  const pipelinePath = `${paths.snsModules}/pipelines/${pipelineId}.yaml`;
  const data = loadYaml<{ pipeline: Pipeline }>(pipelinePath);
  return data?.pipeline || null;
}

export function loadAllPipelines(): Map<string, Pipeline> {
  const pipelinesDir = `${paths.snsModules}/pipelines`;
  const pipelines = new Map<string, Pipeline>();

  if (!existsSync(pipelinesDir)) {
    return pipelines;
  }

  const files = readdirSync(pipelinesDir).filter((f) => f.endsWith('.yaml'));

  for (const file of files) {
    const pipelineId = file.replace('.yaml', '');
    const pipeline = loadPipeline(pipelineId);
    if (pipeline) {
      pipelines.set(pipelineId, pipeline);
    }
  }

  return pipelines;
}

// ============================================
// Action Loaders
// ============================================

export interface ActionDefinition {
  action: {
    id: string;
    name: string;
    description?: string;
    type: string;
    bounds_ref?: string;
    pre_checks?: unknown[];
    steps?: unknown[];
    targeting?: unknown;
    llm_config?: unknown;
    on_success?: unknown[];
    on_failure?: unknown[];
    logging?: unknown;
  };
}

export function loadAction(actionId: string): ActionDefinition | null {
  const actionPath = `${paths.snsModules}/actions/${actionId}.yaml`;
  return loadYaml<ActionDefinition>(actionPath);
}

// ============================================
// Module Loaders
// ============================================

export function loadSharedModule(category: string, moduleId: string): unknown {
  const modulePath = `${paths.sharedModules}/${category}/${moduleId}.yaml`;
  return loadYaml(modulePath);
}

// ============================================
// Variable Resolution
// ============================================

export function resolveVariable(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(/\$\{([^}]+)\}/g, (_, path) => {
    const value = getNestedValue(context, path);
    return value !== undefined ? String(value) : `\${${path}}`;
  });
}

export function resolveVariables(
  obj: unknown,
  context: Record<string, unknown>
): unknown {
  if (typeof obj === 'string') {
    return resolveVariable(obj, context);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveVariables(item, context));
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveVariables(value, context);
    }
    return result;
  }

  return obj;
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

// ============================================
// Config Helpers
// ============================================

export function getChannelConfig(channelId: string): ChannelConfig | null {
  return loadChannel(channelId);
}

export function getTelegramConfig(): {
  botToken: string;
  chatId: string;
} | null {
  const config = loadConfig();
  const telegram = config.accounts?.telegram;

  if (!telegram?.enabled) {
    return null;
  }

  return {
    botToken: telegram.monitor_bot_token,
    chatId: telegram.monitor_chat_id,
  };
}

export function getGoalProgress(goalId: string): {
  current: number;
  target: number;
  progress: number;
} | null {
  const config = loadConfig();
  const goal = config.goals?.[goalId];

  if (!goal) {
    return null;
  }

  return {
    current: goal.current,
    target: goal.target,
    progress: goal.progress,
  };
}

// ============================================
// Bounds Checking
// ============================================

export function checkBounds(
  category: string,
  subcategory: string,
  key: string,
  value: number
): { allowed: boolean; limit: number; reason?: string } {
  const bounds = loadBounds();
  const categoryBounds = (bounds as unknown as Record<string, unknown>)[category] as Record<string, unknown> | undefined;

  if (!categoryBounds) {
    return { allowed: true, limit: Infinity };
  }

  const subcategoryBounds = categoryBounds[subcategory] as Record<string, number> | undefined;
  if (!subcategoryBounds) {
    return { allowed: true, limit: Infinity };
  }

  const limit = subcategoryBounds[key];
  if (limit === undefined) {
    return { allowed: true, limit: Infinity };
  }

  const allowed = value <= limit;
  return {
    allowed,
    limit,
    reason: allowed ? undefined : `Exceeds limit: ${value} > ${limit}`,
  };
}

export function isForbiddenTopic(topic: string): boolean {
  const bounds = loadBounds();
  const forbidden = bounds.sns?.forbidden_topics || [];
  return forbidden.some((t) => topic.toLowerCase().includes(t.toLowerCase()));
}

export function isForbiddenAction(action: string): boolean {
  const bounds = loadBounds();
  const forbidden = bounds.sns?.forbidden_actions || [];
  return forbidden.includes(action);
}

// ============================================
// Clear Cache
// ============================================

export function clearConfigCache(): void {
  cachedConfig = null;
  cachedBounds = null;
  cachedRules = null;
}

// Default export
export default {
  loadConfig,
  loadBounds,
  loadRules,
  loadChannel,
  loadChannelConfig,
  loadAllChannels,
  loadTone,
  loadValidator,
  loadPipeline,
  loadAllPipelines,
  loadAction,
  resolveVariable,
  resolveVariables,
  checkBounds,
  isForbiddenTopic,
  isForbiddenAction,
  clearConfigCache,
};
