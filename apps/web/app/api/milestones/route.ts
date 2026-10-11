import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { getAuthUserFromRequest } from "@/lib/auth"
import { MilestoneRequestSchema, validateRequest } from "@/lib/schemas"
import { toSafeErrorMessage } from "@/lib/error-handler"
import { logger } from "@/lib/logger"

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get("userId")
    if (requestedUserId && requestedUserId !== authUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { db } = await connectToDatabase()
    const milestonesCollection = db.collection("milestones")

    // If userId is provided, filter server-side (O(1) index lookup).
    // Without it, return all milestones (public feed — still auth-gated).
    const filter = { userId: authUser.userId }

    const milestones = await milestonesCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    const sanitized = milestones.map(m => ({
      ...m,
      id: m._id.toString(),
    }))

    return NextResponse.json(sanitized)
  } catch (error) {
    logger.error({ err: toSafeErrorMessage(error) }, "[Milestones API] GET error")
    return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validation = validateRequest(MilestoneRequestSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { userName, content } = validation.data
    const userId = authUser.userId

    //SECURITY: The authenticated user can only create milestones for themselves
    if (validation.data.userId && validation.data.userId !== authUser.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { db } = await connectToDatabase()
    const milestonesCollection = db.collection("milestones")

    const milestone = {
      userId,
      userName: userName ?? "Anonymous Fit",
      content,
      createdAt: new Date(),
      likes: 0,
    }

    const result = await milestonesCollection.insertOne(milestone)

    return NextResponse.json({
      id: result.insertedId.toString(),
      ...milestone,
    })
  } catch (error) {
    logger.error({ err: toSafeErrorMessage(error) }, "[Milestones API] POST error")
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 })
  }
}
