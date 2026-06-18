import { NextRequest, NextResponse } from 'next/server'
import { loadFromUrl, loadFromBuffer } from '@/lib/document-loader'
import { chunkText } from '@/lib/chunker'
import { addChunksWithEmbeddings, addRawChunks } from '@/lib/knowledge-store'
import type { IngestResponse } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest): Promise<NextResponse<IngestResponse>> {
  try {
    const contentType = req.headers.get('content-type') ?? ''
    const apiKey = process.env.OPENAI_API_KEY ?? ''

    let text: string
    let title: string
    let source: string

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ ok: false, chunks: 0, source: '', error: 'No file provided' }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      ;({ text, title } = await loadFromBuffer(buffer, file.name))
      source = file.name
    } else {
      const body = await req.json()
      const url: string = body.url
      if (!url) return NextResponse.json({ ok: false, chunks: 0, source: '', error: 'No URL provided' }, { status: 400 })
      ;({ text, title } = await loadFromUrl(url))
      source = url
    }

    const chunks = chunkText(text, source, title)

    if (apiKey) {
      await addChunksWithEmbeddings(chunks, apiKey)
    } else {
      await addRawChunks(chunks)
    }

    return NextResponse.json({ ok: true, chunks: chunks.length, source })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, chunks: 0, source: '', error: message }, { status: 500 })
  }
}
