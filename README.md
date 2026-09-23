<p align="center">
  <img src="./assets/jev-brow-banner.png" alt="JevBrow — Natural Language Browser Driver" width="100%" />
</p>

# JevBrow

<p align="center">
  <strong>Sub-100ms Natural Language Browser Driver & Automation Framework</strong><br>
  Powered by <strong>Jev AI (TypeSafe System One)</strong> with an intelligent <strong>OpenAI-compatible LLM fallback</strong>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/jevbrow"><img src="https://img.shields.io/npm/v/jevbrow.svg?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/jevbrow"><img src="https://img.shields.io/npm/dm/jevbrow.svg?style=flat-square&color=green" alt="npm downloads" /></a>
  <a href="https://github.com/SuparvaCode/JevBrow/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
  <a href="https://github.com/SuparvaCode/JevBrow"><img src="https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
</p>

---

## 💡 The Core Problem: Why Traditional LLM Browser Drivers Are Broken

Modern AI browser drivers (Stagehand, Browserbase, Browser-Use, MultiOn) rely almost exclusively on Large Language Models (LLMs) or Vision Models (GPT-4o, Claude 3.5 Sonnet) for **every single interaction**:

1. **Massive Token Waste:** Each step serializes 15,000 to 50,000 tokens of raw DOM trees or high-resolution screenshot images. A simple 10-step form submission consumes **200,000+ tokens** ($0.50 – $2.00 per single run).
2. **Crippling Latency:** Autoregressive LLMs take **3 to 8 seconds** to generate tokens for trivial decisions like *"which button is Submit?"*.
3. **Flaky Selectors & Hallucinations:** Generative models often invent non-existent CSS selectors or hallucinate bounding boxes when DOM trees shift.

### 💰 Cost & Speed Comparison: Traditional LLM vs. JevBrow

| Metric | Traditional LLM Driver (GPT-4o / Claude) | JevBrow (Jev System One + Fallback) | Improvement |
|---|---|---|---|
| **Latency per Action** | 3,000 ms – 7,000 ms | **80 ms – 150 ms** | **~30x Faster** ⚡ |
| **Tokens per Step** | 15,000 – 40,000 tokens | **0 LLM tokens** (95% of routine actions) | **98%+ Reduction** |
| **Cost per 1,000 Actions** | $15.00 – $40.00 | **<$0.40** | **95%+ Savings** 💵 |
| **Page Readiness Checks** | Arbitrary `sleep(5000)` or slow prompt | Sub-100ms calibrated probability check | Instant & deterministic |
| **Failure Recovery** | Restarts whole prompt / session | Confidence-gated escalation | Graceful fallback |

---

## 🧠 How JevBrow Works: The System One Architecture

JevBrow separates browser automation into two distinct cognitive systems:

```
                    Natural Language Intent
                               │
                               ▼
                   ┌───────────────────────┐
                   │   Lean DOM Analyzer   │  Extracts visible interactive nodes
                   └───────────┬───────────┘
                               │
                               ▼
               ┌───────────────────────────────┐
               │    Jev AI (System One)        │  Sub-100ms structured decision
               │    Choice / Score / Noul      │  Calibrated probability scores
               └───────────────┬───────────────┘
                               │
                     Confidence ≥ 0.65?
                     ┌─────────┴─────────┐
                     │ YES               │ NO
                     ▼                   ▼
              ┌─────────────┐     ┌──────────────┐
              │   Execute   │     │ LLM Fallback │ (Text generation,
              │   Action    │     └──────┬───────┘  vision, ambiguity)
              └─────────────┘            │
                                  Fallback ready?
                                  ┌──────┴──────┐
                                  │ YES         │ NO
                                  ▼             ▼
                           ┌────────────┐ ┌─────────────┐
                           │ LLM Action │ │ Jev Best    │
                           └────────────┘ │ Guess       │
                                          └─────────────┘
```

### 1. Jev AI (TypeSafe System One Engine) — 95% of Work
Jev is **not a slow autoregressive LLM**. It is a System One model engineered specifically for ultra-fast, structured classification and evaluation with calibrated probability outputs:
- **`choice`**: Selects the exact target element index from candidates with a softmax probability distribution ($P(\text{element}_i \mid \text{intent})$).
- **`noul`**: Evaluates yes/no questions as true mathematical probabilities ($P(\text{condition} = \text{true})$), used for instant page readiness, error alert detection, and state verification.
- **`score`**: Ranks candidate elements (0–4) for complex multi-criteria relevance.
- **Parallel Batching**: Can evaluate 5–10 conditions in a single sub-100ms API call.

> **💡 What Jev AI Is (and Is Not):**
> Jev AI operates strictly on text and structured DOM metadata (`tag`, `id`, `class`, `aria-label`, visible text). **Jev AI does NOT have computer vision and cannot see or process images.** It does not generate freeform conversational text. Its superpower is sub-100ms structured decision-making over structured input.

### 2. OpenAI-Compatible LLM Engine — 5% Fallback
The LLM only activates when genuinely required:
- Creative text generation for open-ended form fields
- Page summarization and structured data extraction (`aiSummarize`, `aiExtract`)
- Visual reasoning over screenshots when a vision model (e.g. GPT-4o) is configured
- Ambiguous edge-cases where Jev confidence is below threshold

---

## ⚡ Key Features

- 🏎️ **Sub-100ms Decision Speed:** Powered by TypeSafe System One Jev primitives.
- 🎯 **Zero CSS Selector Fragility:** Control the browser purely with natural language intents (`aiClick("sign in button")`, `aiType("email", "user@test.com")`).
- 🛡️ **Self-Healing Test Assertions (`aiAssert`):** Semantic E2E test assertions with calibrated probabilities that never break across CSS class or UI redesigns.
- 📋 **Smart Profile Form Auto-Mapper (`aiAutoFillForm`):** Batch-maps and populates entire web forms from arbitrary JSON profiles in a single sub-100ms API call.
- 🧭 **Autonomous Goal-Seeking Crawler (`aiSeekGoal`):** Traverses unknown websites toward an objective without hardcoded navigation scripts.
- ⏳ **Smart AI Waiting (`aiWaitFor`):** Polls pages dynamically with Jev probability checks—say goodbye to flaky `sleep(3000)`.
- 📊 **Intelligent Page Summarization (`aiSummarize` & `aiExtract`):** Extract executive statistics, financial tables, and JSON schemas directly from live pages.
- 📍 **Element Coordinates & Points (`aiFindElement`):** Retrieve bounding boxes and center points `{ x, y, width, height, centerX, centerY }` for vision models or custom click drivers.
- 🤖 **Agent Orchestrator Ready:** Export standard OpenAI Function Calling / LangChain tool definitions (`getToolDefinitions()`, `executeAction()`).
- 🧑‍💻 **Human-in-the-Loop:** Seamless `onPrompt` hook to pause and ask users for 2FA, OTPs, or verification inputs during automation.
- 🪶 **Ultra-Lightweight & Multi-Engine:** Supports Chromium, Firefox, WebKit, and native system browsers (Chrome, Edge). Blocks images, fonts, media, and trackers for minimum RAM usage.
- 🌐 **Zero-Dependency Native HTTP Client:** Works out-of-the-box via native `fetch`—no external `openai` SDK required. Compatible with Ollama, vLLM, DeepSeek, Groq, OpenRouter, and Azure.

---

## 📦 Installation

```bash
npm install jevbrow
```

> **Zero Extra Binaries Required:** On Windows, macOS, or Linux, JevBrow can directly use your existing system Google Chrome or Microsoft Edge browser without downloading large Playwright binaries!

---

## 🚀 Quick Start

### 1. The Minimal 5-Line Automation

```javascript
import { JevBrow } from 'jevbrow';

// 1. Launch & navigate in a single call
const { browser, page } = await JevBrow.open('https://example.com/portal', {
  logLevel: 'silent', // Clean, silent output
});

// 2. Natural language login
await page.aiType('username', 'demo_user');
await page.aiType('password', 'secure_password_123');
await page.aiClick('sign in');

// 3. Smart wait for dashboard (no hardcoded sleep!)
await page.aiWaitFor('the user dashboard has loaded');

// 4. Extract intelligent stats summary via LLM
const summary = await page.aiSummarize('Extract all account metrics and stats');
console.log(summary);

await browser.close();
```

---

### 2. High-Level One-Liner Login

```javascript
import { JevBrow } from 'jevbrow';

const { browser, page } = await JevBrow.open('https://example.com/login');

// Automatically locates username, password, and clicks submit
await page.aiLogin({ username: 'myuser', password: 'mypassword123' });

// Check post-login status
const loggedIn = await page.aiAsk('Is the user account dashboard visible?');
console.log('Login Success:', loggedIn.result);

await browser.close();
```

---

### 3. Smart Waiting vs. Hardcoded Sleep

Stop writing fragile `await sleep(5000)`:

```javascript
// Polls page state every 500ms using sub-100ms Jev probability checks
// Returns immediately when the condition passes with high confidence!
await page.aiWaitFor('the payment checkout confirmation is displayed');

// Check for error banners dynamically
const error = await page.aiAsk('Is there an invalid card error visible?');
if (error.result) {
  console.error('Payment failed!');
}
```

---

### 4. Bounding Box & Coordinate Point Retrieval

Retrieve element coordinates to feed into vision models or draw UI overlays:

```javascript
const btn = await page.aiFindElement('submit order button');

if (btn) {
  console.log(`Selector: ${btn.selector}`);
  console.log(`Coordinates: (${btn.box.centerX}px, ${btn.box.centerY}px)`);
  console.log(`Confidence: ${(btn.confidence * 100).toFixed(1)}% via ${btn.source}`);
}
```

---

### 5. Structured JSON Data Extraction

```javascript
interface DashboardMetrics {
  netSales: string;
  netProfit: string;
  totalOrders: number;
}

const metrics = await page.aiExtract<DashboardMetrics>(
  'Extract net sales, net profit, and total orders as JSON'
);

console.log('Parsed Metrics:', metrics);
```

---

### 6. Self-Healing E2E Test Assertions (`aiAssert`)

Stop writing brittle test assertions that break whenever CSS class names or DOM hierarchies change:

```javascript
// Validates page condition dynamically using sub-100ms Jev probability checks
// Throws an AssertionError if probability does not reach threshold within timeout
await page.aiAssert('The checkout completed successfully and an order confirmation is visible');
await page.aiAssert('No credit card validation errors are displayed');
```

---

### 7. Smart Profile Form Auto-Mapper (`aiAutoFillForm`)

Pass an arbitrary JSON user profile to automatically match and populate all form fields in a single sub-100ms batched Jev query:

```javascript
const userProfile = {
  customerName: 'Marcus Vance',
  telephone: '+1 (555) 987-6543',
  deliveryTime: '20:15',
  comments: 'Please leave package near the front porch door.',
};

// Maps inputs, textareas, and selects in 1 batch Jev call and populates them
const result = await page.aiAutoFillForm(userProfile, { submitAfter: true });

console.log(`Auto-filled ${result.filledFields.length} inputs!`);
console.log('Unmapped profile keys:', result.unmappedKeys);
```

---

### 8. Autonomous Goal-Seeking Navigation (`aiSeekGoal`)

Instruct the browser to autonomously discover and navigate to deep pages across unknown websites without hardcoded selectors:

```javascript
const result = await page.aiSeekGoal({
  goal: 'Find the developer API documentation or pricing guide',
  maxSteps: 4,
  onStep: (step) => console.log(`Step ${step.stepNumber}: ${step.action} -> ${step.url}`),
});

console.log('Reached goal:', result.success);
console.log('Path traversed:', result.path);
```

---

## 🛠️ AI Orchestrator / Tool-Calling Integration

You can plug JevBrow directly into **LangChain**, **OpenAI Function Calling**, **Vercel AI SDK**, **AutoGen**, or custom agent loops:

```javascript
import { JevBrow } from 'jevbrow';

const { browser, page } = await JevBrow.open();

// 1. Get standard OpenAI-compatible tool definitions
const tools = page.getToolDefinitions();

// 2. Pass tools to your LLM orchestrator:
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Go to github.com and search for jevbrow' }],
  tools: tools.map(t => ({ type: 'function', function: t })),
});

// 3. Execute tool call dynamically:
const toolCall = response.choices[0].message.tool_calls[0];
const result = await page.executeAction(
  toolCall.function.name, 
  JSON.parse(toolCall.function.arguments)
);

console.log('Tool Action Result:', result);
```

---

## ⚙️ Configuration Reference

JevBrow automatically loads `.env` files in Node.js 20+.

```typescript
const browser = new JevBrow({
  // Jev AI (TypeSafe System One)
  jev: {
    apiKey: process.env.JEV_API_KEY || process.env.TYPESAFE_API_KEY,
    model: 'jev-latest', // Default: 'jev-latest'
  },

  // OpenAI-Compatible LLM (Optional fallback)
  llm: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini', // Default: 'gpt-4o-mini' or 'gpt-5-nano'
    baseUrl: 'https://openrouter.ai/api/v1', // Any custom endpoint
    useHttp: true, // Force native fetch, zero OpenAI SDK required
    isVisionCapable: true, // Enable if using multimodal vision models
  },

  // Browser Engine & Optimization
  browser: {
    headless: true,
    lightweight: true, // Blocks images, fonts, media, and trackers
    browserType: 'chromium', // 'chromium' | 'firefox' | 'webkit'
    channel: 'msedge', // 'msedge' | 'chrome' (uses system browser)
    autoInstall: true, // Auto-downloads Playwright binary if missing
  },

  // Telemetry & Logs
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error' | 'silent'
  showSteps: true, // Colorized step terminal output
  onStep: (step) => {
    console.log(`[${step.type}] ${step.message} (${step.durationMs}ms)`);
  },

  // Human-in-the-loop / 2FA Hook
  onPrompt: async (request) => {
    // Called when automation encounters an interactive 2FA/OTP prompt
    return promptUserForOtp(request.message);
  },
});
```

---

### Custom LLM Providers (Ollama, DeepSeek, Groq, OpenRouter)

JevBrow works seamlessly with any OpenAI-compatible provider:

```typescript
// 🦙 Ollama (Local LLM)
const browser = new JevBrow({
  llm: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2-vision',
  },
});

// ⚡ Groq (Ultra-fast inference)
const browser = new JevBrow({
  llm: {
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
});

// 🐋 DeepSeek
const browser = new JevBrow({
  llm: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
});
```

---

## 🧑‍💻 Human-in-the-Loop & Interactive 2FA / OTP

Automation shouldn't pretend to magically bypass enterprise security or multi-factor authentication. When an automated workflow encounters a 2FA prompt, OTP field, or manual confirmation dialog, JevBrow's `onPrompt` hook pauses automation and requests input from the user or developer:

```typescript
const browser = new JevBrow({
  // Intercept interactive 2FA/OTP or confirmation requests
  onPrompt: async (request) => {
    console.log(`\n🔔 Human intervention needed: ${request.message}`);
    // Read from CLI terminal, SMS gateway, or webhook
    return await readUserInputFromCli(request.message);
  },
});
```

---

## 📖 API Summary

### `JevBrow`
- `static open(url?, config?): Promise<{ browser: JevBrow; page: JevPage }>` — Launch and navigate in one line.
- `launch(): Promise<void>` — Initialize browser engine.
- `newPage(): Promise<JevPage>` — Create a new AI-enhanced page.
- `close(): Promise<void>` — Terminate browser and clean up resources.

### `JevPage`
- `aiNavigate(url: string)` — Navigate to URL and ensure page is ready.
- `aiClick(description: string)` — Click an element using natural language intent.
- `aiType(description: string, text: string)` — Type into matching field.
- `aiLogin(credentials: { username?, password, submitText? })` — One-liner login helper.
- `aiAssert(assertion: string, options?: AiAssertOptions)` — Resilient semantic assertion; throws `AssertionError` if condition fails.
- `aiAutoFillForm(profile, options?: AutoFillOptions)` — Single-batch automatic form field mapping & population.
- `aiSeekGoal(options: SeekGoalOptions | string)` — Multi-step autonomous goal-seeking navigation crawler.
- `aiWaitFor(condition: string, options?)` — Polls with Jev AI until condition is met.
- `aiAsk(question: string)` — Query page state with calibrated probability ($0.0 - 1.0$).
- `aiSummarize(prompt?: string)` — Intelligent markdown summary of page content via LLM.
- `aiExtract<T>(prompt: string)` — Structured JSON data extraction.
- `aiFindElement(description: string)` — Retrieve element selector and bounding box `{ x, y, width, height, centerX, centerY }`.
- `aiScreenshot(options?: { fullPage?, base64?, path? })` — Capture screenshot.
- `getToolDefinitions()` — Standard function-calling tool specifications.
- `executeAction(action, params)` — Dynamic tool execution handler.
- `page: Page` — Direct access to the raw Playwright Page instance.

### `AssertionError`
- Error thrown by `page.aiAssert(...)` with `{ assertion, probability, threshold, url }`.

---

## 📄 License

MIT © [SuparvaCode](https://github.com/SuparvaCode)
