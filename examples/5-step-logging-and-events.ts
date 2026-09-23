/**
 * JevBrow Example: Step Logging & Telemetry Events
 *
 * Demonstrates:
 * 1. Listening to real-time `onStep` events
 * 2. Accessing probability scores and model decision metadata
 * 3. Exporting step history or streaming to your logging pipeline
 *
 * Run with:
 *   npx tsx examples/5-step-logging-and-events.ts
 */

import { JevBrow } from '../src/index.js';
import type { StepLog } from '../src/index.js';

async function main() {
  console.log('🚀 JevBrow Step Logging & Telemetry Example\n');

  const stepHistory: StepLog[] = [];

  const browser = new JevBrow({
    browser: {
      headless: true,
      lightweight: true,
    },
    // Show colored terminal output
    showSteps: true,
    logLevel: 'info',
    // Hook into every automation step
    onStep: (step: StepLog) => {
      stepHistory.push(step);
      console.log(`\n[EVENT HOOK] Step Type: ${step.type.toUpperCase()}`);
      console.log(`  Target:     ${step.target || step.message}`);
      console.log(`  Engine:     ${step.source || 'n/a'}`);
      if (step.probability !== undefined) {
        console.log(`  Prob:       ${(step.probability * 100).toFixed(1)}%`);
      }
      if (step.confidence !== undefined) {
        console.log(`  Confidence: ${(step.confidence * 100).toFixed(1)}%`);
      }
      console.log(`  Duration:   ${step.durationMs}ms`);
      console.log(`  Status:     ${step.success ? 'SUCCESS' : 'FAILED'}`);
    },
  });

  try {
    await browser.launch();
    const page = await browser.newPage();

    await page.aiNavigate('https://example.com');
    await page.aiAsk('Is the page completely rendered?');
    await page.aiAsk('Does this page ask for a credit card?');
    await page.aiClick('More information link');

    console.log('\n============================================================');
    console.log(`📊 Total Automation Steps Recorded: ${stepHistory.length}`);
    const avgDuration =
      stepHistory.reduce((sum, s) => sum + (s.durationMs || 0), 0) / (stepHistory.length || 1);
    console.log(`⏱️  Average Step Duration: ${avgDuration.toFixed(0)}ms`);
    console.log('============================================================');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
