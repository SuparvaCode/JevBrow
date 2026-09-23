import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DecisionRouter } from '../src/ai/decision-router.js';
import type { ResolvedConfig } from '../src/config.js';
import type { ElementInfo, PageState } from '../src/utils/types.js';
import { resolveConfig } from '../src/config.js';

describe('DecisionRouter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_BASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const getBaseConfig = (): ResolvedConfig =>
    resolveConfig({
      jev: { apiKey: 'test-jev-key' },
    });

  const sampleElements: ElementInfo[] = [
    {
      index: 0,
      tag: 'button',
      text: 'Submit Form',
      inputType: 'submit',
      role: 'button',
      id: 'submit-btn',
      className: 'btn-primary',
      selector: '#submit-btn',
      isVisible: true,
      isEnabled: true,
      boundingBox: { x: 100, y: 200, width: 80, height: 30 },
    },
  ];

  const samplePageState: PageState = {
    url: 'https://example.com/login',
    title: 'Login Page',
    elements: sampleElements,
    visibleText: 'Submit Form',
  };

  it('initializes with Jev engine and null LLM engine when no LLM config', () => {
    const router = new DecisionRouter(getBaseConfig());
    expect(router.jevEngine).toBeDefined();
    expect(router.llmEngine).toBeNull();
  });

  it('initializes both engines when LLM config is present', () => {
    const configWithLLM: ResolvedConfig = resolveConfig({
      jev: { apiKey: 'test-jev-key' },
      llm: {
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
      },
    });
    const router = new DecisionRouter(configWithLLM);
    expect(router.jevEngine).toBeDefined();
    expect(router.llmEngine).toBeDefined();
  });

  it('returns null and logs warning for generateFormInput when LLM is not configured', async () => {
    const router = new DecisionRouter(getBaseConfig());
    const result = await router.generateFormInput('email address', 'login form');
    expect(result).toBeNull();
  });

  it('returns null and logs warning for analyzeScreenshot when LLM is not configured', async () => {
    const router = new DecisionRouter(getBaseConfig());
    const result = await router.analyzeScreenshot('base64data', 'solve captcha');
    expect(result).toBeNull();
  });

  it('routes to Jev if Jev returns decision above confidence threshold', async () => {
    const router = new DecisionRouter(getBaseConfig(), 0.7);

    // Mock Jev's chooseBestElement
    vi.spyOn(router.jevEngine, 'chooseBestElement').mockResolvedValue({
      element: sampleElements[0],
      confidence: 0.95,
      source: 'jev',
    });

    const decision = await router.chooseBestElement(
      sampleElements,
      'Click submit',
      samplePageState,
    );

    expect(decision).not.toBeNull();
    expect(decision?.element.id).toBe('submit-btn');
    expect(decision?.confidence).toBe(0.95);
    expect(decision?.source).toBe('jev');
  });

  it('escalates to LLM when Jev decision is below confidence threshold and LLM is available', async () => {
    const configWithLLM: ResolvedConfig = resolveConfig({
      jev: { apiKey: 'test-jev-key' },
      llm: {
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
      },
    });
    const router = new DecisionRouter(configWithLLM, 0.7);

    // Jev returns low confidence (0.4 < 0.7)
    vi.spyOn(router.jevEngine, 'chooseBestElement').mockResolvedValue({
      element: sampleElements[0],
      confidence: 0.4,
      source: 'jev',
    });

    // LLM mock returns index 0
    if (router.llmEngine) {
      vi.spyOn(router.llmEngine, 'chooseBestElement').mockResolvedValue({
        index: 0,
        reasoning: 'The submit button matches the goal',
      });
    }

    const decision = await router.chooseBestElement(
      sampleElements,
      'Click submit',
      samplePageState,
    );

    expect(decision).not.toBeNull();
    expect(decision?.source).toBe('llm');
    expect(decision?.element.id).toBe('submit-btn');
  });

  it('falls back to low-confidence Jev answer if LLM is unavailable', async () => {
    const router = new DecisionRouter(getBaseConfig(), 0.8);

    vi.spyOn(router.jevEngine, 'chooseBestElement').mockResolvedValue({
      element: sampleElements[0],
      confidence: 0.5,
      source: 'jev',
    });

    const decision = await router.chooseBestElement(
      sampleElements,
      'Click submit',
      samplePageState,
    );

    expect(decision).not.toBeNull();
    expect(decision?.source).toBe('jev');
    expect(decision?.confidence).toBe(0.5);
  });
});
