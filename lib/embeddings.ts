import OpenAI from 'openai'

const MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 100 // OpenAI allows up to 2048 inputs per request

export function getOpenAI(apiKey: string): OpenAI {
  return new OpenAI({ apiKey })
}

export async function embedTexts(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const client = getOpenAI(apiKey)
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const response = await client.embeddings.create({
      model: MODEL,
      input: batch,
    })
    for (const item of response.data) {
      results.push(item.embedding)
    }
  }

  return results
}

export async function embedQuery(query: string, apiKey: string): Promise<number[]> {
  const client = getOpenAI(apiKey)
  const response = await client.embeddings.create({
    model: MODEL,
    input: query,
  })
  return response.data[0].embedding
}
