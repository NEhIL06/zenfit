// lib/ai-trainer/vector-store.ts

import { addToCollection, getCollection, queryCollection, deleteFromCollection } from "../chroma";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";

/**
 * Free HuggingFace embedding model (works on router.huggingface.co)
 */
const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API_KEY = process.env.HF_API_KEY!;

/**
 * HuggingFace Embedding Function (REST API)
 * --------------------------------------------------
 * Never deprecated, no SDK needed, no local model needed.
 */
async function embedTextHF(text: string): Promise<number[]> {
  try {
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/feature-extraction",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: HF_MODEL,
          inputs: text,
        }),
      }
    );

    const raw = await response.text();
    if (!response.ok || raw.startsWith("Not Found") || raw.startsWith("<")) {
      console.error("[HF Embeddings ERROR] Raw response:", raw);
      return [];
    }

    const json = JSON.parse(raw);
    return json[0] ?? json;
  } catch (err) {
    console.error("[HF Embeddings] embedText error:", err);
    return [];
  }
}

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
    const texts = chunks.map((c) => c.pageContent);

    // HF embeddings for each chunk
    const embeddings = await Promise.all(texts.map(embedTextHF));

    const ids = chunks.map(
      (_, i) => `${collectionName}_${Date.now()}_${Math.random()}_${i}`
    );

    const metadatas = chunks.map((c) => ({
      ...c.metadata,
      addedAt: new Date().toISOString(),
    }));

    await this.ensureCollection(collectionName);

    await addToCollection(collectionName, ids, texts, embeddings, metadatas);

    console.log(
      `[VectorStore] Added ${chunks.length} chunks -> (${collectionName})`
    );

    return ids;
  }

  // ---------------------------
  // Retrieval
  // ---------------------------

  async similaritySearch(query: string, k: number, collectionName: string) {
    const embedding = await embedTextHF(query);

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
