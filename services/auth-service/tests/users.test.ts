import { describe, it, expect, beforeAll } from "vitest"
import request from "supertest"
import { createApp } from "../src/app.js"
import { getKeyManager } from "../src/security/keys.js"
import { signAccessToken } from "../src/security/jwt.js"

describe("Auth & Core Service — Users Domain", () => {
  const app = createApp()
  let user1Token: string
  let user1Id: string
  let user2Token: string
  let user2Id: string

  beforeAll(async () => {
    await getKeyManager()

    // Create User 1
    const res1 = await request(app)
      .post("/v1/auth/register")
      .send({
        formData: {
          fullName: "User One",
          email: `user1_${Date.now()}@zenfit.com`,
          password: "Password123!",
          fitnessGoal: "Weight Loss",
        },
      })
    user1Id = res1.body.userId
    user1Token = await signAccessToken({ userId: user1Id, email: "user1@zenfit.com" })

    // Create User 2
    const res2 = await request(app)
      .post("/v1/auth/register")
      .send({
        formData: {
          fullName: "User Two",
          email: `user2_${Date.now()}@zenfit.com`,
          password: "Password123!",
          fitnessGoal: "Muscle Gain",
        },
      })
    user2Id = res2.body.userId
    user2Token = await signAccessToken({ userId: user2Id, email: "user2@zenfit.com" })
  })

  it("GET /v1/users/:id with matching auth token should succeed", async () => {
    const res = await request(app)
      .get(`/v1/users/${user1Id}`)
      .set("Authorization", `Bearer ${user1Token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(user1Id)
    expect(res.body.formData.fullName).toBe("User One")
    expect(res.body.formData.password).toBeUndefined()
  })

  it("GET /v1/users/:id for another user should return 403 Forbidden", async () => {
    const res = await request(app)
      .get(`/v1/users/${user1Id}`)
      .set("Authorization", `Bearer ${user2Token}`)

    expect(res.status).toBe(403)
    expect(res.body.error).toContain("Forbidden")
  })

  it("PATCH /v1/users/:id should update profile with valid fields", async () => {
    const res = await request(app)
      .patch(`/v1/users/${user1Id}`)
      .set("Authorization", `Bearer ${user1Token}`)
      .send({
        fitnessGoal: "Endurance",
        experienceLevel: "Intermediate",
      })

    expect(res.status).toBe(200)
    expect(res.body.formData.fitnessGoal).toBe("Endurance")
    expect(res.body.formData.experienceLevel).toBe("Intermediate")
  })

  it("PATCH /v1/users/:id with unknown/injected fields should return 400 Bad Request", async () => {
    const res = await request(app)
      .patch(`/v1/users/${user1Id}`)
      .set("Authorization", `Bearer ${user1Token}`)
      .send({
        injectedAdminField: true,
      })

    expect(res.status).toBe(400)
  })

  it("PUT /v1/users/:id/plan should save and retrieve plan", async () => {
    const planPayload = {
      workoutPlan: [{ day: "Monday", focus: "Chest & Triceps" }],
      dietPlan: { dailyCalories: 2400 },
    }

    const saveRes = await request(app)
      .put(`/v1/users/${user1Id}/plan`)
      .set("Authorization", `Bearer ${user1Token}`)
      .send(planPayload)

    expect(saveRes.status).toBe(200)
    expect(saveRes.body.message).toContain("Plan updated")

    const getRes = await request(app)
      .get(`/v1/users/${user1Id}/plan`)
      .set("Authorization", `Bearer ${user1Token}`)

    expect(getRes.status).toBe(200)
    expect(getRes.body.plan.workoutPlan[0].focus).toBe("Chest & Triceps")
  })

  it("Supports Gateway-injected headers (X-User-Id) directly", async () => {
    const res = await request(app)
      .get(`/v1/users/${user1Id}`)
      .set("X-User-Id", user1Id)
      .set("X-User-Role", "user")

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(user1Id)
  })
})
