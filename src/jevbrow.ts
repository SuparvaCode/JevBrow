/**
 * JevBrow — Natural language browser driver and automation framework.
 *
 * Core capabilities:
 *   • Jev AI (TypeSafe System One) — sub-100ms structured decision engine
 *   • OpenAI-compatible LLM — generative text, complex reasoning, and vision
 *   • Playwright — high-performance browser engine (Chromium, Firefox, WebKit, Edge)
 *   • Human-in-the-loop & smart waiting — pause for 2FA/OTP and evaluate page readiness
 *
 * Quickstart:
 *   const { browser, page } = await JevBrow.open("https://example.com");
 *   await page.aiClick("the login button");
 *   await page.aiType("email field", "user@example.com");
 *   await page.aiWaitFor("the account dashboard has loaded");
 *   await browser.close();
 */

import type { Page } from 'playwright';
import type {
  JevBrowConfig,
  ElementDecision,
  BooleanDecision,
  CaptchaSolveResult,
  CaptchaDetectionResult,
  ElementInfo,
  BoundingBox,
  PromptRequest,
  AiAssertOptions,
  SeekGoalOptions,
  SeekGoalResult,
  AutoFillOptions,
  AutoFillResult,
} from './utils/types.js';
import { resolveConfig, type ResolvedConfig } from './config.js';
import { DecisionRouter } from './ai/decision-router.js';
import { BrowserManager } from './browser/browser-manager.js';
import { PageAnalyzer } from './browser/page-analyzer.js';
import { ActionExecutor } from './browser/action-executor.js';
import { CaptchaSolver } from './captcha/captcha-solver.js';
import { Logger } from './utils/logger.js';
import { sleep } from './utils/retry.js';

/**
 * Error thrown when a semantic AI assertion fails.
 */
export class AssertionError extends Error {
  readonly probability: number;
  readonly threshold: number;
  readonly assertion: string;
  readonly url: string;

  constructor(
    message: string,
    details: { assertion: string; probability: number; threshold: number; url: string },
  ) {
    super(message);
    this.name = 'AssertionError';
    this.assertion = details.assertion;
    this.probability = details.probability;
    this.threshold = details.threshold;
    this.url = details.url;
  }
}

/**
 * AI-enhanced page wrapper providing natural-language browser interactions.
 */
export class JevPage {
  /** Direct access to the underlying Playwright Page. */
  readonly page: Page;

  private router: DecisionRouter;
  private analyzer: PageAnalyzer;
  private executor: ActionExecutor;
  private captchaSolver: CaptchaSolver;
  private browserManager: BrowserManager;
  private log: Logger;
  private config: ResolvedConfig;

  constructor(
    page: Page,
    router: DecisionRouter,
    analyzer: PageAnalyzer,
    executor: ActionExecutor,
    captchaSolver: CaptchaSolver,
    browserManager: BrowserManager,
    config: ResolvedConfig,
  ) {
    this.page = page;
    this.router = router;
    this.analyzer = analyzer;
    this.executor = executor;
    this.captchaSolver = captchaSolver;
    this.browserManager = browserManager;
    this.config = config;
    this.log = new Logger('JevBrow:Page', config.logLevel);
  }

  // ─── Navigation ─────────────────────────────────────────────────────────

  /**
   * Navigate to a URL and wait for the page to be ready.
   */
  async aiNavigate(url: string): Promise<void> {
    const start = Date.now();
    this.log.info(`Navigating to: ${url}`);
    await this.executor.navigate(this.page, url);

    // Wait for page to be ready
    const state = await this.analyzer.getPageState(this.page);
    const ready = await this.router.isPageReady(state);

    if (!ready.result) {
      this.log.debug('Page not ready — waiting additional 2s');
      await sleep(2000);
    }

    this.log.step({
      type: 'navigate',
      message: `Navigated to ${url}`,
      url: this.page.url(),
      durationMs: Date.now() - start,
      success: true,
    });
  }

  // ─── Element Interaction ────────────────────────────────────────────────

  /**
   * Click an element described in natural language.
   *
   * @param description  Natural language description of what to click.
   *                     Examples: "the login button", "Sign Up link", "Submit"
   * @returns The decision made (element + confidence + source).
   */
  async aiClick(description: string): Promise<ElementDecision | null> {
    const start = Date.now();
    this.log.info(`AI Click: "${description}"`);

    const state = await this.analyzer.getPageState(this.page);
    const decision = await this.router.chooseBestElement(
      state.elements,
      `Click: ${description}`,
      state,
    );

    if (!decision) {
      this.log.warn(`No element found for: "${description}"`);
      this.log.step({
        type: 'click',
        message: `No matching element found for "${description}"`,
        target: description,
        durationMs: Date.now() - start,
        success: false,
      });
      return null;
    }

    this.log.info(
      `Clicking element [${decision.element.index}] (${decision.source}, confidence: ${decision.confidence.toFixed(2)})`,
    );

    await this.executor.click(this.page, decision.element.selector);

    this.log.step({
      type: 'click',
      message: `Clicked "${description}" -> <${decision.element.tag}> "${decision.element.text}"`,
      target: description,
      selector: decision.element.selector,
      source: decision.source,
      confidence: decision.confidence,
      url: this.page.url(),
      durationMs: Date.now() - start,
      success: true,
    });

    return decision;
  }

  /**
   * Type text into an element described in natural language.
   *
   * @param description  Natural language description of the input field.
   *                     Examples: "email field", "search box", "password input"
   * @param text         The text to type. If not provided and LLM is available,
   *                     the LLM will generate appropriate text.
   * @param context      Optional context for LLM text generation.
   */
  async aiType(
    description: string,
    text?: string,
    context?: string,
  ): Promise<ElementDecision | null> {
    const start = Date.now();
    this.log.info(`AI Type into: "${description}"`);

    const state = await this.analyzer.getPageState(this.page);
    const decision = await this.router.chooseBestElement(
      state.elements,
      `Type into: ${description}`,
      state,
    );

    if (!decision) {
      this.log.warn(`No input field found for: "${description}"`);
      this.log.step({
        type: 'type',
        message: `No input field found for "${description}"`,
        target: description,
        durationMs: Date.now() - start,
        success: false,
      });
      return null;
    }

    // Generate text if not provided
    let inputText = text;
    if (!inputText) {
      inputText = (await this.router.generateFormInput(
        description,
        context || `Page: ${state.url}`,
      )) ?? undefined;
      if (!inputText) {
        this.log.warn('No text provided and LLM not available for generation');
        return null;
      }
      this.log.debug(`LLM generated text: "${inputText}"`);
    }

    this.log.info(
      `Typing into element [${decision.element.index}] (${decision.source}, confidence: ${decision.confidence.toFixed(2)})`,
    );

    await this.executor.type(this.page, decision.element.selector, inputText);

    this.log.step({
      type: 'type',
      message: `Typed into "${description}": "${inputText.length > 25 ? inputText.slice(0, 22) + '…' : inputText}"`,
      target: description,
      selector: decision.element.selector,
      source: decision.source,
      confidence: decision.confidence,
      url: this.page.url(),
      durationMs: Date.now() - start,
      success: true,
    });

    return decision;
  }

  /**
   * One-line natural language login helper.
   * Automatically finds username/email input, password input, and clicks the submit button.
   *
   * @example
   * await page.aiLogin({ username: 'alice', password: 'password123' });
   */
  async aiLogin(options: {
    username?: string;
    email?: string;
    password: string;
    submitText?: string;
    waitMs?: number;
  }): Promise<{ success: boolean; url: string }> {
    const userVal = options.username || options.email || '';
    if (userVal) {
      await this.aiType('username or email or login field', userVal);
    }
    await this.aiType('password field', options.password);
    await this.aiClick(options.submitText || 'login or sign in or submit button');
    await sleep(options.waitMs ?? 2500);

    const hasError = await this.aiAsk('Is there an invalid login error or incorrect credentials alert?');
    return {
      success: !hasError.result,
      url: this.page.url(),
    };
  }

  /**
   * Press a keyboard key.
   */
  async aiPress(key: string): Promise<void> {
    const start = Date.now();
    this.log.debug(`Pressing key: ${key}`);
    await this.executor.pressKey(this.page, key);
    this.log.step({
      type: 'press',
      message: `Pressed key: ${key}`,
      durationMs: Date.now() - start,
      success: true,
    });
  }

  /**
   * Scroll the page.
   */
  async aiScroll(direction: 'up' | 'down' = 'down'): Promise<void> {
    const start = Date.now();
    await this.executor.scroll(this.page, direction);
    this.log.step({
      type: 'scroll',
      message: `Scrolled ${direction}`,
      durationMs: Date.now() - start,
      success: true,
    });
  }

  // ─── CAPTCHA (Experimental Heuristics) ───────────────────────────────────

  /**
   * Experimental: Attempt to detect and solve simple challenges.
   *
   * NOTE: Jev AI operates purely on text/DOM metadata and has no vision capability.
   * Any visual image challenge requires a configured Vision LLM fallback, and modern
   * enterprise anti-bot solutions (reCAPTCHA Enterprise, Cloudflare) generally block
   * automated browser sessions. For protected flows, prefer using the `onPrompt` hook.
   */
  async aiSolveCaptcha(): Promise<CaptchaSolveResult> {
    const start = Date.now();
    const result = await this.captchaSolver.solve(this.page);
    this.log.step({
      type: 'captcha_solve',
      message: result.success
        ? `Solved ${result.type} CAPTCHA (${result.attempts} attempts)`
        : `Could not solve ${result.type} CAPTCHA`,
      confidence: result.success ? 1 : 0,
      url: this.page.url(),
      durationMs: Date.now() - start,
      success: result.success,
    });
    return result;
  }

  /**
   * Just detect CAPTCHA type without solving.
   */
  async aiDetectCaptcha(): Promise<CaptchaDetectionResult> {
    const start = Date.now();
    const result = await this.captchaSolver.detect(this.page);
    this.log.step({
      type: 'captcha_detect',
      message: `Detected CAPTCHA: ${result.type}`,
      confidence: result.confidence,
      url: this.page.url(),
      durationMs: Date.now() - start,
      success: result.type !== 'none',
    });
    return result;
  }

  // ─── Page Analysis ──────────────────────────────────────────────────────

  /**
   * Ask a yes/no question about the current page.
   *
   * @param question  e.g. "Is the user logged in?", "Is there an error message?"
   */
  async aiAsk(question: string): Promise<BooleanDecision> {
    const start = Date.now();
    const state = await this.analyzer.getPageState(this.page);
    const decision = await this.router.askBoolean(question, state);

    this.log.step({
      type: 'ask',
      message: `"${question}" -> ${decision.result ? 'YES' : 'NO'}`,
      target: question,
      probability: decision.probability,
      source: decision.source,
      url: this.page.url(),
      durationMs: Date.now() - start,
      success: true,
    });

    return decision;
  }

  /**
   * Check if the page is ready for interaction.
   */
  async aiIsReady(): Promise<boolean> {
    const start = Date.now();
    const state = await this.analyzer.getPageState(this.page);
    const decision = await this.router.isPageReady(state);

    this.log.step({
      type: 'ready_check',
      message: `Page ready: ${decision.result ? 'Ready' : 'Not ready'}`,
      probability: decision.probability,
      source: decision.source,
      url: this.page.url(),
      durationMs: Date.now() - start,
      success: decision.result,
    });

    return decision.result;
  }

  /**
   * Check if an action achieved its goal by comparing page state.
   */
  async aiVerifyAction(
    goal: string,
    beforeState: Awaited<ReturnType<PageAnalyzer['getPageState']>>,
  ): Promise<BooleanDecision> {
    const afterState = await this.analyzer.getPageState(this.page);
    return this.router.isActionComplete(goal, beforeState, afterState);
  }

  /**
   * Get the structured page state (for debugging or custom logic).
   */
  async getPageState() {
    return this.analyzer.getPageState(this.page);
  }

  // ─── Screenshots ───────────────────────────────────────────────────────

  /**
   * Take a screenshot of the page.
   * @returns Base64-encoded PNG string.
   */
  async screenshot(fullPage: boolean = false): Promise<string> {
    return this.browserManager.screenshot(this.page, fullPage);
  }

  /**
   * Analyze the current page screenshot with the LLM.
   * Requires LLM with vision capability.
   */
  async aiAnalyzeScreen(prompt: string): Promise<string | null> {
    const screenshot = await this.screenshot();
    return this.router.analyzeScreenshot(screenshot, prompt);
  }

  // ─── Convenience ────────────────────────────────────────────────────────

  /** Get the current page URL. */
  url(): string {
    return this.page.url();
  }

  /** Get the current page title. */
  async title(): Promise<string> {
    return this.page.title();
  }

  /** Wait for a specific amount of time. */
  async wait(ms: number): Promise<void> {
    await sleep(ms);
  }

  /** Wait for a selector to appear. */
  async waitForSelector(
    selector: string,
    timeout: number = 10_000,
  ): Promise<void> {
    await this.page.waitForSelector(selector, { timeout });
  }

  /** Close this page. */
  async close(): Promise<void> {
    await this.page.close();
  }

  // ─── Natural Language Waiting & Polling ─────────────────────────────────

  /**
   * Smart AI wait: polls the page until a natural-language condition is met
   * using sub-100ms Jev AI probability checks.
   *
   * @example
   * await page.aiWaitFor('the trading dashboard has loaded');
   */
  async aiWaitFor(
    condition: string,
    options: {
      timeoutMs?: number;
      intervalMs?: number;
      minProbability?: number;
    } = {},
  ): Promise<BooleanDecision> {
    const timeout = options.timeoutMs ?? 15_000;
    const interval = options.intervalMs ?? 500;
    const minProb = options.minProbability ?? 0.6;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const state = await this.analyzer.getPageState(this.page);
      const decision = await this.router.askBoolean(condition, state);
      if (decision.result && decision.probability >= minProb) {
        this.log.debug(`aiWaitFor matched "${condition}" (prob: ${decision.probability})`);
        return decision;
      }
      await sleep(interval);
    }

    // Final evaluation if timed out
    const finalState = await this.analyzer.getPageState(this.page);
    return this.router.askBoolean(condition, finalState);
  }

  // ─── Self-Healing Assertions (Idea 2) ───────────────────────────────────

  /**
   * Resilient E2E test assertion powered by Jev AI System One.
   *
   * Polls the page state until the assertion passes with high confidence,
   * or throws an `AssertionError` if the condition is not met within timeout.
   * Eliminates brittle CSS selector maintenance across UI redesigns.
   *
   * @param assertion  Natural language assertion (e.g. "The items were saved to the cart")
   * @param options    Timeout and minimum confidence configuration
   * @throws {AssertionError} If the assertion does not reach minConfidence within timeout
   *
   * @example
   * await page.aiAssert('The checkout completed successfully and an order number is visible');
   * await page.aiAssert('No credit card validation errors are displayed');
   */
  async aiAssert(
    assertion: string,
    options: AiAssertOptions = {},
  ): Promise<BooleanDecision> {
    const timeout = options.timeoutMs ?? 5_000;
    const minConfidence = options.minConfidence ?? 0.65;
    const start = Date.now();

    let lastDecision: BooleanDecision | null = null;

    while (Date.now() - start < timeout) {
      const state = await this.analyzer.getPageState(this.page);
      lastDecision = await this.router.askBoolean(assertion, state);

      if (lastDecision.result && lastDecision.probability >= minConfidence) {
        this.log.step({
          type: 'assert',
          message: `ASSERT PASSED: "${assertion}" (${(lastDecision.probability * 100).toFixed(1)}%)`,
          target: assertion,
          probability: lastDecision.probability,
          source: lastDecision.source,
          url: this.page.url(),
          durationMs: Date.now() - start,
          success: true,
        });
        return lastDecision;
      }

      await sleep(350);
    }

    // Final check
    const finalState = await this.analyzer.getPageState(this.page);
    lastDecision = await this.router.askBoolean(assertion, finalState);

    const passed = lastDecision.result && lastDecision.probability >= minConfidence;

    this.log.step({
      type: 'assert',
      message: `${passed ? 'ASSERT PASSED' : 'ASSERT FAILED'}: "${assertion}" (${(lastDecision.probability * 100).toFixed(1)}%)`,
      target: assertion,
      probability: lastDecision.probability,
      source: lastDecision.source,
      url: this.page.url(),
      durationMs: Date.now() - start,
      success: passed,
    });

    if (!passed) {
      throw new AssertionError(
        `Assertion failed: "${assertion}" (probability: ${lastDecision.probability.toFixed(3)}, required: ${minConfidence}) on ${this.page.url()}`,
        {
          assertion,
          probability: lastDecision.probability,
          threshold: minConfidence,
          url: this.page.url(),
        },
      );
    }

    return lastDecision;
  }

  // ─── Autonomous Goal-Seeking Navigation (Idea 2) ────────────────────────

  /**
   * Autonomous goal-seeking crawler.
   *
   * Traverses links and menus toward an abstract objective using sub-100ms
   * Jev System One probability checks. Does not require hardcoded click selectors.
   *
   * @param options  Goal description, maxSteps, and step callback
   *
   * @example
   * const result = await page.aiSeekGoal('Find the developer API documentation');
   * console.log(result.success, result.path);
   */
  async aiSeekGoal(
    options: SeekGoalOptions | string,
  ): Promise<SeekGoalResult> {
    const opts: SeekGoalOptions = typeof options === 'string' ? { goal: options } : options;
    const goal = opts.goal;
    const maxSteps = opts.maxSteps ?? 5;
    const path: string[] = [this.page.url()];
    const start = Date.now();

    this.log.info(`Starting autonomous goal search: "${goal}" (max ${maxSteps} steps)`);

    for (let step = 1; step <= maxSteps; step++) {
      const state = await this.analyzer.getPageState(this.page);

      // 1. Check if current page already satisfies the goal
      const goalCheck = await this.router.evaluateGoalReached(goal, state);
      if (goalCheck.result && goalCheck.probability >= 0.7) {
        this.log.step({
          type: 'seek_goal',
          message: `Goal reached at ${this.page.url()} (${(goalCheck.probability * 100).toFixed(1)}%)`,
          target: goal,
          probability: goalCheck.probability,
          durationMs: Date.now() - start,
          success: true,
        });

        return {
          success: true,
          confidence: goalCheck.probability,
          stepsTaken: step - 1,
          path,
          finalUrl: this.page.url(),
        };
      }

      // 2. Select next navigation hop
      const nextNav = await this.router.chooseGoalNavigation(state.elements, goal, state);
      if (!nextNav) {
        this.log.debug(`No further promising links found for goal: "${goal}"`);
        break;
      }

      const linkText = nextNav.element.text || nextNav.element.ariaLabel || nextNav.element.tag;
      this.log.info(`[Step ${step}/${maxSteps}] Navigating via: "${linkText}" (confidence: ${nextNav.confidence.toFixed(2)})`);

      if (opts.onStep) {
        opts.onStep({
          stepNumber: step,
          url: this.page.url(),
          action: `Click "${linkText}"`,
          confidence: nextNav.confidence,
        });
      }

      // 3. Click the chosen link
      await this.executor.click(this.page, nextNav.element.selector);
      await this.page.waitForLoadState('domcontentloaded').catch(() => {});
      await sleep(1000);

      const currentUrl = this.page.url();
      if (path[path.length - 1] !== currentUrl) {
        path.push(currentUrl);
      }
    }

    // Final evaluation after all steps
    const finalState = await this.analyzer.getPageState(this.page);
    const finalGoalCheck = await this.router.evaluateGoalReached(goal, finalState);
    const success = finalGoalCheck.result && finalGoalCheck.probability >= 0.65;

    this.log.step({
      type: 'seek_goal',
      message: `Goal search finished: ${success ? 'SUCCESS' : 'INCOMPLETE'} (${path.length} URLs)`,
      target: goal,
      probability: finalGoalCheck.probability,
      durationMs: Date.now() - start,
      success,
    });

    return {
      success,
      confidence: finalGoalCheck.probability,
      stepsTaken: path.length - 1,
      path,
      finalUrl: this.page.url(),
    };
  }

  // ─── Smart Profile Form Auto-Mapper (Idea 2) ────────────────────────────

  /**
   * Automatically match and populate complex web forms from a user data profile.
   *
   * Maps all form inputs to user profile keys in a single batched Jev System One call (~100ms),
   * then types the corresponding values into the inputs.
   *
   * @param profile  Key-value map of user data (e.g. { fullName: '...', email: '...', zipCode: '...' })
   * @param options  Form submission and confidence settings
   *
   * @example
   * await page.aiAutoFillForm({
   *   fullName: 'Alex Smith',
   *   email: 'alex@example.com',
   *   phone: '555-1234',
   * }, { submitAfter: true });
   */
  async aiAutoFillForm(
    profile: Record<string, string | number | boolean>,
    options: AutoFillOptions = {},
  ): Promise<AutoFillResult> {
    const start = Date.now();
    const minConfidence = options.minConfidence ?? 0.5;
    const profileKeys = Object.keys(profile);

    this.log.info(`Auto-filling form with ${profileKeys.length} profile fields`);

    const state = await this.analyzer.getPageState(this.page);

    // Identify editable input elements
    const formFields = state.elements
      .filter((el) => {
        if (el.tag === 'input') {
          const type = (el.inputType || 'text').toLowerCase();
          return !['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio'].includes(type);
        }
        return el.tag === 'textarea' || el.tag === 'select';
      })
      .map((el) => ({
        index: el.index,
        info: el,
      }));

    if (formFields.length === 0) {
      this.log.warn('No editable form inputs found on this page');
      return { filledFields: [], unmappedKeys: profileKeys };
    }

    // Run single batched Jev System One match
    const matchedMap = await this.router.matchFormFields(formFields, profileKeys);

    const filledFields: AutoFillResult['filledFields'] = [];
    const usedKeys = new Set<string>();

    for (const field of formFields) {
      const match = matchedMap[field.index];
      if (match && match.confidence >= minConfidence && profile[match.key] !== undefined) {
        const val = profile[match.key];
        const strVal = String(val);

        try {
          if (field.info.tag === 'select') {
            await this.page.selectOption(field.info.selector, { label: strVal }).catch(() =>
              this.page.selectOption(field.info.selector, strVal),
            );
          } else {
            await this.page.fill(field.info.selector, strVal);
          }

          filledFields.push({
            selector: field.info.selector,
            fieldDescription: `${field.info.tag}[name="${field.info.name || ''}", placeholder="${field.info.placeholder || ''}"]`,
            profileKey: match.key,
            value: val,
            confidence: match.confidence,
          });
          usedKeys.add(match.key);
        } catch (err) {
          this.log.warn(`Failed to fill form input ${field.info.selector}: ${err}`);
        }
      }
    }

    const unmappedKeys = profileKeys.filter((k) => !usedKeys.has(k));

    if (options.submitAfter) {
      const submitText = options.submitText || 'submit';
      this.log.info(`Auto-submitting form with trigger: "${submitText}"`);
      await this.aiClick(submitText);
    }

    this.log.step({
      type: 'autofill',
      message: `Auto-filled ${filledFields.length}/${formFields.length} inputs (${unmappedKeys.length} unmapped keys)`,
      durationMs: Date.now() - start,
      success: filledFields.length > 0,
    });

    return {
      filledFields,
      unmappedKeys,
    };
  }

  // ─── Semantic Element Inspection & Coordinates ──────────────────────────

  /**
   * Find an element and retrieve its bounding box coordinates and center point.
   * Useful for visual overlays, coordinate clicks, or pairing with vision models.
   *
   * @example
   * const btn = await page.aiFindElement('sign in button');
   * console.log(btn?.box.centerX, btn?.box.centerY);
   */
  async aiFindElement(description: string): Promise<{
    element: ElementInfo;
    selector: string;
    confidence: number;
    source: string;
    box: BoundingBox & { centerX: number; centerY: number };
  } | null> {
    const state = await this.analyzer.getPageState(this.page);
    const decision = await this.router.chooseBestElement(
      state.elements,
      `Find: ${description}`,
      state,
    );
    if (!decision) return null;

    let box: BoundingBox = decision.element.boundingBox || { x: 0, y: 0, width: 0, height: 0 };
    try {
      const loc = this.page.locator(decision.element.selector);
      const liveBox = await loc.boundingBox();
      if (liveBox) {
        box = liveBox;
      }
    } catch {
      // Fall back to extracted DOM bounding box
    }

    return {
      element: decision.element,
      selector: decision.element.selector,
      confidence: decision.confidence,
      source: decision.source,
      box: {
        ...box,
        centerX: Math.round(box.x + box.width / 2),
        centerY: Math.round(box.y + box.height / 2),
      },
    };
  }

  // ─── Page Content Summarization & Data Extraction ───────────────────────

  /**
   * Generate an intelligent summary of page content or answer specific queries
   * about page statistics, tables, and visible data using LLM reasoning.
   *
   * @example
   * const stats = await page.aiSummarize('Extract all executive metrics, revenue, and order numbers');
   */
  async aiSummarize(
    instruction: string = 'Summarize key information, metrics, and stats visible on this page',
  ): Promise<string> {
    const pageText = await this.page.evaluate(() => document.body.innerText);
    const cleanContent = pageText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join('\n');
    const title = await this.page.title();
    const url = this.page.url();

    const prompt = `You are an AI browser assistant analyzing a web page.
Page Title: "${title}"
Page URL: ${url}

User Instruction: ${instruction}

Page Content:
${cleanContent.slice(0, 6000)}

Please fulfill the instruction directly. Include all exact numbers, revenue, statistics, and entities visible.`;

    const result = await this.router.chat(prompt);
    if (result && result.trim().length > 0) return result.trim();

    // Fallback if no LLM configured: extract clean formatted snippet lines
    return cleanContent
      .split('\n')
      .slice(0, 40)
      .join('\n');
  }

  /**
   * Extract structured JSON data directly from the page according to natural language instructions.
   *
   * @example
   * const data = await page.aiExtract<{ sales: string; profit: string }>('Extract net sales and profit');
   */
  async aiExtract<T = Record<string, any>>(instruction: string): Promise<T> {
    const prompt = `${instruction}
Respond with ONLY valid JSON (no markdown formatting, no code fences).`;
    const raw = await this.aiSummarize(prompt);
    try {
      const clean = raw.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
      return JSON.parse(clean);
    } catch {
      return { rawText: raw } as unknown as T;
    }
  }

  // ─── Screenshots & Vision ───────────────────────────────────────────────

  /**
   * Capture a screenshot with flexible output formats (Buffer, base64, or save to path).
   */
  async aiScreenshot(
    options: { fullPage?: boolean; base64?: boolean; path?: string } = {},
  ): Promise<Buffer | string> {
    const buffer = await this.page.screenshot({
      path: options.path,
      fullPage: options.fullPage ?? true,
    });
    if (options.base64) {
      return buffer.toString('base64');
    }
    return buffer;
  }

  // ─── Human-in-the-Loop & Dynamic Prompts ─────────────────────────────────

  /**
   * Request dynamic external input during automation (e.g. OTP, 2FA, confirmation).
   * Calls the configured `onPrompt` callback.
   */
  async aiRequestInput(
    prompt: string,
    type: 'otp' | 'text' | 'confirmation' | 'captcha' = 'text',
  ): Promise<string> {
    if (this.config.onPrompt) {
      return await this.config.onPrompt({
        message: prompt,
        type,
        url: this.page.url(),
      });
    }
    this.log.warn(`No onPrompt handler configured for prompt: "${prompt}"`);
    return '';
  }

  // ─── AI Orchestrator / Tool-Calling Interface ───────────────────────────

  /**
   * Get tool definitions for pairing JevBrow with OpenAI Function Calling,
   * LangChain, Vercel AI SDK, or custom agent orchestrators.
   */
  getToolDefinitions(): Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }> {
    return [
      {
        name: 'navigate',
        description: 'Navigate the browser to a given URL.',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: 'The URL to visit' } },
          required: ['url'],
        },
      },
      {
        name: 'click',
        description: 'Click an element described in natural language.',
        parameters: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Natural language description of what to click' },
          },
          required: ['description'],
        },
      },
      {
        name: 'type',
        description: 'Type text into an input field described in natural language.',
        parameters: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'The field to type into' },
            text: { type: 'string', description: 'The text value to enter' },
          },
          required: ['description', 'text'],
        },
      },
      {
        name: 'login',
        description: 'Automatically fill credentials and submit a login form.',
        parameters: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
          required: ['password'],
        },
      },
      {
        name: 'ask',
        description: 'Ask a yes/no question about the current page state.',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
        },
      },
      {
        name: 'waitFor',
        description: 'Wait for a natural-language condition to become true.',
        parameters: {
          type: 'object',
          properties: { condition: { type: 'string' } },
          required: ['condition'],
        },
      },
      {
        name: 'summarize',
        description: 'Summarize or extract stats/metrics from the page using LLM.',
        parameters: {
          type: 'object',
          properties: { instruction: { type: 'string' } },
        },
      },
      {
        name: 'screenshot',
        description: 'Take a screenshot of the current page (base64).',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'findElement',
        description: 'Locate an element and get its bounding box coordinates.',
        parameters: {
          type: 'object',
          properties: { description: { type: 'string' } },
          required: ['description'],
        },
      },
    ];
  }

  /**
   * Execute a tool action dynamically (for LLM agent loops).
   */
  async executeAction(action: string, params: Record<string, any> = {}): Promise<any> {
    switch (action) {
      case 'navigate':
        return await this.aiNavigate(params.url);
      case 'click':
        return await this.aiClick(params.description);
      case 'type':
        return await this.aiType(params.description, params.text);
      case 'login':
        return await this.aiLogin(params as any);
      case 'ask':
        return await this.aiAsk(params.question);
      case 'waitFor':
        return await this.aiWaitFor(params.condition, params);
      case 'summarize':
        return await this.aiSummarize(params.instruction);
      case 'screenshot':
        return await this.aiScreenshot({ base64: true, fullPage: params.fullPage });
      case 'findElement':
        return await this.aiFindElement(params.description);
      default:
        throw new Error(`Unsupported JevBrow action: "${action}"`);
    }
  }
}

// ─── Main JevBrow Class ───────────────────────────────────────────────────────

/**
 * JevBrow — AI-powered browser automation.
 *
 * The main entry point. Create an instance, launch the browser,
 * and create AI-enhanced pages for automation.
 */
export class JevBrow {
  private config: ResolvedConfig;
  private browserManager: BrowserManager;
  private router: DecisionRouter;
  private analyzer: PageAnalyzer;
  private executor: ActionExecutor;
  private captchaSolver: CaptchaSolver;
  private log: Logger;

  constructor(userConfig: JevBrowConfig = {}) {
    this.config = resolveConfig(userConfig);
    Logger.setGlobalLevel(this.config.logLevel);
    Logger.setShowSteps(this.config.showSteps);
    if (this.config.onStep) {
      Logger.addStepListener(this.config.onStep);
    }
    this.browserManager = new BrowserManager(this.config);
    this.router = new DecisionRouter(this.config);
    this.analyzer = new PageAnalyzer();
    this.executor = new ActionExecutor();
    this.captchaSolver = new CaptchaSolver(
      this.router,
      this.executor,
      this.analyzer,
    );
    this.log = new Logger('JevBrow', this.config.logLevel);
  }

  /**
   * One-line quick launcher: launches the browser, creates a page, and navigates.
   *
   * @example
   * const { browser, page } = await JevBrow.open('https://example.com');
   * await page.aiClick('login');
   * await browser.close();
   */
  static async open(
    url?: string,
    userConfig: JevBrowConfig = {},
  ): Promise<{ browser: JevBrow; page: JevPage }> {
    const browser = new JevBrow(userConfig);
    await browser.launch();
    const page = await browser.newPage();
    if (url) {
      await page.aiNavigate(url);
    }
    return { browser, page };
  }

  /**
   * Launch the browser.
   * Must be called before creating pages.
   */
  async launch(): Promise<void> {
    this.log.info('Launching JevBrow…');
    await this.browserManager.launch();
    this.log.info('JevBrow is ready! 🚀');
  }

  /**
   * Create a new AI-enhanced page.
   */
  async newPage(): Promise<JevPage> {
    const playwrightPage = await this.browserManager.newPage();

    return new JevPage(
      playwrightPage,
      this.router,
      this.analyzer,
      this.executor,
      this.captchaSolver,
      this.browserManager,
      this.config,
    );
  }

  /**
   * Close the browser and clean up all resources.
   */
  async close(): Promise<void> {
    await this.browserManager.close();
    this.log.info('JevBrow closed');
  }

  /** Check if the browser is currently running. */
  get isRunning(): boolean {
    return this.browserManager.isLaunched;
  }

  /** Get the decision router for advanced usage. */
  get decisionRouter(): DecisionRouter {
    return this.router;
  }
}
