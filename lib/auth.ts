import { SignJWT, jwtVerify } from 'jose'
import { JWT_SECRET_BYTES, AUTH_COOKIE_NAME, JWT_EXPIRY } from './constants'

export { AUTH_COOKIE_NAME }

export interface JwtPayload {
  userId: string
  email: string
  fullName?: string
}

export async function signJwtToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET_BYTES)
}

export async function verifyJwtToken(token: string): Promise<JwtPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET_BYTES, {
      algorithms: ['HS256'],
    })
    const { userId, email, fullName } = verified.payload
    if (typeof userId !== 'string' || userId.trim().length === 0) return null
    if (typeof email !== 'string' || email.trim().length === 0) return null
    if (fullName !== undefined && typeof fullName !== 'string') return null

    return { userId, email, fullName }
  } catch {
    return null
  }
}

export async function getAuthUserFromRequest(request: Request): Promise<JwtPayload | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const payload = await verifyJwtToken(authHeader.substring(7))
    if (payload) return payload
  }

  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader) {
    const cookiesArr = cookieHeader.split(';').map(c => c.trim())
    const authCookie = cookiesArr.find(c => c.startsWith(`${AUTH_COOKIE_NAME}=`))
    if (authCookie) {
      const token = authCookie.split('=').slice(1).join('=')
      const payload = await verifyJwtToken(token)
      if (payload) return payload
    }
  }

  return null
}
