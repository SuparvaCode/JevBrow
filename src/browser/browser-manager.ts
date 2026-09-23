/**
 * Browser Manager — Playwright wrapper with headless, non-headless,
 * and lightweight memory-optimization modes.
 */

import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import { execSync } from 'child_process';
import type { ResolvedConfig } from '../config.js';
import { Logger } from '../utils/logger.js';

/** Blocked resource types in lightweight mode. */
const BLOCKED_RESOURCE_TYPES = new Set([
  'image',
  'media',
  'font',
  'stylesheet',
]);

/** Blocked URL patterns in lightweight mode (ads, trackers, analytics). */
const BLOCKED_URL_PATTERNS = [
  '**/google-analytics.com/**',
  '**/googletagmanager.com/**',
  '**/facebook.net/**',
  '**/doubleclick.net/**',
  '**/analytics.**',
  '**/ads.**',
  '**/tracking.**',
];

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: ResolvedConfig;
  private log: Logger;

  constructor(config: ResolvedConfig) {
    this.config = config;
    this.log = new Logger('JevBrow:Browser', config.logLevel);
  }

  /** Whether the browser is currently launched. */
  get isLaunched(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  /**
   * Launch the browser with the configured settings.
   */
  async launch(): Promise<void> {
    if (this.browser) {
      this.log.warn('Browser already launched');
      return;
    }

    const {
      browserType = 'chromium',
      channel,
      autoInstall,
      headless,
      lightweight,
      executablePath,
      args,
    } = this.config.browser;

    // Build launch args
    const launchArgs = [...args];

    if (lightweight) {
      launchArgs.push(
        '--disable-gpu',
        '--disable-extensions',
        '--disable-dev-shm-usage',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--no-first-run',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--metrics-recording-only',
        '--mute-audio',
      );
    }

    this.log.info('Launching browser', {
      browserType,
      channel,
      headless,
      lightweight,
      argCount: launchArgs.length,
    });

    const launcher =
      browserType === 'firefox'
        ? firefox
        : browserType === 'webkit'
          ? webkit
          : chromium;

    const launchOptions: Parameters<typeof launcher.launch>[0] = {
      headless,
      executablePath: executablePath || undefined,
      args: launchArgs.length > 0 ? launchArgs : undefined,
    };

    if (channel) {
      launchOptions.channel = channel;
    }
    if (this.config.browser.proxy) {
      launchOptions.proxy = this.config.browser.proxy;
    }

    try {
      this.browser = await launcher.launch(launchOptions);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isMissingBinary =
        msg.includes("Executable doesn't exist") ||
        msg.includes('Please run the following command') ||
        msg.includes('playwright install');

      if (isMissingBinary) {
        let fallbackSuccess = false;

        // Try system Edge or Chrome on Windows/Mac if using default chromium
        if (browserType === 'chromium' && !channel && !executablePath) {
          for (const ch of ['msedge', 'chrome']) {
            try {
              this.log.info(`Browser binary missing, attempting system ${ch} fallback…`);
              this.browser = await launcher.launch({ ...launchOptions, channel: ch });
              this.log.info(`Successfully launched with system ${ch}`);
              fallbackSuccess = true;
              break;
            } catch {
              // Continue to next fallback or auto-install
            }
          }
        }

        if (!fallbackSuccess) {
          if (autoInstall) {
            this.log.info(`Auto-installing Playwright ${browserType} binary…`);
            try {
              execSync(`npx playwright install ${browserType}`, { stdio: 'pipe' });
              this.browser = await launcher.launch(launchOptions);
              this.log.info(`Successfully installed and launched Playwright ${browserType}`);
            } catch (installErr) {
              throw new Error(
                `Failed to launch browser and auto-install failed. Please run 'npx playwright install ${browserType}'. ${installErr}`,
              );
            }
          } else {
            throw err;
          }
        }
      } else {
        throw err;
      }
    }

    const defaultViewport = lightweight
      ? { width: 1280, height: 720 }
      : { width: 1920, height: 1080 };

    if (!this.browser) {
      throw new Error('Failed to launch browser instance.');
    }

    // Create context with production options
    this.context = await this.browser.newContext({
      viewport: this.config.browser.viewport ?? defaultViewport,
      userAgent:
        this.config.browser.userAgent ??
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: this.config.browser.locale ?? 'en-US',
      timezoneId: this.config.browser.timezoneId ?? 'America/New_York',
      // Reduce detection of automation
      bypassCSP: true,
      javaScriptEnabled: true,
    });

    // Block resources in lightweight mode
    if (lightweight) {
      await this.setupLightweightMode();
    }

    this.log.info('Browser launched successfully');
  }

  /**
   * Create a new page in the current context.
   */
  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const page = await this.context.newPage();

    // Set default timeouts
    page.setDefaultNavigationTimeout(this.config.browser.navigationTimeout);
    page.setDefaultTimeout(this.config.browser.actionTimeout);

    return page;
  }

  /**
   * Close all pages except the given one (memory cleanup).
   */
  async closeOtherPages(keepPage: Page): Promise<void> {
    if (!this.context) return;

    const pages = this.context.pages();
    for (const p of pages) {
      if (p !== keepPage) {
        await p.close().catch(() => {});
      }
    }
  }

  /**
   * Close the browser and clean up all resources.
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    this.log.info('Browser closed');
  }

  /**
   * Take a screenshot of the given page.
   * Returns a base64-encoded PNG string.
   */
  async screenshot(page: Page, fullPage: boolean = false): Promise<string> {
    const buffer = await page.screenshot({
      type: 'png',
      fullPage,
    });
    return buffer.toString('base64');
  }

  /**
   * Take a screenshot of a specific element.
   */
  async elementScreenshot(
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

  // ─── Private ────────────────────────────────────────────────────────────

  /**
   * Set up resource blocking for lightweight mode.
   */
  private async setupLightweightMode(): Promise<void> {
    if (!this.context) return;

    this.log.debug('Setting up lightweight mode — blocking resources');

    await this.context.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const url = route.request().url();

      // Block heavy resource types
      if (BLOCKED_RESOURCE_TYPES.has(resourceType)) {
        // EXCEPTION: Don't block images/stylesheets for CAPTCHA iframes
        const isCaptchaRelated =
          url.includes('captcha') ||
          url.includes('recaptcha') ||
          url.includes('hcaptcha') ||
          url.includes('challenge');

        if (!isCaptchaRelated) {
          return route.abort();
        }
      }

      // Block known ad/tracker domains
      for (const pattern of BLOCKED_URL_PATTERNS) {
        const regex = new RegExp(
          pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'),
        );
        if (regex.test(url)) {
          return route.abort();
        }
      }

      return route.continue();
    });
  }
}
