import dotenv from "dotenv"
import path from "path"
import fs from "fs"

// Load env files in order of preference
const envFiles = [".env", "../.env", "../../.env"]
for (const envFile of envFiles) {
  const fullPath = path.resolve(process.cwd(), envFile)
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath })
  }
}

export interface AppConfig {
  port: number
  environment: "development" | "production" | "test"
  logLevel: string
  mongoUri: string
  mongoDbName: string
  redisUrl: string
  jwtPrivateKey?: string
  jwtPublicKey?: string
  jwtPrivateKeyPath?: string
  jwtPublicKeyPath?: string
  jwtSecret: string
  jwtAccessExpiry: string
  jwtRefreshExpiryDays: number
  cookieName: string
  refreshCookieName: string
  corsOrigins: string[]
}

const nodeEnv = (process.env.NODE_ENV || process.env.ENVIRONMENT || "development") as "development" | "production" | "test"

// Fail-closed validation in production (ADR 15.1, Section 9.3)
if (nodeEnv === "production") {
  if (!process.env.MONGODB_URI) {
    throw new Error("[FATAL] MONGODB_URI environment variable is required in production.")
  }
  const secret = process.env.JWT_SECRET || ""
  const privateKey = process.env.JWT_PRIVATE_KEY || ""
  if (!privateKey && secret.length < 32) {
    throw new Error("[FATAL] Production requires an RSA Private Key or JWT_SECRET of at least 32 characters.")
  }
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || process.env.AUTH_SERVICE_PORT || "3001", 10),
  environment: nodeEnv,
  logLevel: process.env.LOG_LEVEL || "info",
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/zenfit",
  mongoDbName: process.env.MONGODB_DB_NAME || "zenfit",
  redisUrl: process.env.REDIS_URL || process.env.UPSTASH_REDIS_TCP_URL || "redis://localhost:6379",
  jwtPrivateKey: process.env.JWT_PRIVATE_KEY,
  jwtPublicKey: process.env.JWT_PUBLIC_KEY,
  jwtPrivateKeyPath: process.env.JWT_PRIVATE_KEY_PATH,
  jwtPublicKeyPath: process.env.JWT_PUBLIC_KEY_PATH,
  jwtSecret: process.env.JWT_SECRET || "default_zenfit_jwt_secret_dev_key_32chars_min",
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
  jwtRefreshExpiryDays: parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || "30", 10),
  cookieName: process.env.COOKIE_NAME || "zenfit_auth_token",
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || "zenfit_refresh_token",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000,http://127.0.0.1:8080")
    .split(",")
    .map((o) => o.trim()),
}
