import type { Chunk, ChunkWithEmbedding, SearchResult } from './types'

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function search(
  queryEmbedding: number[],
  chunks: ChunkWithEmbedding[],
  topK = 5
): SearchResult[] {
  const scored = chunks.map((c) => ({
    chunk: c as Chunk,
    score: cosineSimilarity(queryEmbedding, c.embedding),
  }))

  return scored.sort((a, b) => b.score - a.score).slice(0, topK)
}

// Keyword fallback when no API key is set
export function keywordSearch(query: string, chunks: Chunk[], topK = 5): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)

  const scored = chunks.map((c) => {
    const text = c.text.toLowerCase()
    const hits = terms.filter((t) => text.includes(t)).length
    const score = hits / Math.max(terms.length, 1)
    return { chunk: c, score }
  })

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}
