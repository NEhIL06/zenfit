"use client"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import SignupForm from "@/components/signup-form"

export default function SignupPage() {
  const router = useRouter()

  const handleSignupComplete = (userId: string) => {
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-white to-gray-50 dark:from-black dark:to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-[#2D5C44] dark:text-[#10B981]">Create Your</span> Fitness Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Tell us about yourself and we'll create a personalized plan just for you
          </p>
        </motion.div>

        <SignupForm onComplete={handleSignupComplete} />
      </div>
    </div>
  )
}
