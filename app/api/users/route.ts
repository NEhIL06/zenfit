import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function POST(request: Request) {
  try {
    const userData = await request.json()
    const db = await connectToDatabase()
    const usersCollection = db.collection("users")

    const existingUser = await usersCollection.findOne({ email: userData.email })
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 })
    }

    const result = await usersCollection.insertOne({
      ...userData,
      createdAt: new Date(),
    })

    return NextResponse.json({
      id: result.insertedId,
      ...userData,
    })
  } catch (error) {
    console.error("[v0] Error creating user:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 })
    }

    const db = await connectToDatabase()
    const usersCollection = db.collection("users")

    const user = await usersCollection.findOne({ email })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("[v0] Error fetching user:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}
