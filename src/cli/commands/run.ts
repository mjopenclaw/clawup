/**
 * Run Command
 * Execute pipelines and automated workflows
 */

import { Command } from 'commander';
import logger from '../../utils/logger.js';
import { runPipeline } from '../../core/pipeline-runner.js';
import { checkTimingRules } from '../../core/rule-engine.js';
import paths from '../../utils/paths.js';
import { existsSync } from 'fs';
import { join } from 'path';

interface RunOptions {
  pipeline?: string;
  channel?: string;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Execute a pipeline or automated workflow')
    .option('-p, --pipeline <pipeline>', 'Pipeline to run (engagement, post, research-to-content)')
    .option('-c, --channel <channel>', 'Target channel')
    .option('-f, --force', 'Force execution even if timing is not optimal')
    .option('--dry-run', 'Simulate without executing actions')
    .option('-v, --verbose', 'Show detailed execution logs')
    .action(async (options: RunOptions) => {
      await executeRun(options);
    });
}

async function executeRun(options: RunOptions): Promise<void> {
  const { pipeline, channel, force, dryRun, verbose } = options;

  if (!pipeline) {
    // List available pipelines
    logger.info('Available pipelines:');
    listPipelines();
    return;
  }

  logger.info(`Preparing to run pipeline: ${pipeline}`);

  // Check timing (unless forced)
  if (!force) {
    const timingCheck = checkTimingRules();
    if (!timingCheck.isOptimal) {
      logger.warn(`Current time is not optimal: ${timingCheck.reason}`);
      logger.warn('Use --force to run anyway');
      process.exit(0);
    }
  }

  // Resolve pipeline path
  const pipelinePath = resolvePipelinePath(pipeline);
  if (!pipelinePath) {
    logger.error(`Pipeline not found: ${pipeline}`);
    logger.info('Available pipelines:');
    listPipelines();
    process.exit(1);
  }

  logger.info(`Loading pipeline from: ${pipelinePath}`);

  // Build context
  const context: Record<string, unknown> = {
    channel: channel ?? 'x',
    dryRun: dryRun ?? false,
    verbose: verbose ?? false,
    timestamp: new Date().toISOString(),
  };

  if (dryRun) {
    logger.info('Running in dry-run mode (no actual actions)');
  }

  // Execute pipeline
  try {
    logger.info('Starting pipeline execution...');
    console.log('');

    const result = await runPipeline(pipelinePath, context);

    console.log('');

    if (result.success) {
      logger.success('Pipeline completed successfully');

      if (result.stepResults) {
        logger.info('Step results:');
        for (const [step, stepResult] of Object.entries(result.stepResults)) {
          const sr = stepResult as { success: boolean; error?: string };
          const icon = sr.success ? '✓' : '✗';
          console.log(`  ${icon} ${step}`);
          if (!sr.success && sr.error) {
            console.log(`    Error: ${sr.error}`);
          }
        }
      }

      if (result.stats) {
        console.log('');
        logger.info('Execution stats:');
        const stats = result.stats as Record<string, number | string>;
        for (const [key, value] of Object.entries(stats)) {
          console.log(`  ${key}: ${value}`);
        }
      }
    } else {
      logger.error('Pipeline failed');
      if (result.error) {
        logger.error(`Error: ${result.error}`);
      }
      if (result.failedStep) {
        logger.error(`Failed at step: ${result.failedStep}`);
      }
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Pipeline execution error: ${errorMessage}`);
    process.exit(1);
  }
}

function resolvePipelinePath(pipelineName: string): string | null {
  // Try different locations
  const searchPaths = [
    // Explicit path
    pipelineName,
    // In modules/sns/pipelines
    join(paths.root, 'modules', 'sns', 'pipelines', `${pipelineName}.yaml`),
    // In modules/income/pipelines
    join(paths.root, 'modules', 'income', 'pipelines', `${pipelineName}.yaml`),
    // In modules/evolution
    join(paths.root, 'modules', 'evolution', 'pipelines', `${pipelineName}.yaml`),
  ];

  for (const searchPath of searchPaths) {
    if (existsSync(searchPath)) {
      return searchPath;
    }
  }

  return null;
}

function listPipelines(): void {
  const pipelineLocations = [
    { name: 'SNS Pipelines', path: join(paths.root, 'modules', 'sns', 'pipelines') },
    { name: 'Income Pipelines', path: join(paths.root, 'modules', 'income', 'pipelines') },
    { name: 'Evolution Pipelines', path: join(paths.root, 'modules', 'evolution', 'pipelines') },
  ];

  for (const location of pipelineLocations) {
    if (existsSync(location.path)) {
      console.log('');
      logger.info(location.name);

      try {
        const { readdirSync } = require('fs');
        const files = readdirSync(location.path) as string[];
        const yamlFiles = files.filter((f: string) => f.endsWith('.yaml') && !f.startsWith('_'));

        if (yamlFiles.length === 0) {
          console.log('  (none)');
        } else {
          for (const file of yamlFiles) {
            const name = file.replace('.yaml', '');
            console.log(`  - ${name}`);
          }
        }
      } catch {
        console.log('  (unable to read)');
      }
    }
  }

  console.log('');
  logger.info('Usage: openclaw run --pipeline <name> [--channel <channel>]');
}

export default { registerRunCommand };
