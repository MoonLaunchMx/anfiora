# Inbox Omnicanal por Evento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolucionar `/events/[id]/mensajes` a una bandeja omnicanal que lee del modelo canónico, muestra al agente respondiendo Telegram/WhatsApp con atribución (invitado/IA/tú), y permite al planner responder él mismo y pausar al agente por conversación.

**Architecture:** La bandeja deja de leer `wa_messages`. Lee de un endpoint de servidor (`/api/omnichannel/inbox`, service role + verificación de acceso) que arma los datos del modelo canónico, porque las cuentas de canal compartidas tienen `workspace_id = NULL` y RLS no las deja leer desde el navegador. El armado de la bandeja se extrae a una función pura (`lib/omnichannel/inbox-view.ts`) con tests Vitest; los endpoints quedan como cascarón delgado. El envío pasa por un endpoint único (`/api/omnichannel/send`) que despacha por canal y espeja el mensaje como `human`. El handoff usa `conversations.ai_enabled`, cableado en el webhook de Telegram. Refresco por polling cada ~4s.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (service role en routes, browser client con RLS en page), Twilio (WhatsApp), Telegram Bot API, Vitest (tests de lógica pura).

## Global Constraints

- Sin tablas ni cambios de schema en Supabase. No tocar Supabase directamente.
- **Testing:** Vitest para lógica pura extraída a funciones testeables (`npm test`). UI y endpoints con I/O (Twilio/Telegram/Supabase) se verifican manual en el flujo **local (localhost:3000, NUNCA 3001) → preview (Vercel) → main**. Además, cada tarea cierra con `npx tsc --noEmit` limpio.
- Solo Tailwind. Mobile-first (cards en mobile, paneles en desktop). Lucide para iconos (react-icons solo para WA/IG, ya en uso). CTAs en teal `#48C9B0`. Negro `#1D1E20` para elementos oscuros. Sin emojis. UI en español CON acentos, gramática cuidada, sin comas de más.
- Commits convencionales (`feat:`, `fix:`, `docs:`, `test:`) sin acentos ni ñ.
- Nunca pushear ni mergear sin OK explícito de Diego.
- Dedupe/idempotencia SIEMPRE por id de fila, nunca sintetizado de datos de negocio.
- Fallo silencioso en el espejo canónico: nunca romper el flujo principal.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TELEGRAM_BOT_TOKEN`.

---

## File Structure

- Create: `vitest.config.ts` — config mínima de Vitest (entorno node, alias `@`).
- Create: `lib/omnichannel/inbox-view.ts` — lógica PURA: arma filas de bandeja y mensajes de un hilo desde datos crudos. Sin I/O.
- Create: `lib/omnichannel/inbox-view.test.ts` — tests Vitest de la lógica pura.
- Create: `lib/omnichannel/access.ts` — helper de verificación de acceso (dueño/colaborador) desde bearer token. DRY entre endpoints.
- Create: `app/api/omnichannel/inbox/route.ts` — GET: trae datos crudos de Supabase y delega a `inbox-view`.
- Create: `app/api/omnichannel/send/route.ts` — POST: despacha el envío por canal + espejo canónico `human`.
- Modify: `app/api/webhook/telegram/route.ts` — gate de `ai_enabled` tras `ingestInbound`.
- Modify: `app/events/[id]/mensajes/page.tsx` — reescritura: lee del endpoint, badges/filtros de canal, tres burbujas, interruptor de handoff, cajón conectado a `/send`, polling.
- Modify: `package.json` — script `test`.

---

## Task 1: Vitest + lógica pura de la bandeja (con tests)

Monta el runner y prueba el setup con los primeros tests reales — la función que arma la bandeja. Es la lógica que de verdad puede fallar y se testea sin mockear I/O.

**Files:**
- Modify: `package.json` (agregar script `test`)
- Create: `vitest.config.ts`
- Create: `lib/omnichannel/inbox-view.ts`
- Create: `lib/omnichannel/inbox-view.test.ts`

**Interfaces:**
- Produces:
  - `buildInboxConversations(input): InboxConversation[]`
  - `messagesForConversation(messages: RawMessage[], conversationId: string): InboxMessage[]`
  - tipos `AuthorType`, `RawConversation`, `RawMessage`, `InboxConversation`, `InboxMessage` (consumidos por Task 3 y Task 6).

- [ ] **Step 1: Instalar Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Agregar script de test a `package.json`**

En `"scripts"` agregar:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Crear `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 4: Crear la lógica pura `lib/omnichannel/inbox-view.ts`**

```ts
export type AuthorType = 'contact' | 'ai' | 'human'

export interface RawConversation {
  id: string
  channel_account_id: string
  participant_id: string
  contact_guest_id: string | null
  ai_enabled: boolean
  last_message_at: string | null
}

export interface RawMessage {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  author_type: AuthorType
  content_text: string | null
  provider_timestamp: string
}

export interface InboxConversation {
  id: string
  channel: string
  participantName: string | null
  guestId: string | null
  guestName: string | null
  rsvpStatus: string | null
  lastMessageText: string | null
  lastMessageAt: string | null
  lastAuthorType: AuthorType | null
  aiEnabled: boolean
}

export interface InboxMessage {
  id: string
  direction: 'inbound' | 'outbound'
  authorType: AuthorType
  contentText: string
  providerTimestamp: string
}

export function buildInboxConversations(input: {
  conversations: RawConversation[]
  channelByAccountId: Map<string, string>
  nameByParticipantId: Map<string, string | null>
  guestById: Map<string, { name: string | null; rsvp_status: string | null }>
  messages: RawMessage[] // ordenados asc por provider_timestamp
}): InboxConversation[] {
  const lastByConv = new Map<string, RawMessage>()
  for (const m of input.messages) lastByConv.set(m.conversation_id, m) // asc => queda el ultimo

  return input.conversations.map((c) => {
    const guest = c.contact_guest_id ? input.guestById.get(c.contact_guest_id) : undefined
    const last = lastByConv.get(c.id)
    return {
      id: c.id,
      channel: input.channelByAccountId.get(c.channel_account_id) ?? 'whatsapp',
      participantName: input.nameByParticipantId.get(c.participant_id) ?? null,
      guestId: c.contact_guest_id ?? null,
      guestName: guest?.name ?? null,
      rsvpStatus: guest?.rsvp_status ?? null,
      lastMessageText: last?.content_text ?? null,
      lastMessageAt: c.last_message_at ?? null,
      lastAuthorType: last?.author_type ?? null,
      aiEnabled: c.ai_enabled,
    }
  })
}

export function messagesForConversation(
  messages: RawMessage[],
  conversationId: string,
): InboxMessage[] {
  return messages
    .filter((m) => m.conversation_id === conversationId)
    .map((m) => ({
      id: m.id,
      direction: m.direction,
      authorType: m.author_type,
      contentText: m.content_text ?? '',
      providerTimestamp: m.provider_timestamp,
    }))
}
```

- [ ] **Step 5: Escribir los tests `lib/omnichannel/inbox-view.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  buildInboxConversations,
  messagesForConversation,
  type RawConversation,
  type RawMessage,
} from './inbox-view'

const conv = (over: Partial<RawConversation> = {}): RawConversation => ({
  id: 'c1', channel_account_id: 'acc-tg', participant_id: 'p1',
  contact_guest_id: 'g1', ai_enabled: true, last_message_at: '2026-06-29T10:00:00Z',
  ...over,
})
const msg = (over: Partial<RawMessage> = {}): RawMessage => ({
  id: 'm1', conversation_id: 'c1', direction: 'inbound', author_type: 'contact',
  content_text: 'hola', provider_timestamp: '2026-06-29T09:00:00Z', ...over,
})

describe('buildInboxConversations', () => {
  it('toma el ultimo mensaje, el canal y el invitado', () => {
    const out = buildInboxConversations({
      conversations: [conv()],
      channelByAccountId: new Map([['acc-tg', 'telegram']]),
      nameByParticipantId: new Map([['p1', 'Diego en TG']]),
      guestById: new Map([['g1', { name: 'Diego Garza', rsvp_status: 'confirmed' }]]),
      messages: [
        msg({ id: 'm1', author_type: 'contact', content_text: 'si voy', provider_timestamp: '2026-06-29T09:00:00Z' }),
        msg({ id: 'm2', direction: 'outbound', author_type: 'ai', content_text: 'Perfecto, te esperamos', provider_timestamp: '2026-06-29T09:01:00Z' }),
      ],
    })
    expect(out).toHaveLength(1)
    expect(out[0].channel).toBe('telegram')
    expect(out[0].guestName).toBe('Diego Garza')
    expect(out[0].rsvpStatus).toBe('confirmed')
    expect(out[0].lastMessageText).toBe('Perfecto, te esperamos')
    expect(out[0].lastAuthorType).toBe('ai')
    expect(out[0].aiEnabled).toBe(true)
  })

  it('conversacion sin mensajes deja preview nulo', () => {
    const out = buildInboxConversations({
      conversations: [conv()],
      channelByAccountId: new Map([['acc-tg', 'telegram']]),
      nameByParticipantId: new Map(),
      guestById: new Map([['g1', { name: 'Diego', rsvp_status: 'pending' }]]),
      messages: [],
    })
    expect(out[0].lastMessageText).toBeNull()
    expect(out[0].lastAuthorType).toBeNull()
  })

  it('conversacion sin invitado ligado deja datos de invitado en null', () => {
    const out = buildInboxConversations({
      conversations: [conv({ contact_guest_id: null })],
      channelByAccountId: new Map([['acc-tg', 'telegram']]),
      nameByParticipantId: new Map([['p1', 'Desconocido']]),
      guestById: new Map(),
      messages: [],
    })
    expect(out[0].guestId).toBeNull()
    expect(out[0].guestName).toBeNull()
    expect(out[0].participantName).toBe('Desconocido')
  })

  it('canal desconocido cae a whatsapp por compatibilidad', () => {
    const out = buildInboxConversations({
      conversations: [conv({ channel_account_id: 'acc-x' })],
      channelByAccountId: new Map(),
      nameByParticipantId: new Map(),
      guestById: new Map(),
      messages: [],
    })
    expect(out[0].channel).toBe('whatsapp')
  })
})

describe('messagesForConversation', () => {
  it('filtra por conversacion y mapea campos en orden', () => {
    const msgs: RawMessage[] = [
      msg({ id: 'm1', conversation_id: 'c1', content_text: 'a' }),
      msg({ id: 'm2', conversation_id: 'c2', content_text: 'b' }),
      msg({ id: 'm3', conversation_id: 'c1', author_type: 'human', direction: 'outbound', content_text: 'c' }),
    ]
    const out = messagesForConversation(msgs, 'c1')
    expect(out.map((m) => m.id)).toEqual(['m1', 'm3'])
    expect(out[1].authorType).toBe('human')
    expect(out[1].contentText).toBe('c')
  })

  it('content_text nulo se vuelve string vacio', () => {
    const out = messagesForConversation([msg({ content_text: null })], 'c1')
    expect(out[0].contentText).toBe('')
  })
})
```

- [ ] **Step 6: Correr los tests**

Run: `npm test`
Expected: PASS, todos verdes (6 tests).

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/omnichannel/inbox-view.ts lib/omnichannel/inbox-view.test.ts
git commit -m "test(inbox): vitest + logica pura de armado de bandeja con tests"
```

---

## Task 2: Helper de verificación de acceso

**Files:**
- Create: `lib/omnichannel/access.ts`

**Interfaces:**
- Produces: `verifyEventAccess(authHeader: string | null, eventId: string): Promise<{ uid: string; eventName: string } | null>` — `null` si no hay token válido o el usuario no es dueño ni colaborador activo.

- [ ] **Step 1: Crear el helper**

```ts
// lib/omnichannel/access.ts
import { createClient } from '@supabase/supabase-js'

export async function verifyEventAccess(
  authHeader: string | null,
  eventId: string,
): Promise<{ uid: string; eventName: string } | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token || !eventId) return null

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: userData } = await anon.auth.getUser(token)
  const uid = userData?.user?.id
  if (!uid) return null

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: event } = await admin
    .from('events').select('id, user_id, name').eq('id', eventId).maybeSingle()
  if (!event) return null

  if (event.user_id === uid) return { uid, eventName: event.name ?? '' }

  const { data: collab } = await admin
    .from('event_collaborators').select('id')
    .eq('event_id', eventId).eq('user_id', uid).eq('status', 'active').maybeSingle()
  if (collab) return { uid, eventName: event.name ?? '' }

  return null
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add lib/omnichannel/access.ts
git commit -m "feat(inbox): helper de verificacion de acceso por evento"
```

---

## Task 3: Endpoint de lectura de la bandeja

**Files:**
- Create: `app/api/omnichannel/inbox/route.ts`

**Interfaces:**
- Consumes: `verifyEventAccess` (Task 2); `buildInboxConversations`, `messagesForConversation`, tipos `RawConversation`/`RawMessage` (Task 1).
- Produces: `GET /api/omnichannel/inbox?eventId=<uuid>&conversationId=<uuid?>` → `{ conversations: InboxConversation[]; messages?: InboxMessage[] }`. 403 sin acceso, 400 sin `eventId`.

- [ ] **Step 1: Crear el endpoint**

```ts
// app/api/omnichannel/inbox/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyEventAccess } from '@/lib/omnichannel/access'
import {
  buildInboxConversations,
  messagesForConversation,
  type RawConversation,
  type RawMessage,
} from '@/lib/omnichannel/inbox-view'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId') ?? ''
  const conversationId = searchParams.get('conversationId')
  if (!eventId) return NextResponse.json({ error: 'Falta eventId' }, { status: 400 })

  const access = await verifyEventAccess(request.headers.get('authorization'), eventId)
  if (!access) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: convs } = await admin
    .from('conversations')
    .select('id, channel_account_id, participant_id, contact_guest_id, ai_enabled, last_message_at')
    .eq('tenant_id', eventId)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (!convs || convs.length === 0) return NextResponse.json({ conversations: [] })

  const accountIds = [...new Set(convs.map((c) => c.channel_account_id))]
  const participantIds = [...new Set(convs.map((c) => c.participant_id))]
  const guestIds = [...new Set(convs.map((c) => c.contact_guest_id).filter(Boolean))] as string[]
  const convIds = convs.map((c) => c.id)

  const [{ data: accounts }, { data: participants }, { data: guests }, { data: msgs }] = await Promise.all([
    admin.from('channel_accounts').select('id, channel').in('id', accountIds),
    admin.from('channel_participants').select('id, display_name').in('id', participantIds),
    guestIds.length
      ? admin.from('guests').select('id, name, rsvp_status').in('id', guestIds)
      : Promise.resolve({ data: [] as any[] }),
    admin.from('messages')
      .select('id, conversation_id, direction, author_type, content_text, provider_timestamp')
      .in('conversation_id', convIds)
      .order('provider_timestamp', { ascending: true }),
  ])

  const messages = (msgs ?? []) as RawMessage[]

  const conversations = buildInboxConversations({
    conversations: convs as RawConversation[],
    channelByAccountId: new Map((accounts ?? []).map((a) => [a.id, a.channel])),
    nameByParticipantId: new Map((participants ?? []).map((p) => [p.id, p.display_name])),
    guestById: new Map((guests ?? []).map((g) => [g.id, { name: g.name, rsvp_status: g.rsvp_status }])),
    messages,
  })

  const thread = conversationId ? messagesForConversation(messages, conversationId) : undefined

  return NextResponse.json({ conversations, messages: thread })
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Prueba manual rápida (con dev server arriba)**

Confirmar que sin header `Authorization` responde 403, y con sesión válida responde 200 con `{ conversations: [...] }`. El éxito real se valida en Task 6 con la UI.

- [ ] **Step 4: Commit**

```bash
git add app/api/omnichannel/inbox/route.ts
git commit -m "feat(inbox): endpoint de lectura de la bandeja omnicanal por evento"
```

---

## Task 4: Endpoint único de envío

**Files:**
- Create: `app/api/omnichannel/send/route.ts`

**Interfaces:**
- Consumes: `verifyEventAccess` (Task 2); `ingestOutbound` de `lib/omnichannel/store.ts`; `sendTelegramMessage`, `telegramExternalAccountId` de `lib/telegram/adapter.ts`.
- Produces: `POST /api/omnichannel/send` body `{ conversationId: string; text: string }` → `{ ok: true }` o error. Registra el mensaje como `author_type: 'human'` en el modelo canónico.

- [ ] **Step 1: Crear el endpoint**

```ts
// app/api/omnichannel/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyEventAccess } from '@/lib/omnichannel/access'
import { ingestOutbound } from '@/lib/omnichannel/store'
import { sendTelegramMessage, telegramExternalAccountId } from '@/lib/telegram/adapter'

export async function POST(request: NextRequest) {
  let body: { conversationId: string; text: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Body invalido' }, { status: 400 }) }
  const { conversationId, text } = body
  if (!conversationId || !text?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: conv } = await admin
    .from('conversations')
    .select('id, channel_account_id, participant_id, workspace_id, tenant_id, contact_guest_id')
    .eq('id', conversationId).maybeSingle()
  if (!conv?.tenant_id) return NextResponse.json({ error: 'Conversacion no encontrada' }, { status: 404 })

  const access = await verifyEventAccess(request.headers.get('authorization'), conv.tenant_id)
  if (!access) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  const [{ data: account }, { data: participant }] = await Promise.all([
    admin.from('channel_accounts').select('channel, external_account_id').eq('id', conv.channel_account_id).maybeSingle(),
    admin.from('channel_participants').select('external_id').eq('id', conv.participant_id).maybeSingle(),
  ])
  if (!account || !participant) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

  const clean = text.trim()
  const channel = account.channel
  const externalId = participant.external_id

  // ── Telegram ───────────────────────────────────────────────────────────────
  if (channel === 'telegram') {
    const sent = await sendTelegramMessage(externalId, clean)
    if (!sent.ok || !sent.messageId) {
      return NextResponse.json({ error: 'Error al enviar por Telegram' }, { status: 502 })
    }
    await ingestOutbound(admin, {
      channel: 'telegram',
      externalAccountId: telegramExternalAccountId(),
      participantExternalId: externalId,
      contentText: clean,
      authorType: 'human',
      providerMessageId: `${externalId}:${sent.messageId}`,
      providerTimestamp: sent.date,
      status: 'sent',
      workspaceId: conv.workspace_id,
      tenantId: conv.tenant_id,
      contactGuestId: conv.contact_guest_id,
    })
    return NextResponse.json({ ok: true })
  }

  // ── WhatsApp ─────────────────────────────────────────────────────────────────
  if (channel === 'whatsapp') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken  = process.env.TWILIO_AUTH_TOKEN!
    const from       = process.env.TWILIO_WHATSAPP_FROM!
    const to         = externalId.startsWith('whatsapp:') ? externalId : `whatsapp:${externalId}`
    const url         = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const params      = new URLSearchParams({ To: to, From: from, Body: clean })

    const twilioRes = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    if (!twilioRes.ok) {
      const err = await twilioRes.text()
      console.error('[omni-send] Twilio error:', err)
      return NextResponse.json({ error: 'Error al enviar por WhatsApp' }, { status: 502 })
    }
    const sentAt = new Date().toISOString()

    // wa_messages (legacy) + bump RSVP, preserva comportamiento existente
    const { data: waRow } = await admin.from('wa_messages').insert({
      guest_id: conv.contact_guest_id,
      event_id: conv.tenant_id,
      direction: 'sent',
      content: clean,
      created_at: sentAt,
    }).select('id').maybeSingle()

    if (conv.contact_guest_id) {
      await admin.from('guests').update({ rsvp_status: 'mensaje_enviado' })
        .eq('id', conv.contact_guest_id).eq('rsvp_status', 'pending')
    }

    // espejo canonico con llave wa:<id> (mismo esquema que el backfill)
    await ingestOutbound(admin, {
      channel: 'whatsapp',
      externalAccountId: account.external_account_id ?? from.replace(/^whatsapp:/, ''),
      participantExternalId: externalId,
      contentText: clean,
      authorType: 'human',
      providerMessageId: waRow?.id ? `wa:${waRow.id}` : `wa:${sentAt}`,
      providerTimestamp: sentAt,
      status: 'sent',
      workspaceId: conv.workspace_id,
      tenantId: conv.tenant_id,
      contactGuestId: conv.contact_guest_id,
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Canal no soportado' }, { status: 400 })
}
```

> Nota: el espejo de WhatsApp usa `account.external_account_id` (el de la cuenta ya existente) para caer en la MISMA conversación. Verificar en la prueba manual que el mensaje no crea una conversación nueva.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add app/api/omnichannel/send/route.ts
git commit -m "feat(inbox): endpoint unico de envio con espejo canonico (telegram + whatsapp)"
```

---

## Task 5: Gate de `ai_enabled` en el webhook de Telegram

**Files:**
- Modify: `app/api/webhook/telegram/route.ts` (dentro de `processTelegramUpdate`, justo después de `ingestInbound`).

**Interfaces:**
- Consumes: `conversationId` que ya devuelve `ingestInbound`.
- Produces: cuando `conversations.ai_enabled === false`, el agente no interpreta, no responde ni cambia RSVP; el inbound queda guardado y el webhook se marca procesado.

- [ ] **Step 1: Insertar el gate**

Ubicar el bloque existente (líneas ~108-126):

```ts
    const conversationId = await ingestInbound(supabase, {
      // ...
    })

    const { data: eventRow } = await supabase
      .from('events')
```

Insertar entre ambos:

```ts
    if (conversationId) {
      const { data: conv } = await supabase
        .from('conversations').select('ai_enabled').eq('id', conversationId).maybeSingle()
      if (conv && conv.ai_enabled === false) {
        return await markProcessed(supabase, webhookEventId)
      }
    }
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add app/api/webhook/telegram/route.ts
git commit -m "feat(inbox): webhook telegram respeta ai_enabled (handoff humano)"
```

---

## Task 6: Reescritura de la página de mensajes

**Files:**
- Modify: `app/events/[id]/mensajes/page.tsx` (reescritura completa).

**Interfaces:**
- Consumes: `GET /api/omnichannel/inbox` (Task 3), `POST /api/omnichannel/send` (Task 4); tipos `InboxConversation`/`InboxMessage`/`AuthorType` de `@/lib/omnichannel/inbox-view`; `supabase` de `@/lib/supabase` para el access token (`auth.getSession()`), el toggle de `ai_enabled` y el detalle del invitado (mesa/tags/alergias).

**Se conservan helpers existentes:** `tiempoRelativo`, `formatHora`, `formatFechaChat`, `iniciales`, `RsvpBadge`/`RSVP_CONFIG`, `ModalProximamente`, y el shell de tres columnas responsive.

**Tipos (importar de inbox-view, eliminar `WaMessage`/`Conversation` viejos):**

```tsx
import type { InboxConversation, InboxMessage, AuthorType } from '@/lib/omnichannel/inbox-view'
```

**Config de canal (badge):**

```tsx
import { FaWhatsapp, FaTelegram } from 'react-icons/fa'
const CHANNEL_CONFIG: Record<string, { label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  whatsapp: { label: 'WhatsApp', Icon: FaWhatsapp, color: '#25D366' },
  telegram: { label: 'Telegram', Icon: FaTelegram, color: '#229ED9' },
}
```

**Estado:** `conversaciones: InboxConversation[]`, `seleccionadaId: string | null`, `mensajes: InboxMessage[]`, `mesa`, `cargandoMesa`, `detalleInvitado` (`{ side, tags, allergies } | null`), `mensaje`, `enviando`, `errorEnvio`, `busqueda`, `canalFiltro: 'todos'|'whatsapp'|'telegram'`, `modalProximo`.

**Carga de datos (reemplaza `cargar` que leía `wa_messages`):**

```tsx
const fetchInbox = useCallback(async (convId?: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return
  const qs = new URLSearchParams({ eventId })
  if (convId) qs.set('conversationId', convId)
  const res = await fetch(`/api/omnichannel/inbox?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return
  const json = await res.json()
  setConversaciones(json.conversations ?? [])
  if (convId && json.messages) setMensajes(json.messages)
}, [eventId])
```

**Polling (~4s):**

```tsx
useEffect(() => {
  fetchInbox(seleccionadaId ?? undefined)
  const t = setInterval(() => fetchInbox(seleccionadaId ?? undefined), 4000)
  return () => clearInterval(t)
}, [fetchInbox, seleccionadaId])
```

**Filtro + búsqueda:**

```tsx
const convsFiltradas = conversaciones.filter((c) =>
  (canalFiltro === 'todos' || c.channel === canalFiltro) &&
  (c.guestName ?? c.participantName ?? '').toLowerCase().includes(busqueda.toLowerCase())
)
```

Chips (Todos · WhatsApp · Telegram) en el header del panel lista: activo `bg-[#48C9B0]/15 text-[#1D9E75]`, inactivos gris.

**Fila de lista:** avatar `iniciales(c.guestName ?? c.participantName ?? '?')`, nombre, badge de canal con `CHANNEL_CONFIG[c.channel]`, preview (`c.lastAuthorType === 'ai' ? 'IA: ' : c.lastAuthorType === 'human' ? 'Tu: ' : ''` + `lastMessageText`), `tiempoRelativo(c.lastMessageAt)`, `RsvpBadge` si `rsvpStatus`.

**Selección:** guarda el id (`setSeleccionadaId(c.id)`), no el objeto, para que el polling traiga la versión fresca. La conversación seleccionada se deriva con `conversaciones.find((c) => c.id === seleccionadaId)`.

**Header de chat:** avatar + nombre + badge de canal + `RsvpBadge`. **Interruptor de handoff** a la derecha:

```tsx
async function toggleAgente(conv: InboxConversation) {
  const nuevo = !conv.aiEnabled
  setConversaciones((prev) => prev.map((c) => c.id === conv.id ? { ...c, aiEnabled: nuevo } : c))
  await supabase.from('conversations').update({ ai_enabled: nuevo }).eq('id', conv.id)
}
```

Pill: activo = teal, ícono `Sparkles`, texto "Agente activo"; en pausa = gris, ícono `UserRound`, texto "Yo respondo".

**Burbujas por `author_type`** (agrupadas por día con `formatFechaChat` sobre `providerTimestamp`):

```tsx
function Burbuja({ m }: { m: InboxMessage }) {
  if (m.authorType === 'contact') return (
    <div className="mb-2 flex justify-start">
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm border border-[#e8e8e8] bg-white px-3.5 py-2.5 shadow-sm">
        <p className="text-sm leading-relaxed text-[#1D1E20] break-words">{m.contentText}</p>
        <span className="mt-1 block text-[10px] text-[#9ca3af]">{formatHora(m.providerTimestamp)}</span>
      </div>
    </div>
  )
  const esIA = m.authorType === 'ai'
  return (
    <div className="mb-2 flex justify-end">
      <div className="max-w-[75%]">
        <div className="mb-0.5 flex items-center justify-end gap-1">
          {esIA ? <Sparkles size={10} className="text-[#48C9B0]" /> : null}
          <span className={`text-[9px] font-medium ${esIA ? 'text-[#48C9B0]' : 'text-[#9ca3af]'}`}>{esIA ? 'IA' : 'Tu'}</span>
        </div>
        <div className={`rounded-2xl rounded-tr-sm px-3.5 py-2.5 ${esIA ? 'bg-[#48C9B0]' : 'bg-[#1D1E20]'}`}>
          <p className="text-sm leading-relaxed text-white break-words">{m.contentText}</p>
          <span className="mt-1 block text-right text-[10px] text-white/60">{formatHora(m.providerTimestamp)}</span>
        </div>
      </div>
    </div>
  )
}
```

**Cajón de envío (reemplaza `enviarMensaje` que pegaba a `/api/whatsapp/send`):**

```tsx
async function enviar() {
  if (!mensaje.trim() || !seleccionadaId || enviando) return
  setEnviando(true); setErrorEnvio(null)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/omnichannel/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ conversationId: seleccionadaId, text: mensaje.trim() }),
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error ?? 'Error al enviar') }
    setMensaje('')
    await fetchInbox(seleccionadaId)
  } catch (err: any) {
    setErrorEnvio(err?.message ?? 'No se pudo enviar el mensaje')
  } finally { setEnviando(false) }
}
```

**Detalle del invitado:** al seleccionar, leer extras con el browser client:

```tsx
// mesa: supabase.from('table_seats').select('tables(name, number)').eq('guest_id', guestId).maybeSingle()
// invitado: supabase.from('guests').select('side, tags, allergies').eq('id', guestId).maybeSingle()
```

Render igual que hoy (lado, mesa, tags, alergias). La tarjeta "Agente IA" refleja `aiEnabled` de la conversación seleccionada (activo / en pausa).

**Estado vacío y `ModalProximamente`:** se conservan; el botón "Enviar campaña masiva" sigue abriendo el modal próximamente.

- [ ] **Step 1: Reescribir la página completa** siguiendo las secciones de arriba y el shell de tres columnas existente.

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Correr tests (no debe romper nada)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 5: Prueba manual end-to-end (localhost:3000)**

1. Abrir `/events/<id>/mensajes` de un evento con conversación de Telegram real.
2. Ver la conversación con badge Telegram, mensajes del invitado (blanco izquierda) y del agente (teal "IA" derecha).
3. Escribir desde el cajón → burbuja oscura "Tu" + llega a Telegram.
4. Apagar "Yo respondo" → escribir desde Telegram → el agente NO responde y el mensaje aparece. Prender → el agente responde.
5. Filtros de canal funcionan.

- [ ] **Step 6: Commit**

```bash
git add app/events/[id]/mensajes/page.tsx
git commit -m "feat(inbox): bandeja omnicanal por evento (lectura canonica, badges, handoff, envio)"
```

---

## Self-Review (cobertura vs spec)

- Lectura por endpoint de servidor con verificación de acceso → Task 2 + Task 3. ✓
- Lógica de armado de bandeja testeada (Vitest) → Task 1. ✓
- Badges de canal + filtros WhatsApp/Telegram → Task 6. ✓
- Tres estilos de autor (contact/ai/human) → Task 6 (`Burbuja`). ✓
- Interruptor de handoff + cableo `ai_enabled` en webhook Telegram → Task 6 (toggle) + Task 5 (gate). ✓
- Endpoint único de envío (Telegram + WhatsApp) con espejo canónico `human` → Task 4. ✓
- Cajón conectado + polling ~4s → Task 6. ✓
- Diferidos (inbox general, vincular prospectos, ventana 24h WhatsApp, gate WhatsApp, realtime, media) → fuera de alcance, anotados en la spec. ✓
- Recorte de emergencia (solo Telegram) → omitir el bloque WhatsApp de Task 4 y el filtro WhatsApp de Task 6, sin afectar el resto. ✓

## Riesgos conocidos
- `externalAccountId` de WhatsApp en el espejo (ver nota en Task 4): validar que el envío cae en la misma conversación.
- Endpoints nuevos validan acceso; los viejos (`/api/whatsapp/send`) siguen sin auth (deuda pre-existente).
- `anfiora.com` hace 307 a `www` en POST; pruebas de webhook a `https://www.anfiora.com`.
- El webhook de Telegram vive en prod (URL fija a `www.anfiora.com`); la auto-respuesta del agente corre en prod pero escribe a la Supabase compartida, así que el inbox local la ve por polling.
