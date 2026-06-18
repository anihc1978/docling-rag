import { NextResponse } from 'next/server'
import { getStats } from '@/lib/knowledge-store'

export async function GET() {
  return NextResponse.json({
    ...(await getStats()),
    hasApiKey: !!process.env.OPENAI_API_KEY,
  })
}
