"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Eye, EyeOff, Dumbbell, ArrowRight, Lock, Mail, Sparkles, ChevronRight } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || data.message || "Invalid email or password")
        return
      }

      if (data.user?.id) {
        localStorage.setItem("current_user_id", data.user.id)
      }
      router.push("/dashboard")
    } catch {
      setError("Login failed. Please check your network and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex relative overflow-hidden font-sans">
      {/* Left Panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-gradient-to-br from-slate-900 to-slate-950 border-r border-slate-800/80 p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.12),transparent_60%)] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 relative z-10 w-max">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <Dumbbell className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">
            ZEN<span className="text-emerald-400">LETICS</span>
          </span>
        </Link>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-3 py-1.5 rounded-full">
              <Sparkles className="w-3 h-3" /> AI Fitness Platform
            </div>
            <h2 className="text-3xl font-black text-white leading-snug tracking-tight">
              Your personalized AI trainer awaits
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Precision workouts, macro nutrition plans, and real-time coaching powered by Self-RAG retrieval and ChromaDB vector search.
            </p>
          </div>

          <div className="space-y-3">
            {[
              "7-day AI generated workout splits",
              "Macro-optimized meal planning",
              "Multimodal AI trainer chat",
              "Progress milestone tracking",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-700/50 flex items-center justify-center shrink-0">
                  <ChevronRight className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-sm text-slate-300 font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600 relative z-10">
          © {new Date().getFullYear()} Zenletics AI · Built by Nehil Chandrakar
        </p>
      </div>

      {/* Right Panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-[140px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo */}
          <Link href="/" className="flex lg:hidden items-center gap-3 mb-8 w-max">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950">
              <Dumbbell className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              ZEN<span className="text-emerald-400">LETICS</span>
            </span>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-black text-white tracking-tight mb-1.5">Welcome back</h1>
            <p className="text-slate-400 text-sm">Sign in to access your AI fitness dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-800 bg-slate-900/80 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 text-sm transition"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-slate-800 bg-slate-900/80 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 text-sm transition"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-red-950/60 border border-red-800/60 text-red-300 rounded-xl text-sm flex items-center gap-2"
              >
                <span className="text-red-400">⚠</span> {error}
              </motion.div>
            )}

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              id="login-submit"
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 rounded-xl font-extrabold text-sm hover:from-emerald-400 hover:to-teal-300 disabled:opacity-50 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 group cursor-pointer mt-1"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>
                  Sign In to Zenletics
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </motion.button>
          </form>

          <p className="text-center mt-6 text-slate-500 text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-bold transition">
              Create Free Account
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
