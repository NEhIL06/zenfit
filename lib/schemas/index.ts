import { z } from 'zod'

/**
 * -------------------------------------------------------------------
 * Central Zod Schemas Registry
 *
 * Single source of truth for ALL request and response payload shapes.
 * Used for:
 *   - Backend: validateRequest() returns 400 on invalid input
 *   - Backend: validateResponse() warns when LLM output deviates from schema
 *   - Frontend: handleApiResponse() validates response before updating state
 *   - Type inference: z.infer<typeof Schema> eliminates `any` in hot paths
 * -------------------------------------------------------------------
 */

// ─── Shared Error Envelope ───────────────────────────────────────────────────

/**
 * Standard error shape returned by all API routes on failure.
 * Using a typed envelope lets the frontend validate error responses the same
 * way it validates success responses — no special-casing needed.
 */
export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.string().optional(),
  code: z.string().optional(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

// ─── 1. Authentication & Users ───────────────────────────────────────────────

export const UserFormDataSchema = z.object({
  fullName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  age: z.string().optional(),
  gender: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  fitnessGoal: z.string().optional(),
  experienceLevel: z.string().optional(),
  workoutLocation: z.string().optional(),
  dietaryPreference: z.string().optional(),
})
export type UserFormData = z.infer<typeof UserFormDataSchema>

export const UserSignupSchema = z.object({
  formData: UserFormDataSchema,
})

export const UserSignupResponseSchema = z.object({
  message: z.string(),
  userId: z.string(),
})
export type UserSignupResponse = z.infer<typeof UserSignupResponseSchema>

export const UserLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

/**
 * BUG-07 fix: Previous schema incorrectly included a `token` field.
 * The login route sets an httpOnly cookie — it never returns a token in JSON.
 */
export const UserLoginResponseSchema = z.object({
  message: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    fullName: z.string(),
  }),
  // No `token` field — auth is via httpOnly cookie, not JSON token
}).strict()
export type UserLoginResponse = z.infer<typeof UserLoginResponseSchema>

/**
 * Safe client-side user profile — no password field.
 * BUG-08 fix: the previous `User` interface in storage.ts included `password: string`.
 * A client-side type must never include password.
 */
export const UserProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
  gender: z.string().optional(),
  height: z.number().optional(),
  weight: z.number().optional(),
  fitnessGoal: z.string().optional(),
  fitnessLevel: z.string().optional(),
  workoutLocation: z.string().optional(),
  dietaryPreference: z.string().optional(),
  medicalHistory: z.string().optional(),
  stressLevel: z.string().optional(),
  plan: z.any().optional(),
  createdAt: z.string().optional(),
})
export type UserProfile = z.infer<typeof UserProfileSchema>

export const UserProfileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  age: z.string().or(z.number()).optional(),
  gender: z.string().optional(),
  height: z.string().or(z.number()).optional(),
  weight: z.string().or(z.number()).optional(),
  fitnessGoal: z.string().optional(),
  fitnessLevel: z.string().optional(),
  experienceLevel: z.string().optional(),
  workoutLocation: z.string().optional(),
  dietaryPreference: z.string().optional(),
  medicalHistory: z.string().max(2000).optional(),
  stressLevel: z.string().optional(),
}).strict()

// ─── 2. Workout Plan Generation ──────────────────────────────────────────────

/**
 * Allowed values for plan generation fields.
 *
 * Using enums instead of free-text strings serves two purposes:
 *  1. Prompt injection prevention — user-controlled strings are interpolated
 *     directly into the LLM system prompt. Enums guarantee only known-safe
 *     values ever reach the prompt.
 *  2. Schema self-documentation — valid options are visible without reading
 *     the frontend UI code.
 */
export const FITNESS_GOALS = [
  'Weight Loss',
  'Muscle Gain',
  'Maintenance',
  'Endurance',
  'Flexibility',
  'Athletic Performance',
] as const
export type FitnessGoal = typeof FITNESS_GOALS[number]

export const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'] as const
export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number]

export const WORKOUT_LOCATIONS = ['Gym', 'Home', 'Outdoors', 'Hotel Room'] as const
export type WorkoutLocation = typeof WORKOUT_LOCATIONS[number]

export const DIETARY_PREFERENCES = [
  'Standard',
  'Vegetarian',
  'Vegan',
  'Keto',
  'Paleo',
  'Gluten-Free',
  'Dairy-Free',
] as const
export type DietaryPreference = typeof DIETARY_PREFERENCES[number]

export const GeneratePlanRequestSchema = z.object({
  age: z.string().min(1, 'Age is required').regex(/^\d{1,3}$/, 'Age must be a number'),
  gender: z.enum(['Male', 'Female', 'Non-binary', 'Prefer not to say']),
  weight: z.string().min(1, 'Weight is required').regex(/^\d{1,4}(\.\d{1,2})?$/, 'Weight must be a number'),
  height: z.string().min(1, 'Height is required').regex(/^\d{1,4}(\.\d{1,2})?$/, 'Height must be a number'),
  fitnessGoal: z.enum(FITNESS_GOALS),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  workoutLocation: z.enum(WORKOUT_LOCATIONS),
  dietaryPreference: z.enum(DIETARY_PREFERENCES).optional(),
  regenerationScope: z.enum(['full', 'diet']).optional(),
  userId: z.string().optional(),
})
export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>

export const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.string().or(z.number()),
  reps: z.string().or(z.number()),
  rest_seconds: z.string().or(z.number()).optional(),
  rest: z.string().or(z.number()).optional(),
  notes: z.string().optional(),
  rpe: z.number().or(z.string()).optional(),
})

export const DayPlanSchema = z.object({
  day: z.string(),
  focus: z.string(),
  exercises: z.array(ExerciseSchema),
})

export const MealItemSchema = z.object({
  name: z.string(),
  calories: z.number().or(z.string()).optional(),
  protein_g: z.number().or(z.string()).optional(),
  protein: z.string().or(z.number()).optional(),
  carbs: z.string().or(z.number()).optional(),
  fat: z.string().or(z.number()).optional(),
})

export const MealPlanSchema = z.object({
  meal: z.string(),
  name: z.string().optional(),
  calories: z.number().or(z.string()).optional(),
  protein: z.string().optional(),
  items: z.array(MealItemSchema).optional(),
})

export const GeneratePlanResponseSchema = z.object({
  summary: z.string().optional(),
  workout_plan: z.array(DayPlanSchema),
  diet_plan: z.array(MealPlanSchema).optional(),
  recommendations: z.array(z.string()).optional(),
  motivation_tips: z.array(z.string()).optional(),
})
export type GeneratePlanResponse = z.infer<typeof GeneratePlanResponseSchema>

// ─── 3. AI Trainer Chat ──────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(4000, 'Message too long'),
})
export type ChatMessage = z.infer<typeof ChatMessageSchema>

export const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  userId: z.string().optional(),
  conversationId: z.string().optional(),
  history: z.array(ChatMessageSchema).max(20, 'History too long').optional(),
  chatHistory: z.array(ChatMessageSchema).max(20, 'History too long').optional(),
  images: z.array(
    z.string()
      .startsWith('data:image/', 'Images must be data URLs')
      .max(2_750_000, 'Image payload too large')
  ).max(1, 'Only one image is supported per message').optional(),
}).strict()
export type ChatRequest = z.infer<typeof ChatRequestSchema>

export const SourceDocumentSchema = z.object({
  content: z.string(),
  source: z.string().optional(),
})

export const ChatResponseSchema = z.object({
  response: z.string(),
  sources: z.array(SourceDocumentSchema).optional(),
  imageUrl: z.string().nullable().optional(),
  exerciseName: z.string().nullable().optional(),
  classification: z.enum(['fitness', 'general']).optional(),
})
export type ChatResponse = z.infer<typeof ChatResponseSchema>

// ─── 4. Image Generation ─────────────────────────────────────────────────────

export const GenerateImageRequestSchema = z.object({
  name: z.string().min(1, 'Image prompt name is required').max(120, 'Image prompt name too long'),
  type: z.enum(['exercise', 'meal']),
}).strict()
export type GenerateImageRequest = z.infer<typeof GenerateImageRequestSchema>

export const GenerateImageResponseSchema = z.object({
  imageData: z.string(),
  provider: z.string().optional(),
})
export type GenerateImageResponse = z.infer<typeof GenerateImageResponseSchema>

// ─── 5. Quote Generation ─────────────────────────────────────────────────────

export const GenerateQuoteRequestSchema = z.object({
  userId: z.string().optional(),
})

export const GenerateQuoteResponseSchema = z.object({
  quote: z.string(),
  author: z.string().optional(),
})
export type GenerateQuoteResponse = z.infer<typeof GenerateQuoteResponseSchema>

export const PersonalizedQuoteRequestSchema = z.object({
  userProfile: z.record(z.any()).optional(),
  recentActivity: z.record(z.any()).optional(),
}).strict()

export const PersonalizedQuoteResponseSchema = z.object({
  quote: z.string(),
  personalizedFor: z.string().optional(),
})
export type PersonalizedQuoteResponse = z.infer<typeof PersonalizedQuoteResponseSchema>

// ─── 6. Voice & Audio ────────────────────────────────────────────────────────

export const GenerateVoiceRequestSchema = z.object({
  text: z.string().min(1, 'Text is required').max(1000),
  voice: z.string().optional(),
  voiceName: z.string().optional(),
}).strict()

export const GenerateVoiceResponseSchema = z.object({
  audioUrl: z.string().optional(),
  audioData: z.string().optional(),
})

export const TranscribeRequestSchema = z.object({
  audioBase64: z.string().min(1, 'Audio data is required'),
  mimeType: z.string().optional(),
})

export const TranscribeResponseSchema = z.object({
  text: z.string(),
})

// ─── 7. Milestones ───────────────────────────────────────────────────────────

export const MilestoneItemSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  userName: z.string().optional(),
  content: z.string(),
  completed: z.boolean().optional(),
  dateCompleted: z.string().optional(),
  createdAt: z.string().optional(),
  likes: z.number().optional(),
})
export type MilestoneItem = z.infer<typeof MilestoneItemSchema>

export const MilestoneRequestSchema = z.object({
  userId: z.string().min(1, 'userId is required').optional(),
  content: z.string().min(1, 'content is required').max(500, 'Milestone content cannot exceed 500 characters'),
  userName: z.string().max(100).optional(),
}).strict()
export type MilestoneRequest = z.infer<typeof MilestoneRequestSchema>

export const MilestoneResponseSchema = z.union([
  z.array(MilestoneItemSchema),
  z.object({
    success: z.boolean().optional(),
    milestones: z.array(MilestoneItemSchema).optional(),
    id: z.string().optional(),
    content: z.string().optional(),
  })
])
export type MilestoneResponse = z.infer<typeof MilestoneResponseSchema>

// ─── 8. General Text Generation ──────────────────────────────────────────────

export const GenerateTextRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(8000, 'Prompt too long'),
  maxTokens: z.number().int().min(1).max(1024).optional(),
}).strict()

export const GenerateTextResponseSchema = z.object({
  text: z.string(),
})
export type GenerateTextResponse = z.infer<typeof GenerateTextResponseSchema>

// ─── Helper Validators ───────────────────────────────────────────────────────

/** Validate an incoming request body. Returns 400-ready error string on failure. */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errorMsg = result.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
    return { success: false, error: errorMsg }
  }
  return { success: true, data: result.data }
}

/**
 * Validate an outgoing response body.
 * On failure, warns but does NOT block the response — production resilience.
 * In future, plug in Sentry/DataDog here for schema drift alerts.
 */
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errorMsg = result.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
    return { success: false, error: errorMsg }
  }
  return { success: true, data: result.data }
}
