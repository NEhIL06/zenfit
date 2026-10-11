const DEFAULT_DEV_SECRET = "zenfit_dev_jwt_secret_key_change_before_production_32chars"
const rawSecret = process.env.JWT_SECRET

/**
 * Validate JWT_SECRET:
 * - If JWT_SECRET is provided, enforce a minimum 32-character length.
 * - If JWT_SECRET is not provided, fall back to DEFAULT_DEV_SECRET (49 chars)
 *   so local development and `next build` static page data collection can run
 *   without crashing module evaluation.
 */
if (rawSecret && rawSecret.length < 32) {
  throw new Error(
    '[ZenFit] JWT_SECRET environment variable must be at least 32 characters long. ' +
    'Generate one with: openssl rand -hex 32'
  )
}

if (!rawSecret && process.env.NODE_ENV === 'production') {
  console.warn(
    '[ZenFit Warning] JWT_SECRET is missing from environment. ' +
    'Using default development secret. Set JWT_SECRET in your production settings!'
  )
}

export const JWT_SECRET_BYTES = new TextEncoder().encode(rawSecret || DEFAULT_DEV_SECRET)

export const AUTH_COOKIE_NAME = 'zenfit_auth_token'

export const JWT_EXPIRY = '30d'
