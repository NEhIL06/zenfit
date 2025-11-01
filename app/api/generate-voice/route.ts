import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

/**
 * Converts raw PCM audio data to a WAV file buffer.
 * The Gemini API returns 16-bit, single-channel, 24kHz PCM audio.
 */
function pcmToWav(pcmData: Buffer): Buffer {
  const sampleRate = 24000 // Gemini TTS default sample rate
  const bitsPerSample = 16
  const numChannels = 1
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = pcmData.length

  // WAV header buffer
  const header = Buffer.alloc(44)

  // RIFF chunk descriptor
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + dataSize, 4) // (FileSize - 8)
  header.write("WAVE", 8)

  // "fmt " sub-chunk
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16) // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20) // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)

  // "data" sub-chunk
  header.write("data", 36)
  header.writeUInt32LE(dataSize, 40)

  // Concatenate header and PCM data
  return Buffer.concat([header, pcmData])
}

export async function POST(request: Request) {
  try {
    const { text, voiceName = "Puck" } = await request.json()

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.")
    }

    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    })

    const maxLength = 1000
    const textToProcess = text.substring(0, maxLength)

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      // Corrected: 'config' is not a valid parameter, 'generationConfig' is.
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
      // Corrected: 'contents' should be an array of parts
      contents: [{
        parts: [{ text: `Read the following fitness information in an encouraging and motivational tone: ${textToProcess}` }]
      }],
    })

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data) {
      throw new Error("Audio data is undefined");
    }

    // 1. Decode the base64 PCM data
    const pcmBuffer = Buffer.from(data, 'base64');

    // 2. Convert the raw PCM buffer to a valid WAV buffer
    const wavBuffer = pcmToWav(pcmBuffer);

    // 3. Encode the valid WAV buffer back to base64 to send to client
    const audioBase64 = wavBuffer.toString('base64');

    // We don't need to save the file locally to return it
    // await saveWaveFile(fileName, audioBuffer); // This was undefined and not needed

    return NextResponse.json({ audioData: audioBase64 })
  } catch (error) {
    console.error("[v0] Error generating voice:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to generate voice";
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
