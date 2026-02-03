/**
 * Logger utility with colored output
 */

import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

interface LoggerOptions {
  prefix?: string;
  timestamp?: boolean;
  level?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  success: 1,
};

export class Logger {
  #prefix: string;
  #showTimestamp: boolean;
  #minLevel: number;

  constructor(options: LoggerOptions = {}) {
    this.#prefix = options.prefix || '';
    this.#showTimestamp = options.timestamp ?? false;
    this.#minLevel = LOG_LEVELS[options.level || 'info'];
  }

  #formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = [];

    if (this.#showTimestamp) {
      parts.push(chalk.gray(`[${new Date().toISOString()}]`));
    }

    if (this.#prefix) {
      parts.push(chalk.cyan(`[${this.#prefix}]`));
    }

    const levelColors: Record<LogLevel, (s: string) => string> = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
      success: chalk.green,
    };

    const levelIcons: Record<LogLevel, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      success: '✅',
    };

    parts.push(levelColors[level](`${levelIcons[level]} ${message}`));

    return parts.join(' ');
  }

  #shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.#minLevel;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.#shouldLog('debug')) {
      console.log(this.#formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.#shouldLog('info')) {
      console.log(this.#formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.#shouldLog('warn')) {
      console.warn(this.#formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.#shouldLog('error')) {
      console.error(this.#formatMessage('error', message), ...args);
    }
  }

  success(message: string, ...args: unknown[]): void {
    if (this.#shouldLog('success')) {
      console.log(this.#formatMessage('success', message), ...args);
    }
  }

  // Utility methods
  table(data: Record<string, unknown>[] | Record<string, unknown>): void {
    console.table(data);
  }

  divider(char = '─', length = 50): void {
    console.log(chalk.gray(char.repeat(length)));
  }

  header(title: string): void {
    this.divider();
    console.log(chalk.bold.cyan(`  ${title}`));
    this.divider();
  }

  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }

  // Progress indicators
  step(current: number, total: number, message: string): void {
    const progress = `[${current}/${total}]`;
    console.log(chalk.cyan(progress), message);
  }

  // Create child logger with prefix
  child(prefix: string): Logger {
    return new Logger({
      prefix: this.#prefix ? `${this.#prefix}:${prefix}` : prefix,
      timestamp: this.#showTimestamp,
      level: Object.keys(LOG_LEVELS).find(
        (k) => LOG_LEVELS[k as LogLevel] === this.#minLevel
      ) as LogLevel,
    });
  }
}

// Default logger instance
export const logger = new Logger({
  timestamp: false,
  level: 'info',
});

// Create logger with options
export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}

export default logger;
