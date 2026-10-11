import { NextRequest, NextResponse } from "next/server"
import { runSelfRAG } from "@/lib/ai-trainer/self-rag"
import { getMistralClient } from "@/lib/mistral"
import { getCache, setCache, CacheKeys, TTL } from "@/lib/cache"
import { isQuotaExceededError, toSafeErrorMessage } from "@/lib/error-handler"
import { requireAuthUser } from "@/lib/api-security"
import { checkRateLimit } from "@/lib/rate-limiter"
import { ChatRequestSchema, ChatResponseSchema, validateRequest, validateResponse } from "@/lib/schemas"
import { logger } from "@/lib/logger"

const FITNESS_KEYWORDS = [
  'workout', 'exercise', 'diet', 'protein', 'calories', 'muscle', 'cardio', 'weight',
  'bulk', 'cut', 'macro', 'rep', 'set', 'squat', 'deadlift', 'bench', 'nutrition',
  'supplement', 'creatine', 'whey', 'plan', 'regenerate', 'stomach', 'abs', 'fat',
  'bicep', 'tricep', 'leg', 'chest', 'back', 'arm', 'routine', 'gym', 'training',
  'tdee', 'bmr', 'fasting', 'caloric', 'rest', 'form', 'injury', 'pain', 'soreness',
  'stretch', 'warmup', 'cooldown', 'hiit', 'kettlebell', 'dumbbell', 'barbell'
]

const GENERAL_GREETINGS = [
  'hi', 'hello', 'hey', 'how are you', 'what is up', 'who are you', 'good morning', 'good evening', 'thanks', 'thank you', 'bye'
]

/** Helper: call Mistral for general chat text generation */
async function callMistral(prompt: string) {
  const ai = getMistralClient()
  const res = await ai.chat.complete({
    model: "mistral-small-latest",
    messages: [
      { role: "system", content: "You are an expert AI fitness coach and nutritionist." },
      { role: "user", content: prompt },
    ],
  })
  const text = res.choices[0].message.content?.toString()
  return text ?? ""
}

/** Synchronous fast-path zero-cost classification */
function classifyQuerySync(query: string): "fitness" | "general" | "ambiguous" {
  const lower = query.trim().toLowerCase()

  // 1. Direct greeting check (zero cost)
  if (GENERAL_GREETINGS.some(g => lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + ','))) {
    return 'general'
  }

  // 2. Keyword match (zero cost)
  if (FITNESS_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'fitness'
  }

  return 'ambiguous'
}

type RAGSource = { content: string; metadata?: Record<string, unknown>; source?: string }

function toChatSources(sources: RAGSource[]) {
  return sources.map((source) => {
    const sourceName =
      source.source ||
      (typeof source.metadata?.source === "string" ? source.metadata.source : undefined) ||
      (typeof source.metadata?.filename === "string" ? source.metadata.filename : undefined) ||
      (typeof source.metadata?.collection === "string" ? source.metadata.collection : undefined)

    return {
      content: source.content,
      ...(sourceName && { source: sourceName }),
    }
  })
}

/** Fast query classification: sync zero-cost check with lightweight LLM fallback */
async function classifyQuery(query: string): Promise<"fitness" | "general"> {
  const fastResult = classifyQuerySync(query)
  if (fastResult !== 'ambiguous') {
    return fastResult
  }

  // 3. Lightweight LLM call for ambiguous queries only (no heavy system prompt, max 5 tokens)
  try {
    const ai = getMistralClient()
    const res = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [
        { role: "user", content: `Classify the following user message as either "fitness" or "general". Message: "${query}". Answer ONLY with "fitness" or "general".` },
      ],
      maxTokens: 5,
    })
    const raw = res.choices[0]?.message?.content?.toString()?.toLowerCase() || ""
    return raw.includes("fitness") ? "fitness" : "general"
  } catch {
    return "fitness" // Default safety fallback
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // 1. Zod Request Validation
    const validation = validateRequest(ChatRequestSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { message, history, chatHistory, images } = validation.data

    // 2. Extract Verified Auth User
    // SECURITY: Only read userId from middleware-verified sources (JWT payload or
    // the x-user-id header injected by middleware). Never fall back to body.userId
    // \u2014 that would let any caller spoof a different user ID for rate limiting.
    const auth = await requireAuthUser(req)
    if (!auth.ok) return auth.response
    const userId = auth.user.userId

    // 3. Rate Limiting Check
    const rateLimit = await checkRateLimit(`chat_${userId}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "Rate limit exceeded. Please wait a minute before sending more messages." },
        { status: 429 }
      )
    }

    logger.info({ userId, messageLength: message.length, hasImage: Boolean(images?.length) }, '[Chat API] Request received')

    // 4. Zero-Cost Fast Classification
    const category = await classifyQuery(message)
    logger.info({ category }, '[Chat API] Classified')

    let finalResponseText = ""
    let finalSources: RAGSource[] = []
    const finalExerciseName: string | null = null
    const finalImageUrl: string | null = null

    // 5. General Chat Mode
    if (category === "general") {
      const generalCacheKey = CacheKeys.generalChat(message)
      const cachedGeneral = await getCache<string>(generalCacheKey)

      if (cachedGeneral) {
        finalResponseText = cachedGeneral
      } else {
        finalResponseText = await callMistral(`You are a friendly fitness coach responding casually in general conversation. User asked: "${message}" Give a short, warm, conversational response.`)
        await setCache(generalCacheKey, finalResponseText, TTL.GENERAL_CHAT)
      }
    } else {
      // 6. Fitness Mode (Self-RAG Pipeline)
      const ragCacheKey = CacheKeys.ragResponse(userId, message)
      const cachedRag = await getCache<{ generation: string; sources: RAGSource[] }>(ragCacheKey)

      if (cachedRag) {
        finalResponseText = cachedRag.generation
        finalSources = cachedRag.sources
      } else {
        const ragResult = await runSelfRAG(message, userId, images, history ?? chatHistory)
        finalResponseText = ragResult.generation
        finalSources = ragResult.sources

        await setCache(
          ragCacheKey,
          { generation: ragResult.generation, sources: ragResult.sources },
          TTL.RAG
        )
      }
    }

    const responsePayload = {
      response: finalResponseText,
      sources: toChatSources(finalSources),
      imageUrl: finalImageUrl,
      exerciseName: finalExerciseName,
      classification: category,
    }

    // 7. Zod Response Validation
    const resValidation = validateResponse(ChatResponseSchema, responsePayload)
    if (!resValidation.success) {
      logger.warn({ issues: resValidation.error }, "[Chat API] Response validation warning")
    }

    return NextResponse.json(responsePayload, { status: 200 })

  } catch (error: unknown) {
    logger.error({ err: toSafeErrorMessage(error) }, '[Chat API] Unhandled error')
    const err = error as { status?: number; message?: string }
    if (isQuotaExceededError(err?.status, err)) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: "AI Chat rate limit or quota exceeded. Please try again in a few moments.",
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        ...(process.env.NODE_ENV === 'development' && { details: toSafeErrorMessage(error) }),
      },
      { status: 500 }
    )
  }
}
