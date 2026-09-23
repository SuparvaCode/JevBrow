/**
 * Configuration loader with sensible defaults.
 * Reads from the provided config object, falling back to environment variables.
 */

import type {
  JevBrowConfig,
  JevConfig,
  LLMConfig,
  BrowserConfig,
  BrowserType,
  LogLevel,
  StepLog,
  PromptRequest,
} from './utils/types.js';

export interface ResolvedConfig {
  jev: Required<JevConfig>;
  llm: {
    apiKey: string;
    model: string;
    baseUrl: string;
    baseURL: string;
    isVisionCapable: boolean;
    organization: string;
    project: string;
    defaultHeaders: Record<string, string>;
    timeout: number;
    maxRetries: number;
    temperature?: number;
    useHttp: boolean;
  } | null;
  browser: Required<Omit<BrowserConfig, 'viewport' | 'userAgent' | 'proxy' | 'channel'>> & {
    browserType: BrowserType;
    channel?: string;
    autoInstall: boolean;
    viewport?: { width: number; height: number };
    userAgent?: string;
    proxy?: {
      server: string;
      bypass?: string;
      username?: string;
      password?: string;
    };
  };
  logLevel: LogLevel;
  showSteps: boolean;
  onStep?: (step: StepLog) => void;
  onPrompt?: (req: PromptRequest) => Promise<string> | string;
}

// Automatically load .env if available in Node 20.6+
try {
  if (typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === 'function') {
    (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
  }
} catch {
  // Ignore if .env is missing or already loaded
}

/**
 * Merge user-supplied config with env-var fallbacks and defaults.
 */
export function resolveConfig(cfg: JevBrowConfig = {}): ResolvedConfig {
  // ─── Jev ──────────────────────────────────────────────────────────────
  const jevApiKey =
    cfg.jev?.apiKey ||
    process.env.JEV_API_KEY ||
    process.env.TYPESAFE_API_KEY ||
    '';
  if (!jevApiKey) {
    throw new Error(
      'JevBrow: Jev API key is required. Pass it in config.jev.apiKey or set JEV_API_KEY / TYPESAFE_API_KEY environment variable.',
    );
  }

  const jev: Required<JevConfig> = {
    apiKey: jevApiKey,
    model: cfg.jev?.model ?? 'jev-latest',
  };

  // ─── LLM (optional) ──────────────────────────────────────────────────
  let llm: ResolvedConfig['llm'] = null;

  const rawBaseUrl =
    cfg.llm?.baseUrl ||
    cfg.llm?.baseURL ||
    process.env.OPENAI_BASE_URL ||
    '';
  const llmApiKey =
    cfg.llm?.apiKey ||
    process.env.OPENAI_API_KEY ||
    (rawBaseUrl ? 'local' : '');

  if (llmApiKey) {
    llm = {
      apiKey: llmApiKey,
      model: cfg.llm?.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      baseUrl: rawBaseUrl,
      baseURL: rawBaseUrl,
      isVisionCapable:
        cfg.llm?.isVisionCapable ??
        (process.env.OPENAI_VISION_CAPABLE === 'true' || false),
      organization:
        cfg.llm?.organization || process.env.OPENAI_ORGANIZATION || '',
      project: cfg.llm?.project || process.env.OPENAI_PROJECT || '',
      defaultHeaders: cfg.llm?.defaultHeaders ?? {},
      timeout: cfg.llm?.timeout ?? 60_000,
      maxRetries: cfg.llm?.maxRetries ?? 2,
      temperature: cfg.llm?.temperature,
      useHttp:
        cfg.llm?.useHttp ??
        (process.env.OPENAI_USE_HTTP === 'true' || false),
    };
  }

  // ─── Browser ──────────────────────────────────────────────────────────
  const browser: ResolvedConfig['browser'] = {
    browserType: cfg.browser?.browserType ?? 'chromium',
    channel: cfg.browser?.channel,
    autoInstall: cfg.browser?.autoInstall ?? true,
    headless: cfg.browser?.headless ?? true,
    lightweight: cfg.browser?.lightweight ?? false,
    executablePath: cfg.browser?.executablePath ?? '',
    args: cfg.browser?.args ?? [],
    navigationTimeout: cfg.browser?.navigationTimeout ?? 30_000,
    actionTimeout: cfg.browser?.actionTimeout ?? 10_000,
    viewport: cfg.browser?.viewport,
    userAgent: cfg.browser?.userAgent,
    proxy: cfg.browser?.proxy,
    locale: cfg.browser?.locale ?? 'en-US',
    timezoneId: cfg.browser?.timezoneId ?? 'America/New_York',
  };

  const logLevel: LogLevel = cfg.logLevel ?? 'info';
  const showSteps = cfg.showSteps ?? (logLevel !== 'silent');

  return {
    jev,
    llm,
    browser,
    logLevel,
    showSteps,
    onStep: cfg.onStep,
    onPrompt: cfg.onPrompt,
  };
}
