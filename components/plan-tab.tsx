"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { generateFitnessPlan } from "@/lib/gemini"
import { updateUser, generateImage } from "@/lib/storage"
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"
import ImageGalleryModal from "@/components/image-gallery-modal"
import VoicePlayer from "@/components/voice-player"
import type { User } from "@/types/user"

interface PlanTabProps {
  user: User
  onUserUpdate: (user: User) => void
}

// Helper function to convert workout plan JSON to a readable string for TTS
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

// Helper function to convert diet plan JSON to a readable string for TTS
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

export default function PlanTab({ user, onUserUpdate }: PlanTabProps) {
  const [regenerating, setRegenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ type: "exercise" | "meal"; name: string } | null>(null)
  const [generatingImage, setGeneratingImage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmingAction, setConfirmingAction] = useState<"plan" | "meal" | null>(null)

  const plan = user.plan

  const handleRegenerate = async () => {
    // Replaced confirm() with state check
    if (confirmingAction === "plan") {
      setConfirmingAction(null) // Hide confirmation
      setRegenerating(true)
      try {
        const newPlan = await generateFitnessPlan(user)
        const updatedUser = { ...user, plan: newPlan }
        updateUser(user.id, { plan: newPlan })
        onUserUpdate(updatedUser)
      } catch (error) {
        console.error("[v0] Failed to regenerate plan:", error)
        setErrorMessage("Failed to regenerate plan") // Replaced alert()
      } finally {
        setRegenerating(false)
      }
    } else {
      setConfirmingAction("plan") // Show confirmation
      setErrorMessage(null) // Clear any errors
    }
  }

  const handleRegenerateMealPlan = async () => {
    // Replaced confirm() with state check
    if (confirmingAction === "meal") {
      setConfirmingAction(null) // Hide confirmation
      setRegenerating(true)
      try {
        const newPlan = await generateFitnessPlan(user) // Assuming this gets a full plan
        const updatedPlan = {
          ...(plan || {}),
          diet_plan: newPlan.diet_plan,
        }
        const updatedUser = { ...user, plan: updatedPlan }
        updateUser(user.id, { plan: updatedPlan })
        onUserUpdate(updatedUser)
      } catch (error) {
        console.error("[v0] Failed to regenerate meal plan:", error)
        setErrorMessage("Failed to regenerate meal plan") // Replaced alert()
      } finally {
        setRegenerating(false)
      }
    } else {
      setConfirmingAction("meal") // Show confirmation
      setErrorMessage(null) // Clear any errors
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    setErrorMessage(null) // Clear previous errors
    try {
      const element = document.getElementById("plan-content")
      if (!element) {
          throw new Error("Could not find element #plan-content");
      }

      const canvas = await html2canvas(element, {
        useCORS: true,
        backgroundColor: "#ffffff",
      })
      
      const pdf = new jsPDF("p", "mm", "a4")
      const imgData = canvas.toDataURL("image/png")
      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`${user.name}-fitness-plan.pdf`)
    } catch (error) {
      console.error("[v0] Failed to export PDF:", error)
      
      // *** NEW: Specific error handling for oklch ***
      if (error instanceof Error && error.message.includes("oklch")) {
        setErrorMessage('PDF Export Failed: Your PDF library is not compatible with modern CSS colors. Please run "npm install html2canvas@latest" in your terminal to fix this.');
      } else {
        setErrorMessage("Failed to export PDF") // Replaced alert()
      }
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
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-300">Plan not found. Please try again.</p>
      </div>
    )
  }

  // Helper to cancel confirmation
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
            <svg className="fill-current h-6 w-6 text-red-500 cursor-pointer" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.03a1.2 1.2 0 1 1-1.697-1.697l3.03-3.651-3.03-3.651a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.03a1.2 1.2 0 1 1 1.697 1.697l-3.03 3.651 3.03 3.651a1.2 1.2 0 0 1 0 1.697z"/></svg>
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
                        {exercise.sets}x{exercise.reps} • Rest: {exercise.rest_seconds}s
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
            {plan.diet_plan?.map((meal: any, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border-l-4 border-[#10B981]"
              >
                <h4 className="font-bold text-lg mb-4 text-black dark:text-white">{meal.meal}</h4>
                <div className="space-y-3">
                  {meal.items?.map((item: any, itemIndex: number) => (
                    <motion.div key={itemIndex} className="bg-white dark:bg-gray-700 p-3 rounded-lg">
                      <p
                        onClick={() => handleGenerateImage(item.name, "meal")}
                        className="font-semibold text-black dark:text-white cursor-pointer hover:text-[#10B981] transition"
                      >
                        {item.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.calories}cal • {item.protein_g}g protein
                      </p>
                      {generatingImage === item.name && (
                        <p className="mt-2 text-xs text-[#10B981]">Generating image...</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
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
          <h3 className="text-2xl font-bold text-[#2D5C44] dark:text-[#10B981] mb-6">Motivation Tips</h3>
          <div className="space-y-4">
            {plan.motivation_tips?.map((tip: string, index: number) => (
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

