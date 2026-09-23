/**
 * JevBrow Example: Form Filling
 *
 * Demonstrates AI-powered form filling with both Jev
 * for element selection and LLM for text generation.
 *
 * Usage:
 *   TYPESAFE_API_KEY=... OPENAI_API_KEY=... npx tsx examples/form-filling.ts
 */

import { JevBrow } from '../src/index.js';

async function main() {
  const browser = new JevBrow({
    jev: {
      apiKey: process.env.TYPESAFE_API_KEY || '',
    },
    // Optional: LLM for generating form text
    llm: process.env.OPENAI_API_KEY
      ? {
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          baseUrl: process.env.OPENAI_BASE_URL || '',
          isVisionCapable: process.env.OPENAI_VISION_CAPABLE === 'true',
        }
      : undefined,
    browser: {
      headless: false,
      lightweight: false,
    },
  });

  try {
    await browser.launch();
    const page = await browser.newPage();

    // Navigate to a form page
    await page.aiNavigate('https://httpbin.org/forms/post');
    console.log('Navigated to form page');

    // Fill in form fields using natural language descriptions
    await page.aiType('customer name field', 'John Smith');
    console.log('Filled customer name');

    await page.aiType('telephone field', '555-0123');
    console.log('Filled telephone');

    // Click a specific option
    await page.aiClick('medium size option');
    console.log('Selected size');

    // Click a topping checkbox
    await page.aiClick('cheese topping');
    console.log('Selected topping');

    // Fill delivery time
    await page.aiType('delivery time field', '19:30');
    console.log('Filled delivery time');

    // Fill delivery instructions
    await page.aiType('delivery instructions', 'Please ring the doorbell twice');
    console.log('Filled instructions');

    // Wait to see the result
    await page.wait(3000);

    // Submit the form
    await page.aiClick('submit button');
    console.log('Submitted form!');

    await page.wait(3000);
    console.log(`Result page: ${page.url()}`);

    await page.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

main();
