/**
 * Path utilities for the framework
 */

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

// Get the root directory of the framework
function findRoot(startDir: string): string {
  let currentDir = startDir;

  while (currentDir !== '/') {
    // Check for package.json with our name
    const packagePath = join(currentDir, 'package.json');
    if (existsSync(packagePath)) {
      try {
        const pkg = require(packagePath);
        if (pkg.name === 'openclaw-framework') {
          return currentDir;
        }
      } catch {
        // Continue searching
      }
    }

    // Check for config directory (alternative marker)
    if (existsSync(join(currentDir, 'config', 'bounds.yaml'))) {
      return currentDir;
    }

    currentDir = dirname(currentDir);
  }

  // Fallback to current working directory
  return process.cwd();
}

// Get current file's directory (for ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Root directory of the framework
export const ROOT_DIR = findRoot(__dirname);

// Standard paths
export const paths = {
  root: ROOT_DIR,

  // Config
  config: join(ROOT_DIR, 'config'),
  configYaml: join(ROOT_DIR, 'config', 'config.yaml'),
  boundsYaml: join(ROOT_DIR, 'config', 'bounds.yaml'),
  channelsYaml: join(ROOT_DIR, 'config', 'channels.yaml'),
  modulesYaml: join(ROOT_DIR, 'config', 'modules.yaml'),

  // State
  state: join(ROOT_DIR, 'state'),
  rulesYaml: join(ROOT_DIR, 'state', 'rules.yaml'),
  strategiesYaml: join(ROOT_DIR, 'state', 'strategies.yaml'),
  experimentsYaml: join(ROOT_DIR, 'state', 'experiments.yaml'),

  // Modules
  modules: join(ROOT_DIR, 'modules'),
  sharedModules: join(ROOT_DIR, 'modules', 'shared'),
  snsModules: join(ROOT_DIR, 'modules', 'sns'),
  incomeModules: join(ROOT_DIR, 'modules', 'income'),
  evolutionModules: join(ROOT_DIR, 'modules', 'evolution'),

  // Data
  data: join(ROOT_DIR, 'data'),
  database: join(ROOT_DIR, 'data', 'agent.db'),

  // Memory
  memory: join(ROOT_DIR, 'memory'),
  memoryMd: join(ROOT_DIR, 'memory', 'MEMORY.md'),
  dashboardMd: join(ROOT_DIR, 'memory', 'dashboard.md'),
  dailyMemory: join(ROOT_DIR, 'memory', 'daily'),
  learningsMemory: join(ROOT_DIR, 'memory', 'learnings'),
  plansMemory: join(ROOT_DIR, 'memory', 'plans'),

  // Core
  core: join(ROOT_DIR, 'core'),
  crons: join(ROOT_DIR, 'core', 'crons'),
  tasks: join(ROOT_DIR, 'core', 'tasks'),
  schema: join(ROOT_DIR, 'core', 'schema'),
  scripts: join(ROOT_DIR, 'core', 'scripts'),

  // Source
  src: join(ROOT_DIR, 'src'),
};

// Helper functions
export function resolvePath(...segments: string[]): string {
  return resolve(ROOT_DIR, ...segments);
}

export function getModulePath(category: string, type: string, name: string): string {
  return join(paths.modules, category, type, `${name}.yaml`);
}

export function getChannelPath(channelId: string): string {
  return join(paths.snsModules, 'channels', `${channelId}.yaml`);
}

export function getActionPath(actionId: string): string {
  return join(paths.snsModules, 'actions', `${actionId}.yaml`);
}

export function getPipelinePath(pipelineId: string): string {
  return join(paths.snsModules, 'pipelines', `${pipelineId}.yaml`);
}

export function getTonePath(toneId: string): string {
  return join(paths.sharedModules, 'tone', `${toneId}.yaml`);
}

export function getValidatorPath(validatorId: string): string {
  return join(paths.sharedModules, 'validator', `${validatorId}.yaml`);
}

export default paths;
