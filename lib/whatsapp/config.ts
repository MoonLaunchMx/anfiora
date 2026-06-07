import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentConfig } from '@/lib/types'

export const DEBOUNCE_MS = 17_000

export const OPT_OUT_KEYWORDS = [
  'stop', 'baja', 'dar de baja', 'darme de baja', 'cancelar',
  'no molestar', 'unsubscribe', 'cancelar suscripcion',
]

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  mode: 'autonomo',
  tone: 'calido',
  signature: '',
  escalate: { alergias: true, quejas: true, cambios_invitados: true, fuera_de_info: true },
  faq: [],
}

export function mergeAgentConfig(raw: Partial<AgentConfig> | null | undefined): AgentConfig {
  if (!raw) return DEFAULT_AGENT_CONFIG
  return {
    ...DEFAULT_AGENT_CONFIG,
    ...raw,
    escalate: { ...DEFAULT_AGENT_CONFIG.escalate, ...(raw.escalate ?? {}) },
    faq: Array.isArray(raw.faq) ? raw.faq : [],
  }
}

export async function getAgentConfig(supabase: SupabaseClient, eventId: string): Promise<AgentConfig> {
  const { data } = await supabase
    .from('event_settings')
    .select('agent_config')
    .eq('event_id', eventId)
    .maybeSingle()
  return mergeAgentConfig(data?.agent_config ?? null)
}

export function buildHolding(config: AgentConfig, guestName: string, reason: string): string {
  const firma = config.signature?.trim()
  const cierre = firma ? ` ${firma} te confirma en breve.` : ' Te confirmamos en breve.'
  if (reason === 'alergia') {
    return `Gracias, ${guestName}. Lo anotamos y nos aseguramos de tener una opcion para ti.${cierre}`
  }
  if (reason === 'queja') {
    return `Lamento la molestia, ${guestName}. Le paso tu mensaje al organizador para atenderlo personalmente.`
  }
  return `Gracias por tu mensaje, ${guestName}. Dejame confirmarlo y te aviso.${cierre}`
}
