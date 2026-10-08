"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Sparkles, RefreshCw, Download, Dumbbell, Utensils, Lightbulb, Play, Image, ChevronRight } from "lucide-react"
import { generateFitnessPlan } from "@/lib/gemini"
import { generateImage } from "@/lib/storage"
import ImageGalleryModal from "@/components/image-gallery-modal"
import VoicePlayer from "@/components/voice-player"
import { toPng } from "html-to-image"
import type { User } from "@/types/user"

interface PlanTabProps {
  user: User
  onUserUpdate: (user: User) => void
}

function toArray<T>(val: T[] | unknown): T[] {
  return Array.isArray(val) ? val : []
}

function formatWorkoutForSpeech(workout_plan: unknown[]): string {
  const days = toArray<any>(workout_plan)
  if (!days.length) return "No workout plan available."
  let speech = "Here is your workout plan. "
  days.forEach((day: any) => {
    speech += `On ${day.day}, the focus is ${day.focus}. `
    speech += "Exercises are: "
    toArray<any>(day.exercises).forEach((ex: any) => {
      speech += `${ex.name}, ${ex.sets} sets of ${ex.reps} reps, with ${ex.rest_seconds ?? 60} seconds rest. `
    })
  })
  return speech
}

function formatDietForSpeech(diet_plan: unknown): string {
  const meals = toArray<any>(diet_plan)
  if (!meals.length) return "No diet plan available."
  let speech = "Here is your diet plan. "
  meals.forEach((meal: any) => {
    speech += `For ${meal.meal}: `
    toArray<any>(meal.items).forEach((item: any) => {
      speech += `${item.name}, ${item.calories} calories, ${item.protein_g ?? item.protein ?? 0} grams of protein. `
    })
  })
  return speech
}

function buildPlanPayload(user: User) {
  return {
    age: String(user.age || "25"),
    gender: String(user.gender || "Male"),
    height: String(user.height || "175"),
    weight: String(user.weight || "70"),
    fitnessGoal: String(user.fitnessGoal || "Muscle Gain"),
    experienceLevel: String(user.fitnessLevel || "Beginner"),
    workoutLocation: String(user.workoutLocation || "Home"),
    dietaryPreference: String(user.dietaryPreference || "Standard"),
  }
}

export default function PlanTab({ user, onUserUpdate }: PlanTabProps) {
  const [regenerating, setRegenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ type: "exercise" | "meal"; name: string } | null>(null)
  const [generatingImage, setGeneratingImage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmingAction, setConfirmingAction] = useState<"plan" | "meal" | null>(null)
  const [autoGenerating, setAutoGenerating] = useState(false)

  const plan = user.plan

  const handleInitialGenerate = useCallback(async () => {
    setAutoGenerating(true)
    setErrorMessage(null)
    try {
      const newPlan = await generateFitnessPlan(buildPlanPayload(user))
      onUserUpdate({ ...user, plan: newPlan })
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate AI fitness plan.")
    } finally {
      setAutoGenerating(false)
    }
  }, [onUserUpdate, user])

  useEffect(() => {
    if (!plan && !autoGenerating) handleInitialGenerate()
  }, [plan, autoGenerating, handleInitialGenerate])

  const handleRegenerate = async () => {
    if (confirmingAction === "plan") {
      setConfirmingAction(null)
      setRegenerating(true)
      try {
        const newPlan = await generateFitnessPlan({ ...buildPlanPayload(user), regenerationScope: "diet" })
        onUserUpdate({ ...user, plan: newPlan })
      } catch { setErrorMessage("Failed to regenerate plan") }
      finally { setRegenerating(false) }
    } else {
      setConfirmingAction("plan")
      setErrorMessage(null)
    }
  }

  const handleRegenerateMealPlan = async () => {
    if (confirmingAction === "meal") {
      setConfirmingAction(null)
      setRegenerating(true)
      try {
        const newPlan = await generateFitnessPlan(buildPlanPayload(user))
        onUserUpdate({ ...user, plan: newPlan })
      } catch { setErrorMessage("Failed to regenerate meal plan") }
      finally { setRegenerating(false) }
    } else {
      setConfirmingAction("meal")
      setErrorMessage(null)
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    setErrorMessage(null)
    try {
      const element = document.getElementById("plan-content")
      if (!element) throw new Error("Could not find element #plan-content")
      const dataUrl = await toPng(element)
      const printWindow = window.open("", "_blank", "noopener,noreferrer")
      if (!printWindow) throw new Error("Popup blocked")
      printWindow.document.title = `${user.name}-fitness-plan`
      const style = printWindow.document.createElement("style")
      style.textContent = "body{margin:0;padding:24px;background:#fff}img{width:100%;height:auto;display:block}"
      const image = printWindow.document.createElement("img")
      image.src = dataUrl
      image.alt = "Fitness plan export"
      printWindow.document.head.appendChild(style)
      printWindow.document.body.appendChild(image)
      image.onload = () => { printWindow.focus(); printWindow.print() }
    } catch (error) {
      setErrorMessage("Failed to export PDF")
    } finally {
      setExporting(false)
    }
  }

  const handleGenerateImage = async (name: string, type: "exercise" | "meal") => {
    setGeneratingImage(name)
    setErrorMessage(null)
    try {
      const imageData = await generateImage(name, type)
      if (imageData) setSelectedImage({ type, name })
    } catch { setErrorMessage("Failed to generate image") }
    finally { setGeneratingImage(null) }
  }

  if (!plan) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-12 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-800/50 flex items-center justify-center mx-auto text-emerald-400">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>
        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-xl font-bold text-white tracking-tight">
            {autoGenerating ? "Synthesizing Your AI Fitness Plan..." : "No Active Plan Yet"}
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            {autoGenerating
              ? "Generating your custom 7-day workout split & macro nutrition targets based on your physical metrics."
              : "Generate your custom 7-day workout split & macro nutrition targets."}
          </p>
        </div>
        {errorMessage && (
          <p className="text-red-400 text-xs bg-red-950/60 border border-red-800/60 p-3 rounded-xl max-w-md mx-auto">
            ⚠️ {errorMessage}
          </p>
        )}
        <button
          onClick={handleInitialGenerate}
          disabled={autoGenerating}
          className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition inline-flex items-center gap-3 disabled:opacity-50 cursor-pointer"
        >
          {autoGenerating ? (
            <><RefreshCw className="w-5 h-5 animate-spin" /> Generating Plan...</>
          ) : (
            <><Sparkles className="w-5 h-5" /> Generate AI Fitness Plan</>
          )}
        </button>
      </div>
    )
  }

  const workoutDays = toArray<any>(plan.workout_plan)
  const dietMeals = toArray<any>(plan.diet_plan)
  const tips = toArray<any>(plan.motivation_tips ?? plan.recommendations)

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-950/60 border border-red-800/60 text-red-200 px-4 py-3 rounded-2xl text-sm flex items-center justify-between gap-4">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white transition text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Plan Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-emerald-400 mb-3">
            <Sparkles className="w-4 h-4" /> Your Personalized Plan
          </div>
          <p className="text-slate-200 text-sm sm:text-base leading-relaxed">{plan.summary}</p>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={handleRegenerate}
          disabled={regenerating || confirmingAction === "meal"}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
          {confirmingAction === "plan" ? "Confirm Regenerate?" : regenerating ? "Regenerating..." : "Regenerate Plan"}
        </button>
        {confirmingAction === "plan" && (
          <button onClick={() => setConfirmingAction(null)} className="px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-700 transition cursor-pointer">
            Cancel
          </button>
        )}
        <button
          onClick={handleExportPDF}
          disabled={exporting || regenerating || !!confirmingAction}
          className="px-5 py-2.5 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-bold text-sm hover:border-emerald-500/50 hover:text-emerald-400 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Exporting..." : "Export PDF"}
        </button>
      </div>

      <div id="plan-content" className="space-y-6">
        {/* Workout Plan */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-lg"
        >
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
                <Dumbbell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Workout Plan</h3>
                <p className="text-xs text-slate-500">7-day AI generated split</p>
              </div>
            </div>
            <VoicePlayer content={formatWorkoutForSpeech(workoutDays)} type="workout" onError={setErrorMessage} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workoutDays.map((day: any, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + index * 0.05 }}
                className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 border-l-4 border-l-emerald-500/70"
              >
                <h4 className="font-extrabold text-white mb-0.5">{day.day}</h4>
                <p className="text-xs text-emerald-400 font-semibold mb-4 uppercase tracking-wider">{day.focus}</p>
                <div className="space-y-2">
                  {toArray<any>(day.exercises).map((exercise: any, exIndex: number) => (
                    <div key={exIndex} className="bg-slate-900 rounded-xl p-3">
                      <button
                        onClick={() => handleGenerateImage(exercise.name, "exercise")}
                        className="font-semibold text-white hover:text-emerald-400 transition text-sm text-left flex items-center gap-1.5 w-full group"
                      >
                        {exercise.name}
                        <Image className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition ml-auto shrink-0" />
                      </button>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {exercise.sets}×{exercise.reps} · Rest {exercise.rest_seconds ?? exercise.rest ?? 60}s
                      </p>
                      {generatingImage === exercise.name && (
                        <p className="mt-1 text-xs text-emerald-400 animate-pulse">Generating image...</p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Diet Plan */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-lg"
        >
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-950 border border-teal-800/50 flex items-center justify-center text-teal-400">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Diet Plan</h3>
                <p className="text-xs text-slate-500">Macro-optimized meal targets</p>
              </div>
            </div>
            <VoicePlayer content={formatDietForSpeech(dietMeals)} type="diet" onError={setErrorMessage} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dietMeals.map((meal: any, index: number) => {
              const items = toArray<any>(
                meal.items ?? (meal.name ? [{ name: meal.name, calories: meal.calories, protein_g: meal.protein_g ?? meal.protein }] : [])
              )
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + index * 0.05 }}
                  className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 border-l-4 border-l-teal-500/70"
                >
                  <h4 className="font-extrabold text-white mb-4">{meal.meal}</h4>
                  <div className="space-y-2">
                    {items.map((item: any, itemIndex: number) => (
                      <div key={itemIndex} className="bg-slate-900 rounded-xl p-3">
                        <button
                          onClick={() => handleGenerateImage(item.name, "meal")}
                          className="font-semibold text-white hover:text-teal-400 transition text-sm text-left flex items-center gap-1.5 w-full group"
                        >
                          {item.name}
                          <Image className="w-3 h-3 text-slate-500 group-hover:text-teal-400 transition ml-auto shrink-0" />
                        </button>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.calories} cal · {item.protein_g ?? item.protein ?? 0}g protein
                        </p>
                        {generatingImage === item.name && (
                          <p className="mt-1 text-xs text-teal-400 animate-pulse">Generating image...</p>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleRegenerateMealPlan}
              disabled={regenerating || confirmingAction === "plan"}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
              {confirmingAction === "meal" ? "Confirm Regenerate?" : "Regenerate Meal Plan"}
            </button>
            {confirmingAction === "meal" && (
              <button onClick={() => setConfirmingAction(null)} className="px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-700 transition cursor-pointer">
                Cancel
              </button>
            )}
          </div>
        </motion.div>

        {/* Coaching Tips */}
        {tips.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-lg"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Coaching Tips</h3>
                <p className="text-xs text-slate-500">AI-curated for your goal</p>
              </div>
            </div>
            <div className="space-y-3">
              {tips.map((tip: string, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + index * 0.08 }}
                  className="flex items-start gap-4 bg-slate-950 rounded-2xl p-4 border border-slate-800/80"
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-700/50 text-emerald-400 flex items-center justify-center shrink-0 font-extrabold text-xs">
                    {index + 1}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed pt-0.5">{tip}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {selectedImage && (
        <ImageGalleryModal type={selectedImage.type} name={selectedImage.name} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  )
}
