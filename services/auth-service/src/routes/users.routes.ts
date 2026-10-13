import { Router, Request, Response } from "express"
import { ObjectId } from "mongodb"
import { getDb } from "../db/mongo.js"
import { UserProfileUpdateSchema } from "../schemas/auth.schemas.js"
import { requireAuth } from "../middleware/auth.js"

export const usersRouter = Router()

function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id)
}

function sanitizeUser(user: any): any {
  if (!user) return null
  const { formData, ...rest } = user
  if (formData) {
    const { password: _pw, ...safeFormData } = formData
    return {
      ...rest,
      id: user._id?.toString(),
      _id: user._id?.toString(),
      formData: safeFormData,
    }
  }
  return {
    ...rest,
    id: user._id?.toString(),
    _id: user._id?.toString(),
  }
}

/**
 * GET /v1/users
 * Returns user profile by ID, email, or authenticated session.
 */
usersRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  const authUser = req.user!
  const targetId = req.query.id as string | undefined
  const targetEmail = req.query.email as string | undefined

  const db = getDb()
  const usersCollection = db.collection("users")

  let user: any = null

  if (targetId) {
    if (!isValidObjectId(targetId)) {
      res.status(400).json({ error: "Invalid user ID format" })
      return
    }
    if (authUser.userId !== targetId && authUser.role !== "admin") {
      res.status(403).json({ error: "Forbidden: Cannot access another user's profile" })
      return
    }
    user = await usersCollection.findOne({ _id: new ObjectId(targetId) })
  } else if (targetEmail) {
    const normalizedEmail = targetEmail.toLowerCase().trim()
    if (authUser.email.toLowerCase() !== normalizedEmail && authUser.role !== "admin") {
      res.status(403).json({ error: "Forbidden: Cannot access another user's profile" })
      return
    }
    user = await usersCollection.findOne({ "formData.email": normalizedEmail })
  } else {
    // Current authenticated session
    user = await usersCollection.findOne({ _id: new ObjectId(authUser.userId) })
  }

  if (!user) {
    res.status(404).json({ error: "User not found" })
    return
  }

  // Check if plan exists in user_plans
  let plan = user.formData?.plan || user.plan
  if (!plan) {
    try {
      const planDoc = await db.collection("user_plans").findOne({ userId: user._id.toString() })
      if (planDoc?.plan) {
        plan = planDoc.plan
      }
    } catch {
      // ignore
    }
  }

  const sanitized = sanitizeUser(user)
  sanitized.plan = plan

  res.status(200).json(sanitized)
})

/**
 * GET /v1/users/:id
 * Fetches user profile by ID with strict ownership check.
 */
usersRouter.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const authUser = req.user!
  const targetId = req.params.id

  if (!isValidObjectId(targetId)) {
    res.status(400).json({ error: "Invalid user ID format" })
    return
  }

  if (authUser.userId !== targetId && authUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Cannot access another user's profile" })
    return
  }

  const db = getDb()
  const usersCollection = db.collection("users")

  const user = await usersCollection.findOne({ _id: new ObjectId(targetId) })
  if (!user) {
    res.status(404).json({ error: "User not found" })
    return
  }

  let plan = user.formData?.plan || user.plan
  if (!plan) {
    try {
      const planDoc = await db.collection("user_plans").findOne({ userId: targetId })
      if (planDoc?.plan) {
        plan = planDoc.plan
      }
    } catch {
      // ignore
    }
  }

  const sanitized = sanitizeUser(user)
  sanitized.plan = plan

  res.status(200).json(sanitized)
})

/**
 * PATCH /v1/users/:id & PUT /v1/users/:id
 * Strictly updates user profile attributes (enums, biometrics, goals).
 */
usersRouter.all(["/:id"], async (req: Request, res: Response, next) => {
  if (req.method !== "PATCH" && req.method !== "PUT") {
    return next()
  }

  const authUser = req.user
  if (!authUser) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const targetId = req.params.id
  if (!isValidObjectId(targetId)) {
    res.status(400).json({ error: "Invalid user ID format" })
    return
  }

  if (authUser.userId !== targetId && authUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Cannot update another user's profile" })
    return
  }

  const rawBody = req.body.formData || req.body
  const validation = UserProfileUpdateSchema.safeParse(rawBody)

  if (!validation.success) {
    res.status(400).json({
      error: "Bad Request",
      message: "Invalid profile update fields",
      details: validation.error.format(),
    })
    return
  }

  const updates = validation.data
  const db = getDb()
  const usersCollection = db.collection("users")

  const updateDoc: Record<string, any> = {}
  for (const [key, val] of Object.entries(updates)) {
    updateDoc[`formData.${key}`] = val
  }
  updateDoc["updatedAt"] = new Date()

  const updatedUser = await usersCollection.findOneAndUpdate(
    { _id: new ObjectId(targetId) },
    { $set: updateDoc },
    { returnDocument: "after" }
  )

  if (!updatedUser) {
    res.status(404).json({ error: "User not found" })
    return
  }

  res.status(200).json(sanitizeUser(updatedUser))
})

/**
 * GET /v1/users/:id/plan
 * Fetches the user's generated workout & nutrition plan.
 */
usersRouter.get("/:id/plan", requireAuth, async (req: Request, res: Response) => {
  const authUser = req.user!
  const targetId = req.params.id

  if (authUser.userId !== targetId && authUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Cannot view another user's plan" })
    return
  }

  const db = getDb()
  const planDoc = await db.collection("user_plans").findOne({ userId: targetId })

  if (!planDoc || !planDoc.plan) {
    res.status(404).json({ error: "No plan found for user", userId: targetId })
    return
  }

  res.status(200).json({
    userId: targetId,
    plan: planDoc.plan,
    updatedAt: planDoc.updatedAt || planDoc.createdAt,
  })
})

/**
 * PUT /v1/users/:id/plan
 * Saves or updates plan directly in user_plans (owned by Auth & Core).
 */
usersRouter.put("/:id/plan", requireAuth, async (req: Request, res: Response) => {
  const authUser = req.user!
  const targetId = req.params.id

  if (authUser.userId !== targetId && authUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Cannot modify another user's plan" })
    return
  }

  const plan = req.body.plan || req.body
  const db = getDb()

  await db.collection("user_plans").findOneAndUpdate(
    { userId: targetId },
    {
      $set: {
        userId: targetId,
        plan,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  )

  res.status(200).json({
    message: "Plan updated successfully",
    userId: targetId,
  })
})
