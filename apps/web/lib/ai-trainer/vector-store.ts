// lib/ai-trainer/vector-store.ts

import { addToCollection, getCollection, queryCollection, deleteFromCollection } from "../chroma";
import { embedText } from "../gemini";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

type EmbeddedChunk = {
  chunk: Document;
  embedding: number[];
};

/**
 * FITNESS VECTOR STORE
 * ---------------------
 * - one global collection for shared knowledge
 * - one per-user collection for personalized training data
 * - supports add/search/delete
 */
export class FitnessVectorStore {
  constructor() {
    // No LLM or Google API used here anymore.
  }

  // Namespaces
  getGlobalCollectionName() {
    return "fitness_global_knowledge";
  }

  getUserCollectionName(userId: string) {
    return `fitness_user_${userId}`;
  }

  /**
   * Ensures the collection exists (chroma.ts auto-creates)
   */
  async ensureCollection(name: string) {
    await getCollection(name);
  }

  // ---------------------------
  // Adding Documents
  // ---------------------------

  async addGlobalDocuments(docs: Document[]) {
    return this.addDocuments(docs, this.getGlobalCollectionName());
  }

  async addUserDocuments(userId: string, docs: Document[]) {
    return this.addDocuments(docs, this.getUserCollectionName(userId));
  }

  async addDocuments(docs: Document[], collectionName: string) {
    if (docs.length === 0) return [];

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 150,
    });

    const chunks = await splitter.splitDocuments(docs);

    const embeddedChunks: EmbeddedChunk[] = await Promise.all(
      chunks.map(async (chunk) => ({
        chunk,
        embedding: await embedText(chunk.pageContent),
      }))
    );
    const validChunks = embeddedChunks.filter((item) => item.embedding.length > 0);
    if (validChunks.length === 0) return [];

    const embeddings = validChunks.map((item) => item.embedding);
    const documents = validChunks.map((item) => item.chunk.pageContent);

    const ids = validChunks.map(
      (_item, i) => `${collectionName}_${Date.now()}_${Math.random()}_${i}`
    );

    const metadatas = validChunks.map((item) => ({
      ...item.chunk.metadata,
      addedAt: new Date().toISOString(),
    }));

    await this.ensureCollection(collectionName);

    await addToCollection(collectionName, ids, documents, embeddings, metadatas);

    return ids;
  }

  // ---------------------------
  // Retrieval
  // ---------------------------

  async similaritySearch(query: string, k: number, collectionName: string) {
    const embedding = await embedText(query);
    if (!embedding.length) {
      console.warn("[VectorStore] Empty embedding returned for query:", query);
      return [];
    }

    await this.ensureCollection(collectionName);

    const result = await queryCollection(collectionName, embedding, k);

    const docs: Document[] = [];
    const documents = result.documents?.[0] ?? [];
    const metadatas = result.metadatas?.[0] ?? [];
    const distances = result.distances?.[0] ?? [];

    for (let i = 0; i < documents.length; i++) {
      const pageContent = documents[i];
      if (!pageContent) continue;

      docs.push(
        new Document({
          pageContent,
          metadata: {
            ...metadatas[i],
            score: distances[i],
            collection: collectionName,
          },
        })
      );
    }

    return docs.sort((a, b) => (a.metadata.score ?? 0) - (b.metadata.score ?? 0));
  }

  /**
   * Search in:
   *   1. Global dataset
   *   2. User's dataset (if exists)
   */
  async searchForUser(query: string, userId?: string, k = 4) {
    const globalDocs = await this.similaritySearch(
      query,
      k,
      this.getGlobalCollectionName()
    );

    if (!userId) return globalDocs;

    try {
      const userDocs = await this.similaritySearch(
        query,
        k,
        this.getUserCollectionName(userId)
      );

      return [...globalDocs, ...userDocs].sort(
        (a, b) => (a.metadata.score ?? 0) - (b.metadata.score ?? 0)
      );
    } catch (err) {
      console.warn("[VectorStore] User collection missing:", userId);
      return globalDocs;
    }
  }

  // ---------------------------
  // Delete (useful for admin UI)
  // ---------------------------

  async deleteDocuments(ids: string[], collectionName: string) {
    await this.ensureCollection(collectionName);
    await deleteFromCollection(collectionName, ids);
  }
}

// Singleton
let instance: FitnessVectorStore | null = null;

export function getVectorStore() {
  if (!instance) instance = new FitnessVectorStore();
  return instance;
}
