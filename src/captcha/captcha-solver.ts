/**
 * CAPTCHA Solver Orchestrator.
 *
 * Coordinates CAPTCHA detection and solving by routing to the appropriate
 * specialized solver based on CAPTCHA type detected by Jev.
 */

import type { Page } from 'playwright';
import type { DecisionRouter } from '../ai/decision-router.js';
import type { ActionExecutor } from '../browser/action-executor.js';
import { CaptchaDetector } from './captcha-detector.js';
import { ImageCaptchaSolver } from './solvers/image-captcha.js';
import { TextCaptchaSolver } from './solvers/text-captcha.js';
import { SliderCaptchaSolver } from './solvers/slider-captcha.js';
import { CheckboxCaptchaSolver } from './solvers/checkbox-captcha.js';
import { PageAnalyzer } from '../browser/page-analyzer.js';
import type { CaptchaSolveResult, CaptchaType } from '../utils/types.js';
import { Logger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

/** Maximum number of solve attempts per CAPTCHA. */
const MAX_ATTEMPTS = 3;

export class CaptchaSolver {
  private detector: CaptchaDetector;
  private imageSolver: ImageCaptchaSolver;
  private textSolver: TextCaptchaSolver;
  private sliderSolver: SliderCaptchaSolver;
  private checkboxSolver: CheckboxCaptchaSolver;
  private router: DecisionRouter;
  private log: Logger;

  constructor(router: DecisionRouter, executor: ActionExecutor, analyzer: PageAnalyzer) {
    this.router = router;
    this.detector = new CaptchaDetector(router, analyzer);
    this.imageSolver = new ImageCaptchaSolver(router, executor);
    this.textSolver = new TextCaptchaSolver(router, executor);
    this.sliderSolver = new SliderCaptchaSolver(router, executor);
    this.checkboxSolver = new CheckboxCaptchaSolver(router, executor);
    this.log = new Logger('JevBrow:CaptchaSolver', 'debug');
  }

  /**
   * Detect and solve any CAPTCHA present on the page.
   *
   * Flow:
   * 1. Detect CAPTCHA type (Jev + heuristics)
   * 2. Route to the appropriate solver
   * 3. Verify success
   * 4. Retry if needed (up to MAX_ATTEMPTS)
   */
  async solve(page: Page): Promise<CaptchaSolveResult> {
    this.log.info('Starting CAPTCHA solve flow');

    let lastType: CaptchaType = 'none';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Step 1: Detect
      const detection = await this.detector.detect(page);
      lastType = detection.type;

      if (detection.type === 'none') {
        this.log.info('No CAPTCHA detected — page is clean');
        return {
          success: true,
          type: 'none',
          attempts: attempt,
        };
      }

      this.log.info(
        `CAPTCHA detected: ${detection.type} (confidence: ${detection.confidence.toFixed(2)}, attempt ${attempt}/${MAX_ATTEMPTS})`,
      );

      // Step 2: Route to solver
      let solved = false;

      switch (detection.type) {
        case 'checkbox':
          solved = await this.checkboxSolver.solve(page);

          // Checkbox might trigger an image challenge
          if (!solved) {
            this.log.info(
              'Checkbox triggered image challenge — trying image solver',
            );
            solved = await this.imageSolver.solve(page);
          }
          break;

        case 'image_selection':
          solved = await this.imageSolver.solve(page);
          break;

        case 'text_distorted':
          solved = await this.textSolver.solve(page);
          break;

        case 'slider':
          solved = await this.sliderSolver.solve(page);
          break;

        case 'unknown':
          // Try in order: checkbox → image → text → slider
          this.log.info('Unknown CAPTCHA type — trying all solvers');
          solved =
            (await this.checkboxSolver.solve(page)) ||
            (await this.imageSolver.solve(page)) ||
            (await this.textSolver.solve(page)) ||
            (await this.sliderSolver.solve(page));
          break;
      }

      if (solved) {
        // Step 3: Verify — wait and check if CAPTCHA is gone
        await sleep(2000);

        const recheck = await this.detector.detect(page);
        if (recheck.type === 'none') {
          this.log.info(`CAPTCHA solved successfully on attempt ${attempt}! ✓`);
          return {
            success: true,
            type: detection.type,
            attempts: attempt,
          };
        }

        this.log.info(
          `CAPTCHA still present after solve attempt ${attempt} (type: ${recheck.type})`,
        );
      } else {
        this.log.warn(`Solve attempt ${attempt} failed`);
      }

      // Brief pause before retry
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1000 + attempt * 500);
      }
    }

    this.log.error(`CAPTCHA solve failed after ${MAX_ATTEMPTS} attempts`);
    return {
      success: false,
      type: lastType,
      attempts: MAX_ATTEMPTS,
      error: `Failed to solve ${lastType} CAPTCHA after ${MAX_ATTEMPTS} attempts`,
    };
  }

  /**
   * Just detect the CAPTCHA type without solving.
   */
  async detect(page: Page) {
    return this.detector.detect(page);
  }
}
