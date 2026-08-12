"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import FilmStrip from "@/components/film-strip"
import StickerWall from "@/components/sticker-wall"
import LiveStatusClock from "@/components/live-status-clock"
import { generateMotivationalQuote } from "@/lib/gemini"
import { Dumbbell, Heart, TrendingUp, Users, ArrowRight, Sparkles, ShieldCheck, Cpu, Database, ChevronRight } from "lucide-react"
import { Analytics } from "@vercel/analytics/next"

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
        setQuote("Consistency is your greatest workout partner!")
      } finally {
        setLoading(false)
      }
    }
    fetchQuote()
  }, [])

  const features = [
    {
      icon: <Dumbbell className="w-6 h-6 text-emerald-400" />,
      title: "Self-RAG Workouts",
      description: "LangGraph-orchestrated fitness plans tailored to your biometric metrics and goals."
    },
    {
      icon: <Heart className="w-6 h-6 text-teal-400" />,
      title: "Targeted Macros & Diet",
      description: "Custom nutrition routines generated dynamically based on dietary preferences."
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-emerald-400" />,
      title: "Milestone Tracking",
      description: "Log progress, compute BMI/BMR metrics, and track transformation over time."
    },
    {
      icon: <Users className="w-6 h-6 text-teal-400" />,
      title: "Multimodal AI Coach",
      description: "Voice-guided audio advice, image pose checks, and deterministic Redis caching."
    }
  ]

  const architectureHighlights = [
    {
      title: "ChromaDB Vector Store",
      desc: "Dense semantic retrieval with bge-base-en-v1.5 embeddings for exercise science papers.",
      tag: "Vector Search"
    },
    {
      title: "Cohere Reranking",
      desc: "Cross-encoder scoring ensures only top relevant passages feed into the LLM context window.",
      tag: "Precision Rank"
    },
    {
      title: "Zero-Cost Intent Router",
      desc: "Instant regex filter bypasses expensive LLM calls for general greetings and simple queries.",
      tag: "Latency Saver"
    },
    {
      title: "httpOnly JWT Security",
      desc: "Bcrypt hashed credentials and encrypted HTTP cookies eliminate vulnerable localStorage sessions.",
      tag: "Production Auth"
    }
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden">
      <Navbar />
      <Analytics />

      {/* Top Film Strip Gallery ("Moments on Film" - Design Inspiration 1) */}
      <div className="pt-24 pb-4 bg-slate-950/90 border-b border-slate-900">
        <FilmStrip />
      </div>

      {/* Hero Section */}
      <section className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Ambient Glow background */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 space-y-8"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-4 py-2 rounded-full shadow-lg shadow-emerald-950/40">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>AI Fitness Architecture • Self-RAG Powered</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-tight">
            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">Fitness Journey</span>
            <br />
            Driven By <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-emerald-400">Intelligent RAG</span>
          </h1>

          <p className="text-slate-400 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed font-normal">
            Precision workout programs, customized macro nutrition, and real-time multimodal AI guidance backed by vector similarity search.
          </p>

          {/* Dynamic Motivation Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-3xl mx-auto bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl"
          >
            <div className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 mb-2 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" /> Daily AI Motivation
            </div>
            {loading ? (
              <p className="text-slate-400 text-sm animate-pulse">Generating inspiration...</p>
            ) : (
              <p className="text-lg sm:text-xl italic font-serif text-slate-200 leading-relaxed">
                &ldquo;{quote}&rdquo;
              </p>
            )}
          </motion.div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 rounded-2xl font-black text-base shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition flex items-center gap-2 cursor-pointer"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>

            <Link href="/login">
              <button className="px-8 py-4 bg-slate-900 border border-slate-800 text-slate-200 rounded-2xl font-bold text-base hover:bg-slate-800 hover:text-white transition cursor-pointer">
                Sign In to Dashboard
              </button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Live Analog Clock & Operational Status Component (Design Inspiration 1) */}
      <section className="py-8 px-4 sm:px-6 max-w-7xl mx-auto">
        <LiveStatusClock />
      </section>

      {/* Interactive Sticker Wall Ticker (Design Inspiration 2) */}
      <StickerWall />

      {/* Core Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase text-emerald-400">
            <Cpu className="w-4 h-4" /> Capabilities
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Why Train With <span className="text-emerald-400">Zenletics</span>?
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto">
            Combining machine learning retrieval pipelines with human-centric physical coaching.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((item, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -6 }}
              className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl hover:border-emerald-500/40 transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                {item.icon}
              </div>
              <h3 className="text-lg font-extrabold text-white mb-2 group-hover:text-emerald-400 transition">
                {item.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Deep Architecture Grid */}
      <section id="architecture" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto bg-slate-900/40 border border-slate-800/80 rounded-3xl space-y-12 my-12">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase text-teal-400">
            <Database className="w-4 h-4" /> Technical Blueprint
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Verified <span className="text-teal-400">RAG Engine</span> Specs
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            Engineered with strict non-diplomatic benchmarks and modular multi-provider fallbacks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {architectureHighlights.map((arch, index) => (
            <div key={index} className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-950 border border-emerald-800/50 text-emerald-400 px-2.5 py-1 rounded-md">
                {arch.tag}
              </span>
              <h4 className="text-base font-extrabold text-white">{arch.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{arch.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final Call To Action */}
      <section className="py-20 px-4 text-center max-w-4xl mx-auto space-y-6">
        <h2 className="text-3xl sm:text-5xl font-black text-white">
          Ready to Start Your <span className="text-emerald-400">AI Transformation</span>?
        </h2>
        <p className="text-slate-400 text-base max-w-lg mx-auto">
          Generate your personalized workout split and meal targets in under 15 seconds.
        </p>
        <Link href="/signup">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
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