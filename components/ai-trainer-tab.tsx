"use client"

import { useState } from "react"
import { motion } from "framer-motion"

interface AITrainerTabProps {
    userId: string
}

interface Message {
    role: "user" | "assistant"
    content: string
    id: string
    sources?: Array<{
        content: string
        score: number
        metadata: Record<string, unknown>
    }>
}

export default function AITrainerTab({ userId }: AITrainerTabProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)

    // Load history on mount
    useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`chat_history_${userId}`)
            if (saved) {
                try {
                    setMessages(JSON.parse(saved))
                } catch (e) {
                    console.error("Failed to parse chat history", e)
                }
            }
        }
    })

    // Save history when messages change
    const saveHistory = (newMessages: Message[]) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(`chat_history_${userId}`, JSON.stringify(newMessages))
        }
    }

    const sendMessage = async () => {
        if (!input.trim()) return

        const userMessage: Message = {
            role: "user",
            content: input,
            id: Date.now().toString()
        }

        const newMessages = [...messages, userMessage]
        setMessages(newMessages)
        saveHistory(newMessages)

        setInput("")
        setLoading(true)

        try {
            // Prepare history for API (exclude current message and limit to last 10)
            const history = messages.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            }))

            const response = await fetch("/api/ai-trainer/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: input,
                    chatHistory: history,
                    conversationId: "temp",
                    userId: userId,
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to get response")
            }

            const data = await response.json()

            const aiMessage: Message = {
                role: "assistant",
                content: data.response,
                sources: data.sources,
                id: Date.now().toString(),
            }

            const updatedMessages = [...newMessages, aiMessage]
            setMessages(updatedMessages)
            saveHistory(updatedMessages)
        } catch (error) {
            console.error("Error sending message:", error)
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "Sorry, I encountered an error. Please try again.",
                    id: Date.now().toString(),
                },
            ])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="h-[600px] flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-2xl font-bold text-black dark:text-white flex items-center gap-2">
                    <span>🤖</span> AI Fitness Trainer
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Ask me anything about fitness, nutrition, or exercise techniques
                </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
                        <span className="text-6xl mb-4 block">💪</span>
                        <p className="text-lg">Start a conversation with your AI trainer!</p>
                        <p className="text-sm mt-2">Try asking about exercises, nutrition, or workout plans.</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-4 ${msg.role === "user"
                                    ? "bg-[#2D5C44] dark:bg-[#10B981] text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-black dark:text-white"
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                                        <p className="text-xs text-gray-600 dark:text-gray-400">
                                            Sources: {msg.sources.length} documents
                                        </p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}

                {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex gap-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && !loading && sendMessage()}
                        placeholder="Ask about exercises, nutrition, form check..."
                        className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                        disabled={loading}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || loading}
                        className="px-6 py-3 bg-[#2D5C44] dark:bg-[#10B981] text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    )
}
