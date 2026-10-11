"use client"

import type React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, User, Mail, Lock, Sparkles, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react"

interface SignupFormProps {
  onComplete: (userId: string) => void
}

export default function SignupForm({ onComplete }: SignupFormProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    age: "",
    gender: "Male",
    height: "",
    weight: "",
    fitnessGoal: "Weight Loss",
    fitnessLevel: "Beginner",
    workoutLocation: "Home",
    dietaryPreference: "Standard",
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
        setError("Please fill in all basic information fields")
        return
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        setError("Please enter a valid email address")
        return
      }
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters")
        return
      }
      setError("")
      setStep(2)
    } else if (step === 2) {
      if (!formData.age || !formData.height || !formData.weight || !formData.gender) {
        setError("Please enter your age, height, weight, and gender")
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

      const response = await fetch('/api/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: {
            fullName: formData.name,
            email: formData.email,
            password: formData.password,
            age: formData.age,
            gender: formData.gender,
            height: formData.height,
            weight: formData.weight,
            fitnessGoal: formData.fitnessGoal,
            experienceLevel: formData.fitnessLevel,
            workoutLocation: formData.workoutLocation,
            dietaryPreference: formData.dietaryPreference,
          }
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData?.error || 'Failed to create user')
      }

      const data = await response.json()
      const userId = data.userId

      if (typeof window !== 'undefined') {
        localStorage.setItem('current_user_id', userId)
      }

      // Generate initial AI workout & diet plan immediately upon signup
      try {
        const planResponse = await fetch('/api/generate-plan', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            age: String(formData.age || "25"),
            gender: String(formData.gender || "Male"),
            height: String(formData.height || "175"),
            weight: String(formData.weight || "70"),
            fitnessGoal: String(formData.fitnessGoal || "Muscle Gain"),
            experienceLevel: String(formData.fitnessLevel || "Beginner"),
            workoutLocation: String(formData.workoutLocation || "Home"),
            dietaryPreference: String(formData.dietaryPreference || "Standard"),
          }),
        })
        if (!planResponse.ok) {
          const errData = await planResponse.json().catch(() => ({}))
          console.warn("[ZenFit Signup] Background plan generation warning:", errData?.error || planResponse.statusText)
        }
      } catch (planErr) {
        console.warn("[ZenFit Signup] Background plan generation warning:", planErr)
      }

      onComplete(userId)
    } catch (err: any) {
      setError(err?.message || "Failed to create your account. Please try again.")
      console.error("[ZenFit Signup]", err)
    } finally {
      setLoading(false)
    }
  }

  const stepTitles = [
    { title: "Account Credentials", desc: "Your identity & password" },
    { title: "Physical Stats", desc: "Body metrics for targeted calculations" },
    { title: "Training & Nutrition Goals", desc: "Custom AI preferences" },
  ]

  return (
    <div className="backdrop-blur-2xl bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/80 relative overflow-hidden">
      {/* Dynamic Glow Background */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Stepper Bar */}
      <div className="mb-10">
        <div className="flex justify-between items-center max-w-md mx-auto relative z-10 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm transition-all duration-300 ${
                  s === step
                    ? "bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/30 scale-110"
                    : s < step
                    ? "bg-emerald-950 border border-emerald-500/40 text-emerald-400"
                    : "bg-slate-950 border border-slate-800 text-slate-500"
                }`}
              >
                {s < step ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-1 w-16 sm:w-28 mx-2 rounded-full transition-colors duration-300 ${
                    s < step ? "bg-emerald-500" : "bg-slate-800"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Step {step} of 3 — {stepTitles[step - 1].title}
          </p>
          <p className="text-slate-400 text-xs mt-0.5">{stepTitles[step - 1].desc}</p>
        </div>
      </div>

      {/* Form Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {/* Step 1: Account Credentials */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                    placeholder="Alex Morgan"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                    placeholder="alex@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Password (min 6 chars)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-12 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1.5 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Physical Details */}
          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Age (years)
                </label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                  placeholder="24"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Height (cm)
                </label>
                <input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                  placeholder="178"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                  placeholder="74"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 3: Fitness & Lifestyle */}
          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Primary Fitness Goal
                </label>
                <select
                  name="fitnessGoal"
                  value={formData.fitnessGoal}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                >
                  <option value="Weight Loss">Weight Loss</option>
                  <option value="Muscle Gain">Muscle Gain</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Experience Level
                </label>
                <select
                  name="fitnessLevel"
                  value={formData.fitnessLevel}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Workout Location
                </label>
                <select
                  name="workoutLocation"
                  value={formData.workoutLocation}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                >
                  <option value="Home">Home</option>
                  <option value="Gym">Gym</option>
                  <option value="Outdoors">Outdoors</option>
                  <option value="Hotel Room">Hotel Room</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Dietary Preference
                </label>
                <select
                  name="dietaryPreference"
                  value={formData.dietaryPreference}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition"
                >
                  <option value="Standard">Standard</option>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Keto">Keto</option>
                  <option value="Paleo">Paleo</option>
                  <option value="Gluten-Free">Gluten-Free</option>
                  <option value="Dairy-Free">Dairy-Free</option>
                </select>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-red-950/60 border border-red-800/60 text-red-200 rounded-xl text-sm font-medium flex items-center gap-2"
        >
          <span className="text-red-400 font-bold">⚠️</span> {error}
        </motion.div>
      )}

      {/* Control Buttons */}
      <div className="flex justify-between items-center mt-10 pt-4 border-t border-slate-800">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="px-5 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 font-bold text-sm hover:text-white hover:border-slate-700 transition flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-extrabold text-sm hover:from-emerald-400 hover:to-teal-300 shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer ml-auto"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-base hover:from-emerald-400 hover:to-teal-300 shadow-lg shadow-emerald-500/30 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer ml-auto"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                Generating AI Plan...
              </span>
            ) : (
              <>
                <Sparkles className="w-5 h-5" /> Generate My AI Plan
              </>
            )}
          </motion.button>
        )}
      </div>
    </div>
  )
}
