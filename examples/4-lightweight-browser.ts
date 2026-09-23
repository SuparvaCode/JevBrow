/**
 * JevBrow Example: Lightweight Browser & Resource Blocking
 *
 * Demonstrates:
 * 1. Using system-installed browsers (e.g. Edge or Chrome) to avoid downloading binaries
 * 2. Blocking images, media, web fonts, and analytics for maximum speed and minimum memory/CPU
 * 3. Fast extraction and scraping powered by Jev AI
 *
 * Run with:
 *   npx tsx examples/4-lightweight-browser.ts
 */

import { JevBrow } from '../src/index.js';

async function main() {
  console.log('🚀 Launching Lightweight JevBrow Browser...');

  const browser = new JevBrow({
    browser: {
      // Lightweight mode: automatically blocks images, fonts, media, and trackers
      lightweight: true,
      // Use system Edge on Windows or Chrome (avoids large Playwright downloads)
      channel: process.platform === 'win32' ? 'msedge' : undefined,
    },
    showSteps: true,
    logLevel: 'info',
  });

  try {
    await browser.launch();
    const page = await browser.newPage();

    console.log('\n--- 1. Navigating to News/Doc Site with Image & Font Blocking ---');
    const t0 = Date.now();
    await page.aiNavigate('https://news.ycombinator.com');
    console.log(`Loaded in ${Date.now() - t0}ms`);

    console.log('\n--- 2. Page Questions with Jev AI (<100ms) ---');
    const isTechNews = await page.aiAsk('Is this a technology news aggregator?');
    console.log(`> Tech news? ${isTechNews.result ? 'YES' : 'NO'} (${(isTechNews.probability * 100).toFixed(1)}%)`);

    const hasPaywall = await page.aiAsk('Is there a paywall or subscription popup visible?');
    console.log(`> Paywall? ${hasPaywall.result ? 'YES' : 'NO'} (${(hasPaywall.probability * 100).toFixed(1)}%)`);

    console.log('\n--- 3. Interactive Element Selection ---');
    const state = await page.getPageState();
    console.log(`Extracted ${state.elements.length} elements instantly`);

    // Click "new" stories
    const clickResult = await page.aiClick('new link in the header navigation');
    if (clickResult) {
      console.log(`Navigated to new section: ${page.url()}`);
    }

    console.log('\n✅ Lightweight browser test completed!');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
