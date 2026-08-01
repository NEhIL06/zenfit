import { handleApiResponse, showQuotaExceededToast } from "./error-handler"

export async function generateVoice(text: string, voiceName = "Puck"): Promise<string> {
  try {
    const response = await fetch("/api/generate-voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, voiceName }),
    })

    const { data, isQuotaError, error } = await handleApiResponse(response, "voice narration")
    if (isQuotaError) {
      throw new Error(data?.message || "Voice narration quota exceeded")
    }

    if (!response.ok || error) {
      throw new Error(error || "Failed to generate voice narration")
    }

    const audioData = data?.audioData
    if (!audioData) {
      throw new Error("No audio data received from service")
    }

    // Return the base64-encoded WAV string directly
    return audioData
  } catch (error: any) {
    console.error("Error generating voice narration:", error)
    if (!error?.message?.includes("quota")) {
      showQuotaExceededToast(error?.message || "Failed to generate voice narration", "voice narration")
    }
    throw error
  }
}