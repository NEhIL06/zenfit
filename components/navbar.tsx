"use client"

import { useState } from "react"
import Link from "next/link"
import { ThemeToggle } from "./theme-toggle"
import { Dumbbell, Menu, X, ArrowRight, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 font-black text-2xl tracking-tight text-white hover:scale-105 transition-transform duration-300 group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 group-hover:rotate-12 transition-transform">
              <Dumbbell className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span>
              ZEN<span className="text-emerald-400">LETICS</span>
            </span>
          </Link>

          {/* Desktop Nav Actions */}
          <div className="hidden md:flex gap-6 items-center">
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-slate-400 bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>AI Agent Platform</span>
            </div>

            <ThemeToggle />

            <Link
              href="/login"
              className="text-slate-300 hover:text-emerald-400 font-bold text-sm transition-colors px-3 py-2"
            >
              Sign In
            </Link>

            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 rounded-xl font-extrabold text-sm shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 transition-all flex items-center gap-2 cursor-pointer"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-slate-800 bg-slate-950/95 backdrop-blur-2xl px-6 py-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-3.5 py-1.5 rounded-full w-max">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Fitness Engine</span>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center py-3 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 font-bold text-base hover:text-emerald-400 transition"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-extrabold text-base shadow-lg shadow-emerald-500/25"
              >
                Start Free Trial
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}