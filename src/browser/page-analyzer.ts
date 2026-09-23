/**
 * Page Analyzer — extracts structured DOM state from a Playwright page
 * into a format that Jev AI can evaluate.
 *
 * Builds a lean representation containing only interactive/visible elements
 * and their essential attributes, keeping the state compact for fast
 * Jev evaluation.
 */

import type { Page, ElementHandle } from 'playwright';
import type { ElementInfo, PageState, BoundingBox } from '../utils/types.js';
import { Logger } from '../utils/logger.js';

/** Maximum number of elements to extract per page. */
const MAX_ELEMENTS = 100;

/** Maximum visible text length to include in state. */
const MAX_VISIBLE_TEXT = 3000;

export class PageAnalyzer {
  private log: Logger;

  constructor() {
    this.log = new Logger('JevBrow:Analyzer', 'debug');
  }

  /**
   * Extract the full page state for Jev evaluation.
   */
  async getPageState(page: Page): Promise<PageState> {
    const [url, title, elements, visibleText] = await Promise.all([
      page.url(),
      page.title(),
      this.extractElements(page),
      this.extractVisibleText(page),
    ]);

    this.log.debug(`Extracted page state`, {
      url,
      elementCount: elements.length,
      textLength: visibleText.length,
    });

    return {
      url,
      title,
      elements,
      visibleText,
    };
  }

  /**
   * Extract interactive elements from the page DOM.
   */
  async extractElements(page: Page): Promise<ElementInfo[]> {
    const elements = await page.evaluate((maxElements: number) => {
      const results: Array<{
        tag: string;
        text: string;
        id: string;
        className: string;
        role: string;
        ariaLabel: string;
        href: string;
        inputType: string;
        placeholder: string;
        name: string;
        value: string;
        isVisible: boolean;
        isEnabled: boolean;
        boundingBox: { x: number; y: number; width: number; height: number } | null;
        selector: string;
      }> = [];

      // CSS selector for interactive elements
      const interactiveSelectors = [
        'a[href]',
        'button',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="tab"]',
        '[role="menuitem"]',
        '[onclick]',
        '[tabindex]',
        'label',
        'summary',
        '[contenteditable="true"]',
      ].join(', ');

      const nodeList = document.querySelectorAll(interactiveSelectors);

      for (let i = 0; i < Math.min(nodeList.length, maxElements); i++) {
        const el = nodeList[i] as HTMLElement;

        // Check visibility
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';

        if (!isVisible) continue;

        // Check enabled state
        const isEnabled = !(el as HTMLInputElement).disabled;

        // Build a unique selector
        let selector = '';
        if (el.id) {
          selector = `#${CSS.escape(el.id)}`;
        } else {
          // Build a path-based selector
          const parts: string[] = [];
          let cur = el as Element | null;
          while (cur && cur !== document.body) {
            let part = cur.tagName.toLowerCase();
            if (cur.id) {
              part = `#${CSS.escape(cur.id)}`;
              parts.unshift(part);
              break;
            }
            const par: Element | null = cur.parentElement;
            if (par) {
              const tag = cur.tagName;
              const sibs = Array.from(par.children) as Element[];
              const sameTag = sibs.filter((s) => s.tagName === tag);
              if (sameTag.length > 1) {
                const idx = sameTag.indexOf(cur) + 1;
                part += `:nth-of-type(${idx})`;
              }
            }
            parts.unshift(part);
            cur = par;
          }
          selector = parts.join(' > ');
        }

        results.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 200),
          id: el.id || '',
          className: el.className || '',
          role: el.getAttribute('role') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          href: (el as HTMLAnchorElement).href || '',
          inputType: (el as HTMLInputElement).type || '',
          placeholder: (el as HTMLInputElement).placeholder || '',
          name: (el as HTMLInputElement).name || '',
          value: (el as HTMLInputElement).value || '',
          isVisible,
          isEnabled,
          boundingBox: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          selector,
        });
      }

      return results;
    }, MAX_ELEMENTS);

    // Add index to each element
    return elements.map((el, i) => ({
      ...el,
      index: i,
      id: el.id || undefined,
      className: el.className || undefined,
      role: el.role || undefined,
      ariaLabel: el.ariaLabel || undefined,
      href: el.href || undefined,
      inputType: el.inputType || undefined,
      placeholder: el.placeholder || undefined,
      name: el.name || undefined,
      value: el.value || undefined,
      boundingBox: el.boundingBox || undefined,
    }));
  }

  /**
   * Extract visible text content from the page (for context).
   */
  async extractVisibleText(page: Page): Promise<string> {
    const text = await page.evaluate((maxLen: number) => {
      // Get text from main content areas
      const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '.content',
        '#content',
        'body',
      ];

      for (const selector of contentSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const text = (el.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maxLen);
          if (text.length > 50) return text;
        }
      }

      return (document.body?.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
    }, MAX_VISIBLE_TEXT);

    return text;
  }

  /**
   * Find elements matching a text query on the page.
   */
  async findElementsByText(
    page: Page,
    searchText: string,
  ): Promise<ElementInfo[]> {
    const allElements = await this.extractElements(page);
    const lower = searchText.toLowerCase();

    return allElements.filter(
      (el) =>
        el.text.toLowerCase().includes(lower) ||
        el.ariaLabel?.toLowerCase().includes(lower) ||
        el.placeholder?.toLowerCase().includes(lower) ||
        el.id?.toLowerCase().includes(lower) ||
        el.name?.toLowerCase().includes(lower),
    );
  }

  /**
   * Check if the page has any CAPTCHA-related elements (quick heuristic).
   */
  async hasCaptchaHeuristic(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const captchaSelectors = [
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        'iframe[src*="captcha"]',
        '.g-recaptcha',
        '.h-captcha',
        '[data-sitekey]',
        '#captcha',
        '.captcha',
        'img[alt*="captcha" i]',
        'img[src*="captcha" i]',
      ];

      return captchaSelectors.some(
        (sel) => document.querySelector(sel) !== null,
      );
    });
  }
}
