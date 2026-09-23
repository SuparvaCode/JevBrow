/**
 * OpenAI-compatible LLM engine.
 *
 * Handles tasks requiring generative text, reasoning, and vision:
 *   • Free-text generation and data extraction
 *   • Vision understanding (CAPTCHA analysis, screenshots)
 *   • Complex reasoning fallbacks
 *
 * Supports any OpenAI-compatible API via baseUrl:
 *   • Official OpenAI
 *   • Azure OpenAI
 *   • Ollama, vLLM, OpenRouter, Groq, DeepSeek
 */

import OpenAI from 'openai';
import { HttpLLMClient } from './http-llm-client.js';
import type { ResolvedConfig } from '../config.js';
import type { ElementInfo, PageState } from '../utils/types.js';
import { Logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

export class LLMEngine {
  private client: OpenAI | null = null;
  private httpClient: HttpLLMClient;
  private useHttp: boolean;
  private model: string;
  private isVisionCapable: boolean;
  private log: Logger;
  private userTemperature?: number;

  constructor(config: ResolvedConfig) {
    if (!config.llm) {
      throw new Error('LLMEngine requires LLM configuration.');
    }

    this.model = config.llm.model;
    this.isVisionCapable = config.llm.isVisionCapable;
    this.userTemperature = config.llm.temperature;
    this.useHttp = config.llm.useHttp;
    this.log = new Logger('JevBrow:LLM', config.logLevel);

    // Always initialize native fetch HTTP client
    this.httpClient = new HttpLLMClient({
      apiKey: config.llm.apiKey,
      baseUrl: config.llm.baseUrl,
      model: config.llm.model,
      organization: config.llm.organization,
      project: config.llm.project,
      defaultHeaders: config.llm.defaultHeaders,
      timeout: config.llm.timeout,
      maxRetries: config.llm.maxRetries,
      temperature: config.llm.temperature,
    });

    if (!this.useHttp) {
      try {
        const clientOpts: ConstructorParameters<typeof OpenAI>[0] = {
          apiKey: config.llm.apiKey,
          timeout: config.llm.timeout,
          maxRetries: config.llm.maxRetries,
        };

        if (config.llm.baseUrl) {
          clientOpts.baseURL = config.llm.baseUrl;
        }
        if (config.llm.organization) {
          clientOpts.organization = config.llm.organization;
        }
        if (config.llm.project) {
          clientOpts.project = config.llm.project;
        }
        if (config.llm.defaultHeaders && Object.keys(config.llm.defaultHeaders).length > 0) {
          clientOpts.defaultHeaders = config.llm.defaultHeaders;
        }

        this.client = new OpenAI(clientOpts);
      } catch {
        this.log.info('OpenAI SDK unavailable, falling back to native HTTP client');
        this.useHttp = true;
      }
    }
  }

  // ─── Element Selection (text-only fallback) ─────────────────────────────

  /**
   * Use the LLM to choose the best element when Jev confidence is low.
   * Text-only — sends element descriptions, not screenshots.
   */
  async chooseBestElement(
    elements: ElementInfo[],
    goal: string,
    pageState: PageState,
  ): Promise<{ index: number; reasoning: string } | null> {
    const elementList = elements
      .map(
        (el, i) =>
          `[${el.index}] <${el.tag}> ${el.text ? `text="${el.text.slice(0, 100)}"` : ''} ${el.id ? `id="${el.id}"` : ''} ${el.ariaLabel ? `aria-label="${el.ariaLabel}"` : ''} ${el.placeholder ? `placeholder="${el.placeholder}"` : ''} ${el.role ? `role="${el.role}"` : ''} ${el.href ? `href="${el.href.slice(0, 80)}"` : ''} ${el.inputType ? `type="${el.inputType}"` : ''}`.trim(),
      )
      .join('\n');

    const prompt = `You are a browser automation assistant. Given the goal and page elements below, choose the BEST element to interact with.

Page: ${pageState.url} — "${pageState.title}"
Goal: ${goal}

Elements:
${elementList}

Respond with ONLY a JSON object: {"index": <element_index>, "reasoning": "<brief explanation>"}
If no element matches, respond: {"index": -1, "reasoning": "<why>"}`;

    this.log.debug(`LLM element selection for: "${goal}"`);

    const result = await this.chat(prompt);

    try {
      const parsed = JSON.parse(result);
      if (typeof parsed.index === 'number') {
        return { index: parsed.index, reasoning: parsed.reasoning ?? '' };
      }
    } catch {
      this.log.warn('Failed to parse LLM element response', { result });
    }

    return null;
  }

  // ─── Text Generation ───────────────────────────────────────────────────

  /**
   * Generate text to type into a form field based on context.
   */
  async generateFormInput(
    fieldDescription: string,
    context: string,
  ): Promise<string> {
    const prompt = `You are filling out a web form. Generate the appropriate text to type into a form field.

Field: ${fieldDescription}
Context: ${context}

Respond with ONLY the text to type — no quotes, no explanation.`;

    return (await this.chat(prompt)).trim();
  }

  // ─── Vision / Screenshot Analysis ──────────────────────────────────────

  /**
   * Analyze a screenshot using the LLM's vision capability.
   * Returns a text description/analysis of the image.
   */
  async analyzeScreenshot(
    screenshotBase64: string,
    prompt: string,
  ): Promise<string> {
    if (!this.isVisionCapable) {
      throw new Error(
        'LLM is not configured as vision-capable. Set llm.isVisionCapable = true.',
      );
    }

    this.log.debug('Analyzing screenshot with vision LLM');

    const isNew = this.isReasoningOrNewModel();
    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_completion_tokens: 1024,
    };

    if (!isNew) {
      params.temperature = this.userTemperature ?? 0.1;
    }

    const messages = [
      {
        role: 'user' as const,
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${screenshotBase64}`,
              detail: 'high',
            },
          },
        ],
      },
    ];

    if (this.useHttp || !this.client) {
      return await this.httpClient.createChatCompletion(messages, 1024);
    }

    const response = await withRetry(
      async () => {
        try {
          return await this.client!.chat.completions.create(params);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('temperature') && params.temperature !== undefined) {
            delete params.temperature;
            return await this.client!.chat.completions.create(params);
          }
          // Fall back to HTTP client if SDK throws
          return {
            choices: [{ message: { content: await this.httpClient.createChatCompletion(messages, 1024) } }],
          };
        }
      },
      { maxAttempts: 2, logger: this.log },
    );

    return response.choices[0]?.message?.content?.trim() ?? '';
  }

  // ─── CAPTCHA Solving Helpers ───────────────────────────────────────────

  /**
   * Solve an image-selection CAPTCHA by identifying which grid cells match.
   * Requires vision capability.
   *
   * @returns Array of 1-based cell indices to click.
   */
  async solveImageCaptcha(
    screenshotBase64: string,
    instruction: string,
  ): Promise<number[]> {
    const prompt = `You are solving an image CAPTCHA challenge.

The image shows a grid of smaller images. The instruction is: "${instruction}"

Identify which grid cells match the instruction. Grid cells are numbered 1–N, left-to-right, top-to-bottom.

Respond with ONLY a JSON array of matching cell numbers, e.g. [1, 4, 7].
If none match, respond: []`;

    const result = await this.analyzeScreenshot(screenshotBase64, prompt);

    try {
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) {
        return parsed.filter((n): n is number => typeof n === 'number');
      }
    } catch {
      this.log.warn('Failed to parse CAPTCHA solution', { result });
    }

    return [];
  }

  /**
   * Solve a text/distorted-text CAPTCHA by reading the characters.
   * Requires vision capability.
   *
   * @returns The text to type.
   */
  async solveTextCaptcha(screenshotBase64: string): Promise<string> {
    const prompt = `You are solving a text CAPTCHA. The image shows distorted or noisy text characters.

Read the characters as accurately as possible. Pay close attention to:
- Similar-looking characters (0/O, 1/l/I, 5/S, 8/B)
- Case sensitivity
- Ignore background noise

Respond with ONLY the text you read — no quotes, no explanation.`;

    return (await this.analyzeScreenshot(screenshotBase64, prompt)).trim();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /** Check if the configured model is a reasoning or newer model that restricts parameters. */
  private isReasoningOrNewModel(): boolean {
    const m = this.model.toLowerCase();
    return (
      m.startsWith('o1') ||
      m.startsWith('o3') ||
      m.startsWith('gpt-5') ||
      m.includes('nano')
    );
  }

  // ─── Low-Level Chat ────────────────────────────────────────────────────

  /**
   * Send a text-only chat completion request.
   */
  async chat(prompt: string): Promise<string> {
    const isNew = this.isReasoningOrNewModel();
    const tokenBudget = isNew ? 4096 : 1024;
    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: tokenBudget,
    };

    if (!isNew) {
      params.temperature = this.userTemperature ?? 0.1;
    }

    const messages: Array<{ role: 'user'; content: string }> = [{ role: 'user', content: prompt }];

    if (this.useHttp || !this.client) {
      return await this.httpClient.createChatCompletion(messages, tokenBudget);
    }

    const response = await withRetry(
      async () => {
        try {
          return await this.client!.chat.completions.create(params);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('temperature') && params.temperature !== undefined) {
            delete params.temperature;
            return await this.client!.chat.completions.create(params);
          }
          // Fall back to HTTP client if SDK throws
          return {
            choices: [{ message: { content: await this.httpClient.createChatCompletion(messages, isNew ? 2048 : 512) } }],
          };
        }
      },
      { maxAttempts: 2, logger: this.log },
    );

    return response.choices[0]?.message?.content?.trim() ?? '';
  }
}
