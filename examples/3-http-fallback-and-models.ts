/**
 * JevBrow Example: Native HTTP Fallback & Custom LLM Models
 *
 * Demonstrates:
 * 1. Running with `useHttp: true` (zero OpenAI SDK required, uses native fetch)
 * 2. Works with custom base URLs (Ollama, vLLM, DeepSeek, OpenRouter, Groq)
 * 3. Works with modern reasoning models (gpt-5.6-luna, gpt-5.6-terra, deepseek-v4.1-flash) automatically
 *
 * Run with:
 *   npx tsx examples/3-http-fallback-and-models.ts
 */

import { JevBrow } from '../src/index.js';

async function main() {
  console.log('🚀 Starting JevBrow with Native HTTP LLM Client...');

  const browser = new JevBrow({
    // Jev AI (TypeSafe System One) — reads TYPESAFE_API_KEY from .env
    jev: {},
    // LLM Engine configured with native HTTP fetch
    llm: {
      useHttp: true, // Forces zero-dependency native fetch
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      // baseUrl: 'https://openrouter.ai/api/v1', // Optional: works with any OpenAI-compatible API
    },
    browser: {
      headless: true,
      lightweight: true,
    },
    showSteps: true,
    logLevel: 'info',
  });

  try {
    await browser.launch();
    const page = await browser.newPage();

    console.log('\n--- 1. Navigating to Example Domain ---');
    await page.aiNavigate('https://example.com');

    console.log('\n--- 2. Jev AI Probability Decisions (<100ms) ---');
    const isLogin = await page.aiAsk('Is this a login page?');
    console.log(`> Is login page? ${isLogin.result ? 'YES' : 'NO'} (${(isLogin.probability * 100).toFixed(1)}% prob via ${isLogin.source})`);

    const hasLinks = await page.aiAsk('Is there a link or button on this page?');
    console.log(`> Has link/button? ${hasLinks.result ? 'YES' : 'NO'} (${(hasLinks.probability * 100).toFixed(1)}% prob via ${hasLinks.source})`);

    console.log('\n--- 3. LLM Form Generation via Native HTTP Client ---');
    // If text is not provided to aiType, it asks the LLM to generate appropriate input for the field
    await page.aiNavigate('https://httpbin.org/forms/post');
    await page.aiType('customer name field', 'Alice Morgan');
    console.log('Successfully filled input field!');

    console.log('\n✅ Demo completed successfully with Native HTTP LLM!');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
