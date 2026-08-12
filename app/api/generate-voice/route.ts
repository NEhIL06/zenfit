import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { isQuotaExceededError, toSafeErrorMessage } from "@/lib/error-handler"
import { GenerateVoiceRequestSchema, GenerateVoiceResponseSchema, validateRequest, validateResponse } from "@/lib/schemas"
import { requireAuthUser } from "@/lib/api-security"
import { checkRateLimit } from "@/lib/rate-limiter"
import { logger } from "@/lib/logger"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY

function pcmToWav(pcmData: Buffer): Buffer {
  const sampleRate = 24000
  const bitsPerSample = 16
  const numChannels = 1
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = pcmData.length

  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write("data", 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmData])
}

const GEMINI_TO_POLLINATIONS_VOICE: Record<string, string> = {
  Puck: "nova",
  Charon: "echo",
  Kore: "shimmer",
  Fenrir: "onyx",
  Aoede: "coral",
}

async function generateVoiceWithPollinations(
  text: string,
  geminiVoiceName: string
): Promise<string> {
  const voice = GEMINI_TO_POLLINATIONS_VOICE[geminiVoiceName] || "nova"
  const maxLength = 800
  const truncated = text.substring(0, maxLength)
  const encoded = encodeURIComponent(truncated)

  const url = `https://gen.pollinations.ai/audio/${encoded}?voice=${voice}&model=elevenlabs`

  const headers: Record<string, string> = {}
  if (POLLINATIONS_API_KEY) {
    headers["Authorization"] = `Bearer ${POLLINATIONS_API_KEY}`
  }

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })

  if (!res.ok) {
    throw new Error(`Pollinations TTS failed: ${res.status} ${res.statusText}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer).toString("base64")
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthUser(request)
    if (!auth.ok) return auth.response

    const body = await request.json()

    // 1. Zod Request Validation
    const validation = validateRequest(GenerateVoiceRequestSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { text } = validation.data
    const voiceName = validation.data.voiceName || validation.data.voice || "Puck"
    const rateLimit = await checkRateLimit(`voice_${auth.user.userId}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "Voice generation rate limit exceeded. Please wait a minute." },
        { status: 429 }
      )
    }

    // 2. Gemini Primary TTS Path
    if (GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
        const textToProcess = text.substring(0, 1000)

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName },
              },
            },
          },
          contents: [{
            parts: [{ text: `Read the following fitness information in an encouraging and motivational tone: ${textToProcess}` }]
          }],
        })

        const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
        if (data) {
          const pcmBuffer = Buffer.from(data, "base64")
          const wavBuffer = pcmToWav(pcmBuffer)
          const audioBase64 = wavBuffer.toString("base64")
          const responsePayload = { audioData: audioBase64, format: "wav" }
          
          const resValidation = validateResponse(GenerateVoiceResponseSchema, responsePayload)
          if (!resValidation.success) {
            logger.warn({ issues: resValidation.error }, "[generate-voice] Response validation warning")
          }

          return NextResponse.json(responsePayload)
        }
      } catch (e: unknown) {
        logger.warn({ err: toSafeErrorMessage(e) }, "[generate-voice] Gemini TTS failed, using Pollinations fallback")
      }
    }

    // 3. Pollinations Fallback Path
    const mp3Base64 = await generateVoiceWithPollinations(text, voiceName)
    const responsePayload = { audioData: mp3Base64, format: "mp3" }

    const resValidation = validateResponse(GenerateVoiceResponseSchema, responsePayload)
    if (!resValidation.success) {
      logger.warn({ issues: resValidation.error }, "[generate-voice] Response validation warning")
    }

    return NextResponse.json(responsePayload)

  } catch (error: unknown) {
    logger.error({ err: toSafeErrorMessage(error) }, "[generate-voice] Error")
    const status = typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined
    if (isQuotaExceededError(status, error as Record<string, unknown>)) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: "Voice generation API quota or rate limit exceeded. Please try again later.",
        },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "Failed to generate voice" }, { status: 500 })
  }
}
