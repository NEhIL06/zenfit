"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { getCurrentUser, logout } from "@/lib/storage"
import { generatePersonalizedQuote } from "@/lib/gemini"
import DashboardTabs from "@/components/dashboard-tabs"
import { ThemeToggle } from "@/components/theme-toggle"
import type { User } from "@/types/user"
import Link from "next/link"
import { Dumbbell, LogOut, Sparkles, Flame, Target, Compass, Quote } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [quote, setQuote] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initDashboard = async () => {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        router.push("/login")
        return
      }
      setUser(currentUser)

      try {
        const personalizedQuote = await generatePersonalizedQuote(currentUser)
        setQuote(personalizedQuote)
      } catch (error) {
        console.error("[v0] Failed to fetch quote:", error)
        setQuote("Consistency is your greatest workout partner!")
      } finally {
        setLoading(false)
      }
    }

    initDashboard()
  }, [router])

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full shadow-lg shadow-emerald-500/20"
        />
        <p className="text-slate-400 font-bold text-sm tracking-wider uppercase animate-pulse">
          Loading Your Zenletics Dashboard...
        </p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 relative overflow-x-hidden">
      {/* Background Mesh Effects */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
                <Dumbbell className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">
                ZEN<span className="text-emerald-400">LETICS</span>
              </span>
            </Link>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl font-bold text-xs hover:border-red-500/50 hover:text-red-400 hover:bg-red-950/30 transition flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 relative z-10">
        {/* Welcome & Stats Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/40 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-3.5 py-1 rounded-full w-max mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Active Member Session
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">{user.name}</span>!
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Your AI fitness trainer and RAG retrieval pipeline are synced & ready.
              </p>
            </div>

            {/* Quick Stat Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-800/60 text-emerald-400">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Goal</p>
                  <p className="text-xs font-extrabold text-white truncate max-w-[90px] sm:max-w-[110px]">{user.fitnessGoal || "Weight Loss"}</p>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-950 border border-teal-800/60 text-teal-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Level</p>
                  <p className="text-xs font-extrabold text-white truncate max-w-[90px] sm:max-w-[110px]">{user.fitnessLevel || "Beginner"}</p>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-800/60 text-emerald-400">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Location</p>
                  <p className="text-xs font-extrabold text-white truncate max-w-[90px] sm:max-w-[110px]">{user.workoutLocation || "Home"}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dynamic Motivation Quote Banner */}
        {quote && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border border-emerald-800/40 rounded-2xl p-5 shadow-lg shadow-emerald-950/20 flex items-center gap-4"
          >
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 hidden sm:block">
              <Quote className="w-6 h-6" />
            </div>
            <div>
              <p className="text-emerald-300 font-bold text-xs uppercase tracking-widest mb-0.5">Daily AI Motivation</p>
              <p className="text-slate-200 text-sm italic font-medium">&quot;{quote}&quot;</p>
            </div>
          </motion.div>
        )}

        {/* Dashboard Tabs Container */}
        <DashboardTabs user={user} onUserUpdate={setUser} />
      </main>
    </div>
  )
}

