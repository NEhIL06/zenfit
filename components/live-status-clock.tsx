"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, ShieldCheck, Zap } from "lucide-react"

export default function LiveStatusClock() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!time) return null

  const seconds = time.getSeconds()
  const minutes = time.getMinutes()
  const hours = time.getHours() % 12

  // Angles for clock hands
  const secondDeg = (seconds / 60) * 360
  const minuteDeg = ((minutes + seconds / 60) / 60) * 360
  const hourDeg = ((hours + minutes / 60) / 12) * 360

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden text-slate-100 flex flex-col md:flex-row items-center justify-between gap-8">
      {/* Background Accent Mesh */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Left Info Column */}
      <div className="space-y-4 max-w-md text-left z-10">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-widest w-max">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>AI Engine Operational • 24/7 Sync</span>
        </div>

        <div>
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Zenletics <span className="text-emerald-400">Live Agent Node</span>
          </h3>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
            Real-time Self-RAG retrieval active. Local system synchronized with vector stores and secure cookie authentication.
          </p>
        </div>

        {/* System Badges */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300">
            <Zap className="w-3.5 h-3.5 text-emerald-400" /> LangGraph RAG
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> httpOnly JWT
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Chroma Vector DB
          </span>
        </div>
      </div>

      {/* Right Column: Clock & Time display */}
      <div className="flex flex-col items-center gap-3 z-10">
        {/* SVG Analog Clock */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-slate-900/90 border-2 border-slate-800 flex items-center justify-center shadow-inner shadow-black/80">
          <svg className="w-full h-full p-2" viewBox="0 0 100 100">
            {/* Clock Ticks */}
            {[...Array(12)].map((_, i) => (
              <line
                key={i}
                x1="50"
                y1="8"
                x2="50"
                y2="13"
                stroke={i % 3 === 0 ? "#10b981" : "#475569"}
                strokeWidth={i % 3 === 0 ? "2.5" : "1.5"}
                transform={`rotate(${i * 30} 50 50)`}
              />
            ))}

            {/* Hour Hand */}
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="28"
              stroke="#f8fafc"
              strokeWidth="4"
              strokeLinecap="round"
              transform={`rotate(${hourDeg} 50 50)`}
            />

            {/* Minute Hand */}
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="20"
              stroke="#94a3b8"
              strokeWidth="2.5"
              strokeLinecap="round"
              transform={`rotate(${minuteDeg} 50 50)`}
            />

            {/* Second Hand (Emerald Green) */}
            <line
              x1="50"
              y1="55"
              x2="50"
              y2="15"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${secondDeg} 50 50)`}
            />

            {/* Center Cap */}
            <circle cx="50" cy="50" r="3.5" fill="#10b981" />
          </svg>
        </div>

        {/* Digital Time Stamp */}
        <div className="text-center">
          <p className="text-lg font-black tracking-widest text-emerald-400 font-mono">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            System Server Time (UTC/Local)
          </p>
        </div>
      </div>
    </div>
  )
}
