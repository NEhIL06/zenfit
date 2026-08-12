"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Sparkles, RefreshCw } from "lucide-react"
import { generateFitnessPlan } from "@/lib/gemini"
import { generateImage } from "@/lib/storage"
import ImageGalleryModal from "@/components/image-gallery-modal"
import VoicePlayer from "@/components/voice-player"
import { toPng } from "html-to-image";
import type { User } from "@/types/user"

interface PlanTabProps {
  user: User
  onUserUpdate: (user: User) => void
}

function formatWorkoutForSpeech(workout_plan: any[]): string {
  if (!workout_plan || workout_plan.length === 0) return "No workout plan available.";
  let speech = "Here is your workout plan. ";
  workout_plan.forEach((day: any) => {
    speech += `On ${day.day}, the focus is ${day.focus}. `;
    speech += "Exercises are: ";
    day.exercises?.forEach((ex: any) => {
      speech += `${ex.name}, ${ex.sets} sets of ${ex.reps} reps, with ${ex.rest_seconds} seconds rest. `;
    });
  });
  return speech;
}

function formatDietForSpeech(diet_plan: any[]): string {
  if (!diet_plan || diet_plan.length === 0) return "No diet plan available.";
  let speech = "Here is your diet plan. ";
  diet_plan.forEach((meal: any) => {
    speech += `For ${meal.meal}: `;
    meal.items?.forEach((item: any) => {
      speech += `${item.name}, ${item.calories} calories, ${item.protein_g} grams of protein. `;
    });
  });
  return speech;
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
      const updatedUser = { ...user, plan: newPlan }
      onUserUpdate(updatedUser)
    } catch (error: unknown) {
      console.error("[PlanTab] Initial auto-generation failed:", error)
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate initial AI fitness plan.")
    } finally {
      setAutoGenerating(false)
    }
  }, [onUserUpdate, user])

  // Auto-generate plan if missing on load
  useEffect(() => {
    if (!plan && !autoGenerating) {
      handleInitialGenerate()
    }
  }, [plan, autoGenerating, handleInitialGenerate])

  const handleRegenerate = async () => {
    if (confirmingAction === "plan") {
      setConfirmingAction(null)
      setRegenerating(true)
      try {
        const newPlan = await generateFitnessPlan({
          ...buildPlanPayload(user),
          regenerationScope: "diet",
        })
        const updatedUser = { ...user, plan: newPlan }
        onUserUpdate(updatedUser)
      } catch (error) {
        console.error("[v0] Failed to regenerate plan:", error)
        setErrorMessage("Failed to regenerate plan")
      } finally {
        setRegenerating(false)
      }
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
        const updatedUser = { ...user, plan: newPlan }
        onUserUpdate(updatedUser)
      } catch (error) {
        console.error("[v0] Failed to regenerate meal plan:", error)
        setErrorMessage("Failed to regenerate meal plan")
      } finally {
        setRegenerating(false)
      }
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
      if (!element) {
        throw new Error("Could not find element #plan-content");
      }
      const dataUrl = await toPng(element);
      const printWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!printWindow) {
        throw new Error("Popup blocked while opening print view");
      }
      printWindow.document.title = `${user.name}-fitness-plan`;
      const style = printWindow.document.createElement("style");
      style.textContent = "body{margin:0;padding:24px;background:#fff}img{width:100%;height:auto;display:block}";
      const image = printWindow.document.createElement("img");
      image.src = dataUrl;
      image.alt = "Fitness plan export";
      printWindow.document.head.appendChild(style);
      printWindow.document.body.appendChild(image);
      image.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    } catch (error) {
      console.error("[v0] Failed to export PDF:", error)
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
      if (imageData) {
        setSelectedImage({ type, name })
      }
    } catch (error) {
      console.error("[v0] Error generating image:", error)
      setErrorMessage("Failed to generate image")
    } finally {
      setGeneratingImage(null)
    }
  }

  if (!plan) {
    return (
      <div className="backdrop-blur-xl bg-slate-900/80 border border-slate-800/80 rounded-3xl p-10 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-emerald-950 border border-emerald-800/50 flex items-center justify-center mx-auto text-emerald-400">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>
        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-xl font-bold text-white tracking-tight">
            {autoGenerating ? "Synthesizing AI Fitness & Diet Plan..." : "No Active AI Fitness Plan"}
          </h3>
          <p className="text-slate-400 text-sm">
            {autoGenerating
              ? "Our CSCS-certified AI model is generating your custom 7-day workout split & macro nutrition targets based on your physical metrics."
              : "Generate your custom 7-day workout split & macro nutrition targets engineered for your specific goal."}
          </p>
        </div>

        {errorMessage && (
          <p className="text-red-400 text-xs bg-red-950/60 border border-red-800/60 p-3 rounded-xl max-w-md mx-auto font-medium">
            ⚠️ {errorMessage}
          </p>
        )}

        <button
          onClick={handleInitialGenerate}
          disabled={autoGenerating}
          className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 transition inline-flex items-center gap-3 disabled:opacity-50 cursor-pointer"
        >
          {autoGenerating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" /> Generating Plan...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" /> Generate AI Fitness Plan Now
            </>
          )}
        </button>
      </div>
    )
  }

  const cancelConfirmation = () => {
    setConfirmingAction(null)
  }

  return (
    <div className="space-y-8">
      {/* Error Message Display */}
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{errorMessage}</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setErrorMessage(null)}>
            <svg className="fill-current h-6 w-6 text-red-500 cursor-pointer" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.03a1.2 1.2 0 1 1-1.697-1.697l3.03-3.651-3.03-3.651a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.03a1.2 1.2 0 1 1 1.697 1.697l-3.03 3.651 3.03 3.651a1.2 1.2 0 0 1 0 1.697z" /></svg>
          </span>
        </div>
      )}

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-linear-to-r from-[#2D5C44] to-primary-dark dark:from-[#10B981] dark:to-[#0a7a5e] text-white rounded-2xl p-8"
      >
        <h2 className="text-2xl font-bold mb-4">Your Personalized Plan</h2>
        <p className="text-lg leading-relaxed">{plan.summary}</p>
      </motion.div>

      {/* Action Buttons & Confirmation */}
      <div className="flex flex-wrap gap-4 items-center">
        <button
          onClick={handleRegenerate}
          disabled={regenerating || confirmingAction === 'meal'}
          className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#0a9370] disabled:opacity-50"
        >
          {confirmingAction === 'plan' ? "Are you sure?" : (regenerating ? "Regenerating..." : "Regenerate Plan")}
        </button>
        {confirmingAction === 'plan' && (
          <button onClick={cancelConfirmation} className="px-6 py-3 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400">
            Cancel
          </button>
        )}
        <button
          onClick={handleExportPDF}
          disabled={exporting || regenerating || !!confirmingAction}
          className="px-6 py-3 border-2 border-[#2D5C44] dark:border-[#10B981] text-[#2D5C44] dark:text-[#10B981] rounded-lg font-semibold hover:bg-[#2D5C44] hover:text-white dark:hover:bg-[#10B981] dark:hover:text-black disabled:opacity-50"
        >
          {exporting ? "Exporting..." : "Export as PDF"}
        </button>
      </div>

      {/* Plan Content */}
      <div id="plan-content" className="space-y-8">
        {/* Workout Plan */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-[#2D5C44] dark:text-[#10B981]">Workout Plan</h3>
            <VoicePlayer
              content={formatWorkoutForSpeech(plan.workout_plan)}
              type="workout"
              onError={setErrorMessage}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plan.workout_plan?.map((day: any, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border-l-4 border-[#10B981]"
              >
                <h4 className="font-bold text-lg mb-2 text-black dark:text-white">{day.day}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Focus: {day.focus}</p>
                <div className="space-y-3">
                  {day.exercises?.map((exercise: any, exIndex: number) => (
                    <motion.div key={exIndex} className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                      <p
                        onClick={() => handleGenerateImage(exercise.name, "exercise")}
                        className="font-semibold text-black dark:text-white cursor-pointer hover:text-[#10B981] transition"
                      >
                        {exercise.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {exercise.sets}x{exercise.reps} • Rest: {exercise.rest_seconds || exercise.rest || 60}s
                      </p>
                      {generatingImage === exercise.name && (
                        <p className="mt-2 text-xs text-[#10B981]">Generating image...</p>
                      )}
                    </motion.div>
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
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-[#2D5C44] dark:text-[#10B981]">Diet Plan</h3>
            <VoicePlayer
              content={formatDietForSpeech(plan.diet_plan)}
              type="diet"
              onError={setErrorMessage}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plan.diet_plan?.map((meal: any, index: number) => {
              const items = meal.items || (meal.name ? [{ name: meal.name, calories: meal.calories, protein_g: meal.protein_g || meal.protein }] : [])
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border-l-4 border-[#10B981]"
                >
                  <h4 className="font-bold text-lg mb-4 text-black dark:text-white">{meal.meal}</h4>
                  <div className="space-y-3">
                    {items.map((item: any, itemIndex: number) => (
                      <motion.div key={itemIndex} className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                        <p
                          onClick={() => handleGenerateImage(item.name, "meal")}
                          className="font-semibold text-black dark:text-white cursor-pointer hover:text-[#10B981] transition"
                        >
                          {item.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.calories}cal • {item.protein_g || item.protein || 30}g protein
                        </p>
                        {generatingImage === item.name && (
                          <p className="mt-2 text-xs text-[#10B981]">Generating image...</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 justify-center">
            <button
              onClick={handleRegenerateMealPlan}
              disabled={regenerating || confirmingAction === 'plan'}
              className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#0a9370] disabled:opacity-50"
            >
              {confirmingAction === 'meal' ? "Are you sure?" : (regenerating ? "Regenerating..." : "Regenerate Meal Plan")}
            </button>
            {confirmingAction === 'meal' && (
              <button onClick={cancelConfirmation} className="px-6 py-3 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400">
                Cancel
              </button>
            )}
          </div>
        </motion.div>

        {/* Motivation Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg"
        >
          <h3 className="text-2xl font-bold text-[#2D5C44] dark:text-[#10B981] mb-6">Motivation & Coaching Tips</h3>
          <div className="space-y-4">
            {(plan.motivation_tips || plan.recommendations || [])?.map((tip: string, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="flex items-start gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 font-bold">
                  {index + 1}
                </div>
                <p className="text-gray-700 dark:text-gray-300 pt-1">{tip}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {selectedImage && (
        <ImageGalleryModal type={selectedImage.type} name={selectedImage.name} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  )
}
