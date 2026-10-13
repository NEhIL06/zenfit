import { MongoClient, Db, ObjectId } from "mongodb"
import { config } from "../config/index.js"

let mongoClient: MongoClient | null = null
let dbInstance: Db | null = null

// Resilient in-memory collections for unit testing and offline development
class InMemoryCollection {
  private docs: Map<string, any> = new Map()

  async findOne(query: Record<string, any>): Promise<any | null> {
    for (const doc of this.docs.values()) {
      let match = true
      for (const [key, val] of Object.entries(query)) {
        if (key === "_id") {
          const docId = doc._id instanceof ObjectId ? doc._id.toString() : doc._id
          const queryId = val instanceof ObjectId ? val.toString() : val
          if (docId !== queryId) match = false
        } else if (key.includes(".")) {
          const parts = key.split(".")
          let curr = doc
          for (const p of parts) {
            curr = curr?.[p]
          }
          if (curr !== val) match = false
        } else {
          if (doc[key] !== val) match = false
        }
      }
      if (match) return JSON.parse(JSON.stringify(doc))
    }
    return null
  }

  async insertOne(doc: Record<string, any>): Promise<{ insertedId: ObjectId }> {
    const id = doc._id ? new ObjectId(doc._id) : new ObjectId()
    const stored = { ...doc, _id: id }
    this.docs.set(id.toString(), stored)
    return { insertedId: id }
  }

  find(query: Record<string, any> = {}) {
    const results: any[] = []
    for (const doc of this.docs.values()) {
      let match = true
      for (const [key, val] of Object.entries(query)) {
        if (key === "_id") {
          const docId = doc._id instanceof ObjectId ? doc._id.toString() : doc._id
          const queryId = val instanceof ObjectId ? val.toString() : val
          if (docId !== queryId) match = false
        } else if (key.includes(".")) {
          const parts = key.split(".")
          let curr = doc
          for (const p of parts) curr = curr?.[p]
          if (curr !== val) match = false
        } else {
          if (doc[key] !== val) match = false
        }
      }
      if (match) results.push(JSON.parse(JSON.stringify(doc)))
    }

    return {
      sort: (sortObj: Record<string, number>) => ({
        limit: (n: number) => ({
          toArray: async () => results.slice(0, n),
        }),
        toArray: async () => results,
      }),
      toArray: async () => results,
    }
  }

  async findOneAndUpdate(filter: Record<string, any>, update: Record<string, any>, options: any = {}): Promise<any> {
    const existing = await this.findOne(filter)
    if (!existing) {
      if (options.upsert) {
        const newDoc: Record<string, any> = { ...filter }
        if (update.$set) {
          Object.assign(newDoc, update.$set)
        }
        const insertRes = await this.insertOne(newDoc)
        return { ...newDoc, _id: insertRes.insertedId }
      }
      return null
    }

    const docId = existing._id.toString()
    const target = this.docs.get(docId)

    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        if (k.includes(".")) {
          const parts = k.split(".")
          let curr = target
          for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {}
            curr = curr[parts[i]]
          }
          curr[parts[parts.length - 1]] = v
        } else {
          target[k] = v
        }
      }
    }

    return target
  }
}

const memoryCollections: Map<string, InMemoryCollection> = new Map()

function getMemoryCollection(name: string): InMemoryCollection {
  if (!memoryCollections.has(name)) {
    memoryCollections.set(name, new InMemoryCollection())
  }
  return memoryCollections.get(name)!
}

export async function connectToMongo(): Promise<Db> {
  if (dbInstance) return dbInstance

  // In test environment or when external mongo is skipped, use in-memory store
  if (config.environment === "test") {
    dbInstance = {
      collection: (name: string) => getMemoryCollection(name) as any,
    } as any
    return dbInstance!
  }

  try {
    mongoClient = new MongoClient(config.mongoUri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
    })

    await mongoClient.connect()
    dbInstance = mongoClient.db(config.mongoDbName)
    console.log(`[MongoDB] Connected successfully to ${config.mongoDbName}`)

    // Create indexes asynchronously
    await initIndexes(dbInstance)

    return dbInstance
  } catch (err: any) {
    console.warn(`[MongoDB] Connection failed (${err.message}). Using in-memory fallback store.`)
    dbInstance = {
      collection: (name: string) => getMemoryCollection(name) as any,
    } as any
    return dbInstance!
  }
}

async function initIndexes(db: Db): Promise<void> {
  try {
    await db.collection("users").createIndex({ "formData.email": 1 }, { unique: true, sparse: true })
    await db.collection("milestones").createIndex({ userId: 1, createdAt: -1 })
    await db.collection("user_plans").createIndex({ userId: 1 })
  } catch (err: any) {
    console.warn(`[MongoDB] Index creation warning: ${err.message}`)
  }
}

export function getDb(): Db {
  if (!dbInstance) {
    dbInstance = {
      collection: (name: string) => getMemoryCollection(name) as any,
    } as any
  }
  return dbInstance!
}

export async function pingMongo(): Promise<boolean> {
  if (!mongoClient) return false
  try {
    await mongoClient.db(config.mongoDbName).command({ ping: 1 })
    return true
  } catch {
    return false
  }
}

export async function closeMongo(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close()
    mongoClient = null
    dbInstance = null
  }
}
