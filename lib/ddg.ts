/**
 * lib/ddg.ts — Web Search Fallback
 *
 * Primary: Wikipedia (free, no key required)
 * Secondary: PubMed Open API (evidence-based fitness & exercise science)
 *
 * Results are cached in Redis using SHA-256 keying (via CacheKeys.webSearch)
 * to avoid redundant fetches for repeated queries.
 *
 * BUG-06 fix: Previous version used raw base64 truncated at 64 chars, causing
 * potential key collisions for queries sharing the same first ~48 characters.
 * Now uses hashKey() for consistent SHA-256 keying across all cache entries.
 */

import { getCache, setCache, CacheKeys, TTL } from './cache'

type SearchResult = {
  title: string
  description: string
  url: string
  source: 'wikipedia' | 'pubmed'
}

/** Strip HTML tags and decode common HTML entities */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>?/gm, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .trim()
}

/** Wikipedia search — returns up to 4 results */
async function searchWikipedia(query: string): Promise<SearchResult[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=4`

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) return []

  const data = await res.json()
  return (data.query?.search || []).slice(0, 4).map((r: any) => ({
    title: stripHtml(r.title),
    description: stripHtml(r.snippet),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
    source: 'wikipedia' as const,
  }))
}

/** PubMed Open Access — evidence-based fitness & exercise science */
async function searchPubMed(query: string): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query + ' fitness exercise')}&retmax=3&retmode=json&sort=relevance`
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) })
    if (!searchRes.ok) return []

    const searchData = await searchRes.json()
    const ids: string[] = searchData.esearchresult?.idlist || []
    if (ids.length === 0) return []

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(5000) })
    if (!summaryRes.ok) return []

    const summaryData = await summaryRes.json()
    const results: SearchResult[] = []

    for (const id of ids) {
      const article = summaryData.result?.[id]
      if (!article) continue
      results.push({
        title: stripHtml(article.title || ''),
        description: `Published: ${article.pubdate || 'N/A'}. Authors: ${(article.authors || []).slice(0, 2).map((a: any) => a.name).join(', ')}`,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        source: 'pubmed',
      })
    }

    return results
  } catch {
    return []
  }
}

/**
 * Main web search function.
 * Uses CacheKeys.webSearch (SHA-256) for consistent key naming — fixes BUG-06.
 * Queries Wikipedia (always) + PubMed (for fitness queries) in parallel.
 */
export async function webSearchfunc(query: string): Promise<SearchResult[]> {
  // SHA-256 key — consistent with all other cache keys in the app
  const cacheKey = CacheKeys.webSearch(query)

  // 1. Check Redis cache
  try {
    const cached = await getCache<SearchResult[]>(cacheKey)
    if (cached && Array.isArray(cached)) {
      console.log(`[WebSearch] Cache HIT for: "${query.slice(0, 50)}"`)
      return cached
    }
  } catch {
    // Non-blocking cache miss — proceed to fetch
  }

  console.log(`[WebSearch] Fetching fresh results for: "${query.slice(0, 50)}"`)

  const isFitnessQuery = /exercise|workout|fitness|muscle|nutrition|diet|protein|strength|cardio|weight|training/i.test(query)

  const [wikiResults, pubmedResults] = await Promise.allSettled([
    searchWikipedia(query),
    isFitnessQuery ? searchPubMed(query) : Promise.resolve<SearchResult[]>([]),
  ])

  const combined: SearchResult[] = [
    ...(wikiResults.status === 'fulfilled' ? wikiResults.value : []),
    ...(pubmedResults.status === 'fulfilled' ? pubmedResults.value : []),
  ].slice(0, 6)

  // Cache results using shared TTL constant
  if (combined.length > 0) {
    try {
      await setCache(cacheKey, combined, TTL.WEB_SEARCH)
    } catch {
      // Non-blocking
    }
  }

  return combined
}
