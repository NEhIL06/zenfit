import { handleApiResponse } from "./error-handler"
import {
  GenerateImageResponseSchema,
  GenerateVoiceResponseSchema,
  MilestoneResponseSchema,
  type UserProfile,
  type MilestoneItem,
} from "./schemas"

function normalizeUserProfile(user: any, fallbackId?: string): UserProfile {
  return {
    id: user._id?.toString() || fallbackId || "",
    name: user.formData?.fullName || user.formData?.name || "",
    email: user.formData?.email || "",
    age: user.formData?.age ? Number(user.formData.age) : undefined,
    gender: user.formData?.gender,
    height: user.formData?.height ? Number(user.formData.height) : undefined,
    weight: user.formData?.weight ? Number(user.formData.weight) : undefined,
    fitnessGoal: user.formData?.fitnessGoal,
    fitnessLevel: user.formData?.fitnessLevel || user.formData?.experienceLevel,
    workoutLocation: user.formData?.workoutLocation,
    dietaryPreference: user.formData?.dietaryPreference,
    medicalHistory: user.formData?.medicalHistory,
    stressLevel: user.formData?.stressLevel,
    plan: user.formData?.plan || user.plan,
    createdAt: user.createdAt,
  }
}

/**
 * Client-side user profile shape.
 * BUG-08 fix: Removed `password` field. A client-side type must never include
 * credentials — even a normalized empty string encourages future misuse.
 * Use the canonical UserProfile type from lib/schemas/index.ts.
 */

// ─── User API calls ───────────────────────────────────────────────────────────

/**
 * Create a new user account.
 * Returns the userId on success; throws on failure.
 */
export async function saveUser(userData: Record<string, unknown>): Promise<string> {
  try {
    const response = await fetch("/api/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData: userData }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(err.error || "Failed to save user data")
    }

    const data = await response.json()
    const userId: string = data.userId
    if (typeof window !== "undefined") {
      localStorage.setItem("current_user_id", userId)
    }
    return userId
  } catch (error) {
    console.error("[Storage] saveUser error:", error)
    throw error
  }
}

/**
 * Get the currently logged-in user from localStorage.
 * BUG-01 fix: now calls getUserById which correctly uses ?id= instead of ?email=.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  if (typeof window === "undefined") return null

  const userId = localStorage.getItem("current_user_id")
  if (!userId) {
    try {
      const response = await fetch("/api/users", {
        credentials: "include",
      })

      if (!response.ok) return null

      const user = await response.json()
      const normalized = normalizeUserProfile(user)
      if (normalized.id) {
        localStorage.setItem("current_user_id", normalized.id)
      }
      return normalized
    } catch (error) {
      console.error("[Storage] getCurrentUser session recovery error:", error)
      return null
    }
  }

  return getUserById(userId)
}

/**
 * Fetch a user profile by their MongoDB ObjectId.
 * BUG-01 fix: Previous code passed `userId` as the `email` query parameter, so
 * findOne({ "formData.email": objectId }) never matched anything and always returned null.
 * Now correctly uses ?id= which the backend routes to findOne({ _id: new ObjectId(id) }).
 */
export async function getUserById(userId: string): Promise<UserProfile | null> {
  try {
    const response = await fetch(`/api/users?id=${userId}`, {
      credentials: "include",
    })

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error("Failed to fetch user")
    }

    const user = await response.json()

    // Normalize raw MongoDB document into typed UserProfile
    const normalized: UserProfile = {
      id: user._id?.toString() || userId,
      name: user.formData?.fullName || user.formData?.name || "",
      email: user.formData?.email || "",
      // No password field — intentionally omitted
      age: user.formData?.age ? Number(user.formData.age) : undefined,
      gender: user.formData?.gender,
      height: user.formData?.height ? Number(user.formData.height) : undefined,
      weight: user.formData?.weight ? Number(user.formData.weight) : undefined,
      fitnessGoal: user.formData?.fitnessGoal,
      fitnessLevel: user.formData?.fitnessLevel || user.formData?.experienceLevel,
      workoutLocation: user.formData?.workoutLocation,
      dietaryPreference: user.formData?.dietaryPreference,
      medicalHistory: user.formData?.medicalHistory,
      stressLevel: user.formData?.stressLevel,
      plan: user.formData?.plan || user.plan,
      createdAt: user.createdAt,
    }

    return normalized
  } catch (error) {
    console.error("[Storage] getUserById error:", error)
    return null
  }
}

/**
 * Update a user's profile fields by their ObjectId.
 * BUG-02 fix: Previous code called PUT /api/users/${userId} which doesn't exist.
 * Now calls PUT /api/users/${userId} via the dynamic route at app/api/users/[id]/route.ts
 * which was already in the codebase but never used correctly.
 *
 * The route at /api/users/[id] IS in the whitelist-compatible path (/api/users + /id)
 * so auth middleware applies correctly.
 */
export async function updateUser(
  userId: string,
  updates: Partial<Omit<UserProfile, "id" | "email" | "createdAt">>
): Promise<void> {
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData: updates }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(err.error || "Failed to update user")
    }
  } catch (error) {
    console.error("[Storage] updateUser error:", error)
    throw error
  }
}

// ─── Milestone API calls ──────────────────────────────────────────────────────

/**
 * Fetch all public milestones from the API.
 * §3.2 fix: milestones were previously split between localStorage (local functions)
 * and the API (fetchPublicMilestones / createMilestone). All milestone operations
 * now go through the API — single source of truth across devices.
 */
export async function fetchPublicMilestones(): Promise<MilestoneItem[]> {
  try {
    const response = await fetch("/api/milestones", {
      method: "GET",
      credentials: "include",
    })

    const { data, error } = await handleApiResponse(
      response,
      "milestones",
      MilestoneResponseSchema
    )

    if (error || !data) return []

    // The API returns an array directly for GET — handle both array and object shapes
    const raw = Array.isArray(data) ? data : data.milestones || []
    return raw
  } catch (error) {
    console.error("[Storage] fetchPublicMilestones error:", error)
    return []
  }
}

/**
 * Get milestones for a specific user.
 *
 * PERF FIX: The original implementation fetched ALL milestones into memory
 * and then filtered client-side — an O(N) scan that grows worse as the
 * milestone collection grows. This version passes userId to the API so
 * MongoDB does the filtering with an index.
 */
export async function getMilestonesByUserId(userId: string): Promise<MilestoneItem[]> {
  try {
    const response = await fetch(`/api/milestones?userId=${encodeURIComponent(userId)}`, {
      method: 'GET',
      credentials: 'include',
    })
    const { data, error } = await handleApiResponse(response, 'user milestones', MilestoneResponseSchema)
    if (error || !data) return []
    const raw = Array.isArray(data) ? data : (data as any).milestones ?? []
    return raw as MilestoneItem[]
  } catch (error) {
    console.error('[Storage] getMilestonesByUserId error:', error)
    return []
  }
}

/**
 * Create a new milestone via the API.
 * Returns the created milestone document.
 */
export async function createMilestone(
  userId: string,
  userName: string,
  content: string
): Promise<MilestoneItem | null> {
  try {
    const response = await fetch("/api/milestones", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, userName, content }),
    })

    const { data, error } = await handleApiResponse(response, "create milestone")
    if (error) {
      console.error("[Storage] createMilestone error:", error)
      return null
    }

    return data as MilestoneItem
  } catch (error) {
    console.error("[Storage] createMilestone error:", error)
    throw error
  }
}

// ─── Image & Voice generation ─────────────────────────────────────────────────

/**
 * Generate an exercise or meal image.
 * Validates response against GenerateImageResponseSchema.
 */
export async function generateImage(name: string, type: "exercise" | "meal"): Promise<string> {
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    })

    const { data, isQuotaError, error } = await handleApiResponse(
      response,
      `${type} image (${name})`,
      GenerateImageResponseSchema
    )

    if (isQuotaError || error) return ""

    return data?.imageData || ""
  } catch (error) {
    console.error("[Storage] generateImage error:", error)
    throw error
  }
}

/**
 * Generate voice audio from text.
 * Validates response against GenerateVoiceResponseSchema.
 */
export async function generateVoice(text: string, voiceName = "Puck"): Promise<string> {
  try {
    const response = await fetch("/api/generate-voice", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceName }),
    })

    const { data, isQuotaError, error } = await handleApiResponse(
      response,
      "voice narration",
      GenerateVoiceResponseSchema
    )

    if (isQuotaError || error) return ""

    return data?.audioData || ""
  } catch (error) {
    console.error("[Storage] generateVoice error:", error)
    throw error
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Log the user out: clear localStorage userId and call the logout API
 * to clear the httpOnly cookie.
 */
export async function logout(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem("current_user_id")
  }
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })
  } catch {
    // Best-effort cookie clear
  }
}
