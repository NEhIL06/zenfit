export async function generateExerciseImage(exerciseName: string): Promise<string> {
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: exerciseName, type: "exercise" }),
    })

    const data = await response.json()
    return data.imageData || ""
  } catch (error) {
    console.error("Error generating image:", error)
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

    const data = await response.json()
    return data.imageData || ""
  } catch (error) {
    console.error("Error generating meal image:", error)
    throw error
  }
}
