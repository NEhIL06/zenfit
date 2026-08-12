import { NextResponse } from "next/server"
import { getMistralClient } from "@/lib/mistral"
import { isQuotaExceededError, toSafeErrorMessage } from "@/lib/error-handler"
import { PersonalizedQuoteRequestSchema, PersonalizedQuoteResponseSchema, validateRequest, validateResponse } from "@/lib/schemas"
import { requireAuthUser } from "@/lib/api-security"
import { checkRateLimit } from "@/lib/rate-limiter"
import { logger } from "@/lib/logger"

export async function POST(request: Request) {
  try {
    const auth = await requireAuthUser(request)
    if (!auth.ok) return auth.response

    const body = await request.json()

    const validation = validateRequest(PersonalizedQuoteRequestSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const userData = body.userProfile || body
    const rateLimit = await checkRateLimit(`personalized_quote_${auth.user.userId}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "Quote generation rate limit exceeded. Please wait a minute." },
        { status: 429 }
      )
    }

    const prompt = `Generate a personalized, motivational fitness quote for someone with these details:
- Name: ${userData.name || 'Friend'}
- Goal: ${userData.fitnessGoal || 'Wellness'}
- Fitness Level: ${userData.fitnessLevel || 'Beginner'}

Create an inspiring, concise quote (1-2 lines) that specifically addresses their fitness goal and current situation. Return only the quote, no attribution.`

    const ai = getMistralClient()
    const response = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 100,
    })

    const quote = response.choices[0]?.message?.content?.toString()?.trim() || "You are stronger than you think!"
    const responsePayload = { quote, personalizedFor: userData.name || 'Athlete' }

    const resValidation = validateResponse(PersonalizedQuoteResponseSchema, responsePayload)
    if (!resValidation.success) {
      logger.warn({ issues: resValidation.error }, "[Personalized Quote API] Response validation warning")
    }

    return NextResponse.json(responsePayload)
  } catch (error: unknown) {
    logger.error({ err: toSafeErrorMessage(error) }, "[Personalized Quote API] Error generating quote")
    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined
    if (isQuotaExceededError(status, error as Record<string, unknown>)) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "Quote generation quota or rate limit exceeded." },
        { status: 429 }
      )
    }
    return NextResponse.json({ quote: "Your fitness journey is unique, embrace every step!" })
  }
}
