import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeKey,
  hashKey,
  CacheKeys,
  TTL,
} from '../lib/cache'
import {
  isQuotaExceededError,
} from '../lib/error-handler'
import {
  UserSignupSchema,
  UserSignupResponseSchema,
  UserLoginSchema,
  UserLoginResponseSchema,
  GeneratePlanRequestSchema,
  GeneratePlanResponseSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  GenerateImageRequestSchema,
  GenerateImageResponseSchema,
  GenerateQuoteResponseSchema,
  GenerateVoiceRequestSchema,
  GenerateVoiceResponseSchema,
  TranscribeResponseSchema,
  validateRequest,
  validateResponse,
} from '../lib/schemas'

// ─────────────────────────────────────────────────
// Cache utility tests
// ─────────────────────────────────────────────────
describe('lib/cache — normalizeKey()', () => {
  it('lowercases the input', () => {
    expect(normalizeKey('BENCH PRESS')).toBe('benchpress')
  })

  it('strips non-alphanumeric characters', () => {
    expect(normalizeKey('Barbell Bench-Press!')).toBe('barbellbenchpress')
  })

  it('handles empty string', () => {
    expect(normalizeKey('')).toBe('')
  })

  it('strips spaces, dashes, and special chars', () => {
    expect(normalizeKey('  squat @90kg! ')).toBe('squat90kg')
  })

  it('is idempotent — calling twice gives same result', () => {
    const once = normalizeKey('Deadlift 5x5')
    const twice = normalizeKey(once)
    expect(once).toBe(twice)
  })
})

describe('lib/cache — hashKey()', () => {
  it('returns a 64-character hex SHA-256 hash', () => {
    const hash = hashKey('benchpress')
    expect(hash).toHaveLength(64)
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true)
  })

  it('is deterministic — same input always produces same hash', () => {
    const a = hashKey('bench', 'press')
    const b = hashKey('bench', 'press')
    expect(a).toBe(b)
  })

  it('normalizes before hashing — case and spaces do not matter', () => {
    const a = hashKey('Bench Press')
    const b = hashKey('bench press')
    const c = hashKey('BENCH PRESS')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('different inputs produce different hashes', () => {
    expect(hashKey('squat')).not.toBe(hashKey('deadlift'))
  })
})

describe('lib/cache — CacheKeys schema', () => {
  it('exerciseImage key has expected prefix', () => {
    const key = CacheKeys.exerciseImage('bench press')
    expect(key.startsWith('global:img:exercise:')).toBe(true)
    expect(key).toHaveLength('global:img:exercise:'.length + 64)
  })

  it('mealImage key has expected prefix', () => {
    const key = CacheKeys.mealImage('oatmeal')
    expect(key.startsWith('global:img:meal:')).toBe(true)
  })

  it('ragResponse key includes userId and hashed question', () => {
    const key = CacheKeys.ragResponse('user123', 'how to squat?')
    expect(key.startsWith('rag:user:user123:')).toBe(true)
  })

  it('generalChat key has expected prefix', () => {
    const key = CacheKeys.generalChat('hello')
    expect(key.startsWith('chat:general:')).toBe(true)
  })

  it('userRagPattern returns glob pattern', () => {
    const pattern = CacheKeys.userRagPattern('user123')
    expect(pattern).toBe('rag:user:user123:*')
  })

  it('same exercise name produces same cache key (cache hit guarantee)', () => {
    const a = CacheKeys.exerciseImage('Barbell Squat')
    const b = CacheKeys.exerciseImage('barbell squat')
    expect(a).toBe(b)
  })
})

describe('lib/cache — TTL constants', () => {
  it('IMAGE TTL is 30 days', () => {
    expect(TTL.IMAGE).toBe(60 * 60 * 24 * 30)
  })

  it('RAG TTL is 1 hour', () => {
    expect(TTL.RAG).toBe(3600)
  })

  it('GENERAL_CHAT TTL is 1 hour', () => {
    expect(TTL.GENERAL_CHAT).toBe(3600)
  })
})

// ─────────────────────────────────────────────────
// Error handler tests
// ─────────────────────────────────────────────────
describe('lib/error-handler — isQuotaExceededError()', () => {
  it('returns true for HTTP 429 status', () => {
    expect(isQuotaExceededError(429)).toBe(true)
  })

  it('returns false for HTTP 200', () => {
    expect(isQuotaExceededError(200)).toBe(false)
  })

  it('returns false for HTTP 500', () => {
    expect(isQuotaExceededError(500)).toBe(false)
  })

  it('detects "quota" keyword in error object message', () => {
    expect(isQuotaExceededError(200, { message: 'API quota exceeded' })).toBe(true)
  })

  it('detects "rate limit" keyword', () => {
    expect(isQuotaExceededError(200, { error: 'rate limit reached' })).toBe(true)
  })

  it('detects "resource_exhausted" keyword', () => {
    expect(isQuotaExceededError(200, { error: 'RESOURCE_EXHAUSTED' })).toBe(true)
  })

  it('detects "too many requests" keyword', () => {
    expect(isQuotaExceededError(200, { message: 'too many requests at this time' })).toBe(true)
  })

  it('returns false for generic errors', () => {
    expect(isQuotaExceededError(400, { error: 'Invalid request body' })).toBe(false)
  })

  it('returns false for undefined/null error', () => {
    expect(isQuotaExceededError(undefined, null)).toBe(false)
  })

  it('handles plain string error arg', () => {
    expect(isQuotaExceededError(200, 'quota exceeded for this key')).toBe(true)
  })
})

// ─────────────────────────────────────────────────
// Zod Schema Validation Tests (full coverage)
// ─────────────────────────────────────────────────
describe('Zod Schemas — Authentication', () => {
  it('validates User Signup request & response', () => {
    const req = {
      formData: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'securepassword123',
        age: '28',
        fitnessGoal: 'Muscle Gain',
      },
    }
    expect(validateRequest(UserSignupSchema, req).success).toBe(true)
    expect(validateResponse(UserSignupResponseSchema, { message: 'User created', userId: 'abc123' }).success).toBe(true)
  })

  it('rejects signup with invalid email', () => {
    const req = { formData: { fullName: 'Jane', email: 'not-an-email', password: 'pass123' } }
    expect(validateRequest(UserSignupSchema, req).success).toBe(false)
  })

  it('rejects signup with password too short', () => {
    const req = { formData: { fullName: 'Jane', email: 'jane@example.com', password: 'abc' } }
    expect(validateRequest(UserSignupSchema, req).success).toBe(false)
  })

  it('validates User Login request & response', () => {
    const req = { email: 'user@zenfit.com', password: 'mypassword123' }
    expect(validateRequest(UserLoginSchema, req).success).toBe(true)
    expect(validateResponse(UserLoginResponseSchema, {
      message: 'Login successful',
      user: { id: 'abc', email: 'u@e.com', fullName: 'User' },
    }).success).toBe(true)
  })

  it('rejects User Login responses that expose a token field', () => {
    expect(validateResponse(UserLoginResponseSchema, {
      message: 'Login successful',
      user: { id: 'abc', email: 'u@e.com', fullName: 'User' },
      token: 'jwt.token.here',
    }).success).toBe(false)
  })

  it('rejects login with missing email', () => {
    expect(validateRequest(UserLoginSchema, { password: 'only-password' }).success).toBe(false)
  })
})

describe('Zod Schemas — Generate Plan', () => {
  it('validates plan request with all required fields', () => {
    const req = { age: '25', gender: 'Male', weight: '75', height: '180', fitnessGoal: 'Muscle Gain', experienceLevel: 'Intermediate', workoutLocation: 'Gym' }
    expect(validateRequest(GeneratePlanRequestSchema, req).success).toBe(true)
  })

  it('rejects plan request with missing required field', () => {
    const req = { age: '25', gender: 'Male' } // missing many fields
    expect(validateRequest(GeneratePlanRequestSchema, req).success).toBe(false)
  })

  it('validates plan response with workout and diet', () => {
    const res = {
      workout_plan: [{ day: 'Day 1', focus: 'Upper Body', exercises: [{ name: 'Bench Press', sets: 3, reps: '10' }] }],
      diet_plan: [{ meal: 'Breakfast', name: 'Oatmeal', calories: 500 }],
      recommendations: ['Hydrate daily'],
    }
    expect(validateResponse(GeneratePlanResponseSchema, res).success).toBe(true)
  })
})

describe('Zod Schemas — Chat API', () => {
  it('validates chat request with message and userId', () => {
    const req = { message: 'How do I improve my squat?', userId: 'user_123' }
    expect(validateRequest(ChatRequestSchema, req).success).toBe(true)
  })

  it('rejects empty message', () => {
    expect(validateRequest(ChatRequestSchema, { message: '' }).success).toBe(false)
  })

  it('rejects message over 4000 chars', () => {
    const req = { message: 'A'.repeat(4001) }
    expect(validateRequest(ChatRequestSchema, req).success).toBe(false)
  })

  it('validates chat response with all optional fields', () => {
    const res = { response: 'Great question!', sources: [], imageUrl: null, exerciseName: null, classification: 'fitness' }
    expect(validateResponse(ChatResponseSchema, res).success).toBe(true)
  })
})

describe('Zod Schemas — Image & Voice & Transcribe', () => {
  it('validates image request with valid type', () => {
    expect(validateRequest(GenerateImageRequestSchema, { name: 'Deadlift', type: 'exercise' }).success).toBe(true)
    expect(validateRequest(GenerateImageRequestSchema, { name: 'Oatmeal', type: 'meal' }).success).toBe(true)
  })

  it('rejects image request with invalid type', () => {
    expect(validateRequest(GenerateImageRequestSchema, { name: 'Something', type: 'video' }).success).toBe(false)
  })

  it('validates image response', () => {
    expect(validateResponse(GenerateImageResponseSchema, { imageData: 'https://example.com/img.jpg', provider: 'pollinations' }).success).toBe(true)
  })

  it('validates quote response', () => {
    expect(validateResponse(GenerateQuoteResponseSchema, { quote: 'Push harder!', author: 'ZenFit' }).success).toBe(true)
  })

  it('validates voice request with text', () => {
    expect(validateRequest(GenerateVoiceRequestSchema, { text: 'Your workout summary' }).success).toBe(true)
  })

  it('rejects voice request with empty text', () => {
    expect(validateRequest(GenerateVoiceRequestSchema, { text: '' }).success).toBe(false)
  })

  it('validates transcribe response', () => {
    expect(validateResponse(TranscribeResponseSchema, { text: 'Hello I want to lose weight' }).success).toBe(true)
  })
})
