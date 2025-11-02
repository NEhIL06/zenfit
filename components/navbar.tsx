"use client"

import Link from "next/link"
import { ThemeToggle } from "./theme-toggle"
import { Dumbbell } from "lucide-react"

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-2xl text-[#2D5C44] dark:text-[#10B981] hover:scale-105 transition-transform duration-300">
            <Dumbbell className="w-7 h-7" />
            <span>Zenletics</span>
          </Link>

          <div className="flex gap-6 items-center">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-gray-700 dark:text-gray-300 hover:text-[#2D5C44] dark:hover:text-[#10B981] font-semibold transition-colors duration-200"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-6 py-2.5 bg-linear-to-r from-[#10B981] to-[#059669] text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}