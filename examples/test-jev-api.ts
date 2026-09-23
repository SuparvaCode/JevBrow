/**
 * Quick test: Verify Jev API connectivity with the provided API key.
 */

import { TypeSafeClient, choice, noul, score } from '@typesafe-ai/sdk';

try {
  if (typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === 'function') {
    (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
  }
} catch {
  // Ignore
}

const API_KEY = process.env.TYPESAFE_API_KEY || '';

if (!API_KEY) {
  console.error('Set TYPESAFE_API_KEY environment variable or in .env');
  process.exit(1);
}

async function testJev() {
  console.log('Testing Jev AI connectivity...\n');

  const client = new TypeSafeClient({ apiKey: API_KEY });

  const response = await client.systemOne({
    model: 'jev-latest',
    state: 'A webpage showing a login form with email and password fields, a "Sign In" button, and a "Forgot Password?" link.',
    questions: {
      has_login: noul('The page contains a login form.'),
      best_action: choice('What is the primary action on this page?', {
        login: 'Sign in to an account',
        register: 'Create a new account',
        browse: 'Browse content without logging in',
      }),
      urgency: score('How urgent is the action required?', [
        'Not urgent at all',
        'Somewhat important',
        'Very urgent, must act immediately',
      ]),
    },
  });

  console.log('✅ Jev API connection successful!\n');
  console.log('Model:', response.model);
  console.log('');

  const hasLogin = response.answers.has_login;
  console.log(`has_login (noul): ${hasLogin.noul.toFixed(3)}`);
  console.log('');

  const bestAction = response.answers.best_action;
  console.log(`best_action (choice): "${bestAction.choice}"`);
  console.log(`  confidence: ${bestAction.confidence.toFixed(3)}`);
  console.log(`  probabilities:`, bestAction.probabilities);
  console.log('');

  const urgencyAnswer = response.answers.urgency;
  console.log(`urgency (score): ${urgencyAnswer.score.toFixed(3)}`);
  console.log(`  confidence: ${urgencyAnswer.confidence.toFixed(3)}`);
  console.log(`  probabilities:`, urgencyAnswer.probabilities);
  console.log('');

  console.log('Usage:', response.usage);
}

testJev().catch(console.error);
