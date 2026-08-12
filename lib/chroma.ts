// lib/chroma.ts
// NOTE: chromadb is imported LAZILY (dynamic import) at runtime only.
// This prevents Turbopack from statically tracing optional Chroma embedder
// packages during the build.

import { embedText } from "./gemini";

// Define interface locally to avoid import issues
export interface IEmbeddingFunction {
  generate(texts: string[]): Promise<number[][]>;
}

type ChromaMetadata = Record<string, string | number | boolean | null>;

type ChromaCollectionLike = {
  add(args: {
    ids: string[];
    documents: string[];
    embeddings: number[][];
    metadatas: ChromaMetadata[];
  }): Promise<unknown>;
  query(args: {
    queryEmbeddings: number[][];
    nResults: number;
    include: string[];
  }): Promise<{
    documents?: (string | null)[][];
    distances?: (number | null)[][];
    metadatas?: (ChromaMetadata | null)[][];
  }>;
  delete(args: { ids: string[] }): Promise<unknown>;
};

// Lazy singleton — created on first use, never at module load time
type ChromaClientLike = {
  getOrCreateCollection(args: {
    name: string;
    embeddingFunction?: IEmbeddingFunction;
  }): Promise<ChromaCollectionLike>;
};

let _chromaClient: ChromaClientLike | null = null;

async function getChromaClient() {
  if (!_chromaClient) {
    const chromadb = await import("chromadb");
    const chromaApiKey = process.env.CHROMA_API_KEY;
    const chromaTenant = process.env.CHROMA_TENANT_ID || process.env.CHROMA_TENANT;
    const chromaDatabase = process.env.CHROMA_DATABASE;

    if (chromaApiKey && chromaTenant && chromaDatabase) {
      _chromaClient = new chromadb.CloudClient({
        apiKey: chromaApiKey,
        tenant: chromaTenant,
        database: chromaDatabase,
      }) as unknown as ChromaClientLike;
    } else {
      const chromaServerUrl = new URL(process.env.CHROMA_SERVER_URL || "http://localhost:8000");
      _chromaClient = new chromadb.ChromaClient({
        host: chromaServerUrl.hostname,
        port: chromaServerUrl.port ? Number(chromaServerUrl.port) : chromaServerUrl.protocol === "https:" ? 443 : 80,
        ssl: chromaServerUrl.protocol === "https:",
      }) as unknown as ChromaClientLike;
    }
  }
  return _chromaClient as ChromaClientLike;
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
  } catch (err: unknown) {
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
  metadatas: ChromaMetadata[]
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

