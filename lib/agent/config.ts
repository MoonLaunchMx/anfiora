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
  holdingMessage: 'Gracias por tu mensaje. En breve te confirmamos.',
  deflectMessage: 'Por ahora no tengo ese dato. Te sugiero confirmarlo directamente con los novios.',
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
