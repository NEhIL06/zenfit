/**
 * Shared types for AI Trainer feature
 */

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  sources?: DocumentSource[]
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface DocumentSource {
  content: string
  score: number
  metadata: {
    filename?: string
    userId?: string
    pageNumber?: number
    [key: string]: unknown
  }
}

export interface AITrainerConversation {
  id: string
  userId: string
  title?: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

export interface FitnessDocument {
  id: string
  userId?: string // null for global documents
  title: string
  content: string
  fileUrl?: string
  metadata?: Record<string, unknown>
  chromaId: string
  createdAt: Date
}

export interface SelfRAGState {
  question: string
  generation: string
  documents: string[]
  webSearch?: boolean
  retryCount?: number
}

export interface SelfRAGResponse {
  generation: string
  sources: DocumentSource[]
  images?: string[]
  conversationId: string
}
