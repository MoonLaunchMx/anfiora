# Agente unificado — Fase 2 (extraccion estructurada) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el agente de Telegram confirme acompanantes y capture alergias en la persona correcta (o escale cuando es ambiguo) y lo anuncie con honestidad en su respuesta.

**Architecture:** La IA propone (lectura estructurada por tool-use), el codigo dispone (guardia determinista `applyExtraction` que valida contra los party_members reales y produce un WritePlan). La lectura reemplaza al clasificador simple en el webhook de Telegram y jubila `resolveRsvpAndAttention`. El pipeline grounded sigue respondiendo, recibe las acciones realizadas en su contexto (para anunciar con honestidad, verificado por el self-check) y solo escala en quejas.

**Tech Stack:** Next.js 16, TypeScript, @anthropic-ai/sdk 0.91 (tool-use), Supabase service role, Vitest.

## Global Constraints

- **Construye sobre Fase 1** (en main): `lib/agent/{config,context-pack,pipeline}.ts`, las 3 funciones LLM en `lib/ai-rsvp.ts`, el webhook Telegram con el pipeline. Rama nueva `feat/agente-unificado-fase2` desde `main`.
- **Filosofia hibrida (c):** escribe lo inequivoco, escala lo ambiguo. Nunca crea filas de acompanantes; nunca escribe una alergia a quien no matchea por nombre. (Spec)
- **La IA solo propone;** toda escritura al corazon pasa por `applyExtraction` (puro) que valida contra los party_members reales. (Spec)
- **`confidence='low'` → no escribe nada al corazon, solo escala.** (Spec)
- **Atencion derivada por el codigo:** prioridad `alergia > queja > peticion > duda`. (Spec)
- **Escalamiento (decidido 1-jul):** alergia y acompanantes → el agente reconoce y actua (NO escala a holding). Queja → escala a humano. La decision de escalar queja se pasa al pipeline como `opts.escalate='queja'`; se elimina `isSensitive` del pipeline.
- **Honestidad:** `appliedSummary` se agrega al `contextText` (visible al self-check, porque son acciones verdaderas), NO como nota blanda.
- **Solo Telegram** en Fase 2. No tocar el webhook de WhatsApp (Fase 4).
- **Sin SQL nuevo:** las columnas (`needs_attention`, `attention_reason`, `party_members.allergies`) ya existen por A.
- Reusar `AttentionReason`, `PartyMember` de `@/lib/types`. Tests Vitest solo para logica pura. Commits SIN acentos ni enie. Nunca push/merge sin OK de Diego. Claude no toca Supabase.

---

### Task 1: Guardia `applyExtraction` + `renderAppliedActions` + tipos + Vitest

**Files:**
- Create: `lib/agent/apply.ts`
- Test: `lib/agent/apply.test.ts`

**Interfaces:**
- Consumes: `AttentionReason`, `PartyMember` de `@/lib/types`.
- Produces:
  - `type ExtractionResult`, `type AppliedSummary`, `type WritePlan`
  - `applyExtraction(result: ExtractionResult, guest: { rsvp_status: string; allergies?: string[] | null }, members: PartyMember[]): WritePlan`
  - `renderAppliedActions(applied?: AppliedSummary | null): string`

- [ ] **Step 1: Escribir el test que falla** — `lib/agent/apply.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { applyExtraction, renderAppliedActions, type ExtractionResult } from './apply'
import type { PartyMember } from '@/lib/types'

const base: ExtractionResult = {
  attendance: 'none', companions: { action: 'none', names: [] },
  allergies: [], complaint: false, confidence: 'high',
}
const member = (id: string, name: string, extra: Partial<PartyMember> = {}): PartyMember => ({
  id, guest_id: 'g1', event_id: 'e1', name, rsvp_status: 'pending', ...extra,
})
const guest = (over: Partial<{ rsvp_status: string; allergies: string[] | null }> = {}) =>
  ({ rsvp_status: 'pending', allergies: null, ...over })

describe('applyExtraction — asistencia', () => {
  it('confirma al titular', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed' }, guest(), [])
    expect(p.guestUpdate?.rsvp_status).toBe('confirmed')
    expect(p.appliedSummary.confirmedGuest).toBe(true)
  })
  it('no reescribe si ya estaba confirmado', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed' }, guest({ rsvp_status: 'confirmed' }), [])
    expect(p.guestUpdate?.rsvp_status).toBeUndefined()
    expect(p.appliedSummary.confirmedGuest).toBe(true)
  })
  it('attendance none no toca asistencia', () => {
    expect(applyExtraction(base, guest(), []).guestUpdate).toBeNull()
  })
})

describe('applyExtraction — acompanantes', () => {
  const members = [member('m1', 'Ana'), member('m2', 'Luis')]
  it('all confirma a todos', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'all', names: [] } }, guest(), members)
    expect(p.partyMemberUpdates.map(u => u.id).sort()).toEqual(['m1', 'm2'])
    expect(p.partyMemberUpdates.every(u => u.rsvp_status === 'confirmed')).toBe(true)
    expect(p.appliedSummary.confirmedCompanions).toBe(2)
  })
  it('none deja acompanantes intactos', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'none', names: [] } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
  })
  it('named confirma solo los que existen y escala los extra', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'named', names: ['Ana', 'Primo Pedro'] } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', rsvp_status: 'confirmed' }])
    expect(p.appliedSummary.confirmedCompanions).toBe(1)
    expect(p.escalations).toContain('peticion')
  })
  it('partial_ambiguous no toca acompanantes y escala', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'partial_ambiguous', names: [] } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.escalations).toContain('peticion')
    expect(p.guestUpdate?.attention_reason).toBe('peticion')
  })
})

describe('applyExtraction — alergias', () => {
  const members = [member('m1', 'Ana')]
  it('titular escribe en guests.allergies', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'titular', name: '', text: 'mariscos' }] }, guest(), members)
    expect(p.guestUpdate?.allergies).toEqual(['mariscos'])
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
    expect(p.appliedSummary.capturedAllergies).toBe(1)
  })
  it('companion con nombre que existe escribe en su ficha', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'companion', name: 'Ana', text: 'gluten' }] }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', allergies: ['gluten'] }])
    expect(p.appliedSummary.capturedAllergies).toBe(1)
  })
  it('companion sin match no escribe, solo escala', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'companion', name: 'Esposa', text: 'gluten' }] }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.allergies).toBeUndefined()
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
  })
  it('unknown no escribe, solo escala', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'unknown', name: '', text: 'nueces' }] }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
  })
  it('no duplica una alergia que ya tenia el titular', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'titular', name: '', text: 'mariscos' }] }, guest({ allergies: ['mariscos'] }), members)
    expect(p.guestUpdate?.allergies).toEqual(['mariscos'])
  })
})

describe('applyExtraction — confianza y prioridad', () => {
  it('low confidence no escribe al corazon, solo escala duda', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'all', names: [] }, allergies: [{ who: 'titular', name: '', text: 'x' }], confidence: 'low' }, guest(), [member('m1', 'Ana')])
    expect(p.guestUpdate?.rsvp_status).toBeUndefined()
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.attention_reason).toBe('duda')
    expect(p.escalations).toContain('baja_confianza')
  })
  it('prioridad alergia sobre queja', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'titular', name: '', text: 'x' }], complaint: true }, guest(), [])
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
  })
  it('queja sin alergia levanta queja', () => {
    expect(applyExtraction({ ...base, complaint: true }, guest(), []).guestUpdate?.attention_reason).toBe('queja')
  })
})

describe('renderAppliedActions', () => {
  it('vacio cuando no hay acciones', () => {
    expect(renderAppliedActions(null)).toBe('')
    expect(renderAppliedActions({ confirmedGuest: false, declinedGuest: false, confirmedCompanions: 0, capturedAllergies: 0, flagged: null })).toBe('')
  })
  it('incluye titular y acompanantes cuando aplica', () => {
    const s = renderAppliedActions({ confirmedGuest: true, declinedGuest: false, confirmedCompanions: 2, capturedAllergies: 1, flagged: 'alergia' })
    expect(s).toContain('titular')
    expect(s).toContain('2 acompanante')
    expect(s).toContain('alergia')
    expect(s).toContain('Acciones ya realizadas')
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- apply`
Expected: FAIL (`Cannot find module './apply'`).

- [ ] **Step 3: Implementar `lib/agent/apply.ts`**

```ts
import type { AttentionReason, PartyMember } from '@/lib/types'

export type ExtractionResult = {
  attendance: 'confirmed' | 'declined' | 'none'
  companions: { action: 'all' | 'none' | 'named' | 'partial_ambiguous'; names: string[] }
  allergies: Array<{ who: 'titular' | 'companion' | 'unknown'; name: string; text: string }>
  complaint: boolean
  confidence: 'high' | 'medium' | 'low'
}

export type AppliedSummary = {
  confirmedGuest: boolean
  declinedGuest: boolean
  confirmedCompanions: number
  capturedAllergies: number
  flagged: AttentionReason | null
}

export type WritePlan = {
  guestUpdate:
    | { rsvp_status?: 'confirmed' | 'declined'; needs_attention?: boolean; attention_reason?: AttentionReason; allergies?: string[] }
    | null
  partyMemberUpdates: Array<{ id: string; rsvp_status?: 'confirmed'; allergies?: string[] }>
  escalations: string[]
  appliedSummary: AppliedSummary
}

type ApplyGuest = { rsvp_status: string; allergies?: string[] | null }

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function findMember(name: string, members: PartyMember[]): PartyMember | null {
  const n = normalize(name)
  if (!n) return null
  return (
    members.find((m) => normalize(m.name) === n) ??
    members.find((m) => normalize(m.name).includes(n) || n.includes(normalize(m.name))) ??
    null
  )
}

export function applyExtraction(result: ExtractionResult, guest: ApplyGuest, members: PartyMember[]): WritePlan {
  const escalations: string[] = []
  const guestUpdate: NonNullable<WritePlan['guestUpdate']> = {}
  const memberUpdates = new Map<string, { id: string; rsvp_status?: 'confirmed'; allergies?: string[] }>()
  const summary: AppliedSummary = {
    confirmedGuest: false, declinedGuest: false, confirmedCompanions: 0, capturedAllergies: 0, flagged: null,
  }
  const ensure = (id: string) => {
    const cur = memberUpdates.get(id)
    if (cur) return cur
    const o = { id }
    memberUpdates.set(id, o)
    return o
  }

  if (result.confidence === 'low') {
    escalations.push('baja_confianza')
    guestUpdate.needs_attention = true
    guestUpdate.attention_reason = 'duda'
    summary.flagged = 'duda'
    return { guestUpdate, partyMemberUpdates: [], escalations, appliedSummary: summary }
  }

  if (result.attendance === 'confirmed') {
    if (guest.rsvp_status !== 'confirmed') guestUpdate.rsvp_status = 'confirmed'
    summary.confirmedGuest = true
  } else if (result.attendance === 'declined') {
    if (guest.rsvp_status !== 'declined') guestUpdate.rsvp_status = 'declined'
    summary.declinedGuest = true
  }

  switch (result.companions.action) {
    case 'all':
      for (const m of members) ensure(m.id).rsvp_status = 'confirmed'
      summary.confirmedCompanions = members.length
      break
    case 'none':
      break
    case 'named':
      for (const nm of result.companions.names) {
        const found = findMember(nm, members)
        if (found) { ensure(found.id).rsvp_status = 'confirmed'; summary.confirmedCompanions++ }
        else escalations.push('peticion')
      }
      break
    case 'partial_ambiguous':
      escalations.push('peticion')
      break
  }

  for (const a of result.allergies) {
    const text = a.text.trim()
    if (!text) continue
    if (a.who === 'titular') {
      const set = new Set<string>(Array.isArray(guest.allergies) ? guest.allergies : [])
      set.add(text)
      guestUpdate.allergies = Array.from(set)
      summary.capturedAllergies++
    } else if (a.who === 'companion' && a.name.trim()) {
      const found = findMember(a.name, members)
      if (found) {
        const slot = ensure(found.id)
        const set = new Set<string>(slot.allergies ?? (Array.isArray(found.allergies) ? found.allergies : []))
        set.add(text)
        slot.allergies = Array.from(set)
        summary.capturedAllergies++
      } else escalations.push('alergia')
    } else escalations.push('alergia')
  }

  const reason: AttentionReason | null =
    result.allergies.length > 0 ? 'alergia'
    : result.complaint ? 'queja'
    : escalations.includes('peticion') ? 'peticion'
    : null
  if (reason) {
    guestUpdate.needs_attention = true
    guestUpdate.attention_reason = reason
    summary.flagged = reason
  }

  return {
    guestUpdate: Object.keys(guestUpdate).length > 0 ? guestUpdate : null,
    partyMemberUpdates: Array.from(memberUpdates.values()),
    escalations,
    appliedSummary: summary,
  }
}

export function renderAppliedActions(applied?: AppliedSummary | null): string {
  if (!applied) return ''
  const lines: string[] = []
  if (applied.confirmedGuest) lines.push('- Se confirmo la asistencia del invitado titular.')
  if (applied.declinedGuest) lines.push('- Se registro que el invitado titular no podra asistir.')
  if (applied.confirmedCompanions > 0) lines.push(`- Se confirmo la asistencia de ${applied.confirmedCompanions} acompanante(s).`)
  if (applied.capturedAllergies > 0) lines.push('- Se tomo nota de una alergia o restriccion alimentaria; el organizador la tendra presente.')
  if (!lines.length) return ''
  return `\n--- Acciones ya realizadas en este turno (son verdaderas; puedes mencionarlas con naturalidad al invitado) ---\n${lines.join('\n')}`
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- apply`
Expected: PASS.

- [ ] **Step 5: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `lib/agent/apply.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/agent/apply.ts lib/agent/apply.test.ts
git commit -m "feat(agente): guardia applyExtraction + render de acciones realizadas + tests"
```

---

### Task 2: `extractFromMessage` (tool-use) + `executeWritePlan`

**Files:**
- Create: `lib/agent/extraction.ts`

**Interfaces:**
- Consumes: `ExtractionResult`, `WritePlan` de `./apply`; `Anthropic` de `@anthropic-ai/sdk`; `SupabaseClient`.
- Produces:
  - `extractFromMessage(message: string, ctx: { guestName: string; eventName: string; partyMembers: string[] }): Promise<ExtractionResult>`
  - `executeWritePlan(supabase: SupabaseClient, plan: WritePlan, guestId: string): Promise<void>`

Verificacion: manual (I/O).

- [ ] **Step 1: Implementar `lib/agent/extraction.ts`**

```ts
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
    if (block && block.type === 'tool_use') return block.input as ExtractionResult
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
```

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos. (Si `block.input` no castea limpio a `ExtractionResult`, usar `as unknown as ExtractionResult` y reportar.)

- [ ] **Step 3: Commit**

```bash
git add lib/agent/extraction.ts
git commit -m "feat(agente): lectura estructurada por tool-use + ejecutor del plan de escritura"
```

---

### Task 3: Pipeline — acciones en contexto + escalar solo queja

**Files:**
- Modify: `lib/agent/pipeline.ts` (`runPipelineOnPack`; eliminar `isSensitive` e `isCompanionRequest`)

**Interfaces:**
- Consumes: `AppliedSummary`, `renderAppliedActions` de `./apply`.
- Produces: nueva firma `runPipelineOnPack(pack, incomingText, intent, config, history, opts?: { applied?: AppliedSummary | null; escalate?: 'queja' | null }): Promise<AgentOutcome>`.

Verificacion: manual (I/O). No unit test (orquestacion LLM).

- [ ] **Step 1: Reemplazar `runPipelineOnPack` y quitar helpers muertos**

En `lib/agent/pipeline.ts`:
1. Agregar al import de `./context-pack` NADA nuevo; agregar un import: `import { renderAppliedActions, type AppliedSummary } from './apply'`.
2. Eliminar por completo las funciones `isSensitive` y `isCompanionRequest` (ya no se usan: el guardia decide la atencion; solo se escala queja).
3. Reemplazar el cuerpo de `runPipelineOnPack` por:

```ts
export async function runPipelineOnPack(
  pack: ContextPack,
  incomingText: string,
  intent: { intent: string; confidence: string },
  config: AgentConfig,
  history: MessageHistory[],
  opts?: { applied?: AppliedSummary | null; escalate?: 'queja' | null },
): Promise<AgentOutcome> {
  const rsvp = null // la asistencia la escribe el guardia; el pipeline ya no la decide

  // Candado 1: solo se escala queja (decidido por el guardia/extraccion, no por regex)
  if (opts?.escalate) {
    return { action: 'handoff', message: config.holdingMessage, reason: opts.escalate, escalate: true, rsvp }
  }

  // Contexto grounded + acciones realizadas (verdaderas; el self-check las ve)
  const contextText = renderContextPackText(pack) + renderAppliedActions(opts?.applied)

  const gen = await generateGroundedReply(contextText, config.tone, config.signature, history, pack.guestName, incomingText, pack.memory)
  if (gen.deferred) {
    const escalate = config.escalate.fuera_de_info
    return { action: 'handoff', message: escalate ? config.holdingMessage : config.deflectMessage, reason: 'no_se', escalate, rsvp }
  }

  const ok = await selfCheckReply(contextText, gen.answer)
  if (!ok) return { action: 'handoff', message: config.holdingMessage, reason: 'self_check', escalate: true, rsvp }

  if (intent.confidence === 'low') return { action: 'handoff', message: config.holdingMessage, reason: 'baja_confianza', escalate: true, rsvp }

  if (config.mode === 'copiloto') return { action: 'draft', text: gen.answer, rsvp }
  return { action: 'reply', text: gen.answer, rsvp }
}
```

Mantener `runAgentPipeline` como esta (no se usa en el webhook de Telegram; sigue construyendo el pack e invocando `runPipelineOnPack` sin `opts`).

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit`
Expected: errores ESPERADOS en `app/api/webhook/telegram/route.ts` (aun llama la firma vieja / usa resolver). Se arreglan en Task 4. Sin errores nuevos dentro de `lib/agent/pipeline.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/agent/pipeline.ts
git commit -m "feat(agente): pipeline recibe acciones realizadas en contexto y solo escala queja"
```

---

### Task 4: Cablear el webhook de Telegram al guardia

**Files:**
- Modify: `app/api/webhook/telegram/route.ts`

**Interfaces:**
- Consumes: `extractFromMessage`, `executeWritePlan` de `@/lib/agent/extraction`; `applyExtraction` de `@/lib/agent/apply`; `runPipelineOnPack` de `@/lib/agent/pipeline`; `buildContextPack`, `getAgentConfig`, `distillGuestMemory`.

Verificacion: manual (Telegram, prod tras merge).

- [ ] **Step 1: Imports**

En `app/api/webhook/telegram/route.ts`:
- Quitar `interpretRSVPMessage` del import de `@/lib/ai-rsvp` (dejar `distillGuestMemory`, `type EventContext`, `type MessageHistory`).
- Quitar la linea `import { resolveRsvpAndAttention } from '@/lib/agent/attention'`.
- Agregar:
```ts
import { applyExtraction } from '@/lib/agent/apply'
import { extractFromMessage, executeWritePlan } from '@/lib/agent/extraction'
```
(Mantener `getAgentConfig`, `buildContextPack`, `runPipelineOnPack` que ya estan.)

- [ ] **Step 2: Reemplazar el bloque de interpretacion + escritura de A por el guardia**

Reemplazar TODO el bloque que hoy va desde `const interpretation = await interpretRSVPMessage(...)` hasta el cierre del `if (interpretation.intent !== 'ambiguous' ...)` (la escritura del resolver de A) por:

```ts
    const config = await getAgentConfig(supabase, route.eventId)

    const { data: guestRow } = await supabase
      .from('guests').select('rsvp_status, allergies').eq('id', route.guestId).maybeSingle()
    const { data: partyMembers } = await supabase
      .from('party_members')
      .select('id, guest_id, event_id, name, rsvp_status, allergies')
      .eq('guest_id', route.guestId)

    const extraction = await extractFromMessage(update.text, {
      guestName: route.guestName,
      eventName: eventContext.name,
      partyMembers: (partyMembers ?? []).map((m) => m.name),
    })
    console.log(`[Agent] ${route.guestName}: conf ${extraction.confidence}`)

    const plan = applyExtraction(
      extraction,
      { rsvp_status: guestRow?.rsvp_status ?? 'pending', allergies: guestRow?.allergies },
      partyMembers ?? [],
    )
    await executeWritePlan(supabase, plan, route.guestId)

    const escalate: 'queja' | null = extraction.complaint && config.escalate.quejas ? 'queja' : null
    const intentForPipeline = {
      intent: extraction.attendance === 'none' ? 'respondio' : extraction.attendance,
      confidence: extraction.confidence,
    }
```

- [ ] **Step 3: Actualizar la llamada al pipeline y el manejo de outcome**

El bloque siguiente (hoy `const pack = await buildContextPack(...)` + `runPipelineOnPack(pack, update.text, interpretation, config, history)` + dispatch) se ajusta asi:

```ts
    const pack = await buildContextPack(supabase, route.guestId, config)
    if (pack) {
      const outcome = await runPipelineOnPack(pack, update.text, intentForPipeline, config, history, {
        applied: plan.appliedSummary,
        escalate,
      })
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
          await notifyInboundRsvp(supabase, {
            eventId: route.eventId, guestId: route.guestId, guestName: route.guestName,
            eventName: eventContext.name, intent: intentForPipeline.intent,
          })
          const turn: MessageHistory[] = [...history, { direction: 'received', content: update.text }, { direction: 'sent', content: replyText }]
          const { data: gm } = await supabase.from('guests').select('agent_memory').eq('id', route.guestId).maybeSingle()
          const memory = await distillGuestMemory(gm?.agent_memory ?? null, turn, route.guestName)
          if (memory) await supabase.from('guests').update({ agent_memory: memory }).eq('id', route.guestId)
        }
      }
    }
```

Confirmar que `interpretRSVPMessage` y `resolveRsvpAndAttention` ya no se referencian en el archivo.

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Verificacion manual (Telegram, prod tras merge)**

Con @AnfioraEventosbot, evento Olivia & Pedro (con al menos 1 acompanante registrado, ej. "Ana"), IA encendida:
1. "Vamos todos" → titular y acompanantes quedan `confirmed`; la respuesta menciona con calidez que confirmo a los acompanantes.
2. "Ana es alergica al gluten" → `party_members.allergies` de Ana incluye gluten; bandera `alergia`; la respuesta reconoce ("tome nota") y NO manda el mensaje de espera generico.
3. "Vamos 2" (invitacion de 3) → acompanantes intactos, bandera `peticion`, la respuesta no inventa a quien.
4. "Soy alergico a mariscos" → `guests.allergies` incluye mariscos, bandera `alergia`, respuesta calida de reconocimiento.
5. "La organizacion es pesima" (queja) → la respuesta SI escala (mensaje de espera), bandera `queja`.

- [ ] **Step 6: Commit**

```bash
git add app/api/webhook/telegram/route.ts
git commit -m "feat(agente): telegram usa el guardia que confirma acompanantes y captura alergias"
```

---

## Self-Review

**Spec coverage:**
- Filosofia c + reglas del guardia → Task 1 + tests. ✓
- Lectura estructurada (tool-use) + ejecutor → Task 2. ✓
- Honestidad: acciones al contextText visible al self-check → Task 3 (`renderAppliedActions` en contextText) + Task 1 (`renderAppliedActions`). ✓
- Escalar solo queja, alergia reconoce → Task 3 (elimina isSensitive, usa opts.escalate) + Task 4 (deriva escalate de complaint). ✓
- Lectura reemplaza clasificador + jubila resolveRsvpAndAttention → Task 4. ✓
- low confidence no escribe → Task 1 + test. ✓
- Solo Telegram, sin SQL nuevo → Task 4 (no toca WhatsApp), ninguna tarea toca Supabase schema. ✓
- Fuera de alcance (WhatsApp, panel config, parentescos) → sin tareas. ✓

**Placeholder scan:** cada paso con codigo o comando concreto. Sin TBD. ✓

**Type consistency:** `ExtractionResult`/`AppliedSummary`/`WritePlan` en Task 1, usados en Task 2/3/4. `applyExtraction(result, guest, members)` y `renderAppliedActions(applied)` firma unica. `runPipelineOnPack(pack, text, intent, config, history, opts)` en Task 3, llamada igual en Task 4. `AttentionReason` de `@/lib/types`. ✓
