import { NextResponse } from 'next/server'
import { getAuthUserFromRequest, type JwtPayload } from './auth'

export type AuthResult =
  | { ok: true; user: JwtPayload }
  | { ok: false; response: NextResponse }

export async function requireAuthUser(request: Request): Promise<AuthResult> {
  const user = await getAuthUserFromRequest(request)
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  return { ok: true, user }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'anon'
  return request.headers.get('x-real-ip')?.trim() || 'anon'
}

export function genericInternalError(message = 'Internal Server Error') {
  return NextResponse.json({ error: message }, { status: 500 })
}
