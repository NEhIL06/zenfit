"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { generateVoice } from "@/lib/gemini-voice" 
import { useEffect } from "react"
interface VoicePlayerProps {
  content: string
  type: "workout" | "diet"
  onError?: (message: string) => void // Added onError prop
}

export default function VoicePlayer({ content, onError }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

  const handlePlay = async () => {
    // If audio is already loaded
    if (audioElement) {
      if (isPlaying) {
        audioElement.pause()
      } else {
        audioElement.play()
      }
      // State will be set by the audio's onplay/onpause events
      return
    }

    // If audio is not loaded, fetch it
    setIsLoading(true)
    try {
      const audioData = await generateVoice(content) // Fetches base64 WAV data
      if (audioData) {
        // Corrected: Use the correct MIME type 'audio/wav'
        const url = `data:audio/wav;base64,${audioData}`
        
        // Create new Audio object to play
        const audio = new Audio(url)
        audio.onplay = () => setIsPlaying(true)
        audio.onpause = () => setIsPlaying(false)
        audio.onended = () => setIsPlaying(false)
        
        setAudioElement(audio) // Save audio element
        audio.play() // Start playing
      }
    } catch (error) {
      const errorMsg = "[v0] Failed to generate voice";
      console.error(errorMsg, error);
      // Use onError callback instead of alert
      if (onError) {
        onError("Failed to generate voice narration. Please try again.");
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Clean up audio element on component unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause()
        setAudioElement(null)
      }
    }
  }, [audioElement])

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

