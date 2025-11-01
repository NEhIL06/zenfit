"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { generateImage } from "@/lib/storage"

interface ImageGalleryModalProps {
  type: "exercise" | "meal"
  name: string
  onClose: () => void
}

export default function ImageGalleryModal({ type, name, onClose }: ImageGalleryModalProps) {
  const [imageData, setImageData] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const data = await generateImage(name, type)
        
        if (data) {
          // setImageData(`data:image/png;base64,${data}`) 
          /**
           * 
           * The above set image is to be done when you are using Nano Banana
           * As I have already used up my Gemini API quota, I have implemented a fallback to Pollinations AI
           * The images are not as good as Gemini's but they work for now.
           * 
           * If you want to use Gemini API, you can uncomment the above line and comment out the below line.
           * and comment this code -> setImageData(data)
           */
          setImageData(data)
        }
        
        
      } catch (error) {
        console.error("[v0] Failed to generate image:", error)
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
            className="text-2xl font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              className="w-12 h-12 border-4 border-[#2D5C44] dark:border-[#10B981] border-t-transparent rounded-full"
            />
          </div>
        ) : imageData ? (
          <div className="relative w-full h-96 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
            <img src={imageData || "/placeholder.svg"} alt={name} className="w-full h-full object-cover" />
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
