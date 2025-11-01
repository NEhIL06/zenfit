import { NextResponse } from "next/server"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

export async function POST(request: Request) {
  try {
    const userDetails = await request.json()

    const prompt = `You are a certified fitness coach and nutrition expert.
Given the user's details, generate a personalized 7-day workout and diet plan.

User details:
name: ${userDetails.name}
age: ${userDetails.age}
gender: ${userDetails.gender}
height: ${userDetails.height}cm
weight: ${userDetails.weight}kg
goal: ${userDetails.fitnessGoal}
level: ${userDetails.fitnessLevel}
location: ${userDetails.workoutLocation}
diet: ${userDetails.dietaryPreference}

Output JSON only in this format:
{
  "summary": "2-line motivational introduction for the user",
  "workout_plan": [
    { "day": "Day 1", "focus": "Upper Body", "exercises": [
      {"name":"Push Ups","sets":3,"reps":"12-15","rest_seconds":60}
    ]}
  ],
  "diet_plan": [
    { "meal": "Breakfast", "items": [
      {"name":"Oatmeal with banana","calories":350,"protein_g":18}
    ]}
  ],
  "motivation_tips": [
    "Stay consistent and trust the process!",
    "Small steps daily create big changes."
  ]
}`

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      },
    )

    const data = await response.json()
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const plan = JSON.parse(jsonMatch[0])
      return NextResponse.json(plan)
    }

    throw new Error("Invalid response format")
  } catch (error) {
    console.error("Error generating plan:", error)
    return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 })
  }
}
