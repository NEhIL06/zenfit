"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { fetchPublicMilestones, createMilestone } from "@/lib/storage"

interface MilestonesTabProps {
  userId: string
  userName?: string
}

interface MilestoneData {
  _id?: string
  id?: string
  userId: string
  userName: string
  content: string
  createdAt: string
  likes?: number
}

export default function MilestonesTab({ userId, userName = "Anonymous" }: MilestonesTabProps) {
  const [milestones, setMilestones] = useState<MilestoneData[]>([])
  const [content, setContent] = useState("")
  const [posting, setPosting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMilestones()
  }, [])

  const fetchMilestones = async () => {
    try {
      setLoading(true)
      const publicMilestones = await fetchPublicMilestones()
      setMilestones(publicMilestones)
    } catch (error) {
      console.error("[v0] Failed to fetch milestones:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePostMilestone = async () => {
    if (!content.trim()) return

    setPosting(true)
    try {
      const newMilestone = await createMilestone(userId, userName, content)
      setMilestones([newMilestone, ...milestones])
      setContent("")
    } catch (error) {
      console.error("[v0] Failed to post milestone:", error)
      alert("Failed to post milestone")
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Post New Milestone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg"
      >
        <h3 className="text-xl font-bold text-black dark:text-white mb-4">Share Your Achievement</h3>
        <div className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your latest achievement..."
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981] resize-none"
          />
          <button
            onClick={handlePostMilestone}
            disabled={posting || !content.trim()}
            className="px-6 py-3 bg-[#10B981] text-white rounded-lg font-semibold hover:bg-[#0a9370] disabled:opacity-50"
          >
            {posting ? "Posting..." : "Post Milestone"}
          </button>
        </div>
      </motion.div>

      {/* Milestones Feed */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl">
            <p className="text-gray-600 dark:text-gray-300">Loading milestones...</p>
          </div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-2xl">
            <p className="text-gray-600 dark:text-gray-300">No milestones yet. Be the first to share!</p>
          </div>
        ) : (
          milestones.map((milestone, index) => (
            <motion.div
              key={milestone._id || milestone.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg border-l-4 border-[#10B981]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#2D5C44] dark:text-[#10B981] mb-2">
                    {milestone.userName || "Anonymous User"}
                  </p>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{milestone.content}</p>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-4 flex-shrink-0">
                  {new Date(milestone.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <button className="text-[#10B981] hover:text-[#0a9370] font-semibold text-sm flex items-center gap-1">
                  ❤️ Like {milestone.likes && milestone.likes > 0 && `(${milestone.likes})`}
                </button>
                <span className="text-gray-400">•</span>
                <button className="text-[#10B981] hover:text-[#0a9370] font-semibold text-sm">Comment</button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
