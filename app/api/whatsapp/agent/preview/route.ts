import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { interpretRSVPMessage, distillGuestMemory, type MessageHistory } from '@/lib/ai-rsvp'
import { mergeAgentConfig } from '@/lib/whatsapp/config'
import { buildPreviewPack } from '@/lib/whatsapp/context-pack'
import { runPipelineOnPack } from '@/lib/whatsapp/agent'
import type { AgentConfig } from '@/lib/types'

export async function POST(request: NextRequest) {
  let body: { eventId: string; message: string; config?: Partial<AgentConfig>; memory?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }
  if (!body.eventId || !body.message?.trim()) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const config = mergeAgentConfig(body.config ?? null)
  const pack = await buildPreviewPack(supabase, body.eventId, config)
  if (!pack) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

  // Sandbox: inyecta una memoria de prueba para validar (1) que ajusta el trato y
  // (2) que NO sirve para inventar hechos (debe escalar/NO_SE si solo la memoria lo sostiene).
  pack.memory = typeof body.memory === 'string' && body.memory.trim() ? body.memory.trim() : null

  const intent = await interpretRSVPMessage(body.message, pack.guestName, pack.eventName)
  const outcome = await runPipelineOnPack(pack, body.message.trim(), intent, config, [])

  const replyText = outcome.action === 'reply' || outcome.action === 'draft' ? outcome.text : null

  // Muestra la nota que el agente recordaria de este intercambio (mismo destilador que el webhook).
  let distilledMemory: string | null = null
  if (replyText) {
    const turn: MessageHistory[] = [
      { direction: 'received', content: body.message.trim() },
      { direction: 'sent', content: replyText },
    ]
    distilledMemory = await distillGuestMemory(pack.memory, turn, pack.guestName)
  }

  if (outcome.action === 'handoff') {
    return NextResponse.json({ kind: 'handoff', text: outcome.message, reason: outcome.reason, distilledMemory })
  }
  return NextResponse.json({ kind: 'answer', text: outcome.text, distilledMemory })
}
