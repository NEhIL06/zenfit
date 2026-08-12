/**
 * lib/ai-trainer/reranker.ts
 *
 * Cross-encoder reranker using Cohere Rerank API.
 * Falls back to BM25-style keyword scoring if Cohere is unconfigured.
 *
 * Purpose: After ChromaDB retrieves candidate documents by cosine similarity,
 * the reranker applies a cross-encoder model to compute relevance more precisely.
 * This gives significantly better ordering, especially for niche fitness queries.
 *
 * Usage:
 *   const topDocs = await rerankDocuments(query, rawDocs, 4)
 */

export interface RankedDocument {
  content: string
  score: number
  index: number
}

/** Cohere-based cross-encoder reranking */
async function cohereRerank(
  query: string,
  documents: string[],
  topN: number
): Promise<RankedDocument[]> {
  const apiKey = process.env.COHERE_API_KEY
  if (!apiKey) throw new Error('COHERE_API_KEY not configured')

  const response = await fetch('https://api.cohere.ai/v1/rerank', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'rerank-english-v3.0',
      query,
      documents: documents.map(d => d.substring(0, 512)), // respect token limits
      top_n: topN,
      return_documents: false,
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Cohere Rerank API error ${response.status}: ${errText}`)
  }

  const data = await response.json()

  return (data.results || []).map((r: { index: number; relevance_score: number }) => ({
    content: documents[r.index],
    score: r.relevance_score,
    index: r.index,
  }))
}

/**
 * BM25-inspired keyword scoring fallback (zero-cost, no API needed).
 * Counts query term overlaps in each document with IDF weighting.
 */
function bm25Score(query: string, document: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
  const docLower = document.toLowerCase()
  let score = 0

  for (const term of queryTerms) {
    const occurrences = (docLower.match(new RegExp(term, 'g')) || []).length
    // Simplified BM25: TF saturated at 1.5
    const tf = (occurrences * 2.5) / (occurrences + 1.5)
    // IDF approximation: prefer rare terms in the document
    const idf = Math.log(1 + 1 / (occurrences + 1))
    score += tf * idf
  }

  return score
}

function keywordFallbackRerank(
  query: string,
  documents: string[],
  topN: number
): RankedDocument[] {
  const scored = documents.map((content, index) => ({
    content,
    score: bm25Score(query, content),
    index,
  }))

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}

/**
 * Main reranking function.
 * Tries Cohere first; falls back to keyword scoring if Cohere is unconfigured or fails.
 *
 * @param query       - The user's original question
 * @param documents   - Raw documents retrieved from ChromaDB
 * @param topN        - How many to return (default: 4)
 * @returns Ranked documents in descending relevance order
 */
export async function rerankDocuments(
  query: string,
  documents: string[],
  topN = 4
): Promise<RankedDocument[]> {
  if (documents.length === 0) return []
  if (documents.length <= topN) {
    // No need to rerank if we have fewer docs than the target
    return documents.map((content, index) => ({ content, score: 1.0, index }))
  }

  // Try Cohere reranking first
  if (process.env.COHERE_API_KEY) {
    try {
      const results = await cohereRerank(query, documents, topN)
      console.log(`[Reranker] Cohere reranked ${documents.length} → ${results.length} docs`)
      return results
    } catch (err: any) {
      console.warn('[Reranker] Cohere failed, falling back to keyword scoring:', err.message)
    }
  }

  // BM25 keyword fallback
  const results = keywordFallbackRerank(query, documents, topN)
  console.log(`[Reranker] Keyword BM25 scored ${documents.length} → ${results.length} docs`)
  return results
}
