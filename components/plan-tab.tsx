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

export default function PlanTab({ user, onUserUpdate }: PlanTabProps) {
  const [regenerating, setRegenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ type: "exercise" | "meal"; name: string } | null>(null)
  const [voiceUrls, setVoiceUrls] = useState<{ [key: string]: string }>({})
  const [generatingImage, setGeneratingImage] = useState<string | null>(null)

  const plan = user.plan

  const handleRegenerate = async () => {
    if (!confirm("This will regenerate your plan. Continue?")) return

    setRegenerating(true)
    try {
      const newPlan = await generateFitnessPlan(user)
      const updatedUser = { ...user, plan: newPlan }
      updateUser(user.id, { plan: newPlan })
      onUserUpdate(updatedUser)
    } catch (error) {
      console.error("[v0] Failed to regenerate plan:", error)
      alert("Failed to regenerate plan")
    } finally {
      setRegenerating(false)
    }
  }

  const handleRegenerateMealPlan = async () => {
    if (!confirm("This will regenerate your meal plan. Continue?")) return

    setRegenerating(true)
    try {
      const newPlan = await generateFitnessPlan(user)
      const updatedPlan = {
        ...plan,
        diet_plan: newPlan.diet_plan,
      }
      const updatedUser = { ...user, plan: updatedPlan }
      updateUser(user.id, { plan: updatedPlan })
      onUserUpdate(updatedUser)
    } catch (error) {
      console.error("[v0] Failed to regenerate meal plan:", error)
      alert("Failed to regenerate meal plan")
    } finally {
      setRegenerating(false)
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const element = document.getElementById("plan-content")
      if (!element) return

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
      alert("Failed to export PDF")
    } finally {
      setExporting(false)
    }
  }

  const handleGenerateImage = async (name: string, type: "exercise" | "meal") => {
    setGeneratingImage(name)
    try {
      const imageData = await generateImage(name, type)
      if (imageData) {
        setSelectedImage({ type, name })
      }
    } catch (error) {
      console.error("[v0] Error generating image:", error)
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

  return (
    <div className="space-y-8">
      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-linear-to-r from-[#2D5C44] to-primary-dark dark:from-[#10B981] dark:to-[#0a7a5e] text-white rounded-2xl p-8"
      >
        <h2 className="text-2xl font-bold mb-4">Your Personalized Plan</h2>
        <p className="text-lg leading-relaxed">{plan.summary}</p>
      </motion.div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#0a9370] disabled:opacity-50"
        >
          {regenerating ? "Regenerating..." : "Regenerate Plan"}
        </button>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
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
            <VoicePlayer content={JSON.stringify(plan.workout_plan)} type="workout" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plan.workout_plan?.map((day:any, index: number) => (
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
            <VoicePlayer content={JSON.stringify(plan.diet_plan)} type="diet" />
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

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleRegenerateMealPlan}
              disabled={regenerating}
              className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#0a9370] disabled:opacity-50"
            >
              {regenerating ? "Regenerating..." : "Regenerate Meal Plan"}
            </button>
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
                <div className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center flex-shrink-0 font-bold">
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
