"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { generateImage } from "@/lib/storage"
import { getCuratedImageUrl } from "@/lib/image-resolver"

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
function getSessionKey(name: string, type: "exercise" | "meal"): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "")
  return `zenfit:img:${type}:${normalized}`
}

function formatImageSrc(data: string): string {
  if (!data) return ""
  if (data.startsWith("http://") || data.startsWith("https://") || data.startsWith("data:")) {
    return data
  }
  return `data:image/png;base64,${data}`
}

export default function ImageGalleryModal({ type, name, onClose }: ImageGalleryModalProps) {
  const [imageData, setImageData] = useState<string>("")
  const [loading, setLoading] = useState(true)

  const fallbackUrl = getCuratedImageUrl(name, type)

  useEffect(() => {
    const fetchImage = async () => {
      const sessionKey = getSessionKey(name, type)
      try {
        const cached = sessionStorage.getItem(sessionKey)
        if (cached) {
          console.log(`[ImageGalleryModal] sessionStorage HIT for "${name}"`)
          setImageData(formatImageSrc(cached))
          setLoading(false)
          return
        }
      } catch {
        // sessionStorage unavailable in some environments — continue to API
      }

      try {
        const data = await generateImage(name, type)

        if (data) {
          const formatted = formatImageSrc(data)
          setImageData(formatted)

          // Cache formatted string in sessionStorage
          try {
            sessionStorage.setItem(sessionKey, formatted)
          } catch {
            // sessionStorage full — non-critical
          }
        } else {
          setImageData(fallbackUrl)
        }
      } catch (error) {
        console.error("[ImageGalleryModal] Failed to generate image, using fallback:", error)
        setImageData(fallbackUrl)
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-4"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{name}</h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition flex items-center justify-center text-lg font-bold cursor-pointer"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-80 sm:h-96 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
              className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full shadow-lg shadow-emerald-500/20"
            />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider animate-pulse">Generating AI Visual Snapshot…</p>
          </div>
        ) : imageData ? (
          <div className="relative w-full h-80 sm:h-96 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800">
            <img
              src={imageData}
              alt={name}
              className="w-full h-full object-cover"
              onError={() => {
                console.warn("[ImageGalleryModal] Failed to render image src, switching to fallback")
                try {
                  sessionStorage.removeItem(getSessionKey(name, type))
                } catch {}
                setImageData(fallbackUrl)
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-80 sm:h-96 text-slate-400 font-medium">
            Failed to generate image. Please try again.
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
