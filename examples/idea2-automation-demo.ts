/**
 * JevBrow Next-Gen Automation Demo:
 * 1. Self-Healing Test Assertions (`page.aiAssert`)
 * 2. Smart Profile Form Auto-Mapper (`page.aiAutoFillForm`)
 * 3. Autonomous Goal-Seeking Navigation (`page.aiSeekGoal`)
 *
 * Run with:
 *   npx tsx examples/idea2-automation-demo.ts
 */

import { JevBrow, AssertionError } from '../src/index.js';

async function main() {
  console.log('🚀 Launching JevBrow Next-Gen Automation Demo...\n');

  const { browser, page } = await JevBrow.open('https://example.com', {
    showSteps: true,
    logLevel: 'info',
    browser: {
      headless: true,
      lightweight: true,
    },
  });

  try {
    // ─── 1. Self-Healing AI Assertions (E2E Testing) ────────────────────────
    console.log('\n============================================================');
    console.log('1. SELF-HEALING TEST ASSERTION (aiAssert)');
    console.log('============================================================\n');

    console.log('Evaluating semantic assertion on example.com...');
    // Assert without fragile CSS selectors
    await page.aiAssert('The page displays the domain title and informational text', {
      timeoutMs: 3000,
      minConfidence: 0.7,
    });
    console.log('✅ Assertion passed: Page structure verified semantically.');

    // Demonstrate failure behavior (catch semantic AssertionError)
    try {
      console.log('\nTesting assertion that should fail...');
      await page.aiAssert('A shopping cart with 5 checkout items is visible', {
        timeoutMs: 1500,
        minConfidence: 0.8,
      });
    } catch (err) {
      if (err instanceof AssertionError) {
        console.log(`🛡️ Caught expected AssertionError: "${err.message}"`);
        console.log(`   Confidence was: ${(err.probability * 100).toFixed(1)}% (threshold: ${(err.threshold * 100).toFixed(1)}%)`);
      }
    }

    // ─── 2. Smart Profile Form Auto-Mapper (aiAutoFillForm) ────────────────
    console.log('\n============================================================');
    console.log('2. SMART PROFILE FORM AUTO-MAPPER (aiAutoFillForm)');
    console.log('============================================================\n');

    console.log('Navigating to standard form page...');
    await page.aiNavigate('https://httpbin.org/forms/post');

    const userProfile = {
      customerName: 'Marcus Vance',
      telephone: '+1 (555) 987-6543',
      deliveryTime: '20:15',
      comments: 'Please leave package near the front porch door.',
      unrelatedKey: 'This key has no matching input on the page',
    };

    console.log('Auto-mapping and filling form from profile...');
    const fillResult = await page.aiAutoFillForm(userProfile);

    console.log('\nForm Auto-Fill Result:');
    console.log(`- Matched & Filled Fields: ${fillResult.filledFields.length}`);
    for (const f of fillResult.filledFields) {
      console.log(`  • [${f.profileKey}] -> ${f.fieldDescription} = "${f.value}" (conf: ${(f.confidence * 100).toFixed(1)}%)`);
    }
    console.log(`- Unmapped Profile Keys: [${fillResult.unmappedKeys.join(', ')}]`);

    // Verify fields populated using semantic assertion
    await page.aiAssert('The customer name input contains "Marcus Vance"');
    console.log('✅ Form values verified on page DOM.');

    // ─── 3. Autonomous Goal-Seeking Navigation (aiSeekGoal) ─────────────────
    console.log('\n============================================================');
    console.log('3. AUTONOMOUS GOAL-SEEKING CRAWLER (aiSeekGoal)');
    console.log('============================================================\n');

    await page.aiNavigate('https://example.com');
    console.log('Starting autonomous crawl from example.com...');

    const goalResult = await page.aiSeekGoal({
      goal: 'Find more information or domain management details',
      maxSteps: 3,
      onStep: (step) => {
        console.log(`  🧭 [Step ${step.stepNumber}] ${step.action} -> ${step.url}`);
      },
    });

    console.log('\nGoal Seek Summary:');
    console.log(`- Success:     ${goalResult.success ? 'YES' : 'NO'}`);
    console.log(`- Steps taken: ${goalResult.stepsTaken}`);
    console.log(`- Final URL:   ${goalResult.finalUrl}`);
    console.log(`- Traversed:   ${goalResult.path.join(' -> ')}`);

    console.log('\n============================================================');
    console.log('🎉 Next-Gen Automation Demo Completed Successfully!');
    console.log('============================================================');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Demo error:', err);
  process.exit(1);
});
