import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json(
    { message: "Logged out successfully" },
    { status: 200 }
  )

  // Clear the httpOnly JWT cookie
  response.cookies.set("zenfit_auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // expire immediately
    path: "/",
  })

  return response
}
