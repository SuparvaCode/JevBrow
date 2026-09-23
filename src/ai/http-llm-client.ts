/**
 * Zero-dependency HTTP client for OpenAI-compatible APIs using native fetch.
 * Used when the `openai` package is not installed or when HTTP mode is preferred.
 */

import { Logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

export interface HttpLLMOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
  organization?: string;
  project?: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
}

export class HttpLLMClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private organization?: string;
  private project?: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private maxRetries: number;
  private temperature?: number;
  private log: Logger;

  constructor(opts: HttpLLMOptions) {
    this.apiKey = opts.apiKey;
    let url = opts.baseUrl?.trim() || 'https://api.openai.com/v1';
    if (url.endsWith('/')) url = url.slice(0, -1);
    this.baseUrl = url;
    this.model = opts.model;
    this.organization = opts.organization;
    this.project = opts.project;
    this.defaultHeaders = opts.defaultHeaders || {};
    this.timeout = opts.timeout ?? 60_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.temperature = opts.temperature;
    this.log = new Logger('JevBrow:HttpLLM', 'debug');
  }

  private isReasoningOrNewModel(): boolean {
    const m = this.model.toLowerCase();
    return (
      m.startsWith('o1') ||
      m.startsWith('o3') ||
      m.startsWith('gpt-5') ||
      m.includes('nano')
    );
  }

  /**
   * Send a chat completion request to the OpenAI-compatible endpoint.
   */
  async createChatCompletion(messages: ChatMessage[], maxTokens: number = 512): Promise<string> {
    const isNew = this.isReasoningOrNewModel();
    const endpoint = `${this.baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }
    if (this.project) {
      headers['OpenAI-Project'] = this.project;
    }

    const payload: Record<string, unknown> = {
      model: this.model,
      messages,
      max_completion_tokens: maxTokens,
    };

    if (!isNew) {
      payload.temperature = this.temperature ?? 0.1;
    }

    const executeRequest = async (bodyPayload: Record<string, unknown>): Promise<string> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          // If error is about temperature, retry without temperature
          if (errorText.includes('temperature') && bodyPayload.temperature !== undefined) {
            delete bodyPayload.temperature;
            return await executeRequest(bodyPayload);
          }
          // If error is about max_completion_tokens, retry with max_tokens
          if (errorText.includes('max_completion_tokens') && bodyPayload.max_completion_tokens !== undefined) {
            const tokens = bodyPayload.max_completion_tokens;
            delete bodyPayload.max_completion_tokens;
            bodyPayload.max_tokens = tokens;
            return await executeRequest(bodyPayload);
          }
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };

        return data.choices?.[0]?.message?.content?.trim() ?? '';
      } finally {
        clearTimeout(timer);
      }
    };

    return await withRetry(
      () => executeRequest({ ...payload }),
      { maxAttempts: this.maxRetries, logger: this.log },
    );
  }
}
