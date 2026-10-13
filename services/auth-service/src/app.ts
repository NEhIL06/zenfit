import express, { Express } from "express"
import cors from "cors"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import { config } from "./config/index.js"
import { requestIdMiddleware, requestLogger, errorHandler } from "./middleware/error-handler.js"
import { optionalAuth } from "./middleware/auth.js"
import { healthRouter } from "./routes/health.routes.js"
import { authRouter } from "./routes/auth.routes.js"
import { usersRouter } from "./routes/users.routes.js"
import { milestonesRouter } from "./routes/milestones.routes.js"

export function createApp(): Express {
  const app = express()

  // 1. Core Security & Parsing Middleware
  app.use(helmet())
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-User-Id", "X-User-Role", "X-User-Email"],
    })
  )
  app.use(cookieParser())
  app.use(express.json({ limit: "2mb" }))
  app.use(express.urlencoded({ extended: true, limit: "2mb" }))

  // 2. Correlation ID & Observability
  app.use(requestIdMiddleware)
  app.use(requestLogger)

  // 3. Optional Authentication Context (extracts user if present)
  app.use(optionalAuth)

  // 4. Mount Health Probes
  app.use("/health", healthRouter)

  // 5. JWKS RFC 7517 Discovery endpoint for Gateway & Microservices
  app.get("/.well-known/jwks.json", async (_req, res) => {
    try {
      const { getJwks } = await import("./security/keys.js")
      const jwks = await getJwks()
      res.setHeader("Cache-Control", "public, max-age=3600")
      res.status(200).json(jwks)
    } catch (err: any) {
      res.status(500).json({ error: "Failed to generate JWKS", message: err.message })
    }
  })

  // 6. Mount Domain Routes (both /v1 and /api legacy aliases for backward compatibility)
  app.use("/v1/auth", authRouter)
  app.use("/api/auth", authRouter)
  app.use("/.well-known", authRouter)

  app.use("/v1/users", usersRouter)
  app.use("/api/users", usersRouter)

  app.use("/v1/milestones", milestonesRouter)
  app.use("/api/milestones", milestonesRouter)

  // 6. Centralized Error Handler
  app.use(errorHandler)

  return app
}
