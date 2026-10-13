import { Request, Response, NextFunction } from "express"
import { verifyToken, VerifiedClaims } from "../security/jwt.js"
import { config } from "../config/index.js"

export interface AuthenticatedUser {
  userId: string
  email: string
  role: string
  fullName?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
      requestId?: string
    }
  }
}

/**
 * Extracts and verifies user authentication from Gateway headers, cookies, or Bearer header.
 */
export async function authenticateRequest(req: Request): Promise<AuthenticatedUser | null> {
  // 1. Check Gateway-injected headers (Zero-Trust boundary)
  const gatewayUserId = req.headers["x-user-id"] as string
  if (gatewayUserId) {
    return {
      userId: gatewayUserId,
      email: (req.headers["x-user-email"] as string) || "",
      role: (req.headers["x-user-role"] as string) || "user",
    }
  }

  // 2. Check httpOnly cookie
  let tokenStr = req.cookies?.[config.cookieName]

  // 3. Check Authorization: Bearer <token>
  if (!tokenStr && req.headers.authorization) {
    const authHeader = req.headers.authorization
    if (authHeader.startsWith("Bearer ")) {
      tokenStr = authHeader.substring(7).trim()
    }
  }

  if (!tokenStr) {
    return null
  }

  try {
    const claims = await verifyToken(tokenStr)
    return {
      userId: claims.userId,
      email: claims.email,
      role: claims.role || "user",
      fullName: claims.fullName,
    }
  } catch (err) {
    return null
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await authenticateRequest(req)
  if (!user) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required",
      code: "AUTH_REQUIRED",
      requestId: req.requestId,
    })
    return
  }
  req.user = user
  next()
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const user = await authenticateRequest(req)
  if (user) {
    req.user = user
  }
  next()
}
