"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import { generateMotivationalQuote } from "@/lib/gemini"
import { Dumbbell, Heart, TrendingUp, Users } from "lucide-react"

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
        setQuote("The only bad workout is the one that did not happen.")
      } finally {
        setLoading(false)
      }
    }
    fetchQuote()
  }, [])

  const features = [
    {
      icon: <Dumbbell className="w-8 h-8" />,
      title: "Personalized Workouts",
      description: "AI-powered plans tailored to your fitness level and goals"
    },
    {
      icon: <Heart className="w-8 h-8" />,
      title: "Nutrition Guidance",
      description: "Custom diet plans designed for your body and lifestyle"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Track Progress",
      description: "Monitor your achievements and celebrate milestones"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "AI Coach Support",
      description: "Voice guidance and motivation throughout your journey"
    }
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-black relative overflow-hidden">
      <Navbar />

      {/* Hero Section with Background Image */}
      <section className="relative min-h-screen flex items-center justify-center px-4 pt-20">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070"
            alt="Fitness motivation"
            className="w-full h-full object-cover opacity-20 dark:opacity-30"
          />
          <div className="absolute inset-0 bg-linear-to-b from-white/80 via-white/60 to-white dark:from-black/70 dark:via-black/50 dark:to-black"></div>
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-6xl mx-auto text-center"
        >
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 text-black dark:text-white leading-tight"
          >
            Your <span className="text-[#2D5C44] dark:text-[#10B981]">Fitness Journey</span>
            <br />
            Starts <span className="text-[#2D5C44] dark:text-[#10B981]">Here</span>
          </motion.h1>

          {/* Motivational Quote */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative bg-linear-to-r from-[#2D5C44] to-[#1a3d2e] dark:from-[#10B981] dark:to-[#059669] text-white rounded-3xl p-8 md:p-12 mb-12 shadow-2xl max-w-4xl mx-auto backdrop-blur-sm"
          >
            <div className="absolute -top-6 -left-6 w-12 h-12 bg-[#10B981] dark:bg-[#2D5C44] rounded-full flex items-center justify-center text-3xl">
              💪
            </div>
            {loading ? (
              <p className="text-lg md:text-2xl italic">Loading your inspiration...</p>
            ) : (
              <p className="text-lg md:text-2xl italic font-light leading-relaxed">&ldquo;{quote}&rdquo;</p>
            )}
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Transform your body and mind with AI-powered fitness coaching. 
            Get personalized workouts, nutrition plans, and real-time guidance.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
          >
            <Link href="/signup">
              <button className="px-10 py-5 bg-linear-to-r from-[#10B981] to-[#059669] text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 shadow-lg">
                Start Free Trial
              </button>
            </Link>
            <Link href="/login">
              <button className="px-10 py-5 border-2 border-[#2D5C44] dark:border-[#10B981] text-[#2D5C44] dark:text-[#10B981] rounded-xl font-bold text-lg hover:bg-[#2D5C44] hover:text-white dark:hover:bg-[#10B981] dark:hover:text-black transition-all duration-300 hover:scale-105">
                Sign In
              </button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="relative py-24 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-black dark:text-white mb-4">
              Why Choose <span className="text-[#2D5C44] dark:text-[#10B981]">Zenletics</span>?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Everything you need to achieve your fitness goals
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105"
              >
                <div className="text-[#10B981] dark:text-[#2D5C44] mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-black dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Transformation Section with Background Image */}
      <section className="relative py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070"
            alt="Gym transformation"
            className="w-full h-full object-cover opacity-15 dark:opacity-10"
          />
          <div className="absolute inset-0 bg-linear-to-r from-white/90 via-white/80 to-white/90 dark:from-black/90 dark:via-black/80 dark:to-black/90"></div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-6xl font-bold text-black dark:text-white mb-6">
            Ready to <span className="text-[#2D5C44] dark:text-[#10B981]">Transform</span>?
          </h2>
          <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-12 leading-relaxed">
            Join thousands of people who have already started their fitness journey with Zenletics.
            Your transformation starts with a single step.
          </p>
          <Link href="/signup">
            <button className="px-12 py-6 bg-linear-to-r from-[#2D5C44] to-[#1a3d2e] dark:from-[#10B981] dark:to-[#059669] text-white rounded-xl font-bold text-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 shadow-xl">
              Begin Your Journey Today
            </button>
          </Link>
        </motion.div>
      </section>

      <Footer />
    </div>
  )
}