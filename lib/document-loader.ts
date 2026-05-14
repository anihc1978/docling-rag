import * as cheerio from 'cheerio'

export async function loadFromUrl(url: string): Promise<{ text: string; title: string }> {
  const isPdf = url.toLowerCase().includes('.pdf') || url.includes('arxiv.org/pdf')

  if (isPdf) {
    return loadPdf(url)
  }
  return loadHtml(url)
}

async function loadHtml(url: string): Promise<{ text: string; title: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoclingRAG/1.0)' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  // Remove noise elements
  $('script, style, nav, footer, header, aside, .nav, .footer, .sidebar').remove()

  const title = $('title').text().trim() || $('h1').first().text().trim() || url

  // Extract main content
  const mainSelectors = ['main', 'article', '.content', '.main-content', '#content', 'body']
  let text = ''
  for (const sel of mainSelectors) {
    const el = $(sel)
    if (el.length) {
      text = el.text()
      break
    }
  }

  text = cleanText(text || $('body').text())
  return { text, title }
}

async function loadPdf(url: string): Promise<{ text: string; title: string }> {
  // Fetch PDF bytes, then use pdf-parse
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching PDF`)

  const buffer = Buffer.from(await res.arrayBuffer())

  // pdf-parse must run in Node.js (not Edge) — listed in serverExternalPackages
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string; info: Record<string, string> }>
  const data = await pdfParse(buffer)

  const title = data.info?.Title || url.split('/').pop() || 'Document'
  return { text: cleanText(data.text), title }
}

export async function loadFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; title: string }> {
  const ext = filename.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string; info: Record<string, string> }>
    const data = await pdfParse(buffer)
    return { text: cleanText(data.text), title: data.info?.Title || filename }
  }

  if (ext === 'txt' || ext === 'md') {
    return { text: cleanText(buffer.toString('utf-8')), title: filename }
  }

  throw new Error(`Unsupported file type: .${ext}. Supported: pdf, txt, md`)
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}
