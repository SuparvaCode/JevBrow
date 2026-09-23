/**
 * Checkbox CAPTCHA Solver.
 *
 * Handles simple "I'm not a robot" checkbox CAPTCHAs (reCAPTCHA v2 checkbox).
 * Uses human-like click behavior to pass the initial checkbox check.
 *
 * Note: If clicking the checkbox triggers an image challenge,
 * the ImageCaptchaSolver should handle the follow-up.
 */

import type { Page, Frame } from 'playwright';
import type { DecisionRouter } from '../../ai/decision-router.js';
import type { ActionExecutor } from '../../browser/action-executor.js';
import { Logger } from '../../utils/logger.js';
import { sleep } from '../../utils/retry.js';

export class CheckboxCaptchaSolver {
  private router: DecisionRouter;
  private executor: ActionExecutor;
  private log: Logger;

  constructor(router: DecisionRouter, executor: ActionExecutor) {
    this.router = router;
    this.executor = executor;
    this.log = new Logger('JevBrow:CheckboxCaptcha', 'debug');
  }

  /**
   * Attempt to solve a checkbox CAPTCHA.
   *
   * Flow:
   * 1. Find the reCAPTCHA/hCaptcha iframe
   * 2. Find the checkbox within the iframe
   * 3. Click with human-like behavior
   * 4. Wait and check if it was accepted or if a challenge appeared
   */
  async solve(page: Page): Promise<boolean> {
    this.log.info('Attempting to solve checkbox CAPTCHA');

    try {
      // Try reCAPTCHA first
      const recaptchaResult = await this.solveRecaptcha(page);
      if (recaptchaResult) return true;

      // Try hCaptcha
      const hcaptchaResult = await this.solveHcaptcha(page);
      if (hcaptchaResult) return true;

      // Try generic checkbox
      const genericResult = await this.solveGenericCheckbox(page);
      if (genericResult) return true;

      this.log.warn('No checkbox CAPTCHA found to solve');
      return false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`Checkbox CAPTCHA solve failed: ${msg}`);
      return false;
    }
  }

  /**
   * Solve a reCAPTCHA v2 checkbox.
   */
  private async solveRecaptcha(page: Page): Promise<boolean> {
    // Find the reCAPTCHA anchor iframe
    const recaptchaFrame = page.frames().find((frame) => {
      const url = frame.url();
      return url.includes('recaptcha/api2/anchor') || url.includes('recaptcha/enterprise/anchor');
    });

    if (!recaptchaFrame) {
      this.log.debug('No reCAPTCHA iframe found');
      return false;
    }

    this.log.debug('Found reCAPTCHA iframe');

    // Find and click the checkbox
    const checkbox = await recaptchaFrame.$('#recaptcha-anchor');
    if (!checkbox) {
      this.log.debug('No reCAPTCHA checkbox found in iframe');
      return false;
    }

    // Human-like delay before clicking
    await sleep(500 + Math.random() * 1000);

    // Get checkbox position and click with slight randomness
    const box = await checkbox.boundingBox();
    if (box) {
      const x = box.x + box.width * (0.3 + Math.random() * 0.4);
      const y = box.y + box.height * (0.3 + Math.random() * 0.4);
      await page.mouse.click(x, y);
    } else {
      await checkbox.click();
    }

    this.log.debug('Clicked reCAPTCHA checkbox');

    // Wait and check result
    await sleep(2000);

    // Check if the checkbox is now checked (green checkmark)
    const isChecked = await recaptchaFrame.evaluate(() => {
      const anchor = document.querySelector('#recaptcha-anchor');
      return anchor?.getAttribute('aria-checked') === 'true';
    });

    if (isChecked) {
      this.log.info('reCAPTCHA checkbox passed! ✓');
      return true;
    }

    // If not checked, an image challenge might have appeared
    this.log.info('reCAPTCHA checkbox triggered image challenge');
    return false; // Caller should try ImageCaptchaSolver next
  }

  /**
   * Solve an hCaptcha checkbox.
   */
  private async solveHcaptcha(page: Page): Promise<boolean> {
    const hcaptchaFrame = page.frames().find((frame) => {
      const url = frame.url();
      return url.includes('hcaptcha.com/captcha');
    });

    if (!hcaptchaFrame) {
      this.log.debug('No hCaptcha iframe found');
      return false;
    }

    this.log.debug('Found hCaptcha iframe');

    const checkbox = await hcaptchaFrame.$('#checkbox');
    if (!checkbox) {
      return false;
    }

    await sleep(500 + Math.random() * 800);
    await checkbox.click();

    this.log.debug('Clicked hCaptcha checkbox');
    await sleep(2000);

    // Check if passed
    const isChecked = await hcaptchaFrame.evaluate(() => {
      const cb = document.querySelector('#checkbox');
      return cb?.getAttribute('aria-checked') === 'true';
    });

    if (isChecked) {
      this.log.info('hCaptcha checkbox passed! ✓');
      return true;
    }

    return false;
  }

  /**
   * Try solving a generic checkbox CAPTCHA (not in an iframe).
   */
  private async solveGenericCheckbox(page: Page): Promise<boolean> {
    const checkboxSelectors = [
      'input[type="checkbox"][id*="captcha" i]',
      'input[type="checkbox"][name*="captcha" i]',
      'input[type="checkbox"][class*="captcha" i]',
      '[role="checkbox"][aria-label*="robot" i]',
      '[role="checkbox"][aria-label*="human" i]',
      '[role="checkbox"][aria-label*="captcha" i]',
    ];

    for (const sel of checkboxSelectors) {
      try {
        const cb = await page.$(sel);
        if (cb) {
          await sleep(300 + Math.random() * 500);
          await cb.click();
          this.log.debug(`Clicked generic checkbox: ${sel}`);
          await sleep(1500);
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }
}
