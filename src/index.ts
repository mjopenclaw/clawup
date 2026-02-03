/**
 * OpenClaw Framework
 * Main entry point for programmatic usage
 */

// Core exports
export * from './core/config-loader.js';
export * from './core/rule-engine.js';
export * from './core/pipeline-runner.js';

// Service exports
export * from './services/database.js';
export * from './services/telegram.js';
export * from './services/similarity.js';
export * from './services/tone-adapter.js';

// Browser automation exports
export * as xBrowser from './browser/x.js';
export * as threadsBrowser from './browser/threads.js';
export * from './browser/base.js';

// Utility exports
export * from './utils/logger.js';
export * from './utils/paths.js';

// Type exports
export * from './types/index.js';

// Default export with commonly used functions
import {
  loadConfig,
  loadBounds,
  loadRules,
  loadChannelConfig,
} from './core/config-loader.js';
import { runPipeline } from './core/pipeline-runner.js';
import {
  runPreChecks,
  checkTimingRules,
  checkDailyLimits,
} from './core/rule-engine.js';
import { initDatabase, closeDatabase } from './services/database.js';
import { checkSimilarity } from './services/similarity.js';
import { adaptTone } from './services/tone-adapter.js';
import logger from './utils/logger.js';
import paths from './utils/paths.js';

export default {
  // Config
  loadConfig,
  loadBounds,
  loadRules,
  loadChannelConfig,

  // Pipeline
  runPipeline,

  // Rules
  runPreChecks,
  checkTimingRules,
  checkDailyLimits,

  // Database
  initDatabase,
  closeDatabase,

  // Services
  checkSimilarity,
  adaptTone,

  // Utils
  logger,
  paths,
};
