import { z } from "zod"

// ─── Authentication & User Schemas ──────────────────────────────────────────

export const UserFormDataSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  age: z.string().or(z.number()).optional(),
  gender: z.string().optional(),
  weight: z.string().or(z.number()).optional(),
  height: z.string().or(z.number()).optional(),
  fitnessGoal: z.string().optional(),
  experienceLevel: z.string().optional(),
  workoutLocation: z.string().optional(),
  dietaryPreference: z.string().optional(),
})
export type UserFormData = z.infer<typeof UserFormDataSchema>

export const UserSignupSchema = z.object({
  formData: UserFormDataSchema.optional(),
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
}).refine(
  (data) => (data.formData && data.formData.email && data.formData.password) || (data.email && data.password),
  { message: "Email and password are required (either top-level or inside formData)" }
)

export const UserLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

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

// ─── Milestone Schemas ──────────────────────────────────────────────────────

export const MilestoneRequestSchema = z.object({
  userId: z.string().min(1, "userId is required").optional(),
  content: z.string().min(1, "content is required").max(500, "Milestone content cannot exceed 500 characters"),
  userName: z.string().max(100).optional(),
}).strict()
