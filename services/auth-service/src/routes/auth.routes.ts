import { Router, Request, Response } from "express"
import { getDb } from "../db/mongo.js"
import { storeRefreshToken, verifyRefreshToken, revokeRefreshToken, revokeUserSessions } from "../db/redis.js"
import { hashPassword, comparePassword } from "../security/password.js"
import { signAccessToken, generateRefreshToken } from "../security/jwt.js"
import { getJwks } from "../security/keys.js"
import { UserSignupSchema, UserLoginSchema } from "../schemas/auth.schemas.js"
import { createRateLimiter } from "../middleware/rate-limit.js"
import { requireAuth } from "../middleware/auth.js"
import { config } from "../config/index.js"

export const authRouter = Router()

const authRateLimiter = createRateLimiter(10, 60)

/**
 * GET /.well-known/jwks.json & GET /jwks
 * Exposes the public keys for the Go API Gateway and microservices.
 */
authRouter.get(["/.well-known/jwks.json", "/jwks"], async (_req: Request, res: Response) => {
  try {
    const jwks = await getJwks()
    res.setHeader("Cache-Control", "public, max-age=3600")
    res.status(200).json(jwks)
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate JWKS", message: err.message })
  }
})

/**
 * POST /register (alias: /signup)
 */
authRouter.post(["/register", "/signup"], authRateLimiter, async (req: Request, res: Response) => {
  const validation = UserSignupSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: "Bad Request",
      message: "Validation failed",
      details: validation.error.format(),
      code: "VALIDATION_ERROR",
      requestId: req.requestId,
    })
    return
  }

  const raw = validation.data
  const formData = raw.formData
    ? { ...raw.formData }
    : {
        fullName: raw.fullName!,
        email: raw.email!,
        password: raw.password!,
      }

  const email = formData.email.toLowerCase().trim()
  const db = getDb()
  const usersCollection = db.collection("users")

  // Check if user already exists
  const existing = await usersCollection.findOne({ "formData.email": email })
  if (existing) {
    res.status(409).json({
      error: "Conflict",
      message: "User with this email already exists",
      code: "USER_EXISTS",
      requestId: req.requestId,
    })
    return
  }

  // Hash password
  const hashedPassword = await hashPassword(formData.password)
  const safeFormData = {
    ...formData,
    email,
    password: hashedPassword,
  }

  const result = await usersCollection.insertOne({
    formData: safeFormData,
    createdAt: new Date(),
  })

  const userId = result.insertedId.toString()

  // Generate tokens
  const accessToken = await signAccessToken({
    userId,
    email,
    role: "user",
    fullName: safeFormData.fullName,
  })

  const refreshToken = generateRefreshToken()
  await storeRefreshToken(userId, refreshToken, config.jwtRefreshExpiryDays * 24 * 60 * 60)

  // Set httpOnly cookies
  res.cookie(config.cookieName, accessToken, {
    httpOnly: true,
    secure: config.environment === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  })

  res.cookie(config.refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: config.environment === "production",
    sameSite: "lax",
    maxAge: config.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
    path: "/v1/auth",
  })

  res.status(201).json({
    message: "User created successfully",
    userId,
    token: config.environment === "test" ? accessToken : undefined, // Provided in tests for programmatic header inspection
    user: {
      id: userId,
      email,
      fullName: safeFormData.fullName,
    },
  })
})

/**
 * POST /login
 */
authRouter.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  const validation = UserLoginSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({
      error: "Bad Request",
      message: "Validation failed",
      details: validation.error.format(),
      code: "VALIDATION_ERROR",
      requestId: req.requestId,
    })
    return
  }

  const { password } = validation.data
  const email = validation.data.email.toLowerCase().trim()

  const db = getDb()
  const usersCollection = db.collection("users")

  const user = await usersCollection.findOne({ "formData.email": email })
  if (!user || !user.formData?.password) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid credentials",
      code: "INVALID_CREDENTIALS",
      requestId: req.requestId,
    })
    return
  }

  const isValidPassword = await comparePassword(password, user.formData.password)
  if (!isValidPassword) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid credentials",
      code: "INVALID_CREDENTIALS",
      requestId: req.requestId,
    })
    return
  }

  const userId = user._id.toString()
  const fullName = user.formData.fullName || "User"

  // Issue RS256 Access Token + Refresh Token
  const accessToken = await signAccessToken({
    userId,
    email,
    role: "user",
    fullName,
  })

  const refreshToken = generateRefreshToken()
  await storeRefreshToken(userId, refreshToken, config.jwtRefreshExpiryDays * 24 * 60 * 60)

  // Set httpOnly cookies
  res.cookie(config.cookieName, accessToken, {
    httpOnly: true,
    secure: config.environment === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  })

  res.cookie(config.refreshCookieName, refreshToken, {
    httpOnly: true,
    secure: config.environment === "production",
    sameSite: "lax",
    maxAge: config.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
    path: "/v1/auth",
  })

  res.status(200).json({
    message: "Login successful",
    token: config.environment === "test" ? accessToken : undefined,
    user: {
      id: userId,
      email,
      fullName,
    },
  })
})

/**
 * POST /logout
 */
authRouter.post("/logout", async (req: Request, res: Response) => {
  const user = req.user
  if (user) {
    // Revoke all active sessions in Redis denylist
    await revokeUserSessions(user.userId)
  }

  const refreshToken = req.cookies?.[config.refreshCookieName] || req.body?.refreshToken
  if (user && refreshToken) {
    await revokeRefreshToken(user.userId, refreshToken)
  }

  res.clearCookie(config.cookieName, { path: "/" })
  res.clearCookie(config.refreshCookieName, { path: "/v1/auth" })

  res.status(200).json({
    message: "Logged out successfully",
  })
})

/**
 * POST /refresh
 */
authRouter.post("/refresh", async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[config.refreshCookieName] || req.body?.refreshToken
  const userId = req.body?.userId || req.user?.userId

  if (!refreshToken || !userId) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Refresh token and userId required",
      code: "REFRESH_TOKEN_REQUIRED",
    })
    return
  }

  const isValid = await verifyRefreshToken(userId, refreshToken)
  if (!isValid) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired refresh token",
      code: "INVALID_REFRESH_TOKEN",
    })
    return
  }

  // Revoke old refresh token (Token Rotation)
  await revokeRefreshToken(userId, refreshToken)

  // Fetch user to confirm status
  const db = getDb()
  const user = await db.collection("users").findOne({ _id: userId as any })
  const email = user?.formData?.email || ""
  const fullName = user?.formData?.fullName || "User"

  // Issue new access token + rotated refresh token
  const newAccessToken = await signAccessToken({
    userId,
    email,
    role: "user",
    fullName,
  })

  const newRefreshToken = generateRefreshToken()
  await storeRefreshToken(userId, newRefreshToken, config.jwtRefreshExpiryDays * 24 * 60 * 60)

  res.cookie(config.cookieName, newAccessToken, {
    httpOnly: true,
    secure: config.environment === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  })

  res.cookie(config.refreshCookieName, newRefreshToken, {
    httpOnly: true,
    secure: config.environment === "production",
    sameSite: "lax",
    maxAge: config.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
    path: "/v1/auth",
  })

  res.status(200).json({
    message: "Token refreshed successfully",
    token: config.environment === "test" ? newAccessToken : undefined,
  })
})

/**
 * GET /me
 */
authRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const db = getDb()
  const user = await db.collection("users").findOne({ _id: userId as any })

  if (!user) {
    res.status(404).json({
      error: "NotFound",
      message: "User not found",
    })
    return
  }

  const { password, ...safeFormData } = user.formData || {}
  res.status(200).json({
    id: user._id.toString(),
    ...user,
    _id: user._id.toString(),
    formData: safeFormData,
  })
})
