const JWT_SECRET = process.env.JWT_SECRET

/**
 * Enforce JWT_SECRET in every environment except test.
 *
 * Why not check only for 'production'?
 * A staging server might run NODE_ENV=staging or NODE_ENV=development and
 * still be publicly reachable. The known fallback secret is in this source
 * file, so any attacker can forge a valid JWT for any userId in those envs.
 * The only safe exception is 'test' where Vitest injects a stub value.
 */
if (process.env.NODE_ENV !== 'test' && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error(
    '[ZenFit] JWT_SECRET must be set to at least 32 characters in all non-test environments. ' +
    'Generate one with: openssl rand -hex 32'
  )
}

export const JWT_SECRET_BYTES = new TextEncoder().encode(
  JWT_SECRET || 'zenfit_dev_jwt_secret_key_change_before_production'
)

export const AUTH_COOKIE_NAME = 'zenfit_auth_token'

export const JWT_EXPIRY = '30d'
