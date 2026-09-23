/**
 * JevBrow Example: CAPTCHA Solving Demo
 *
 * Demonstrates automatic CAPTCHA detection and solving.
 * Requires LLM with vision capability for image/text CAPTCHAs.
 *
 * Usage:
 *   TYPESAFE_API_KEY=... OPENAI_API_KEY=... npx tsx examples/captcha-demo.ts
 */

import { JevBrow } from '../src/index.js';

async function main() {
  const browser = new JevBrow({
    jev: {
      apiKey: process.env.TYPESAFE_API_KEY || '',
    },
    llm: process.env.OPENAI_API_KEY
      ? {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          baseUrl: process.env.OPENAI_BASE_URL || '',
          isVisionCapable: true, // Required for image/text CAPTCHAs
        }
      : undefined,
    browser: {
      headless: false,
      lightweight: false, // Don't block images — needed for CAPTCHA solving
    },
  });

  try {
    await browser.launch();
    const page = await browser.newPage();

    // Navigate to a page that might have a CAPTCHA
    const targetUrl = process.argv[2] || 'https://example.com';
    await page.aiNavigate(targetUrl);
    console.log(`Navigated to: ${targetUrl}`);

    // Step 1: Detect CAPTCHA
    console.log('\n--- CAPTCHA Detection ---');
    const detection = await page.aiDetectCaptcha();
    console.log(`Type: ${detection.type}`);
    console.log(`Confidence: ${detection.confidence.toFixed(2)}`);

    if (detection.type === 'none') {
      console.log('No CAPTCHA found on this page.');
      console.log('Try passing a URL with a CAPTCHA as a command-line argument.');
      await page.close();
      return;
    }

    // Step 2: Attempt to solve
    console.log('\n--- CAPTCHA Solving ---');
    const result = await page.aiSolveCaptcha();

    console.log(`\nResult:`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Type: ${result.type}`);
    console.log(`  Attempts: ${result.attempts}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }

    await page.wait(5000);
    await page.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main();
