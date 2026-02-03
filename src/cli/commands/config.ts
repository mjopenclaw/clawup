/**
 * Config Command
 * View and manage framework configuration
 */

import { Command } from 'commander';
import logger from '../../utils/logger.js';
import paths from '../../utils/paths.js';
import { loadConfig, loadBounds, loadRules, loadChannelConfig } from '../../core/config-loader.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

interface ConfigOptions {
  show?: string;
  validate?: boolean;
  json?: boolean;
}

export function registerConfigCommand(program: Command): void {
  program
    .command('config')
    .description('View and manage framework configuration')
    .option('-s, --show <file>', 'Show specific config (config, bounds, rules, channels)')
    .option('--validate', 'Validate all configuration files')
    .option('--json', 'Output in JSON format')
    .action(async (options: ConfigOptions) => {
      await executeConfig(options);
    });
}

async function executeConfig(options: ConfigOptions): Promise<void> {
  const { show, validate, json } = options;

  if (validate) {
    validateConfigs();
    return;
  }

  if (show) {
    showConfig(show, json ?? false);
    return;
  }

  // Default: show overview
  showOverview(json ?? false);
}

function showOverview(asJson: boolean): void {
  const configFiles = [
    { name: 'config.yaml', path: join(paths.config, 'config.yaml'), desc: 'Main configuration' },
    { name: 'bounds.yaml', path: join(paths.config, 'bounds.yaml'), desc: 'Safety boundaries' },
    { name: 'channels.yaml', path: join(paths.config, 'channels.yaml'), desc: 'Channel settings' },
    { name: 'rules.yaml', path: join(paths.state, 'rules.yaml'), desc: 'Learned rules' },
    { name: 'strategies.yaml', path: join(paths.state, 'strategies.yaml'), desc: 'Strategies' },
    { name: 'experiments.yaml', path: join(paths.state, 'experiments.yaml'), desc: 'Experiments' },
  ];

  const status: Record<string, { exists: boolean; path: string; description: string }> = {};

  for (const file of configFiles) {
    status[file.name] = {
      exists: existsSync(file.path),
      path: file.path,
      description: file.desc,
    };
  }

  if (asJson) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log('');
  logger.info('Configuration Files');
  console.log('');

  for (const file of configFiles) {
    const exists = existsSync(file.path);
    const icon = exists ? '✓' : '✗';
    const statusText = exists ? '' : ' (not found)';
    console.log(`  ${icon} ${file.name.padEnd(20)} ${file.desc}${statusText}`);
    console.log(`    ${file.path}`);
  }

  console.log('');
  logger.info('Commands');
  console.log('  openclaw config --show config     # Show main config');
  console.log('  openclaw config --show bounds     # Show safety bounds');
  console.log('  openclaw config --show rules      # Show learned rules');
  console.log('  openclaw config --validate        # Validate all configs');
  console.log('');
}

function showConfig(configName: string, asJson: boolean): void {
  const configMap: Record<string, { path: string; loader: () => unknown }> = {
    config: {
      path: join(paths.config, 'config.yaml'),
      loader: loadConfig,
    },
    bounds: {
      path: join(paths.config, 'bounds.yaml'),
      loader: loadBounds,
    },
    rules: {
      path: join(paths.state, 'rules.yaml'),
      loader: loadRules,
    },
    channels: {
      path: join(paths.config, 'channels.yaml'),
      loader: () => {
        const filePath = join(paths.config, 'channels.yaml');
        if (existsSync(filePath)) {
          return YAML.parse(readFileSync(filePath, 'utf-8'));
        }
        return null;
      },
    },
    x: {
      path: join(paths.root, 'modules', 'sns', 'channels', 'x.yaml'),
      loader: () => loadChannelConfig('x'),
    },
    threads: {
      path: join(paths.root, 'modules', 'sns', 'channels', 'threads.yaml'),
      loader: () => loadChannelConfig('threads'),
    },
  };

  const config = configMap[configName];
  if (!config) {
    logger.error(`Unknown config: ${configName}`);
    logger.info(`Available: ${Object.keys(configMap).join(', ')}`);
    process.exit(1);
  }

  if (!existsSync(config.path)) {
    logger.error(`Config file not found: ${config.path}`);
    process.exit(1);
  }

  try {
    const data = config.loader();

    if (asJson) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('');
      logger.info(`${configName}.yaml`);
      console.log(`Path: ${config.path}`);
      console.log('');
      console.log('---');
      console.log(YAML.stringify(data));
      console.log('---');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load config: ${errorMessage}`);
    process.exit(1);
  }
}

function validateConfigs(): void {
  console.log('');
  logger.info('Validating configuration files...');
  console.log('');

  let hasErrors = false;

  // Validate config.yaml
  try {
    const config = loadConfig();
    if (config) {
      logger.success('config.yaml: Valid');
    } else {
      logger.warn('config.yaml: Not found (optional)');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`config.yaml: Invalid - ${errorMessage}`);
    hasErrors = true;
  }

  // Validate bounds.yaml
  try {
    const bounds = loadBounds();
    if (bounds) {
      // Check required fields
      const requiredFields = ['sns', 'evolution'];
      const missingFields = requiredFields.filter((f) => !(f in bounds));

      if (missingFields.length > 0) {
        logger.warn(`bounds.yaml: Missing recommended fields: ${missingFields.join(', ')}`);
      } else {
        logger.success('bounds.yaml: Valid');
      }

      // Validate bounds values
      if (bounds.sns?.posting) {
        const { max_per_day, min_interval_minutes } = bounds.sns.posting;
        if (typeof max_per_day !== 'number' || max_per_day < 1) {
          logger.warn('bounds.yaml: sns.posting.max_per_day should be a positive number');
        }
        if (typeof min_interval_minutes !== 'number' || min_interval_minutes < 1) {
          logger.warn('bounds.yaml: sns.posting.min_interval_minutes should be a positive number');
        }
      }
    } else {
      logger.warn('bounds.yaml: Not found (optional but recommended)');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`bounds.yaml: Invalid - ${errorMessage}`);
    hasErrors = true;
  }

  // Validate rules.yaml
  try {
    const rules = loadRules();
    if (rules) {
      logger.success('rules.yaml: Valid');

      // Check structure
      if (rules.timing) {
        if (typeof rules.timing.confidence !== 'number') {
          logger.warn('rules.yaml: timing.confidence should be a number');
        }
        if (!Array.isArray(rules.timing.best_hours)) {
          logger.warn('rules.yaml: timing.best_hours should be an array');
        }
      }

      if (rules.content?.rules) {
        const invalidRules = rules.content.rules.filter(
          (r: { id: string; pattern: string; action: string; confidence: number }) =>
            !r.id || !r.pattern || !r.action || typeof r.confidence !== 'number'
        );
        if (invalidRules.length > 0) {
          logger.warn(`rules.yaml: ${invalidRules.length} content rules are missing required fields`);
        }
      }
    } else {
      logger.warn('rules.yaml: Not found (will be created as rules are learned)');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`rules.yaml: Invalid - ${errorMessage}`);
    hasErrors = true;
  }

  // Validate channel configs
  const channels = ['x', 'threads'];
  for (const channel of channels) {
    const channelPath = join(paths.root, 'modules', 'sns', 'channels', `${channel}.yaml`);
    if (existsSync(channelPath)) {
      try {
        const channelConfig = loadChannelConfig(channel);
        if (channelConfig) {
          logger.success(`${channel}.yaml: Valid`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`${channel}.yaml: Invalid - ${errorMessage}`);
        hasErrors = true;
      }
    } else {
      logger.warn(`${channel}.yaml: Not found`);
    }
  }

  console.log('');

  if (hasErrors) {
    logger.error('Validation completed with errors');
    process.exit(1);
  } else {
    logger.success('All configurations are valid');
  }
}

export default { registerConfigCommand };
