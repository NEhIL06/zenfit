import jwt, { SignOptions, VerifyOptions } from "jsonwebtoken"
import crypto from "crypto"
import { config } from "../config/index.js"
import { getKeyManager } from "./keys.js"
import { isTokenRevoked } from "../db/redis.js"

export interface TokenPayload {
  userId: string
  email: string
  role?: string
  fullName?: string
  jti?: string
}

export interface VerifiedClaims extends TokenPayload {
  sub: string
  iat: number
  exp: number
}

/**
 * Signs an RS256 asymmetric JWT access token.
 */
export async function signAccessToken(payload: TokenPayload): Promise<string> {
  const km = await getKeyManager()
  const jti = payload.jti || crypto.randomUUID()

  const signOptions: SignOptions = {
    algorithm: "RS256",
    keyid: km.kid,
    expiresIn: config.jwtAccessExpiry as any,
    subject: payload.userId,
    issuer: "zenfit-auth-service",
    audience: "zenfit-ecosystem",
  }

  const token = jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      role: payload.role || "user",
      fullName: payload.fullName,
      jti,
    },
    km.privateKeyPem,
    signOptions
  )

  return token
}

/**
 * Generates an opaque, cryptographically secure 256-bit refresh token.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

/**
 * Verifies an inbound JWT token.
 * Validates RS256 signature using public key, with HS256 fallback for migration compatibility.
 * Checks Redis revocation denylist.
 */
export async function verifyToken(tokenStr: string): Promise<VerifiedClaims> {
  const km = await getKeyManager()

  // Decode unverified header to check algorithm
  const decodedHeader = jwt.decode(tokenStr, { complete: true })
  if (!decodedHeader || typeof decodedHeader !== "object") {
    throw new Error("Invalid token format")
  }

  const alg = decodedHeader.header.alg

  let payload: any

  if (alg === "RS256") {
    payload = jwt.verify(tokenStr, km.publicKeyPem, {
      algorithms: ["RS256"],
    } as VerifyOptions)
  } else if (alg === "HS256") {
    // Legacy migration fallback (ADR 15.13)
    payload = jwt.verify(tokenStr, config.jwtSecret, {
      algorithms: ["HS256"],
    } as VerifyOptions)
  } else {
    throw new Error(`Unsupported token algorithm: ${alg}`)
  }

  const claims: VerifiedClaims = {
    userId: payload.userId || payload.sub,
    email: payload.email || "",
    role: payload.role || "user",
    fullName: payload.fullName,
    jti: payload.jti,
    sub: payload.sub || payload.userId,
    iat: payload.iat,
    exp: payload.exp,
  }

  // Check if token or user has been revoked in Redis
  const revoked = await isTokenRevoked(claims.userId, claims.jti)
  if (revoked) {
    throw new Error("Token has been revoked")
  }

  return claims
}
