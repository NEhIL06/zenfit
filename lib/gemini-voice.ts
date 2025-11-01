export async function generateVoiceNarration(text: string, voiceName = "Puck"): Promise<string> {
  try {
    const response = await fetch("/api/generate-voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, voiceName }),
    })

    const data = await response.json()
    const audioData = data.audioData

    if (!audioData) {
      throw new Error("No audio data received")
    }

    // Convert base64 to blob
    const byteCharacters = atob(audioData)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const audioBlob = new Blob([byteArray], { type: "audio/wav" })

    // Create blob URL
    return URL.createObjectURL(audioBlob)
  } catch (error) {
    console.error("Error generating voice narration:", error)
    throw error
  }
}
