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
    image?: string  // Base64 image data
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
    const [selectedImage, setSelectedImage] = useState<string | null>(null)

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

    // Helper: Check if user wants to see an image
    const shouldGenerateImage = (text: string): { generate: boolean, name?: string, type?: "exercise" | "meal" } => {
        const lowerText = text.toLowerCase()
        const imageKeywords = ["show me", "image of", "picture of", "what does", "how does", "visualization", "visualize","generate","create"]
        const hasImageKeyword = imageKeywords.some(keyword => lowerText.includes(keyword))

        if (!hasImageKeyword) return { generate: false }

        // Extract the item name (simple extraction)
        const exerciseKeywords = ["exercise", "workout", "pushup","pullup", "situp", "squat", "plank", "deadlift", "bench press","sitdown","barbell"]
        const mealKeywords = ["meal", "food", "dish", "recipe", "breakfast", "lunch", "dinner","mealplan"]

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
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: imageRequest.name, type: imageRequest.type, currentInput: currentInput }),
                })

                const imageData = await imageResponse.json()

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
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: currentInput,
                        images: currentImage ? [currentImage] : undefined,
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
            }
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
                        body: formData,
                    })

                    if (!response.ok) throw new Error('Transcription failed')

                    const data = await response.json()
                    setInput((prev) => (prev ? `${prev} ${data.text}` : data.text))
                } catch (error) {
                    console.error('Error transcribing:', error)
                    // Optional: Show error toast
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
                                {msg.image && (
                                    <img
                                        src={msg.image}
                                        alt="Uploaded or generated"
                                        className="mt-2 max-w-full rounded-lg"
                                    />
                                )}
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
                {/* Image Preview */}
                {selectedImage && (
                    <div className="mb-2 relative inline-block">
                        <img src={selectedImage} alt="Selected" className="max-h-32 rounded-lg" />
                        <button
                            onClick={removeImage}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div className="flex gap-2">
                    {/* Image Upload Button */}
                    <label className="cursor-pointer">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={loading}
                        />
                        <div className="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center">
                            📷
                        </div>
                    </label>

                    {/* Mic Button */}
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={loading && !isRecording}
                        className={`px-4 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center ${isRecording
                            ? "bg-red-500 text-white animate-pulse"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                            }`}
                    >
                        {isRecording ? "⏹" : "🎤"}
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && !loading && sendMessage()}
                        placeholder="Ask about exercises, nutrition, or upload a form check image..."
                        className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2D5C44] dark:focus:ring-[#10B981]"
                        disabled={loading}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={(!input.trim() && !selectedImage) || loading}
                        className="px-6 py-3 bg-[#2D5C44] dark:bg-[#10B981] text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    )
}
