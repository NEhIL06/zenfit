import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import { createApp } from "../src/app.js"
import { getKeyManager, getJwks } from "../src/security/keys.js"
import { verifyToken } from "../src/security/jwt.js"

describe("Auth & Core Service — Authentication & JWKS", () => {
  const app = createApp()
  let authCookie: string
  let refreshTokenCookie: string
  let testUserId: string
  const testEmail = `test_${Date.now()}@zenfit.com`
  const testPassword = "StrongPassword123!"

  beforeAll(async () => {
    await getKeyManager()
  })

  it("GET /.well-known/jwks.json should return valid RFC 7517 JWKS", async () => {
    const res = await request(app).get("/.well-known/jwks.json")
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty("keys")
    expect(Array.isArray(res.body.keys)).toBe(true)
    expect(res.body.keys.length).toBeGreaterThan(0)

    const key = res.body.keys[0]
    expect(key.kty).toBe("RSA")
    expect(key.alg).toBe("RS256")
    expect(key.use).toBe("sig")
    expect(key.kid).toBeDefined()
    expect(key.n).toBeDefined()
    expect(key.e).toBeDefined()
  })

  it("POST /v1/auth/register should create user and set httpOnly cookies", async () => {
    const res = await request(app)
      .post("/v1/auth/register")
      .send({
        formData: {
          fullName: "Staff Engineer Test",
          email: testEmail,
          password: testPassword,
          fitnessGoal: "Muscle Gain",
        },
      })

    expect(res.status).toBe(201)
    expect(res.body.message).toBe("User created successfully")
    expect(res.body.userId).toBeDefined()
    expect(res.body.user.email).toBe(testEmail)
    expect(res.body.user.password).toBeUndefined() // Password must never leak

    testUserId = res.body.userId

    // Inspect cookies
    const cookies = res.headers["set-cookie"]
    expect(cookies).toBeDefined()
    expect(cookies.some((c: string) => c.includes("zenfit_auth_token"))).toBe(true)
    expect(cookies.some((c: string) => c.includes("zenfit_refresh_token"))).toBe(true)
    expect(cookies.some((c: string) => c.includes("HttpOnly"))).toBe(true)
  })

  it("POST /v1/auth/register with duplicate email should return 409 Conflict", async () => {
    const res = await request(app)
      .post("/v1/auth/register")
      .send({
        formData: {
          fullName: "Duplicate User",
          email: testEmail,
          password: testPassword,
        },
      })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe("Conflict")
  })

  it("POST /v1/auth/login with valid credentials should succeed", async () => {
    const res = await request(app)
      .post("/v1/auth/login")
      .send({
        email: testEmail,
        password: testPassword,
      })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Login successful")
    expect(res.body.user.id).toBe(testUserId)

    const cookies = res.headers["set-cookie"]
    authCookie = cookies.find((c: string) => c.includes("zenfit_auth_token"))!
    refreshTokenCookie = cookies.find((c: string) => c.includes("zenfit_refresh_token"))!
    expect(authCookie).toBeDefined()
  })

  it("POST /v1/auth/login with wrong password should return 401 Unauthorized", async () => {
    const res = await request(app)
      .post("/v1/auth/login")
      .send({
        email: testEmail,
        password: "WrongPassword999!",
      })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe("Unauthorized")
  })

  it("RS256 JWT Token should be cryptographically verifiable", async () => {
    const tokenMatch = authCookie.match(/zenfit_auth_token=([^;]+)/)
    expect(tokenMatch).not.toBeNull()
    const token = tokenMatch![1]

    const claims = await verifyToken(token)
    expect(claims.userId).toBe(testUserId)
    expect(claims.email).toBe(testEmail)
    expect(claims.role).toBe("user")
  })

  it("GET /v1/auth/me with cookie should return profile", async () => {
    const res = await request(app)
      .get("/v1/auth/me")
      .set("Cookie", [authCookie])

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(testUserId)
    expect(res.body.formData.email).toBe(testEmail)
    expect(res.body.formData.password).toBeUndefined()
  })

  it("POST /v1/auth/logout should clear cookies and revoke token", async () => {
    const res = await request(app)
      .post("/v1/auth/logout")
      .set("Cookie", [authCookie, refreshTokenCookie])

    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Logged out successfully")

    const cookies = res.headers["set-cookie"]
    expect(cookies.some((c: string) => c.includes("zenfit_auth_token=;"))).toBe(true)
  })
})
