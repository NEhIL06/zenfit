import { handleApiResponse, showQuotaExceededToast } from "./error-handler"

export async function generateExerciseImage(exerciseName: string): Promise<string> {
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: exerciseName, type: "exercise" }),
    })

    const { data, isQuotaError, error } = await handleApiResponse(response, `exercise image (${exerciseName})`)
    if (isQuotaError || error) {
      if (!isQuotaError && error) {
        showQuotaExceededToast(error, `exercise image (${exerciseName})`)
      }
      return ""
    }

    return data?.imageData || ""
  } catch (error) {
    console.error("Error generating exercise image:", error)
    showQuotaExceededToast("Failed to connect to image generation service.", `exercise image (${exerciseName})`)
    throw error
  }
}

export async function generateMealImage(mealName: string): Promise<string> {
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: mealName, type: "meal" }),
    })

    const { data, isQuotaError, error } = await handleApiResponse(response, `meal image (${mealName})`)
    if (isQuotaError || error) {
      if (!isQuotaError && error) {
        showQuotaExceededToast(error, `meal image (${mealName})`)
      }
      return ""
    }

    return data?.imageData || ""
  } catch (error) {
    console.error("Error generating meal image:", error)
    showQuotaExceededToast("Failed to connect to image generation service.", `meal image (${mealName})`)
    throw error
  }
}
