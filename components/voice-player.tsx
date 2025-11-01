"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { generateVoice } from "@/lib/gemini-voice" 
import { useEffect } from "react"
interface VoicePlayerProps {
  content: string
  type: "workout" | "diet"
  onError?: (message: string) => void 
}

export default function VoicePlayer({ content, onError }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

  const handlePlay = async () => {
    
    if (audioElement) {
      if (isPlaying) {
        audioElement.pause()
      } else {
        audioElement.play()
      }
      
      return
    }

    
    setIsLoading(true)
    try {
      const audioData = await generateVoice(content)
      if (audioData) {
        
        const url = `data:audio/wav;base64,${audioData}`
        
        
        const audio = new Audio(url)
        audio.onplay = () => setIsPlaying(true)
        audio.onpause = () => setIsPlaying(false)
        audio.onended = () => setIsPlaying(false)
        
        setAudioElement(audio) 
        audio.play() 
      }
    } catch (error) {
      const errorMsg = "[v0] Failed to generate voice";
      console.error(errorMsg, error);
      
      if (onError) {
        onError("Failed to generate voice narration. Please try again.");
      }
    } finally {
      setIsLoading(false)
    }
  }

  
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

