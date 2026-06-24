# Nucleo omnicanal v1 — Fundacion + WhatsApp dual-write — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear las tablas canonicas del nucleo omnicanal y hacer que cada mensaje de WhatsApp (entrante y saliente) tambien se escriba al modelo canonico, sin alterar el comportamiento actual del agente ni del envio.

**Architecture:** Patron ports & adapters. Un modulo de "espejo" (`canonical-mirror`) traduce cada `wa_messages` a `conversations` + `messages` canonicos. Se engancha despues de cada insert existente de `wa_messages`, con fallo silencioso (como el audit log) para que NUNCA rompa el flujo de WhatsApp. Mas un backfill idempotente del historial.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (`@supabase/supabase-js` con `SUPABASE_SERVICE_ROLE_KEY` en API routes), Twilio (WhatsApp BSP).

## Global Constraints

- **No romper produccion de WhatsApp.** El flujo actual (`app/api/webhook/whatsapp/route.ts` + `lib/whatsapp/reliability.ts`) sigue escribiendo `wa_messages` EXACTAMENTE igual. El espejo es aditivo y de fallo silencioso.
- **Claude NO modifica Supabase.** Toda SQL (DDL) la aplica Diego manualmente en el SQL editor de Supabase. El plan provee la SQL; no la ejecuta.
- **Sin suite de tests** (regla MVP). La verificacion es por: `npm run build`, `npm run lint`, y consultas SQL de comprobacion. No se introduce framework de tests.
- **Full file replacement** para archivos modificados: el plan muestra el archivo completo, no fragmentos.
- **Sin acentos ni enie en mensajes de commit.** Convencionales: `feat:`, `fix:`, `chore:`.
- **`core.sql` es agnostico de dominio** y `anfiora.sql` lleva el acoplamiento. Fuente de verdad del esquema: `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/{core.sql,anfiora.sql}`.
- **Mapeos canonicos fijos:** `direction` `'received'->'inbound'`, `'sent'->'outbound'`; `author_type` inbound`->'contact'`, outbound `'ia'->'ai'` / `'human'->'human'`; `provider_message_id = twilio_sid ?? 'wa:'+wa_messages.id` (garantiza idempotencia incluso sin sid).

---

### Task 1: Aplicar el esquema canonico en Supabase

**Files:**
- Usa (no modifica): `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/core.sql`
- Usa (no modifica): `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/anfiora.sql`

**Interfaces:**
- Produces: las tablas `channel_accounts`, `channel_participants`, `conversations`, `messages`, `webhook_events` con sus constraints e indices; columnas de dominio `tenant_id`/`contact_guest_id`/`contact_supplier_id` + FK + RLS.

- [ ] **Step 1: Diego aplica `core.sql` en Supabase**

Abrir el SQL editor de Supabase (proyecto Anfiora) y ejecutar el contenido completo de `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/core.sql`.

- [ ] **Step 2: Diego aplica `anfiora.sql` en Supabase**

Ejecutar el contenido completo de `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/anfiora.sql` (despues de core.sql).

- [ ] **Step 3: Verificar que las 5 tablas existen**

Ejecutar en el SQL editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('channel_accounts','channel_participants','conversations','messages','webhook_events')
order by table_name;
```

Expected: 5 filas.

- [ ] **Step 4: Verificar las columnas de dominio y el CHECK**

```sql
select conname
from pg_constraint
where conrelid = 'conversations'::regclass
  and conname in ('chk_cv_contact_xor','fk_cv_tenant','fk_cv_guest','fk_cv_supplier');
```

Expected: 4 filas.

- [ ] **Step 5: Verificar la llave unica de participantes (aislamiento por workspace)**

```sql
select indexdef
from pg_indexes
where tablename = 'channel_participants'
  and indexdef ilike '%unique%';
```

Expected: incluye `(channel_account_id, workspace_id, external_id)`.

---

### Task 2: Modulo de espejo canonico (`canonical-mirror.ts`)

**Files:**
- Create: `lib/whatsapp/canonical-mirror.ts`

**Interfaces:**
- Consumes: tablas de Task 1; `SupabaseClient` (service role).
- Produces:
  - `mirrorInbound(supabase, p: { guest: { id: string; name: string | null; event_id: string }; phone: string; text: string; sid: string | null; createdAt: string }): Promise<void>`
  - `mirrorOutbound(supabase, p: { to: string; guestId: string; eventId: string; text: string; author: 'ia' | 'human'; status: string; sid: string | null; createdAt: string }): Promise<void>`
  - Ambas son de **fallo silencioso** (try/catch interno, nunca lanzan).

- [ ] **Step 1: Crear el modulo completo**

Crear `lib/whatsapp/canonical-mirror.ts` con este contenido exacto:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

// Espejo del flujo WhatsApp al modelo canonico omnicanal. Aditivo y de FALLO
// SILENCIOSO: nunca lanza, nunca rompe el webhook (mismo contrato que el audit log).
// El canal compartido de Anfiora se identifica por el numero de TWILIO_WHATSAPP_FROM.

const WA_CHANNEL = 'whatsapp'

function sharedAccountExternalId(): string {
  return (process.env.TWILIO_WHATSAPP_FROM ?? '').replace(/^whatsapp:/i, '')
}

async function eventOwner(supabase: SupabaseClient, eventId: string): Promise<string | null> {
  const { data } = await supabase.from('events').select('user_id').eq('id', eventId).maybeSingle()
  return data?.user_id ?? null
}

async function ensureChannelAccount(supabase: SupabaseClient): Promise<string | null> {
  const externalId = sharedAccountExternalId()
  if (!externalId) return null
  const { data: existing } = await supabase
    .from('channel_accounts').select('id')
    .eq('channel', WA_CHANNEL).eq('external_account_id', externalId).maybeSingle()
  if (existing?.id) return existing.id
  const { data, error } = await supabase
    .from('channel_accounts')
    .insert({ channel: WA_CHANNEL, external_account_id: externalId, display_label: 'Anfiora WhatsApp (compartido)' })
    .select('id').maybeSingle()
  if (error) {
    const { data: again } = await supabase
      .from('channel_accounts').select('id')
      .eq('channel', WA_CHANNEL).eq('external_account_id', externalId).maybeSingle()
    return again?.id ?? null
  }
  return data?.id ?? null
}

async function ensureParticipant(
  supabase: SupabaseClient,
  a: { channelAccountId: string; workspaceId: string; externalId: string; displayName: string | null },
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('channel_participants').select('id')
    .eq('channel_account_id', a.channelAccountId)
    .eq('workspace_id', a.workspaceId)
    .eq('external_id', a.externalId).maybeSingle()
  if (existing?.id) return existing.id
  const { data, error } = await supabase
    .from('channel_participants')
    .insert({ channel_account_id: a.channelAccountId, workspace_id: a.workspaceId, external_id: a.externalId, display_name: a.displayName })
    .select('id').maybeSingle()
  if (error) {
    const { data: again } = await supabase
      .from('channel_participants').select('id')
      .eq('channel_account_id', a.channelAccountId).eq('workspace_id', a.workspaceId).eq('external_id', a.externalId).maybeSingle()
    return again?.id ?? null
  }
  return data?.id ?? null
}

async function ensureConversation(
  supabase: SupabaseClient,
  a: { channelAccountId: string; participantId: string; workspaceId: string; tenantId: string | null; contactGuestId: string | null },
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('conversations').select('id')
    .eq('channel_account_id', a.channelAccountId)
    .eq('participant_id', a.participantId).maybeSingle()
  if (existing?.id) return existing.id
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      channel_account_id: a.channelAccountId,
      participant_id: a.participantId,
      workspace_id: a.workspaceId,
      tenant_id: a.tenantId,
      contact_guest_id: a.contactGuestId,
    })
    .select('id').maybeSingle()
  if (error) {
    const { data: again } = await supabase
      .from('conversations').select('id')
      .eq('channel_account_id', a.channelAccountId).eq('participant_id', a.participantId).maybeSingle()
    return again?.id ?? null
  }
  return data?.id ?? null
}

async function insertCanonicalMessage(
  supabase: SupabaseClient,
  m: {
    workspaceId: string; conversationId: string; channelAccountId: string
    direction: 'inbound' | 'outbound'; authorType: 'contact' | 'ai' | 'human'
    contentText: string; status: string | null
    providerMessageId: string; providerTimestamp: string; receivedAt: string
  },
): Promise<void> {
  await supabase.from('messages').upsert(
    {
      workspace_id: m.workspaceId,
      conversation_id: m.conversationId,
      channel_account_id: m.channelAccountId,
      direction: m.direction,
      author_type: m.authorType,
      content_text: m.contentText,
      status: m.status,
      provider_message_id: m.providerMessageId,
      provider_timestamp: m.providerTimestamp,
      received_at: m.receivedAt,
    },
    { onConflict: 'channel_account_id,provider_message_id', ignoreDuplicates: true },
  )
  const patch: Record<string, string> = { last_message_at: m.providerTimestamp }
  if (m.direction === 'inbound') patch.last_inbound_at = m.providerTimestamp
  await supabase.from('conversations').update(patch).eq('id', m.conversationId)
}

export async function mirrorInbound(
  supabase: SupabaseClient,
  p: { guest: { id: string; name: string | null; event_id: string }; phone: string; text: string; sid: string | null; createdAt: string },
): Promise<void> {
  try {
    const workspaceId = await eventOwner(supabase, p.guest.event_id)
    if (!workspaceId) return
    const accountId = await ensureChannelAccount(supabase)
    if (!accountId) return
    const participantId = await ensureParticipant(supabase, { channelAccountId: accountId, workspaceId, externalId: p.phone, displayName: p.guest.name })
    if (!participantId) return
    const conversationId = await ensureConversation(supabase, { channelAccountId: accountId, participantId, workspaceId, tenantId: p.guest.event_id, contactGuestId: p.guest.id })
    if (!conversationId) return
    await insertCanonicalMessage(supabase, {
      workspaceId, conversationId, channelAccountId: accountId,
      direction: 'inbound', authorType: 'contact',
      contentText: p.text, status: null,
      providerMessageId: p.sid ?? `wa:in:${p.phone}:${p.createdAt}`,
      providerTimestamp: p.createdAt, receivedAt: p.createdAt,
    })
  } catch (e) {
    console.error('[mirror] inbound fallo:', e instanceof Error ? e.message : e)
  }
}

export async function mirrorOutbound(
  supabase: SupabaseClient,
  p: { to: string; guestId: string; eventId: string; text: string; author: 'ia' | 'human'; status: string; sid: string | null; createdAt: string },
): Promise<void> {
  try {
    const phone = p.to.replace(/^whatsapp:/i, '')
    const workspaceId = await eventOwner(supabase, p.eventId)
    if (!workspaceId) return
    const accountId = await ensureChannelAccount(supabase)
    if (!accountId) return
    const participantId = await ensureParticipant(supabase, { channelAccountId: accountId, workspaceId, externalId: phone, displayName: null })
    if (!participantId) return
    const conversationId = await ensureConversation(supabase, { channelAccountId: accountId, participantId, workspaceId, tenantId: p.eventId, contactGuestId: p.guestId })
    if (!conversationId) return
    await insertCanonicalMessage(supabase, {
      workspaceId, conversationId, channelAccountId: accountId,
      direction: 'outbound', authorType: p.author === 'human' ? 'human' : 'ai',
      contentText: p.text, status: p.status,
      providerMessageId: p.sid ?? `wa:out:${phone}:${p.createdAt}`,
      providerTimestamp: p.createdAt, receivedAt: p.createdAt,
    })
  } catch (e) {
    console.error('[mirror] outbound fallo:', e instanceof Error ? e.message : e)
  }
}
```

- [ ] **Step 2: Verificar typecheck/lint del modulo**

Run: `npm run lint`
Expected: sin errores en `lib/whatsapp/canonical-mirror.ts`.

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add lib/whatsapp/canonical-mirror.ts
git commit -m "feat(omnicanal): modulo de espejo canonico para WhatsApp (no se engancha aun)"
```

---

### Task 3: Enganchar el espejo (outbound en reliability, inbound + draft en webhook)

**Files:**
- Modify: `lib/whatsapp/reliability.ts` (espejo del saliente dentro de `enqueueOutbound`)
- Modify: `app/api/webhook/whatsapp/route.ts` (espejo de los 2 entrantes y del draft)

**Interfaces:**
- Consumes: `mirrorInbound`, `mirrorOutbound` de Task 2.
- Produces: a partir de aqui, cada `wa_messages` nuevo tiene su gemelo canonico.

- [ ] **Step 1: Reemplazar `lib/whatsapp/reliability.ts` completo**

El unico cambio es importar `mirrorOutbound` y llamarlo dentro de `enqueueOutbound` despues del insert a `wa_messages`. Archivo completo:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEBOUNCE_MS, OPT_OUT_KEYWORDS } from './config'
import { mirrorOutbound } from './canonical-mirror'

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
function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function detectOptOut(text: string): boolean {
  const t = normalize(text)
  return OPT_OUT_KEYWORDS.some(k => {
    const nk = normalize(k)
    return t === nk || t.startsWith(nk + ' ') || t === nk + '.'
  })
}

export async function applyOptOut(supabase: SupabaseClient, guestId: string): Promise<void> {
  await supabase
    .from('guests')
    .update({ wa_opt_out: true, wa_opt_out_at: new Date().toISOString() })
    .eq('id', guestId)
}

// ── Debounce "esperar-y-verificar" ──────────────────────────────────────────
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

export async function enqueueOutbound(supabase: SupabaseClient, p: OutboundPayload): Promise<{ ok: boolean; status: string }> {
  const { data: guest } = await supabase
    .from('guests')
    .select('wa_opt_out')
    .eq('id', p.guestId)
    .maybeSingle()
  if (guest?.wa_opt_out) {
    console.log('[WA] envio bloqueado: invitado con opt-out', p.guestId)
    return { ok: false, status: 'blocked_opt_out' }
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

  const nowIso = new Date().toISOString()
  await supabase.from('wa_messages').insert({
    guest_id: p.guestId,
    event_id: p.eventId,
    direction: 'sent',
    content: p.body,
    author: p.author,
    status,
    twilio_sid: sid,
    created_at: nowIso,
  })

  await mirrorOutbound(supabase, {
    to: p.to, guestId: p.guestId, eventId: p.eventId, text: p.body,
    author: p.author, status, sid, createdAt: nowIso,
  })

  return { ok: status === 'sent', status }
}
```

- [ ] **Step 2: Reemplazar `app/api/webhook/whatsapp/route.ts` completo**

Cambios: importar `mirrorInbound`/`mirrorOutbound`; capturar un `optIso` en la rama opt-out; espejar los 2 entrantes y el draft. Archivo completo:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateRequest } from 'twilio'
import { getAgentConfig } from '@/lib/whatsapp/config'
import { isDuplicate, detectOptOut, applyOptOut, claimInboundForReply, enqueueOutbound } from '@/lib/whatsapp/reliability'
import { mirrorInbound, mirrorOutbound } from '@/lib/whatsapp/canonical-mirror'
import { runAgentPipeline } from '@/lib/whatsapp/agent'
import { distillGuestMemory, type MessageHistory } from '@/lib/ai-rsvp'

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

    // Opt-out entrante
    if (detectOptOut(text)) {
      const optIso = new Date().toISOString()
      await applyOptOut(supabase, guest.id)
      await supabase.from('wa_messages').insert({
        guest_id: guest.id, event_id: guest.event_id, direction: 'received',
        content: text, twilio_sid: sid, created_at: optIso,
      })
      await mirrorInbound(supabase, { guest, phone, text, sid, createdAt: optIso })
      return twiml()
    }

    // Guardar entrante
    const nowIso = new Date().toISOString()
    await supabase.from('wa_messages').insert({
      guest_id: guest.id, event_id: guest.event_id, direction: 'received',
      content: text, twilio_sid: sid, created_at: nowIso,
    })
    await mirrorInbound(supabase, { guest, phone, text, sid, createdAt: nowIso })

    const config = await getAgentConfig(supabase, guest.event_id)

    // Agente apagado: no responde
    if (!config.enabled) return twiml()

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
      const draftIso = new Date().toISOString()
      await supabase.from('wa_messages').insert({
        guest_id: guest.id, event_id: guest.event_id, direction: 'sent',
        content: outcome.text, author: 'ia', status: 'draft', created_at: draftIso,
      })
      await mirrorOutbound(supabase, {
        to: from, guestId: guest.id, eventId: guest.event_id, text: outcome.text,
        author: 'ia', status: 'draft', sid: null, createdAt: draftIso,
      })
      await supabase.from('guests').update({ wa_needs_human: true, wa_needs_human_reason: 'copiloto' }).eq('id', guest.id)
    } else if (outcome.action === 'handoff') {
      await enqueueOutbound(supabase, { to: from, body: outcome.message, guestId: guest.id, eventId: guest.event_id, author: 'ia' })
      if (outcome.escalate) {
        await supabase.from('guests').update({ wa_needs_human: true, wa_needs_human_reason: outcome.reason }).eq('id', guest.id)
      }
    }

    // Memoria episodica: destila notas blandas tras un intercambio real (reply/draft).
    if (outcome.action === 'reply' || outcome.action === 'draft') {
      try {
        const { data: g } = await supabase
          .from('guests').select('agent_memory').eq('id', guest.id).maybeSingle()
        const turn: MessageHistory[] = [...history, { direction: 'sent', content: outcome.text }]
        const memory = await distillGuestMemory(g?.agent_memory ?? null, turn, guest.name)
        if (memory) await supabase.from('guests').update({ agent_memory: memory }).eq('id', guest.id)
      } catch (e) {
        console.error('[WA] destilacion de memoria fallo:', e instanceof Error ? e.message : e)
      }
    }

    return twiml()
  } catch (err: any) {
    console.error('[Webhook Error]', err?.message ?? err)
    return twiml()
  }
}
```

- [ ] **Step 3: Verificar lint y build**

Run: `npm run lint && npm run build`
Expected: sin errores; build exitoso.

- [ ] **Step 4: Prueba en vivo (Diego, con un numero de prueba real)**

Enviar un WhatsApp al numero de Anfiora desde un telefono que YA es invitado de un evento de prueba. Luego verificar en Supabase:

```sql
select c.id as conversation_id, c.workspace_id, c.tenant_id, c.contact_guest_id,
       c.last_inbound_at, m.direction, m.author_type, m.content_text, m.provider_message_id
from conversations c
join messages m on m.conversation_id = c.id
order by m.provider_timestamp desc
limit 10;
```

Expected: el entrante aparece como `direction='inbound'`, `author_type='contact'`, con `tenant_id` y `contact_guest_id` poblados, y `workspace_id` = dueno del evento. Si el agente estaba encendido y respondio, hay tambien una fila `outbound`/`ai`.

- [ ] **Step 5: Verificar que `wa_messages` sigue intacto**

```sql
select direction, author, status, twilio_sid
from wa_messages
order by created_at desc
limit 5;
```

Expected: las filas de WhatsApp se siguen escribiendo igual que antes (el espejo no las altero).

- [ ] **Step 6: Commit**

```bash
git add lib/whatsapp/reliability.ts app/api/webhook/whatsapp/route.ts
git commit -m "feat(omnicanal): dual-write de WhatsApp al modelo canonico (entrante, saliente, draft)"
```

---

### Task 4: Backfill idempotente del historial `wa_messages -> canonico`

**Files:**
- Create: `app/api/admin/backfill-canonical/route.ts`

**Interfaces:**
- Consumes: tablas de Task 1; helpers de Task 2 (reusa la misma logica de espejo via `mirrorInbound`/`mirrorOutbound`).
- Produces: endpoint POST que recorre `wa_messages` en orden cronologico y los espeja. Re-ejecutable sin duplicar (dedupe por `provider_message_id = twilio_sid ?? 'wa:'+id`).

- [ ] **Step 1: Crear el endpoint de backfill**

Crear `app/api/admin/backfill-canonical/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mirrorInbound, mirrorOutbound } from '@/lib/whatsapp/canonical-mirror'

// Backfill idempotente de wa_messages al modelo canonico. Recorre en orden
// cronologico para que conversations.last_message_at quede correcto. Re-ejecutable.
// Proteccion simple por secreto en header (solo uso manual de Diego).

const PAGE = 500

export async function POST(request: NextRequest) {
  if (request.headers.get('x-backfill-secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 403 })
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  let from = 0
  let processed = 0
  for (;;) {
    const { data: rows, error } = await supabase
      .from('wa_messages')
      .select('id, guest_id, event_id, body, content, direction, status, author, twilio_sid, created_at, sent_at')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message, processed }, { status: 500 })
    if (!rows || rows.length === 0) break

    for (const r of rows) {
      const { data: guest } = await supabase
        .from('guests').select('id, name, event_id, phone').eq('id', r.guest_id).maybeSingle()
      if (!guest || !guest.phone) continue

      const eventId = r.event_id ?? guest.event_id
      const ts = r.created_at ?? r.sent_at ?? new Date(0).toISOString()
      const textContent = (r.content ?? r.body ?? '').toString()
      const syntheticSid = r.twilio_sid ?? `wa:${r.id}`

      if (r.direction === 'received') {
        await mirrorInbound(supabase, {
          guest: { id: guest.id, name: guest.name, event_id: eventId },
          phone: guest.phone, text: textContent, sid: syntheticSid, createdAt: ts,
        })
      } else {
        const author = r.author === 'human' ? 'human' : 'ia'
        await mirrorOutbound(supabase, {
          to: `whatsapp:${guest.phone}`, guestId: guest.id, eventId, text: textContent,
          author, status: r.status ?? 'sent', sid: syntheticSid, createdAt: ts,
        })
      }
      processed++
    }

    from += PAGE
    if (rows.length < PAGE) break
  }

  return NextResponse.json({ ok: true, processed })
}
```

- [ ] **Step 2: Verificar lint y build**

Run: `npm run lint && npm run build`
Expected: sin errores; build exitoso.

- [ ] **Step 3: Contar el historial antes del backfill**

```sql
select count(*) as wa_total from wa_messages;
select count(*) as canon_total from messages;
```

Anotar ambos numeros.

- [ ] **Step 4: Ejecutar el backfill (Diego)**

Con el dev server o el deploy, llamar al endpoint pasando el secreto (es el service role key):

```bash
curl -X POST "http://localhost:3000/api/admin/backfill-canonical" \
  -H "x-backfill-secret: $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `{ "ok": true, "processed": <N> }`.

- [ ] **Step 5: Verificar que el canonico se poblo**

```sql
select count(*) as canon_total from messages;
select count(distinct id) as convs from conversations;
```

Expected: `canon_total` subio (cercano a `wa_total`, menos opt-outs/duplicados); hay conversaciones creadas.

- [ ] **Step 6: Verificar idempotencia — correr el backfill OTRA VEZ**

Repetir el `curl` del Step 4, luego:

```sql
select count(*) as canon_total from messages;
```

Expected: el conteo **no cambia** respecto al Step 5 (cero duplicados).

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/backfill-canonical/route.ts
git commit -m "feat(omnicanal): endpoint de backfill idempotente wa_messages a canonico"
```

---

## Self-Review

**Spec coverage (fase 1 de la spec):**
- Tablas canonicas v1 -> Task 1.
- Frontera nucleo/dominio (core.sql + anfiora.sql, FK, CHECK, RLS) -> Task 1.
- Aislamiento por workspace en numero compartido (`UNIQUE(channel_account_id, workspace_id, external_id)`) -> Task 1 Step 5.
- WhatsApp como primer adaptador con dual-write (entrante, saliente, draft) -> Tasks 2-3.
- Mapeo `wa_messages -> canonico` -> Task 2 (helpers) + Task 4 (backfill).
- Idempotencia (`provider_message_id` dedupe) -> Task 2 (`insertCanonicalMessage` upsert) + Task 4 (re-run).
- No romper produccion (fallo silencioso, wa_messages intacto) -> Task 2 (try/catch) + Task 3 Step 5.

**Fuera de alcance (planes posteriores, por diseno):** migracion/cifrado de credenciales `users.wa_*` -> `channel_accounts`; switch del agente a leer `ai_enabled`/contexto canonico; espejo del handoff `wa_needs_human`<->`ai_enabled`; `webhook_events` + `after()` + cron sweeper; adaptador Telegram; adaptadores Meta IG/FB; UI del inbox unificado.

**Placeholder scan:** sin TBD/TODO; todo el codigo es completo.

**Type consistency:** `mirrorInbound`/`mirrorOutbound` se llaman con las mismas firmas en webhook (Task 3), reliability (Task 3) y backfill (Task 4). `provider_message_id` no-nulo garantizado en los tres caminos.

**Riesgo conocido:** el debounce actual (`claimInboundForReply`) hace `setTimeout(17s)` dentro del request; el espejo del entrante ocurre ANTES del debounce, asi que el canonico registra el entrante aunque el agente decida no responder. Es el comportamiento deseado (el inbox debe ver todos los entrantes).
