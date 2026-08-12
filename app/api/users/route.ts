import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { ObjectId } from "mongodb"
import { connectToDatabase } from "@/lib/mongodb"
import { UserSignupSchema, validateRequest, validateResponse, UserSignupResponseSchema } from "@/lib/schemas"
import { getAuthUserFromRequest, signJwtToken } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { z } from "zod"
import { getClientIp } from "@/lib/api-security"
import { toSafeErrorMessage } from "@/lib/error-handler"
import { logger } from "@/lib/logger"

/** Validate that a string is a valid MongoDB ObjectId (24-char hex) */
function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id)
}
// Signup 
export async function POST(request: Request) {
  try {
    // Rate limit signup endpoint (prevent account spam)
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(`signup_${ip}`)
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many signup attempts. Please try again later." }, { status: 429 })
    }

    const body = await request.json()

    // 1. Zod request validation
    const validation = validateRequest(UserSignupSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { formData: rawFormData } = validation.data
    const formData = {
      ...rawFormData,
      email: rawFormData.email.toLowerCase().trim(),
    }
    const { db } = await connectToDatabase()
    const usersCollection = db.collection("users")

    // 2. Check existing user
    const existingUser = await usersCollection.findOne({ "formData.email": formData.email })
    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 })
    }

    // 3. Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(formData.password, 12)

    // 4. Save user with hashed password
    const safeFormData = {
      ...formData,
      password: hashedPassword,
    }

    const result = await usersCollection.insertOne({
      formData: safeFormData,
      createdAt: new Date(),
    })

    const userId = result.insertedId.toString()

    // 5. Issue JWT Token
    const token = await signJwtToken({
      userId,
      email: formData.email,
      fullName: formData.fullName,
    })

    const responsePayload = {
      message: "User created successfully",
      userId,
    }

    // 6. Zod response validation
    const resValidation = validateResponse(UserSignupResponseSchema, responsePayload)
    if (!resValidation.success) {
      logger.warn({ issues: resValidation.error }, "[Signup Route] Response validation warning")
    }

    const response = NextResponse.json(responsePayload, { status: 201 })

    // Set httpOnly auth cookie
    response.cookies.set("zenfit_auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    })

    return response
  } catch (error) {
    logger.error({ err: toSafeErrorMessage(error) }, "[ZenFit] Error creating user")
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}



//Signin
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")
    const id = searchParams.get("id")
    const authUser = await getAuthUserFromRequest(request)

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized", message: "Authentication required" }, { status: 401 })
    }

    const { db } = await connectToDatabase()
    const usersCollection = db.collection("users")

    let user: any = null

    if (id) {
      // 🔐 P1: Validate ObjectId before querying — prevents MongoDB injection via malformed IDs
      if (!isValidObjectId(id)) {
        return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 })
      }
      if (authUser.userId !== id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      user = await usersCollection.findOne({ _id: new ObjectId(id) })
    } else if (email) {
      // Validate email format
      const emailSchema = z.string().email()
      const emailResult = emailSchema.safeParse(email)
      if (!emailResult.success) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
      }
      const normalizedEmail = emailResult.data.toLowerCase().trim()
      if (authUser.email.toLowerCase() !== normalizedEmail) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      user = await usersCollection.findOne({ "formData.email": normalizedEmail })
    } else {
      if (!isValidObjectId(authUser.userId)) {
        return NextResponse.json({ error: "Invalid session user ID" }, { status: 401 })
      }
      user = await usersCollection.findOne({ _id: new ObjectId(authUser.userId) })
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if plan exists in user_plans collection if not directly attached
    let plan = user.formData?.plan || user.plan
    if (!plan) {
      try {
        const userPlanDoc = await db.collection("user_plans").findOne({ userId: user._id.toString() })
        if (userPlanDoc?.plan) {
          plan = userPlanDoc.plan
        }
      } catch (pErr) {
      logger.warn({ err: toSafeErrorMessage(pErr) }, "[Users API] Error fetching plan for user")
      }
    }

    // Strip password hash from returned user record
    const { password, ...safeFormData } = user.formData || {}
    const safeUser = {
      ...user,
      _id: user._id.toString(),
      formData: safeFormData,
      plan,
    }

    return NextResponse.json(safeUser)
  } catch (error) {
    logger.error({ err: toSafeErrorMessage(error) }, "[ZenFit] Error fetching user")
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}
