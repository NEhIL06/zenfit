import { Mistral } from "@mistralai/mistralai";
import { NextResponse } from "next/server"

// const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const ai = new Mistral({
  apiKey: MISTRAL_API_KEY || "",
})  

export async function GET() {
  try {
    // const response = await fetch(
    //   "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    //   {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       "x-goog-api-key": GEMINI_API_KEY || "",
    //     },
    //     body: JSON.stringify({
    //       contents: [
    //         {
    //           parts: [
    //             {
    //               text: "Generate one short original motivational quote about fitness, discipline, or self-improvement (1-2 lines max). Return only the quote, no attribution.",
    //             },
    //           ],
    //         },
    //       ],
    //     }),
    //   },
    // )

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
  } catch (error) {
    console.error("Error generating quote:", error)
    return NextResponse.json({ error: "Failed to generate quote" }, { status: 500 })
  }
}
