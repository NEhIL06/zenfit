/**
 * lib/logger.ts
 *
 * Lightweight structured logger for ZenFit.
 *
 * Why structured logging over console.log?
 *  - Every log line is a JSON object → parseable by Datadog, Loki, Vercel Log Drains
 *  - Includes log level, timestamp, and context fields automatically
 *  - Level filtering: set LOG_LEVEL=warn in production to silence debug noise
 *  - Consistent format: `[tag] message` readable in dev, JSON in prod
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info({ userId, route: '/api/chat' }, 'Request received')
 *   logger.warn({ key }, 'Cache miss')
 *   logger.error({ err }, 'Database write failed')
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function getMinLevel(): number {
  const envLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as LogLevel
  return LEVELS[envLevel] ?? LEVELS.info
}

const isDev = process.env.NODE_ENV !== 'production'

function log(level: LogLevel, context: LogContext | string, message?: string): void {
  if (LEVELS[level] < getMinLevel()) return

  // Normalise overloads: log('info', 'message') or log('info', { ctx }, 'message')
  const ctx: LogContext = typeof context === 'string' ? {} : context
  const msg: string = typeof context === 'string' ? context : (message ?? '')

  if (isDev) {
    // Human-readable format for local development
    const prefix = `[${level.toUpperCase()}]`
    const extras = Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : ''
    const consoleFn = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : console.log
    consoleFn(`${prefix} ${msg}${extras}`)
  } else {
    // Structured JSON for production log aggregators (Vercel, Datadog, Loki)
    const entry = {
      level,
      message: msg,
      timestamp: new Date().toISOString(),
      ...ctx,
    }
    // Use appropriate console method so Vercel Log Drains preserve severity
    if (level === 'error') console.error(JSON.stringify(entry))
    else if (level === 'warn') console.warn(JSON.stringify(entry))
    else console.log(JSON.stringify(entry))
  }
}

export const logger = {
  debug: (ctx: LogContext | string, msg?: string) => log('debug', ctx, msg),
  info:  (ctx: LogContext | string, msg?: string) => log('info',  ctx, msg),
  warn:  (ctx: LogContext | string, msg?: string) => log('warn',  ctx, msg),
  error: (ctx: LogContext | string, msg?: string) => log('error', ctx, msg),
} as const
