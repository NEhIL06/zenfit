import { NextResponse } from "next/server"

// Set ENABLE_GEMINI_IMAGE=true in .env when you have a paid Gemini API quota
const USE_GEMINI = process.env.ENABLE_GEMINI_IMAGE === "true"
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: Request) {
  const { name, type } = await request.json()

  let prompt: string
  if (type === "exercise") {
    prompt = `Realistic fitness photograph of a person performing ${name}, proper form, gym setting, professional lighting, motivational, high quality`
  } else {
    prompt = `Realistic food photography of ${name}, appetizing presentation, professional lighting, white plate on neutral background, clean food style`
  }

  // --- Gemini path (only if paid quota is available) ---
  if (USE_GEMINI && GEMINI_API_KEY) {
    try {
      const { GoogleGenAI } = await import("@google/genai")
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: prompt,
      })

      const parts = response?.candidates?.[0]?.content?.parts
      const imagePart = Array.isArray(parts)
        ? parts.find((p: any) => p.inlineData?.data)
        : null

      if (imagePart?.inlineData?.data) {
        const mime = imagePart.inlineData.mimeType || "image/jpeg"
        return NextResponse.json({
          imageData: `data:${mime};base64,${imagePart.inlineData.data}`,
        })
      }
    } catch (e: any) {
      // 429 quota exhausted → fall through to Pollinations
      if (e?.status !== 429) {
        console.error("[generate-image] Gemini error:", e?.message)
      }
    }
  }

  // --- Pollinations.ai fallback (free, no quota) ---
  const encodedPrompt = encodeURIComponent(prompt)
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`

  return NextResponse.json({ imageData: imageUrl })
}