import { NextResponse } from "next/server"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function GET() {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Generate one short original motivational quote about fitness, discipline, or self-improvement (1-2 lines max). Return only the quote, no attribution.",
                },
              ],
            },
          ],
        }),
      },
    )

    const data = await response.json()
    const quote = data.candidates?.[0]?.content?.parts?.[0]?.text || "Your fitness journey starts today."

    return NextResponse.json({ quote })
  } catch (error) {
    console.error("Error generating quote:", error)
    return NextResponse.json({ error: "Failed to generate quote" }, { status: 500 })
  }
}
