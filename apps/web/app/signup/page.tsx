"use client"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import SignupForm from "@/components/signup-form"
import Link from "next/link"
import { Dumbbell, Sparkles } from "lucide-react"

export default function SignupPage() {
  const router = useRouter()

  const handleSignupComplete = () => {
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 relative overflow-hidden font-sans">
      {/* Background Mesh Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-3 group mb-4 transition-transform hover:scale-105"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
              <Dumbbell className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="text-3xl font-black tracking-tight text-white">
              ZEN<span className="text-emerald-400">LETICS</span>
            </span>
          </Link>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-widest uppercase text-emerald-400/90 bg-emerald-950/60 border border-emerald-800/40 rounded-full py-1.5 px-4 w-max mx-auto mb-3">
            <Sparkles className="w-3.5 h-3.5" /> AI Fitness Engine Setup
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Build Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Custom Profile</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg mt-2 max-w-lg mx-auto">
            Our Self-RAG agent generates personalized workout routines and targeted diet macros in seconds.
          </p>
        </motion.div>

        <SignupForm onComplete={handleSignupComplete} />
      </div>
    </div>
  )
}

