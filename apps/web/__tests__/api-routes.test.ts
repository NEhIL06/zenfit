import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// Next.js server mock — allows importing route handlers in Node/Vitest context
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => {
        type CookieOptions = Record<string, unknown>
        const cookiesMap = new Map<string, { value: string; options: CookieOptions }>()
        return {
          status: init?.status ?? 200,
          json: async () => body,
          body,
          cookies: {
            set: (name: string, value: string, options: CookieOptions) => cookiesMap.set(name, { value, options }),
            get: (name: string) => cookiesMap.get(name),
          },
        }
      },
    },
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Shared mocks for all integration tests
// ─────────────────────────────────────────────────────────────────────────────

const mockFindOne = vi.fn()
const mockInsertOne = vi.fn()
const mockUpdateOne = vi.fn()
const mockFindOneAndUpdate = vi.fn()

vi.mock('@/lib/mongodb', () => ({
  connectToDatabase: vi.fn().mockResolvedValue({
    db: {
      collection: vi.fn().mockReturnValue({
        findOne: mockFindOne,
        insertOne: mockInsertOne,
        updateOne: mockUpdateOne,
        findOneAndUpdate: mockFindOneAndUpdate,
      }),
    },
  }),
}))

vi.mock('@/lib/mistral', () => ({
  getMistralClient: vi.fn().mockReturnValue({
    chat: {
      complete: vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              workout_plan: [{ day: 'Day 1', focus: 'Upper Body', exercises: [{ name: 'Bench Press', sets: 3, reps: '10' }] }],
              diet_plan: [{ meal: 'Breakfast', name: 'Oatmeal', calories: 500 }],
              recommendations: ['Hydrate daily'],
            })
          }
        }],
      }),
    },
  }),
}))

vi.mock('@/lib/auth', () => ({
  signJwtToken: vi.fn().mockResolvedValue('mock.jwt.token'),
  verifyJwtToken: vi.fn().mockResolvedValue({ userId: 'aabbccddeeff112233445566', email: 'test@example.com' }),
  getAuthUserFromRequest: vi.fn().mockResolvedValue({ userId: 'aabbccddeeff112233445566', email: 'test@example.com' }),
  AUTH_COOKIE_NAME: 'zenfit_auth_token',
}))

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 19 }),
}))

vi.mock('@/lib/cache', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  clearPattern: vi.fn().mockResolvedValue(0),
  CacheKeys: {
    userRagPattern: (id: string) => `rag:user:${id}:*`,
    ragResponse: (userId: string, q: string) => `rag:user:${userId}:${q}`,
    generalChat: (msg: string) => `chat:general:${msg}`,
    exerciseImage: (name: string) => `global:img:exercise:${name}`,
    mealImage: (name: string) => `global:img:meal:${name}`,
    webSearch: (q: string) => `web:search:${q}`,
  },
  TTL: { IMAGE: 2592000, RAG: 3600, GENERAL_CHAT: 3600, WEB_SEARCH: 21600 },
  normalizeKey: (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ''),
  hashKey: (...parts: string[]) => parts.join('-'),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

// Mock the Self-RAG pipeline so chat tests don't hit real AI
vi.mock('@/lib/ai-trainer/self-rag', () => ({
  runSelfRAG: vi.fn().mockResolvedValue({
    generation: 'Here is your personalized fitness advice.',
    sources: [{ content: 'Exercise is important', source: 'wikipedia' }],
    images: [],
    conversationId: 'conv_mock123',
  }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /api/generate-plan
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/generate-plan — Integration', () => {
  it('validates request body with Zod and returns plan', async () => {
    mockUpdateOne.mockResolvedValueOnce({ upsertedId: 'mock-plan-id' })

    const { POST } = await import('../app/api/generate-plan/route')

    const body = {
      age: '25', gender: 'Male', weight: '75', height: '180',
      fitnessGoal: 'Muscle Gain', experienceLevel: 'Intermediate', workoutLocation: 'Gym',
      userId: 'attacker-controlled-user',
    }

    const req = new Request('http://localhost/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'mock-user-id' },
      body: JSON.stringify(body),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toBeDefined()
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { userId: 'aabbccddeeff112233445566' },
      expect.any(Object),
      { upsert: true }
    )
  })

  it('returns 400 if required fields are missing', async () => {
    const { POST } = await import('../app/api/generate-plan/route')

    const req = new Request('http://localhost/api/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'mock-user-id' },
      body: JSON.stringify({ age: '25' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/generate-quote
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/generate-quote — Integration', () => {
  it('returns a quote string', async () => {
    const { GET } = await import('../app/api/generate-quote/route')
    const req = new Request('http://localhost/api/generate-quote')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.quote).toBeDefined()
    expect(typeof data.quote).toBe('string')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/generate-image
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/generate-image — Integration', () => {
  it('returns imageData and provider for a valid exercise request', async () => {
    const { POST } = await import('../app/api/generate-image/route')

    const req = new Request('http://localhost/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'mock-user-id' },
      body: JSON.stringify({ name: 'Barbell Squat', type: 'exercise' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.imageData).toBeDefined()
    expect(typeof data.imageData).toBe('string')
    expect(data.imageData.length).toBeGreaterThan(0)
  })

  it('returns imageData and provider for a valid meal request', async () => {
    const { POST } = await import('../app/api/generate-image/route')

    const req = new Request('http://localhost/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'mock-user-id' },
      body: JSON.stringify({ name: 'Oatmeal with berries', type: 'meal' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.imageData).toBeDefined()
    expect(data.provider).toBeDefined()
  })

  it('returns 400 if `type` field is missing', async () => {
    const { POST } = await import('../app/api/generate-image/route')

    const req = new Request('http://localhost/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'mock-user-id' },
      body: JSON.stringify({ name: 'Squat' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 if `type` is an invalid enum value', async () => {
    const { POST } = await import('../app/api/generate-image/route')

    const req = new Request('http://localhost/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'mock-user-id' },
      body: JSON.stringify({ name: 'Squat', type: 'video' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/users — Signup
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/users — Signup Integration', () => {
  beforeEach(() => {
    // Default: email not yet taken
    mockFindOne.mockResolvedValue(null)
    mockInsertOne.mockResolvedValue({ insertedId: { toString: () => 'aabbccddeeff112233445566' } })
  })

  it('creates user and returns 201 with userId', async () => {
    const { POST } = await import('../app/api/users/route')

    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formData: {
          fullName: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          age: '25',
          fitnessGoal: 'Weight Loss',
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.userId).toBeDefined()
    expect(data.message).toBe('User created successfully')
  })

  it('returns 409 Conflict when email already exists', async () => {
    mockFindOne.mockResolvedValueOnce({ _id: 'existing-id', formData: { email: 'taken@example.com' } })
    const { POST } = await import('../app/api/users/route')

    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formData: { fullName: 'Jane', email: 'taken@example.com', password: 'password123' },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/already exists/i)
  })

  it('returns 400 for invalid email format', async () => {
    const { POST } = await import('../app/api/users/route')

    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formData: { fullName: 'Test User', email: 'not-valid-email', password: 'password123' },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is shorter than 6 characters', async () => {
    const { POST } = await import('../app/api/users/route')

    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formData: { fullName: 'Test User', email: 'test@example.com', password: 'abc' },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/users/[id] — User profile by ObjectId
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/users/[id] — Profile Fetch Integration', () => {
  it('returns 200 with user profile and no password field', async () => {
    mockFindOne.mockResolvedValueOnce({
      _id: { toString: () => 'aabbccddeeff112233445566' },
      formData: {
        fullName: 'Test User',
        email: 'test@example.com',
        password: '$2a$12$hashed_password_should_not_appear',
        fitnessGoal: 'Weight Loss',
      },
      createdAt: new Date(),
    })

    const { GET } = await import('../app/api/users/[id]/route')

    const req = new Request('http://localhost/api/users/aabbccddeeff112233445566', {
      headers: { 'x-user-id': 'aabbccddeeff112233445566' },
    })

    const res = await GET(req, { params: Promise.resolve({ id: 'aabbccddeeff112233445566' }) })
    expect(res.status).toBe(200)

    const data = await res.json()
    // Verify the response does NOT include a password field at any level
    expect(data.password).toBeUndefined()
    expect(data.formData?.password).toBeUndefined()
    expect(data.formData?.email).toBe('test@example.com')
  })

  it('returns 400 for a malformed (non-ObjectId) ID', async () => {
    const { GET } = await import('../app/api/users/[id]/route')

    const req = new Request('http://localhost/api/users/not-a-valid-id', {
      headers: { 'x-user-id': 'aabbccddeeff112233445566' },
    })

    const res = await GET(req, { params: Promise.resolve({ id: 'not-a-valid-id' }) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/invalid user id/i)
  })

  it('returns 404 when user does not exist', async () => {
    mockFindOne.mockResolvedValueOnce(null)

    const { GET } = await import('../app/api/users/[id]/route')

    const req = new Request('http://localhost/api/users/aabbccddeeff112233445566', {
      headers: { 'x-user-id': 'aabbccddeeff112233445566' },
    })

    const res = await GET(req, { params: Promise.resolve({ id: 'aabbccddeeff112233445566' }) })
    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUT /api/users/[id] — Profile Update
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /api/users/[id] — Profile Update Integration', () => {
  it('returns 200 with updated profile when userId matches JWT', async () => {
    const updatedDoc = {
      _id: { toString: () => 'aabbccddeeff112233445566' },
      formData: { fullName: 'Updated User', email: 'test@example.com', fitnessGoal: 'Muscle Gain' },
    }
    mockFindOneAndUpdate.mockResolvedValueOnce(updatedDoc)

    const { PUT } = await import('../app/api/users/[id]/route')

    const req = new Request('http://localhost/api/users/aabbccddeeff112233445566', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'aabbccddeeff112233445566',
      },
      body: JSON.stringify({ formData: { fitnessGoal: 'Muscle Gain' } }),
    })

    const res = await PUT(req, { params: Promise.resolve({ id: 'aabbccddeeff112233445566' }) })
    expect(res.status).toBe(200)
  })

  it('returns 403 Forbidden when authenticated userId does not match the target ID', async () => {
    const { getAuthUserFromRequest } = await import('@/lib/auth')
    vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
      userId: 'different-user-000000000000',
      email: 'other@example.com',
    })

    const { PUT } = await import('../app/api/users/[id]/route')

    const req = new Request('http://localhost/api/users/aabbccddeeff112233445566', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'different-user-000000000000' },
      body: JSON.stringify({ formData: { fitnessGoal: 'Hacking another profile' } }),
    })

    const res = await PUT(req, { params: Promise.resolve({ id: 'aabbccddeeff112233445566' }) })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toMatch(/forbidden/i)
  })

  it('returns 400 for a malformed ObjectId on PUT', async () => {
    const { PUT } = await import('../app/api/users/[id]/route')

    const req = new Request('http://localhost/api/users/bad-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'aabbccddeeff112233445566' },
      body: JSON.stringify({ formData: { fitnessGoal: 'Muscle Gain' } }),
    })

    const res = await PUT(req, { params: Promise.resolve({ id: 'bad-id' }) })
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/ai-trainer/chat — Classifier Fast Paths + RAG Integration
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/ai-trainer/chat — Classification & RAG Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-apply default mocks between tests so per-test overrides don't bleed through
    mockFindOne.mockResolvedValue(null)
    mockInsertOne.mockResolvedValue({ insertedId: { toString: () => 'aabbccddeeff112233445566' } })
  })

  it('routes greeting queries to general path (zero-cost, no RAG invoked)', async () => {
    const { POST } = await import('../app/api/ai-trainer/chat/route')
    const { runSelfRAG } = await import('@/lib/ai-trainer/self-rag')

    const req = new NextRequest('http://localhost/api/ai-trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'aabbccddeeff112233445566' },
      body: JSON.stringify({ message: 'hi', userId: 'aabbccddeeff112233445566' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.response).toBeDefined()
    // Self-RAG must NOT be called for a greeting
    expect(runSelfRAG).not.toHaveBeenCalled()
    expect(data.classification).toBe('general')
  })

  it('routes fitness keyword queries to Self-RAG pipeline', async () => {
    const { POST } = await import('../app/api/ai-trainer/chat/route')
    const { runSelfRAG } = await import('@/lib/ai-trainer/self-rag')

    const req = new NextRequest('http://localhost/api/ai-trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'aabbccddeeff112233445566' },
      body: JSON.stringify({ message: 'how do I improve my squat?', userId: 'aabbccddeeff112233445566' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.response).toBeDefined()
    // Self-RAG MUST be called for a fitness query
    expect(runSelfRAG).toHaveBeenCalled()
    expect(data.classification).toBe('fitness')
  })

  it('returns 401 if userId is missing from request and headers', async () => {
    const { getAuthUserFromRequest } = await import('@/lib/auth')
    vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce(null)

    const { POST } = await import('../app/api/ai-trainer/chat/route')

    const req = new NextRequest('http://localhost/api/ai-trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No userId in body, no x-user-id header, no JWT
      body: JSON.stringify({ message: 'how do I squat?' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('ignores a spoofed body userId and uses the authenticated user for RAG', async () => {
    const { POST } = await import('../app/api/ai-trainer/chat/route')
    const { runSelfRAG } = await import('@/lib/ai-trainer/self-rag')

    const req = new NextRequest('http://localhost/api/ai-trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'how do I improve my deadlift?',
        userId: 'attacker-controlled-user',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(runSelfRAG).toHaveBeenCalledWith(
      'how do I improve my deadlift?',
      'aabbccddeeff112233445566',
      undefined,
      undefined
    )
  })

  it('returns 429 when rate limit is exceeded', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limiter')
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false, remaining: 0 })

    const { POST } = await import('../app/api/ai-trainer/chat/route')

    const req = new NextRequest('http://localhost/api/ai-trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'aabbccddeeff112233445566' },
      body: JSON.stringify({ message: 'how do I squat?', userId: 'aabbccddeeff112233445566' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it('returns 400 when message is an empty string', async () => {
    const { POST } = await import('../app/api/ai-trainer/chat/route')

    const req = new NextRequest('http://localhost/api/ai-trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'aabbccddeeff112233445566' },
      body: JSON.stringify({ message: '', userId: 'aabbccddeeff112233445566' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns sources in response from Self-RAG fitness query', async () => {
    const { POST } = await import('../app/api/ai-trainer/chat/route')

    const req = new NextRequest('http://localhost/api/ai-trainer/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'aabbccddeeff112233445566' },
      body: JSON.stringify({ message: 'best exercises for cardio training', userId: 'aabbccddeeff112233445566' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.sources)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. Security Regression Tests — Critical Vulnerability Fixes
//    These tests MUST stay green. They are regression guards for the 4 critical
//    security vulnerabilities found and fixed during the production audit.
// ─────────────────────────────────────────────────────────────────────────────
describe('Security Regressions — Authentication Boundaries', () => {
  // CRITICAL-01: Login response must never include the JWT in the JSON body.
  // The token is set as an httpOnly cookie and must NOT be JavaScript-accessible.
  it('POST /api/auth/login — response body does NOT contain a token field', async () => {
    const { default: bcrypt } = await import('bcryptjs')
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never)
    mockFindOne.mockResolvedValueOnce({
      _id: { toString: () => 'aabbccddeeff112233445566' },
      formData: {
        email: 'test@example.com',
        password: '$2a$12$hashed',
        fullName: 'Test User',
      },
    })

    const { POST } = await import('../app/api/auth/login/route')
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    // The JWT must NEVER appear in the JSON body — it belongs in httpOnly cookie only
    expect(data.token).toBeUndefined()
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('test@example.com')
  })

  // CRITICAL-03: GET /api/users/[id] must reject unauthenticated requests.
  it('GET /api/users/[id] — returns 401 for unauthenticated requests', async () => {
    const { getAuthUserFromRequest } = await import('@/lib/auth')
    vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce(null)

    const { GET } = await import('../app/api/users/[id]/route')
    const req = new Request('http://localhost/api/users/aabbccddeeff112233445566')

    const res = await GET(req, { params: Promise.resolve({ id: 'aabbccddeeff112233445566' }) })
    expect(res.status).toBe(401)
  })

  // CRITICAL-03: GET /api/users/[id] must return 403 when accessing another user's profile.
  it('GET /api/users/[id] — returns 403 when accessing a different user\'s profile', async () => {
    const { getAuthUserFromRequest } = await import('@/lib/auth')
    vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce({
      userId: 'different-user-000000000000',
      email: 'other@example.com',
    })

    const { GET } = await import('../app/api/users/[id]/route')
    const req = new Request('http://localhost/api/users/aabbccddeeff112233445566', {
      headers: { 'x-user-id': 'different-user-000000000000' },
    })

    const res = await GET(req, { params: Promise.resolve({ id: 'aabbccddeeff112233445566' }) })
    expect(res.status).toBe(403)
  })

  // CRITICAL-04: PUT /api/users/[id] must reject unauthenticated requests.
  // The old `authUser &&` bug allowed unauthenticated updates to proceed.
  it('PUT /api/users/[id] — returns 401 for unauthenticated requests (CRITICAL-04 regression)', async () => {
    const { getAuthUserFromRequest } = await import('@/lib/auth')
    vi.mocked(getAuthUserFromRequest).mockResolvedValueOnce(null)

    const { PUT } = await import('../app/api/users/[id]/route')
    const req = new Request('http://localhost/api/users/aabbccddeeff112233445566', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData: { fitnessGoal: 'Muscle Gain' } }),
    })

    const res = await PUT(req, { params: Promise.resolve({ id: 'aabbccddeeff112233445566' }) })
    // Must be 401, NOT 200 — this is the regression test for the CRITICAL-04 bug
    expect(res.status).toBe(401)
  })

  // HIGH-05: PUT /api/users/[id] must reject unknown or dangerous fields.
  it('PUT /api/users/[id] — returns 400 when unknown field is sent (schema strict mode)', async () => {
    const { PUT } = await import('../app/api/users/[id]/route')
    const req = new Request('http://localhost/api/users/aabbccddeeff112233445566', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'aabbccddeeff112233445566' },
      body: JSON.stringify({ formData: { password: 'newplaintextpassword' } }),
    })

    const res = await PUT(req, { params: Promise.resolve({ id: 'aabbccddeeff112233445566' }) })
    expect(res.status).toBe(400)
  })
})
