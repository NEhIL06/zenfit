import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { getAuthUserFromRequest } from "@/lib/auth"
import { UserProfileUpdateSchema, validateRequest } from "@/lib/schemas"

type MongoDocument = Record<string, unknown> & { formData?: Record<string, unknown> }

function sanitizeUser(user: MongoDocument | null): MongoDocument | null {
  if (!user) return null
  const { formData, ...rest } = user
  if (formData) {
    const { password: _pw, ...safeFormData } = formData
    return { ...rest, formData: safeFormData }
  }
  return rest
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 })
    }

    // SECURITY: Require authentication — the old `authUser &&` condition allowed
    // unauthenticated callers to bypass the ownership check entirely.
    const authUser = await getAuthUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (authUser.userId !== id) {
      return NextResponse.json({ error: "Forbidden: Cannot update another user's profile" }, { status: 403 })
    }

    const body = await request.json()

    // SECURITY: Validate update fields against strict schema to prevent
    // arbitrary field injection (e.g. overwriting password hash with plaintext).
    const validation = validateRequest(UserProfileUpdateSchema, body.formData ?? body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const updates = validation.data
    const { db } = await connectToDatabase()
    const usersCollection = db.collection("users")

    // Construct update query — merge validated fields into formData namespace
    const updateDoc: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      updateDoc[`formData.${key}`] = value
    }
    updateDoc["updatedAt"] = new Date()

    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateDoc },
      { returnDocument: "after" }
    )

    const updatedUser = (result as any)?.value || result
    if (!updatedUser || !(updatedUser as any)._id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(sanitizeUser(updatedUser))
  } catch (error) {
    console.error("[ZenFit] Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 })
    }

    // SECURITY: Require authentication and ownership — prevent PII leakage to
    // unauthenticated or cross-user requests.
    const authUser = await getAuthUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (authUser.userId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { db } = await connectToDatabase()
    const usersCollection = db.collection("users")

    let user = await usersCollection.findOne({ _id: new ObjectId(id) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.plan && !user.formData?.plan) {
      const userPlanDoc = await db.collection("user_plans").findOne({ userId: id })
      if (userPlanDoc?.plan) {
        user = { ...user, plan: userPlanDoc.plan }
      }
    }

    return NextResponse.json(sanitizeUser(user))
  } catch (error) {
    console.error("[ZenFit] Error fetching user:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}
