import { Router, Request, Response } from "express"
import { pingMongo } from "../db/mongo.js"
import { pingRedis } from "../db/redis.js"
import { config } from "../config/index.js"

export const healthRouter = Router()

healthRouter.get("/live", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "UP",
    service: "ZenFit Auth & Core Service",
    version: "1.0.0",
    environment: config.environment,
    timestamp: new Date().toISOString(),
  })
})

healthRouter.get("/ready", async (_req: Request, res: Response) => {
  const mongoUp = await pingMongo()
  const redisUp = await pingRedis()

  // In test/dev, in-memory fallback is considered ready
  const isReady = config.environment !== "production" || mongoUp

  const status = isReady ? 200 : 503
  res.status(status).json({
    status: isReady ? "READY" : "NOT_READY",
    dependencies: {
      mongodb: mongoUp ? "UP" : (config.environment !== "production" ? "IN_MEMORY_FALLBACK" : "DOWN"),
      redis: redisUp ? "UP" : (config.environment !== "production" ? "IN_MEMORY_FALLBACK" : "DOWN"),
    },
    environment: config.environment,
    timestamp: new Date().toISOString(),
  })
})

healthRouter.get("/", (_req: Request, res: Response) => {
  res.redirect("/health/live")
})
