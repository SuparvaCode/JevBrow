/**
 * CAPTCHA utilities — screenshot and image processing helpers.
 */

import type { Page } from 'playwright';
import type { BoundingBox } from '../utils/types.js';

/**
 * Take a screenshot of a specific region of the page.
 * Returns base64-encoded PNG.
 */
export async function screenshotRegion(
  page: Page,
  box: BoundingBox,
): Promise<string> {
  const buffer = await page.screenshot({
    type: 'png',
    clip: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    },
  });
  return buffer.toString('base64');
}

/**
 * Take a screenshot of an element by selector.
 * Returns base64-encoded PNG or null if element not found.
 */
export async function screenshotElement(
  page: Page,
  selector: string,
): Promise<string | null> {
  try {
    const element = await page.$(selector);
    if (!element) return null;

    const buffer = await element.screenshot({ type: 'png' });
    return buffer.toString('base64');
  } catch {
    return null;
  }
}

/**
 * Take a full-page screenshot.
 * Returns base64-encoded PNG.
 */
export async function screenshotFullPage(page: Page): Promise<string> {
  const buffer = await page.screenshot({ type: 'png', fullPage: false });
  return buffer.toString('base64');
}

/**
 * Find the bounding box of a CAPTCHA challenge area.
 */
export async function findCaptchaBounds(
  page: Page,
): Promise<BoundingBox | null> {
  // Try common CAPTCHA container selectors
  const selectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    '.g-recaptcha',
    '.h-captcha',
    '[data-sitekey]',
    '#captcha-container',
    '.captcha-container',
    '.captcha',
    '#captcha',
  ];

  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const box = await element.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          return {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
          };
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Get the CAPTCHA challenge iframe content (if inside an iframe).
 */
export async function getCaptchaFrame(page: Page) {
  const frames = page.frames();

  for (const frame of frames) {
    const url = frame.url().toLowerCase();
    if (
      url.includes('recaptcha') ||
      url.includes('hcaptcha') ||
      url.includes('captcha')
    ) {
      return frame;
    }
  }

  return null;
}
