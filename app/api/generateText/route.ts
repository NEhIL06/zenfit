import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
  try {
    const { prompt, maxTokens } = await request.json();

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
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: maxTokens || 512,
          },
        }),
      }
    );

    const data = await response.json();
    const text =
      data.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[API /generateText] Error:", err);
    return NextResponse.json({ text: "" }, { status: 500 });
  }
}
