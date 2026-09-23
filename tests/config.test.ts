import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveConfig } from '../src/config.js';

describe('resolveConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TYPESAFE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_VISION_CAPABLE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws an error if no Jev API key is provided', () => {
    delete process.env.TYPESAFE_API_KEY;
    expect(() => {
      resolveConfig({ jev: { apiKey: '' } });
    }).toThrow('JevBrow: Jev API key is required');
  });

  it('resolves config with minimal jev configuration', () => {
    const config = resolveConfig({
      jev: { apiKey: 'test-key-123' },
    });

    expect(config.jev.apiKey).toBe('test-key-123');
    expect(config.jev.model).toBe('jev-latest');
    expect(config.llm).toBeNull();
    expect(config.browser.headless).toBe(true);
    expect(config.browser.lightweight).toBe(false);
    expect(config.browser.navigationTimeout).toBe(30000);
    expect(config.browser.actionTimeout).toBe(10000);
  });

  it('reads Jev API key from environment variable if omitted in config', () => {
    process.env.TYPESAFE_API_KEY = 'env-typesafe-key';
    const config = resolveConfig({ jev: {} });

    expect(config.jev.apiKey).toBe('env-typesafe-key');
  });

  it('configures LLM correctly when provided in config', () => {
    const config = resolveConfig({
      jev: { apiKey: 'test-key' },
      llm: {
        apiKey: 'openai-key-abc',
        model: 'gpt-4o',
        baseUrl: 'https://custom-openai.com/v1',
        isVisionCapable: true,
      },
    });

    expect(config.llm).not.toBeNull();
    expect(config.llm?.apiKey).toBe('openai-key-abc');
    expect(config.llm?.model).toBe('gpt-4o');
    expect(config.llm?.baseUrl).toBe('https://custom-openai.com/v1');
    expect(config.llm?.isVisionCapable).toBe(true);
  });

  it('reads LLM configuration from environment variables', () => {
    process.env.OPENAI_API_KEY = 'env-openai-key';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    process.env.OPENAI_BASE_URL = 'https://proxy.example.com/v1';
    process.env.OPENAI_VISION_CAPABLE = 'true';

    const config = resolveConfig({
      jev: { apiKey: 'test-key' },
    });

    expect(config.llm).not.toBeNull();
    expect(config.llm?.apiKey).toBe('env-openai-key');
    expect(config.llm?.model).toBe('gpt-4o-mini');
    expect(config.llm?.baseUrl).toBe('https://proxy.example.com/v1');
    expect(config.llm?.isVisionCapable).toBe(true);
  });

  it('respects browser customization options', () => {
    const config = resolveConfig({
      jev: { apiKey: 'test-key' },
      browser: {
        headless: false,
        lightweight: true,
        navigationTimeout: 60000,
        actionTimeout: 15000,
        args: ['--no-sandbox'],
        viewport: { width: 1440, height: 900 },
        userAgent: 'Custom-Agent/1.0',
        proxy: { server: 'http://127.0.0.1:8080' },
      },
    });

    expect(config.browser.headless).toBe(false);
    expect(config.browser.lightweight).toBe(true);
    expect(config.browser.navigationTimeout).toBe(60000);
    expect(config.browser.actionTimeout).toBe(15000);
    expect(config.browser.args).toEqual(['--no-sandbox']);
    expect(config.browser.viewport).toEqual({ width: 1440, height: 900 });
    expect(config.browser.userAgent).toBe('Custom-Agent/1.0');
    expect(config.browser.proxy?.server).toBe('http://127.0.0.1:8080');
  });

  it('supports baseURL alias, custom headers, timeout, and retries for LLM', () => {
    const config = resolveConfig({
      jev: { apiKey: 'test-key' },
      llm: {
        apiKey: 'openai-key',
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': 'https://myapp.com' },
        timeout: 45000,
        maxRetries: 3,
        organization: 'org-test',
        project: 'proj-test',
      },
    });

    expect(config.llm?.baseURL).toBe('https://openrouter.ai/api/v1');
    expect(config.llm?.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(config.llm?.defaultHeaders).toEqual({ 'HTTP-Referer': 'https://myapp.com' });
    expect(config.llm?.timeout).toBe(45000);
    expect(config.llm?.maxRetries).toBe(3);
    expect(config.llm?.organization).toBe('org-test');
    expect(config.llm?.project).toBe('proj-test');
  });
});
