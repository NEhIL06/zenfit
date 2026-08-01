"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { generateImage } from "@/lib/storage"

interface ImageGalleryModalProps {
  type: "exercise" | "meal"
  name: string
  onClose: () => void
}

/**
 * Client-side sessionStorage key for caching image URLs.
 * Avoids repeat API calls within the same browser session.
 * Format: zenfit:img:{type}:{lowercased-name}
 */
function getSessionKey(name: string, type: string): string {
  return `zenfit:img:${type}:${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`
}

export default function ImageGalleryModal({ type, name, onClose }: ImageGalleryModalProps) {
  const [imageData, setImageData] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchImage = async () => {
      
      const sessionKey = getSessionKey(name, type)
      try {
        const cached = sessionStorage.getItem(sessionKey)
        if (cached) {
          console.log(`[ImageGalleryModal] sessionStorage HIT for "${name}"`)
          setImageData(cached)
          setLoading(false)
          return
        }
      } catch {
        // sessionStorage unavailable in some environments — continue to API
      }


      try {
        const data = await generateImage(name, type)

        if (data) {
          // Detect whether it's an HTTP URL or base64 data URI and handle both
          if (
            data.startsWith("http://") ||
            data.startsWith("https://") ||
            data.startsWith("data:")
          ) {
            setImageData(data)
          } else {
            setImageData(`data:image/png;base64,${data}`)
          }

          // Cache in sessionStorage for instant re-open within this session
          try {
            sessionStorage.setItem(sessionKey, data)
          } catch {
            // sessionStorage might be full — non-critical
          }
        }
      } catch (error) {
        console.error("[ImageGalleryModal] Failed to generate image:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchImage()
  }, [type, name])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-2xl w-full"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-black dark:text-white">{name}</h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-2xl font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="w-12 h-12 border-4 border-[#2D5C44] dark:border-[#10B981] border-t-transparent rounded-full"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">Generating image…</p>
          </div>
        ) : imageData ? (
          <div className="relative w-full h-96 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
            <img
              src={imageData}
              alt={name}
              className="w-full h-full object-contain"
              onError={(e) => {
                console.error("[ImageGalleryModal] Failed to render image src")
                // Clear bad sessionStorage entry so next open retries
                try {
                  sessionStorage.removeItem(getSessionKey(name, type))
                } catch {}
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-96 text-gray-600 dark:text-gray-400">
            Failed to generate image. Please try again.
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
