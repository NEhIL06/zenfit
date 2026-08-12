import { getMistralClient } from "./mistral"
import { handleApiResponse, showQuotaExceededToast } from "./error-handler"
import {
  GenerateQuoteResponseSchema,
  GenerateTextResponseSchema,
  GeneratePlanResponseSchema,
  PersonalizedQuoteResponseSchema,
  type GeneratePlanResponse,
} from "./schemas"

/**
 * Generate a motivational fitness quote.
 * BUG-03 fix: Added credentials: 'include' so the JWT cookie is sent with the request.
 * Without it, middleware returns 401 and the hardcoded fallback is always used.
 */
export async function generateMotivationalQuote(): Promise<string> {
  try {
    const response = await fetch("/api/generate-quote", {
      method: "GET",
      credentials: "include", // Required: sends httpOnly JWT cookie to middleware
    })

    const { data, isQuotaError } = await handleApiResponse(
      response,
      "motivational quote",
      GenerateQuoteResponseSchema
    )
    if (isQuotaError) return "Your fitness journey starts today."

    return data?.quote || "Your fitness journey starts today."
  } catch (error) {
    console.error("[AI] generateMotivationalQuote error:", error)
    return "Your fitness journey starts today."
  }
}

/**
 * Generate text via the AI pipeline.
 * Client-side: routes through /api/generateText (JWT-protected proxy).
 * Server-side: calls Mistral directly.
 */
export async function generateText(prompt: string, maxTokens = 512): Promise<string> {
  if (typeof window === "undefined") {
    return generateTextServer(prompt, maxTokens)
  }

  try {
    const res = await fetch("/api/generateText", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, maxTokens }),
    })

    const { data, isQuotaError } = await handleApiResponse(
      res,
      "text generation",
      GenerateTextResponseSchema
    )
    if (isQuotaError) return ""

    return data?.text || ""
  } catch (err) {
    console.error("[AI] generateText error:", err)
    return ""
  }
}

/**
 * Server-side text generation — calls Mistral directly (no HTTP hop).
 */
export async function generateTextServer(prompt: string, maxTokens = 512): Promise<string> {
  try {
    const ai = getMistralClient()
    const res = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      maxTokens,
    })

    return res.choices[0].message.content?.toString() || ""
  } catch (err) {
    console.error("[AI] generateTextServer error:", err)
    return ""
  }
}

/**
 * Analyze a base64-encoded image using Mistral vision.
 */
export async function analyzeImageBase64(imageBase64: string): Promise<string> {
  try {
    const ai = getMistralClient()

    const response = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze the following image and provide insights related to fitness and health.",
            },
            {
              type: "image_url",
              imageUrl: "data:image/jpeg;base64," + imageBase64,
            },
          ],
        },
      ],
    })

    return response.choices[0].message.content?.toString()?.trim() || "Could not analyze the image."
  } catch (err) {
    console.error("[AI] analyzeImageBase64 error:", err)
    return "Image analysis failed."
  }
}

/**
 * Generate a fitness plan by calling the backend API.
 * Validates the response against GeneratePlanResponseSchema.
 */
export async function generateFitnessPlan(userDetails: Record<string, unknown>): Promise<GeneratePlanResponse> {
  const response = await fetch("/api/generate-plan", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userDetails),
  })

  const { data, isQuotaError, error } = await handleApiResponse(
    response,
    "fitness plan",
    GeneratePlanResponseSchema
  )

  if (isQuotaError) {
    throw new Error(error || "Fitness plan generation quota exceeded")
  }
  if (!response.ok || error) {
    throw new Error(error || "Failed to generate fitness plan")
  }

  return data as GeneratePlanResponse
}

/**
 * Embed text using the HuggingFace inference API.
 *
 * BUG-04 fix: Added server-side guard. process.env.HF_API_KEY is not exposed
 * to the browser (not NEXT_PUBLIC_-prefixed). Calling this client-side would
 * send `Bearer undefined` to HuggingFace and silently fail.
 *
 * This function must only run server-side. If you need embeddings client-side,
 * create a /api/embed route and proxy through it.
 */
export async function embedText(text: string): Promise<number[]> {
  if (typeof window !== "undefined") {
    // Client-side call: HF_API_KEY is not available in the browser.
    // Route through /api/embed if you need client-side embeddings.
    console.warn("[AI] embedText called client-side — returning empty. Use server-side context.")
    return []
  }

  if (!process.env.HF_API_KEY) {
    console.warn("[AI] HF_API_KEY is missing; embeddings are disabled.")
    return []
  }

  try {
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/BAAI/bge-base-en-v1.5/pipeline/feature-extraction",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text }),
      }
    )

    if (response.status === 429) {
      showQuotaExceededToast("HuggingFace embedding API rate limit reached.", "text embedding")
      return []
    }

    if (!response.ok) {
      console.error("[AI] embedText HF error:", response.status, await response.text())
      return []
    }

    const raw = await response.text()
    const json = JSON.parse(raw)
    const embedding = Array.isArray(json[0]) ? json[0] : json
    return embedding
  } catch (err) {
    console.error("[AI] embedText error:", err)
    return []
  }
}

/**
 * Generate a personalized motivational quote based on user data.
 * Validates the response against PersonalizedQuoteResponseSchema.
 */
export async function generatePersonalizedQuote(userData: Record<string, unknown>): Promise<string> {
  try {
    const response = await fetch("/api/personalized-quote", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userProfile: userData }),
    })

    const { data, isQuotaError } = await handleApiResponse(
      response,
      "personalized quote",
      PersonalizedQuoteResponseSchema
    )
    if (isQuotaError) return "You are stronger than you think!"

    return data?.quote || "You are stronger than you think!"
  } catch (error) {
    console.error("[AI] generatePersonalizedQuote error:", error)
    throw error
  }
}
