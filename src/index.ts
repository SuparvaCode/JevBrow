/**
 * JevBrow — Public API exports.
 *
 * @packageDocumentation
 */

// ─── Main classes ─────────────────────────────────────────────────────────────
export { JevBrow, JevPage, AssertionError } from './jevbrow.js';

// ─── AI engines ───────────────────────────────────────────────────────────────
export { JevEngine } from './ai/jev-engine.js';
export { LLMEngine } from './ai/llm-engine.js';
export { HttpLLMClient } from './ai/http-llm-client.js';
export { DecisionRouter } from './ai/decision-router.js';

// ─── Browser ──────────────────────────────────────────────────────────────────
export { BrowserManager } from './browser/browser-manager.js';
export { PageAnalyzer } from './browser/page-analyzer.js';
export { ActionExecutor } from './browser/action-executor.js';

// ─── CAPTCHA ──────────────────────────────────────────────────────────────────
export { CaptchaSolver } from './captcha/captcha-solver.js';
export { CaptchaDetector } from './captcha/captcha-detector.js';

// ─── Configuration ────────────────────────────────────────────────────────────
export { resolveConfig } from './config.js';
export type { ResolvedConfig } from './config.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  JevBrowConfig,
  JevConfig,
  LLMConfig,
  BrowserConfig,
  BrowserType,
  BrowserChannel,
  StepLog,
  PromptRequest,
  ElementInfo,
  BoundingBox,
  PageState,
  ElementDecision,
  BooleanDecision,
  CaptchaType,
  CaptchaDetectionResult,
  CaptchaSolveResult,
  BrowserAction,
  LogLevel,
  AiAssertOptions,
  SeekGoalOptions,
  SeekGoalResult,
  AutoFillOptions,
  AutoFillResult,
} from './utils/types.js';

// ─── Utilities ────────────────────────────────────────────────────────────────
export { Logger } from './utils/logger.js';
export { withRetry, sleep } from './utils/retry.js';
