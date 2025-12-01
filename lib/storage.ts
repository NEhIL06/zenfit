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

export function saveUserToLocalStorage(userData: any): string {
  const users = getAllUsers()
  const userId = `user_${Date.now()}`
  const user: User = {
    id: userId,
    ...userData,
  }
  users.push(user)
  localStorage.setItem("fitness_users", JSON.stringify(users))
  localStorage.setItem("current_user_id", userId)
  return userId
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined"){
    console.log("[Storage] getCurrentUser: window is undefined")
    return null
  }
  console.log("[Storage] getCurrentUser: window is defined")
  const userId = localStorage.getItem("current_user_id")
  if (!userId){
    console.log("[Storage] getCurrentUser: userId is undefined")
    return null
  }
  console.log("[Storage] getCurrentUser: userId is defined")
  return getUserById(userId)
}

export function getUserById(userId: string): User | null {
  if (typeof window === "undefined") return null
  const users = getAllUsers()
  return users.find((u) => u.id === userId) || null
}

export function getAllUsers(): User[] {
  if (typeof window === "undefined") return []
  const users = localStorage.getItem("fitness_users")
  return users ? JSON.parse(users) : []
}

export function updateUser(userId: string, updates: Partial<User>): void {
  const users = getAllUsers()
  const userIndex = users.findIndex((u) => u.id === userId)
  if (userIndex !== -1) {
    users[userIndex] = { ...users[userIndex], ...updates }
    localStorage.setItem("fitness_users", JSON.stringify(users))
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
