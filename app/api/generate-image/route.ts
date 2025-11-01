import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: Request) {
  try {
    const { name, type } = await request.json()

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    })

    let prompt: string
    if (type === "exercise") {
      prompt = `Create a realistic fitness photograph of ${name}, proper form, gym lighting, minimal background. The image should be professional and motivational.`
    } else {
      prompt = `Generate a realistic photo of ${name} in a clean food photography style, appetizing presentation, professional lighting, white plate on neutral background.`
    }

    let response:any;
    try{response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt
    })}catch(e){
      console.log("Gemini API error:", e);
      console.error("Starting Fallback image generation...");
      const image = await fetch(`https://image.pollinations.ai/prompt/${prompt}`);
      console.log("Fallback image URL:", image.url);
      return NextResponse.json({ imageData: image.url });
      
    }

    let imageBase64:string = ""
    
    const parts = response?.candidates?.[0]?.content?.parts;

    if (!parts || !Array.isArray(parts)) {
      throw new Error("Invalid response structure: 'parts' array not found");
    }

    const imagePart = parts.find(part => part.inlineData && part.inlineData.data);

    if (imagePart) {
      imageBase64 = imagePart?.inlineData?.data as string;
    }

    if (!imageBase64) {
      throw new Error("No image data received from API")
    }

    return NextResponse.json({ imageData: imageBase64 })

  } catch (error) {
    
    console.error("[v0] Error generating image:", error)

    const errorMessage = error instanceof Error ? error.message : "Failed to generate image";
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}