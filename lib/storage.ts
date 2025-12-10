interface User {
  id: string
  name: string
  email: string
  password: string
  age: number
  gender: string
  height: number
  weight: number
  fitnessGoal: string
  fitnessLevel: string
  workoutLocation: string
  dietaryPreference: string
  medicalHistory: string
  stressLevel: string
  plan: any
  createdAt: string
}

interface Milestone {
  id: string
  userId: string
  content: string
  createdAt: string
}

export async function saveUser(userData: any): Promise<string> {
  
  try {
    const response = await fetch(`/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({formData:userData}),
    })

    if (!response.ok) {
      throw new Error("Failed to save user data")
    }
    const data = await response.json()
    const userId = data.id
    localStorage.setItem("current_user_id", userId)
    return userId
  } catch (error) {
    console.error("[Storage] Error saving user:", error)
    throw error
  }
}

export async function getCurrentUser(): Promise<User | null> {
  if (typeof window === "undefined") {
    console.log("[Storage] getCurrentUser: window is undefined")
    return null
  }
  console.log("[Storage] getCurrentUser: window is defined")
  const userId = localStorage.getItem("current_user_id")
  console.log("[Storage] getCurrentUser: userId is defined", userId)
  if (!userId) {
    console.log("[Storage] getCurrentUser: userId is undefined")
    return null
  }

  return getUserById(userId)
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const response = await fetch(`/api/users/${userId}`)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error("Failed to fetch user")
    }
    const user = await response.json()
    const normalized: User = {
      id: user._id || userId,
      name: user.formData.name,
      email: user.formData.email,
      password: user.formData.password,
      age: Number(user.formData.age),
      gender: user.formData.gender,
      height: Number(user.formData.height),
      weight: Number(user.formData.weight),
      fitnessGoal: user.formData.fitnessGoal,
      fitnessLevel: user.formData.fitnessLevel,
      workoutLocation: user.formData.workoutLocation,
      dietaryPreference: user.formData.dietaryPreference,
      medicalHistory: user.formData.medicalHistory,
      stressLevel: user.formData.stressLevel,
      plan: user.formData.plan,
      createdAt: user.createdAt,
    }
    console.log("[Storage] getUserById: user is defined", user)
    return normalized

  } catch (error) {
    console.error("[Storage] Error fetching user:", error)
    return null
  }
}



export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error("Failed to update user")
    }
  } catch (error) {
    console.error("[Storage] Error updating user:", error)
    throw error
  }
}

export function saveMilestone(userId: string, content: string): string {
  const milestones = getAllMilestones()
  const milestoneId = `milestone_${Date.now()}`
  const milestone: Milestone = {
    id: milestoneId,
    userId,
    content,
    createdAt: new Date().toISOString(),
  }
  milestones.push(milestone)
  localStorage.setItem("fitness_milestones", JSON.stringify(milestones))
  return milestoneId
}

export function getAllMilestones(): Milestone[] {
  if (typeof window === "undefined") return []
  const milestones = localStorage.getItem("fitness_milestones")
  return milestones ? JSON.parse(milestones) : []
}

export function getMilestonesByUserId(userId: string): Milestone[] {
  const milestones = getAllMilestones()
  return milestones
    .filter((m) => m.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function logout(): void {
  localStorage.removeItem("current_user_id")
}

export async function generateImage(name: string, type: "exercise" | "meal"): Promise<string> {
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, type }),
    })

    const data = await response.json()
    return data.imageData || ""
  } catch (error) {
    console.error("[v0] Error generating image:", error)
    throw error
  }
}

export async function generateVoice(text: string, voiceName = "Puck"): Promise<string> {
  try {
    const response = await fetch("/api/generate-voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, voiceName }),
    })

    const data = await response.json()
    return data.audioData || ""
  } catch (error) {
    console.error("[v0] Error generating voice:", error)
    throw error
  }
}

export async function fetchPublicMilestones(): Promise<any[]> {
  try {
    const response = await fetch("/api/milestones", {
      method: "GET",
    })

    const milestones = await response.json()
    return Array.isArray(milestones) ? milestones : []
  } catch (error) {
    console.error("[v0] Error fetching milestones:", error)
    return []
  }
}

export async function createMilestone(userId: string, userName: string, content: string): Promise<any> {
  try {
    const response = await fetch("/api/milestones", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, userName, content }),
    })

    return await response.json()
  } catch (error) {
    console.error("[v0] Error creating milestone:", error)
    throw error
  }
}
