import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import { createApp } from "../src/app.js"
import { getKeyManager } from "../src/security/keys.js"
import { signAccessToken } from "../src/security/jwt.js"

describe("Auth & Core Service — Milestones Domain", () => {
  const app = createApp()
  let userToken: string
  const userId = "usr_milestone_test_01"

  beforeAll(async () => {
    await getKeyManager()
    userToken = await signAccessToken({ userId, email: "milestone@zenfit.com" })
  })

  it("POST /v1/milestones should create a new achievement milestone", async () => {
    const res = await request(app)
      .post("/v1/milestones")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        content: "Completed 30 consecutive days of strength training!",
        userName: "Active Runner",
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.userId).toBe(userId)
    expect(res.body.content).toContain("30 consecutive days")
  })

  it("GET /v1/milestones should return milestones for the user", async () => {
    const res = await request(app)
      .get("/v1/milestones")
      .set("Authorization", `Bearer ${userToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body[0].userId).toBe(userId)
  })

  it("POST /v1/milestones for another user should be rejected (403)", async () => {
    const res = await request(app)
      .post("/v1/milestones")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        userId: "someone_else",
        content: "Forged achievement",
      })

    expect(res.status).toBe(403)
  })
})
