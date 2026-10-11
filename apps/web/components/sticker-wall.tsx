"use client"

import { motion } from "framer-motion"

interface Sticker {
  text: string
  color: string
  textColor: string
  rotation: string
  border: string
}

const stickers: Sticker[] = [
  {
    text: "⚠️ SELF-RAG ACTIVE",
    color: "bg-amber-400",
    textColor: "text-slate-950",
    rotation: "-rotate-6",
    border: "border-amber-500",
  },
  {
    text: "Dev Mode ⚡",
    color: "bg-emerald-400",
    textColor: "text-slate-950",
    rotation: "rotate-3",
    border: "border-emerald-500",
  },
  {
    text: "🔒 httpOnly JWT Cookies",
    color: "bg-blue-500",
    textColor: "text-white",
    rotation: "-rotate-3",
    border: "border-blue-600",
  },
  {
    text: "# Cohere Reranker",
    color: "bg-purple-500",
    textColor: "text-white",
    rotation: "rotate-6",
    border: "border-purple-600",
  },
  {
    text: "✨ Chroma Vector DB",
    color: "bg-teal-400",
    textColor: "text-slate-950",
    rotation: "-rotate-2",
    border: "border-teal-500",
  },
  {
    text: "THINK OUTSIDE THE BOX",
    color: "bg-purple-400",
    textColor: "text-slate-950",
    rotation: "rotate-4",
    border: "border-purple-500",
  },
  {
    text: "Zero-Cost Router 🎯",
    color: "bg-rose-400",
    textColor: "text-slate-950",
    rotation: "-rotate-4",
    border: "border-rose-500",
  },
  {
    text: "70/70 Vitest Passed ✅",
    color: "bg-sky-400",
    textColor: "text-slate-950",
    rotation: "rotate-2",
    border: "border-sky-500",
  },
]

export default function StickerWall() {
  return (
    <div className="w-full py-8 overflow-hidden bg-slate-950/60 border-y border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 text-center mb-6">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          ENGINEERING LABELS & ARCHITECTURAL STICKERS
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 px-4 max-w-6xl mx-auto">
        {stickers.map((st, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.15, rotate: 0, zIndex: 20 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className={`px-4 py-2 rounded-xl shadow-xl font-black text-xs sm:text-sm tracking-tight border-2 ${st.rotation} ${st.color} ${st.textColor} ${st.border} cursor-grab active:cursor-grabbing transform transition-transform select-none`}
          >
            {st.text}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
