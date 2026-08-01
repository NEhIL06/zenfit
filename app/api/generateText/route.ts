import { NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const ai = new Mistral({
  apiKey: MISTRAL_API_KEY || "",
});

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
    const { prompt, maxTokens } = await request.json();

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
    //           parts: [{ text: prompt }],
    //         },
    //       ],
    //       generationConfig: {
    //         maxOutputTokens: maxTokens || 512,
    //       },
    //     }),
    //   }
    // );


    const response = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: prompt,
        }
      ],
      maxTokens: maxTokens || 512,
    });
    const data = response as any;
    const text =
      data.choices[0].message.content?.toString() ||
      "";
    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("[API /generateText] Error:", err);
    if (isQuotaError(err)) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "API text generation rate limit or quota exceeded." },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Failed to generate text", text: "" }, { status: 500 });
  }
}
