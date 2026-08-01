import { NextResponse } from "next/server"
import { Mistral } from "@mistralai/mistralai"

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const ai = new Mistral({
  apiKey: MISTRAL_API_KEY || "",
})

function isQuotaError(e: any): boolean {
  const msg = `${e?.message || ""} ${e?.status || ""} ${JSON.stringify(e || {})}`.toLowerCase()
  return (
    e?.status === 429 ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("too many requests")
  )
}

export async function POST(request: Request) {
  try {
    const userData = await request.json()

    // const ai = new GoogleGenAI({
    //   apiKey: GEMINI_API_KEY || "",
    // })

    const prompt = `Generate a personalized, motivational fitness quote for someone with these details:
- Name: ${userData.name}
- Goal: ${userData.fitnessGoal}
- Fitness Level: ${userData.fitnessLevel}
- Stress Level: ${userData.stressLevel}

Create an inspiring, concise quote (1-2 lines) that specifically addresses their fitness goal and current situation. Return only the quote, no attribution.`

    const response = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: prompt,
        }
      ],
      maxTokens: 100,
    })

    const quote = response.choices[0].message.content?.toString() || "You are stronger than you think!"

    return NextResponse.json({ quote })
  } catch (error: any) {
    console.error("[v0] Error generating personalized quote:", error)
    if (isQuotaError(error)) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "Quote generation quota or rate limit exceeded." },
        { status: 429 }
      )
    }
    return NextResponse.json({ quote: "Your fitness journey is unique, embrace every step!" })
  }
}
