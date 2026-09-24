/**
 * Shared TypeScript types for JevBrow.
 */

// ─── Configuration ───────────────────────────────────────────────────────────

/** Jev AI (TypeSafe System One) configuration. */
export interface JevConfig {
  /** TypeSafe API key. Can be omitted if TYPESAFE_API_KEY environment variable is set. */
  apiKey?: string;
  /** Model identifier. Defaults to "jev-latest". */
  model?: string;
}

/** OpenAI-compatible LLM configuration (optional fallback). */
export interface LLMConfig {
  /** OpenAI API key. Can be omitted if OPENAI_API_KEY environment variable is set. */
  apiKey?: string;
  /** Model name, e.g. "gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "claude-5-sonnet", "deepseek-v4.1-flash". Defaults to "gpt-5.6-luna". */
  model?: string;
  /** Custom base URL for OpenAI-compatible providers (Ollama, vLLM, Azure, OpenRouter, Groq, DeepSeek). */
  baseUrl?: string;
  /** Alias for baseUrl. */
  baseURL?: string;
  /** Whether the LLM supports vision/image inputs. Defaults to false. */
  isVisionCapable?: boolean;
  /** Organization ID for multi-tenant accounts. */
  organization?: string;
  /** Project ID for scoped OpenAI API keys. */
  project?: string;
  /** Custom HTTP headers sent with every LLM request. */
  defaultHeaders?: Record<string, string>;
  /** Request timeout in milliseconds. Defaults to 60000. */
  timeout?: number;
  /** Max automatic retries for transient errors. Defaults to 2. */
  maxRetries?: number;
  /** Temperature for sampling (ignored automatically for reasoning models that disallow it). */
  temperature?: number;
  /** Use native fetch HTTP calls instead of the openai package. Defaults to false. */
  useHttp?: boolean;
}

/** Supported Playwright browser engines. */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/** Supported installed browser distribution channels. */
export type BrowserChannel =
  | 'chrome'
  | 'chrome-beta'
  | 'chrome-dev'
  | 'chrome-canary'
  | 'msedge'
  | 'msedge-beta'
  | 'msedge-dev'
  | 'chromium';

/** Browser launch configuration. */
export interface BrowserConfig {
  /** Browser engine: 'chromium', 'firefox', or 'webkit'. Defaults to 'chromium'. */
  browserType?: BrowserType;
  /**
   * Browser channel to use an installed system browser without downloading binaries
   * (e.g. 'chrome' for Google Chrome, 'msedge' for Microsoft Edge).
   */
  channel?: BrowserChannel | string;
  /** Automatically install browser binary via Playwright if not present. Defaults to true. */
  autoInstall?: boolean;
  /** Run in headless mode (no visible UI). Defaults to true. */
  headless?: boolean;
  /**
   * Lightweight mode — minimize memory usage by blocking images, fonts,
   * media, ads, and trackers. Disables GPU and extensions.
   * Defaults to false.
   */
  lightweight?: boolean;
  /** Path to a custom browser executable (e.g. Chrome, Brave, Edge). */
  executablePath?: string;
  /** Extra CLI args passed to the browser. */
  args?: string[];
  /** Default navigation timeout in ms. Defaults to 30000. */
  navigationTimeout?: number;
  /** Default action timeout in ms. Defaults to 10000. */
  actionTimeout?: number;
  /** Custom viewport dimensions. Defaults to 1920x1080 (or 1280x720 in lightweight mode). */
  viewport?: { width: number; height: number };
  /** Custom User-Agent string. */
  userAgent?: string;
  /** Proxy configuration for routing browser traffic. */
  proxy?: {
    server: string;
    bypass?: string;
    username?: string;
    password?: string;
  };
  /** Browser locale (e.g. "en-US"). */
  locale?: string;
  /** Timezone ID (e.g. "America/New_York"). */
  timezoneId?: string;
}

/** Event emitted for every automation step. */
export interface StepLog {
  /** Type of automation action performed. */
  type:
    | 'navigate'
    | 'click'
    | 'type'
    | 'press'
    | 'scroll'
    | 'ask'
    | 'ready_check'
    | 'captcha_detect'
    | 'captcha_solve'
    | 'llm_escalation'
    | 'assert'
    | 'seek_goal'
    | 'autofill';
  /** Human-readable description of what occurred. */
  message: string;
  /** Target description or intent. */
  target?: string;
  /** CSS selector used, if applicable. */
  selector?: string;
  /** Decision source: Jev AI, LLM, or DOM heuristic. */
  source?: 'jev' | 'llm' | 'heuristic';
  /** Confidence score (0–1), if applicable. */
  confidence?: number;
  /** Probability (0–1), if applicable. */
  probability?: number;
  /** Complete probability distribution over choices/options. */
  probabilities?: Record<string, number>;
  /** Step execution duration in milliseconds. */
  durationMs?: number;
  /** Current URL when step executed. */
  url?: string;
  /** Unix timestamp in milliseconds. */
  timestamp: number;
  /** Whether the step succeeded. */
  success?: boolean;
}

/** Dynamic input prompt request (for OTP, 2FA, or human-in-the-loop). */
export interface PromptRequest {
  message: string;
  type: 'otp' | 'text' | 'confirmation' | 'captcha';
  url?: string;
  options?: string[];
}

/** Top-level JevBrow configuration. */
export interface JevBrowConfig {
  jev?: JevConfig;
  llm?: LLMConfig;
  browser?: BrowserConfig;
  /** Logging severity level. Defaults to 'info'. */
  logLevel?: LogLevel;
  /** Print human-readable, formatted step summaries to stdout. Defaults to true. */
  showSteps?: boolean;
  /** Callback invoked on every automation step with structured metrics. */
  onStep?: (step: StepLog) => void;
  /** Callback for dynamic interactive prompts or 2FA/human-in-the-loop requests. */
  onPrompt?: (req: PromptRequest) => Promise<string> | string;
}

// ─── DOM / Page state ────────────────────────────────────────────────────────

/** A minimal representation of an interactive DOM element for Jev evaluation. */
export interface ElementInfo {
  /** Zero-based index in the extracted element list. */
  index: number;
  /** HTML tag name (lower-case). */
  tag: string;
  /** Visible text content (trimmed, max 200 chars). */
  text: string;
  /** Element `id` attribute. */
  id?: string;
  /** Element `class` attribute. */
  className?: string;
  /** Accessibility role. */
  role?: string;
  /** Aria label. */
  ariaLabel?: string;
  /** `href` for links. */
  href?: string;
  /** `type` for inputs. */
  inputType?: string;
  /** `placeholder` for inputs. */
  placeholder?: string;
  /** `name` attribute. */
  name?: string;
  /** `value` for inputs. */
  value?: string;
  /** Whether the element is visible on screen. */
  isVisible: boolean;
  /** Whether the element is enabled / not disabled. */
  isEnabled: boolean;
  /** Bounding box in viewport coordinates. */
  boundingBox?: BoundingBox;
  /** A CSS selector that uniquely identifies this element. */
  selector: string;
}

/** Bounding box in viewport pixels. */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Structured page state sent to Jev as `state`. */
export interface PageState {
  /** Current page URL. */
  url: string;
  /** Page title. */
  title: string;
  /** Interactive elements on the page. */
  elements: ElementInfo[];
  /** Brief description of visible page content. */
  visibleText?: string;
}

// ─── AI decision types ───────────────────────────────────────────────────────

/** Result of a Jev-powered element selection. */
export interface ElementDecision {
  /** The chosen element. */
  element: ElementInfo;
  /** Jev confidence in the decision (0–1). */
  confidence: number;
  /** Source of the decision. */
  source: 'jev' | 'llm';
}

/** Result of a Jev noul (yes/no) evaluation. */
export interface BooleanDecision {
  /** Probability the answer is yes (0–1). */
  probability: number;
  /** Whether we consider this "yes" (probability ≥ 0.5). */
  result: boolean;
  source: 'jev' | 'llm';
}

/** Supported CAPTCHA types that JevBrow can detect and attempt to solve. */
export type CaptchaType =
  | 'none'
  | 'image_selection'
  | 'text_distorted'
  | 'slider'
  | 'checkbox'
  | 'unknown';

/** Result of CAPTCHA detection. */
export interface CaptchaDetectionResult {
  type: CaptchaType;
  confidence: number;
}

/** Outcome of a CAPTCHA solve attempt. */
export interface CaptchaSolveResult {
  success: boolean;
  type: CaptchaType;
  attempts: number;
  error?: string;
}

// ─── Action types ────────────────────────────────────────────────────────────

/** High-level browser actions that the AI can request. */
export type BrowserAction =
  | { kind: 'click'; selector: string }
  | { kind: 'type'; selector: string; text: string }
  | { kind: 'scroll'; direction: 'up' | 'down' }
  | { kind: 'navigate'; url: string }
  | { kind: 'wait'; ms: number }
  | { kind: 'screenshot' }
  | { kind: 'press'; key: string };

/** Log severity levels. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

// ─── Idea 2: Next-Gen Automation Types ──────────────────────────────────────

/** Configuration options for self-healing AI assertions. */
export interface AiAssertOptions {
  /** Timeout in ms to wait for the condition to pass before failing. Defaults to 5000. */
  timeoutMs?: number;
  /** Minimum probability threshold (0.0–1.0) required to consider the assertion passed. Defaults to 0.65. */
  minConfidence?: number;
}

/** Configuration options for autonomous goal-seeking navigation. */
export interface SeekGoalOptions {
  /** High-level destination or objective (e.g. "Find API pricing table", "Navigate to contact form"). */
  goal: string;
  /** Maximum number of autonomous navigation clicks. Defaults to 5. */
  maxSteps?: number;
  /** Callback fired on each autonomous step. */
  onStep?: (step: { stepNumber: number; url: string; action: string; confidence: number }) => void;
}

/** Result returned by autonomous goal-seeking navigation. */
export interface SeekGoalResult {
  /** Whether the goal was successfully achieved on the final page. */
  success: boolean;
  /** Calibrated probability that the goal was achieved. */
  confidence: number;
  /** Total navigation steps taken. */
  stepsTaken: number;
  /** Chronological list of URLs visited during navigation. */
  path: string[];
  /** Final page URL reached. */
  finalUrl: string;
}

/** Configuration options for smart profile form auto-mapping. */
export interface AutoFillOptions {
  /** Automatically click submit after filling all matched fields. Defaults to false. */
  submitAfter?: boolean;
  /** Custom button label or natural language description for the submit button. Defaults to 'submit'. */
  submitText?: string;
  /** Minimum confidence threshold for matching an input field to a profile key. Defaults to 0.5. */
  minConfidence?: number;
}

/** Result returned by smart form auto-mapping. */
export interface AutoFillResult {
  /** All form inputs that were successfully matched and populated. */
  filledFields: Array<{
    selector: string;
    fieldDescription: string;
    profileKey: string;
    value: string | number | boolean;
    confidence: number;
  }>;
  /** Profile keys that could not be matched to any form input on the page. */
  unmappedKeys: string[];
}
