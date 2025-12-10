import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Mistral } from "@mistralai/mistralai"

// const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

const ai = new Mistral({
  apiKey: MISTRAL_API_KEY || "",
});

export async function POST(request: Request) {
  try {
    const userDetails = await request.json()
    const userId = userDetails.userId || `user_${Date.now()}`

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

    // const response = await fetch(
    //   "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    //   {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       "x-goog-api-key": GEMINI_API_KEY || "",
    //     },
    //     body: JSON.stringify({
    //       contents: [
    //         {
    //           parts: [
    //             {
    //               text: prompt,
    //             },
    //           ],
    //         },
    //       ],
    //     }),
    //   },
    // )

    const response = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: prompt,
        }
      ],
    });
    const data = response as any
    const responseText = data.choices[0].message.content?.toString() || ""

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const plan = JSON.parse(jsonMatch[0])

      // Store in MongoDB
      const { db } = await connectToDatabase()
      const plansCollection = db.collection("user_plans")

      await plansCollection.updateOne(
        { userId },
        {
          $set: {
            userId,
            formData: userDetails,
            plan,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          }
        },
        { upsert: true }
      )

      console.log(`[Plan API] Stored plan for user: ${userId}`)

      return NextResponse.json(plan)
    }

    throw new Error("Invalid response format")
  } catch (error) {
    console.error("Error generating plan:", error)
    return NextResponse.json({ error: "Failed to generate plan" }, { status: 500 })
  }
}
