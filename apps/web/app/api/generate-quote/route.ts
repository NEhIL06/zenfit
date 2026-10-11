import { NextResponse } from "next/server"
import { getMistralClient } from "@/lib/mistral"
import { isQuotaExceededError, toSafeErrorMessage } from "@/lib/error-handler"
import { GenerateQuoteResponseSchema, validateResponse } from "@/lib/schemas"
import { requireAuthUser } from "@/lib/api-security"
import { checkRateLimit } from "@/lib/rate-limiter"
import { logger } from "@/lib/logger"

export async function GET(request: Request) {
  try {
    const auth = await requireAuthUser(request)
    if (!auth.ok) return auth.response

    const rateLimit = await checkRateLimit(`quote_${auth.user.userId}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "Quote generation rate limit exceeded. Please wait a minute." },
        { status: 429 }
      )
    }

    const ai = getMistralClient()
    const response = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: "Generate one short original motivational quote about fitness, discipline, or self-improvement (1-2 lines max). Return only the quote, no attribution.",
        }
      ],
    })

    const quote = response.choices[0]?.message?.content?.toString()?.trim() || "Your fitness journey starts today."
    const responsePayload = { quote, author: "ZenFit Coach" }

    // Zod Response Validation
    const resValidation = validateResponse(GenerateQuoteResponseSchema, responsePayload)
    if (!resValidation.success) {
      logger.warn({ issues: resValidation.error }, "[Quote API] Response validation warning")
    }

    return NextResponse.json(responsePayload)
  } catch (error: unknown) {
    logger.error({ err: toSafeErrorMessage(error) }, "[Quote API] Error generating quote")
    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined
    if (isQuotaExceededError(status, error as Record<string, unknown>)) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "API quote generation quota or rate limit exceeded." },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "Failed to generate quote" }, { status: 500 })
  }
}
