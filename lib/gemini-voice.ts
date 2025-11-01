export async function generateVoice(text: string, voiceName = "Puck"): Promise<string> {
  try {
    const response = await fetch("/api/generate-voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, voiceName }),
    })

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate voice");
    }

    const data = await response.json()
    const audioData = data.audioData

    if (!audioData) {
      throw new Error("No audio data received")
    }

    // Return the base64-encoded WAV string directly
    return audioData
  } catch (error) {
    console.error("Error generating voice narration:", error)
    throw error
  }
}