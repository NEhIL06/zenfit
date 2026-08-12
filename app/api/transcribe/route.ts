import { NextRequest, NextResponse } from 'next/server'
import { getMultimodalProcessor } from '@/lib/ai-trainer/multimodal'
import { isQuotaExceededError, toSafeErrorMessage } from '@/lib/error-handler'
import { TranscribeResponseSchema, validateResponse } from '@/lib/schemas'
import { requireAuthUser } from '@/lib/api-security'
import { checkRateLimit } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

const MAX_AUDIO_BYTES = 5 * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/webm',
  'audio/mp4',
])

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthUser(req)
    if (!auth.ok) return auth.response

    const rateLimit = await checkRateLimit(`transcribe_${auth.user.userId}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'QUOTA_EXCEEDED', message: 'Audio transcription rate limit exceeded. Please wait a minute.' },
        { status: 429 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported audio type' }, { status: 415 })
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio file exceeds the 5 MB size limit' }, { status: 413 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const mimeType = file.type || 'audio/wav'

    const processor = getMultimodalProcessor()
    const text = await processor.transcribeAudio(base64, mimeType)

    const responsePayload = { text }

    const resValidation = validateResponse(TranscribeResponseSchema, responsePayload)
    if (!resValidation.success) {
      logger.warn({ issues: resValidation.error }, '[Transcribe API] Response validation warning')
    }

    return NextResponse.json(responsePayload)
  } catch (error: unknown) {
    logger.error({ err: toSafeErrorMessage(error) }, '[Transcribe API] Error')
    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined
    if (isQuotaExceededError(status, error as Record<string, unknown>)) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: 'Audio transcription API quota or rate limit exceeded. Please try again later.',
        },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 })
  }
}
