import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectToDatabase } from "@/lib/mongodb"
import { UserLoginSchema, UserLoginResponseSchema, validateRequest, validateResponse } from "@/lib/schemas"
import { signJwtToken } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { getClientIp } from "@/lib/api-security"
import { toSafeErrorMessage } from "@/lib/error-handler"
import { logger } from "@/lib/logger"

export async function POST(request: Request) {
  try {
    // SECURITY: Rate-limit login by IP to prevent brute-force password attacks
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(`login_${ip}`)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a moment and try again." },
        { status: 429 }
      )
    }

    const body = await request.json()

    // 1. Zod request validation
    const validation = validateRequest(UserLoginSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { password } = validation.data
    const email = validation.data.email.toLowerCase().trim()
    const { db } = await connectToDatabase()
    const usersCollection = db.collection("users")

    // 2. Find user
    const user = await usersCollection.findOne({ "formData.email": email })
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // 3. Verify password
    const passwordHash = user.formData?.password
    if (!passwordHash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const isValidPassword = await bcrypt.compare(password, passwordHash)
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const userId = user._id.toString()
    const fullName = user.formData?.fullName || "User"

    // 4. Issue JWT Token
    const token = await signJwtToken({
      userId,
      email,
      fullName,
    })

    // SECURITY: Token is transmitted ONLY via the httpOnly cookie set below.
    // Do NOT include it in the JSON body — that would make it accessible to
    // JavaScript (and therefore XSS scripts), defeating the purpose of httpOnly.
    const responsePayload = {
      message: "Login successful",
      user: {
        id: userId,
        email,
        fullName,
      },
    }

    // 5. Zod response validation
    const resValidation = validateResponse(UserLoginResponseSchema, responsePayload)
    if (!resValidation.success) {
      logger.warn({ issues: resValidation.error }, "[Login Route] Response validation warning")
    }

    const response = NextResponse.json(responsePayload, { status: 200 })

    // 6. Set httpOnly cookie
    response.cookies.set("zenfit_auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    })

    return response
  } catch (error: unknown) {
    logger.error({ err: toSafeErrorMessage(error) }, "[ZenFit Auth Login] Error")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
