"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { generateVoice } from "@/lib/gemini-voice"
import { showQuotaExceededToast } from "@/lib/error-handler"

interface VoicePlayerProps {
  content: string
  type: "workout" | "diet"
  onError?: (message: string) => void
}

/**
 * Build a sessionStorage key for caching voice audio.
 * Keyed on a simple hash of the content string (length + first/last chars)
 * so that the same TTS text reuses cached audio within the session.
 * We use a lightweight fingerprint instead of full SHA-256 to keep this
 * client-only (crypto is Node-only).
 */
function getVoiceSessionKey(text: string): string {
  const len = text.length
  const head = text.substring(0, 20).replace(/[^a-z0-9]/gi, "")
  const tail = text.substring(text.length - 20).replace(/[^a-z0-9]/gi, "")
  return `zenfit:voice:${len}:${head}:${tail}`
}

export default function VoicePlayer({ content, onError }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlay = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      return
    }

    setIsLoading(true)
    try {
      let audioBase64: string | null = null
      let format = "wav"

      const sessionKey = getVoiceSessionKey(content)
      try {
        const cached = sessionStorage.getItem(sessionKey)
        if (cached) {
          console.log("[VoicePlayer] sessionStorage HIT — using cached audio")
          const parsed = JSON.parse(cached)
          audioBase64 = parsed.data
          format = parsed.format || "wav"
        }
      } catch {
        // sessionStorage unavailable — continue to API
      }


      if (!audioBase64) {
        audioBase64 = await generateVoice(content)

        if (audioBase64) {
          
          // Default to wav (Gemini) but mp3 if Pollinations was used
          try {
            sessionStorage.setItem(
              sessionKey,
              JSON.stringify({ data: audioBase64, format })
            )
          } catch {
            // sessionStorage full — non-critical, just skip caching
          }
        }
      }

      if (audioBase64) {
        const mimeType = format === "mp3" ? "audio/mpeg" : "audio/wav"
        const url = `data:${mimeType};base64,${audioBase64}`
        const audio = new Audio(url)

        audio.onplay = () => setIsPlaying(true)
        audio.onpause = () => setIsPlaying(false)
        audio.onended = () => setIsPlaying(false)
        audio.onerror = () => {
          // Try mp3 mime as fallback if wav fails
          console.warn("[VoicePlayer] Audio playback error — trying alternate MIME type")
          const alt = new Audio(`data:audio/mpeg;base64,${audioBase64}`)
          alt.onplay = () => setIsPlaying(true)
          alt.onpause = () => setIsPlaying(false)
          alt.onended = () => setIsPlaying(false)
          audioRef.current = alt
          alt.play().catch((e) => console.error("[VoicePlayer] Fallback also failed:", e))
        }

        audioRef.current = audio
        audio.play()
      }
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to generate voice narration"
      console.error("[VoicePlayer] Error:", error)

      if (errorMsg.includes("quota") || errorMsg.includes("429")) {
        showQuotaExceededToast(errorMsg, "Voice Narration")
      } else if (onError) {
        onError("Failed to generate voice narration. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <motion.button
        onClick={handlePlay}
        disabled={isLoading}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#0a9370] disabled:opacity-50"
      >
        <span>{isLoading ? "Loading..." : isPlaying ? "Stop" : "Play"}</span>
        <span>{isLoading ? "⏳" : isPlaying ? "⏹️" : "🎧"}</span>
      </motion.button>
    </div>
  )
}
