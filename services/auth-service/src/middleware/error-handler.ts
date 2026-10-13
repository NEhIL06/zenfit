import { Request, Response, NextFunction } from "express"
import crypto from "crypto"

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers["x-request-id"] as string) || `req_${crypto.randomBytes(6).toString("hex")}`
  req.requestId = reqId
  res.setHeader("X-Request-Id", reqId)
  next()
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  res.on("finish", () => {
    const duration = Date.now() - start
    const logObj = {
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      userId: req.user?.userId,
    }
    // Only log in non-test environments or on errors
    if (process.env.NODE_ENV !== "test") {
      console.log(JSON.stringify(logObj))
    }
  })
  next()
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const status = err.status || err.statusCode || 500
  const isDev = process.env.NODE_ENV !== "production"

  const responseBody = {
    error: err.name || "InternalServerError",
    message: isDev ? err.message : (status === 500 ? "Internal Server Error" : err.message),
    code: err.code || "INTERNAL_ERROR",
    requestId: req.requestId,
    ...(err.details ? { details: err.details } : {}),
  }

  if (status >= 500 && process.env.NODE_ENV !== "test") {
    console.error(`[Error] ${req.method} ${req.url}:`, err)
  }

  res.status(status).json(responseBody)
}
