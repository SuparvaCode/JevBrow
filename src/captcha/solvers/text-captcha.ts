/**
 * Text/Distorted-Text CAPTCHA Solver.
 *
 * Handles CAPTCHAs that show warped, noisy text that must be typed.
 * Requires LLM with vision capability for OCR.
 */

import type { Page } from 'playwright';
import type { DecisionRouter } from '../../ai/decision-router.js';
import type { ActionExecutor } from '../../browser/action-executor.js';
import { screenshotFullPage, findCaptchaBounds, screenshotElement } from '../utils.js';
import { Logger } from '../../utils/logger.js';
import { sleep } from '../../utils/retry.js';

export class TextCaptchaSolver {
  private router: DecisionRouter;
  private executor: ActionExecutor;
  private log: Logger;

  constructor(router: DecisionRouter, executor: ActionExecutor) {
    this.router = router;
    this.executor = executor;
    this.log = new Logger('JevBrow:TextCaptcha', 'debug');
  }

  /**
   * Attempt to solve a text CAPTCHA.
   *
   * Flow:
   * 1. Screenshot the CAPTCHA image
   * 2. Send to LLM vision for OCR
   * 3. Type the recognized text into the input field
   * 4. Submit
   */
  async solve(page: Page): Promise<boolean> {
    const llm = this.router.llmEngine;
    if (!llm) {
      this.log.warn('No LLM configured — cannot solve text CAPTCHA');
      return false;
    }

    this.log.info('Attempting to solve text CAPTCHA');

    try {
      // Find the CAPTCHA image
      const captchaImageSelectors = [
        'img[alt*="captcha" i]',
        'img[src*="captcha" i]',
        'img[id*="captcha" i]',
        'img[class*="captcha" i]',
        '.captcha-image img',
        '#captcha-image',
        'canvas[id*="captcha" i]',
      ];

      let screenshot: string | null = null;

      for (const sel of captchaImageSelectors) {
        screenshot = await screenshotElement(page, sel);
        if (screenshot) {
          this.log.debug(`Found CAPTCHA image with selector: ${sel}`);
          break;
        }
      }

      // Fallback: screenshot the whole page
      if (!screenshot) {
        this.log.debug('No specific CAPTCHA image found — using full page screenshot');
        screenshot = await screenshotFullPage(page);
      }

      // Ask LLM to read the text
      const recognizedText = await llm.solveTextCaptcha(screenshot);

      if (!recognizedText) {
        this.log.warn('LLM could not read CAPTCHA text');
        return false;
      }

      this.log.info(`LLM recognized text: "${recognizedText}"`);

      // Find the input field
      const inputSelectors = [
        'input[name*="captcha" i]',
        'input[id*="captcha" i]',
        'input[placeholder*="captcha" i]',
        'input[placeholder*="code" i]',
        'input[placeholder*="text" i]',
        '#captcha-input',
        '.captcha-input',
        'input[type="text"]', // broad fallback
      ];

      let inputFound = false;
      for (const sel of inputSelectors) {
        try {
          const input = await page.$(sel);
          if (input) {
            await this.executor.type(page, sel, recognizedText);
            inputFound = true;
            this.log.debug(`Typed into: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!inputFound) {
        this.log.warn('Could not find CAPTCHA input field');
        return false;
      }

      // Submit
      await sleep(300);

      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button[id*="captcha" i]',
        'button[class*="captcha" i]',
        '.captcha-submit',
        '#captcha-submit',
        'button:has-text("Submit")',
        'button:has-text("Verify")',
      ];

      for (const sel of submitSelectors) {
        try {
          const btn = await page.$(sel);
          if (btn) {
            await btn.click();
            this.log.debug(`Clicked submit: ${sel}`);
            break;
          }
        } catch {
          continue;
        }
      }

      await sleep(2000);

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`Text CAPTCHA solve failed: ${msg}`);
      return false;
    }
  }
}
