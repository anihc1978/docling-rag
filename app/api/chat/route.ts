import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { embedQuery } from '@/lib/embeddings'
import { search, keywordSearch } from '@/lib/vector-search'
import { getStore } from '@/lib/knowledge-store'
import type { SearchResult } from '@/lib/types'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided context.
Use ONLY the information from the context to answer questions.
If the context doesn't contain enough information to answer, say so clearly.
Be concise and accurate. Cite the source sections when helpful.`

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured on the server.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { question, history = [] } = await req.json()
  if (!question?.trim()) {
    return new Response(JSON.stringify({ error: 'No question provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const store = getStore()

  // Find relevant chunks
  let results: SearchResult[] = []
  if (store.chunks.length > 0) {
    const queryEmbedding = await embedQuery(question, apiKey)
    results = search(queryEmbedding, store.chunks, 5)
  } else if (store.rawChunks.length > 0) {
    results = keywordSearch(question, store.rawChunks, 5)
  }

  const context = results
    .map((r) => {
      const meta = r.chunk.metadata
      const src = meta.filename ?? meta.source
      const pages = meta.pageNumbers?.length ? ` (p. ${meta.pageNumbers.join(', ')})` : ''
      const ttl = meta.title ? `\nSection: ${meta.title}` : ''
      return `${r.chunk.text}\nSource: ${src}${pages}${ttl}`
    })
    .join('\n\n---\n\n')

  const contextBlock = context
    ? `Context:\n${context}`
    : 'No documents have been indexed yet. Please add a document first.'

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${contextBlock}` },
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ]

  const client = new OpenAI({ apiKey })
  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    stream: true,
  })

  // Stream the text + send sources as a final SSE event
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', text: delta })}\n\n`)
            )
          }
        }
        // Send sources after streaming completes
        const sources = results.map((r) => ({
          text: r.chunk.text.slice(0, 300),
          source: r.chunk.metadata.filename ?? r.chunk.metadata.source,
          title: r.chunk.metadata.title,
          pageNumbers: r.chunk.metadata.pageNumbers,
          score: Math.round(r.score * 100) / 100,
        }))
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`)
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
