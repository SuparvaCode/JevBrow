import { describe, it, expect, vi } from 'vitest';
import { CaptchaDetector } from '../src/captcha/captcha-detector.js';
import type { DecisionRouter } from '../src/ai/decision-router.js';
import type { PageAnalyzer } from '../src/browser/page-analyzer.js';
import type { Page } from 'playwright';

describe('CaptchaDetector', () => {
  it('returns none with high confidence if DOM heuristic does not detect captcha', async () => {
    const mockRouter = {} as unknown as DecisionRouter;
    const mockAnalyzer = {
      hasCaptchaHeuristic: vi.fn().mockResolvedValue(false),
      getPageState: vi.fn(),
    } as unknown as PageAnalyzer;

    const detector = new CaptchaDetector(mockRouter, mockAnalyzer);
    const mockPage = {} as unknown as Page;

    const result = await detector.detect(mockPage);

    expect(result.type).toBe('none');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(mockAnalyzer.getPageState).not.toHaveBeenCalled();
  });

  it('queries router if DOM heuristic detects captcha presence', async () => {
    const mockRouter = {
      detectCaptcha: vi.fn().mockResolvedValue({
        type: 'turnstile',
        confidence: 0.98,
        siteKey: '0x4AAAAAA',
      }),
    } as unknown as DecisionRouter;

    const mockPageState = {
      url: 'https://example.com/protected',
      title: 'Just a moment...',
      elementCount: 5,
    };

    const mockAnalyzer = {
      hasCaptchaHeuristic: vi.fn().mockResolvedValue(true),
      getPageState: vi.fn().mockResolvedValue(mockPageState),
    } as unknown as PageAnalyzer;

    const detector = new CaptchaDetector(mockRouter, mockAnalyzer);
    const mockPage = {} as unknown as Page;

    const result = await detector.detect(mockPage);

    expect(result.type).toBe('turnstile');
    expect(result.confidence).toBe(0.98);
    expect(mockRouter.detectCaptcha).toHaveBeenCalledWith(mockPageState);
  });

  it('checks if an iframe is a captcha frame', async () => {
    const mockRouter = {} as unknown as DecisionRouter;
    const mockAnalyzer = {} as unknown as PageAnalyzer;
    const detector = new CaptchaDetector(mockRouter, mockAnalyzer);

    const mockPage = {
      evaluate: vi.fn().mockImplementation((fn, arg) => {
        return arg === 'iframe#recaptcha';
      }),
    } as unknown as Page;

    const isCaptcha = await detector.isCaptchaFrame(mockPage, 'iframe#recaptcha');
    expect(isCaptcha).toBe(true);
  });
});
