import { Router, Request, Response } from "express"
import { getDb } from "../db/mongo.js"
import { publishUserEvent } from "../db/redis.js"
import { MilestoneRequestSchema } from "../schemas/auth.schemas.js"
import { requireAuth } from "../middleware/auth.js"

export const milestonesRouter = Router()

/**
 * GET /v1/milestones
 * Retrieves user milestones with server-side indexing.
 */
milestonesRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  const authUser = req.user!
  const requestedUserId = req.query.userId as string | undefined

  if (requestedUserId && requestedUserId !== authUser.userId && authUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Cannot access milestones of another user" })
    return
  }

  const db = getDb()
  const filter = { userId: requestedUserId || authUser.userId }

  const milestones = await db
    .collection("milestones")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray()

  const sanitized = milestones.map((m: any) => ({
    ...m,
    id: m._id.toString(),
  }))

  res.status(200).json(sanitized)
})

/**
 * POST /v1/milestones
 * Records an achievement milestone for the authenticated user.
 */
milestonesRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  const authUser = req.user!
  const validation = MilestoneRequestSchema.safeParse(req.body)

  if (!validation.success) {
    res.status(400).json({
      error: "Bad Request",
      message: "Validation failed",
      details: validation.error.format(),
    })
    return
  }

  const { userName, content } = validation.data
  const userId = authUser.userId

  // Enforce ownership: users can only create milestones for themselves
  if (validation.data.userId && validation.data.userId !== userId && authUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Cannot create milestone for another user" })
    return
  }

  const db = getDb()
  const milestone = {
    userId,
    userName: userName || "Anonymous Fit",
    content,
    createdAt: new Date(),
    likes: 0,
  }

  const result = await db.collection("milestones").insertOne(milestone)

  // Broadcast milestone event via Redis Pub/Sub for real-time SSE delivery
  await publishUserEvent(userId, {
    type: "milestone_unlocked",
    milestoneId: result.insertedId.toString(),
    content,
    timestamp: Date.now(),
  })

  res.status(201).json({
    id: result.insertedId.toString(),
    ...milestone,
  })
})
