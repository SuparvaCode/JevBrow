/**
 * Decision Router — confidence-gated routing between Jev and LLM.
 *
 * Evaluates decisions through Jev AI (fast, calibrated probabilities):
 *   • High confidence (≥ threshold) -> Uses Jev decision directly (~100ms)
 *   • Low confidence (< threshold) -> Escalates to LLM if configured
 */

import { JevEngine } from './jev-engine.js';
import { LLMEngine } from './llm-engine.js';
import type { ResolvedConfig } from '../config.js';
import type {
  ElementInfo,
  PageState,
  ElementDecision,
  BooleanDecision,
  CaptchaDetectionResult,
} from '../utils/types.js';
import { Logger } from '../utils/logger.js';

/** Confidence threshold below which we consider escalating to the LLM. */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;

export class DecisionRouter {
  private jev: JevEngine;
  private llm: LLMEngine | null;
  private confidenceThreshold: number;
  private log: Logger;

  constructor(
    config: ResolvedConfig,
    confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
  ) {
    this.jev = new JevEngine(config);
    this.llm = config.llm ? new LLMEngine(config) : null;
    this.confidenceThreshold = confidenceThreshold;
    this.log = new Logger('JevBrow:Router', 'debug');
  }

  /** Get the Jev engine for direct access if needed. */
  get jevEngine(): JevEngine {
    return this.jev;
  }

  /** Get the LLM engine (may be null if not configured). */
  get llmEngine(): LLMEngine | null {
    return this.llm;
  }

  // ─── Element Selection ──────────────────────────────────────────────────

  /**
   * Choose the best element to interact with for a given goal.
   *
   * 1. Ask Jev first (fast, cheap).
   * 2. If Jev is confident enough, use its answer.
   * 3. If not, and LLM is available, escalate to LLM.
   * 4. If LLM is also unsure or unavailable, return Jev's best guess.
   */
  async chooseBestElement(
    elements: ElementInfo[],
    goal: string,
    pageState: PageState,
  ): Promise<ElementDecision | null> {
    // Step 1: Ask Jev
    const jevDecision = await this.jev.chooseBestElement(
      elements,
      goal,
      pageState,
    );

    // No element found at all
    if (!jevDecision) {
      this.log.debug('Jev found no matching element');

      // Try LLM as fallback
      if (this.llm) {
        this.log.info('Escalating to LLM — Jev found no match');
        const llmResult = await this.llm.chooseBestElement(
          elements,
          goal,
          pageState,
        );

        if (llmResult && llmResult.index >= 0) {
          const element = elements.find((el) => el.index === llmResult.index);
          if (element) {
            return {
              element,
              confidence: 0.6, // LLM doesn't give calibrated confidence
              source: 'llm',
            };
          }
        }
      }

      return null;
    }

    // Step 2: Check confidence
    if (jevDecision.confidence >= this.confidenceThreshold) {
      this.log.debug(
        `Jev confident (${jevDecision.confidence.toFixed(2)}) — using Jev decision`,
      );
      return jevDecision;
    }

    // Step 3: Low confidence — try LLM
    if (this.llm) {
      this.log.info(
        `Jev low confidence (${jevDecision.confidence.toFixed(2)}) — escalating to LLM`,
      );

      const llmResult = await this.llm.chooseBestElement(
        elements,
        goal,
        pageState,
      );

      if (llmResult && llmResult.index >= 0) {
        const element = elements.find((el) => el.index === llmResult.index);
        if (element) {
          return {
            element,
            confidence: 0.6,
            source: 'llm',
          };
        }
      }
    }

    // Step 4: Fall back to Jev's answer (better than nothing)
    this.log.debug('Using Jev low-confidence answer as fallback');
    return jevDecision;
  }

  // ─── Boolean Questions ──────────────────────────────────────────────────

  /**
   * Ask a yes/no question about the page.
   * Jev noul questions are already very reliable, so we rarely need LLM here.
   */
  async askBoolean(
    question: string,
    pageState: PageState,
  ): Promise<BooleanDecision> {
    return this.jev.askBoolean(question, pageState);
  }

  /** Check if the page is fully loaded. */
  async isPageReady(pageState: PageState): Promise<BooleanDecision> {
    return this.jev.isPageReady(pageState);
  }

  /** Check if an action achieved its goal. */
  async isActionComplete(
    goal: string,
    beforeState: PageState,
    afterState: PageState,
  ): Promise<BooleanDecision> {
    return this.jev.isActionComplete(goal, beforeState, afterState);
  }

  // ─── CAPTCHA ────────────────────────────────────────────────────────────

  /** Detect CAPTCHA type on the page. */
  async detectCaptcha(pageState: PageState): Promise<CaptchaDetectionResult> {
    return this.jev.detectCaptcha(pageState);
  }

  // ─── Multi-Question Evaluation ──────────────────────────────────────────

  /**
   * Quick page evaluation — asks multiple questions in a single Jev call.
   * Returns page readiness, CAPTCHA presence, and target element presence.
   */
  async evaluatePage(pageState: PageState, goal: string) {
    return this.jev.evaluatePage(pageState, goal);
  }

  // ─── Text Generation (LLM only) ────────────────────────────────────────

  /**
   * Generate text to type into a form field.
   * This ALWAYS uses the LLM — Jev does not generate text.
   */
  async generateFormInput(
    fieldDescription: string,
    context: string,
  ): Promise<string | null> {
    if (!this.llm) {
      this.log.warn(
        'Cannot generate form input — no LLM configured. Provide text directly.',
      );
      return null;
    }

    return this.llm.generateFormInput(fieldDescription, context);
  }

  // ─── Vision (LLM only) ─────────────────────────────────────────────────

  /**
   * Analyze a screenshot. Requires LLM with vision capability.
   */
  async analyzeScreenshot(
    screenshotBase64: string,
    prompt: string,
  ): Promise<string | null> {
    if (!this.llm) {
      this.log.warn('Cannot analyze screenshot — no LLM configured.');
      return null;
    }

    return this.llm.analyzeScreenshot(screenshotBase64, prompt);
  }

  /**
   * Direct text chat / completion via configured LLM.
   */
  async chat(prompt: string): Promise<string | null> {
    if (!this.llm) {
      this.log.warn('Cannot perform chat/summarize — no LLM configured.');
      return null;
    }
    return this.llm.chat(prompt);
  }

  // ─── Goal Seeking & Form Mapping (Idea 2) ──────────────────────────────

  /**
   * Check whether the current page state achieves the given goal.
   */
  async evaluateGoalReached(
    goal: string,
    pageState: PageState,
  ): Promise<BooleanDecision> {
    return this.jev.evaluateGoalReached(goal, pageState);
  }

  /**
   * Select the most promising navigation link or button that moves closer to the goal.
   */
  async chooseGoalNavigation(
    elements: ElementInfo[],
    goal: string,
    pageState: PageState,
  ): Promise<ElementDecision | null> {
    return this.jev.chooseGoalNavigation(elements, goal, pageState);
  }

  /**
   * Match form fields against available user profile keys in a single batched call.
   */
  async matchFormFields(
    formFields: Array<{ index: number; info: ElementInfo }>,
    profileKeys: string[],
  ): Promise<Record<number, { key: string; confidence: number }>> {
    return this.jev.matchFormFields(formFields, profileKeys);
  }
}
