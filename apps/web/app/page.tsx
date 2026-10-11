"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { generateMotivationalQuote } from "@/lib/gemini"
import {
  Dumbbell, Heart, TrendingUp, Bot, ArrowRight, Sparkles,
  ShieldCheck, Cpu, ChevronRight, Target, CheckCircle
} from "lucide-react"
import { Analytics } from "@vercel/analytics/next"

export default function Home() {
  const [quote, setQuote] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    generateMotivationalQuote()
      .then(setQuote)
      .catch(() => setQuote("Consistency is your greatest workout partner."))
      .finally(() => setLoading(false))
  }, [])

  const features = [
    {
      icon: <Dumbbell className="w-5 h-5" />,
      color: "text-emerald-400",
      bg: "bg-emerald-950 border-emerald-800/50",
      title: "Self-RAG Workouts",
      description: "LangGraph-orchestrated fitness plans tailored to your biometric metrics and goals.",
    },
    {
      icon: <Heart className="w-5 h-5" />,
      color: "text-teal-400",
      bg: "bg-teal-950 border-teal-800/50",
      title: "Macro Nutrition",
      description: "Custom meal plans generated dynamically based on your dietary preferences and caloric targets.",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-emerald-400",
      bg: "bg-emerald-950 border-emerald-800/50",
      title: "Milestone Tracking",
      description: "Log progress, compute BMI/BMR metrics, and track your transformation over time.",
    },
    {
      icon: <Bot className="w-5 h-5" />,
      color: "text-teal-400",
      bg: "bg-teal-950 border-teal-800/50",
      title: "Multimodal AI Coach",
      description: "Voice-guided audio advice, image pose checks, and fast Redis-cached responses.",
    },
  ]


  const benefits = [
    "Personalized 7-day workout split",
    "Macro-optimized meal targets",
    "Semantic exercise science search",
    "Real-time multimodal AI chat",
    "Progress milestone tracking",
    "httpOnly cookie authentication",
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans overflow-x-hidden">
      <Navbar />
      <Analytics />

      {/* ─── Hero ───────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-emerald-500/8 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-teal-500/6 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 space-y-8"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-4 py-2 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            AI Fitness Platform · Self-RAG Powered
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]">
            Your Fitness Journey,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">
              Intelligently Driven
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Precision workout programs, customized macro nutrition, and real-time AI guidance — all backed by vector similarity search and RAG retrieval.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2">
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 rounded-2xl font-black text-base shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition-all flex items-center gap-2 cursor-pointer"
              >
                Start Free · No Credit Card
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
            <Link href="/login">
              <button className="px-8 py-4 bg-slate-900/80 border border-slate-700 text-slate-200 rounded-2xl font-bold text-base hover:bg-slate-800 hover:text-white hover:border-slate-600 transition cursor-pointer">
                Sign In to Dashboard
              </button>
            </Link>
          </div>

          {/* Social proof line */}
          <p className="text-slate-500 text-sm">
            Generates your personalized plan in{" "}
            <span className="text-emerald-400 font-bold">under 15 seconds</span>
          </p>
        </motion.div>
      </section>

      {/* ─── AI Motivation Quote ─────────────────────────────────────── */}
      <section className="px-4 sm:px-6 max-w-4xl mx-auto pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-800/30 rounded-3xl p-6 sm:p-8 text-center backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.05),transparent_70%)] pointer-events-none" />
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3 flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> Daily AI Motivation
          </p>
          {loading ? (
            <div className="h-6 w-64 bg-slate-800 rounded-full animate-pulse mx-auto" />
          ) : (
            <p className="text-lg sm:text-xl italic font-light text-slate-200 leading-relaxed">
              &ldquo;{quote}&rdquo;
            </p>
          )}
        </motion.div>
      </section>



      {/* ─── Features Grid ───────────────────────────────────────────── */}
      <section id="features" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-14">
          <p className="text-xs font-bold tracking-widest uppercase text-emerald-400 flex items-center justify-center gap-2">
            <Cpu className="w-4 h-4" /> Capabilities
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Why Train With <span className="text-emerald-400">Zenletics</span>?
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Combining machine learning retrieval pipelines with human-centric physical coaching.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              whileHover={{ y: -4 }}
              className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-xl hover:border-emerald-500/30 transition-all group"
            >
              <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center mb-5 group-hover:scale-110 transition ${item.bg} ${item.color}`}>
                {item.icon}
              </div>
              <h3 className="text-base font-extrabold text-white mb-2 group-hover:text-emerald-400 transition">
                {item.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Benefits / What you get ─────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <p className="text-xs font-bold tracking-widest uppercase text-teal-400 flex items-center gap-2">
              <Target className="w-4 h-4" /> What You Get
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Everything you need to <span className="text-teal-400">level up</span>
            </h2>
            <p className="text-slate-400 leading-relaxed">
              A complete AI fitness operating system built on production-grade infrastructure — not a toy prototype.
            </p>
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 transition-all flex items-center gap-2 cursor-pointer mt-2"
              >
                Create Free Account <ChevronRight className="w-4 h-4" />
              </motion.button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {benefits.map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3.5"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-slate-200">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ───────────────────────────────────────────────── */}
      <section className="py-24 px-4 text-center max-w-4xl mx-auto space-y-8">
        <div className="space-y-5">
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Ready to Start Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
              AI Transformation?
            </span>
          </h2>
          <p className="text-slate-400 text-base max-w-lg mx-auto">
            Generate your personalized workout split and meal targets in under 15 seconds.
          </p>
        </div>
        <Link href="/signup">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="px-10 py-5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-lg rounded-2xl shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition inline-flex items-center gap-3 cursor-pointer"
          >
            Create Your Plan Now <ChevronRight className="w-5 h-5" />
          </motion.button>
        </Link>
      </section>

      <Footer />
    </div>
  )
}