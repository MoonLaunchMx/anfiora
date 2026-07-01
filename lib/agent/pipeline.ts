import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentConfig } from '@/lib/types'
import { interpretRSVPMessage, generateGroundedReply, selfCheckReply, type MessageHistory } from '@/lib/ai-rsvp'
import { buildContextPack, renderContextPackText, type ContextPack } from './context-pack'
import { renderAppliedActions, type AppliedSummary } from './apply'

export type AgentOutcome =
  | { action: 'reply'; text: string; rsvp: string | null }
  | { action: 'draft'; text: string; rsvp: string | null }
  | { action: 'handoff'; message: string; reason: string; escalate: boolean; rsvp: string | null }

// Pipeline puro a partir de un ContextPack ya armado. Reusado por webhook y sandbox.
export async function runPipelineOnPack(
  pack: ContextPack,
  incomingText: string,
  intent: { intent: string; confidence: string },
  config: AgentConfig,
  history: MessageHistory[],
  opts?: { applied?: AppliedSummary | null; escalate?: 'queja' | null },
): Promise<AgentOutcome> {
  const rsvp = null // la asistencia la escribe el guardia; el pipeline ya no la decide

  // Candado 1: solo se escala queja (decidido por el guardia/extraccion, no por regex)
  if (opts?.escalate) {
    return { action: 'handoff', message: config.holdingMessage, reason: opts.escalate, escalate: true, rsvp }
  }

  // Contexto grounded + acciones realizadas (verdaderas; el self-check las ve)
  const contextText = renderContextPackText(pack) + renderAppliedActions(opts?.applied)

  const gen = await generateGroundedReply(contextText, config.tone, config.signature, history, pack.guestName, incomingText, pack.memory)
  if (gen.deferred) {
    const escalate = config.escalate.fuera_de_info
    return { action: 'handoff', message: escalate ? config.holdingMessage : config.deflectMessage, reason: 'no_se', escalate, rsvp }
  }

  const ok = await selfCheckReply(contextText, gen.answer)
  if (!ok) return { action: 'handoff', message: config.holdingMessage, reason: 'self_check', escalate: true, rsvp }

  if (intent.confidence === 'low') return { action: 'handoff', message: config.holdingMessage, reason: 'baja_confianza', escalate: true, rsvp }

  if (config.mode === 'copiloto') return { action: 'draft', text: gen.answer, rsvp }
  return { action: 'reply', text: gen.answer, rsvp }
}

// Entrada desde el webhook: arma el pack del invitado real y corre el pipeline.
export async function runAgentPipeline(
  supabase: SupabaseClient,
  args: { guestId: string; incomingText: string; config: AgentConfig; history: MessageHistory[] },
): Promise<AgentOutcome | null> {
  const pack = await buildContextPack(supabase, args.guestId, args.config)
  if (!pack) return null
  const intent = await interpretRSVPMessage(args.incomingText, pack.guestName, pack.eventName)
  return runPipelineOnPack(pack, args.incomingText, intent, args.config, args.history)
}
