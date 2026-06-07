import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { interpretRSVPMessage } from '@/lib/ai-rsvp'
import { mergeAgentConfig } from '@/lib/whatsapp/config'
import { buildPreviewPack } from '@/lib/whatsapp/context-pack'
import { runPipelineOnPack } from '@/lib/whatsapp/agent'
import type { AgentConfig } from '@/lib/types'

export async function POST(request: NextRequest) {
  let body: { eventId: string; message: string; config?: Partial<AgentConfig> }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }
  if (!body.eventId || !body.message?.trim()) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const config = mergeAgentConfig(body.config ?? null)
  const pack = await buildPreviewPack(supabase, body.eventId, config)
  if (!pack) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

  const intent = await interpretRSVPMessage(body.message, pack.guestName, pack.eventName)
  const outcome = await runPipelineOnPack(pack, body.message.trim(), intent, config, [])

  if (outcome.action === 'reply' || outcome.action === 'draft') {
    return NextResponse.json({ kind: 'answer', text: outcome.text })
  }
  return NextResponse.json({ kind: 'handoff', text: outcome.message, reason: outcome.reason })
}
