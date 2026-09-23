/**
 * Jev AI Decision Engine — wraps @typesafe-ai/sdk for browser automation.
 *
 * Jev is a System One model that makes fast, structured decisions.
 * It does NOT generate text — it evaluates state and returns typed answers
 * with calibrated probabilities and confidence scores.
 *
 * This engine translates browser automation questions into Jev primitives:
 *   • Choice  — "Which element should I click?"
 *   • Score   — "How relevant is this element?"
 *   • Noul    — "Is the page loaded?" (yes/no probability)
 */

import { TypeSafeClient, choice, noul, score } from '@typesafe-ai/sdk';
import type { ResolvedConfig } from '../config.js';
import type {
  ElementInfo,
  PageState,
  CaptchaType,
  ElementDecision,
  BooleanDecision,
  CaptchaDetectionResult,
} from '../utils/types.js';
import { Logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

export class JevEngine {
  private client: TypeSafeClient;
  private model: string;
  private log: Logger;

  constructor(config: ResolvedConfig) {
    this.client = new TypeSafeClient({
      apiKey: config.jev.apiKey,
    });
    this.model = config.jev.model;
    this.log = new Logger('JevBrow:Jev', 'debug');
  }

  // ─── Element Selection ──────────────────────────────────────────────────

  /**
   * Choose the best element from a list to interact with for a given goal.
   * Uses a Jev Choice question where each option is an element description.
   */
  async chooseBestElement(
    elements: ElementInfo[],
    goal: string,
    pageState: PageState,
  ): Promise<ElementDecision | null> {
    if (elements.length === 0) return null;

    // Build criteria map: element index → description
    const criteria: Record<string, string | null> = {};
    for (const el of elements) {
      const key = String(el.index);
      criteria[key] = this.describeElement(el);
    }

    // Also add a "none" option for when no element matches
    criteria['none'] = 'None of the elements match the goal';

    const state = {
      page: {
        url: pageState.url,
        title: pageState.title,
      },
      goal,
      available_elements: elements.map((el) => ({
        index: el.index,
        description: this.describeElement(el),
      })),
    };

    this.log.debug(`Choosing element for goal: "${goal}"`, {
      elementCount: elements.length,
    });

    const response = await withRetry(
      () =>
        this.client.systemOne({
          model: this.model,
          state,
          questions: {
            best_element: choice(
              `Which element should be interacted with to achieve the goal: "${goal}"? Choose the element index, or "none" if no element matches.`,
              criteria,
            ),
          },
        }),
      { maxAttempts: 2, logger: this.log },
    );

    const answer = response.answers.best_element;
    this.log.debug(`Element choice result`, {
      choice: answer.choice,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
    });

    if (answer.choice === 'none') {
      return null;
    }

    const chosenIndex = parseInt(answer.choice, 10);
    const chosenElement = elements.find((el) => el.index === chosenIndex);

    if (!chosenElement) return null;

    return {
      element: chosenElement,
      confidence: answer.confidence,
      source: 'jev',
    };
  }

  // ─── Boolean (Noul) Questions ───────────────────────────────────────────

  /**
   * Ask a yes/no question about the current page state.
   * Returns a probability (0–1) that the answer is "yes".
   */
  async askBoolean(
    question: string,
    pageState: PageState,
  ): Promise<BooleanDecision> {
    const state = {
      page: {
        url: pageState.url,
        title: pageState.title,
        visible_text: (pageState.visibleText || '').slice(0, 2000),
      },
    };

    this.log.debug(`Noul question: "${question}"`);

    const response = await withRetry(
      () =>
        this.client.systemOne({
          model: this.model,
          state,
          questions: {
            answer: noul(question),
          },
        }),
      { maxAttempts: 2, logger: this.log },
    );

    const prob = response.answers.answer.noul;
    this.log.debug(`Noul result: ${prob.toFixed(3)}`);

    return {
      probability: prob,
      result: prob >= 0.5,
      source: 'jev',
    };
  }

  /**
   * Check if the page is fully loaded and ready for interaction.
   */
  async isPageReady(pageState: PageState): Promise<BooleanDecision> {
    return this.askBoolean(
      'The page is fully loaded, interactive elements are visible, and there are no loading spinners or skeleton screens.',
      pageState,
    );
  }

  /**
   * Check if a browser action achieved its intended goal.
   */
  async isActionComplete(
    goal: string,
    beforeState: PageState,
    afterState: PageState,
  ): Promise<BooleanDecision> {
    const state = {
      goal,
      before: {
        url: beforeState.url,
        title: beforeState.title,
        elementCount: beforeState.elements.length,
      },
      after: {
        url: afterState.url,
        title: afterState.title,
        elementCount: afterState.elements.length,
        visible_text: (afterState.visibleText || '').slice(0, 1500),
      },
    };

    const response = await withRetry(
      () =>
        this.client.systemOne({
          model: this.model,
          state,
          questions: {
            complete: noul(
              `The action described by the goal "${goal}" has been successfully completed. The page state has changed from the "before" state to the "after" state in a way that indicates success.`,
            ),
          },
        }),
      { maxAttempts: 2, logger: this.log },
    );

    const prob = response.answers.complete.noul;

    return {
      probability: prob,
      result: prob >= 0.5,
      source: 'jev',
    };
  }

  // ─── CAPTCHA Detection ─────────────────────────────────────────────────

  /**
   * Detect whether a CAPTCHA is present on the page and classify its type.
   * Uses a Jev Choice question with CAPTCHA types as options.
   */
  async detectCaptcha(pageState: PageState): Promise<CaptchaDetectionResult> {
    const state = {
      page: {
        url: pageState.url,
        title: pageState.title,
        visible_text: (pageState.visibleText || '').slice(0, 2000),
      },
      elements: pageState.elements
        .filter(
          (el) =>
            el.tag === 'iframe' ||
            (el.className || '').toLowerCase().includes('captcha') ||
            (el.className || '').toLowerCase().includes('recaptcha') ||
            (el.className || '').toLowerCase().includes('hcaptcha') ||
            (el.id || '').toLowerCase().includes('captcha') ||
            (el.ariaLabel || '').toLowerCase().includes('captcha') ||
            (el.text || '').toLowerCase().includes('captcha') ||
            (el.text || '').toLowerCase().includes("i'm not a robot") ||
            (el.text || '').toLowerCase().includes('verify you are human'),
        )
        .map((el) => ({
          tag: el.tag,
          id: el.id || '',
          class: el.className || '',
          text: el.text,
          ariaLabel: el.ariaLabel || '',
          selector: el.selector,
        })),
    };

    this.log.debug('Detecting CAPTCHA…');

    const response = await withRetry(
      () =>
        this.client.systemOne({
          model: this.model,
          state,
          questions: {
            captcha_type: choice(
              'What type of CAPTCHA challenge is present on this page, if any?',
              {
                none: 'No CAPTCHA is present on the page',
                image_selection:
                  'Image selection CAPTCHA (e.g. "select all images with traffic lights")',
                text_distorted:
                  'Distorted text CAPTCHA that requires reading warped/noisy characters',
                slider:
                  'Slider puzzle CAPTCHA where you drag a piece to complete an image',
                checkbox:
                  'Simple checkbox CAPTCHA (e.g. reCAPTCHA "I\'m not a robot" checkbox)',
                unknown:
                  'Some form of CAPTCHA or bot verification is present but the specific type is unclear',
              },
            ),
          },
        }),
      { maxAttempts: 2, logger: this.log },
    );

    const answer = response.answers.captcha_type;
    this.log.debug('CAPTCHA detection result', {
      type: answer.choice,
      confidence: answer.confidence,
    });

    return {
      type: answer.choice as CaptchaType,
      confidence: answer.confidence,
    };
  }

  // ─── Multi-Question Batch ──────────────────────────────────────────────

  /**
   * Ask multiple questions about a page state in a single Jev call.
   * This is very efficient — Jev evaluates all questions in parallel.
   */
  async evaluatePage(
    pageState: PageState,
    goal: string,
  ): Promise<{
    isReady: BooleanDecision;
    hasCaptcha: CaptchaDetectionResult;
    hasTargetElement: BooleanDecision;
  }> {
    const state = {
      page: {
        url: pageState.url,
        title: pageState.title,
        visible_text: (pageState.visibleText || '').slice(0, 2000),
      },
      goal,
      interactive_elements: pageState.elements.slice(0, 50).map((el) => ({
        index: el.index,
        description: this.describeElement(el),
      })),
    };

    const response = await withRetry(
      () =>
        this.client.systemOne({
          model: this.model,
          state,
          questions: {
            is_ready: noul(
              'The page is fully loaded and interactive elements are visible.',
            ),
            has_captcha: noul(
              'The page contains some form of CAPTCHA or bot verification challenge.',
            ),
            has_target: noul(
              `The page contains an interactive element that could be used to achieve the goal: "${goal}".`,
            ),
          },
        }),
      { maxAttempts: 2, logger: this.log },
    );

    return {
      isReady: {
        probability: response.answers.is_ready.noul,
        result: response.answers.is_ready.noul >= 0.5,
        source: 'jev',
      },
      hasCaptcha: {
        type: response.answers.has_captcha.noul >= 0.5 ? 'unknown' : 'none',
        confidence: Math.abs(response.answers.has_captcha.noul - 0.5) * 2,
      },
      hasTargetElement: {
        probability: response.answers.has_target.noul,
        result: response.answers.has_target.noul >= 0.5,
        source: 'jev',
      },
    };
  }

  // ─── Scoring ────────────────────────────────────────────────────────────

  /**
   * Score how relevant an element is to a goal on a 0–4 scale.
   */
  async scoreElementRelevance(
    element: ElementInfo,
    goal: string,
    pageState: PageState,
  ): Promise<{ score: number; confidence: number }> {
    const state = {
      page: { url: pageState.url, title: pageState.title },
      goal,
      element: {
        description: this.describeElement(element),
        selector: element.selector,
      },
    };

    const response = await withRetry(
      () =>
        this.client.systemOne({
          model: this.model,
          state,
          questions: {
            relevance: score(
              `How relevant is this element to achieving the goal: "${goal}"?`,
              [
                'Not relevant at all — the element has nothing to do with the goal',
                'Slightly relevant — loosely related but not the right target',
                'Moderately relevant — could be related but there might be a better option',
                'Highly relevant — very likely the right element to interact with',
                'Perfect match — this is exactly the element needed for the goal',
              ],
            ),
          },
        }),
      { maxAttempts: 2, logger: this.log },
    );

    const answer = response.answers.relevance;
    return {
      score: answer.score,
      confidence: answer.confidence,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /** Create a human-readable description of a DOM element for Jev state. */
  private describeElement(el: ElementInfo): string {
    const parts: string[] = [];

    parts.push(`<${el.tag}>`);

    if (el.role) parts.push(`role="${el.role}"`);
    if (el.ariaLabel) parts.push(`aria-label="${el.ariaLabel}"`);
    if (el.id) parts.push(`id="${el.id}"`);
    if (el.inputType) parts.push(`type="${el.inputType}"`);
    if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
    if (el.name) parts.push(`name="${el.name}"`);
    if (el.href) parts.push(`href="${el.href.slice(0, 100)}"`);
    if (el.text) parts.push(`text: "${el.text.slice(0, 120)}"`);
    if (el.value) parts.push(`value: "${el.value.slice(0, 60)}"`);

    if (!el.isEnabled) parts.push('[disabled]');

    return parts.join(' ');
  }
}
