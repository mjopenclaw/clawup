#!/usr/bin/env node
/**
 * OpenClaw Framework CLI
 * Main entry point for the autonomous agent framework
 */

import { Command } from 'commander';
import { createRequire } from 'module';
import logger from '../utils/logger.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

// Import commands
import { registerPostCommand } from './commands/post.js';
import { registerEngageCommand } from './commands/engage.js';
import { registerStatusCommand } from './commands/status.js';
import { registerRunCommand } from './commands/run.js';
import { registerConfigCommand } from './commands/config.js';

const program = new Command();

program
  .name('openclaw')
  .description('OpenClaw Autonomous Framework - Self-evolving AI agent for SNS automation')
  .version(version);

// Register all commands
registerPostCommand(program);
registerEngageCommand(program);
registerStatusCommand(program);
registerRunCommand(program);
registerConfigCommand(program);

// Default action
program.action(() => {
  logger.info('OpenClaw Framework');
  logger.info('Use --help to see available commands');
});

// Error handling
program.showHelpAfterError();
program.showSuggestionAfterError();

// Parse and execute
program.parse();
