"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import PlanTab from "@/components/plan-tab"
import MilestonesTab from "@/components/milestones-tab"
import type { User } from "@/types/user"

interface DashboardTabsProps {
  user: User
  onUserUpdate: (user: User) => void
}

export default function DashboardTabs({ user, onUserUpdate }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<"plan" | "milestones">("plan")

  const tabs = [
    { id: "plan", label: "My Plan", icon: "📋" },
    { id: "milestones", label: "Milestones", icon: "🏆" },
  ]

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex gap-4 mb-8 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "plan" | "milestones")}
            className={`pb-4 px-4 font-semibold transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "text-[#2D5C44] dark:text-[#10B981] border-b-2 border-[#2D5C44] dark:border-[#10B981]"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === "plan" && <PlanTab user={user} onUserUpdate={onUserUpdate} />}
        {activeTab === "milestones" && <MilestonesTab userId={user.id} />}
      </motion.div>
    </div>
  )
}
