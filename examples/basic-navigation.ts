/**
 * JevBrow Example: Basic Navigation
 *
 * Demonstrates navigating to a page, checking elements,
 * and asking AI-powered questions about the page.
 *
 * Usage:
 *   TYPESAFE_API_KEY=... npx tsx examples/basic-navigation.ts
 */

import { JevBrow } from '../src/index.js';

async function main() {
  // Create JevBrow with Jev AI only (no LLM fallback needed for basic navigation)
  const browser = new JevBrow({
    jev: {
      apiKey: process.env.TYPESAFE_API_KEY || '',
    },
    browser: {
      headless: false,  // Set to true for background operation
      lightweight: false,
    },
  });

  try {
    // Launch the browser
    await browser.launch();
    console.log('Browser launched!');

    // Create a new AI-enhanced page
    const page = await browser.newPage();

    // Navigate to a website
    await page.aiNavigate('https://example.com');
    console.log(`Page title: ${await page.title()}`);
    console.log(`Page URL: ${page.url()}`);

    // Ask questions about the page using Jev AI
    const hasLinks = await page.aiAsk('Does this page contain any clickable links?');
    console.log(`Has links: ${hasLinks.result} (probability: ${hasLinks.probability.toFixed(3)})`);

    const isLoginPage = await page.aiAsk('Is this a login page?');
    console.log(`Is login page: ${isLoginPage.result} (probability: ${isLoginPage.probability.toFixed(3)})`);

    // Check if page is ready
    const ready = await page.aiIsReady();
    console.log(`Page ready: ${ready}`);

    // Get structured page state (for debugging)
    const state = await page.getPageState();
    console.log(`Found ${state.elements.length} interactive elements`);

    // Click the "More information..." link
    const clickResult = await page.aiClick('More information link');
    if (clickResult) {
      console.log(`Clicked element (${clickResult.source}, confidence: ${clickResult.confidence.toFixed(2)})`);
      await page.wait(2000);
      console.log(`Navigated to: ${page.url()}`);
    }

    // Wait a moment so you can see the result
    await page.wait(3000);

    // Close the page
    await page.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    // Always close the browser
    await browser.close();
  }
}

main();
