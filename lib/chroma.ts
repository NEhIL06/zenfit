// lib/chroma.ts

import { CloudClient } from "chromadb";

/**
 * Initialize Chroma Cloud Client
 * --------------------------------
 * Requires these env vars:
 * - CHROMA_API_KEY
 * - CHROMA_TENANT_ID
 * - CHROMA_DATABASE
 */

export const chroma = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY!,
  tenant: process.env.CHROMA_TENANT_ID!,
  database: process.env.CHROMA_DATABASE!,
});

/**
 * Get or create a Chroma collection.
 * CloudClient throws 404 for non-existing collections,
 * so we catch and create automatically.
 */
export async function getCollection(name: string) {
  try {
    console.log(`[Chroma] Fetching collection: ${name}`);
    return await chroma.getCollection({ name });
  } catch (err: any) {
    const msg = err?.message || "";

    if (msg.includes("not found") || err?.status === 404) {
      console.log(`[Chroma] Creating new collection: ${name}`);

      return await chroma.createCollection({
        name,
        metadata: { source: "zenletics" },
      });
    }

    throw err;
  }
}

/**
 * Add documents + embeddings to collection.
 */
export async function addToCollection(
  name: string,
  ids: string[],
  documents: string[],
  embeddings: number[][],
  metadatas: any[]
) {
  const collection = await getCollection(name);

  return await collection.add({
    ids,
    documents,
    embeddings,
    metadatas,
  });
}

/**
 * Query collection using embedding vector.
 * NOTE:
 * - "ids" is NOT allowed in Chroma Cloud's "include".
 * - IDs are ALWAYS returned automatically.
 */
export async function queryCollection(
  name: string,
  embedding: number[],
  k = 4
) {
  const collection = await getCollection(name);

  return await collection.query({
    queryEmbeddings: [embedding],
    nResults: k,
    include: ["documents", "distances", "metadatas"],
  });
}

/**
 * Optional: Delete specific IDs from a collection.
 */
export async function deleteFromCollection(name: string, ids: string[]) {
  const collection = await getCollection(name);

  console.log(`[Chroma] Deleting ${ids.length} items from ${name}`);

  return await collection.delete({ ids });
}

