import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractionResult, WritePlan } from './apply'

const client = new Anthropic()

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'registrar_lectura',
  description: 'Registra lo que el invitado comunico sobre su asistencia, la de sus acompanantes y alergias. Extrae solo hechos explicitos del mensaje; no inventes.',
  input_schema: {
    type: 'object',
    properties: {
      attendance: { type: 'string', enum: ['confirmed', 'declined', 'none'], description: 'Asistencia del titular. none si no la menciona.' },
      companions: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['all', 'none', 'named', 'partial_ambiguous'], description: "all si van todos; none si solo va el titular o no menciona acompanantes; named si nombra a quienes van; partial_ambiguous si da un numero parcial sin decir quienes (ej: 'vamos 2' de 3)." },
          names: { type: 'array', items: { type: 'string' }, description: 'Nombres mencionados, solo si action=named.' },
        },
        required: ['action', 'names'],
      },
      allergies: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            who: { type: 'string', enum: ['titular', 'companion', 'unknown'], description: 'titular si es del que escribe; companion si es de un acompanante nombrado; unknown si no queda claro de quien.' },
            name: { type: 'string', description: 'Nombre del acompanante si who=companion y lo dijo; cadena vacia si no.' },
            text: { type: 'string', description: 'La alergia o restriccion: mariscos, gluten, vegano, etc.' },
          },
          required: ['who', 'name', 'text'],
        },
      },
      complaint: { type: 'boolean', description: 'true si el mensaje contiene una queja o molestia.' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'low si el mensaje es ambiguo, ininteligible o no estas seguro de la lectura.' },
    },
    required: ['attendance', 'companions', 'allergies', 'complaint', 'confidence'],
  },
}

const SYSTEM = `Eres un lector de mensajes de invitados a eventos sociales (bodas, fiestas).
Tu unica tarea es extraer hechos del mensaje y registrarlos con la herramienta registrar_lectura.
Reglas:
- Extrae SOLO lo que el mensaje dice explicitamente. No infieras ni inventes.
- Si el invitado no menciona su asistencia, attendance='none'.
- companions.action='all' solo si dice claramente que van todos sus acompanantes.
- Si menciona una alergia sin dejar claro de quien es, who='unknown'.
- Si dudas de la lectura, confidence='low'.
- Siempre responde llamando a la herramienta, nunca con texto libre.`

const FALLBACK: ExtractionResult = {
  attendance: 'none', companions: { action: 'none', names: [] }, allergies: [], complaint: false, confidence: 'low',
}

export async function extractFromMessage(
  message: string,
  ctx: { guestName: string; eventName: string; partyMembers: string[] },
): Promise<ExtractionResult> {
  const acompanantes = ctx.partyMembers.length ? ctx.partyMembers.join(', ') : 'ninguno registrado'
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'registrar_lectura' },
      messages: [
        { role: 'user', content: `Evento: "${ctx.eventName}"\nInvitado titular: "${ctx.guestName}"\nAcompanantes registrados: ${acompanantes}\n\nMensaje del invitado: "${message}"` },
      ],
    })
    const block = res.content.find((b) => b.type === 'tool_use')
    if (block && block.type === 'tool_use') return block.input as unknown as ExtractionResult
    return FALLBACK
  } catch (e) {
    console.error('[Agent] extractFromMessage fallo:', e instanceof Error ? e.message : e)
    return FALLBACK
  }
}

export async function executeWritePlan(supabase: SupabaseClient, plan: WritePlan, guestId: string): Promise<void> {
  if (plan.guestUpdate) {
    const { error } = await supabase.from('guests').update(plan.guestUpdate).eq('id', guestId)
    if (error) console.error('[Agent] guest update fallo:', JSON.stringify(error))
  }
  for (const u of plan.partyMemberUpdates) {
    const { id, ...fields } = u
    if (Object.keys(fields).length === 0) continue
    const { error } = await supabase.from('party_members').update(fields).eq('id', id)
    if (error) console.error('[Agent] party_member update fallo:', JSON.stringify(error))
  }
}
