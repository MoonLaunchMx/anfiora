import Anthropic from '@anthropic-ai/sdk'

export type RSVPIntent = 'confirmed' | 'declined' | 'respondio' | 'accion_necesaria' | 'ambiguous'

export interface RSVPInterpretation {
  intent: RSVPIntent
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

export interface EventContext {
  name: string
  date: string | null
  time: string | null
  venue: string | null
  address: string | null
  event_type: string | null
}

export interface MessageHistory {
  direction: 'sent' | 'received'
  content: string
}

const client = new Anthropic()

const CLASSIFICATION_PROMPT = `Eres un asistente que interpreta respuestas de invitados a eventos sociales (bodas, quinceañeras, fiestas, etc.).
Tu única tarea es clasificar el mensaje en uno de 5 intents.

Responde ÚNICAMENTE con JSON válido, sin markdown, sin backticks, sin texto adicional antes o después:
{"intent": "confirmed", "confidence": "high", "reasoning": "explicación breve"}

─── DEFINICIONES ───────────────────────────────────────────────

"confirmed" — el invitado confirma claramente que asistirá.
  ✓ "sí voy", "ahí estaremos", "confirmado", "claro que sí", "simón", "de una", "allá nos vemos", "con gusto asistimos", "contamos con ir"

"declined" — el invitado declina claramente que no podrá asistir.
  ✓ "no puedo", "no voy a poder", "nel", "qué pena pero no", "no nos será posible", "lamentablemente no podemos"

"respondio" — el invitado responde de forma real pero NO confirma ni declina asistencia.
  Incluye: preguntas sobre el evento, comentarios, acuses de recibo, información sobre llegada tardía, solicitudes de detalle logístico.
  ✓ "¿a qué hora es la ceremonia?", "¿a qué hora empieza?", "¿cuál es la dirección?", "¿cómo llego?", "¿hay estacionamiento?"
  ✓ "gracias por el aviso", "ok recibido", "hola", "entendido", "muchas gracias"
  ✓ "llegaremos un poco tarde", "iremos después de la ceremonia", "llegamos al rato"
  ✓ "¿puedo llevar a mi pareja?", "somos 3", "venimos del trabajo directo"

"accion_necesaria" — el mensaje revela un problema que el organizador DEBE atender.
  Incluye: alergias o restricciones alimentarias, discapacidad o accesibilidad, conflicto de fechas, queja, emergencia.
  ✓ "soy alérgico a los mariscos", "soy celiaco", "soy vegano", "no como cerdo", "tengo diabetes"
  ✓ "uso silla de ruedas", "no puedo subir escaleras", "estoy embarazada"
  ✓ "tengo un compromiso a esa hora pero quizás pueda ir", "no sé si podré"
  ✓ "hubo un problema con mi boleto", "no recibí la invitación"

"ambiguous" — mensaje sin contenido relevante: emojis solos, spam, texto ininteligible.
  ✓ "👍", "jaja", "ok" sin contexto

─── REGLA DE DESEMPATE ─────────────────────────────────────────

Si el mensaje combina intents, elige el de mayor impacto operativo:
  accion_necesaria > confirmed/declined > respondio > ambiguous

Valores posibles para confidence: "high", "medium", "low"`

export async function interpretRSVPMessage(
  message: string,
  guestName: string,
  eventName: string
): Promise<RSVPInterpretation> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    system: [
      {
        type: 'text',
        text: CLASSIFICATION_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Evento: "${eventName}"\nInvitado: "${guestName}"\nMensaje: "${message}"\n\nResponde solo con JSON:`,
      },
    ],
  })

  const block = response.content[0]
  if (block.type !== 'text') {
    return { intent: 'ambiguous', confidence: 'low', reasoning: 'Respuesta inesperada del modelo' }
  }

  const raw   = block.text.trim()
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(clean) as RSVPInterpretation
  } catch {
    console.error('[AI RSVP] JSON inválido:', clean)
    return { intent: 'ambiguous', confidence: 'low', reasoning: 'No se pudo parsear la respuesta' }
  }
}

export async function generateAgentReply(
  intent: RSVPIntent,
  guestName: string,
  event: EventContext,
  history: MessageHistory[],
  incomingMessage: string
): Promise<string> {
  const fechaFormateada = event.date
    ? new Date(event.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const contextoEvento = [
    `Evento: ${event.name}`,
    event.event_type ? `Tipo: ${event.event_type}` : null,
    fechaFormateada   ? `Fecha: ${fechaFormateada}` : null,
    event.time        ? `Hora: ${event.time}` : null,
    event.venue       ? `Lugar: ${event.venue}` : null,
    event.address     ? `Dirección: ${event.address}` : null,
  ].filter(Boolean).join('\n')

  const historialFormateado = history.length > 0
    ? history.map(m => `${m.direction === 'sent' ? 'Agente' : guestName}: ${m.content}`).join('\n')
    : 'Sin mensajes previos.'

  const systemPrompt = `Eres el asistente de WhatsApp de un evento social. Respondes en nombre del organizador.

CONTEXTO DEL EVENTO:
${contextoEvento}

REGLAS:
- Responde siempre en español, tono cálido y profesional
- Máximo 3 oraciones — mensajes cortos como WhatsApp real
- Usa el nombre del invitado naturalmente
- Si preguntan algo que no sabes (ej: dress code, estacionamiento), diles que el organizador les confirmará pronto
- Si confirmaron asistencia: agradece y confirma SU lugar (el del invitado). Si mencionan acompañantes, salúdalos con calidez pero NO afirmes que quedaron registrados ni confirmados uno por uno
- Si declinaron: responde con comprensión, sin presionar
- Si mencionan una alergia, restricción o necesidad especial: NO digas que ya quedó registrada o guardada; di que le pasas la información al organizador para que la tenga en cuenta
- HONESTIDAD: nunca afirmes haber realizado una acción que no puedes garantizar (registrar acompañantes, guardar alergias, asignar mesa, actualizar listas). Limítate a confirmar la asistencia del invitado y a decir que el organizador recibirá el resto
- No uses emojis
- No uses asteriscos para negritas
- Nunca inventes información que no está en el contexto del evento`

  const userPrompt = `Historial de conversación:
${historialFormateado}

Nuevo mensaje de ${guestName}: "${incomingMessage}"
Intent detectado: ${intent}

Genera la respuesta del agente:`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      { role: 'user', content: userPrompt },
    ],
  })

  const block = response.content[0]
  if (block.type !== 'text') {
    return `Gracias por escribirnos, ${guestName}. En breve te atendemos.`
  }

  return block.text.trim()
}