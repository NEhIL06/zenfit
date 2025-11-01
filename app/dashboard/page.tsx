"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { getCurrentUser, logout } from "@/lib/storage"
import { generatePersonalizedQuote } from "@/lib/gemini"
import DashboardTabs from "@/components/dashboard-tabs"
import type { User } from "@/types/user"

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [quote, setQuote] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.push("/login")
      return
    }
    setUser(currentUser)

    const fetchQuote = async () => {
      try {
        const personalizedQuote = await generatePersonalizedQuote(currentUser)
        setQuote(personalizedQuote)
      } catch (error) {
        console.error("[v0] Failed to fetch quote:", error)
        setQuote("Every workout brings you closer to your goals!")
      }
    }

    fetchQuote()
    setLoading(false)
  }, [router])

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-black dark:to-gray-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          className="w-12 h-12 border-4 border-[#2D5C44] dark:border-[#10B981] border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-black dark:to-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-black dark:text-white">
                Welcome, <span className="text-[#2D5C44] dark:text-[#10B981]">{user.name}</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">Your personalized fitness journey starts here</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-6 py-2 border-2 border-red-500 text-red-500 rounded-lg font-semibold hover:bg-red-500 hover:text-white transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {quote && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
        >
          <div className="bg-gradient-to-r from-[#2D5C44] to-[#1a3a2a] dark:from-[#10B981] dark:to-[#0a7a5e] text-white rounded-xl p-6 shadow-lg">
            <p className="text-lg italic font-light text-center">"{quote}"</p>
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <DashboardTabs user={user} onUserUpdate={setUser} />
      </main>
    </div>
  )
}
