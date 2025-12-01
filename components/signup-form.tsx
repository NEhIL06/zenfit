"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { generateFitnessPlan } from "@/lib/gemini"
import { saveUserToLocalStorage } from "@/lib/storage"

interface SignupFormProps {
  onComplete: (userId: string) => void
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
  },
}

export default function SignupForm({ onComplete }: SignupFormProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    age: "",
    gender: "",
    height: "",
    weight: "",
    fitnessGoal: "Weight Loss",
    fitnessLevel: "Beginner",
    workoutLocation: "Home",
    dietaryPreference: "Veg",
    medicalHistory: "",
    stressLevel: "Moderate",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.password) {
        setError("Please fill in all fields")
        return
      }
      setError("")
      setStep(2)
    } else if (step === 2) {
      if (!formData.age || !formData.height || !formData.weight || !formData.gender) {
        setError("Please fill in all fields")
        return
      }
      setError("")
      setStep(3)
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError("")

      // Step 1: Create user in MongoDB and get the userId
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData }),
      })

      if (!response.ok) {
        throw new Error('Failed to create user')
      }

      const data = await response.json();
      const userId = data.id.toString(); // Convert ObjectId to string

      // Step 2: Generate fitness plan with the userId
      const plan = await generateFitnessPlan({
        ...formData,
        userId: userId  // Pass userId to plan generation
      })

      // Step 3: Save to localStorage with the same userId
      saveUserToLocalStorage({
        ...formData,
        id: userId,
        plan,
        createdAt: new Date().toISOString(),
      })

      onComplete(userId)
    } catch (err) {
      setError("Failed to generate your plan. Please try again.")
      console.error("[v0]", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 md:p-12">
      {/* Progress Indicator */}
      <div className="flex justify-between items-center mb-12">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${s <= step
                  ? "bg-[#2D5C44] dark:bg-[#10B981] text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}
            >
              {s}
            </motion.div>
            {s < 3 && (
              <div
                className={`h-1 w-12 md:w-24 transition-all ${s < step ? "bg-[#2D5C44] dark:bg-[#10B981]" : "bg-gray-200 dark:bg-gray-700"
                  }`}
              />
            )}
          </div>
        ))}
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <h2 className="text-2xl font-bold mb-8 text-black dark:text-white">Basic Information</h2>

            <div className="space-y-6">
              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                  placeholder="John Doe"
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                  placeholder="john@example.com"
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                  placeholder="••••••••"
                />
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Physical Details */}
        {step === 2 && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <h2 className="text-2xl font-bold mb-8 text-black dark:text-white">Your Physical Profile</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                  placeholder="25"
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Height (cm)</label>
                <input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                  placeholder="175"
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Weight (kg)</label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                  placeholder="75"
                />
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Fitness & Lifestyle */}
        {step === 3 && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <h2 className="text-2xl font-bold mb-8 text-black dark:text-white">Fitness & Lifestyle</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  Fitness Goal
                </label>
                <select
                  name="fitnessGoal"
                  value={formData.fitnessGoal}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                >
                  <option value="Weight Loss">Weight Loss</option>
                  <option value="Muscle Gain">Muscle Gain</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  Fitness Level
                </label>
                <select
                  name="fitnessLevel"
                  value={formData.fitnessLevel}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  Workout Location
                </label>
                <select
                  name="workoutLocation"
                  value={formData.workoutLocation}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                >
                  <option value="Home">Home</option>
                  <option value="Gym">Gym</option>
                  <option value="Outdoor">Outdoor</option>
                </select>
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  Dietary Preference
                </label>
                <select
                  name="dietaryPreference"
                  value={formData.dietaryPreference}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                >
                  <option value="Veg">Veg</option>
                  <option value="Non-Veg">Non-Veg</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Keto">Keto</option>
                </select>
              </motion.div>

              <motion.div variants={itemVariants}>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  Stress Level
                </label>
                <select
                  name="stressLevel"
                  value={formData.stressLevel}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                >
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High</option>
                </select>
              </motion.div>

              <motion.div variants={itemVariants} className="md:col-span-2">
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  Medical History (Optional)
                </label>
                <textarea
                  name="medicalHistory"
                  value={formData.medicalHistory}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                  placeholder="Any allergies, injuries, or medical conditions..."
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded-lg"
        >
          {error}
        </motion.div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-10">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="px-6 py-3 border-2 border-[#2D5C44] dark:border-[#10B981] text-[#2D5C44] dark:text-[#10B981] rounded-lg font-semibold hover:bg-[#2D5C44] hover:text-white dark:hover:bg-[#10B981] dark:hover:text-black"
          >
            Back
          </button>
        )}

        <div className="ml-auto">
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#0a9370]"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#0a9370] disabled:opacity-50"
            >
              {loading ? "Creating Your Plan..." : "Create My Plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
