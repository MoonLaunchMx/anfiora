# Agente unificado — Fase 1 (cerebro inteligente sobre rieles nuevos, Telegram) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el agente de Telegram responda con el cerebro inteligente (grounded, sin alucinar via self-check, con memoria por invitado y FAQ/tono configurables) en vez del clasificador simple actual.

**Architecture:** Se portan a `main` (desde `feature/whatsapp-ia`) las piezas del cerebro que son agnosticas de tabla: tipos + config (`event_settings.agent_config`), las 3 funciones LLM (`generateGroundedReply`/`selfCheckReply`/`distillGuestMemory`), el `buildContextPack` y el pipeline de 5 candados. El webhook de Telegram ya corre sobre el modelo canonico (ya lee historial de `messages`, deduplica con `webhook_events`, respeta `conversations.ai_enabled`); solo se cambia el paso de "responder" para usar el pipeline, se alimenta la config y se destila memoria. La escritura de asistencia/atencion sigue con el resolver de A (ya en main).

**Tech Stack:** Next.js 16, TypeScript, @anthropic-ai/sdk 0.91, Supabase service role, Vitest.

## Global Constraints

- **Se construye sobre A** (ya en main): `resolveRsvpAndAttention`, `guests.needs_attention/attention_reason`, `lib/agent/attention.ts`. Rama nueva `feat/agente-unificado-fase1` desde `main`.
- **Un solo hogar para el cerebro:** `lib/agent/*`. NO recrear logica que se porta; portar y reapuntar imports. (Spec: hogar del codigo)
- **Reconciliacion de duplicados (Spec):** la bandera de atencion es `guests.needs_attention`+`attention_reason` (NO `wa_needs_human`); el handoff prender/apagar IA es `conversations.ai_enabled` (ya vivo). No introducir `wa_needs_human` en este flujo.
- **NO gatear por `config.enabled` en Fase 1.** El master on/off llega con su UI en Fase 3; gatear ahora (default `enabled:false`) silenciaria el agente. El on/off vivo sigue siendo `conversations.ai_enabled`. La config se usa para CONTENIDO (tono, firma, holding/deflect, FAQ).
- **Solo Telegram en Fase 1.** No tocar el webhook de WhatsApp (Fase 4).
- **Copiloto fuera de alcance** en Fase 1 (default `mode:autonomo`); si el pipeline devuelve `draft`, se trata como handoff (no se envia, se levanta atencion).
- Tests Vitest solo para logica pura (`mergeAgentConfig`); el resto (LLM, webhook) se verifica manual en Telegram (prod) con @AnfioraEventosbot.
- Commits convencionales SIN acentos ni ñ. UI/copys con acentos. Nunca push/merge sin OK de Diego. Claude no toca Supabase.

---

### Task 1: Tipos del agente + modulo de config

**Files:**
- Modify: `lib/types.ts` (agregar tipos del agente)
- Create: `lib/agent/config.ts`
- Test: `lib/agent/config.test.ts`

**Interfaces:**
- Produces: `AgentMode`, `AgentTone`, `FaqEntry`, `AgentConfig` (en `lib/types.ts`); `DEFAULT_AGENT_CONFIG`, `mergeAgentConfig(raw)`, `getAgentConfig(supabase, eventId)`, `DEBOUNCE_MS`, `OPT_OUT_KEYWORDS` (en `lib/agent/config.ts`).

- [ ] **Step 1: Agregar tipos en `lib/types.ts`**

Agregar (cerca de la seccion de tipos del evento o al final del bloque de tipos):

```ts
export type AgentMode = 'autonomo' | 'copiloto'
export type AgentTone = 'calido' | 'formal'
export type FaqEntry = { q: string; a: string }

export type AgentConfig = {
  enabled: boolean
  mode: AgentMode
  tone: AgentTone
  signature: string
  holdingMessage: string
  deflectMessage: string
  escalate: { alergias: boolean; quejas: boolean; cambios_invitados: boolean; fuera_de_info: boolean }
  faq: FaqEntry[]
}
```

- [ ] **Step 2: Escribir el test que falla** — `lib/agent/config.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { mergeAgentConfig, DEFAULT_AGENT_CONFIG } from './config'

describe('mergeAgentConfig', () => {
  it('devuelve el default cuando no hay config', () => {
    expect(mergeAgentConfig(null)).toEqual(DEFAULT_AGENT_CONFIG)
  })
  it('mezcla parcial sobre el default sin perder escalate', () => {
    const m = mergeAgentConfig({ tone: 'formal', escalate: { alergias: false } as any })
    expect(m.tone).toBe('formal')
    expect(m.escalate.alergias).toBe(false)
    expect(m.escalate.quejas).toBe(true)
    expect(m.mode).toBe(DEFAULT_AGENT_CONFIG.mode)
  })
  it('faq invalida cae a arreglo vacio', () => {
    expect(mergeAgentConfig({ faq: 'x' as any }).faq).toEqual([])
  })
})
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npm test -- config`
Expected: FAIL (`Cannot find module './config'`).

- [ ] **Step 4: Crear `lib/agent/config.ts` (portar de la rama, reapuntar import)**

Traer el contenido de la rama y reapuntar el import de tipos:

```bash
git show origin/feature/whatsapp-ia:lib/whatsapp/config.ts > lib/agent/config.ts
```

El archivo ya importa `import type { AgentConfig } from '@/lib/types'` (correcto, ya existe por Task 1 Step 1). No requiere mas cambios. Contenido esperado (verificar que coincide): `DEBOUNCE_MS=17_000`, `OPT_OUT_KEYWORDS`, `DEFAULT_AGENT_CONFIG` (con `enabled:false, mode:'autonomo', tone:'calido', holdingMessage`, `deflectMessage`, `escalate{...}`, `faq:[]`), `mergeAgentConfig`, `getAgentConfig` (lee `event_settings.agent_config`).

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npm test -- config`
Expected: PASS.

- [ ] **Step 6: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `lib/types.ts` ni `lib/agent/config.ts`.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/agent/config.ts lib/agent/config.test.ts
git commit -m "feat(agente): tipos del agente y modulo de config portado de whatsapp-ia"
```

---

### Task 2: Las 3 funciones LLM del cerebro (en `lib/ai-rsvp.ts`)

**Files:**
- Modify: `lib/ai-rsvp.ts` (agregar 3 funciones)

**Interfaces:**
- Consumes: `AgentTone` de `@/lib/types`; `MessageHistory` (ya en `lib/ai-rsvp.ts`).
- Produces:
  - `generateGroundedReply(contextText: string, tone: AgentTone, signature: string, history: MessageHistory[], guestName: string, incomingMessage: string, memory?: string | null): Promise<{ answer: string; deferred: boolean }>`
  - `selfCheckReply(contextText: string, reply: string): Promise<boolean>`
  - `distillGuestMemory(prevMemory: string | null, history: MessageHistory[], guestName: string): Promise<string | null>`

Verificacion: manual (I/O Haiku).

- [ ] **Step 1: Ver el codigo fuente de las 3 funciones en la rama**

Run: `git show origin/feature/whatsapp-ia:lib/ai-rsvp.ts`
Localizar `generateGroundedReply` (~linea 179), `selfCheckReply` (~234) y `distillGuestMemory` (~263). Copiar esas tres funciones COMPLETAS.

- [ ] **Step 2: Pegarlas al final de `lib/ai-rsvp.ts` (main)**

Agregar las tres funciones tal cual al final del archivo. En el import de tipos arriba del archivo, agregar `AgentTone`:

```ts
import type { AgentTone } from '@/lib/types'
```

(Si `lib/ai-rsvp.ts` no importa de `@/lib/types` todavia, agregar la linea; si ya importa otros tipos, sumar `AgentTone` a esa linea.) Las funciones usan el `client` de Anthropic y `MessageHistory` que ya existen en el archivo. No cambian de logica.

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `lib/ai-rsvp.ts`. (Si alguna funcion referencia un helper privado que no existe en main, traerlo tambien de la rama y reportarlo.)

- [ ] **Step 4: Commit**

```bash
git add lib/ai-rsvp.ts
git commit -m "feat(agente): funciones grounded reply, self-check y memoria episodica portadas"
```

---

### Task 3: Context-pack + pipeline de 5 candados (en `lib/agent/`)

**Files:**
- Create: `lib/agent/context-pack.ts`
- Create: `lib/agent/pipeline.ts`

**Interfaces:**
- Consumes: `AgentConfig` de `@/lib/types`; las 3 funciones LLM de `@/lib/ai-rsvp`; `interpretRSVPMessage` de `@/lib/ai-rsvp`.
- Produces:
  - `buildContextPack(supabase, guestId, config): Promise<ContextPack | null>`, `buildPreviewPack(...)`, `renderContextPackText(pack)`, `type ContextPack` (en context-pack.ts)
  - `runPipelineOnPack(pack, incomingText, intent, config, history): Promise<AgentOutcome>`, `runAgentPipeline(supabase, args): Promise<AgentOutcome | null>`, `type AgentOutcome` (en pipeline.ts)

Verificacion: manual (I/O).

- [ ] **Step 1: Portar context-pack**

```bash
git show origin/feature/whatsapp-ia:lib/whatsapp/context-pack.ts > lib/agent/context-pack.ts
```

Sus imports ya son `@/lib/types` (ok). Lee de `guests`, `events`, `table_seats`, `party_members`, y usa `config.faq` y `guests.agent_memory`.

- [ ] **Step 2: VERIFICAR columnas `host_name`/`host_name_2` en `events`**

`buildContextPack` hace `events.select('... host_name, host_name_2')`. Confirmar que esas columnas existen en la Supabase compartida:

Run (con el service role del .env.local, sin exponerlo): un GET de prueba o revisar el schema. Si NO existen, quitar `host_name, host_name_2` del `.select(...)` de `buildContextPack` y `buildPreviewPack`, y hacer que `hostsOf` devuelva `null` (el pack tolera `hosts: null`). Reportar que se hizo.

- [ ] **Step 3: Portar el pipeline**

```bash
git show origin/feature/whatsapp-ia:lib/whatsapp/agent.ts > lib/agent/pipeline.ts
```

Reapuntar imports en `lib/agent/pipeline.ts`:
- `from './context-pack'` (ya correcto, mismo dir).
- El import de las funciones LLM debe ser `from '@/lib/ai-rsvp'` (ya lo es). Verificar que `interpretRSVPMessage`, `generateGroundedReply`, `selfCheckReply` se importan de `@/lib/ai-rsvp` y `buildContextPack, renderContextPackText, type ContextPack` de `./context-pack`.

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `lib/agent/context-pack.ts` ni `lib/agent/pipeline.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/agent/context-pack.ts lib/agent/pipeline.ts
git commit -m "feat(agente): context-pack y pipeline de 5 candados portados a lib/agent"
```

---

### Task 4: Cablear el cerebro en el webhook de Telegram

**Files:**
- Modify: `app/api/webhook/telegram/route.ts`

**Interfaces:**
- Consumes: `getAgentConfig` de `@/lib/agent/config`; `buildContextPack`, `runPipelineOnPack` de `@/lib/agent/pipeline` y `@/lib/agent/context-pack`; `distillGuestMemory`, `interpretRSVPMessage` de `@/lib/ai-rsvp`; `resolveRsvpAndAttention` de `@/lib/agent/attention` (A, ya en main).

Verificacion: manual (Telegram en prod).

- [ ] **Step 1: Imports**

En `app/api/webhook/telegram/route.ts`, ajustar imports:
- Quitar `generateAgentReply` del import de `@/lib/ai-rsvp` y dejar `import { interpretRSVPMessage, distillGuestMemory, type EventContext, type MessageHistory } from '@/lib/ai-rsvp'`.
- Agregar:
```ts
import { getAgentConfig } from '@/lib/agent/config'
import { buildContextPack } from '@/lib/agent/context-pack'
import { runPipelineOnPack } from '@/lib/agent/pipeline'
import { resolveRsvpAndAttention } from '@/lib/agent/attention'
```

- [ ] **Step 2: Reemplazar el bloque de respuesta**

El bloque actual (dentro de `if (interpretation.intent !== 'ambiguous' && interpretation.confidence !== 'low') { ... }`) usa `generateAgentReply`. Reemplazar TODO ese `if` por la nueva orquestacion. El `interpretation` ya se calcula arriba; usarlo. Nuevo bloque:

```ts
    const config = await getAgentConfig(supabase, route.eventId)

    // Escritura de asistencia/atencion (resolver de A, sin cambios de modelo)
    if (interpretation.intent !== 'ambiguous' && interpretation.confidence !== 'low') {
      const { data: guestRow } = await supabase
        .from('guests').select('rsvp_status').eq('id', route.guestId).maybeSingle()
      const res = resolveRsvpAndAttention(interpretation.intent, update.text)
      const updates: Record<string, unknown> = {}
      if (res.rsvp && guestRow && guestRow.rsvp_status !== res.rsvp) updates.rsvp_status = res.rsvp
      if (res.needsAttention) { updates.needs_attention = true; updates.attention_reason = res.attentionReason }
      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await supabase.from('guests').update(updates).eq('id', route.guestId)
        if (updErr) console.error('[Telegram RSVP] update fallo:', JSON.stringify(updErr))
      }
    }

    // Cerebro: respuesta grounded con self-check
    const pack = await buildContextPack(supabase, route.guestId, config)
    if (pack) {
      const outcome = await runPipelineOnPack(pack, update.text, interpretation, config, history)
      let replyText: string | null = null
      if (outcome.action === 'reply') {
        replyText = outcome.text
      } else if (outcome.action === 'handoff') {
        replyText = outcome.message
        const { data: g2 } = await supabase.from('guests').select('needs_attention').eq('id', route.guestId).maybeSingle()
        if (!g2?.needs_attention) {
          await supabase.from('guests').update({ needs_attention: true, attention_reason: 'duda' }).eq('id', route.guestId)
        }
      } else {
        // draft (copiloto) fuera de alcance en Fase 1: se trata como atencion, no se envia
        await supabase.from('guests').update({ needs_attention: true, attention_reason: 'duda' }).eq('id', route.guestId)
      }

      if (replyText) {
        const sent = await sendTelegramMessage(update.chatId, replyText)
        if (sent.ok && sent.messageId) {
          await ingestOutbound(supabase, {
            channel: TG_CHANNEL, externalAccountId, participantExternalId: update.chatId,
            contentText: replyText, authorType: 'ai', providerMessageId: `${update.chatId}:${sent.messageId}`,
            providerTimestamp: sent.date, status: 'sent', workspaceId: route.workspaceId,
            tenantId: route.eventId, contactGuestId: route.guestId,
          })
        }
        await notifyInboundRsvp(supabase, {
          eventId: route.eventId, guestId: route.guestId, guestName: route.guestName,
          eventName: eventContext.name, intent: interpretation.attendance ?? interpretation.intent,
        })

        // Memoria episodica
        const turn: MessageHistory[] = [...history, { direction: 'received', content: update.text }, { direction: 'sent', content: replyText }]
        const { data: gm } = await supabase.from('guests').select('agent_memory').eq('id', route.guestId).maybeSingle()
        const memory = await distillGuestMemory(gm?.agent_memory ?? null, turn, route.guestName)
        if (memory) await supabase.from('guests').update({ agent_memory: memory }).eq('id', route.guestId)
      }
    }
```

Nota: `notifyInboundRsvp` recibe `intent`; `interpretation` no tiene campo `attendance`, asi que usar `interpretation.intent` directamente (corregir la linea a `intent: interpretation.intent`). Mantener el `markProcessed` al final del try como esta.

- [ ] **Step 3: Corregir la linea de notify**

Asegurar que la llamada a `notifyInboundRsvp` use `intent: interpretation.intent` (no `interpretation.attendance`, que no existe en este tipo).

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos. Verificar que `generateAgentReply` ya no se referencia en este archivo.

- [ ] **Step 5: Verificacion manual (Telegram, prod, tras merge/preview)**

Con @AnfioraEventosbot y el evento de prueba (Olivia & Pedro), IA encendida (`conversations.ai_enabled` true):
1. "¿A que hora es el evento?" → responde con la hora real del evento (grounded), no inventa.
2. "¿Hay valet parking?" (dato no en el evento) → NO inventa: responde con el deflect o escala (holding) y deja bandera de atencion.
3. Pregunta dos cosas seguidas para ver que usa el historial.
4. Confirmar en `guests.agent_memory` del invitado de prueba que se guardo una ficha blanda (no inventada).
5. Apagar la IA (toggle en la bandeja) → el agente se calla (gate `ai_enabled` ya existente, intacto).

- [ ] **Step 6: Commit**

```bash
git add app/api/webhook/telegram/route.ts
git commit -m "feat(agente): telegram usa el cerebro grounded con self-check y memoria"
```

---

## Self-Review

**Spec coverage (Fase 1):**
- Reutilizar pipeline + context-pack + LLM funcs + config + memoria → Tasks 1, 2, 3. ✓
- Re-conectar historial → ya estaba en el webhook de Telegram (canonico); no requiere tarea. ✓
- Atencion = needs_attention (no wa_needs_human); handoff = ai_enabled (intacto) → Task 4. ✓
- Config para contenido, sin gatear enabled → Task 4 (usa config en pipeline, no gatea). ✓
- Solo Telegram → Task 4 (no toca WhatsApp). ✓
- Copiloto fuera de alcance → Task 4 (draft = atencion). ✓
- Memoria episodica → Task 4 Step 2. ✓

**Placeholder scan:** los porteos referencian archivos exactos de la rama + los deltas concretos; el codigo nuevo (webhook, test) esta inline. Sin TBD. ✓

**Type consistency:** `AgentConfig`/`AgentTone`/`FaqEntry` en `lib/types.ts` (Task 1) usados por config (Task 1), LLM funcs (Task 2), pipeline (Task 3). `runPipelineOnPack(pack, incomingText, intent, config, history)` firma de la rama, llamada igual en Task 4. `AgentOutcome` con `action: 'reply'|'draft'|'handoff'` manejado en Task 4. `resolveRsvpAndAttention(intent, text)` de A. ✓

**Riesgo abierto a confirmar en ejecucion:** existencia de `events.host_name/host_name_2` (Task 3 Step 2) y de las columnas `agent_config`/`agent_memory` en la Supabase compartida (probablemente ya por las migraciones de jun; si faltan, Diego corre el SQL aditivo antes de Task 4).
