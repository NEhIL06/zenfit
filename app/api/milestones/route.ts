import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET() {
  try {
    const db = await connectToDatabase()
    const milestonesCollection = db.collection("milestones")

    const milestones = await milestonesCollection.find({}).sort({ createdAt: -1 }).limit(100).toArray()

    return NextResponse.json(milestones)
  } catch (error) {
    console.error("[v0] Error fetching milestones:", error)
    return NextResponse.json({ error: "Failed to fetch milestones" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId, userName, content } = await request.json()
    const db = await connectToDatabase()
    const milestonesCollection = db.collection("milestones")

    const milestone = {
      userId,
      userName,
      content,
      createdAt: new Date(),
      likes: 0,
    }

    const result = await milestonesCollection.insertOne(milestone)

    return NextResponse.json({
      id: result.insertedId,
      ...milestone,
    })
  } catch (error) {
    console.error("[v0] Error creating milestone:", error)
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 })
  }
}
