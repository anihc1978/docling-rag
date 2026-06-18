'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  BookOpen, Send, Upload, Link, Loader2, ChevronDown, ChevronRight,
  FileText, Globe, Trash2, CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Source {
  text: string
  source: string
  title?: string
  pageNumbers?: number[]
  score: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  streaming?: boolean
}

const DEMO_URLS = [
  { label: 'Docling Docs (HTML)', url: 'https://ds4sd.github.io/docling/' },
  { label: 'Docling Paper (PDF)', url: 'https://arxiv.org/pdf/2408.09869' },
]

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ingestUrl, setIngestUrl] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [ingestStatus, setIngestStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [docCount, setDocCount] = useState(0)
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      // Don't let a cold/empty status instance clobber the optimistic count
      setDocCount((c) => Math.max(c, data.rawChunks ?? 0))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  const handleIngestUrl = async (url?: string) => {
    const target = url ?? ingestUrl.trim()
    if (!target) return
    setIngesting(true)
    setIngestStatus(null)
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      })
      const data = await res.json()
      if (data.ok) {
        setIngestStatus({ ok: true, msg: `Indexed ${data.chunks} chunks` })
        setIngestUrl('')
        setDocCount((c) => c + (data.chunks ?? 0))
        await refreshStatus()
      } else {
        setIngestStatus({ ok: false, msg: data.error ?? 'Ingestion failed' })
      }
    } catch (e) {
      setIngestStatus({ ok: false, msg: String(e) })
    } finally {
      setIngesting(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    setIngesting(true)
    setIngestStatus(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: form })
      const data = await res.json()
      if (data.ok) {
        setIngestStatus({ ok: true, msg: `Indexed ${data.chunks} chunks from ${data.source}` })
        setDocCount((c) => c + (data.chunks ?? 0))
        await refreshStatus()
      } else {
        setIngestStatus({ ok: false, msg: data.error ?? 'Upload failed' })
      }
    } catch (e) {
      setIngestStatus({ ok: false, msg: String(e) })
    } finally {
      setIngesting(false)
    }
  }

  const sendMessage = async () => {
    const question = input.trim()
    if (!question || loading) return

    const history = messages
      .filter((m) => !m.streaming)
      .map(({ role, content }) => ({ role, content }))

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question },
      { role: 'assistant', content: '', streaming: true },
    ])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Server error' }))
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: 'Error: ' + (err.error ?? 'Unknown') }
          return updated
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalSources: Source[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') continue
          try {
            const event = JSON.parse(raw)
            if (event.type === 'text') {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                updated[updated.length - 1] = { ...last, content: last.content + event.text }
                return updated
              })
            } else if (event.type === 'sources') {
              finalSources = event.sources
            }
          } catch { /* malformed */ }
        }
      }

      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        updated[updated.length - 1] = { ...last, streaming: false, sources: finalSources }
        return updated
      })
    } catch (e) {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Error: ' + String(e) }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside className="w-72 shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" style={{ color: '#ff4b4b' }} />
            <span className="font-semibold text-lg">DoclingRAG</span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Document Q&amp;A powered by AI
          </p>
        </div>

        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Add Document
          </p>
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
              <input
                value={ingestUrl}
                onChange={(e) => setIngestUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleIngestUrl()}
                placeholder="Paste URL…"
                className="w-full text-sm rounded-lg pl-8 pr-3 py-2 outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <button
              onClick={() => handleIngestUrl()}
              disabled={ingesting || !ingestUrl.trim()}
              className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
              style={{ background: '#ff4b4b', color: '#fff' }}
            >
              {ingesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
            </button>
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={ingesting}
            className="w-full flex items-center justify-center gap-2 text-sm py-2 rounded-lg border border-dashed transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <Upload className="h-4 w-4" /> Upload PDF / TXT
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }} />

          {ingestStatus && (
            <div className="mt-2 flex items-start gap-1.5 text-xs rounded-lg px-3 py-2"
              style={{ background: ingestStatus.ok ? 'rgba(75,137,255,0.12)' : 'rgba(255,75,75,0.12)',
                       color: ingestStatus.ok ? '#4b89ff' : '#ff4b4b' }}>
              {ingestStatus.ok
                ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                : <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
              {ingestStatus.msg}
            </div>
          )}

          <p className="text-xs mt-3 mb-2" style={{ color: 'var(--text-muted)' }}>Try a demo:</p>
          <div className="flex flex-col gap-1.5">
            {DEMO_URLS.map((d) => (
              <button key={d.url} onClick={() => handleIngestUrl(d.url)} disabled={ingesting}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg text-left disabled:opacity-40 hover:opacity-80 transition-opacity"
                style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                <FileText className="h-3.5 w-3.5 shrink-0" />{d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{docCount}</span> chunks indexed
          </div>
          {docCount > 0 && (
            <button onClick={() => { setMessages([]); setDocCount(0) }}
              className="mt-2 flex items-center gap-1.5 text-xs hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}>
              <Trash2 className="h-3 w-3" /> Clear session
            </button>
          )}
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 py-4 border-b shrink-0 flex items-center justify-between"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
          <div>
            <h1 className="font-semibold text-base">📚 Document Q&amp;A</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Ask questions about your indexed documents</p>
          </div>
          {docCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(75,137,255,0.15)', color: '#4b89ff' }}>
              <Sparkles className="h-3 w-3" />{docCount} chunks ready
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-16">
              <BookOpen className="h-12 w-12 opacity-20" />
              <div>
                <p className="font-medium text-lg">Start by adding a document</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Paste a URL or upload a PDF — then ask anything about it.
                </p>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                {['What is Docling?', 'How does chunking work?', 'What models does Docling use?'].map((q) => (
                  <button key={q} onClick={() => setInput(q)}
                    className="text-sm px-4 py-2 rounded-full border hover:opacity-80 transition-opacity"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-2xl w-full', msg.role === 'user' ? 'ml-12' : 'mr-4')}>
                {msg.role === 'user' ? (
                  <div className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
                    style={{ background: '#4b89ff', color: '#fff' }}>
                    {msg.content}
                  </div>
                ) : (
                  <div>
                    <div className={cn('rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                        msg.streaming && msg.content === '' && 'cursor-blink')}
                      style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                      <span className={cn(msg.streaming && msg.content !== '' && 'cursor-blink')}>
                        {msg.content || (msg.streaming ? '' : '…')}
                      </span>
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2">
                        <button onClick={() => setExpandedSources((p) => ({ ...p, [i]: !p[i] }))}
                          className="flex items-center gap-1.5 text-xs hover:opacity-80 mb-2"
                          style={{ color: 'var(--text-muted)' }}>
                          {expandedSources[i] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {msg.sources.length} source{msg.sources.length !== 1 ? 's' : ''} found
                        </button>
                        {expandedSources[i] && (
                          <div className="space-y-2">
                            {msg.sources.map((src, j) => (
                              <div key={j} className="source-card rounded-lg px-3 py-2 border text-xs"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="font-medium truncate max-w-xs" style={{ color: '#4b89ff' }}>
                                    {src.title ?? src.source}
                                  </span>
                                  <span className="shrink-0 ml-2 px-1.5 py-0.5 rounded text-[10px]"
                                    style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                                    {(src.score * 100).toFixed(0)}% match
                                  </span>
                                </div>
                                {src.pageNumbers?.length ? (
                                  <p className="mb-1" style={{ color: 'var(--text-muted)' }}>p. {src.pageNumbers.join(', ')}</p>
                                ) : null}
                                <p className="leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                  {src.text}{src.text.length >= 300 ? '…' : ''}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 px-6 py-4 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="flex items-end gap-3 rounded-xl px-4 py-3 border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={docCount > 0 ? 'Ask a question about the document…' : 'Add a document first, then ask questions…'}
              className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
              style={{ color: 'var(--text-primary)', maxHeight: '140px', overflowY: 'auto' }}
              onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px' }}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              className="shrink-0 p-2 rounded-lg transition-opacity disabled:opacity-40"
              style={{ background: '#4b89ff', color: '#fff' }}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Shift+Enter for new line · Enter to send
          </p>
        </div>
      </main>
    </div>
  )
}
