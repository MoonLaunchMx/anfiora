# Agente IA de WhatsApp (Sub-proyecto 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el auto-responder de WhatsApp existente en un agente IA robusto de mundo cerrado: responde solo con datos del evento, escala a humano cuando no sabe o el tema es sensible, es prendible/apagable y calibrable por evento, con base de conocimiento (FAQ), sandbox de prueba y compliance (opt-out, ventana 24h).

**Architecture:** Pipeline anti-delirio de 5 candados (tema sensible → Context Pack grounded → `NO_SE` → self-check → compuerta de confianza + handoff). Toda la plomería de confiabilidad (idempotencia, debounce, envío) vive detrás de 3 interfaces swap-ables a Redis. Cero tablas nuevas: config en `event_settings.agent_config` (JSONB) y columnas en `guests`/`wa_messages`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (service role en API), Twilio WhatsApp, Claude Haiku (`@anthropic-ai/sdk`), Tailwind v4.

**Verificación (NO TDD):** CLAUDE.md prohíbe tests durante MVP. Cada tarea se verifica con `npx tsc --noEmit` y/o `npm run build`, más prueba manual en `localhost:3000` (NUNCA 3001) y el sandbox del agente. Commits frecuentes y en español sin acentos.

**Regla de oro:** El código se pushea ANTES de aplicar SQL en Supabase. El SQL (Task 1) lo corre Diego manualmente; no lo ejecuta ningún agente.

---

## Estructura de archivos

**Nuevos (lib):**
- `lib/whatsapp/config.ts` — constantes (`DEBOUNCE_MS`, keywords opt-out/sensibles), `DEFAULT_AGENT_CONFIG`, `getAgentConfig`, `buildHolding`.
- `lib/whatsapp/reliability.ts` — `isDuplicate`, `isWithinSession`, `detectOptOut`, `applyOptOut`, `claimInboundForReply` (debounce), `enqueueOutbound` (envío + guard opt-out). Las 3 interfaces swap-ables.
- `lib/whatsapp/context-pack.ts` — `buildContextPack`, `buildPreviewPack`, `renderContextPackText`.
- `lib/whatsapp/agent.ts` — `runAgentPipeline` (orquestación de los 5 candados), tipo `AgentOutcome`.

**Modificados (lib):**
- `lib/types.ts` — tipos `AgentConfig` y afines; extender `EventSettings`, `Guest`, `WaMessage`.
- `lib/ai-rsvp.ts` — agregar `generateGroundedReply` (sentinel `NO_SE`) y `selfCheckReply`.

**Nuevos (API):**
- `app/api/whatsapp/agent/preview/route.ts` — sandbox (corre el pipeline sin enviar ni escribir DB).
- `app/api/whatsapp/agent/approve/route.ts` — copiloto: envía un borrador y limpia el handoff.

**Modificados (API):**
- `app/api/webhook/whatsapp/route.ts` — reescritura usando el pipeline.
- `app/api/whatsapp/send/route.ts` — pasar por `enqueueOutbound` (guard opt-out) y marcar `author='human'`.

**Nuevos (UI):**
- `app/events/[id]/mensajes/AgentePanel.tsx` — config del agente (switch, modo, sensibles, tono, firma, FAQ auto+manual, sandbox, gaps).

**Modificados (UI):**
- `app/events/[id]/mensajes/page.tsx` — tabs (Conversaciones | Agente), badge de handoff, botón "Aprobar y enviar" en copiloto.

---

## Task 1: SQL migration + tipos compartidos

**Files:**
- Create: `docs/superpowers/plans/whatsapp-ia-migration.sql`
- Modify: `lib/types.ts`

- [ ] **Step 1: Escribir el SQL de migración (lo corre Diego, no un agente)**

Create `docs/superpowers/plans/whatsapp-ia-migration.sql`:

```sql
-- event_settings: config del agente
alter table event_settings add column if not exists agent_config jsonb;

-- guests: opt-out + handoff
alter table guests add column if not exists wa_opt_out boolean not null default false;
alter table guests add column if not exists wa_opt_out_at timestamptz;
alter table guests add column if not exists wa_needs_human boolean not null default false;
alter table guests add column if not exists wa_needs_human_reason text;

-- wa_messages: idempotencia + estado + autor
alter table wa_messages add column if not exists twilio_sid text;
alter table wa_messages add column if not exists status text;
alter table wa_messages add column if not exists author text;

-- idempotencia: un MessageSid de Twilio no se inserta dos veces
create unique index if not exists wa_messages_twilio_sid_uniq
  on wa_messages (twilio_sid) where twilio_sid is not null;
```

- [ ] **Step 2: Extender tipos en `lib/types.ts`**

Agregar después del bloque `WaMessage` (cerca de línea 156):

```ts
// ─── WHATSAPP AGENT ──────────────────────────────────────────────────────────

export type AgentMode = 'autonomo' | 'copiloto'
export type AgentTone = 'calido' | 'formal'

export type FaqEntry = { q: string; a: string }

export type AgentEscalateConfig = {
  alergias: boolean
  quejas: boolean
  cambios_invitados: boolean
  fuera_de_info: boolean
}

export type AgentConfig = {
  enabled: boolean
  mode: AgentMode
  tone: AgentTone
  signature: string
  escalate: AgentEscalateConfig
  faq: FaqEntry[]
}
```

Extender `EventSettings` (agregar campo):

```ts
  agent_config: AgentConfig | null
```

Extender `Guest` (agregar campos opcionales al final del type):

```ts
  wa_opt_out?: boolean
  wa_opt_out_at?: string | null
  wa_needs_human?: boolean
  wa_needs_human_reason?: string | null
```

Extender `WaMessage` (agregar campos opcionales):

```ts
  twilio_sid?: string | null
  status?: string | null
  author?: 'ia' | 'human' | null
```

- [ ] **Step 3: Verificar que los tipos compilan y no rompen consumidores**

Run: `npx tsc --noEmit`
Expected: 0 errores. (Los campos nuevos son opcionales / nullable, no rompen páginas existentes.)

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts docs/superpowers/plans/whatsapp-ia-migration.sql
git commit -m "feat(whatsapp-ia): tipos del agente y SQL de migracion"
```

> ⚠️ Diego corre `whatsapp-ia-migration.sql` en Supabase DESPUÉS de pushear el código (no antes del merge; el SQL es aditivo y seguro en preview con su propia DB si aplica).

---

## Task 2: `lib/whatsapp/config.ts` — constantes, defaults, holding

**Files:**
- Create: `lib/whatsapp/config.ts`

- [ ] **Step 1: Crear el archivo completo**

```ts
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
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add lib/whatsapp/config.ts
git commit -m "feat(whatsapp-ia): config, defaults y mensajes de holding del agente"
```

---

## Task 3: `lib/whatsapp/reliability.ts` — las 3 interfaces + compliance

**Files:**
- Create: `lib/whatsapp/reliability.ts`

- [ ] **Step 1: Crear el archivo completo**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEBOUNCE_MS, OPT_OUT_KEYWORDS } from './config'

// ── Idempotencia (Twilio reintenta el webhook) ──────────────────────────────
export async function isDuplicate(supabase: SupabaseClient, twilioSid: string | null): Promise<boolean> {
  if (!twilioSid) return false
  const { data } = await supabase
    .from('wa_messages')
    .select('id')
    .eq('twilio_sid', twilioSid)
    .limit(1)
  return !!(data && data.length > 0)
}

// ── Ventana de 24h (derivada del ultimo entrante) ───────────────────────────
export async function isWithinSession(supabase: SupabaseClient, guestId: string): Promise<boolean> {
  const { data } = await supabase
    .from('wa_messages')
    .select('created_at')
    .eq('guest_id', guestId)
    .eq('direction', 'received')
    .order('created_at', { ascending: false })
    .limit(1)
  if (!data || data.length === 0) return false
  const last = new Date(data[0].created_at).getTime()
  return Date.now() - last < 24 * 60 * 60 * 1000
}

// ── Opt-out ─────────────────────────────────────────────────────────────────
export function detectOptOut(text: string): boolean {
  const t = text.trim().toLowerCase()
  return OPT_OUT_KEYWORDS.some(k => t === k || t.startsWith(k + ' ') || t === k + '.')
}

export async function applyOptOut(supabase: SupabaseClient, guestId: string): Promise<void> {
  await supabase
    .from('guests')
    .update({ wa_opt_out: true, wa_opt_out_at: new Date().toISOString() })
    .eq('id', guestId)
}

// ── Debounce "esperar-y-verificar" ──────────────────────────────────────────
// Espera DEBOUNCE_MS y devuelve true si este entrante sigue siendo el mas nuevo
// para el invitado (=> soy quien debe responder). Si llego uno mas nuevo, false.
export async function claimInboundForReply(
  supabase: SupabaseClient,
  guestId: string,
  inboundCreatedAt: string,
): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS))
  const { data } = await supabase
    .from('wa_messages')
    .select('created_at')
    .eq('guest_id', guestId)
    .eq('direction', 'received')
    .order('created_at', { ascending: false })
    .limit(1)
  if (!data || data.length === 0) return false
  return new Date(data[0].created_at).getTime() <= new Date(inboundCreatedAt).getTime()
}

// ── Envio (guard opt-out). Hoy: directo. Manana: cola/Redis sin tocar callers.
export type OutboundPayload = {
  to: string          // formato whatsapp:+52...
  body: string
  guestId: string
  eventId: string
  author: 'ia' | 'human'
}

export async function enqueueOutbound(supabase: SupabaseClient, p: OutboundPayload): Promise<void> {
  const { data: guest } = await supabase
    .from('guests')
    .select('wa_opt_out')
    .eq('id', p.guestId)
    .maybeSingle()
  if (guest?.wa_opt_out) {
    console.log('[WA] envio bloqueado: invitado con opt-out', p.guestId)
    return
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken  = process.env.TWILIO_AUTH_TOKEN!
  const from       = process.env.TWILIO_WHATSAPP_FROM!
  const url        = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const creds      = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const params     = new URLSearchParams({ To: p.to, From: from, Body: p.body })

  let status = 'sent'
  let sid: string | null = null
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (res.ok) {
      const json = await res.json().catch(() => ({}))
      sid = json?.sid ?? null
    } else {
      status = 'failed'
      console.error('[WA] Twilio error:', await res.text())
    }
  } catch (err) {
    status = 'failed'
    console.error('[WA] Twilio fetch fallo:', err)
  }

  await supabase.from('wa_messages').insert({
    guest_id: p.guestId,
    event_id: p.eventId,
    direction: 'sent',
    content: p.body,
    author: p.author,
    status,
    twilio_sid: sid,
    created_at: new Date().toISOString(),
  })
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add lib/whatsapp/reliability.ts
git commit -m "feat(whatsapp-ia): plomeria swap-able (idempotencia, ventana 24h, opt-out, debounce, envio)"
```

---

## Task 4: `lib/whatsapp/context-pack.ts` — la única fuente de verdad

**Files:**
- Create: `lib/whatsapp/context-pack.ts`

- [ ] **Step 1: Crear el archivo completo**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentConfig, FaqEntry } from '@/lib/types'

export type ContextPack = {
  eventName: string
  eventType: string | null
  date: string | null
  time: string | null
  venue: string | null
  address: string | null
  hosts: string | null
  guestName: string
  rsvpStatus: string | null
  partySize: number | null
  table: string | null
  allergies: string[]
  faq: FaqEntry[]
}

function hostsOf(event: any): string | null {
  const parts = [event?.host_name, event?.host_name_2].filter(Boolean)
  return parts.length ? parts.join(' y ') : null
}

export async function buildContextPack(
  supabase: SupabaseClient,
  guestId: string,
  config: AgentConfig,
): Promise<ContextPack | null> {
  const { data: guest } = await supabase
    .from('guests')
    .select('id, name, event_id, rsvp_status, party_size, allergies')
    .eq('id', guestId)
    .maybeSingle()
  if (!guest) return null

  const { data: event } = await supabase
    .from('events')
    .select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2')
    .eq('id', guest.event_id)
    .maybeSingle()

  const { data: seat } = await supabase
    .from('table_seats')
    .select('tables(name, number)')
    .eq('guest_id', guestId)
    .maybeSingle()
  const t = seat?.tables as any
  const table = t ? (t.name ?? (t.number != null ? `Mesa ${t.number}` : null)) : null

  return {
    eventName: event?.name ?? 'el evento',
    eventType: event?.event_type ?? null,
    date: event?.event_date ?? null,
    time: event?.event_time ?? null,
    venue: event?.venue ?? null,
    address: event?.address ?? null,
    hosts: hostsOf(event),
    guestName: guest.name?.trim() || 'Invitado',
    rsvpStatus: guest.rsvp_status ?? null,
    partySize: guest.party_size ?? null,
    table,
    allergies: Array.isArray(guest.allergies) ? guest.allergies : [],
    faq: config.faq ?? [],
  }
}

export async function buildPreviewPack(
  supabase: SupabaseClient,
  eventId: string,
  config: AgentConfig,
): Promise<ContextPack | null> {
  const { data: event } = await supabase
    .from('events')
    .select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2')
    .eq('id', eventId)
    .maybeSingle()
  if (!event) return null
  return {
    eventName: event.name ?? 'el evento',
    eventType: event.event_type ?? null,
    date: event.event_date ?? null,
    time: event.event_time ?? null,
    venue: event.venue ?? null,
    address: event.address ?? null,
    hosts: hostsOf(event),
    guestName: 'Invitado de prueba',
    rsvpStatus: null,
    partySize: null,
    table: null,
    allergies: [],
    faq: config.faq ?? [],
  }
}

export function renderContextPackText(pack: ContextPack): string {
  const fecha = pack.date
    ? new Date(pack.date).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const lines = [
    `Evento: ${pack.eventName}`,
    pack.eventType ? `Tipo: ${pack.eventType}` : null,
    fecha ? `Fecha: ${fecha}` : null,
    pack.time ? `Hora: ${pack.time}` : null,
    pack.venue ? `Lugar: ${pack.venue}` : null,
    pack.address ? `Direccion: ${pack.address}` : null,
    pack.hosts ? `Anfitriones: ${pack.hosts}` : null,
    `--- Invitado ---`,
    `Nombre: ${pack.guestName}`,
    pack.table ? `Mesa asignada: ${pack.table}` : null,
    pack.partySize ? `Personas en su grupo: ${pack.partySize}` : null,
    pack.allergies.length ? `Alergias registradas: ${pack.allergies.join(', ')}` : null,
  ].filter(Boolean)

  const faq = pack.faq.length
    ? `\n--- Preguntas frecuentes (respuestas oficiales) ---\n` +
      pack.faq.map(f => `P: ${f.q}\nR: ${f.a}`).join('\n')
    : ''

  return lines.join('\n') + faq
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add lib/whatsapp/context-pack.ts
git commit -m "feat(whatsapp-ia): context pack (fuente unica de verdad) + render para el prompt"
```

---

## Task 5: `lib/ai-rsvp.ts` — generación grounded + self-check

**Files:**
- Modify: `lib/ai-rsvp.ts`

- [ ] **Step 1: Agregar `generateGroundedReply` y `selfCheckReply` al final del archivo**

```ts
const NO_SE = 'NO_SE'

export async function generateGroundedReply(
  contextText: string,
  tone: 'calido' | 'formal',
  signature: string,
  history: MessageHistory[],
  guestName: string,
  incomingMessage: string,
): Promise<{ answer: string; deferred: boolean }> {
  const tono = tone === 'formal' ? 'formal y respetuoso' : 'calido y cercano'
  const firma = signature?.trim() ? `Firma como: ${signature.trim()}.` : ''

  const system = `Eres el asistente de WhatsApp de un evento. Respondes SOLO con la informacion del CONTEXTO.

REGLAS ESTRICTAS:
- Si la respuesta NO esta explicita en el CONTEXTO, responde EXACTAMENTE con el texto: ${NO_SE}
- Nunca inventes datos (horarios, direcciones, dress code, reglas) que no esten en el CONTEXTO.
- Responde en espanol, tono ${tono}, maximo 3 oraciones, estilo WhatsApp.
- Usa el nombre del invitado con naturalidad. Sin emojis, sin asteriscos. ${firma}

CONTEXTO:
${contextText}`

  const hist = history.length
    ? history.map(m => `${m.direction === 'sent' ? 'Agente' : guestName}: ${m.content}`).join('\n')
    : 'Sin mensajes previos.'

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Historial:\n${hist}\n\nMensaje de ${guestName}: "${incomingMessage}"\n\nRespuesta (o ${NO_SE}):` }],
  })

  const block = response.content[0]
  if (block.type !== 'text') return { answer: '', deferred: true }
  const text = block.text.trim()
  if (text === NO_SE || text.toUpperCase().includes(NO_SE)) return { answer: '', deferred: true }
  return { answer: text, deferred: false }
}

export async function selfCheckReply(contextText: string, reply: string): Promise<boolean> {
  const system = `Eres un verificador. Te doy un CONTEXTO y una RESPUESTA.
Devuelve UNICAMENTE "true" si cada dato afirmado en la RESPUESTA esta soportado por el CONTEXTO.
Devuelve "false" si la RESPUESTA afirma cualquier dato que no este en el CONTEXTO.
Responde solo con "true" o "false", sin nada mas.`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 5,
      system: [{ type: 'text', text: system }],
      messages: [{ role: 'user', content: `CONTEXTO:\n${contextText}\n\nRESPUESTA:\n${reply}` }],
    })
    const block = response.content[0]
    if (block.type !== 'text') return false
    return block.text.trim().toLowerCase().startsWith('true')
  } catch {
    return false  // conservador: si el verificador falla, no enviamos
  }
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add lib/ai-rsvp.ts
git commit -m "feat(whatsapp-ia): generacion grounded (NO_SE) y self-check anti-delirio"
```

---

## Task 6: `lib/whatsapp/agent.ts` — orquestación de los 5 candados

**Files:**
- Create: `lib/whatsapp/agent.ts`

- [ ] **Step 1: Crear el archivo completo**

```ts
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
```

> Nota: `MessageHistory` debe exportarse desde `lib/ai-rsvp.ts` (ya es `export interface MessageHistory`). El `interpretRSVPMessage` actual ignora guestName/eventName en su lógica de clasificación, por eso se pasan vacíos aquí.

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add lib/whatsapp/agent.ts
git commit -m "feat(whatsapp-ia): orquestacion del pipeline de 5 candados (agent.ts)"
```

---

## Task 7: Reescribir el webhook `app/api/webhook/whatsapp/route.ts`

**Files:**
- Modify: `app/api/webhook/whatsapp/route.ts` (reemplazo total del `POST`)

- [ ] **Step 1: Reemplazar el archivo completo**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateRequest } from 'twilio'
import { getAgentConfig, buildHolding } from '@/lib/whatsapp/config'
import { isDuplicate, isWithinSession, detectOptOut, applyOptOut, claimInboundForReply, enqueueOutbound } from '@/lib/whatsapp/reliability'
import { runAgentPipeline } from '@/lib/whatsapp/agent'
import type { MessageHistory } from '@/lib/ai-rsvp'

const TWIML_EMPTY = '<Response/>'

function twiml() {
  return new NextResponse(TWIML_EMPTY, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

async function isTwilioRequest(request: Request): Promise<{ valid: boolean; params: Record<string, string> }> {
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = value.toString() })
  const valid = validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    request.headers.get('x-twilio-signature') ?? '',
    process.env.TWILIO_WEBHOOK_URL!,
    params,
  )
  if (!valid) console.warn('[Webhook] Firma Twilio invalida')
  return { valid, params }
}

export async function POST(request: NextRequest) {
  const { valid, params } = await isTwilioRequest(request)
  if (!valid) return new NextResponse('Unauthorized', { status: 403 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
    const text  = (params['Body'] ?? '').trim()
    const from  = params['From'] ?? ''
    const sid   = params['MessageSid'] ?? params['SmsMessageSid'] ?? null
    const phone = from.replace(/^whatsapp:/i, '')
    if (!text || !phone) return twiml()

    // Candado de idempotencia
    if (await isDuplicate(supabase, sid)) return twiml()

    // Invitado registrado?
    const { data: guests } = await supabase
      .from('guests')
      .select('id, name, event_id, rsvp_status, wa_opt_out')
      .eq('phone', phone)
      .limit(1)
    if (!guests || guests.length === 0) return twiml()
    const guest = guests[0]
    const guestName = guest.name?.trim() || 'Invitado'

    // Opt-out entrante
    if (detectOptOut(text)) {
      await applyOptOut(supabase, guest.id)
      await supabase.from('wa_messages').insert({
        guest_id: guest.id, event_id: guest.event_id, direction: 'received',
        content: text, twilio_sid: sid, created_at: new Date().toISOString(),
      })
      return twiml()
    }

    // Guardar entrante
    const nowIso = new Date().toISOString()
    await supabase.from('wa_messages').insert({
      guest_id: guest.id, event_id: guest.event_id, direction: 'received',
      content: text, twilio_sid: sid, created_at: nowIso,
    })

    const config = await getAgentConfig(supabase, guest.event_id)

    // Agente apagado: no responde (el RSVP se actualiza con clasificacion ligera mas abajo si quisieras; aqui solo registramos)
    if (!config.enabled) return twiml()

    // Fuera de ventana de 24h: no se envia texto libre (compliance)
    if (!(await isWithinSession(supabase, guest.id))) return twiml()

    // Debounce: solo el ultimo mensaje de la rafaga responde
    if (!(await claimInboundForReply(supabase, guest.id, nowIso))) return twiml()

    // Historial para el pipeline
    const { data: hist } = await supabase
      .from('wa_messages')
      .select('direction, content')
      .eq('guest_id', guest.id)
      .order('created_at', { ascending: false })
      .limit(10)
    const history = ((hist ?? []).reverse()) as MessageHistory[]

    const outcome = await runAgentPipeline(supabase, { guestId: guest.id, incomingText: text, config, history })
    if (!outcome) return twiml()

    if (outcome.rsvp && outcome.rsvp !== guest.rsvp_status) {
      await supabase.from('guests').update({ rsvp_status: outcome.rsvp }).eq('id', guest.id)
    }

    if (outcome.action === 'reply') {
      await enqueueOutbound(supabase, { to: from, body: outcome.text, guestId: guest.id, eventId: guest.event_id, author: 'ia' })
    } else if (outcome.action === 'draft') {
      await supabase.from('wa_messages').insert({
        guest_id: guest.id, event_id: guest.event_id, direction: 'sent',
        content: outcome.text, author: 'ia', status: 'draft', created_at: new Date().toISOString(),
      })
      await supabase.from('guests').update({ wa_needs_human: true, wa_needs_human_reason: 'copiloto' }).eq('id', guest.id)
    } else if (outcome.action === 'handoff') {
      await enqueueOutbound(supabase, { to: from, body: outcome.holding, guestId: guest.id, eventId: guest.event_id, author: 'ia' })
      await supabase.from('guests').update({ wa_needs_human: true, wa_needs_human_reason: outcome.reason }).eq('id', guest.id)
    }

    return twiml()
  } catch (err: any) {
    console.error('[Webhook Error]', err?.message ?? err)
    return twiml()
  }
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add app/api/webhook/whatsapp/route.ts
git commit -m "refactor(whatsapp-ia): webhook usa pipeline (idempotencia, opt-out, 24h, debounce, handoff, copiloto)"
```

---

## Task 8: API sandbox `app/api/whatsapp/agent/preview/route.ts`

**Files:**
- Create: `app/api/whatsapp/agent/preview/route.ts`

- [ ] **Step 1: Crear el archivo completo**

```ts
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

  const intent = await interpretRSVPMessage(body.message, '', '')
  const outcome = await runPipelineOnPack(pack, body.message.trim(), intent, config, [])

  if (outcome.action === 'reply' || outcome.action === 'draft') {
    return NextResponse.json({ kind: 'answer', text: outcome.text })
  }
  return NextResponse.json({ kind: 'handoff', text: outcome.holding, reason: outcome.reason })
}
```

- [ ] **Step 2: Verificar compilación + prueba manual**

Run: `npx tsc --noEmit`
Expected: 0 errores. (Prueba funcional real en Task 11 vía la UI del sandbox.)

- [ ] **Step 3: Commit**

```bash
git add app/api/whatsapp/agent/preview/route.ts
git commit -m "feat(whatsapp-ia): API sandbox (corre el pipeline sin enviar ni escribir DB)"
```

---

## Task 9: API copiloto `app/api/whatsapp/agent/approve/route.ts`

**Files:**
- Create: `app/api/whatsapp/agent/approve/route.ts`

- [ ] **Step 1: Crear el archivo completo**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enqueueOutbound } from '@/lib/whatsapp/reliability'

export async function POST(request: NextRequest) {
  let body: { messageId: string; editedText?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }
  if (!body.messageId) return NextResponse.json({ error: 'Falta messageId' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: draft } = await supabase
    .from('wa_messages')
    .select('id, guest_id, event_id, content, status')
    .eq('id', body.messageId)
    .maybeSingle()
  if (!draft || draft.status !== 'draft') return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 })

  const { data: guest } = await supabase.from('guests').select('phone').eq('id', draft.guest_id).maybeSingle()
  if (!guest?.phone) return NextResponse.json({ error: 'Invitado sin telefono' }, { status: 400 })

  const text = body.editedText?.trim() || draft.content
  const to = guest.phone.startsWith('whatsapp:') ? guest.phone : `whatsapp:${guest.phone}`

  await enqueueOutbound(supabase, { to, body: text, guestId: draft.guest_id, eventId: draft.event_id, author: 'human' })
  await supabase.from('wa_messages').update({ status: 'sent_from_draft' }).eq('id', draft.id)
  await supabase.from('guests').update({ wa_needs_human: false, wa_needs_human_reason: null }).eq('id', draft.guest_id)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add app/api/whatsapp/agent/approve/route.ts
git commit -m "feat(whatsapp-ia): API aprobar borrador copiloto (envia + limpia handoff)"
```

---

## Task 10: `AgentePanel.tsx` — config del agente

**Files:**
- Create: `app/events/[id]/mensajes/AgentePanel.tsx`

- [ ] **Step 1: Crear el componente completo**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mergeAgentConfig, DEFAULT_AGENT_CONFIG } from '@/lib/whatsapp/config'
import type { AgentConfig, FaqEntry } from '@/lib/types'
import { Sparkles, Plus, Trash2, Send, Check, AlertCircle } from 'lucide-react'

const ESCALATE_LABELS: Record<keyof AgentConfig['escalate'], string> = {
  alergias: 'Alergias / restricciones',
  quejas: 'Quejas',
  cambios_invitados: 'Cambios de # de invitados',
  fuera_de_info: 'Lo que no este en mi info',
}

export default function AgentePanel({ eventId }: { eventId: string }) {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Sandbox
  const [testMsg, setTestMsg] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ kind: string; text: string; reason?: string } | null>(null)

  // Gaps
  const [gaps, setGaps] = useState<{ guestId: string; question: string }[]>([])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('event_settings').select('agent_config').eq('event_id', eventId).maybeSingle()
      setConfig(mergeAgentConfig(data?.agent_config ?? null))
      setLoading(false)
    })()
    loadGaps()
  }, [eventId])

  async function loadGaps() {
    const { data: guestsNoSe } = await supabase
      .from('guests').select('id').eq('event_id', eventId).eq('wa_needs_human', true).eq('wa_needs_human_reason', 'no_se')
    if (!guestsNoSe?.length) { setGaps([]); return }
    const ids = guestsNoSe.map(g => g.id)
    const { data: msgs } = await supabase
      .from('wa_messages').select('guest_id, content, created_at')
      .in('guest_id', ids).eq('direction', 'received').order('created_at', { ascending: false })
    const seen = new Set<string>()
    const out: { guestId: string; question: string }[] = []
    for (const m of msgs ?? []) {
      if (seen.has(m.guest_id)) continue
      seen.add(m.guest_id)
      out.push({ guestId: m.guest_id, question: m.content })
    }
    setGaps(out)
  }

  async function save(next: AgentConfig) {
    setConfig(next)
    setSaving(true)
    await supabase.from('event_settings').update({ agent_config: next }).eq('event_id', eventId)
    setSaving(false)
    setSavedAt(Date.now())
  }

  async function runTest() {
    if (!testMsg.trim()) return
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/whatsapp/agent/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, message: testMsg.trim(), config }),
      })
      setTestResult(await res.json())
    } catch { setTestResult({ kind: 'error', text: 'No se pudo probar' }) }
    finally { setTesting(false) }
  }

  function addFaq(q = '', a = '') { save({ ...config, faq: [...config.faq, { q, a }] }) }
  function updateFaq(i: number, patch: Partial<FaqEntry>) {
    const faq = config.faq.map((f, idx) => idx === i ? { ...f, ...patch } : f)
    setConfig({ ...config, faq })
  }
  function commitFaq() { save(config) }
  function removeFaq(i: number) { save({ ...config, faq: config.faq.filter((_, idx) => idx !== i) }) }

  if (loading) return <div className="p-6 text-sm text-[#9ca3af]">Cargando agente...</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-5">
      {/* Master switch */}
      <div className="flex items-center justify-between rounded-xl border border-[#e8e8e8] bg-white p-4">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-[#48C9B0]" />
          <div>
            <p className="text-sm font-semibold text-[#1D1E20]">Agente IA</p>
            <p className="text-xs text-[#9ca3af]">{config.enabled ? 'Activo: responde por WhatsApp' : 'Apagado: solo registra mensajes'}</p>
          </div>
        </div>
        <button
          onClick={() => save({ ...config, enabled: !config.enabled })}
          className={`relative h-6 w-11 rounded-full transition ${config.enabled ? 'bg-[#48C9B0]' : 'bg-[#d1d5db]'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${config.enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Modo */}
      <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Modo</p>
        <div className="grid grid-cols-2 gap-2">
          {(['autonomo', 'copiloto'] as const).map(m => (
            <button key={m} onClick={() => save({ ...config, mode: m })}
              className={`rounded-lg border px-3 py-2 text-sm transition ${config.mode === m ? 'border-[#48C9B0] bg-[#f0fdfb] font-semibold text-[#1D9E75]' : 'border-[#e8e8e8] text-[#555]'}`}>
              {m === 'autonomo' ? 'Autonomo (responde solo)' : 'Copiloto (yo apruebo)'}
            </button>
          ))}
        </div>
      </div>

      {/* Temas sensibles */}
      <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Siempre pasame a mi estos temas</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ESCALATE_LABELS) as (keyof AgentConfig['escalate'])[]).map(k => (
            <label key={k} className="flex items-center gap-2 text-sm text-[#1D1E20]">
              <input type="checkbox" checked={config.escalate[k]}
                onChange={e => save({ ...config, escalate: { ...config.escalate, [k]: e.target.checked } })} />
              {ESCALATE_LABELS[k]}
            </label>
          ))}
        </div>
      </div>

      {/* Tono y firma */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Tono</p>
          <div className="flex gap-2">
            {(['calido', 'formal'] as const).map(t => (
              <button key={t} onClick={() => save({ ...config, tone: t })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${config.tone === t ? 'border-[#48C9B0] bg-[#f0fdfb] font-semibold text-[#1D9E75]' : 'border-[#e8e8e8] text-[#555]'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Firma</p>
          <input value={config.signature} onChange={e => setConfig({ ...config, signature: e.target.value })} onBlur={() => save(config)}
            placeholder="Los novios" className="w-full rounded-lg border border-[#e8e8e8] bg-[#fafafa] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none" />
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Base de conocimiento (FAQ)</p>
          <button onClick={() => addFaq()} className="flex items-center gap-1 text-xs font-semibold text-[#48C9B0]"><Plus size={13} /> Agregar</button>
        </div>
        <p className="mb-3 rounded-lg bg-[#fafafa] p-2 text-[11px] text-[#9ca3af]">
          Lo que ya se de tu evento (fecha, lugar, mesa de cada invitado) lo leo solo. Aqui agrega lo que solo tu sabes: dress code, si pueden ir ninos, etc.
        </p>
        <div className="space-y-2">
          {config.faq.map((f, i) => (
            <div key={i} className="rounded-lg border border-[#f0f0f0] p-2">
              <input value={f.q} onChange={e => updateFaq(i, { q: e.target.value })} onBlur={commitFaq}
                placeholder="Pregunta" className="mb-1 w-full rounded border-0 bg-transparent text-sm font-medium focus:outline-none" />
              <div className="flex items-start gap-2">
                <textarea value={f.a} onChange={e => updateFaq(i, { a: e.target.value })} onBlur={commitFaq} rows={1}
                  placeholder="Respuesta oficial" className="flex-1 resize-none rounded bg-[#fafafa] px-2 py-1 text-sm text-[#555] focus:outline-none" />
                <button onClick={() => removeFaq(i)} className="text-[#bbb] hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {config.faq.length === 0 && <p className="text-xs text-[#bbb]">Sin preguntas aun.</p>}
        </div>
      </div>

      {/* Gaps */}
      {gaps.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-700">Preguntas que no supe responder</p>
          <div className="space-y-1.5">
            {gaps.map((g, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-sm text-[#1D1E20]">
                <span className="truncate">{g.question}</span>
                <button onClick={() => addFaq(g.question, '')} className="shrink-0 text-xs font-semibold text-[#48C9B0]">agregar a FAQ</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sandbox */}
      <div className="rounded-xl border border-[#48C9B0]/30 bg-[#f0fdfb]/40 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1D9E75]">Prueba tu agente</p>
        <div className="flex items-end gap-2">
          <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runTest() } }}
            placeholder="Escribe como si fueras un invitado..."
            className="flex-1 resize-none rounded-lg border border-[#e8e8e8] bg-white px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none" />
          <button onClick={runTest} disabled={testing || !testMsg.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#48C9B0] text-white disabled:opacity-40">
            {testing ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Send size={15} />}
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${testResult.kind === 'handoff' ? 'bg-amber-50 text-amber-800' : 'bg-white text-[#1D1E20]'}`}>
            {testResult.kind === 'handoff' && <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700"><AlertCircle size={11} /> Escala a humano ({testResult.reason})</p>}
            {testResult.text}
          </div>
        )}
      </div>

      <div className="flex h-5 items-center justify-end text-[11px] text-[#9ca3af]">
        {saving ? 'Guardando...' : savedAt ? <span className="flex items-center gap-1"><Check size={12} className="text-[#48C9B0]" /> Guardado</span> : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add app/events/[id]/mensajes/AgentePanel.tsx
git commit -m "feat(whatsapp-ia): AgentePanel (config, FAQ auto+manual, gaps, sandbox)"
```

---

## Task 11: Integrar tabs + badge handoff + aprobar copiloto en `page.tsx`

**Files:**
- Modify: `app/events/[id]/mensajes/page.tsx`

- [ ] **Step 1: Importar el panel y el ícono de tab**

En el bloque de imports de lucide (línea ~6-10) agregar `Bot` y `Megaphone` ya está; agregar import del panel después de los imports existentes:

```tsx
import AgentePanel from './AgentePanel'
import { Bot } from 'lucide-react'
```

- [ ] **Step 2: Agregar estado de tab en `MensajesPage` (después de `const [modalProximo...]`)**

```tsx
  const [tab, setTab] = useState<'conversaciones' | 'agente'>('conversaciones')
```

- [ ] **Step 3: Extender la query de guests para traer el flag de handoff**

En `cargar()`, cambiar el select de guests para incluir `wa_needs_human`:

```tsx
      .select('id, name, phone, rsvp_status, side, tags, allergies, event_id, wa_needs_human')
```

Y en la `interface Guest` (línea ~22) agregar:

```tsx
  wa_needs_human?: boolean | null
```

- [ ] **Step 4: Envolver el render principal con una barra de tabs**

Reemplazar el `return (` principal para anteponer la barra de tabs y condicionar el contenido. La estructura nueva:

```tsx
  return (
    <div className="flex h-full flex-col bg-white text-[#1D1E20]">
      {/* Barra de tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-[#e8e8e8] px-4 pt-3">
        <button onClick={() => setTab('conversaciones')}
          className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition ${tab === 'conversaciones' ? 'border-b-2 border-[#48C9B0] text-[#1D1E20]' : 'text-[#9ca3af]'}`}>
          <MessageCircle size={15} /> Conversaciones
        </button>
        <button onClick={() => setTab('agente')}
          className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition ${tab === 'agente' ? 'border-b-2 border-[#48C9B0] text-[#1D1E20]' : 'text-[#9ca3af]'}`}>
          <Bot size={15} /> Agente
        </button>
      </div>

      {tab === 'agente' ? (
        <div className="flex-1 overflow-y-auto">
          <AgentePanel eventId={eventId} />
        </div>
      ) : (
        <div className="relative flex flex-1 overflow-hidden">
          {/* ...aqui va EXACTAMENTE el contenido de las 3 columnas que ya existe... */}
        </div>
      )}
    </div>
  )
```

Mover el contenido actual de las 3 columnas (COL 1 Lista, COL 2 Chat, COL 3 Detalles y el modal) dentro del `else` (`<div className="relative flex flex-1 overflow-hidden">`). El `<div className="relative flex h-full overflow-hidden...">` original se reemplaza por este wrapper.

- [ ] **Step 5: Badge de handoff en la lista de conversaciones**

En `PanelLista`, dentro del botón de cada conversación, después del `RsvpBadge`, agregar el indicador cuando `conv.guest.wa_needs_human`:

```tsx
                    {conv.guest.wa_needs_human && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                        <AlertCircle size={9} /> Necesita ti
                      </span>
                    )}
```

- [ ] **Step 6: Botón "Aprobar y enviar" para borradores copiloto en `PanelChat`**

En `PanelChat`, los mensajes con `msg.status === 'draft'` se renderizan distinto: en vez de burbuja enviada normal, una tarjeta con el texto y un botón. Dentro del map de mensajes `sent`, anteponer:

```tsx
                {msg.status === 'draft' ? (
                  <div className="max-w-[75%] rounded-2xl border border-amber-300 bg-amber-50 px-3.5 py-2.5">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-amber-700"><Sparkles size={10} /> Borrador del agente</p>
                    <p className="text-sm text-[#1D1E20]">{msg.content}</p>
                    <button
                      onClick={() => onAprobar(msg.id)}
                      className="mt-2 w-full rounded-lg bg-[#48C9B0] py-1.5 text-xs font-semibold text-white hover:bg-[#3ab89f]">
                      Aprobar y enviar
                    </button>
                  </div>
                ) : (
                  // ...burbuja sent normal existente...
                )}
```

Agregar `onAprobar` a `PanelChatProps` y a la firma de `PanelChat`, y la implementación en `MensajesPage`:

```tsx
  async function aprobarBorrador(messageId: string) {
    await fetch('/api/whatsapp/agent/approve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    })
    await cargar()
  }
```

Pasar `onAprobar={aprobarBorrador}` al `<PanelChat>`. Extender `WaMessage` interface local (línea ~33) con `status?: string | null` y `author?: string | null`.

- [ ] **Step 7: Verificar compilación + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build exitoso, 0 errores de tipo.

- [ ] **Step 8: Commit**

```bash
git add app/events/[id]/mensajes/page.tsx
git commit -m "feat(whatsapp-ia): tabs Conversaciones/Agente, badge handoff y aprobar borrador copiloto"
```

---

## Task 12: Endurecer `app/api/whatsapp/send/route.ts` (envío manual)

**Files:**
- Modify: `app/api/whatsapp/send/route.ts`

- [ ] **Step 1: Pasar el envío manual por `enqueueOutbound` (guard opt-out + author human)**

Reemplazar el cuerpo del `POST` para usar `enqueueOutbound` en vez de fetch directo, conservando la validación de campos y la marca de `mensaje_enviado`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enqueueOutbound } from '@/lib/whatsapp/reliability'

export async function POST(request: NextRequest) {
  let body: { guestId: string; eventId: string; phone: string; message: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }

  const { guestId, eventId, phone, message } = body
  if (!guestId || !eventId || !phone || !message?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: guest } = await supabase.from('guests').select('wa_opt_out').eq('id', guestId).maybeSingle()
  if (guest?.wa_opt_out) return NextResponse.json({ error: 'Este invitado pidio no recibir mensajes' }, { status: 409 })

  const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
  await enqueueOutbound(supabase, { to, body: message.trim(), guestId, eventId, author: 'human' })

  await supabase.from('guests').update({ rsvp_status: 'mensaje_enviado' }).eq('id', guestId).eq('rsvp_status', 'pending')

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add app/api/whatsapp/send/route.ts
git commit -m "refactor(whatsapp-ia): envio manual pasa por enqueueOutbound (guard opt-out, author human)"
```

---

## Task 13: Verificación local end-to-end

**Files:** ninguno (verificación manual)

- [ ] **Step 1: Build limpio**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 2: SQL en una DB de prueba**

Diego corre `docs/superpowers/plans/whatsapp-ia-migration.sql` en su Supabase (o instancia de preview). Confirmar columnas creadas.

- [ ] **Step 3: Levantar dev y probar el sandbox**

Run: `npm run dev` (asegurar `localhost:3000`, NO 3001)
Probar en `/events/<id>/mensajes` → tab Agente:
- Encender el agente, modo autónomo.
- Sandbox: "¿a qué hora es?" con hora cargada → responde con la hora. ✅
- Sandbox: "¿hay dress code?" sin FAQ → escala (handoff). ✅
- Agregar FAQ dress code → reintentar → responde. ✅
- Sandbox: "soy alérgico al marisco" → escala (alergia). ✅
- Cambiar a copiloto, verificar que el sandbox sigue devolviendo el texto (el copiloto solo difiere en envío real).

- [ ] **Step 4: Confirmar checklist de tareas (#7 del task list global)**

Marcar la tarea "Verificacion local" como completa solo si los 5 casos del sandbox pasan.

---

## Self-Review (cobertura del spec)

- §4.1 Context Pack → Task 4. ✅
- §4.2 Pipeline 5 candados → Task 6 (`runPipelineOnPack`). ✅
- §4.3 Interfaces swap-ables + debounce 17s → Task 2 (`DEBOUNCE_MS`), Task 3. ✅
- §5 on/off, modo autónomo/copiloto, sensibles, tono, firma → Task 6 + Task 10. ✅
- §6 schema (cero tablas) → Task 1. ✅
- §7 UI tab Agente, FAQ auto+manual, sandbox, gaps, badge handoff, aprobar copiloto → Tasks 10-11. ✅
- §8 opt-out + ventana 24h → Task 3 + Task 7. ✅
- §9 secuencia del webhook → Task 7. ✅
- §10 manejo de errores (TwiML 200, self-check conservador, config ausente=off) → Tasks 5-7. ✅
- §12 verificación local→preview→merge → Task 13 + tareas globales #7-#9. ✅

Sin placeholders. Nombres consistentes (`runPipelineOnPack`, `runAgentPipeline`, `enqueueOutbound`, `buildContextPack`, `mergeAgentConfig`, `DEBOUNCE_MS`) entre tareas.
