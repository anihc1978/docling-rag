# DoclingRAG

> Ask questions about any PDF, web page, or text file — answers come back streamed, grounded, and cited.

**🔗 Live demo:** https://docling-rag.vercel.app

DoclingRAG is a retrieval-augmented document Q&A app. Drop in a URL or upload a PDF/TXT/Markdown file, and it extracts the text, chunks it, embeds it, and lets you chat with the contents. Every answer is generated strictly from the retrieved passages and comes with expandable source cards (filename, page numbers, and a relevance score) so you can see exactly where it came from.

## Features
- **Multiple ingestion paths** — index a document from a URL (HTML pages or PDFs, including arXiv) or upload a PDF / TXT / Markdown file directly.
- **Hybrid retrieval** — semantic vector search over OpenAI embeddings, with an automatic keyword-search fallback when embeddings aren't available.
- **Streamed answers** — responses stream token-by-token over Server-Sent Events for a live typing feel.
- **Cited sources** — each answer surfaces the top retrieved chunks with title, page numbers, and a percentage match score.
- **Durable, shared knowledge store** — the index persists in Vercel Blob so it survives cold starts and is shared across the ingest, chat, and status serverless functions.
- **Smart text extraction** — strips nav/footer/script noise from web pages with Cheerio and parses PDFs with pdf-parse, then chunks on paragraph boundaries with overlap.
- **Server-side keys** — all OpenAI calls run in API routes; no key ever touches the browser.

## How it works
The app is built on **Next.js (App Router)** with React 19. Documents are ingested through the `/api/ingest` route, which extracts text (Cheerio for HTML, pdf-parse for PDFs), splits it into ~800-character overlapping chunks, embeds them with OpenAI's `text-embedding-3-small`, and writes the resulting vectors to **Vercel Blob** as durable JSON. At chat time, `/api/chat` embeds the question, ranks stored chunks by cosine similarity, and feeds the top matches as context to OpenAI **`gpt-4o-mini`**, streaming the completion back as SSE while emitting the matched sources as a final event. The OpenAI SDK runs entirely server-side, so the `OPENAI_API_KEY` lives only in the Next.js runtime — never in the client.

## Tech stack
- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript
- **AI provider:** OpenAI — `gpt-4o-mini` (chat) and `text-embedding-3-small` (embeddings) via the `openai` SDK
- **Retrieval:** in-house cosine-similarity vector search with a keyword-search fallback
- **Document parsing:** `pdf-parse` (PDFs), `cheerio` (HTML)
- **UI:** Tailwind CSS v4, lucide-react icons
- **Storage:** Vercel Blob (durable JSON knowledge store)
- **Hosting:** Vercel

## Running locally
```bash
npm install
npm run dev
```

## Environment variables
| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Server-side OpenAI key used for embeddings (`text-embedding-3-small`) and chat completions (`gpt-4o-mini`). Required for semantic search and AI answers. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for durable, cross-function persistence of the knowledge store. When absent, the app falls back to an in-memory store for local dev. |

---
*Part of my AI engineering portfolio — built by Eduardo San Martin ([github.com/anihc1978](https://github.com/anihc1978)).*
