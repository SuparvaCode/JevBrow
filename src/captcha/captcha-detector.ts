/**
 * CAPTCHA Detector — uses Jev AI to detect CAPTCHA presence and type.
 * Combines fast DOM heuristics with Jev's structured decision-making.
 */

import type { Page } from 'playwright';
import type { DecisionRouter } from '../ai/decision-router.js';
import type { PageAnalyzer } from '../browser/page-analyzer.js';
import type { CaptchaDetectionResult, CaptchaType } from '../utils/types.js';
import { Logger } from '../utils/logger.js';

export class CaptchaDetector {
  private router: DecisionRouter;
  private analyzer: PageAnalyzer;
  private log: Logger;

  constructor(router: DecisionRouter, analyzer: PageAnalyzer) {
    this.router = router;
    this.analyzer = analyzer;
    this.log = new Logger('JevBrow:CaptchaDetect', 'debug');
  }

  /**
   * Detect if a CAPTCHA is present on the page and identify its type.
   *
   * Uses a two-pass approach:
   * 1. Quick DOM heuristic check (zero API calls)
   * 2. If heuristic detects something, use Jev for precise classification
   */
  async detect(page: Page): Promise<CaptchaDetectionResult> {
    // Pass 1: Quick heuristic
    const hasHeuristic = await this.analyzer.hasCaptchaHeuristic(page);

    if (!hasHeuristic) {
      this.log.debug('No CAPTCHA detected (heuristic pass)');
      return { type: 'none', confidence: 0.9 };
    }

    this.log.info('CAPTCHA heuristic triggered — asking Jev for classification');

    // Pass 2: Ask Jev for precise classification
    const pageState = await this.analyzer.getPageState(page);
    const result = await this.router.detectCaptcha(pageState);

    this.log.info(`CAPTCHA detection: ${result.type} (confidence: ${result.confidence.toFixed(2)})`);

    return result;
  }

  /**
   * Check if a specific iframe is a CAPTCHA frame.
   */
  async isCaptchaFrame(page: Page, frameSelector: string): Promise<boolean> {
    return page.evaluate((selector: string) => {
      const iframe = document.querySelector(selector) as HTMLIFrameElement;
      if (!iframe) return false;

      const src = (iframe.src || '').toLowerCase();
      return (
        src.includes('recaptcha') ||
        src.includes('hcaptcha') ||
        src.includes('captcha') ||
        src.includes('challenge') ||
        src.includes('verification')
      );
    }, frameSelector);
  }

  /**
   * Wait for a CAPTCHA to appear on the page (with timeout).
   */
  async waitForCaptcha(
    page: Page,
    timeoutMs: number = 10_000,
  ): Promise<CaptchaDetectionResult> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const result = await this.detect(page);
      if (result.type !== 'none') return result;

      await new Promise((r) => setTimeout(r, 1000));
    }

    return { type: 'none', confidence: 0.8 };
  }
}
