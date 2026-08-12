import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { getMistralClient } from "@/lib/mistral"
import { clearPattern, CacheKeys } from "@/lib/cache"
import { isQuotaExceededError, toSafeErrorMessage } from "@/lib/error-handler"
import { requireAuthUser } from "@/lib/api-security"
import { checkRateLimit } from "@/lib/rate-limiter"
import { GeneratePlanRequestSchema, GeneratePlanResponseSchema, validateRequest, validateResponse, type GeneratePlanResponse } from "@/lib/schemas"
import { logger } from "@/lib/logger"



// requestContents: 
// flow: zod -> check auth -> rate limit -> prompt engineering -> mistral -> store in db -> clear cache -> return response
export async function POST(request: Request) {
  try {
    const auth = await requireAuthUser(request)
    if (!auth.ok) return auth.response

    const body = await request.json()

    // 1. Zod Request Validation
    const validation = validateRequest(GeneratePlanRequestSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const userDetails = validation.data
    const userId = auth.user.userId

    // 2. Rate Limiting Check
    const rateLimit = await checkRateLimit(`plan_${userId}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "QUOTA_EXCEEDED", message: "Plan generation rate limit exceeded. Please wait a minute." },
        { status: 429 }
      )
    }

    // 3. Structured Prompt Engineering (CSCS & Nutrition Rules)
    const prompt = `You are a CSCS-certified strength coach and registered dietitian.
Generate a structured 7-day personalized workout and diet plan for the following client:

Client Profile:
- Age: ${userDetails.age}
- Gender: ${userDetails.gender}
- Height: ${userDetails.height}cm
- Weight: ${userDetails.weight}kg
- Fitness Goal: ${userDetails.fitnessGoal}
- Experience Level: ${userDetails.experienceLevel}
- Workout Location: ${userDetails.workoutLocation}
- Dietary Preference: ${userDetails.dietaryPreference || 'Standard'}

RULES & CONSTRAINTS:
1. Calculate TDEE using Mifflin-St Jeor equation.
2. Set daily calorie & macro targets tailored to goal:
   - Weight Loss: TDEE - 500 kcal (40% Protein / 30% Carbs / 30% Fat)
   - Muscle Gain: TDEE + 300 kcal (30% Protein / 45% Carbs / 25% Fat)
   - Maintenance: TDEE (30% Protein / 40% Carbs / 30% Fat)
3. For ${userDetails.experienceLevel}:
   - Beginner: 3 training days (Full Body), rest days placed between training days
   - Intermediate: 4 training days (Upper/Lower Split)
   - Advanced: 5-6 training days (Push/Pull/Legs Split)
4. Include RPE (Rate of Perceived Exertion 1-10) for each exercise.

OUTPUT FORMAT (JSON Object ONLY):
{
  "summary": "2-line motivational introduction tailored specifically to their goal of ${userDetails.fitnessGoal} at ${userDetails.workoutLocation}.",
  "workout_plan": [
    {
      "day": "Day 1",
      "focus": "Full Body Strength",
      "exercises": [
        { 
          "name": "Bodyweight Squats", 
          "sets": 3, 
          "reps": "12-15", 
          "rest_seconds": 60, 
          "rest": "60s", 
          "rpe": 7, 
          "notes": "Keep chest elevated and push through heels" 
        }
      ]
    }
  ],
  "diet_plan": [
    {
      "meal": "Breakfast",
      "items": [
        {
          "name": "High-Protein Oatmeal with Greek Yogurt & Berries",
          "calories": 450,
          "protein_g": 35,
          "protein": "35g"
        }
      ]
    },
    {
      "meal": "Lunch",
      "items": [
        {
          "name": "Grilled Chicken Breast with Quinoa & Roasted Greens",
          "calories": 600,
          "protein_g": 48,
          "protein": "48g"
        }
      ]
    },
    {
      "meal": "Dinner",
      "items": [
        {
          "name": "Baked Salmon with Sweet Potato & Asparagus",
          "calories": 550,
          "protein_g": 40,
          "protein": "40g"
        }
      ]
    },
    {
      "meal": "Snack",
      "items": [
        {
          "name": "Whey Protein Shake with Almonds",
          "calories": 250,
          "protein_g": 25,
          "protein": "25g"
        }
      ]
    }
  ],
  "motivation_tips": [
    "Specific actionable tip 1 aligned with ${userDetails.fitnessGoal} and ${userDetails.experienceLevel} level",
    "Specific actionable tip 2 for workout execution at ${userDetails.workoutLocation}",
    "Specific actionable tip 3 for dietary consistency following ${userDetails.dietaryPreference || 'Standard'} preference"
  ],
  "recommendations": [
    "Specific actionable tip 1 aligned with ${userDetails.fitnessGoal} and ${userDetails.experienceLevel} level",
    "Specific actionable tip 2 for workout execution at ${userDetails.workoutLocation}",
    "Specific actionable tip 3 for dietary consistency following ${userDetails.dietaryPreference || 'Standard'} preference"
  ]
}`

    // 4. Structured JSON Output from Mistral Client
    const ai = getMistralClient()
    const response = await ai.chat.complete({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
    })

    const responseText = response.choices[0]?.message?.content?.toString() ?? ""

    // Wrap JSON.parse — Mistral (especially smaller models under load) can return
    // malformed or truncated JSON. An unhandled SyntaxError here becomes a
    // cryptic 500; returning a 502 with a clear message is far better UX.
    let plan: unknown
    try {
      plan = JSON.parse(responseText)
    } catch {
      console.error("[Plan API] Mistral returned non-JSON response:", responseText.slice(0, 200))
      return NextResponse.json(
        { error: "The AI returned an invalid response. Please try again." },
        { status: 502 }
      )
    }

    // 5. Store Plan in MongoDB
    let planToReturn: unknown = plan
    try {
      const { db } = await connectToDatabase()
      const plansCollection = db.collection("user_plans")
      const { regenerationScope } = userDetails
      const profileForStorage = {
        age: userDetails.age,
        gender: userDetails.gender,
        height: userDetails.height,
        weight: userDetails.weight,
        fitnessGoal: userDetails.fitnessGoal,
        experienceLevel: userDetails.experienceLevel,
        workoutLocation: userDetails.workoutLocation,
        dietaryPreference: userDetails.dietaryPreference,
      }

      if (regenerationScope === "diet") {
        const existingPlanDoc = await plansCollection.findOne({ userId })
        const generatedPlan = plan as Partial<GeneratePlanResponse>
        const generatedDietPlan = generatedPlan.diet_plan
        if (existingPlanDoc?.plan && Array.isArray(generatedDietPlan)) {
          planToReturn = {
            ...existingPlanDoc.plan,
            diet_plan: generatedDietPlan,
            recommendations: generatedPlan.recommendations ?? existingPlanDoc.plan.recommendations,
            motivation_tips: generatedPlan.motivation_tips ?? existingPlanDoc.plan.motivation_tips,
          }
        }
      }

      await plansCollection.updateOne(
        { userId },
        {
          $set: {
            userId,
            formData: { ...profileForStorage, userId },
            plan: planToReturn,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      )
      logger.info({ userId }, '[Plan API] Stored plan in MongoDB')
    } catch (dbErr) {
      logger.warn({ err: toSafeErrorMessage(dbErr) }, '[Plan API] Database write skipped')
    }

    // 6. Purge Stale User RAG Cache
    const deleted = await clearPattern(CacheKeys.userRagPattern(userId))
    if (deleted > 0) {
      logger.info({ userId, deleted }, '[Plan API] Purged stale RAG cache entries')
    }

    // 7. Zod Response Validation
    const resValidation = validateResponse(GeneratePlanResponseSchema, planToReturn)
    if (!resValidation.success) {
      logger.warn({ issues: resValidation.error }, '[Plan API] Response schema mismatch')
    }

    return NextResponse.json(planToReturn, { status: 200 })

  } catch (error: unknown) {
    logger.error({ err: toSafeErrorMessage(error) }, '[Plan API] Unhandled error')
    const err = error as { status?: number; message?: string }
    if (isQuotaExceededError(err?.status, err)) {
      return NextResponse.json(
        {
          error: "QUOTA_EXCEEDED",
          message: "Fitness plan generation rate limit or API quota exceeded. Please try again later.",
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: "Failed to generate plan",
        ...(process.env.NODE_ENV === 'development' && { details: toSafeErrorMessage(error) }),
      },
      { status: 500 }
    )
  }
}
