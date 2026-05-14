export interface Chunk {
  id: string
  text: string
  metadata: {
    source: string
    title?: string
    pageNumbers?: number[]
    filename?: string
  }
}

export interface ChunkWithEmbedding extends Chunk {
  embedding: number[]
}

export interface SearchResult {
  chunk: Chunk
  score: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: SearchResult[]
}

export interface IngestResponse {
  ok: boolean
  chunks: number
  source: string
  error?: string
}

export interface ChatRequest {
  question: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}
