"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { generateVoice } from "@/lib/storage"

interface VoicePlayerProps {
  content: string
  type: "workout" | "diet"
}

export default function VoicePlayer({ content, type }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const handlePlay = async () => {
    if (audioUrl) {
      setIsPlaying(!isPlaying)
      return
    }

    setIsLoading(true)
    try {
      const audioData = await generateVoice(content)
      if (audioData) {
        const audioUrl = `data:audio/mp3;base64,${audioData}`
        setAudioUrl(audioUrl)
        setIsPlaying(true)
      }
    } catch (error) {
      console.error("[v0] Failed to generate voice:", error)
      alert("Failed to generate voice narration")
    } finally {
      setIsLoading(false)
    }
  }

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

      {audioUrl && (
        <audio
          src={audioUrl}
          autoPlay={isPlaying}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  )
}
