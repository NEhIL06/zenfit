"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { handleApiResponse } from "@/lib/error-handler"
import { GenerateImageResponseSchema, ChatResponseSchema, TranscribeResponseSchema } from "@/lib/schemas"

interface AITrainerTabProps {
    userId: string
}

interface Message {
    role: "user" | "assistant"
    content: string
    id: string
    image?: string  // Base64 image data
    sources?: Array<{
        content: string
        source?: string
    }>
}

export default function AITrainerTab({ userId }: AITrainerTabProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)

    // Load history on mount
    useEffect(() => {
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
    }, [userId])

    // Save history when messages change
    const saveHistory = (newMessages: Message[]) => {
        if (typeof window !== 'undefined') {
            // Filter out base64 images to save space in localStorage
            const historyToSave = newMessages.map(msg => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { image, ...rest } = msg
                return rest
            })
            try {
                localStorage.setItem(`chat_history_${userId}`, JSON.stringify(historyToSave))
            } catch (e) {
                console.error("Failed to save chat history to localStorage", e)
            }
        }
    }

    // Helper: Check if user wants to see an image
    const shouldGenerateImage = (text: string): { generate: boolean, name?: string, type?: "exercise" | "meal" } => {
        const lowerText = text.toLowerCase()
        const imageKeywords = ["show me", "image of", "picture of", "what does", "how does", "visualization", "visualize", "generate", "create"]
        const hasImageKeyword = imageKeywords.some(keyword => lowerText.includes(keyword))

        if (!hasImageKeyword) return { generate: false }

        // Extract the item name (simple extraction)
        const exerciseKeywords = ["exercise", "workout", "pushup", "pullup", "situp", "squat", "plank", "deadlift", "bench press", "sitdown", "barbell"]
        const mealKeywords = ["meal", "food", "dish", "recipe", "breakfast", "lunch", "dinner", "mealplan"]

        const isExercise = exerciseKeywords.some(k => lowerText.includes(k))
        const isMeal = mealKeywords.some(k => lowerText.includes(k))

        if (isExercise || isMeal) {
            // Extract name after "show me" or similar phrases
            let name = text
            for (const keyword of imageKeywords) {
                if (lowerText.includes(keyword)) {
                    const parts = text.split(new RegExp(keyword, 'i'))
                    if (parts[1]) {
                        name = parts[1].trim().replace(/[?.!]/g, '')
                        break
                    }
                }
            }
            return { generate: true, name, type: isExercise ? "exercise" : "meal" }
        }

        return { generate: false }
    }

    const sendMessage = async () => {
        if (!input.trim() && !selectedImage) return

        const userMessage: Message = {
            role: "user",
            content: input,
            id: Date.now().toString(),
            image: selectedImage || undefined
        }

        const newMessages = [...messages, userMessage]
        setMessages(newMessages)
        saveHistory(newMessages)

        const currentInput = input
        const currentImage = selectedImage
        setInput("")
        setSelectedImage(null)
        setLoading(true)

        try {
            // Check if user wants to see an image
            const imageRequest = shouldGenerateImage(currentInput)

            if (imageRequest.generate && imageRequest.name && imageRequest.type) {
                // Generate image instead of text response
                const imageResponse = await fetch("/api/generate-image", {
                    method: "POST",
                    credentials: 'include',
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: imageRequest.name, type: imageRequest.type }),
                })

                const { data: imageData, isQuotaError } = await handleApiResponse(imageResponse, "image request", GenerateImageResponseSchema)
                if (isQuotaError || !imageData?.imageData) {
                    throw new Error("Quota exceeded or failed to generate image")
                }

                const aiMessage: Message = {
                    role: "assistant",
                    content: `Here's an image of ${imageRequest.name}:`,
                    image: imageData.imageData,
                    id: Date.now().toString(),
                }

                const updatedMessages = [...newMessages, aiMessage]
                setMessages(updatedMessages)
                saveHistory(updatedMessages)
            } else {
                // Normal text response with optional image context
                const history = messages.slice(-10).map(m => ({
                    role: m.role,
                    content: m.content
                }))

                const response = await fetch("/api/ai-trainer/chat", {
                    method: "POST",
                    credentials: 'include',
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: currentInput,
                        images: currentImage ? [currentImage] : undefined,
                        chatHistory: history,
                        conversationId: "temp",
                        userId: userId,
                    }),
                })

                const { data, isQuotaError, error } = await handleApiResponse(response, "AI trainer chat", ChatResponseSchema)
                if (isQuotaError) {
                    throw new Error("Quota exceeded for AI trainer chat")
                }
                if (!response.ok || !data?.response) {
                    throw new Error(error || "Failed to get response")
                }

                const aiMessage: Message = {
                    role: "assistant",
                    content: data.response,
                    sources: data.sources,
                    id: Date.now().toString(),
                }

                const updatedMessages = [...newMessages, aiMessage]
                setMessages(updatedMessages)
                saveHistory(updatedMessages)
            }
        } catch (error: any) {
            console.error("Error sending message:", error)
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: error?.message?.includes("Quota exceeded")
                        ? "API Quota Exceeded. Please try again later or check your API key / plan."
                        : "Sorry, I encountered an error. Please try again.",
                    id: Date.now().toString(),
                },
            ])
        } finally {
            setLoading(false)
        }
    }

    const [isRecording, setIsRecording] = useState(false)
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const recorder = new MediaRecorder(stream)
            const chunks: BlobPart[] = []

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data)
                }
            }

            recorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' })
                const formData = new FormData()
                formData.append('file', blob, 'recording.webm')

                setLoading(true)
                try {
                    const response = await fetch('/api/transcribe', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData,
                    })

                    const { data, isQuotaError, error } = await handleApiResponse(response, "audio transcription", TranscribeResponseSchema)
                    if (isQuotaError || !data?.text) {
                        throw new Error(error || "Transcription failed")
                    }

                    setInput((prev) => (prev ? `${prev} ${data.text}` : data.text))
                } catch (error) {
                    console.error('Error transcribing:', error)
                } finally {
                    setLoading(false)
                    stream.getTracks().forEach(track => track.stop())
                }
            }

            recorder.start()
            setMediaRecorder(recorder)
            setIsRecording(true)
        } catch (error) {
            console.error('Error accessing microphone:', error)
        }
    }

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop()
            setIsRecording(false)
            setMediaRecorder(null)
        }
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onloadend = () => {
            const base64 = reader.result as string
            setSelectedImage(base64)
        }
        reader.readAsDataURL(file)
    }

    const removeImage = () => {
        setSelectedImage(null)
    }

    const suggestionChips = [
        "🏋️ Squat form & posture check",
        "🥗 High protein dinner recommendation",
        "🔥 Best 30-min HIIT workout for home",
        "📸 Show me an image of a barbell deadlift",
    ]

    return (
        <div className="h-[640px] flex flex-col backdrop-blur-2xl bg-slate-900/85 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative font-sans">
            {/* Header */}
            <div className="p-5 sm:px-8 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 text-base sm:text-lg">🤖</span>
                        AI Trainer Engine
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        Powered by LangGraph Self-RAG, Cohere Reranker & Chroma Vector Database
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Online RAG Agent
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center py-12 px-4 max-w-md mx-auto">
                        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/30 flex items-center justify-center text-4xl mb-4 shadow-lg shadow-emerald-500/10">
                            💪
                        </div>
                        <h3 className="text-xl font-extrabold text-white">Ask Anything to Your AI Trainer</h3>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1 mb-6">
                            Get personalized advice on workouts, diet recipes, or request images & voice narrations.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {suggestionChips.map((chip, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setInput(chip)
                                    }}
                                    className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition text-left cursor-pointer"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
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
                                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 sm:p-5 text-sm leading-relaxed shadow-lg ${
                                    msg.role === "user"
                                        ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-semibold"
                                        : "bg-slate-950/90 border border-slate-800 text-slate-200"
                                }`}
                            >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                {msg.image && (
                                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-800 bg-black">
                                        <img
                                            src={msg.image}
                                            alt="Uploaded or generated visual check"
                                            className="max-h-64 sm:max-h-80 w-full object-contain"
                                        />
                                    </div>
                                )}
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                        <span className="font-semibold text-emerald-400">📚 Verified RAG Knowledge</span>
                                        <span>{msg.sources.length} Vector Passages</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}

                {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-bounce" />
                                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                            </div>
                            <span className="text-xs font-semibold text-slate-400">AI Self-RAG reasoning...</span>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Input Controls Footer */}
            <div className="p-3 sm:p-5 border-t border-slate-800 bg-slate-950/90 space-y-3">
                {/* Image Preview Thumbnail */}
                {selectedImage && (
                    <div className="relative inline-block">
                        <img src={selectedImage} alt="Selected preview" className="h-20 rounded-xl border border-emerald-500/50 object-cover" />
                        <button
                            onClick={removeImage}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-600 shadow"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div className="flex gap-2 items-center">
                    {/* Camera Button */}
                    <label className="cursor-pointer">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={loading}
                        />
                        <div className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition flex items-center justify-center text-lg">
                            📷
                        </div>
                    </label>

                    {/* Mic Button */}
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={loading && !isRecording}
                        className={`p-3 rounded-xl font-bold transition flex items-center justify-center text-lg ${
                            isRecording
                                ? "bg-red-500 text-white animate-pulse"
                                : "bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                        }`}
                        title={isRecording ? "Stop Recording" : "Voice Input"}
                    >
                        {isRecording ? "⏹" : "🎤"}
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage()}
                        placeholder="Ask about workout split, calories, or request an exercise image..."
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs sm:text-sm font-medium transition"
                        disabled={loading}
                    />

                    <button
                        onClick={sendMessage}
                        disabled={(!input.trim() && !selectedImage) || loading}
                        className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 rounded-xl font-extrabold text-xs sm:text-sm hover:from-emerald-400 hover:to-teal-300 disabled:opacity-40 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    )
}

