interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
  }>
}

export async function generateMotivationalQuote(): Promise<string> {
  try {
    const response = await fetch("/api/generate-quote", {
      method: "GET",
    })

    const data = await response.json()
    return data.quote || "Your fitness journey starts today."
  } catch (error) {
    console.error("Error generating quote:", error)
    throw error
  }
}

export async function generateFitnessPlan(userDetails: any): Promise<any> {
  try {
    const response = await fetch("/api/generate-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userDetails),
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error generating plan:", error)
    throw error
  }
}

export async function generatePersonalizedQuote(userData: any): Promise<string> {
  try {
    const response = await fetch("/api/personalized-quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    })

    const data = await response.json()
    return data.quote || "You are stronger than you think!"
  } catch (error) {
    console.error("[v0] Error generating personalized quote:", error)
    throw error
  }
}
