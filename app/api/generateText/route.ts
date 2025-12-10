import { NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";
// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const ai = new Mistral({
  apiKey: MISTRAL_API_KEY || "",
});


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
  } catch (err) {
    console.error("[API /generateText] Error:", err);
    return NextResponse.json({ text: "" }, { status: 500 });
  }
}
