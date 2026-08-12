import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJwtToken, AUTH_COOKIE_NAME } from '@/lib/auth'

/**
 * Routes that require NO authentication.
 * Uses method-aware exact matches so public signup does not make user reads public.
 */
const PUBLIC_API_ROUTES = [
  { path: '/api/auth/login', methods: ['POST'] },
  { path: '/api/auth/logout', methods: ['POST'] },
  { path: '/api/users', methods: ['POST'] },
  { path: '/api/health', methods: ['GET'] },
]

function isPublicRoute(pathname: string, method: string): boolean {
  return PUBLIC_API_ROUTES.some(
    route => route.methods.includes(method) && pathname === route.path
  )
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function configuredOrigins(request: NextRequest): Set<string> {
  const origins = new Set([request.nextUrl.origin])
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const extraOrigins = process.env.TRUSTED_ORIGINS

  if (appUrl) {
    try { origins.add(new URL(appUrl).origin) } catch {}
  }

  if (extraOrigins) {
    for (const origin of extraOrigins.split(',').map(o => o.trim()).filter(Boolean)) {
      try { origins.add(new URL(origin).origin) } catch {}
    }
  }

  return origins
}

function hasTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const candidate = origin || referer

  if (!candidate) return process.env.NODE_ENV !== 'production'

  try {
    return configuredOrigins(request).has(new URL(candidate).origin)
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api') && MUTATING_METHODS.has(request.method)) {
    const usesBearer = request.headers.get('authorization')?.startsWith('Bearer ') === true
    if (!usesBearer && !hasTrustedOrigin(request)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Cross-origin mutation rejected' },
        { status: 403 }
      )
    }
  }

  // Static files, Next.js internals, and file-extension assets bypass auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    isPublicRoute(pathname, request.method)
  ) {
    return NextResponse.next()
  }

  // Only protect /api/* routes — all page routes pass through
  if (!pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Extract token: Bearer header takes priority over cookie
  let token: string | null = null

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  } else {
    const authCookie = request.cookies.get(AUTH_COOKIE_NAME)
    if (authCookie) {
      token = authCookie.value
    }
  }

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const payload = await verifyJwtToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Forward verified user identity to route handlers via request headers.
    // Routes can read these with request.headers.get('x-user-id') instead of
    // re-parsing the JWT, saving one crypto operation per request.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete('x-user-id')
    requestHeaders.delete('x-user-email')
    requestHeaders.set('x-user-id', payload.userId)
    requestHeaders.set('x-user-email', payload.email)

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or expired token' },
      { status: 401 }
    )
  }
}

export const config = {
  matcher: ['/api/:path*'],
}
