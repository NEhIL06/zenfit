import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY

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
 * Converts raw PCM audio data to a WAV file buffer.
 * The Gemini API returns 16-bit, single-channel, 24kHz PCM audio.
 */
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

/**
 * Fallback: Pollinations ElevenLabs-backed TTS.
 * Returns base64-encoded MP3 audio data.
 * Voice mapping: Gemini "Puck" → Pollinations "nova" (energetic male voice)
 */
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
  const mp3Base64 = Buffer.from(arrayBuffer).toString("base64")
  return mp3Base64
}

export async function POST(request: Request) {
  try {
    const { text, voiceName = "Puck" } = await request.json()

    
    
    if (GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

        const maxLength = 1000
        const textToProcess = text.substring(0, maxLength)

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
          return NextResponse.json({ audioData: audioBase64, format: "wav" })
        }
      } catch (e: any) {
        console.warn("[generate-voice] Gemini TTS failed, trying Pollinations fallback:", e?.message)
        if (isQuotaError(e)) {
          console.log("[generate-voice] Gemini quota exhausted — falling back to Pollinations ElevenLabs TTS")
        }
        // Fall through to Pollinations regardless of error type
      }
    }

    
    console.log("[generate-voice] Using Pollinations TTS fallback")
    const mp3Base64 = await generateVoiceWithPollinations(text, voiceName)
    return NextResponse.json({ audioData: mp3Base64, format: "mp3" })

  } catch (error: any) {
    console.error("[generate-voice] Error:", error)
    if (isQuotaError(error)) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: "Voice generation API quota or rate limit exceeded. Please try again later.",
        },
        { status: 429 }
      )
    }
    const errorMessage = error instanceof Error ? error.message : "Failed to generate voice"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
