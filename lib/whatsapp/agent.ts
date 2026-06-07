import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentConfig } from '@/lib/types'
import { interpretRSVPMessage, generateGroundedReply, selfCheckReply, type MessageHistory } from '@/lib/ai-rsvp'
import { buildContextPack, renderContextPackText, type ContextPack } from './context-pack'
import { buildHolding } from './config'

export type AgentOutcome =
  | { action: 'reply'; text: string; rsvp: string | null }
  | { action: 'draft'; text: string; rsvp: string | null }
  | { action: 'handoff'; holding: string; reason: string; rsvp: string | null }

function isSensitive(text: string, intent: string, config: AgentConfig): string | null {
  const t = text.toLowerCase()
  if (config.escalate.alergias && /alerg|celiac|vegano|vegetarian|intoleran|diabet|sin gluten|no como/.test(t)) return 'alergia'
  if (config.escalate.quejas && (intent === 'accion_necesaria' || /queja|molest|pesim|terrible|mal organiz|enojad/.test(t))) return 'queja'
  if (config.escalate.cambios_invitados && /somos \d|llevar a|puedo llevar|mas personas|un invitado mas|cancelar a/.test(t)) return 'cambios_invitados'
  if (intent === 'accion_necesaria') return 'accion_necesaria'
  return null
}

// Pipeline puro a partir de un ContextPack ya armado. Reusado por webhook y sandbox.
export async function runPipelineOnPack(
  pack: ContextPack,
  incomingText: string,
  intent: { intent: string; confidence: string },
  config: AgentConfig,
  history: MessageHistory[],
): Promise<AgentOutcome> {
  const rsvp =
    intent.intent === 'confirmed' || intent.intent === 'declined' ||
    intent.intent === 'respondio' || intent.intent === 'accion_necesaria'
      ? (intent.confidence !== 'low' ? intent.intent : null)
      : null

  // Candado 1: tema sensible -> handoff
  const sensitive = isSensitive(incomingText, intent.intent, config)
  if (sensitive) {
    return { action: 'handoff', holding: buildHolding(config, pack.guestName, sensitive), reason: sensitive, rsvp }
  }

  const contextText = renderContextPackText(pack)

  // Candado 2-3: generacion grounded (mundo cerrado)
  const gen = await generateGroundedReply(contextText, config.tone, config.signature, history, pack.guestName, incomingText)
  if (gen.deferred) {
    return { action: 'handoff', holding: buildHolding(config, pack.guestName, 'no_se'), reason: 'no_se', rsvp }
  }

  // Candado 4: self-check
  const ok = await selfCheckReply(contextText, gen.answer)
  if (!ok) {
    return { action: 'handoff', holding: buildHolding(config, pack.guestName, 'self_check'), reason: 'self_check', rsvp }
  }

  // Candado 5: confianza
  if (intent.confidence === 'low') {
    return { action: 'handoff', holding: buildHolding(config, pack.guestName, 'baja_confianza'), reason: 'baja_confianza', rsvp }
  }

  // Modo copiloto: borrador en vez de envio
  if (config.mode === 'copiloto') {
    return { action: 'draft', text: gen.answer, rsvp }
  }
  return { action: 'reply', text: gen.answer, rsvp }
}

// Entrada desde el webhook: arma el pack del invitado real y corre el pipeline.
export async function runAgentPipeline(
  supabase: SupabaseClient,
  args: { guestId: string; incomingText: string; config: AgentConfig; history: MessageHistory[] },
): Promise<AgentOutcome | null> {
  const intent = await interpretRSVPMessage(args.incomingText, '', '')
  const pack = await buildContextPack(supabase, args.guestId, args.config)
  if (!pack) return null
  return runPipelineOnPack(pack, args.incomingText, intent, args.config, args.history)
}
