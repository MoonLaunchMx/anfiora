import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentConfig } from '@/lib/types'
import { interpretRSVPMessage, generateGroundedReply, selfCheckReply, type MessageHistory } from '@/lib/ai-rsvp'
import { buildContextPack, renderContextPackText, type ContextPack } from './context-pack'

export type AgentOutcome =
  | { action: 'reply'; text: string; rsvp: string | null }
  | { action: 'draft'; text: string; rsvp: string | null }
  | { action: 'handoff'; message: string; reason: string; escalate: boolean; rsvp: string | null }

function isSensitive(text: string, intent: string, config: AgentConfig): string | null {
  const t = text.toLowerCase()
  if (config.escalate.alergias && /alerg|celiac|vegano|vegetarian|intoleran|diabet|sin gluten|no como/.test(t)) return 'alergia'
  if (config.escalate.quejas && (intent === 'accion_necesaria' || /queja|molest|pesim|terrible|mal organiz|enojad/.test(t))) return 'queja'
  if (intent === 'accion_necesaria') return 'accion_necesaria'
  return null
}

// Peticion relacionada a acompañantes / numero de invitados. Solo se usa cuando el
// agente NO pudo responder desde la FAQ ni los datos del invitado (gen deferred):
// en ese caso se escala para que el organizador se entere de la peticion.
function isCompanionRequest(text: string): boolean {
  return /llevar|acompañ|acompan|somos \d|mas persona|agregar|sumar|invitad|nin[oñ]|hij|pareja/.test(text.toLowerCase())
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
    return { action: 'handoff', message: config.holdingMessage, reason: sensitive, escalate: true, rsvp }
  }

  const contextText = renderContextPackText(pack)

  // Candado 2-3: generacion grounded (mundo cerrado). La memoria episodica entra
  // como notas blandas para el trato, NO al contextText que ve el self-check.
  const gen = await generateGroundedReply(contextText, config.tone, config.signature, history, pack.guestName, incomingText, pack.memory)
  if (gen.deferred) {
    if (config.escalate.cambios_invitados && isCompanionRequest(incomingText)) {
      return { action: 'handoff', message: config.holdingMessage, reason: 'cambios_invitados', escalate: true, rsvp }
    }
    const escalate = config.escalate.fuera_de_info
    return { action: 'handoff', message: escalate ? config.holdingMessage : config.deflectMessage, reason: 'no_se', escalate, rsvp }
  }

  // Candado 4: self-check
  const ok = await selfCheckReply(contextText, gen.answer)
  if (!ok) {
    return { action: 'handoff', message: config.holdingMessage, reason: 'self_check', escalate: true, rsvp }
  }

  // Candado 5: confianza
  if (intent.confidence === 'low') {
    return { action: 'handoff', message: config.holdingMessage, reason: 'baja_confianza', escalate: true, rsvp }
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
  const pack = await buildContextPack(supabase, args.guestId, args.config)
  if (!pack) return null
  const intent = await interpretRSVPMessage(args.incomingText, pack.guestName, pack.eventName)
  return runPipelineOnPack(pack, args.incomingText, intent, args.config, args.history)
}
