import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: Request) {
  try {
    const { text, voiceName = "Puck" } = await request.json()

    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY || "",
    })

    const maxLength = 1000
    const textToProcess = text.substring(0, maxLength)

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: `Read the following fitness information in an encouraging and motivational tone: ${textToProcess}`,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
           voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
           },
        },
      },
    })

    
    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) {
      throw new Error("Audio data is undefined");
    }
    const audioBuffer = Buffer.from(data, 'base64');

    const audioBase64 = audioBuffer.toString('base64');

    const fileName = 'output.wav';
    
    return NextResponse.json({ audioData: audioBase64 })
  } catch (error) {
    console.error("[v0] Error generating voice:", error)
    return NextResponse.json({ error: "Failed to generate voice" }, { status: 500 })
  }
}

