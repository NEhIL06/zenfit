// lib/chroma.ts
// NOTE: chromadb is imported LAZILY (dynamic import) at runtime only.
// This prevents Turbopack from statically tracing into @chroma-core/default-embed
// during the build, which causes a CJS/ESM module format conflict.

import { embedText } from "./gemini";

// Define interface locally to avoid import issues
export interface IEmbeddingFunction {
  generate(texts: string[]): Promise<number[][]>;
}

// Lazy singleton — created on first use, never at module load time
let _chromaClient: import("chromadb").CloudClient | null = null;

async function getChromaClient() {
  if (!_chromaClient) {
    const { CloudClient } = await import("chromadb");
    _chromaClient = new CloudClient({
      apiKey: process.env.CHROMA_API_KEY!,
      tenant: process.env.CHROMA_TENANT_ID!,
      database: process.env.CHROMA_DATABASE!,
    });
  }
  return _chromaClient;
}

export class GeminiEmbeddingFunction implements IEmbeddingFunction {
  async generate(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const emb = await embedText(text);
      embeddings.push(emb);
    }
    return embeddings;
  }
}

/**
 * Get or create a Chroma collection.
 * CloudClient throws 404 for non-existing collections,
 * so we catch and create automatically.
 */
export async function getCollection(name: string) {
  const chroma = await getChromaClient();
  const embedder = new GeminiEmbeddingFunction();
  try {
    console.log(`[Chroma] Fetching collection: ${name}`);
    return await chroma.getOrCreateCollection({
      name,
      embeddingFunction: embedder,
    });
  } catch (err: any) {
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

