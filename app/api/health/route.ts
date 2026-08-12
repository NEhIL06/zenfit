import { NextResponse } from "next/server"

/**
 * GET /api/health
 * Docker/load-balancer health check endpoint.
 * Returns 200 when the app is ready to serve traffic.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "zenfit",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      env: process.env.NODE_ENV,
    },
    { status: 200 }
  )
}
