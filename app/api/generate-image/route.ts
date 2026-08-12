import { NextResponse } from "next/server"
import { getCache, setCache, CacheKeys, TTL, normalizeKey } from "@/lib/cache"
import { isQuotaExceededError, toSafeErrorMessage } from "@/lib/error-handler"
import { GenerateImageRequestSchema, GenerateImageResponseSchema, validateRequest, validateResponse } from "@/lib/schemas"
import { getCuratedImageUrl } from "@/lib/image-resolver"
import { requireAuthUser } from "@/lib/api-security"
import { checkRateLimit } from "@/lib/rate-limiter"
import { logger } from "@/lib/logger"

const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY
const USE_GEMINI = process.env.ENABLE_GEMINI_IMAGE === "true"
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY
const POLLINATIONS_IMAGE_MODEL = process.env.POLLINATIONS_IMAGE_MODEL || "turbo"

type ImageGenerationResponse = {
  images?: Array<{ url?: string }>
}

type GeminiImagePart = {
  inlineData?: {
    data?: string
    mimeType?: string
  }
}

function deterministicSeed(input: string): number {
  const normalized = normalizeKey(input)
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0
  }
  return hash % 1_000_000
}

function buildPollinationsUrl(prompt: string, seed: number): string {
  const encoded = encodeURIComponent(prompt)
  return `https://image.pollinations.ai/prompt/${encoded}?model=${POLLINATIONS_IMAGE_MODEL}&seed=${seed}&width=512&height=512&nologo=true`
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthUser(request)
    if (!auth.ok) return auth.response

    const body = await request.json()

    // 1. Zod Request Validation
    const validation = validateRequest(GenerateImageRequestSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name, type } = validation.data
    const rateLimit = await checkRateLimit(`image_${auth.user.userId}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "Image generation rate limit exceeded. Please wait a minute." },
        { status: 429 }
      )
    }

    // 2. Check Redis global image cache
    const cacheKey = type === "exercise"
      ? CacheKeys.exerciseImage(name)
      : CacheKeys.mealImage(name)

    const cachedUrl = await getCache<string>(cacheKey)
    if (cachedUrl) {
      const cachedResponse = { imageData: cachedUrl, provider: "cache" }
      return NextResponse.json(cachedResponse)
    }

    // 3. Instant Curated Dynamic Image Fallback URL
    const curatedUrl = getCuratedImageUrl(name, type)

    // 4. Build prompt
    let prompt: string
    if (type === "exercise") {
      prompt = `Realistic fitness photograph of a person performing ${name}, proper form, gym setting, professional lighting, motivational, high quality`
    } else {
      prompt = `Realistic food photography of ${name}, appetizing presentation, professional lighting, white plate on neutral background, clean food style`
    }

    // 5. Primary Provider: Nanobanana API (if configured)
    if (NANOBANANA_API_KEY) {
      try {
        logger.info({ userId: auth.user.userId, type }, "[generate-image] Calling primary provider")
        const response = await fetch("https://api.nanobanana.ai/v1/images/generations", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${NANOBANANA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            width: 1024,
            height: 1024,
            num_inference_steps: 30,
            guidance_scale: 7.5,
          }),
          signal: AbortSignal.timeout(3000), // 3s fast timeout
        })

        if (response.ok) {
          const data = await response.json() as ImageGenerationResponse
          const imageUrl = data.images?.[0]?.url
          if (imageUrl) {
            await setCache(cacheKey, imageUrl, TTL.IMAGE)
            const payload = { imageData: imageUrl, provider: "nanobanana" }
            return NextResponse.json(payload)
          }
        } else {
          logger.warn({ status: response.status }, "[generate-image] Nanobanana error")
        }
      } catch (e: unknown) {
        logger.warn({ err: toSafeErrorMessage(e) }, "[generate-image] Nanobanana failed, triggering fallback chain")
      }
    }

    // 6. Secondary Provider: Gemini Image API (if enabled)
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
          ? parts.find((p: GeminiImagePart) => p.inlineData?.data)
          : null

        if (imagePart?.inlineData?.data) {
          const mime = imagePart.inlineData.mimeType || "image/jpeg"
          const dataUri = `data:${mime};base64,${imagePart.inlineData.data}`

          await setCache(cacheKey, dataUri, TTL.IMAGE)
          return NextResponse.json({ imageData: dataUri, provider: "gemini" })
        }
      } catch (e: unknown) {
        logger.error({ err: toSafeErrorMessage(e) }, "[generate-image] Gemini error")
      }
    }

    // 7. Fast Provider: Pollinations AI with 2-second timeout
    const seed = deterministicSeed(name)
    const pollinationsUrl = buildPollinationsUrl(prompt, seed)

    let finalImageUrl = curatedUrl

    try {
      const pRes = await fetch(pollinationsUrl, {
        method: "HEAD",
        headers: POLLINATIONS_API_KEY ? { Authorization: `Bearer ${POLLINATIONS_API_KEY}` } : {},
        signal: AbortSignal.timeout(2000), // 2-second max wait
      })
      if (pRes.ok) {
        finalImageUrl = pollinationsUrl
      }
    } catch {
      // Fast fallback to dish/exercise curated URL
      finalImageUrl = curatedUrl
    }

    await setCache(cacheKey, finalImageUrl, TTL.IMAGE)

    const responsePayload = { imageData: finalImageUrl, provider: finalImageUrl === curatedUrl ? "curated_cdn" : "pollinations" }

    // Zod Response Validation
    const resValidation = validateResponse(GenerateImageResponseSchema, responsePayload)
    if (!resValidation.success) {
      logger.warn({ issues: resValidation.error }, "[generate-image] Response validation warning")
    }

    return NextResponse.json(responsePayload)

  } catch (error: unknown) {
    logger.error({ err: toSafeErrorMessage(error) }, "[generate-image] Error")
    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined
    if (isQuotaExceededError(status, error as Record<string, unknown>)) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: "Image API quota or rate limit exceeded. Please try again later.",
        },
        { status: 429 }
      )
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
