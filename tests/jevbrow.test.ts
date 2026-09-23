import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JevBrow } from '../src/jevbrow.js';

describe('JevBrow', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('instantiates successfully with valid config', () => {
    const browser = new JevBrow({
      jev: { apiKey: 'test-jev-key' },
      llm: {
        apiKey: 'test-llm-key',
        model: 'gpt-4o-mini',
      },
    });

    expect(browser).toBeDefined();
    expect(browser.isRunning).toBe(false);
    expect(browser.decisionRouter).toBeDefined();
  });

  it('exposes decisionRouter and engines', () => {
    const browser = new JevBrow({
      jev: { apiKey: 'test-jev-key' },
    });

    expect(browser.decisionRouter.jevEngine).toBeDefined();
    expect(browser.decisionRouter.llmEngine).toBeNull();
  });
});
