import { toast } from "sonner"

export interface ApiErrorResponse {
  error?: string
  message?: string
  details?: string
  code?: string
}

/**
 * Checks if an error or HTTP response status indicates a quota / rate limit error.
 */
export function isQuotaExceededError(status?: number, errorObj?: ApiErrorResponse | string | null): boolean {
  if (status === 429) return true

  const errorStr = typeof errorObj === "string" 
    ? errorObj 
    : `${errorObj?.error || ""} ${errorObj?.message || ""} ${errorObj?.details || ""}`.toLowerCase()

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
 * Displays a sonner error toast tailored specifically for quota exceeded errors or general API failures.
 */
export function showQuotaExceededToast(customMessage?: string, featureName?: string) {
  const feature = featureName ? ` for ${featureName}` : ""
  const message =
    customMessage ||
    `API usage quota or rate limit exceeded${feature}. Please wait a moment or check your API key / plan.`

  toast.error("Quota Exceeded", {
    description: message,
    duration: 6000,
    action: {
      label: "Dismiss",
      onClick: () => toast.dismiss(),
    },
  })
}

/**
 * Helper to inspect a Fetch Response object, trigger a Toast if 429/quota error, and return the parsed JSON.
 */
export async function handleApiResponse<T = any>(
  response: Response,
  featureName?: string
): Promise<{ data: T | null; isQuotaError: boolean; error: string | null }> {
  let jsonData: ApiErrorResponse | any = null
  try {
    jsonData = await response.json()
  } catch {
    jsonData = null
  }

  if (response.status === 429 || isQuotaExceededError(response.status, jsonData)) {
    const msg =
      jsonData?.message ||
      jsonData?.error ||
      `API quota exceeded${featureName ? ` while generating ${featureName}` : ""}. Please try again later.`
    showQuotaExceededToast(msg, featureName)
    return { data: jsonData, isQuotaError: true, error: msg }
  }

  if (!response.ok) {
    const errorMsg = jsonData?.error || jsonData?.message || `Request failed with status ${response.status}`
    return { data: jsonData, isQuotaError: false, error: errorMsg }
  }

  return { data: jsonData, isQuotaError: false, error: null }
}
