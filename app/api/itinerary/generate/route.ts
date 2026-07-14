import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  buildItineraryPrompt,
  parseItineraryResponse,
  ITINERARY_SYSTEM_PROMPT,
  type GenerateItineraryInput,
} from '@/lib/itinerary-ai'

const client = new Anthropic()

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as GenerateItineraryInput
    const userPrompt = buildItineraryPrompt(input)

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: [{ type: 'text', text: ITINERARY_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    })

    const block = response.content[0]
    if (block.type !== 'text') {
      return NextResponse.json({ error: 'Respuesta inesperada del modelo' }, { status: 502 })
    }

    const moments = parseItineraryResponse(block.text)
    return NextResponse.json({ moments })
  } catch (e) {
    console.error('[itinerary/generate]', e)
    return NextResponse.json({ error: 'No se pudo generar el itinerario' }, { status: 500 })
  }
}
