import type { Chunk, ChunkWithEmbedding } from './types'
import { embedTexts } from './embeddings'

// Module-level cache: persists across warm serverless invocations
const store: {
  chunks: ChunkWithEmbedding[]
  rawChunks: Chunk[]   // chunks without embeddings (keyword search fallback)
  initialized: boolean
} = {
  chunks: [],
  rawChunks: [],
  initialized: false,
}

export function getStore() {
  return store
}

export function addRawChunks(chunks: Chunk[]) {
  store.rawChunks.push(...chunks)
}

export async function addChunksWithEmbeddings(
  chunks: Chunk[],
  apiKey: string
): Promise<void> {
  const texts = chunks.map((c) => c.text)
  const embeddings = await embedTexts(texts, apiKey)

  const enriched: ChunkWithEmbedding[] = chunks.map((c, i) => ({
    ...c,
    embedding: embeddings[i],
  }))

  store.chunks.push(...enriched)
  store.rawChunks.push(...chunks)
  store.initialized = true
}

export function clearStore() {
  store.chunks = []
  store.rawChunks = []
  store.initialized = false
}

export function getStats() {
  return {
    semanticChunks: store.chunks.length,
    rawChunks: store.rawChunks.length,
    initialized: store.initialized,
  }
}
