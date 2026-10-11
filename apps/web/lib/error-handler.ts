import { toast } from "sonner"
import { z } from "zod"
import type { ApiError } from "./schemas"

export type { ApiError }

/**
 * Safely serialize an unknown error for inclusion in an API response.
 *
 * In development: returns the raw error message to aid debugging.
 * In production:  returns a generic fallback string so internal details
 *                 (file paths, library versions, stack fragments) are never
 *                 sent to the client.
 *
 * Usage in route handlers:
 *   return NextResponse.json({
 *     error: "Internal Server Error",
 *     ...(isDev && { details: toSafeErrorMessage(error) }),
 *   }, { status: 500 })
 */
export function toSafeErrorMessage(error: unknown): string {
  if (process.env.NODE_ENV === "development") {
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    return String(error)
  }
  return "An unexpected error occurred. Please try again."
}

/**
 * Checks if an error or HTTP status indicates a quota / rate limit error.
 */
export function isQuotaExceededError(
  status?: number,
  errorObj?: Record<string, unknown> | string | null
): boolean {
  if (status === 429) return true

  const readText = (key: string): string => {
    if (!errorObj || typeof errorObj === "string") return ""
    const value = errorObj[key]
    return typeof value === "string" ? value : ""
  }

  const errorStr =
    typeof errorObj === "string"
      ? errorObj
      : `${readText("error")} ${readText("message")} ${readText("details")}`.toLowerCase()

  return (
    errorStr.includes("quota_exceeded") ||
    errorStr.includes("quota") ||
    errorStr.includes("rate limit") ||
    errorStr.includes("resource_exhausted") ||
    errorStr.includes("too many requests") ||
    errorStr.includes("exceeded your current quota")
  )
}

/**
 * Display a quota-exceeded error toast via Sonner.
 */
export function showQuotaExceededToast(customMessage?: string, featureName?: string) {
  const feature = featureName ? ` for ${featureName}` : ""
  const message =
    customMessage ||
    `API usage quota or rate limit exceeded${feature}. Please wait a moment or check your API key / plan.`

  toast.error("Quota Exceeded", {
    description: message,
    duration: 6000,
    action: { label: "Dismiss", onClick: () => toast.dismiss() },
  })
}

/**
 * Unified API response handler.
 *
 * Usage (with schema validation):
 *   const { data } = await handleApiResponse(res, "fitness plan", GeneratePlanResponseSchema)
 *
 * Usage (without schema):
 *   const { data } = await handleApiResponse(res, "feature name")
 *
 * Behaviour:
 *  1. Parses JSON — null on parse failure
 *  2. If 429 / quota error → shows toast, returns isQuotaError: true
 *  3. If !response.ok → returns error string
 *  4. If schema provided → validates response shape and warns on mismatch
 *     (non-blocking: doesn't prevent the data from being returned)
 *  5. Returns typed { data, isQuotaError, error }
 */
export async function handleApiResponse<T = unknown>(
  response: Response,
  featureName?: string,
  schema?: z.ZodSchema<T>
): Promise<{ data: T | null; isQuotaError: boolean; error: string | null }> {
  let jsonData: Record<string, unknown> | T | null = null
  try {
    jsonData = await response.json()
  } catch {
    jsonData = null
  }

  const quotaPayload =
    typeof jsonData === "string"
      ? jsonData
      : jsonData && typeof jsonData === "object"
        ? jsonData as Record<string, unknown>
        : null

  if (response.status === 429 || isQuotaExceededError(response.status, quotaPayload)) {
    const jsonObject = jsonData && typeof jsonData === "object" ? jsonData as Record<string, unknown> : {}
    const msg =
      (typeof jsonObject.message === "string" ? jsonObject.message : undefined) ||
      (typeof jsonObject.error === "string" ? jsonObject.error : undefined) ||
      `API quota exceeded${featureName ? ` while using ${featureName}` : ""}. Please try again later.`
    showQuotaExceededToast(msg, featureName)
    return { data: jsonData as T, isQuotaError: true, error: msg }
  }

  if (!response.ok) {
    const jsonObject = jsonData && typeof jsonData === "object" ? jsonData as Record<string, unknown> : {}
    const errorMsg =
      (typeof jsonObject.error === "string" ? jsonObject.error : undefined) ||
      (typeof jsonObject.message === "string" ? jsonObject.message : undefined) ||
      `Request failed with status ${response.status}`
    return { data: jsonData as T, isQuotaError: false, error: errorMsg }
  }

  // Schema validation — warns on mismatch but does not block data return.
  // This means a partial schema deviation (e.g. an optional field missing) won't
  // break the UI while still surfacing the drift in console for debugging.
  if (schema && jsonData !== null) {
    const parseResult = schema.safeParse(jsonData)
    if (!parseResult.success) {
      const warnings = parseResult.error.errors
        .map(e => `${e.path.join(".")}: ${e.message}`)
        .join(", ")
      console.warn(
        `[Client Zod] Response schema mismatch for "${featureName || "API"}": ${warnings}`
      )
    }
  }

  return { data: jsonData as T, isQuotaError: false, error: null }
}
