import { describe, it, expect, vi } from 'vitest';
import { AssertionError, JevPage } from '../src/jevbrow.js';
import type { DecisionRouter } from '../src/ai/decision-router.js';
import type { PageAnalyzer } from '../src/browser/page-analyzer.js';
import type { ActionExecutor } from '../src/browser/action-executor.js';
import type { CaptchaSolver } from '../src/captcha/captcha-solver.js';
import type { BrowserManager } from '../src/browser/browser-manager.js';
import type { Page } from 'playwright';
import type { PageState, ElementInfo } from '../src/utils/types.js';

describe('Idea 2: Next-Gen Web Automation', () => {
  describe('AssertionError', () => {
    it('constructs with semantic details', () => {
      const err = new AssertionError('Assertion failed: "Logged in"', {
        assertion: 'The user is logged in',
        probability: 0.15,
        threshold: 0.65,
        url: 'https://example.com/login',
      });

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('AssertionError');
      expect(err.assertion).toBe('The user is logged in');
      expect(err.probability).toBe(0.15);
      expect(err.threshold).toBe(0.65);
      expect(err.url).toBe('https://example.com/login');
      expect(err.message).toContain('Assertion failed');
    });
  });

  describe('JevPage Idea 2 methods', () => {
    const mockPage = {
      url: vi.fn().mockReturnValue('https://example.com/portal'),
      title: vi.fn().mockResolvedValue('Example Portal'),
      fill: vi.fn().mockResolvedValue(undefined),
      selectOption: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;

    const sampleElements: ElementInfo[] = [
      {
        index: 0,
        tag: 'input',
        text: '',
        inputType: 'text',
        name: 'full_name',
        placeholder: 'Enter full name',
        id: 'name-field',
        className: 'form-control',
        selector: '#name-field',
        isVisible: true,
        isEnabled: true,
      },
      {
        index: 1,
        tag: 'input',
        text: '',
        inputType: 'email',
        name: 'email_address',
        placeholder: 'Enter email',
        id: 'email-field',
        className: 'form-control',
        selector: '#email-field',
        isVisible: true,
        isEnabled: true,
      },
      {
        index: 2,
        tag: 'a',
        text: 'Documentation & Guides',
        href: '/docs',
        role: 'link',
        id: 'docs-link',
        className: 'nav-link',
        selector: '#docs-link',
        isVisible: true,
        isEnabled: true,
      },
    ];

    const samplePageState: PageState = {
      url: 'https://example.com/portal',
      title: 'Example Portal',
      elements: sampleElements,
      visibleText: 'Example Portal Documentation & Guides',
    };

    const createMockJevPage = (overrides?: {
      askBoolean?: any;
      evaluateGoalReached?: any;
      chooseGoalNavigation?: any;
      matchFormFields?: any;
    }) => {
      const mockRouter = {
        askBoolean: overrides?.askBoolean || vi.fn().mockResolvedValue({
          result: true,
          probability: 0.92,
          source: 'jev',
        }),
        evaluateGoalReached: overrides?.evaluateGoalReached || vi.fn().mockResolvedValue({
          result: true,
          probability: 0.88,
          source: 'jev',
        }),
        chooseGoalNavigation: overrides?.chooseGoalNavigation || vi.fn().mockResolvedValue({
          element: sampleElements[2],
          confidence: 0.95,
          source: 'jev',
        }),
        matchFormFields: overrides?.matchFormFields || vi.fn().mockResolvedValue({
          0: { key: 'fullName', confidence: 0.94 },
          1: { key: 'email', confidence: 0.98 },
        }),
        isPageReady: vi.fn().mockResolvedValue({ result: true, probability: 0.95, source: 'jev' }),
      } as unknown as DecisionRouter;

      const mockAnalyzer = {
        getPageState: vi.fn().mockResolvedValue(samplePageState),
      } as unknown as PageAnalyzer;

      const mockExecutor = {
        click: vi.fn().mockResolvedValue(undefined),
      } as unknown as ActionExecutor;

      const mockCaptchaSolver = {} as unknown as CaptchaSolver;
      const mockBrowserManager = {} as unknown as BrowserManager;
      const mockConfig = { logLevel: 'silent', jev: { apiKey: 'test', model: 'jev-latest' } } as any;

      return new JevPage(
        mockPage,
        mockRouter,
        mockAnalyzer,
        mockExecutor,
        mockCaptchaSolver,
        mockBrowserManager,
        mockConfig,
      );
    };

    describe('aiAssert', () => {
      it('returns decision when assertion passes with high confidence', async () => {
        const jevPage = createMockJevPage({
          askBoolean: vi.fn().mockResolvedValue({
            result: true,
            probability: 0.89,
            source: 'jev',
          }),
        });

        const decision = await jevPage.aiAssert('Dashboard is visible', {
          timeoutMs: 1000,
          minConfidence: 0.7,
        });

        expect(decision.result).toBe(true);
        expect(decision.probability).toBe(0.89);
      });

      it('throws AssertionError when condition fails to reach confidence threshold', async () => {
        const jevPage = createMockJevPage({
          askBoolean: vi.fn().mockResolvedValue({
            result: false,
            probability: 0.2,
            source: 'jev',
          }),
        });

        await expect(
          jevPage.aiAssert('Payment was successful', {
            timeoutMs: 400,
            minConfidence: 0.65,
          }),
        ).rejects.toThrow(AssertionError);
      });
    });

    describe('aiSeekGoal', () => {
      it('returns success immediately if goal is satisfied on current page', async () => {
        const jevPage = createMockJevPage({
          evaluateGoalReached: vi.fn().mockResolvedValue({
            result: true,
            probability: 0.85,
            source: 'jev',
          }),
        });

        const result = await jevPage.aiSeekGoal('Find documentation page');

        expect(result.success).toBe(true);
        expect(result.stepsTaken).toBe(0);
        expect(result.finalUrl).toBe('https://example.com/portal');
      });

      it('navigates via chosen link when goal is not satisfied on current page', async () => {
        let stepCount = 0;
        const jevPage = createMockJevPage({
          evaluateGoalReached: vi.fn().mockImplementation(() => {
            stepCount++;
            if (stepCount === 1) {
              return Promise.resolve({ result: false, probability: 0.2, source: 'jev' });
            }
            return Promise.resolve({ result: true, probability: 0.9, source: 'jev' });
          }),
        });

        const onStepSpy = vi.fn();
        const result = await jevPage.aiSeekGoal({
          goal: 'Find documentation page',
          maxSteps: 3,
          onStep: onStepSpy,
        });

        expect(result.success).toBe(true);
        expect(onStepSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('aiAutoFillForm', () => {
      it('matches form inputs to profile keys and populates values', async () => {
        const jevPage = createMockJevPage();

        const profile = {
          fullName: 'Alice Johnson',
          email: 'alice@example.com',
          company: 'Acme Corp', // Unmapped
        };

        const result = await jevPage.aiAutoFillForm(profile);

        expect(result.filledFields).toHaveLength(2);
        expect(result.filledFields[0].profileKey).toBe('fullName');
        expect(result.filledFields[0].value).toBe('Alice Johnson');
        expect(result.filledFields[1].profileKey).toBe('email');
        expect(result.filledFields[1].value).toBe('alice@example.com');
        expect(result.unmappedKeys).toEqual(['company']);
        expect(mockPage.fill).toHaveBeenCalledWith('#name-field', 'Alice Johnson');
        expect(mockPage.fill).toHaveBeenCalledWith('#email-field', 'alice@example.com');
      });
    });
  });
});
