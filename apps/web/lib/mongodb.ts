import { MongoClient, type Db } from "mongodb"

const uri = process.env.MONGODB_URI;
let client: MongoClient | null = null
let db: Db | null = null

export async function connectToDatabase() {
  if (client && db) {
    return { client, db }
  }

  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not defined")
  }

  try {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })
    await client.connect()
    db = client.db("fitness")
    console.log("[v0] Connected to MongoDB")
    return { client, db }
  } catch (error) {
    console.error("[v0] MongoDB connection error:", error)
    throw error
  }
}

export async function getDatabase() {
  if (!db) {
    const { db: database } = await connectToDatabase()
    db = database
  }
  return db
}
