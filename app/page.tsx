"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { generateMotivationalQuote } from "@/lib/gemini"

export default function Home() {
  const [quote, setQuote] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchQuote() {
      try {
        const generatedQuote = await generateMotivationalQuote()
        setQuote(generatedQuote)
      } catch (error) {
        console.error("Failed to generate quote:", error)
        setQuote("The only bad workout is the one that did not happen.")
      } finally {
        setLoading(false)
      }
    }
    fetchQuote()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-black dark:to-gray-900">
      <Navbar />

      <main className="flex flex-col items-center justify-center px-4 pt-20 pb-16">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold mb-8 text-black dark:text-white"
          >
            <span className="text-[#2D5C44] dark:text-[#10B981]">AI Fitness</span> Coach
          </motion.h1>

          {/* Motivational Quote */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="bg-[#2D5C44] dark:bg-[#1a3a2a] text-white rounded-2xl p-8 md:p-12 mb-12 shadow-lg"
          >
            {loading ? (
              <p className="text-lg md:text-2xl italic">Loading your inspiration...</p>
            ) : (
              <p className="text-lg md:text-2xl italic font-light">{quote}</p>
            )}
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto"
          >
            Get personalized workout and diet plans powered by AI. Transform your fitness journey with intelligent
            coaching, voice guidance, and milestone tracking.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link href="/signup">
              <button className="px-8 py-4 bg-[#10B981] text-white rounded-lg font-semibold text-lg hover:bg-[#0a9370] shadow-lg">
                Start Your Fitness Journey
              </button>
            </Link>
            <Link href="/login">
              <button className="px-8 py-4 border-2 border-[#2D5C44] dark:border-[#10B981] text-[#2D5C44] dark:text-[#10B981] rounded-lg font-semibold text-lg hover:bg-[#2D5C44] hover:text-white dark:hover:bg-[#10B981] dark:hover:text-black">
                Sign In
              </button>
            </Link>
          </motion.div>
        </motion.div>
      </main>

      <Footer />
    </div>
  )
}
