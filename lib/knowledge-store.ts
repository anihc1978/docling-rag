import type { Chunk, ChunkWithEmbedding } from './types'
import { embedTexts } from './embeddings'
import { put, list } from '@vercel/blob'

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

// Durable storage: a single shared Blob (JSON) so the store survives cold
// starts and is shared across the separate /api/ingest, /api/chat and
// /api/status serverless functions. Falls back to the in-memory store when
// BLOB_READ_WRITE_TOKEN is absent (local dev without a blob store).
const STORE_PATH = 'knowledge-store.json'

function usesBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

// Load the store from the Blob into the module-level cache. No-op when blob is
// not configured (the in-memory store is the source of truth in that case).
async function loadStore() {
  if (!usesBlob()) return store
  try {
    const { blobs } = await list({ prefix: STORE_PATH })
    const blob = blobs.find((b) => b.pathname === STORE_PATH)
    if (blob) {
      const res = await fetch(blob.url, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        store.chunks = data.chunks ?? []
        store.rawChunks = data.rawChunks ?? []
        store.initialized = data.initialized ?? false
      }
    }
  } catch { /* fall back to in-memory store */ }
  return store
}

// Persist the current store to the Blob. No-op when blob is not configured.
async function saveStore() {
  if (!usesBlob()) return
  await put(STORE_PATH, JSON.stringify(store), {
    access: 'public',
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
  })
}

export async function getStore() {
  return loadStore()
}

export async function addRawChunks(chunks: Chunk[]) {
  await loadStore()
  store.rawChunks.push(...chunks)
  await saveStore()
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

  await loadStore()
  store.chunks.push(...enriched)
  store.rawChunks.push(...chunks)
  store.initialized = true
  await saveStore()
}

export async function clearStore() {
  store.chunks = []
  store.rawChunks = []
  store.initialized = false
  await saveStore()
}

export async function getStats() {
  await loadStore()
  return {
    semanticChunks: store.chunks.length,
    rawChunks: store.rawChunks.length,
    initialized: store.initialized,
  }
}
