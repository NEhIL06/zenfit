"use client"

import Link from "next/link"
import { Dumbbell, ArrowUpRight, Mail, Github, Globe } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-100 border-t border-slate-800/80 font-sans pt-16 pb-12 relative overflow-hidden">
      {/* Background Mesh */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-3 group w-max">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
                <Dumbbell className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                ZEN<span className="text-emerald-400">LETICS</span>
              </span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
              Next-generation AI fitness coach powered by LangGraph Self-RAG pipelines, ChromaDB vector databases, and secure JWT authentication.
            </p>
          </div>

          {/* Quick Navigation Links */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 mb-4">
              Platform Features
            </h4>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-300">
              <li>
                <Link href="/#features" className="hover:text-emerald-400 transition">
                  Self-RAG Workouts
                </Link>
              </li>
              <li>
                <Link href="/#architecture" className="hover:text-emerald-400 transition">
                  Vector Retrieval Architecture
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-emerald-400 transition">
                  AI Trainer Chat Window
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-emerald-400 transition">
                  Custom Macro & Meal Plans
                </Link>
              </li>
            </ul>
          </div>

          {/* User Account Routes */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 mb-4">
              Account & Portal
            </h4>
            <ul className="space-y-2.5 text-xs font-semibold text-slate-300">
              <li>
                <Link href="/login" className="hover:text-emerald-400 transition">
                  Sign In to Dashboard
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-emerald-400 transition">
                  Create New Profile
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-emerald-400 transition">
                  Member Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Direct External & Contact Links */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 mb-4">
              Staff Engineer Portfolio
            </h4>
            <div className="space-y-2.5">
              <a
                href="mailto:chandrakarnehil06112002@gmail.com"
                className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 p-2.5 rounded-xl transition"
              >
                <Mail className="w-4 h-4 text-emerald-400" />
                <span>Contact Developer</span>
                <ArrowUpRight className="w-3.5 h-3.5 ml-auto text-slate-500" />
              </a>

              <a
                href="https://nehil.vercel.app/resume"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 p-2.5 rounded-xl transition"
              >
                <Globe className="w-4 h-4 text-teal-400" />
                <span>Live Resume & Portfolio</span>
                <ArrowUpRight className="w-3.5 h-3.5 ml-auto text-slate-500" />
              </a>
            </div>
          </div>
        </div>

        {/* Minimalist Bottom Bar (Inspired by Image 2: HANDMADE WITH ❤️ BY NEHIL) */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-slate-400">
          <div className="flex items-center gap-6 uppercase tracking-wider">
            <Link href="/" className="hover:text-emerald-400 transition">
              Zenletics V1.1
            </Link>
            <span>•</span>
            <Link href="/#features" className="hover:text-emerald-400 transition">
              Features
            </Link>
            <span>•</span>
            <Link href="/dashboard" className="hover:text-emerald-400 transition">
              Dashboard
            </Link>
          </div>

          <p className="tracking-wide">
            HANDMADE WITH <span className="text-rose-500">❤️</span> BY <span className="text-emerald-400 font-extrabold">NEHIL CHANDRAKAR</span>
          </p>

          <p className="text-slate-500 font-medium">© {new Date().getFullYear()} Zenletics AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

