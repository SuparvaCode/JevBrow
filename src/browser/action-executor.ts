/**
 * Action Executor — translates AI decisions into Playwright browser actions
 * with human-like timing and retry logic.
 */

import type { Page } from 'playwright';
import type { BrowserAction, ElementInfo, BoundingBox } from '../utils/types.js';
import { Logger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

/** Configuration for human-like behavior simulation. */
interface HumanLikeConfig {
  /** Minimum delay between actions in ms. */
  minDelay: number;
  /** Maximum delay between actions in ms. */
  maxDelay: number;
  /** Typing speed — delay between keystrokes in ms. */
  typingDelay: number;
}

const DEFAULT_HUMAN_CONFIG: HumanLikeConfig = {
  minDelay: 100,
  maxDelay: 400,
  typingDelay: 50,
};

export class ActionExecutor {
  private log: Logger;
  private humanConfig: HumanLikeConfig;

  constructor(humanConfig?: Partial<HumanLikeConfig>) {
    this.log = new Logger('JevBrow:Action', 'debug');
    this.humanConfig = { ...DEFAULT_HUMAN_CONFIG, ...humanConfig };
  }

  /**
   * Execute a high-level browser action on a page.
   */
  async execute(page: Page, action: BrowserAction): Promise<void> {
    switch (action.kind) {
      case 'click':
        await this.click(page, action.selector);
        break;
      case 'type':
        await this.type(page, action.selector, action.text);
        break;
      case 'scroll':
        await this.scroll(page, action.direction);
        break;
      case 'navigate':
        await this.navigate(page, action.url);
        break;
      case 'wait':
        await sleep(action.ms);
        break;
      case 'screenshot':
        // screenshot is handled by BrowserManager
        break;
      case 'press':
        await this.pressKey(page, action.key);
        break;
    }
  }

  /**
   * Click an element with human-like mouse movement and timing.
   */
  async click(page: Page, selector: string): Promise<void> {
    this.log.debug(`Clicking: ${selector}`);

    await this.humanDelay();

    try {
      // Wait for element to be visible and stable
      await page.waitForSelector(selector, {
        state: 'visible',
        timeout: 5000,
      });

      // Get element bounding box for human-like click position
      const box = await page.locator(selector).boundingBox();
      if (box) {
        // Click at a random point within the element (not dead center)
        const x = box.x + box.width * (0.3 + Math.random() * 0.4);
        const y = box.y + box.height * (0.3 + Math.random() * 0.4);

        await page.mouse.click(x, y);
      } else {
        // Fallback to standard click
        await page.click(selector);
      }

      this.log.debug(`Clicked: ${selector}`);
    } catch (err) {
      this.log.warn(`Click failed on "${selector}", trying force click`);
      await page.click(selector, { force: true }).catch(() => {
        // Last resort: use JavaScript click
        return page.evaluate(
          (sel: string) => {
            const el = document.querySelector(sel);
            if (el) (el as HTMLElement).click();
          },
          selector,
        );
      });
    }
  }

  /**
   * Type text into an element with human-like keystroke timing.
   */
  async type(page: Page, selector: string, text: string): Promise<void> {
    this.log.debug(`Typing into: ${selector}`, { textLength: text.length });

    await this.humanDelay();

    // Wait for element
    await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });

    // Focus the element
    await page.click(selector);
    await sleep(100);

    // Clear existing value
    await page.evaluate(
      (sel: string) => {
        const el = document.querySelector(sel) as HTMLInputElement;
        if (el) {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      selector,
    );

    // Type with human-like delays
    for (const char of text) {
      await page.keyboard.type(char, {
        delay: this.humanConfig.typingDelay + Math.random() * 30,
      });
    }

    this.log.debug(`Typed ${text.length} chars into: ${selector}`);
  }

  /**
   * Scroll the page up or down.
   */
  async scroll(page: Page, direction: 'up' | 'down'): Promise<void> {
    const distance = direction === 'down' ? 400 : -400;
    await page.mouse.wheel(0, distance);
    await sleep(300);
    this.log.debug(`Scrolled ${direction}`);
  }

  /**
   * Navigate to a URL and wait for the page to settle.
   */
  async navigate(page: Page, url: string): Promise<void> {
    this.log.debug(`Navigating to: ${url}`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    // Wait a bit for JavaScript to settle
    await sleep(500);

    // Wait for network to quiet down
    try {
      await page.waitForLoadState('networkidle', { timeout: 10_000 });
    } catch {
      // networkidle can time out on pages with persistent connections — that's ok
      this.log.debug('Network idle timeout — continuing');
    }

    this.log.debug(`Navigation complete: ${url}`);
  }

  /**
   * Press a keyboard key.
   */
  async pressKey(page: Page, key: string): Promise<void> {
    this.log.debug(`Pressing key: ${key}`);
    await page.keyboard.press(key);
  }

  /**
   * Perform a human-like drag operation (for slider CAPTCHAs).
   */
  async drag(
    page: Page,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    steps: number = 20,
  ): Promise<void> {
    this.log.debug(`Dragging from (${fromX},${fromY}) to (${toX},${toY})`);

    await page.mouse.move(fromX, fromY);
    await sleep(100);
    await page.mouse.down();
    await sleep(50);

    // Move in small steps with slight randomness for human-like behavior
    const dx = (toX - fromX) / steps;
    const dy = (toY - fromY) / steps;

    for (let i = 1; i <= steps; i++) {
      const x = fromX + dx * i + (Math.random() - 0.5) * 2;
      const y = fromY + dy * i + (Math.random() - 0.5) * 1;
      await page.mouse.move(x, y);
      await sleep(10 + Math.random() * 20);
    }

    // Final position
    await page.mouse.move(toX, toY);
    await sleep(50);
    await page.mouse.up();

    this.log.debug('Drag complete');
  }

  /**
   * Click at specific viewport coordinates.
   */
  async clickAt(page: Page, x: number, y: number): Promise<void> {
    this.log.debug(`Clicking at (${x}, ${y})`);
    await this.humanDelay();
    await page.mouse.click(x, y);
  }

  // ─── Private ────────────────────────────────────────────────────────────

  /** Add a random human-like delay between actions. */
  private async humanDelay(): Promise<void> {
    const delay =
      this.humanConfig.minDelay +
      Math.random() * (this.humanConfig.maxDelay - this.humanConfig.minDelay);
    await sleep(delay);
  }
}
