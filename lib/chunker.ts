import type { Chunk } from './types'

const CHUNK_SIZE = 800     // target chars per chunk
const CHUNK_OVERLAP = 150  // overlap to preserve context across boundaries

export function chunkText(
  text: string,
  source: string,
  title?: string
): Chunk[] {
  // Split on double newlines first (paragraph boundaries), then sentences
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 40)

  const chunks: Chunk[] = []
  let buffer = ''
  let chunkIndex = 0

  const flush = () => {
    const trimmed = buffer.trim()
    if (trimmed.length < 50) return
    chunks.push({
      id: `${source}-${chunkIndex++}`,
      text: trimmed,
      metadata: { source, title: title ?? extractTitle(trimmed) },
    })
    // Keep overlap tail for next chunk
    const words = trimmed.split(' ')
    const overlapWords = Math.floor(CHUNK_OVERLAP / 5) // ~5 chars/word
    buffer = words.slice(-overlapWords).join(' ') + '\n\n'
  }

  for (const para of paragraphs) {
    if (buffer.length + para.length > CHUNK_SIZE) {
      flush()
    }
    buffer += para + '\n\n'
  }
  flush()

  return chunks
}

function extractTitle(text: string): string {
  const firstLine = text.split('\n')[0].trim()
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine
}

export function estimateTokens(text: string): number {
  // ~4 chars per token (rough estimate)
  return Math.ceil(text.length / 4)
}
