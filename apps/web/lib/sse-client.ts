"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export interface SSEConnectedEvent {
  status: "connected"
  userId: string
  timestamp: number
}

export interface SSEJobCompletedEvent {
  job_id: string
  plan_id?: string
  status: "COMPLETED"
  timestamp: number
}

export interface SSEJobFailedEvent {
  job_id: string
  error: string
  timestamp: number
}

export interface SSEMilestoneUnlockedEvent {
  milestoneId: string
  content: string
  timestamp: number
}

export type ZenFitEvent =
  | { type: "connected"; data: SSEConnectedEvent }
  | { type: "job_completed"; data: SSEJobCompletedEvent }
  | { type: "job_failed"; data: SSEJobFailedEvent }
  | { type: "milestone_unlocked"; data: SSEMilestoneUnlockedEvent }

interface UseZenFitSSEOptions {
  userId?: string
  enabled?: boolean
  onJobCompleted?: (event: SSEJobCompletedEvent) => void
  onJobFailed?: (event: SSEJobFailedEvent) => void
  onMilestoneUnlocked?: (event: SSEMilestoneUnlockedEvent) => void
}

/**
 * React hook subscribing to ZenFit Go API Gateway real-time Server-Sent Events (SSE).
 * Bridges background Redis Pub/Sub workers (events:{userId}) directly into the client UI.
 */
export function useZenFitSSE(options: UseZenFitSSEOptions = {}) {
  const { userId, enabled = true, onJobCompleted, onJobFailed, onMilestoneUnlocked } = options
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [lastEvent, setLastEvent] = useState<ZenFitEvent | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const callbacksRef = useRef({ onJobCompleted, onJobFailed, onMilestoneUnlocked })
  useEffect(() => {
    callbacksRef.current = { onJobCompleted, onJobFailed, onMilestoneUnlocked }
  }, [onJobCompleted, onJobFailed, onMilestoneUnlocked])

  const connect = useCallback(() => {
    if (typeof window === "undefined" || !enabled) return

    // Clean up existing connection
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    // Connect to Go API Gateway SSE Hub (direct backend URL on Vercel or relative path locally)
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "")
    const endpoint = userId ? `/v1/events?userId=${encodeURIComponent(userId)}` : `/v1/events`
    const url = `${apiBase}${endpoint}`
    const es = new EventSource(url, { withCredentials: true })
    esRef.current = es

    es.addEventListener("connected", (event) => {
      try {
        const data: SSEConnectedEvent = JSON.parse(event.data)
        setIsConnected(true)
        setLastEvent({ type: "connected", data })
      } catch (err) {
        console.warn("[ZenFit SSE] Failed to parse connected event:", err)
      }
    })

    es.addEventListener("job_completed", (event) => {
      try {
        const data: SSEJobCompletedEvent = JSON.parse(event.data)
        setLastEvent({ type: "job_completed", data })
        callbacksRef.current.onJobCompleted?.(data)
      } catch (err) {
        console.warn("[ZenFit SSE] Failed to parse job_completed event:", err)
      }
    })

    es.addEventListener("job_failed", (event) => {
      try {
        const data: SSEJobFailedEvent = JSON.parse(event.data)
        setLastEvent({ type: "job_failed", data })
        callbacksRef.current.onJobFailed?.(data)
      } catch (err) {
        console.warn("[ZenFit SSE] Failed to parse job_failed event:", err)
      }
    })

    es.addEventListener("milestone_unlocked", (event) => {
      try {
        const data: SSEMilestoneUnlockedEvent = JSON.parse(event.data)
        setLastEvent({ type: "milestone_unlocked", data })
        callbacksRef.current.onMilestoneUnlocked?.(data)
      } catch (err) {
        console.warn("[ZenFit SSE] Failed to parse milestone_unlocked event:", err)
      }
    })

    es.onerror = () => {
      setIsConnected(false)
      es.close()
      esRef.current = null

      // Attempt automatic reconnection after 5 seconds
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) {
          connect()
        }
      }, 5000)
    }
  }, [enabled, userId])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
      setIsConnected(false)
    }
  }, [connect])

  return { isConnected, lastEvent }
}
