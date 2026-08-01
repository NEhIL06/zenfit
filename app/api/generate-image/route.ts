import { NextResponse } from "next/server"
import { getCache, setCache, CacheKeys, TTL, normalizeKey } from "@/lib/cache"

// Set ENABLE_GEMINI_IMAGE=true in .env when you have a paid Gemini API quota
const USE_GEMINI = process.env.ENABLE_GEMINI_IMAGE === "true"
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY
const POLLINATIONS_IMAGE_MODEL = process.env.POLLINATIONS_IMAGE_MODEL || "flux"

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

/**
 * Generate a deterministic numeric seed from a string.
 * Same exercise name always produces the same seed → same Pollinations image URL.
 * This makes the URL itself stable and cacheable without storing bytes.
 */
function deterministicSeed(input: string): number {
  const normalized = normalizeKey(input)
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0
  }
  return hash % 1_000_000
}

/**
 * Build a stable Pollinations image URL.
 * Uses model + seed so the same prompt always maps to the same URL.
 */
function buildPollinationsUrl(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt)
  return `https://gen.pollinations.ai/image/${encoded}?model=${POLLINATIONS_IMAGE_MODEL}&seed=${seed}&width=512&height=512&nologo=true`
}

export async function POST(request: Request) {
  try {
    const { name, type } = await request.json()

    if (!name || !type) {
      return NextResponse.json({ error: "name and type are required" }, { status: 400 })
    }

    // 1. Check Redis global image cache
    const cacheKey = type === "exercise"
      ? CacheKeys.exerciseImage(name)
      : CacheKeys.mealImage(name)

    const cachedUrl = await getCache<string>(cacheKey)
    if (cachedUrl) {
      return NextResponse.json({ imageData: cachedUrl })
    }

    
    // 2. Build prompt
    let prompt: string
    if (type === "exercise") {
      prompt = `Realistic fitness photograph of a person performing ${name}, proper form, gym setting, professional lighting, motivational, high quality`
    } else {
      prompt = `Realistic food photography of ${name}, appetizing presentation, professional lighting, white plate on neutral background, clean food style`
    }

    // 3. Gemini path (if enabled and quota available)
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
          const dataUri = `data:${mime};base64,${imagePart.inlineData.data}`

          // Cache the Gemini result as a data URI
          await setCache(cacheKey, dataUri, TTL.IMAGE)

          return NextResponse.json({ imageData: dataUri })
        }
      } catch (e: any) {
        console.error("[generate-image] Gemini error:", e?.message)
        if (isQuotaError(e)) {
          return NextResponse.json(
            {
              error: "QUOTA_EXCEEDED",
              message: "Gemini Image generation quota exceeded. Falling back to Pollinations.",
            },
            { status: 429 }
          )
        }
        // Non-quota error → fall through to Pollinations
      }
    }

    // 4. Pollinations authenticated API fallback
    //    We use a deterministic seed so the URL is stable for the same input.
    //    We cache the URL string only (~200 bytes) — not the image bytes.
    
    const seed = deterministicSeed(name)
    const imageUrl = buildPollinationsUrl(prompt, seed)

    if (POLLINATIONS_API_KEY) {
      // Verify the image is reachable with auth (HEAD request to validate)
      try {
        const headRes = await fetch(imageUrl, {
          method: "HEAD",
          headers: { Authorization: `Bearer ${POLLINATIONS_API_KEY}` },
          signal: AbortSignal.timeout(5000),
        })
        if (!headRes.ok && headRes.status !== 405) {
          console.warn("[generate-image] Pollinations HEAD check failed:", headRes.status)
        }
      } catch {
        // HEAD timeout is fine — the GET URL is still valid
      }
    }

    // Cache the stable URL for 30 days
    await setCache(cacheKey, imageUrl, TTL.IMAGE)

    return NextResponse.json({ imageData: imageUrl })

  } catch (error: any) {
    console.error("[generate-image] Error:", error)
    if (isQuotaError(error)) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: "Image API quota or rate limit exceeded. Please try again later.",
        },
        { status: 429 }
      )
    }
    return NextResponse.json(
      { error: "Internal Server Error", details: error?.message || "Failed to generate image" },
      { status: 500 }
    )
  }
}