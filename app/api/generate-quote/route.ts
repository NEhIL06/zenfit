import { Mistral } from "@mistralai/mistralai";
import { NextResponse } from "next/server"

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

export async function GET() {
  try {
    const response = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: "Generate one short original motivational quote about fitness, discipline, or self-improvement (1-2 lines max). Return only the quote, no attribution.",
        }
      ],
    })

    const data = response as any;
    const quote = data.choices[0].message.content.toString() || "Your fitness journey starts today."

    return NextResponse.json({ quote })
  } catch (error: any) {
    console.error("Error generating quote:", error)
    if (isQuotaError(error)) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "API quote generation quota or rate limit exceeded." },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "Failed to generate quote" }, { status: 500 })
  }
}
