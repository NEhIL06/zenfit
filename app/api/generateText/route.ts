import { NextResponse } from "next/server"
import { getMistralClient } from "@/lib/mistral"
import { isQuotaExceededError, toSafeErrorMessage } from "@/lib/error-handler"
import { GenerateTextRequestSchema, GenerateTextResponseSchema, validateRequest, validateResponse } from "@/lib/schemas"
import { requireAuthUser } from "@/lib/api-security"
import { checkRateLimit } from "@/lib/rate-limiter"
import { logger } from "@/lib/logger"

export async function POST(request: Request) {
  try {
    const auth = await requireAuthUser(request)
    if (!auth.ok) return auth.response

    const body = await request.json()

    const validation = validateRequest(GenerateTextRequestSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { prompt, maxTokens } = validation.data
    const rateLimit = await checkRateLimit(`text_${auth.user.userId}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "Text generation rate limit exceeded. Please wait a minute." },
        { status: 429 }
      )
    }

    const ai = getMistralClient()
    const response = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      maxTokens: maxTokens || 512,
    })

    const text = response.choices[0]?.message?.content?.toString() || ""
    const responsePayload = { text }

    const resValidation = validateResponse(GenerateTextResponseSchema, responsePayload)
    if (!resValidation.success) {
      logger.warn({ issues: resValidation.error }, "[generateText API] Response validation warning")
    }

    return NextResponse.json(responsePayload)

  } catch (err: unknown) {
    logger.error({ err: toSafeErrorMessage(err) }, "[generateText API] Error")
    const status = typeof err === "object" && err !== null && "status" in err
      ? (err as { status?: number }).status
      : undefined
    if (isQuotaExceededError(status, err as Record<string, unknown>)) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "API text generation rate limit or quota exceeded." },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "Failed to generate text", text: "" }, { status: 500 })
  }
}
