# Agente robusto — Sub-proyecto B (extraccion estructurada) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el agente confirme acompanantes y capture alergias en la persona correcta cuando es inequivoco, y escale (bandera) cuando es ambiguo, sin adivinar datos del corazon.

**Architecture:** La IA propone, el codigo dispone. `extractFromMessage` (Haiku tool-use) devuelve un `ExtractionResult` tipado; `applyExtraction` (puro, testeable) lo valida contra los `party_members` reales y produce un `WritePlan`; `executeWritePlan` ejecuta los updates; `generateAgentReply` recibe `appliedSummary` para responder con honestidad. Ambos webhooks comparten el mismo cerebro.

**Tech Stack:** Next.js 16, TypeScript, @anthropic-ai/sdk 0.91 (tool-use), Supabase service role, Vitest.

## Global Constraints

- **Depende de A** (PR #6). Esta rama se ramifica de `feat/agente-robusto-A`, NO de main.
- Filosofia hibrida (c): escribe lo inequivoco, escala lo ambiguo. Nunca crea filas de acompanantes nuevas; nunca escribe una alergia a una persona que no matchea por nombre. (Spec)
- La IA solo propone; toda escritura al corazon pasa por `applyExtraction` (puro) que valida contra `party_members` reales. (Spec)
- `confidence='low'` → no escribe nada al corazon, solo escala. (Spec)
- Atencion derivada por el codigo con prioridad `alergia > queja > peticion > duda`. (Spec)
- Reusar `AttentionReason` de `lib/types.ts` (definido en A). NO redefinir.
- Tests con Vitest solo para logica pura (`applyExtraction`); `extractFromMessage` y webhooks se verifican manual local → preview → prod. (CLAUDE.md regla 5)
- UI/copys con acentos y ñ, sin emojis. Commits convencionales SIN acentos ni ñ.
- Nunca `git push` ni merge sin OK de Diego. Claude nunca toca Supabase (no hay SQL nuevo en B; las columnas ya existen por A).

---

### Task 1: `applyExtraction` (puro) + tipos + Vitest

**Files:**
- Create: `lib/agent/apply.ts`
- Test: `lib/agent/apply.test.ts`

**Interfaces:**
- Consumes: `AttentionReason`, `PartyMember` de `@/lib/types`.
- Produces:
  - `type ExtractionResult` (ver codigo)
  - `type AppliedSummary` (ver codigo)
  - `type WritePlan` (ver codigo)
  - `function applyExtraction(result: ExtractionResult, guest: { rsvp_status: string; allergies?: string[] | null }, members: PartyMember[]): WritePlan`

- [ ] **Step 1: Escribir el test que falla** — `lib/agent/apply.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { applyExtraction, type ExtractionResult } from './apply'
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
    const p = applyExtraction(base, guest(), [])
    expect(p.guestUpdate).toBeNull()
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
  it('none deja acompanantes intactos (pending)', () => {
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
    const p = applyExtraction({ ...base, allergies: [{ who: 'titular', name: null, text: 'mariscos' }] }, guest(), members)
    expect(p.guestUpdate?.allergies).toEqual(['mariscos'])
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
    expect(p.appliedSummary.capturedAllergies).toBe(1)
  })
  it('companion con nombre que existe escribe en su ficha', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'companion', name: 'Ana', text: 'gluten' }] }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', allergies: ['gluten'] }])
    expect(p.appliedSummary.capturedAllergies).toBe(1)
  })
  it('companion sin match no escribe, solo escala alergia', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'companion', name: 'Esposa', text: 'gluten' }] }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.allergies).toBeUndefined()
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
  })
  it('unknown no escribe, solo escala', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'unknown', name: null, text: 'nueces' }] }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
  })
  it('no duplica una alergia que ya tenia el titular', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'titular', name: null, text: 'mariscos' }] }, guest({ allergies: ['mariscos'] }), members)
    expect(p.guestUpdate?.allergies).toEqual(['mariscos'])
  })
})

describe('applyExtraction — confianza y prioridad', () => {
  it('low confidence no escribe al corazon, solo escala duda', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'all', names: [] }, allergies: [{ who: 'titular', name: null, text: 'x' }], confidence: 'low' }, guest(), [member('m1', 'Ana')])
    expect(p.guestUpdate?.rsvp_status).toBeUndefined()
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.attention_reason).toBe('duda')
    expect(p.escalations).toContain('baja_confianza')
  })
  it('prioridad alergia sobre queja', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'titular', name: null, text: 'x' }], complaint: true }, guest(), [])
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
  })
  it('queja sin alergia levanta queja', () => {
    const p = applyExtraction({ ...base, complaint: true }, guest(), [])
    expect(p.guestUpdate?.attention_reason).toBe('queja')
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
  allergies: Array<{ who: 'titular' | 'companion' | 'unknown'; name: string | null; text: string }>
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

  // Guardia de confianza: el modelo duda -> no se toca el corazon.
  if (result.confidence === 'low') {
    escalations.push('baja_confianza')
    guestUpdate.needs_attention = true
    guestUpdate.attention_reason = 'duda'
    summary.flagged = 'duda'
    return { guestUpdate, partyMemberUpdates: [], escalations, appliedSummary: summary }
  }

  // Asistencia del titular
  if (result.attendance === 'confirmed') {
    if (guest.rsvp_status !== 'confirmed') guestUpdate.rsvp_status = 'confirmed'
    summary.confirmedGuest = true
  } else if (result.attendance === 'declined') {
    if (guest.rsvp_status !== 'declined') guestUpdate.rsvp_status = 'declined'
    summary.declinedGuest = true
  }

  // Acompanantes
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
        if (found) {
          ensure(found.id).rsvp_status = 'confirmed'
          summary.confirmedCompanions++
        } else {
          escalations.push('peticion')
        }
      }
      break
    case 'partial_ambiguous':
      escalations.push('peticion')
      break
  }

  // Alergias
  for (const a of result.allergies) {
    const text = a.text.trim()
    if (!text) continue
    if (a.who === 'titular') {
      const set = new Set<string>(Array.isArray(guest.allergies) ? guest.allergies : [])
      set.add(text)
      guestUpdate.allergies = Array.from(set)
      summary.capturedAllergies++
    } else if (a.who === 'companion' && a.name) {
      const found = findMember(a.name, members)
      if (found) {
        const slot = ensure(found.id)
        const set = new Set<string>(slot.allergies ?? (Array.isArray(found.allergies) ? found.allergies : []))
        set.add(text)
        slot.allergies = Array.from(set)
        summary.capturedAllergies++
      } else {
        escalations.push('alergia')
      }
    } else {
      escalations.push('alergia')
    }
  }

  // Atencion derivada (prioridad alergia > queja > peticion > duda)
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
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- apply`
Expected: PASS (todos verdes).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `lib/agent/apply.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/agent/apply.ts lib/agent/apply.test.ts
git commit -m "feat(agente): aplicador determinista applyExtraction con reglas no-adivinar + tests"
```

---

### Task 2: `extractFromMessage` (Haiku tool-use) + `executeWritePlan`

**Files:**
- Create: `lib/agent/extraction.ts`

**Interfaces:**
- Consumes: `ExtractionResult`, `WritePlan` de `./apply`; `Anthropic` de `@anthropic-ai/sdk`; `SupabaseClient` de `@supabase/supabase-js`.
- Produces:
  - `function extractFromMessage(message: string, ctx: { guestName: string; eventName: string; partyMembers: string[] }): Promise<ExtractionResult>`
  - `function executeWritePlan(supabase: SupabaseClient, plan: WritePlan, guestId: string): Promise<void>`

Verificacion: manual (I/O Haiku/Supabase, no Vitest).

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
          action: { type: 'string', enum: ['all', 'none', 'named', 'partial_ambiguous'], description: "all si dice que van todos; none si solo va el titular o no menciona acompanantes; named si nombra a quienes van; partial_ambiguous si da un numero parcial sin decir quienes (ej: 'vamos 2' de 3)." },
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

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos. (Si el tipo `Anthropic.Tool` o `input` no castea limpio, ajustar el cast a `as unknown as ExtractionResult` y reportarlo.)

- [ ] **Step 3: Commit**

```bash
git add lib/agent/extraction.ts
git commit -m "feat(agente): lectura estructurada por tool-use + ejecutor del plan de escritura"
```

---

### Task 3: `generateAgentReply` honesto (recibe `appliedSummary`)

**Files:**
- Modify: `lib/ai-rsvp.ts` (funcion `generateAgentReply`)

**Interfaces:**
- Consumes: `AppliedSummary` de `@/lib/agent/apply`.
- Produces: nueva firma `generateAgentReply(guestName, event, history, incomingMessage, applied: AppliedSummary): Promise<string>` (se quita el parametro `intent`).

Verificacion: manual (I/O Haiku).

- [ ] **Step 1: Reemplazar la firma y el prompt de `generateAgentReply`**

En `lib/ai-rsvp.ts`, agregar el import al inicio:

```ts
import type { AppliedSummary } from '@/lib/agent/apply'
```

Reemplazar la firma actual:

```ts
export async function generateAgentReply(
  intent: RSVPIntent,
  guestName: string,
  event: EventContext,
  history: MessageHistory[],
  incomingMessage: string
): Promise<string> {
```

por:

```ts
export async function generateAgentReply(
  guestName: string,
  event: EventContext,
  history: MessageHistory[],
  incomingMessage: string,
  applied: AppliedSummary
): Promise<string> {
```

Dentro de la funcion, construir un resumen factual de lo que SI se hizo (reemplaza la dependencia de `intent`). Agregar antes de `const systemPrompt`:

```ts
  const accionesReales: string[] = []
  if (applied.confirmedGuest) accionesReales.push('Confirmaste la asistencia del invitado titular.')
  if (applied.declinedGuest) accionesReales.push('Registraste que el invitado titular no podra asistir.')
  if (applied.confirmedCompanions > 0) accionesReales.push(`Confirmaste a ${applied.confirmedCompanions} acompanante(s).`)
  if (applied.capturedAllergies > 0) accionesReales.push('Tomaste nota de una alergia o restriccion y el organizador la vera.')
  if (applied.flagged) accionesReales.push('Hay un detalle que el organizador revisara directamente.')
  const accionesTexto = accionesReales.length ? accionesReales.join(' ') : 'No se registro ninguna accion concreta en este mensaje.'
```

Reemplazar el bloque de `REGLAS` que hablaba de intent/confirmacion por uno basado en `accionesTexto`. Sustituir las dos lineas que empiezan con `- Si confirmaron asistencia:` y `- Si mencionan una alergia` por:

```
- HONESTIDAD ESTRICTA: solo puedes afirmar acciones que aparecen en "ACCIONES REALIZADAS". Si una accion no esta ahi, NO digas que la hiciste.
- Si confirmaste acompanantes, puedes decir con naturalidad que su lugar quedo confirmado. Si NO aparece, no afirmes haber confirmado a nadie mas que al titular cuando corresponda.
- Si tomaste nota de una alergia, di que el organizador la tendra presente. No afirmes haberla "guardado" en ningun sistema mas alla de eso.
```

Y agregar al `userPrompt`, despues del historial, antes de "Genera la respuesta del agente:":

```ts
  const userPrompt = `Historial de conversación:
${historialFormateado}

Nuevo mensaje de ${guestName}: "${incomingMessage}"

ACCIONES REALIZADAS (solo puedes afirmar estas):
${accionesTexto}

Genera la respuesta del agente:`
```

(Eliminar la linea `Intent detectado: ${intent}` del `userPrompt` anterior.)

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: errores ESPERADOS en los dos webhooks (todavia llaman a `generateAgentReply` con la firma vieja). Se arreglan en Task 4. No debe haber otros errores nuevos en `lib/ai-rsvp.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/ai-rsvp.ts
git commit -m "feat(agente): generateAgentReply afirma solo acciones realmente aplicadas"
```

---

### Task 4: Cablear ambos webhooks (extract → apply → execute → reply)

**Files:**
- Modify: `app/api/webhook/whatsapp/route.ts`
- Modify: `app/api/webhook/telegram/route.ts`

**Interfaces:**
- Consumes: `extractFromMessage`, `executeWritePlan` de `@/lib/agent/extraction`; `applyExtraction` de `@/lib/agent/apply`; `generateAgentReply` (nueva firma).

Verificacion: manual (I/O). Reemplaza el flujo de A (`interpretRSVPMessage` + `resolveRsvpAndAttention`).

- [ ] **Step 1: WhatsApp — imports**

En `app/api/webhook/whatsapp/route.ts`, reemplazar el import de A:

```ts
import { interpretRSVPMessage, generateAgentReply } from '@/lib/ai-rsvp'
import { resolveRsvpAndAttention } from '@/lib/agent/attention'
```

por:

```ts
import { generateAgentReply } from '@/lib/ai-rsvp'
import { applyExtraction } from '@/lib/agent/apply'
import { extractFromMessage, executeWritePlan } from '@/lib/agent/extraction'
```

- [ ] **Step 2: WhatsApp — incluir `allergies` en el select del guest**

Cambiar el select del guest (cerca de la linea 42) de:

```ts
      .select('id, name, event_id, rsvp_status')
```

a:

```ts
      .select('id, name, event_id, rsvp_status, allergies')
```

- [ ] **Step 3: WhatsApp — reemplazar el bloque de interpretacion/escritura/reply**

Reemplazar todo el bloque que va desde `const interpretation = await interpretRSVPMessage(...)` hasta el cierre del `if (interpretation.intent !== 'ambiguous' ...)` (lineas ~112-175, justo antes de `await sendWhatsAppReply` queda dentro) por:

```ts
    const { data: partyMembers } = await supabase
      .from('party_members')
      .select('id, guest_id, event_id, name, rsvp_status, allergies')
      .eq('guest_id', guest.id)

    const extraction = await extractFromMessage(text, {
      guestName,
      eventName: eventContext.name,
      partyMembers: (partyMembers ?? []).map((m) => m.name),
    })
    console.log(`[Agent] ${guestName}: "${text}" -> conf ${extraction.confidence}`)

    if (extraction.confidence !== 'low') {
      const plan = applyExtraction(
        extraction,
        { rsvp_status: guest.rsvp_status, allergies: guest.allergies },
        partyMembers ?? [],
      )
      await executeWritePlan(supabase, plan, guest.id)

      const replyText = await generateAgentReply(guestName, eventContext, history, text, plan.appliedSummary)
      console.log(`[AI Reply] ${guestName}: "${replyText}"`)

      const outboundAt = new Date().toISOString()
      const { data: outboundRow, error: insertOutboundError } = await supabase
        .from('wa_messages')
        .insert({ guest_id: guest.id, event_id: guest.event_id, direction: 'sent', content: replyText, created_at: outboundAt })
        .select('id')
        .maybeSingle()
      console.log('[DB] Insert outbound:', insertOutboundError ? JSON.stringify(insertOutboundError) : 'OK')

      if (outboundRow?.id) {
        after(() =>
          mirrorOutbound(supabase, {
            to: from, guestId: guest.id, eventId: guest.event_id, text: replyText,
            author: 'ia', status: 'sent', sid: null, waMessageId: outboundRow.id, createdAt: outboundAt,
          }),
        )
      }

      await sendWhatsAppReply(from, replyText)

      after(() =>
        notifyInboundRsvp(supabase, {
          eventId: guest.event_id, guestId: guest.id, guestName, eventName: eventContext.name,
          intent: extraction.attendance !== 'none' ? extraction.attendance : 'respondio',
        }),
      )
    }

    return twimlResponse()
```

- [ ] **Step 4: Telegram — imports**

En `app/api/webhook/telegram/route.ts`, reemplazar:

```ts
import { interpretRSVPMessage, generateAgentReply, type EventContext, type MessageHistory } from '@/lib/ai-rsvp'
```

por:

```ts
import { generateAgentReply, type EventContext, type MessageHistory } from '@/lib/ai-rsvp'
import { applyExtraction } from '@/lib/agent/apply'
import { extractFromMessage, executeWritePlan } from '@/lib/agent/extraction'
```

y quitar el import de A `import { resolveRsvpAndAttention } from '@/lib/agent/attention'`.

- [ ] **Step 5: Telegram — reemplazar el bloque de interpretacion/escritura/reply**

Reemplazar el bloque que va desde `const interpretation = await interpretRSVPMessage(...)` hasta el cierre de su `if (...)` (incluye el fetch de `guestRow`, el resolver de A, el `generateAgentReply` y el `notifyInboundRsvp`) por:

```ts
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

    if (extraction.confidence !== 'low') {
      const plan = applyExtraction(
        extraction,
        { rsvp_status: guestRow?.rsvp_status ?? 'pending', allergies: guestRow?.allergies },
        partyMembers ?? [],
      )
      await executeWritePlan(supabase, plan, route.guestId)

      const replyText = await generateAgentReply(route.guestName, eventContext, history, update.text, plan.appliedSummary)

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
        eventName: eventContext.name, intent: extraction.attendance !== 'none' ? extraction.attendance : 'respondio',
      })
    }
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en los dos webhooks ni en `lib/ai-rsvp.ts`.

- [ ] **Step 7: Verificacion manual (con A ya en esta rama y columnas existentes)**

Con el bot @AnfioraEventosbot y el evento de prueba (Olivia & Pedro, que tenga al menos 1 acompanante registrado), por Telegram:
1. "Vamos todos" → el titular queda `confirmed` y los `party_members` quedan `confirmed`; la respuesta menciona a los acompanantes.
2. "Mi acompanante Ana es alergica al gluten" (con Ana registrada) → `party_members.allergies` de Ana incluye gluten; bandera `alergia` en el titular.
3. "Vamos 2" (invitacion de 3) → acompanantes intactos, bandera `peticion`, la respuesta no inventa a quien.
4. "Soy alergico a mariscos" → `guests.allergies` incluye mariscos, bandera `alergia`.

- [ ] **Step 8: Commit**

```bash
git add app/api/webhook/whatsapp/route.ts app/api/webhook/telegram/route.ts
git commit -m "feat(agente): webhooks usan lectura estructurada que confirma acompanantes y captura alergias"
```

---

## Self-Review

**Spec coverage:**
- Filosofia hibrida (c) → Task 1 reglas de `applyExtraction`. ✓
- Arquitectura propone/dispone → Task 2 (`extractFromMessage`) + Task 1 (`applyExtraction`) + Task 2 (`executeWritePlan`). ✓
- Esquema `ExtractionResult` → Task 1 (tipo) + Task 2 (tool schema). ✓
- Reglas acompanantes (all/none/named/partial) y alergias (titular/companion/unknown) → Task 1 + tests. ✓
- Atencion derivada con prioridad → Task 1 + test de prioridad. ✓
- low confidence no escribe → Task 1 + test. ✓
- Honestidad por appliedSummary → Task 3 + Task 4. ✓
- Ambos webhooks mismo cerebro → Task 4. ✓
- Sin SQL nuevo (columnas de A) → ninguna tarea toca Supabase schema. ✓
- Fuera de alcance (C, debounce, parentescos, tags UI) → no aparecen tareas. ✓

**Placeholder scan:** sin TBD/TODO; cada paso con codigo o comando concreto. ✓

**Type consistency:** `ExtractionResult`/`WritePlan`/`AppliedSummary` definidos en Task 1 (`apply.ts`), importados igual en Task 2/3/4. `applyExtraction(result, guest, members)` misma firma en webhooks. `generateAgentReply(guestName, event, history, incomingMessage, applied)` nueva firma usada identica en ambos webhooks (Task 4) y definida en Task 3. `AttentionReason` reusado de `lib/types.ts`. ✓
