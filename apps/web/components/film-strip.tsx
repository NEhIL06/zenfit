"use client"

import { motion } from "framer-motion"
import { Camera, ArrowUpRight } from "lucide-react"

interface PhotoItem {
  id: number
  title: string
  category: string
  imageUrl: string
}

const photos: PhotoItem[] = [
  {
    id: 1,
    title: "Strength & Form Analytics",
    category: "AI Pose & Form Check",
    imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800",
  },
  {
    id: 2,
    title: "Tailored Macro Nutrition",
    category: "RAG Diet Synthesis",
    imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=800",
  },
  {
    id: 3,
    title: "Hypertrophy Workouts",
    category: "Custom Plan Engine",
    imageUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=800",
  },
  {
    id: 4,
    title: "Endurance & Cardio Track",
    category: "Progress Feed",
    imageUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800",
  },
  {
    id: 5,
    title: "Calisthenics & Agility",
    category: "Bodyweight Routine",
    imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=800",
  },
  {
    id: 6,
    title: "Realtime Voice Coach",
    category: "Multimodal AI",
    imageUrl: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=800",
  },
]

export default function FilmStrip() {
  return (
    <div className="w-full space-y-4 font-sans">
      <div className="flex items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Moments on Film • AI Fitness Showcase
          </span>
        </div>
        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-3 py-1 rounded-full">
          6 Live Streams Active
        </span>
      </div>

      {/* Film Strip Gallery Horizontal Scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-4 sm:px-8 scrollbar-none snap-x snap-mandatory">
        {photos.map((photo) => (
          <motion.div
            key={photo.id}
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="flex-none w-64 sm:w-80 h-48 sm:h-56 relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl group snap-start cursor-pointer"
          >
            {/* Image */}
            <img
              src={photo.imageUrl}
              alt={photo.title}
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 opacity-70 group-hover:opacity-100 group-hover:scale-105"
            />

            {/* Dark Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

            {/* Category Tag */}
            <div className="absolute top-3 left-3 bg-slate-950/80 border border-slate-800 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              {photo.category}
            </div>

            {/* Caption & Arrow Indicator */}
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-white group-hover:text-emerald-300 transition">
                  {photo.title}
                </h4>
                <p className="text-[11px] text-slate-400 font-medium">Zenletics Interactive Snapshot</p>
              </div>

              <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 group-hover:bg-emerald-400 group-hover:text-slate-950 transition">
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
