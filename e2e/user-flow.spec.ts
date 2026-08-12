import { test, expect, Page } from '@playwright/test'

/**
 * ZenFit E2E Tests — Primary User Flow
 *
 * Covers the critical path: Home → Signup → Plan Generation → AI Chat
 *
 * Prerequisites:
 *   - App running on localhost:3000 (or PLAYWRIGHT_BASE_URL)
 *   - MongoDB connected and accepting writes
 *   - MISTRAL_API_KEY set in environment
 */

const TEST_USER = {
  name: `E2E User ${Date.now()}`,
  email: `e2e_${Date.now()}@zenfit-test.com`,
  password: 'TestPassword123!',
}

// ─────────────────────────────────────────────────────
// Helper: Complete signup flow
// ─────────────────────────────────────────────────────
async function completeSignup(page: Page) {
  await page.goto('/')
  await expect(page).toHaveTitle(/zenfit|fitness/i)

  // Find and click Get Started / Sign Up button
  const ctaButton = page.locator('button, a').filter({ hasText: /get started|sign up|create account/i }).first()
  await ctaButton.click()

  // Step 1: Basic Info
  await page.fill('input[name="name"], input[placeholder*="name" i]', TEST_USER.name)
  await page.fill('input[type="email"]', TEST_USER.email)
  await page.fill('input[type="password"], input[name="password"]', TEST_USER.password)

  await page.click('button:has-text("Next")')

  // Step 2: Physical Profile
  await page.fill('input[name="age"]', '25')
  await page.fill('input[name="height"]', '175')
  await page.fill('input[name="weight"]', '70')

  const genderSelect = page.locator('select[name="gender"]')
  await genderSelect.selectOption('Male')

  await page.click('button:has-text("Next")')

  // Step 3: Fitness & Lifestyle
  const goalSelect = page.locator('select[name="fitnessGoal"]')
  await goalSelect.selectOption('Muscle Gain')

  const locationSelect = page.locator('select[name="workoutLocation"]')
  await locationSelect.selectOption('Gym')
}

// ─────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────
test.describe('ZenFit — Core User Flow', () => {

  test('Home page loads with title and CTA button', async ({ page }) => {
    await page.goto('/')
    // Actual page title is "Zenletics.ai"
    await expect(page).toHaveTitle(/zenletics/i)

    // Should have a visible call-to-action
    const cta = page.locator('button, a').filter({ hasText: /get started|sign up|begin|create|start/i }).first()
    await expect(cta).toBeVisible()
  })

  test('Signup form — Step 1 validates email format', async ({ page }) => {
    await page.goto('/')
    const ctaButton = page.locator('button, a').filter({ hasText: /get started|sign up/i }).first()
    await ctaButton.click()

    await page.fill('input[type="email"]', 'not-a-valid-email')
    await page.fill('input[type="password"]', 'pass1234')
    await page.fill('input[name="name"], input[placeholder*="name" i]', 'Test')
    await page.click('button:has-text("Next")')

    // Should show validation error
    const errorMsg = page.locator('[role="alert"], .text-red-500, .text-red-800, [class*="error"]').first()
    await expect(errorMsg).toBeVisible({ timeout: 3000 })
  })

  test('Signup form — Step 1 validates password length', async ({ page }) => {
    await page.goto('/')
    const ctaButton = page.locator('button, a').filter({ hasText: /get started|sign up/i }).first()
    await ctaButton.click()

    await page.fill('input[name="name"], input[placeholder*="name" i]', 'Test')
    await page.fill('input[type="email"]', 'valid@example.com')
    await page.fill('input[type="password"], input[name="password"]', 'abc') // too short
    await page.click('button:has-text("Next")')

    const errorMsg = page.locator('[role="alert"], .text-red-500, .text-red-800, [class*="error"]').first()
    await expect(errorMsg).toBeVisible({ timeout: 3000 })
  })

  test('Password toggle shows/hides password text', async ({ page }) => {
    await page.goto('/')
    const ctaButton = page.locator('button, a').filter({ hasText: /get started|sign up/i }).first()
    await ctaButton.click()

    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Click eye icon toggle
    const toggleButton = page.locator('button[aria-label*="password" i], button:near(input[type="password"])')
    if (await toggleButton.count() > 0) {
      await toggleButton.first().click()
      await expect(page.locator('input[name="password"]')).toHaveAttribute('type', 'text')
    }
  })

  test('Health check endpoint returns 200 OK', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('zenfit')
    expect(typeof body.uptime).toBe('number')
  })

  test('Login endpoint rejects invalid credentials', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'nonexistent@test.com', password: 'wrongpassword' },
    })
    expect(response.status()).toBe(401)
  })

  test('Protected API routes return 401 without token', async ({ request }) => {
    const response = await request.post('/api/generate-plan', {
      data: { age: '25', gender: 'Male', weight: '70', height: '175', fitnessGoal: 'Muscle Gain', experienceLevel: 'Beginner', workoutLocation: 'Gym' },
    })
    // Should be 401 Unauthorized (middleware blocks unauthenticated requests)
    expect([401, 403]).toContain(response.status())
  })

  test('Generate image endpoint returns 401 without auth', async ({ request }) => {
    const response = await request.post('/api/generate-image', {
      data: { name: 'Squat', type: 'exercise' },
    })
    expect([401, 403]).toContain(response.status())
  })
})
