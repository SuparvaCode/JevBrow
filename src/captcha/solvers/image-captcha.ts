/**
 * Image Selection CAPTCHA Solver.
 *
 * Handles CAPTCHAs like "Select all images with traffic lights".
 * Requires LLM with vision capability.
 */

import type { Page } from 'playwright';
import type { DecisionRouter } from '../../ai/decision-router.js';
import type { ActionExecutor } from '../../browser/action-executor.js';
import { screenshotFullPage, getCaptchaFrame } from '../utils.js';
import { Logger } from '../../utils/logger.js';
import { sleep } from '../../utils/retry.js';

export class ImageCaptchaSolver {
  private router: DecisionRouter;
  private executor: ActionExecutor;
  private log: Logger;

  constructor(router: DecisionRouter, executor: ActionExecutor) {
    this.router = router;
    this.executor = executor;
    this.log = new Logger('JevBrow:ImageCaptcha', 'debug');
  }

  /**
   * Attempt to solve an image selection CAPTCHA.
   *
   * Flow:
   * 1. Screenshot the CAPTCHA area
   * 2. Send to LLM vision for analysis
   * 3. Click the identified cells
   * 4. Submit / verify
   */
  async solve(page: Page): Promise<boolean> {
    const llm = this.router.llmEngine;
    if (!llm) {
      this.log.warn('No LLM configured — cannot solve image CAPTCHA');
      return false;
    }

    this.log.info('Attempting to solve image selection CAPTCHA');

    try {
      // Try to find the CAPTCHA within an iframe
      const captchaFrame = await getCaptchaFrame(page);
      const target = captchaFrame || page;

      // Take screenshot of the challenge
      const screenshot = await screenshotFullPage(page);

      // Extract the instruction text
      const instruction = await target.evaluate(() => {
        const instructionSelectors = [
          '.rc-imageselect-desc-no-canonical',
          '.rc-imageselect-desc',
          '.prompt-text',
          '.task-description',
          '[class*="instruction"]',
          '[class*="prompt"]',
        ];

        for (const sel of instructionSelectors) {
          const el = document.querySelector(sel);
          if (el?.textContent) return el.textContent.trim();
        }

        return 'Select all matching images';
      });

      this.log.debug(`CAPTCHA instruction: "${instruction}"`);

      // Ask LLM to identify the correct cells
      const cells = await llm.solveImageCaptcha(screenshot, instruction);

      if (cells.length === 0) {
        this.log.warn('LLM found no matching cells');
        return false;
      }

      this.log.info(`LLM identified cells: [${cells.join(', ')}]`);

      // Click each identified cell
      // Standard reCAPTCHA grid is 3x3 or 4x4
      const gridSelector =
        (await target.$('.rc-imageselect-tile'))
          ? '.rc-imageselect-tile'
          : 'td[role="button"], .task-image, [class*="tile"], [class*="cell"]';

      const tiles = await target.$$(gridSelector);

      for (const cellIndex of cells) {
        const tileIndex = cellIndex - 1; // Convert 1-based to 0-based
        if (tileIndex >= 0 && tileIndex < tiles.length) {
          await tiles[tileIndex].click();
          await sleep(200 + Math.random() * 300);
        }
      }

      // Wait a moment, then click the verify/submit button
      await sleep(500);

      const submitSelectors = [
        '#recaptcha-verify-button',
        '.verify-button',
        'button[type="submit"]',
        '.rc-button-default',
        '[class*="submit"]',
        '[class*="verify"]',
      ];

      for (const sel of submitSelectors) {
        const btn = await target.$(sel);
        if (btn) {
          await btn.click();
          this.log.debug('Clicked submit/verify button');
          break;
        }
      }

      await sleep(2000);

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`Image CAPTCHA solve failed: ${msg}`);
      return false;
    }
  }
}
