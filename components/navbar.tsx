"use client"

import Link from "next/link"
import { ThemeToggle } from "./theme-toggle"

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="font-bold text-2xl text-[#2D5C44] dark:text-[#10B981]">
            💪 AI Coach
          </Link>

          <div className="flex gap-6 items-center">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-gray-600 dark:text-gray-300 hover:text-[#2D5C44] dark:hover:text-[#10B981] font-medium"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="text-gray-600 dark:text-gray-300 hover:text-[#2D5C44] dark:hover:text-[#10B981] font-medium"
            >
              Signup
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
