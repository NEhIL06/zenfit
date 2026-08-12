# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-flow.spec.ts >> ZenFit — Core User Flow >> Password toggle shows/hides password text
- Location: e2e\user-flow.spec.ts:100:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button, a').filter({ hasText: /get started|sign up/i }).first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation [ref=e3]:
      - generic [ref=e5]:
        - link "ZENLETICS" [ref=e6] [cursor=pointer]:
          - /url: /
        - generic [ref=e15]:
          - generic [ref=e16]: AI Agent Platform
          - button "Toggle theme" [ref=e20]
          - link "Sign In" [ref=e27] [cursor=pointer]:
            - /url: /login
          - link [ref=e28] [cursor=pointer]:
            - /url: /signup
            - button "Start Free Trial" [ref=e29]
    - generic [ref=e33]:
      - generic [ref=e34]:
        - generic [ref=e35]: Moments on Film • AI Fitness Showcase
        - generic [ref=e40]: 6 Live Streams Active
      - generic [ref=e41]:
        - generic [ref=e42] [cursor=pointer]:
          - img "Strength & Form Analytics" [ref=e43]
          - generic [ref=e45]: AI Pose & Form Check
          - generic [ref=e47]:
            - heading "Strength & Form Analytics" [level=4] [ref=e48]
            - paragraph [ref=e49]: Zenletics Interactive Snapshot
        - generic [ref=e54] [cursor=pointer]:
          - img "Tailored Macro Nutrition" [ref=e55]
          - generic [ref=e57]: RAG Diet Synthesis
          - generic [ref=e59]:
            - heading "Tailored Macro Nutrition" [level=4] [ref=e60]
            - paragraph [ref=e61]: Zenletics Interactive Snapshot
        - generic [ref=e66] [cursor=pointer]:
          - img "Hypertrophy Workouts" [ref=e67]
          - generic [ref=e69]: Custom Plan Engine
          - generic [ref=e71]:
            - heading "Hypertrophy Workouts" [level=4] [ref=e72]
            - paragraph [ref=e73]: Zenletics Interactive Snapshot
        - generic [ref=e78] [cursor=pointer]:
          - img "Endurance & Cardio Track" [ref=e79]
          - generic [ref=e81]: Progress Feed
          - generic [ref=e83]:
            - heading "Endurance & Cardio Track" [level=4] [ref=e84]
            - paragraph [ref=e85]: Zenletics Interactive Snapshot
        - generic [ref=e90] [cursor=pointer]:
          - img "Calisthenics & Agility" [ref=e91]
          - generic [ref=e93]: Bodyweight Routine
          - generic [ref=e95]:
            - heading "Calisthenics & Agility" [level=4] [ref=e96]
            - paragraph [ref=e97]: Zenletics Interactive Snapshot
        - generic [ref=e102] [cursor=pointer]:
          - img "Realtime Voice Coach" [ref=e103]
          - generic [ref=e105]: Multimodal AI
          - generic [ref=e107]:
            - heading "Realtime Voice Coach" [level=4] [ref=e108]
            - paragraph [ref=e109]: Zenletics Interactive Snapshot
    - generic [ref=e115]:
      - generic [ref=e116]: AI Fitness Architecture • Self-RAG Powered
      - heading "Your Fitness Journey Driven By Intelligent RAG" [level=1] [ref=e120]: Your Fitness JourneyDriven By Intelligent RAG
      - paragraph [ref=e121]: Precision workout programs, customized macro nutrition, and real-time multimodal AI guidance backed by vector similarity search.
      - generic [ref=e122]:
        - generic [ref=e123]: Daily AI Motivation
        - paragraph [ref=e126]: “Your fitness journey starts today.”
      - generic [ref=e127]:
        - link [ref=e128] [cursor=pointer]:
          - /url: /signup
          - button "Start Free Trial" [ref=e129]
        - link [ref=e132] [cursor=pointer]:
          - /url: /login
          - button "Sign In to Dashboard" [ref=e133]
    - generic [ref=e135]:
      - generic [ref=e136]:
        - generic [ref=e137]: AI Engine Operational • 24/7 Sync
        - generic [ref=e140]:
          - heading "Zenletics Live Agent Node" [level=3] [ref=e141]
          - paragraph [ref=e142]: Real-time Self-RAG retrieval active. Local system synchronized with vector stores and secure cookie authentication.
        - generic [ref=e143]:
          - generic [ref=e144]: LangGraph RAG
          - generic [ref=e147]: httpOnly JWT
          - generic [ref=e151]: Chroma Vector DB
      - generic [ref=e169]:
        - paragraph [ref=e170]: 07:16:32 PM
        - paragraph [ref=e171]: System Server Time (UTC/Local)
    - generic [ref=e172]:
      - paragraph [ref=e174]: ENGINEERING LABELS & ARCHITECTURAL STICKERS
      - generic [ref=e175]:
        - generic [ref=e176]: ⚠️ SELF-RAG ACTIVE
        - generic [ref=e177]: Dev Mode ⚡
        - generic [ref=e178]: 🔒 httpOnly JWT Cookies
        - generic [ref=e179]: "# Cohere Reranker"
        - generic [ref=e180]: ✨ Chroma Vector DB
        - generic [ref=e181]: THINK OUTSIDE THE BOX
        - generic [ref=e182]: Zero-Cost Router 🎯
        - generic [ref=e183]: 70/70 Vitest Passed ✅
    - generic [ref=e184]:
      - generic [ref=e185]:
        - generic [ref=e186]: Capabilities
        - heading "Why Train With Zenletics?" [level=2] [ref=e190]
        - paragraph [ref=e191]: Combining machine learning retrieval pipelines with human-centric physical coaching.
      - generic [ref=e192]:
        - generic [ref=e193]:
          - heading "Self-RAG Workouts" [level=3] [ref=e201]
          - paragraph [ref=e202]: LangGraph-orchestrated fitness plans tailored to your biometric metrics and goals.
        - generic [ref=e203]:
          - heading "Targeted Macros & Diet" [level=3] [ref=e207]
          - paragraph [ref=e208]: Custom nutrition routines generated dynamically based on dietary preferences.
        - generic [ref=e209]:
          - heading "Milestone Tracking" [level=3] [ref=e214]
          - paragraph [ref=e215]: Log progress, compute BMI/BMR metrics, and track transformation over time.
        - generic [ref=e216]:
          - heading "Multimodal AI Coach" [level=3] [ref=e223]
          - paragraph [ref=e224]: Voice-guided audio advice, image pose checks, and deterministic Redis caching.
    - generic [ref=e225]:
      - generic [ref=e226]:
        - generic [ref=e227]: Technical Blueprint
        - heading "Verified RAG Engine Specs" [level=2] [ref=e232]
        - paragraph [ref=e233]: Engineered with strict non-diplomatic benchmarks and modular multi-provider fallbacks.
      - generic [ref=e234]:
        - generic [ref=e235]:
          - text: Vector Search
          - heading "ChromaDB Vector Store" [level=4] [ref=e236]
          - paragraph [ref=e237]: Dense semantic retrieval with bge-base-en-v1.5 embeddings for exercise science papers.
        - generic [ref=e238]:
          - text: Precision Rank
          - heading "Cohere Reranking" [level=4] [ref=e239]
          - paragraph [ref=e240]: Cross-encoder scoring ensures only top relevant passages feed into the LLM context window.
        - generic [ref=e241]:
          - text: Latency Saver
          - heading "Zero-Cost Intent Router" [level=4] [ref=e242]
          - paragraph [ref=e243]: Instant regex filter bypasses expensive LLM calls for general greetings and simple queries.
        - generic [ref=e244]:
          - text: Production Auth
          - heading "httpOnly JWT Security" [level=4] [ref=e245]
          - paragraph [ref=e246]: Bcrypt hashed credentials and encrypted HTTP cookies eliminate vulnerable localStorage sessions.
    - generic [ref=e247]:
      - heading "Ready to Start Your AI Transformation?" [level=2] [ref=e248]
      - paragraph [ref=e249]: Generate your personalized workout split and meal targets in under 15 seconds.
      - link [ref=e250] [cursor=pointer]:
        - /url: /signup
        - button "Create Your Plan Now" [ref=e251]
    - contentinfo [ref=e254]:
      - generic [ref=e255]:
        - generic [ref=e256]:
          - generic [ref=e257]:
            - link "ZENLETICS" [ref=e258] [cursor=pointer]:
              - /url: /
            - paragraph [ref=e267]: Next-generation AI fitness coach powered by LangGraph Self-RAG pipelines, ChromaDB vector databases, and secure JWT authentication.
          - generic [ref=e268]:
            - heading "Platform Features" [level=4] [ref=e269]
            - list [ref=e270]:
              - listitem [ref=e271]:
                - link "Self-RAG Workouts" [ref=e272] [cursor=pointer]:
                  - /url: /#features
              - listitem [ref=e273]:
                - link "Vector Retrieval Architecture" [ref=e274] [cursor=pointer]:
                  - /url: /#architecture
              - listitem [ref=e275]:
                - link "AI Trainer Chat Window" [ref=e276] [cursor=pointer]:
                  - /url: /dashboard
              - listitem [ref=e277]:
                - link "Custom Macro & Meal Plans" [ref=e278] [cursor=pointer]:
                  - /url: /dashboard
          - generic [ref=e279]:
            - heading "Account & Portal" [level=4] [ref=e280]
            - list [ref=e281]:
              - listitem [ref=e282]:
                - link "Sign In to Dashboard" [ref=e283] [cursor=pointer]:
                  - /url: /login
              - listitem [ref=e284]:
                - link "Create New Profile" [ref=e285] [cursor=pointer]:
                  - /url: /signup
              - listitem [ref=e286]:
                - link "Member Dashboard" [ref=e287] [cursor=pointer]:
                  - /url: /dashboard
          - generic [ref=e288]:
            - heading "Staff Engineer Portfolio" [level=4] [ref=e289]
            - generic [ref=e290]:
              - link "Contact Developer" [ref=e291] [cursor=pointer]:
                - /url: mailto:chandrakarnehil06112002@gmail.com
              - link "Live Resume & Portfolio" [ref=e299] [cursor=pointer]:
                - /url: https://nehil.vercel.app/resume
        - generic [ref=e307]:
          - generic [ref=e308]:
            - link "Zenletics V1.1" [ref=e309] [cursor=pointer]:
              - /url: /
            - generic [ref=e310]: •
            - link "Features" [ref=e311] [cursor=pointer]:
              - /url: /#features
            - generic [ref=e312]: •
            - link "Dashboard" [ref=e313] [cursor=pointer]:
              - /url: /dashboard
          - paragraph [ref=e314]: HANDMADE WITH ❤️ BY NEHIL CHANDRAKAR
          - paragraph [ref=e315]: © 2026 Zenletics AI. All rights reserved.
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e321] [cursor=pointer]
  - alert [ref=e325]
```

# Test source

```ts
  3   | /**
  4   |  * ZenFit E2E Tests — Primary User Flow
  5   |  *
  6   |  * Covers the critical path: Home → Signup → Plan Generation → AI Chat
  7   |  *
  8   |  * Prerequisites:
  9   |  *   - App running on localhost:3000 (or PLAYWRIGHT_BASE_URL)
  10  |  *   - MongoDB connected and accepting writes
  11  |  *   - MISTRAL_API_KEY set in environment
  12  |  */
  13  | 
  14  | const TEST_USER = {
  15  |   name: `E2E User ${Date.now()}`,
  16  |   email: `e2e_${Date.now()}@zenfit-test.com`,
  17  |   password: 'TestPassword123!',
  18  | }
  19  | 
  20  | // ─────────────────────────────────────────────────────
  21  | // Helper: Complete signup flow
  22  | // ─────────────────────────────────────────────────────
  23  | async function completeSignup(page: Page) {
  24  |   await page.goto('/')
  25  |   await expect(page).toHaveTitle(/zenfit|fitness/i)
  26  | 
  27  |   // Find and click Get Started / Sign Up button
  28  |   const ctaButton = page.locator('button, a').filter({ hasText: /get started|sign up|create account/i }).first()
  29  |   await ctaButton.click()
  30  | 
  31  |   // Step 1: Basic Info
  32  |   await page.fill('input[name="name"], input[placeholder*="name" i]', TEST_USER.name)
  33  |   await page.fill('input[type="email"]', TEST_USER.email)
  34  |   await page.fill('input[type="password"], input[name="password"]', TEST_USER.password)
  35  | 
  36  |   await page.click('button:has-text("Next")')
  37  | 
  38  |   // Step 2: Physical Profile
  39  |   await page.fill('input[name="age"]', '25')
  40  |   await page.fill('input[name="height"]', '175')
  41  |   await page.fill('input[name="weight"]', '70')
  42  | 
  43  |   const genderSelect = page.locator('select[name="gender"]')
  44  |   await genderSelect.selectOption('Male')
  45  | 
  46  |   await page.click('button:has-text("Next")')
  47  | 
  48  |   // Step 3: Fitness & Lifestyle
  49  |   const goalSelect = page.locator('select[name="fitnessGoal"]')
  50  |   await goalSelect.selectOption('Muscle Gain')
  51  | 
  52  |   const locationSelect = page.locator('select[name="workoutLocation"]')
  53  |   await locationSelect.selectOption('Gym')
  54  | }
  55  | 
  56  | // ─────────────────────────────────────────────────────
  57  | // Test Suite
  58  | // ─────────────────────────────────────────────────────
  59  | test.describe('ZenFit — Core User Flow', () => {
  60  | 
  61  |   test('Home page loads with title and CTA button', async ({ page }) => {
  62  |     await page.goto('/')
  63  |     // Actual page title is "Zenletics.ai"
  64  |     await expect(page).toHaveTitle(/zenletics/i)
  65  | 
  66  |     // Should have a visible call-to-action
  67  |     const cta = page.locator('button, a').filter({ hasText: /get started|sign up|begin|create|start/i }).first()
  68  |     await expect(cta).toBeVisible()
  69  |   })
  70  | 
  71  |   test('Signup form — Step 1 validates email format', async ({ page }) => {
  72  |     await page.goto('/')
  73  |     const ctaButton = page.locator('button, a').filter({ hasText: /get started|sign up/i }).first()
  74  |     await ctaButton.click()
  75  | 
  76  |     await page.fill('input[type="email"]', 'not-a-valid-email')
  77  |     await page.fill('input[type="password"]', 'pass1234')
  78  |     await page.fill('input[name="name"], input[placeholder*="name" i]', 'Test')
  79  |     await page.click('button:has-text("Next")')
  80  | 
  81  |     // Should show validation error
  82  |     const errorMsg = page.locator('[role="alert"], .text-red-500, .text-red-800, [class*="error"]').first()
  83  |     await expect(errorMsg).toBeVisible({ timeout: 3000 })
  84  |   })
  85  | 
  86  |   test('Signup form — Step 1 validates password length', async ({ page }) => {
  87  |     await page.goto('/')
  88  |     const ctaButton = page.locator('button, a').filter({ hasText: /get started|sign up/i }).first()
  89  |     await ctaButton.click()
  90  | 
  91  |     await page.fill('input[name="name"], input[placeholder*="name" i]', 'Test')
  92  |     await page.fill('input[type="email"]', 'valid@example.com')
  93  |     await page.fill('input[type="password"], input[name="password"]', 'abc') // too short
  94  |     await page.click('button:has-text("Next")')
  95  | 
  96  |     const errorMsg = page.locator('[role="alert"], .text-red-500, .text-red-800, [class*="error"]').first()
  97  |     await expect(errorMsg).toBeVisible({ timeout: 3000 })
  98  |   })
  99  | 
  100 |   test('Password toggle shows/hides password text', async ({ page }) => {
  101 |     await page.goto('/')
  102 |     const ctaButton = page.locator('button, a').filter({ hasText: /get started|sign up/i }).first()
> 103 |     await ctaButton.click()
      |                     ^ Error: locator.click: Test timeout of 30000ms exceeded.
  104 | 
  105 |     const passwordInput = page.locator('input[type="password"]')
  106 |     await expect(passwordInput).toHaveAttribute('type', 'password')
  107 | 
  108 |     // Click eye icon toggle
  109 |     const toggleButton = page.locator('button[aria-label*="password" i], button:near(input[type="password"])')
  110 |     if (await toggleButton.count() > 0) {
  111 |       await toggleButton.first().click()
  112 |       await expect(page.locator('input[name="password"]')).toHaveAttribute('type', 'text')
  113 |     }
  114 |   })
  115 | 
  116 |   test('Health check endpoint returns 200 OK', async ({ request }) => {
  117 |     const response = await request.get('/api/health')
  118 |     expect(response.status()).toBe(200)
  119 | 
  120 |     const body = await response.json()
  121 |     expect(body.status).toBe('ok')
  122 |     expect(body.service).toBe('zenfit')
  123 |     expect(typeof body.uptime).toBe('number')
  124 |   })
  125 | 
  126 |   test('Login endpoint rejects invalid credentials', async ({ request }) => {
  127 |     const response = await request.post('/api/auth/login', {
  128 |       data: { email: 'nonexistent@test.com', password: 'wrongpassword' },
  129 |     })
  130 |     expect(response.status()).toBe(401)
  131 |   })
  132 | 
  133 |   test('Protected API routes return 401 without token', async ({ request }) => {
  134 |     const response = await request.post('/api/generate-plan', {
  135 |       data: { age: '25', gender: 'Male', weight: '70', height: '175', fitnessGoal: 'Muscle Gain', experienceLevel: 'Beginner', workoutLocation: 'Gym' },
  136 |     })
  137 |     // Should be 401 Unauthorized (middleware blocks unauthenticated requests)
  138 |     expect([401, 403]).toContain(response.status())
  139 |   })
  140 | 
  141 |   test('Generate image endpoint returns 401 without auth', async ({ request }) => {
  142 |     const response = await request.post('/api/generate-image', {
  143 |       data: { name: 'Squat', type: 'exercise' },
  144 |     })
  145 |     expect([401, 403]).toContain(response.status())
  146 |   })
  147 | })
  148 | 
```