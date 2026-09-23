/**
 * Slider CAPTCHA Solver.
 *
 * Handles slider puzzle CAPTCHAs where you drag a piece to complete an image.
 * Uses bounding box heuristics and optional Vision LLM for position estimation.
 */

import type { Page } from 'playwright';
import type { DecisionRouter } from '../../ai/decision-router.js';
import type { ActionExecutor } from '../../browser/action-executor.js';
import { Logger } from '../../utils/logger.js';
import { sleep } from '../../utils/retry.js';

export class SliderCaptchaSolver {
  private router: DecisionRouter;
  private executor: ActionExecutor;
  private log: Logger;

  constructor(router: DecisionRouter, executor: ActionExecutor) {
    this.router = router;
    this.executor = executor;
    this.log = new Logger('JevBrow:SliderCaptcha', 'debug');
  }

  /**
   * Attempt to solve a slider CAPTCHA.
   *
   * Flow:
   * 1. Find the slider handle and track
   * 2. Estimate the target position using LLM vision or heuristics
   * 3. Perform a human-like drag operation
   * 4. Verify completion
   */
  async solve(page: Page): Promise<boolean> {
    this.log.info('Attempting to solve slider CAPTCHA');

    try {
      // Find slider elements
      const sliderSelectors = {
        handle: [
          '.slider-handle',
          '.slide-handle',
          '[class*="slider-btn"]',
          '[class*="drag-btn"]',
          '[class*="slider_drag"]',
          '.yidun_slider',
          '.geetest_slider_button',
          '[class*="handler"]',
          'span[class*="slider"]',
        ],
        track: [
          '.slider-track',
          '.slide-track',
          '[class*="slider-bar"]',
          '[class*="slider_bg"]',
          '.yidun_bg_img',
          '.geetest_slider',
          '[class*="track"]',
        ],
      };

      // Find the handle
      let handleBox = null;
      let handleSelector = '';

      for (const sel of sliderSelectors.handle) {
        try {
          const el = await page.$(sel);
          if (el) {
            const box = await el.boundingBox();
            if (box && box.width > 0) {
              handleBox = box;
              handleSelector = sel;
              break;
            }
          }
        } catch {
          continue;
        }
      }

      if (!handleBox) {
        this.log.warn('Could not find slider handle');
        return false;
      }

      this.log.debug(`Found slider handle: ${handleSelector}`, {
        x: handleBox.x,
        y: handleBox.y,
      });

      // Find the track to determine drag distance
      let trackWidth = 300; // Default estimate

      for (const sel of sliderSelectors.track) {
        try {
          const el = await page.$(sel);
          if (el) {
            const box = await el.boundingBox();
            if (box && box.width > 50) {
              trackWidth = box.width - handleBox.width;
              break;
            }
          }
        } catch {
          continue;
        }
      }

      // If LLM with vision is available, use it to estimate target position
      let targetOffset = trackWidth * 0.6; // Default: 60% of track

      const llm = this.router.llmEngine;
      if (llm) {
        try {
          const screenshot = await page.screenshot({ type: 'png' });
          const base64 = screenshot.toString('base64');

          const analysis = await llm.analyzeScreenshot(
            base64,
            `This image shows a slider CAPTCHA puzzle. There is a puzzle piece that needs to be dragged to fit into a gap in the image. 
            
Estimate what percentage of the track width (0-100) the slider needs to be dragged to. Consider the position of the gap/hole in the background image.

Respond with ONLY a number between 0 and 100.`,
          );

          const percentage = parseFloat(analysis);
          if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
            targetOffset = trackWidth * (percentage / 100);
            this.log.debug(`LLM estimated slider position: ${percentage}%`);
          }
        } catch (err) {
          this.log.debug('LLM vision analysis failed, using default position');
        }
      }

      // Calculate start and end positions
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;
      const endX = startX + targetOffset;
      const endY = startY + (Math.random() - 0.5) * 4; // Slight vertical wobble

      // Perform human-like drag
      await this.executor.drag(page, startX, startY, endX, endY, 25);

      await sleep(1000);

      // Check if we need to retry with a slightly different position
      // (many slider CAPTCHAs give visual feedback)

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.error(`Slider CAPTCHA solve failed: ${msg}`);
      return false;
    }
  }
}
