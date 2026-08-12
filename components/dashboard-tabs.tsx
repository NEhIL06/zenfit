"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import PlanTab from "@/components/plan-tab"
import MilestonesTab from "@/components/milestones-tab"
import AITrainerTab from "@/components/ai-trainer-tab"
import type { User } from "@/types/user"
import { Dumbbell, Trophy, Bot } from "lucide-react"

interface DashboardTabsProps {
  user: User
  onUserUpdate: (user: User) => void
}

export default function DashboardTabs({ user, onUserUpdate }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<"plan" | "milestones" | "ai-trainer">("plan")

  const tabs = [
    { id: "plan" as const, label: "My Fitness Plan", icon: Dumbbell, desc: "RAG Routine & Diet" },
    { id: "ai-trainer" as const, label: "AI Trainer Chat", icon: Bot, desc: "Multimodal Self-RAG" },
    { id: "milestones" as const, label: "Milestones Feed", icon: Trophy, desc: "Community Progress" },
  ]

  return (
    <div className="space-y-6">
      {/* Tab Pill Navigation */}
      <div className="bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl grid grid-cols-3 gap-2 shadow-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative z-10 py-3.5 px-3 sm:px-6 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 cursor-pointer ${
                isActive
                  ? "text-slate-950 font-extrabold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeDashboardTab"
                  className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-300 rounded-xl shadow-lg shadow-emerald-500/25 -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? "text-slate-950 stroke-[2.5]" : "text-emerald-400"}`} />
              <div className="text-left">
                <span className="block truncate">{tab.label}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Tab Content Display */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === "plan" && <PlanTab user={user} onUserUpdate={onUserUpdate} />}
        {activeTab === "milestones" && <MilestonesTab userId={user.id} userName={user.name} />}
        {activeTab === "ai-trainer" && <AITrainerTab userId={user.id} />}
      </motion.div>
    </div>
  )
}

