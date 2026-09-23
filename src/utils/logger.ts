/**
 * Structured logger and step event dispatcher for JevBrow.
 * Zero external dependencies.
 */

import type { LogLevel, StepLog } from './types.js';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 99,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',   // gray
  info: '\x1b[36m',    // cyan
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
  silent: '',
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m';

export class Logger {
  private minLevel: number;
  private prefix: string;
  private static onStepCallbacks: Array<(step: StepLog) => void> = [];
  private static showSteps: boolean = true;
  private static globalMinLevel: number | null = null;

  constructor(prefix: string = 'JevBrow', minLevel: LogLevel = 'info') {
    this.prefix = prefix;
    this.minLevel = LEVEL_PRIORITY[minLevel];
  }

  /** Set a global minimum log level that applies across all logger instances. */
  static setGlobalLevel(level: LogLevel): void {
    Logger.globalMinLevel = LEVEL_PRIORITY[level];
  }

  /** Register a global step listener callback. */
  static addStepListener(callback: (step: StepLog) => void): () => void {
    Logger.onStepCallbacks.push(callback);
    return () => {
      Logger.onStepCallbacks = Logger.onStepCallbacks.filter((c) => c !== callback);
    };
  }

  /** Toggle formatted step summaries. */
  static setShowSteps(show: boolean): void {
    Logger.showSteps = show;
  }

  /** Dispatch a step log event to listeners and format to console. */
  static emitStep(step: StepLog, minLevel: number = 1): void {
    // Notify custom programmatic callbacks
    for (const callback of Logger.onStepCallbacks) {
      try {
        callback(step);
      } catch {
        // Prevent user listener from crashing automation
      }
    }

    if (!Logger.showSteps || minLevel >= LEVEL_PRIORITY.silent) return;

    const time = new Date(step.timestamp).toISOString().slice(11, 19);
    const duration = step.durationMs !== undefined ? ` \x1b[90m(${step.durationMs}ms)\x1b[0m` : '';

    let icon = '⚡';
    if (step.type === 'navigate') icon = '🌐';
    else if (step.type === 'click') icon = '🎯';
    else if (step.type === 'type') icon = '⌨️ ';
    else if (step.type === 'ask') icon = '🧠';
    else if (step.type === 'ready_check') icon = '⏳';
    else if (step.type === 'assert') icon = step.success ? '✅' : '❌';
    else if (step.type === 'seek_goal') icon = '🧭';
    else if (step.type === 'autofill') icon = '📋';
    else if (step.type === 'captcha_detect' || step.type === 'captcha_solve') icon = '🔓';
    else if (step.type === 'llm_escalation') icon = '🤖';

    const sourceTag = step.source ? ` \x1b[35m[${step.source.toUpperCase()}]\x1b[0m` : '';
    const metric =
      step.confidence !== undefined
        ? ` \x1b[32m(conf: ${(step.confidence * 100).toFixed(1)}%)\x1b[0m`
        : step.probability !== undefined
          ? ` \x1b[32m(prob: ${(step.probability * 100).toFixed(1)}%)\x1b[0m`
          : '';

    console.log(
      `\x1b[90m[${time}]\x1b[0m ${icon} ${BOLD}${step.message}${RESET}${sourceTag}${metric}${duration}`,
    );
  }

  /** Create a child logger with a sub-prefix. */
  child(subPrefix: string): Logger {
    const child = new Logger(
      `${this.prefix}:${subPrefix}`,
      (Object.entries(LEVEL_PRIORITY).find(
        ([, v]) => v === this.minLevel,
      )?.[0] ?? 'info') as LogLevel,
    );
    return child;
  }

  /** Set the minimum log level at runtime. */
  setLevel(level: LogLevel): void {
    this.minLevel = LEVEL_PRIORITY[level];
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  /** Emit a step event from this logger instance. */
  step(step: Omit<StepLog, 'timestamp'>): void {
    const fullStep: StepLog = {
      ...step,
      timestamp: Date.now(),
    };
    Logger.emitStep(fullStep, this.minLevel);
  }

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    const effectiveMin =
      Logger.globalMinLevel !== null ? Logger.globalMinLevel : this.minLevel;
    if (effectiveMin >= LEVEL_PRIORITY.silent) return;
    if (LEVEL_PRIORITY[level] < effectiveMin) return;

    const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
    const color = LEVEL_COLORS[level];
    const tag = level.toUpperCase().padEnd(5);

    let line = `${color}${BOLD}[${timestamp}]${RESET} ${color}${tag}${RESET} ${BOLD}${this.prefix}${RESET} ${message}`;

    if (data && Object.keys(data).length > 0) {
      line += ` ${LEVEL_COLORS.debug}${JSON.stringify(data)}${RESET}`;
    }

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

/** Singleton root logger. */
export const logger = new Logger();
