import { createApp } from "./app.js"
import { config } from "./config/index.js"
import { connectToMongo, closeMongo } from "./db/mongo.js"
import { getKeyManager } from "./security/keys.js"

async function bootstrap() {
  console.log(`[ZenFit Auth & Core] Bootstrapping in ${config.environment} mode...`)

  // 1. Initialize RSA Key Manager & verify JWKS generation
  const km = await getKeyManager()
  console.log(`[Security] RSA-2048 KeyManager ready (kid: ${km.kid}, alg: RS256)`)

  // 2. Connect to MongoDB
  try {
    await connectToMongo()
  } catch (err: any) {
    console.warn(`[MongoDB] Initial connection error: ${err.message}. Running with fallback.`)
  }

  // 3. Create Express application
  const app = createApp()

  // 4. Start HTTP Server
  const server = app.listen(config.port, () => {
    console.log(`[ZenFit Auth & Core] Listening on port ${config.port} (http://localhost:${config.port})`)
    console.log(`[Endpoints] JWKS: http://localhost:${config.port}/.well-known/jwks.json`)
    console.log(`[Endpoints] Health: http://localhost:${config.port}/health/live`)
  })

  // 5. Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[ZenFit Auth & Core] Received ${signal}. Starting graceful shutdown...`)
    server.close(async () => {
      console.log("[ZenFit Auth & Core] HTTP server closed.")
      await closeMongo()
      console.log("[ZenFit Auth & Core] MongoDB connection closed.")
      process.exit(0)
    })

    // Force exit after 10 seconds if hanging
    setTimeout(() => {
      console.error("[ZenFit Auth & Core] Forcefully terminating after timeout.")
      process.exit(1)
    }, 10000).unref()
  }

  process.on("SIGINT", () => shutdown("SIGINT"))
  process.on("SIGTERM", () => shutdown("SIGTERM"))
}

bootstrap().catch((err) => {
  console.error("[FATAL] Failed to bootstrap Auth & Core service:", err)
  process.exit(1)
})
