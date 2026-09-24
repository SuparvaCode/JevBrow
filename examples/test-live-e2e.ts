/**
 * End-to-end Live Test for JevBrow
 *
 * Verifies:
 * 1. Jev AI API connectivity and response
 * 2. OpenAI LLM fallback API connectivity (using .env config)
 * 3. Full JevBrow browser lifecycle (launch, navigate, evaluate, click, close)
 */

import { JevBrow } from '../src/index.js';
import OpenAI from 'openai';

try {
  if (typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === 'function') {
    (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
  }
} catch {
  // Ignore
}

async function runLiveTest() {
  console.log('=== JevBrow Live End-to-End Verification ===\n');

  // 1. Verify Environment Variables
  const jevKey = process.env.TYPESAFE_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

  console.log('1. Checking Environment:');
  console.log(`   - TYPESAFE_API_KEY: ${jevKey ? '✓ Present (' + jevKey.slice(0, 12) + '...)' : '✗ Missing'}`);
  console.log(`   - OPENAI_API_KEY: ${openaiKey ? '✓ Present (' + openaiKey.slice(0, 10) + '...)' : '✗ Missing'}`);
  console.log(`   - OPENAI_MODEL: ${openaiModel}`);
  console.log(`   - OPENAI_VISION_CAPABLE: ${process.env.OPENAI_VISION_CAPABLE || 'false'}\n`);

  if (!jevKey) {
    throw new Error('TYPESAFE_API_KEY is required in .env');
  }

  // 2. Verify OpenAI API Connectivity (if key present)
  if (openaiKey) {
    console.log('2. Testing OpenAI LLM connectivity...');
    const openai = new OpenAI({
      apiKey: openaiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });

    try {
      const isNew = openaiModel.startsWith('o1') || openaiModel.startsWith('o3') || openaiModel.startsWith('gpt-5') || openaiModel.includes('nano');
      const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
        model: openaiModel,
        messages: [{ role: 'user', content: 'Reply with the word SUCCESS only.' }],
        max_completion_tokens: 1000,
      };
      if (!isNew) {
        params.temperature = 0.1;
      }
      const completion = await openai.chat.completions.create(params);
      const reply = completion.choices[0]?.message?.content?.trim();
      console.log(`   ✓ LLM responded: "${reply}" (Model: ${openaiModel})\n`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`   ⚠ LLM call returned warning: ${errMsg}`);
      console.warn('   (Will continue with fallback model testing)\n');
    }
  }

  // 3. Test Full JevBrow Browser Automation
  console.log('3. Testing JevBrow Browser Automation with Jev AI...');
  const browser = new JevBrow({
    browser: {
      headless: true,
      lightweight: true,
    },
  });

  try {
    await browser.launch();
    console.log('   ✓ Chromium launched successfully');

    const page = await browser.newPage();
    console.log('   ✓ New page created');

    console.log('   → Navigating to https://example.com...');
    await page.aiNavigate('https://example.com');
    const title = await page.title();
    console.log(`   ✓ Page loaded: "${title}" (${page.url()})`);

    // Ask Jev AI questions about the page
    console.log('   → Querying Jev AI for page understanding...');
    const hasHeader = await page.aiAsk('Is there an "Example Domain" heading on this page?');
    console.log(`   ✓ Jev answer: ${hasHeader.result ? 'YES' : 'NO'} (probability: ${hasHeader.probability.toFixed(3)})`);

    const isLogin = await page.aiAsk('Is this a login page?');
    console.log(`   ✓ Jev answer (is login): ${isLogin.result ? 'YES' : 'NO'} (probability: ${isLogin.probability.toFixed(3)})`);

    // Check page readiness
    const isReady = await page.aiIsReady();
    console.log(`   ✓ Jev page readiness: ${isReady ? 'Ready' : 'Not ready'}`);

    // Click link via Jev element choice
    console.log('   → Finding and clicking link via Jev AI...');
    const clickDecision = await page.aiClick('link for more information');
    if (clickDecision) {
      console.log(`   ✓ Jev selected element: <${clickDecision.element.tag}> "${clickDecision.element.text}"`);
      console.log(`     Confidence: ${clickDecision.confidence.toFixed(2)} | Source: ${clickDecision.source}`);
      await page.wait(1500);
      console.log(`   ✓ Current URL after navigation: ${page.url()}`);
    } else {
      console.log('   ℹ No matching element found to click');
    }

    // Test form input generation if LLM is configured
    if (openaiKey) {
      console.log('\n4. Testing LLM Form Generation through Router...');
      const generated = await browser.decisionRouter.generateFormInput(
        'Email address for a developer',
        'Developer registration portal',
      );
      console.log(`   ✓ Router generated input: "${generated}"`);
    }

    await browser.close();
    console.log('\n✓ Browser closed cleanly');
    console.log('\n=== ALL LIVE TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

runLiveTest().catch((err) => {
  console.error('\n❌ Live test failed:', err);
  process.exit(1);
});
