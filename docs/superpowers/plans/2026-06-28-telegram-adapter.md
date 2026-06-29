# Telegram Adapter (v2 del nucleo omnicanal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar Telegram como adaptador IN/OUT que escribe al mismo modelo canonico que WhatsApp, reutilizando el cerebro IA, sin tocar el flujo de WhatsApp, validando la arquitectura de adaptadores de punta a punta.

**Architecture:** Se extrae el Normalizador/Store generico (pieza #2 del plano), agnostico de canal. Telegram se monta encima con un adaptador (traduce update <-> contrato canonico) y un ruteador de dominio (deep-link `/start <guest_id>` + continuidad por `chat_id`). El webhook valida el secreto de Telegram, aterriza el update crudo en `webhook_events` (dedupe por `update_id`), responde 200 y procesa con `after()`. WhatsApp se queda intacto en su mirror verificado.

**Tech Stack:** Next.js 16 (App Router, `after()` de `next/server`) + Supabase (service role) + Telegram Bot API + Claude Haiku (cerebro existente en `lib/ai-rsvp.ts`).

**Spec:** `docs/superpowers/specs/2026-06-28-telegram-adapter-design.md`

## Global Constraints

- Codigo completo, nunca fragmentos. Full file replacement, no edits parciales.
- Sin tests automatizados (no hay suite; regla MVP). Verificacion = `npm run build` + prueba manual en prod.
- UI/copy en espanol CON acentos, sin emojis. Commits SIN acentos ni n. Terminar commits con la linea `Co-Authored-By` del harness.
- NUNCA `git push` ni tocar Supabase sin OK de Diego. NO crear tablas nuevas (reusa las 5 canonicas). NO tocar `lib/types.ts`.
- NO tocar `app/api/webhook/whatsapp/route.ts` ni `lib/whatsapp/canonical-mirror.ts` (WhatsApp queda intacto).
- Dedupe SIEMPRE por identidad de la fila, nunca sintetizado de datos de negocio:
  - mensaje canonico: `provider_message_id = <chat_id>:<message_id>` (identidad unica de un mensaje de Telegram en el bot compartido; `message_id` solo es unico POR chat).
  - evento crudo: `provider_event_id = <update_id>` (unico y monotonico por bot).
- El procesamiento corre con `after()`: nunca en el hot-path sincrono del webhook.
- Todo el lado-escritura canonico es FALLO SILENCIOSO (nunca lanza, nunca rompe el webhook).
- Deploy: el webhook se registra contra `https://www.anfiora.com` (el apex hace 307 a www en POST).

---

## File Structure

| Archivo | Accion | Responsabilidad |
|---|---|---|
| `lib/omnichannel/types.ts` | Create | Contrato canonico: `InboundMessage` / `OutboundMessage`. |
| `lib/omnichannel/store.ts` | Create | Normalizador generico agnostico de canal: `ensureChannelAccount`, `ensureBinding`, `ingestInbound`, `ingestOutbound`. Fallo silencioso, dedupe por `provider_message_id`. |
| `lib/telegram/adapter.ts` | Create | Traduce update de Telegram <-> contrato canonico; envia via `sendMessage`. |
| `lib/telegram/routing.ts` | Create | Ruteo de dominio: `/start <guest_id>` (`resolveStart`) y continuidad por `chat_id` (`resolveByChat`). |
| `app/api/webhook/telegram/route.ts` | Create | Webhook: valida secreto, aterriza crudo, 200, procesa con `after()`, cerebro, responde. |

Sin cambios en `lib/types.ts`, sin tablas nuevas, sin tocar WhatsApp.

---

## Task 1: Contrato canonico + Normalizador generico

**Files:**
- Create: `lib/omnichannel/types.ts`
- Create: `lib/omnichannel/store.ts`

**Interfaces:**
- Produces:
  - `type InboundMessage` y `type OutboundMessage` (ver codigo).
  - `ensureChannelAccount(supabase, { channel, externalAccountId, displayLabel }): Promise<string | null>`
  - `ensureBinding(supabase, { channel, externalAccountId, participantExternalId, displayName, workspaceId, tenantId, contactGuestId }): Promise<string | null>` (devuelve conversationId)
  - `ingestInbound(supabase, m: InboundMessage): Promise<string | null>` (devuelve conversationId)
  - `ingestOutbound(supabase, m: OutboundMessage): Promise<void>`

- [ ] **Step 1: Crear `lib/omnichannel/types.ts`**

```ts
export type InboundMessage = {
  channel: string
  externalAccountId: string
  participantExternalId: string
  displayName: string | null
  providerMessageId: string
  providerTimestamp: string
  contentText: string
  payload?: Record<string, unknown>
  workspaceId: string
  tenantId: string | null
  contactGuestId: string | null
}

export type OutboundMessage = {
  channel: string
  externalAccountId: string
  participantExternalId: string
  contentText: string
  authorType: 'ai' | 'human'
  providerMessageId: string
  providerTimestamp: string
  status: string
  workspaceId: string
  tenantId: string | null
  contactGuestId: string | null
}
```

- [ ] **Step 2: Crear `lib/omnichannel/store.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InboundMessage, OutboundMessage } from './types'

// Normalizador/Store generico del nucleo omnicanal. Agnostico de canal: solo
// conoce el contrato canonico, ni una palabra de WhatsApp/Telegram. Fallo
// SILENCIOSO: nunca lanza, nunca rompe el webhook (mismo contrato que el mirror
// de WhatsApp y el audit log). Dedupe por (channel_account_id, provider_message_id).

export async function ensureChannelAccount(
  supabase: SupabaseClient,
  a: { channel: string; externalAccountId: string; displayLabel: string },
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('channel_accounts').select('id')
    .eq('channel', a.channel).eq('external_account_id', a.externalAccountId).maybeSingle()
  if (existing?.id) return existing.id
  const { data, error } = await supabase
    .from('channel_accounts')
    .insert({ channel: a.channel, external_account_id: a.externalAccountId, display_label: a.displayLabel })
    .select('id').maybeSingle()
  if (error) {
    const { data: again } = await supabase
      .from('channel_accounts').select('id')
      .eq('channel', a.channel).eq('external_account_id', a.externalAccountId).maybeSingle()
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

export async function ensureBinding(
  supabase: SupabaseClient,
  b: {
    channel: string; externalAccountId: string
    participantExternalId: string; displayName: string | null
    workspaceId: string; tenantId: string | null; contactGuestId: string | null
  },
): Promise<string | null> {
  try {
    const accountId = await ensureChannelAccount(supabase, {
      channel: b.channel, externalAccountId: b.externalAccountId,
      displayLabel: `${b.channel} (compartido)`,
    })
    if (!accountId) return null
    const participantId = await ensureParticipant(supabase, {
      channelAccountId: accountId, workspaceId: b.workspaceId,
      externalId: b.participantExternalId, displayName: b.displayName,
    })
    if (!participantId) return null
    return ensureConversation(supabase, {
      channelAccountId: accountId, participantId, workspaceId: b.workspaceId,
      tenantId: b.tenantId, contactGuestId: b.contactGuestId,
    })
  } catch (e) {
    console.error('[store] ensureBinding fallo:', e instanceof Error ? e.message : e)
    return null
  }
}

async function insertCanonicalMessage(
  supabase: SupabaseClient,
  m: {
    workspaceId: string; conversationId: string; channelAccountId: string
    direction: 'inbound' | 'outbound'; authorType: 'contact' | 'ai' | 'human'
    contentText: string; status: string | null; payload: Record<string, unknown>
    providerMessageId: string; providerTimestamp: string
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
      payload: m.payload,
      provider_message_id: m.providerMessageId,
      provider_timestamp: m.providerTimestamp,
      received_at: m.providerTimestamp,
    },
    { onConflict: 'channel_account_id,provider_message_id', ignoreDuplicates: true },
  )
  const patch: Record<string, string> = { last_message_at: m.providerTimestamp }
  if (m.direction === 'inbound') patch.last_inbound_at = m.providerTimestamp
  await supabase.from('conversations').update(patch).eq('id', m.conversationId)
}

async function accountIdFor(
  supabase: SupabaseClient,
  m: { channel: string; externalAccountId: string },
): Promise<string | null> {
  return ensureChannelAccount(supabase, {
    channel: m.channel, externalAccountId: m.externalAccountId,
    displayLabel: `${m.channel} (compartido)`,
  })
}

export async function ingestInbound(supabase: SupabaseClient, m: InboundMessage): Promise<string | null> {
  try {
    if (!m.providerMessageId) return null
    const conversationId = await ensureBinding(supabase, {
      channel: m.channel, externalAccountId: m.externalAccountId,
      participantExternalId: m.participantExternalId, displayName: m.displayName,
      workspaceId: m.workspaceId, tenantId: m.tenantId, contactGuestId: m.contactGuestId,
    })
    if (!conversationId) return null
    const accountId = await accountIdFor(supabase, m)
    if (!accountId) return null
    await insertCanonicalMessage(supabase, {
      workspaceId: m.workspaceId, conversationId, channelAccountId: accountId,
      direction: 'inbound', authorType: 'contact',
      contentText: m.contentText, status: null, payload: m.payload ?? {},
      providerMessageId: m.providerMessageId, providerTimestamp: m.providerTimestamp,
    })
    return conversationId
  } catch (e) {
    console.error('[store] ingestInbound fallo:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function ingestOutbound(supabase: SupabaseClient, m: OutboundMessage): Promise<void> {
  try {
    if (!m.providerMessageId) return
    const conversationId = await ensureBinding(supabase, {
      channel: m.channel, externalAccountId: m.externalAccountId,
      participantExternalId: m.participantExternalId, displayName: null,
      workspaceId: m.workspaceId, tenantId: m.tenantId, contactGuestId: m.contactGuestId,
    })
    if (!conversationId) return
    const accountId = await accountIdFor(supabase, m)
    if (!accountId) return
    await insertCanonicalMessage(supabase, {
      workspaceId: m.workspaceId, conversationId, channelAccountId: accountId,
      direction: 'outbound', authorType: m.authorType,
      contentText: m.contentText, status: m.status, payload: {},
      providerMessageId: m.providerMessageId, providerTimestamp: m.providerTimestamp,
    })
  } catch (e) {
    console.error('[store] ingestOutbound fallo:', e instanceof Error ? e.message : e)
  }
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK, sin errores de tipo. (El store solo importa `SupabaseClient`, ya instalado.)

- [ ] **Step 4: Commit**

```bash
git add lib/omnichannel/types.ts lib/omnichannel/store.ts
git commit -m "feat(omnicanal): normalizador generico agnostico de canal (store + contrato)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Adaptador de Telegram

**Files:**
- Create: `lib/telegram/adapter.ts`

**Interfaces:**
- Consumes: `ensureChannelAccount` (Task 1).
- Produces:
  - `type TelegramUpdate` (ver codigo).
  - `telegramExternalAccountId(): string` (id del bot = parte antes de `:` del token).
  - `ensureTelegramAccount(supabase): Promise<string | null>`
  - `parseTelegramUpdate(body: unknown): TelegramUpdate | null`
  - `sendTelegramMessage(chatId: string, text: string): Promise<{ ok: boolean; messageId: string | null; date: string }>`

- [ ] **Step 1: Crear `lib/telegram/adapter.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureChannelAccount } from '@/lib/omnichannel/store'

export const TG_CHANNEL = 'telegram'

export function telegramExternalAccountId(): string {
  return (process.env.TELEGRAM_BOT_TOKEN ?? '').split(':')[0] ?? ''
}

export async function ensureTelegramAccount(supabase: SupabaseClient): Promise<string | null> {
  const externalId = telegramExternalAccountId()
  if (!externalId) return null
  return ensureChannelAccount(supabase, {
    channel: TG_CHANNEL,
    externalAccountId: externalId,
    displayLabel: 'Anfiora Telegram (compartido)',
  })
}

export type TelegramUpdate = {
  updateId: number
  chatId: string
  providerMessageId: string   // `${chatId}:${message_id}` (identidad unica en el bot)
  date: string                // ISO 8601
  text: string
  displayName: string | null
  isStart: boolean
  startPayload: string | null
}

export function parseTelegramUpdate(body: unknown): TelegramUpdate | null {
  const update = body as Record<string, any> | null
  if (!update || typeof update.update_id !== 'number') return null
  const msg = update.message ?? update.edited_message
  if (!msg || !msg.chat || typeof msg.message_id === 'undefined') return null

  const text: string = (msg.text ?? '').trim()
  const chatId = String(msg.chat.id)
  const from = msg.from ?? {}
  const displayName =
    [from.first_name, from.username ? `@${from.username}` : null].filter(Boolean).join(' ') || null

  const startMatch = text.match(/^\/start(?:\s+(.+))?$/)
  const isStart = !!startMatch
  const startPayload = startMatch?.[1]?.trim() ?? null

  const dateSec = typeof msg.date === 'number' ? msg.date : 0
  const date = dateSec > 0 ? new Date(dateSec * 1000).toISOString() : new Date().toISOString()

  return {
    updateId: update.update_id,
    chatId,
    providerMessageId: `${chatId}:${String(msg.message_id)}`,
    date,
    text,
    displayName,
    isStart,
    startPayload,
  }
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<{ ok: boolean; messageId: string | null; date: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? ''
  const sentAt = new Date().toISOString()
  if (!token) return { ok: false, messageId: null, date: sentAt }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      console.error('[Telegram] sendMessage fallo:', JSON.stringify(json))
      return { ok: false, messageId: null, date: sentAt }
    }
    const result = json.result
    const date = typeof result?.date === 'number' ? new Date(result.date * 1000).toISOString() : sentAt
    return { ok: true, messageId: result?.message_id != null ? String(result.message_id) : null, date }
  } catch (e) {
    console.error('[Telegram] sendMessage error:', e instanceof Error ? e.message : e)
    return { ok: false, messageId: null, date: sentAt }
  }
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK, sin errores de tipo.

- [ ] **Step 3: Commit**

```bash
git add lib/telegram/adapter.ts
git commit -m "feat(telegram): adaptador IN/OUT (parse update + sendMessage + ensure account)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Ruteo de dominio (sin telefono)

**Files:**
- Create: `lib/telegram/routing.ts`

**Interfaces:**
- Produces:
  - `type TelegramRoute = { workspaceId: string; eventId: string; guestId: string; guestName: string; eventName: string }`
  - `resolveStart(supabase, guestId: string): Promise<TelegramRoute | null>`
  - `resolveByChat(supabase, { channelAccountId, chatId }): Promise<TelegramRoute | null>`

- [ ] **Step 1: Crear `lib/telegram/routing.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

// Ruteo de DOMINIO de Telegram. Resuelve a que evento/invitado/workspace
// pertenece un mensaje. Es la pieza de dominio (no nucleo): traduce la
// identidad de Telegram (deep-link o chat existente) al contexto de Anfiora.

export type TelegramRoute = {
  workspaceId: string
  eventId: string
  guestId: string
  guestName: string
  eventName: string
}

// Primer contacto: el deep-link `/start <guest_id>` trae la identidad.
export async function resolveStart(
  supabase: SupabaseClient,
  guestId: string,
): Promise<TelegramRoute | null> {
  const { data: guest } = await supabase
    .from('guests').select('id, name, event_id').eq('id', guestId).maybeSingle()
  if (!guest) return null
  const { data: event } = await supabase
    .from('events').select('user_id, name').eq('id', guest.event_id).maybeSingle()
  if (!event?.user_id) return null
  return {
    workspaceId: event.user_id,
    eventId: guest.event_id,
    guestId: guest.id,
    guestName: guest.name?.trim() || 'Invitado',
    eventName: event.name ?? 'tu evento',
  }
}

// Mensajes siguientes: ya hay una conversacion atada a ese chat_id.
export async function resolveByChat(
  supabase: SupabaseClient,
  a: { channelAccountId: string; chatId: string },
): Promise<TelegramRoute | null> {
  const { data: participant } = await supabase
    .from('channel_participants').select('id')
    .eq('channel_account_id', a.channelAccountId)
    .eq('external_id', a.chatId)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  if (!participant?.id) return null

  const { data: conversation } = await supabase
    .from('conversations').select('tenant_id, contact_guest_id, workspace_id')
    .eq('channel_account_id', a.channelAccountId)
    .eq('participant_id', participant.id)
    .maybeSingle()
  if (!conversation?.contact_guest_id || !conversation.tenant_id) return null

  const { data: guest } = await supabase
    .from('guests').select('name').eq('id', conversation.contact_guest_id).maybeSingle()
  const { data: event } = await supabase
    .from('events').select('name').eq('id', conversation.tenant_id).maybeSingle()

  return {
    workspaceId: conversation.workspace_id,
    eventId: conversation.tenant_id,
    guestId: conversation.contact_guest_id,
    guestName: guest?.name?.trim() || 'Invitado',
    eventName: event?.name ?? 'tu evento',
  }
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK, sin errores de tipo.

- [ ] **Step 3: Commit**

```bash
git add lib/telegram/routing.ts
git commit -m "feat(telegram): ruteo de dominio por deep-link start y por chat existente

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Webhook de Telegram (cablea todo)

**Files:**
- Create: `app/api/webhook/telegram/route.ts`

**Interfaces:**
- Consumes: `ingestInbound`, `ingestOutbound`, `ensureBinding` (Task 1); `parseTelegramUpdate`, `ensureTelegramAccount`, `telegramExternalAccountId`, `sendTelegramMessage`, `TG_CHANNEL` (Task 2); `resolveStart`, `resolveByChat` (Task 3); `interpretRSVPMessage`, `generateAgentReply`, `EventContext`, `MessageHistory` (de `@/lib/ai-rsvp`); `after` de `next/server`.
- Produces: `POST /api/webhook/telegram` (loop completo de Telegram).

**Contexto:** el handler valida el header `x-telegram-bot-api-secret-token`, aterriza el update crudo en `webhook_events` con dedupe por `update_id` (si es reintento, sale), responde 200 y procesa con `after()`. El procesamiento distingue `/start` (crea el binding + saludo) de texto normal (guarda inbound canonico + cerebro IA + respuesta + outbound canonico). El cerebro y el formato de historial son identicos al webhook de WhatsApp.

- [ ] **Step 1: Crear `app/api/webhook/telegram/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { interpretRSVPMessage, generateAgentReply, type EventContext, type MessageHistory } from '@/lib/ai-rsvp'
import { ingestInbound, ingestOutbound, ensureBinding } from '@/lib/omnichannel/store'
import {
  TG_CHANNEL,
  parseTelegramUpdate,
  ensureTelegramAccount,
  telegramExternalAccountId,
  sendTelegramMessage,
  type TelegramUpdate,
} from '@/lib/telegram/adapter'
import { resolveStart, resolveByChat, type TelegramRoute } from '@/lib/telegram/routing'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token') ?? ''
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse('Unauthorized', { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const update = parseTelegramUpdate(body)
  if (!update) return NextResponse.json({ ok: true })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: rawRow } = await supabase
    .from('webhook_events')
    .upsert(
      { provider: TG_CHANNEL, provider_event_id: String(update.updateId), payload: body },
      { onConflict: 'provider,provider_event_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle()

  if (!rawRow?.id) return NextResponse.json({ ok: true })

  after(() => processTelegramUpdate(supabase, update, rawRow.id))
  return NextResponse.json({ ok: true })
}

async function markProcessed(supabase: SupabaseClient, id: string, error?: string): Promise<void> {
  await supabase
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString(), process_error: error ?? null })
    .eq('id', id)
}

async function processTelegramUpdate(
  supabase: SupabaseClient,
  update: TelegramUpdate,
  webhookEventId: string,
): Promise<void> {
  try {
    if (!update.text) return await markProcessed(supabase, webhookEventId, 'sin texto')

    const accountId = await ensureTelegramAccount(supabase)
    if (!accountId) return await markProcessed(supabase, webhookEventId, 'sin channel account')

    const route: TelegramRoute | null =
      update.isStart && update.startPayload
        ? await resolveStart(supabase, update.startPayload)
        : await resolveByChat(supabase, { channelAccountId: accountId, chatId: update.chatId })

    if (!route) return await markProcessed(supabase, webhookEventId, 'sin clasificar')

    const externalAccountId = telegramExternalAccountId()

    if (update.isStart) {
      await ensureBinding(supabase, {
        channel: TG_CHANNEL,
        externalAccountId,
        participantExternalId: update.chatId,
        displayName: update.displayName,
        workspaceId: route.workspaceId,
        tenantId: route.eventId,
        contactGuestId: route.guestId,
      })
      const welcome = `Hola ${route.guestName}, soy el asistente de ${route.eventName} en Anfiora. Puedes confirmar tu asistencia respondiendo por aqui.`
      const sent = await sendTelegramMessage(update.chatId, welcome)
      if (sent.ok && sent.messageId) {
        await ingestOutbound(supabase, {
          channel: TG_CHANNEL,
          externalAccountId,
          participantExternalId: update.chatId,
          contentText: welcome,
          authorType: 'ai',
          providerMessageId: `${update.chatId}:${sent.messageId}`,
          providerTimestamp: sent.date,
          status: 'sent',
          workspaceId: route.workspaceId,
          tenantId: route.eventId,
          contactGuestId: route.guestId,
        })
      }
      return await markProcessed(supabase, webhookEventId)
    }

    const conversationId = await ingestInbound(supabase, {
      channel: TG_CHANNEL,
      externalAccountId,
      participantExternalId: update.chatId,
      displayName: update.displayName,
      providerMessageId: update.providerMessageId,
      providerTimestamp: update.date,
      contentText: update.text,
      workspaceId: route.workspaceId,
      tenantId: route.eventId,
      contactGuestId: route.guestId,
    })

    const { data: eventRow } = await supabase
      .from('events')
      .select('name, event_date, event_time, venue, address, event_type')
      .eq('id', route.eventId)
      .maybeSingle()

    const eventContext: EventContext = {
      name: eventRow?.name ?? route.eventName,
      date: eventRow?.event_date ?? null,
      time: eventRow?.event_time ?? null,
      venue: eventRow?.venue ?? null,
      address: eventRow?.address ?? null,
      event_type: eventRow?.event_type ?? null,
    }

    let history: MessageHistory[] = []
    if (conversationId) {
      const { data: hist } = await supabase
        .from('messages')
        .select('direction, content_text')
        .eq('conversation_id', conversationId)
        .order('provider_timestamp', { ascending: false })
        .limit(10)
      history = (hist ?? [])
        .reverse()
        .map((h) => ({
          direction: h.direction === 'inbound' ? 'received' : 'sent',
          content: h.content_text ?? '',
        })) as MessageHistory[]
    }

    const interpretation = await interpretRSVPMessage(update.text, route.guestName, eventContext.name)

    if (interpretation.intent !== 'ambiguous' && interpretation.confidence !== 'low') {
      const { data: guestRow } = await supabase
        .from('guests').select('rsvp_status').eq('id', route.guestId).maybeSingle()
      if (guestRow && guestRow.rsvp_status !== interpretation.intent) {
        await supabase.from('guests').update({ rsvp_status: interpretation.intent }).eq('id', route.guestId)
      }

      const replyText = await generateAgentReply(
        interpretation.intent,
        route.guestName,
        eventContext,
        history,
        update.text,
      )

      const sent = await sendTelegramMessage(update.chatId, replyText)
      if (sent.ok && sent.messageId) {
        await ingestOutbound(supabase, {
          channel: TG_CHANNEL,
          externalAccountId,
          participantExternalId: update.chatId,
          contentText: replyText,
          authorType: 'ai',
          providerMessageId: `${update.chatId}:${sent.messageId}`,
          providerTimestamp: sent.date,
          status: 'sent',
          workspaceId: route.workspaceId,
          tenantId: route.eventId,
          contactGuestId: route.guestId,
        })
      }
    }

    return await markProcessed(supabase, webhookEventId)
  } catch (e) {
    console.error('[Telegram Webhook] proceso fallo:', e instanceof Error ? e.message : e)
    await markProcessed(supabase, webhookEventId, e instanceof Error ? e.message : 'error')
  }
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK. La ruta `/api/webhook/telegram` aparece en el listado. Sin errores de tipo.

- [ ] **Step 3: Commit**

```bash
git add app/api/webhook/telegram/route.ts
git commit -m "feat(telegram): webhook con loop completo (crudo+dedupe, ruteo, cerebro, respuesta)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Despliegue, setup del bot y verificacion (checkpoint con Diego)

**Files:** ninguno (operativo). Lo ejecuta Diego con sus credenciales.

- [ ] **Step 1: Push + PR (con OK de Diego)**

```bash
git push -u origin feature/telegram-adapter
gh pr create --base main --head feature/telegram-adapter --title "feat(omnicanal): Telegram como segundo adaptador (v2)" --body "<resumen>"
```

- [ ] **Step 2: Diego crea el bot y configura env (DESPUES del merge)**

1. En Telegram, hablar con `@BotFather` -> `/newbot` -> obtener `TELEGRAM_BOT_TOKEN`.
2. Definir un `TELEGRAM_WEBHOOK_SECRET` (cadena aleatoria propia, ej. `openssl rand -hex 32`).
3. Agregar ambas a Vercel (Production) y a `.env.local`:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET`
4. Redeploy en Vercel para que tome las env nuevas.

- [ ] **Step 3: Registrar el webhook (una vez, lo corre Diego)**

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://www.anfiora.com/api/webhook/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`.
Verificar con: `curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"` -> `url` correcta, `pending_update_count` bajo.

- [ ] **Step 4: Probar el loop completo (Diego, celular)**

1. Tomar el `id` de un invitado real de un evento propio (de la guest list o Supabase).
2. Abrir `https://t.me/<nombre_del_bot>?start=<guest_id>` en el celular.
3. Expected: el bot responde con el saludo "Hola <nombre>, soy el asistente de <evento>...".
4. Escribir "si voy".
5. Expected: el bot responde confirmando; en Supabase `guests.rsvp_status` del invitado = `confirmed`.

- [ ] **Step 5: Verificar el modelo canonico en Supabase**

```sql
select c.id, c.tenant_id, c.contact_guest_id, c.last_message_at,
       (select count(*) from messages m where m.conversation_id = c.id) as msgs
from conversations c
join channel_accounts a on a.id = c.channel_account_id
where a.channel = 'telegram'
order by c.last_message_at desc nulls last
limit 10;
```

Expected: 1 conversacion de canal `telegram` con sus mensajes inbound/outbound, `tenant_id` + `contact_guest_id` correctos. Revisar que `messages.provider_message_id` tiene formato `<chat_id>:<message_id>`.

- [ ] **Step 6: Verificar dedupe e idempotencia**

1. En `webhook_events`, confirmar filas con `provider='telegram'` y `processed_at` no nulo.
2. Repetir el paso 4 desde la laptop (Telegram Web) con el MISMO bot:
   - Expected: usa la MISMA conversacion (no se duplica), porque el `chat_id` de tu cuenta es el mismo en celular y laptop.
3. Confirmar que WhatsApp sigue intacto: una prueba WA real espeja como antes (sin regresion).

---

## Self-Review (cobertura del spec)

- **Normalizador generico (pieza #2)** -> Task 1 (`lib/omnichannel/store.ts` + `types.ts`), agnostico de canal.
- **Adaptador IN/OUT de Telegram** -> Task 2 (parse + send + ensure account).
- **Ruteo sin telefono via deep-link `/start <guest_id>` + continuidad por chat** -> Task 3.
- **Webhook: secreto, crudo+dedupe por update_id, 200, after(), cerebro, respuesta** -> Task 4.
- **Reutilizar el cerebro IA (interpret + reply)** -> Task 4 (mismas funciones que WhatsApp).
- **Cero cambios de dominio (sin tablas, sin lib/types.ts)** -> ninguna task toca schema; binding vive en tablas canonicas.
- **No romper WhatsApp** -> ninguna task toca el webhook WA ni el mirror; caminos separados.
- **Dedupe por identidad** -> `provider_message_id=<chat_id>:<message_id>`, `provider_event_id=<update_id>`.
- **Bot compartido + aislamiento por planner** -> `ensureTelegramAccount` (cuenta global), `channel_participants` con workspace_id en la llave.
- **Setup del bot + setWebhook contra www** -> Task 5 (lo hace Diego).
- **Fuera de alcance (diferido):** cron sweeper de `webhook_events`, UI de reparto de links, Telegram proactivo, mover disparador de push al normalizador, debounce, adjuntos/media. Documentado en el spec seccion 1.
```
