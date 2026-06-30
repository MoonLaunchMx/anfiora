# Agente robusto — Sub-proyecto A (modelo asistencia vs atención) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar la asistencia de la atención en el modelo de datos para que el agente deje de pisar `confirmed` con `accion_necesaria`, y preparar columnas de paridad en acompañantes.

**Architecture:** Una función pura testeable mapea el intent del clasificador a `{ asistencia, bandera de atención, razón }`. Ambos webhooks (WhatsApp y Telegram) la usan para escribir asistencia en `rsvp_status` y atención en columnas nuevas (`needs_attention`/`attention_reason`), sin pisarse. Migración 100% aditiva (Diego la corre), sin tocar el CHECK constraint de `rsvp_status`. La UI de la lista de invitados muestra la bandera y permite resolverla; el editor de acompañantes gana alergias/tags/notas.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (service role en webhooks), Vitest (lógica pura), Tailwind v4.

## Global Constraints

- Migración **solo aditiva**: `ADD COLUMN IF NOT EXISTS`. Nunca `DROP`, nunca alterar el CHECK constraint de `rsvp_status`. (Spec §Cambios de esquema)
- **Claude nunca toca Supabase.** El SQL lo corre Diego. (CLAUDE.md)
- `RsvpStatus` no cambia (sigue con sus 6 valores). Campos nuevos en `lib/types.ts` son opcionales y aditivos. (Spec §Cambios de tipos)
- Tests con **Vitest** solo para lógica pura (`npm test`); webhooks y UI con I/O se verifican manual local → preview → prod. (CLAUDE.md regla 5)
- UI con acentos y ñ, sin emojis, estilo flat, CTA teal `#48C9B0`. (CLAUDE.md)
- Commits convencionales, **sin acentos ni ñ**. (CLAUDE.md)
- **Nunca `git push` ni merge sin OK explícito de Diego.** (CLAUDE.md)
- Orden de despliegue: correr la migración aditiva (no rompe el código viejo, que ignora las columnas nuevas) **antes** de que el código que las usa llegue a cualquier entorno (local/preview/prod comparten la misma Supabase). (Spec §Rollout)

---

### Task 1: Módulo puro de resolución asistencia/atención + tipos

**Files:**
- Modify: `lib/types.ts` (agregar `AttentionReason` y campos opcionales a `Guest` y `PartyMember`)
- Create: `lib/agent/attention.ts`
- Test: `lib/agent/attention.test.ts`

**Interfaces:**
- Consumes: `RSVPIntent` desde `@/lib/ai-rsvp` (`'confirmed' | 'declined' | 'respondio' | 'accion_necesaria' | 'ambiguous'`).
- Produces:
  - `type AttentionReason = 'alergia' | 'peticion' | 'queja' | 'duda' | 'otro'` (exportado desde `lib/types.ts`)
  - `type RsvpResolution = { rsvp: 'confirmed' | 'declined' | null; needsAttention: boolean; attentionReason: AttentionReason | null }`
  - `function resolveRsvpAndAttention(intent: RSVPIntent, text: string): RsvpResolution`
  - `function inferAttentionReason(text: string): AttentionReason`

- [ ] **Step 1: Agregar tipos en `lib/types.ts`**

Agregar el tipo (cerca de la sección GUESTS, antes de `export type PartyMember`):

```ts
export type AttentionReason = 'alergia' | 'peticion' | 'queja' | 'duda' | 'otro'
```

En `export type PartyMember = { ... }` agregar al final del objeto:

```ts
  allergies?: string[]
  tags?: string[]
  notes?: string | null
```

En `export type Guest = { ... }` agregar al final del objeto:

```ts
  needs_attention?: boolean
  attention_reason?: AttentionReason | null
```

- [ ] **Step 2: Escribir el test que falla**

Crear `lib/agent/attention.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveRsvpAndAttention, inferAttentionReason } from './attention'

describe('resolveRsvpAndAttention', () => {
  it('confirma asistencia sin levantar atencion', () => {
    expect(resolveRsvpAndAttention('confirmed', 'si vamos los 3')).toEqual({
      rsvp: 'confirmed', needsAttention: false, attentionReason: null,
    })
  })

  it('declina sin atencion', () => {
    expect(resolveRsvpAndAttention('declined', 'no podremos ir')).toEqual({
      rsvp: 'declined', needsAttention: false, attentionReason: null,
    })
  })

  it('confirma Y levanta atencion de alergia sin perder el confirmed', () => {
    expect(resolveRsvpAndAttention('accion_necesaria', 'si vamos! soy alergico a mariscos')).toEqual({
      rsvp: null, needsAttention: true, attentionReason: 'alergia',
    })
  })

  it('respondio no cambia asistencia ni levanta atencion', () => {
    expect(resolveRsvpAndAttention('respondio', 'gracias por el aviso')).toEqual({
      rsvp: null, needsAttention: false, attentionReason: null,
    })
  })

  it('ambiguous no hace nada', () => {
    expect(resolveRsvpAndAttention('ambiguous', '👍')).toEqual({
      rsvp: null, needsAttention: false, attentionReason: null,
    })
  })
})

describe('inferAttentionReason', () => {
  it('detecta alergia', () => {
    expect(inferAttentionReason('soy celiaco')).toBe('alergia')
  })
  it('detecta queja', () => {
    expect(inferAttentionReason('me parece pesimo la organizacion')).toBe('queja')
  })
  it('detecta peticion de acompanantes', () => {
    expect(inferAttentionReason('puedo llevar a mi pareja?')).toBe('peticion')
  })
  it('detecta duda', () => {
    expect(inferAttentionReason('a que hora es la ceremonia?')).toBe('duda')
  })
  it('cae en otro cuando no hay senal', () => {
    expect(inferAttentionReason('tengo un asunto que comentarles')).toBe('otro')
  })
  it('prioriza alergia sobre duda', () => {
    expect(inferAttentionReason('soy alergico, a que hora sirven la cena?')).toBe('alergia')
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npm test -- attention`
Expected: FAIL (`Cannot find module './attention'`).

- [ ] **Step 4: Implementar `lib/agent/attention.ts`**

```ts
import type { RSVPIntent } from '@/lib/ai-rsvp'
import type { AttentionReason } from '@/lib/types'

export type RsvpResolution = {
  rsvp: 'confirmed' | 'declined' | null
  needsAttention: boolean
  attentionReason: AttentionReason | null
}

export function inferAttentionReason(text: string): AttentionReason {
  const t = text.toLowerCase()
  if (/alerg|celiac|vegano|vegetarian|intoleran|diabet|sin gluten|no como/.test(t)) return 'alergia'
  if (/queja|molest|pesim|terrible|mal organiz|enojad|inconform/.test(t)) return 'queja'
  if (/llevar|acompa[nñ]|somos \d|mas persona|agregar|sumar|invitad|ni[nñ]|hij|pareja/.test(t)) return 'peticion'
  if (/\?|donde|cuando|c[oó]mo|cu[aá]l|qu[eé] hora|a que hora|direcci[oó]n|estacionamiento/.test(t)) return 'duda'
  return 'otro'
}

export function resolveRsvpAndAttention(intent: RSVPIntent, text: string): RsvpResolution {
  switch (intent) {
    case 'confirmed':
      return { rsvp: 'confirmed', needsAttention: false, attentionReason: null }
    case 'declined':
      return { rsvp: 'declined', needsAttention: false, attentionReason: null }
    case 'accion_necesaria':
      return { rsvp: null, needsAttention: true, attentionReason: inferAttentionReason(text) }
    case 'respondio':
    case 'ambiguous':
    default:
      return { rsvp: null, needsAttention: false, attentionReason: null }
  }
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npm test -- attention`
Expected: PASS (todos verdes).

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `lib/agent/attention.ts` ni `lib/types.ts`.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/agent/attention.ts lib/agent/attention.test.ts
git commit -m "feat(agente): resolucion pura asistencia vs atencion + tipos"
```

---

### MIGRACIÓN SQL — la corre Diego (gate antes de Task 2)

**Files:**
- Create: `docs/superpowers/plans/2026-06-30-agente-robusto-A-migracion.sql`

- [ ] **Step 1: Crear el archivo SQL**

```sql
-- Sub-proyecto A: separacion asistencia / atencion + paridad de acompanantes.
-- 100% aditivo. No toca el CHECK constraint de rsvp_status. Seguro en prod
-- (el codigo viejo ignora estas columnas).

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attention_reason TEXT;

ALTER TABLE party_members
  ADD COLUMN IF NOT EXISTS allergies JSONB,
  ADD COLUMN IF NOT EXISTS tags JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT;
```

- [ ] **Step 2: Commit del archivo**

```bash
git add docs/superpowers/plans/2026-06-30-agente-robusto-A-migracion.sql
git commit -m "chore(agente): migracion aditiva asistencia atencion y paridad acompanantes"
```

- [ ] **Step 3: GATE — Diego corre el SQL en Supabase y confirma**

No avanzar a Task 2 hasta que Diego confirme que las 5 columnas existen (las queries de los webhooks contra la Supabase compartida fallarían sin ellas).

---

### Task 2: Aplicar la resolución en ambos webhooks

**Files:**
- Modify: `app/api/webhook/whatsapp/route.ts` (bloque `if (interpretation.intent !== 'ambiguous' ...)`)
- Modify: `app/api/webhook/telegram/route.ts` (bloque equivalente dentro de `processTelegramUpdate`)

**Interfaces:**
- Consumes: `resolveRsvpAndAttention` de `@/lib/agent/attention`.

Verificación: manual (I/O Twilio/Telegram/Supabase, no Vitest).

- [ ] **Step 1: WhatsApp — importar y reemplazar la escritura de estatus**

En `app/api/webhook/whatsapp/route.ts`, agregar al bloque de imports:

```ts
import { resolveRsvpAndAttention } from '@/lib/agent/attention'
```

Reemplazar el bloque actual:

```ts
      if (guest.rsvp_status !== interpretation.intent) {
        await supabase
          .from('guests')
          .update({ rsvp_status: interpretation.intent })
          .eq('id', guest.id)
        console.log(`[RSVP] ${guestName}: ${guest.rsvp_status} -> ${interpretation.intent}`)
      }
```

por:

```ts
      const res = resolveRsvpAndAttention(interpretation.intent, text)
      const updates: Record<string, unknown> = {}
      if (res.rsvp && guest.rsvp_status !== res.rsvp) updates.rsvp_status = res.rsvp
      if (res.needsAttention) { updates.needs_attention = true; updates.attention_reason = res.attentionReason }
      if (Object.keys(updates).length > 0) {
        const { error: updErr } = await supabase.from('guests').update(updates).eq('id', guest.id)
        if (updErr) console.error(`[RSVP] update fallo ${guestName}:`, JSON.stringify(updErr))
        else console.log(`[RSVP] ${guestName}:`, JSON.stringify(updates))
      }
```

- [ ] **Step 2: Telegram — importar y reemplazar la escritura de estatus**

En `app/api/webhook/telegram/route.ts`, agregar al bloque de imports:

```ts
import { resolveRsvpAndAttention } from '@/lib/agent/attention'
```

Reemplazar el bloque actual:

```ts
      const { data: guestRow } = await supabase
        .from('guests').select('rsvp_status').eq('id', route.guestId).maybeSingle()
      if (guestRow && guestRow.rsvp_status !== interpretation.intent) {
        await supabase.from('guests').update({ rsvp_status: interpretation.intent }).eq('id', route.guestId)
      }
```

por:

```ts
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
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificación manual (con SQL ya corrido)**

Con el bot @AnfioraEventosbot y el evento de prueba (Olivia & Pedro), enviar por Telegram: "si vamos! soy alergico a mariscos". Verificar en Supabase que el guest queda `rsvp_status = confirmed`... — NOTA: este mensaje clasifica `accion_necesaria` (desempate del clasificador), por lo que en A queda `rsvp_status` **sin cambiar** + `needs_attention = true, attention_reason = 'alergia'`. Para ver el `confirmed` puro, mandar primero "si vamos" (queda `confirmed`) y luego "soy alergico a mariscos" (queda `confirmed` + `needs_attention=true`). Eso prueba el invariante: la atención ya no pisa la asistencia.

> El que un mismo mensaje "si vamos + alergia" termine como `confirmed` + atención (en vez de solo atención) es trabajo del sub-proyecto B (separar asistencia y atención dentro del clasificador). En A basta con que la atención no destruya un `confirmed` ya existente.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhook/whatsapp/route.ts app/api/webhook/telegram/route.ts
git commit -m "feat(agente): webhooks escriben asistencia y atencion por separado, loguean error de update"
```

---

### Task 3: Lista de invitados — bandera de atención + resolver

**Files:**
- Modify: `app/events/[id]/page.tsx` (carga de `guests`, render de fila, acción resolver)

**Interfaces:**
- Consumes: `Guest.needs_attention`, `Guest.attention_reason`, `AttentionReason` de `@/lib/types`.

Verificación: manual (UI).

- [ ] **Step 1: Asegurar que la carga de `guests` trae las columnas nuevas**

Localizar el `supabase.from('guests').select(...)` de la carga principal (`fetchAll` de guests, cerca de la línea 651). Si usa `select('*')`, no se cambia (las columnas nuevas vienen solas). Si enumera columnas, agregar `needs_attention, attention_reason`.

- [ ] **Step 2: Agregar etiqueta legible de razón de atención**

Cerca de `STATUS_LABEL` (línea 17), agregar:

```tsx
const ATTENTION_LABEL: Record<string, string> = {
  alergia: 'Alergia o restriccion',
  peticion: 'Peticion de acompanantes',
  queja: 'Queja',
  duda: 'Duda',
  otro: 'Requiere atencion',
}
```

- [ ] **Step 3: Render del badge en la fila del invitado**

En el render de cada fila de invitado (junto al `StatusPill` / nombre), agregar el indicador condicional:

```tsx
{guest.needs_attention && (
  <span
    className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    style={{ background: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}
    title={ATTENTION_LABEL[guest.attention_reason || 'otro']}
  >
    <AlertTriangle size={12} />
    {ATTENTION_LABEL[guest.attention_reason || 'otro']}
  </span>
)}
```

Asegurar que `AlertTriangle` esté importado de `lucide-react` (agregarlo al import existente de iconos si falta).

- [ ] **Step 4: Acción resolver atención**

Agregar la función (junto a `updatePartyMemberStatus`, ~línea 685):

```tsx
const resolveAttention = async (guestId: string) => {
  setGuests(prev => prev.map(g => g.id === guestId ? { ...g, needs_attention: false, attention_reason: null } : g))
  await supabase.from('guests').update({ needs_attention: false, attention_reason: null }).eq('id', guestId)
}
```

Exponer la acción donde se editan invitados (botón "Resolver" en el modal de detalle del invitado, o en el menú de acciones de la fila), visible solo si `guest.needs_attention`:

```tsx
{editGuest?.needs_attention && (
  <button
    onClick={() => { resolveAttention(editGuest.id); }}
    className="text-sm font-medium"
    style={{ color: '#48C9B0' }}
  >
    Marcar atencion como resuelta
  </button>
)}
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Verificación manual**

`npm run dev` (localhost:3000). En un evento con un invitado que tenga `needs_attention=true` (setearlo a mano en Supabase o vía webhook), confirmar: aparece el badge con la razón; "Marcar atencion como resuelta" lo apaga y desaparece el badge tras refrescar.

- [ ] **Step 7: Commit**

```bash
git add app/events/[id]/page.tsx
git commit -m "feat(invitados): bandera de atencion con razon y accion de resolver"
```

---

### Task 4: Editor de acompañantes — alergias, tags y notas (paridad)

**Files:**
- Modify: `app/events/[id]/page.tsx` (estado `editMembers`, formulario de acompañante en el modal, persistencia en `saveGuest`)

**Interfaces:**
- Consumes: columnas `party_members.allergies/tags/notes` (ya migradas).

Verificación: manual (UI). Esta tarea es separable: puede aterrizar junto con el sub-proyecto B si se quiere acelerar A.

- [ ] **Step 1: Extender la forma de `editMembers`**

Localizar donde se inicializa `editMembers` (~línea 711):

```tsx
setEditMembers(guest.party_members.map(m => ({ id: m.id, name: m.name, phone: m.phone || '', rsvp_status: m.rsvp_status })))
```

cambiar a:

```tsx
setEditMembers(guest.party_members.map(m => ({
  id: m.id, name: m.name, phone: m.phone || '', rsvp_status: m.rsvp_status,
  allergies: m.allergies || [], tags: m.tags || [], notes: m.notes || '',
})))
```

Actualizar el tipo del estado `editMembers` (donde se declara con `useState`) para incluir `allergies: string[]; tags: string[]; notes: string`.

- [ ] **Step 2: Inputs en el formulario de cada acompañante**

En el bloque JSX que renderiza cada miembro de `editMembers` (nombre/teléfono/estatus), agregar debajo, reutilizando el mismo patrón de pills de alergias/tags que usa el titular (componentes `AllergyPills`/`TagPills` o el inline existente):

```tsx
{/* alergias del acompanante */}
<input
  type="text"
  placeholder="Alergias (separadas por coma)"
  value={(m.allergies || []).join(', ')}
  onChange={e => setEditMembers(prev => prev.map((x, i) => i === idx
    ? { ...x, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : x))}
  className="input-base text-sm"
/>
{/* notas del acompanante */}
<input
  type="text"
  placeholder="Notas"
  value={m.notes || ''}
  onChange={e => setEditMembers(prev => prev.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
  className="input-base text-sm"
/>
```

(Mantener consistencia con el estilo Tailwind/inputs vecinos; si el titular usa un selector de pills para tags, replicarlo aquí en vez del input de texto.)

- [ ] **Step 3: Persistir en `saveGuest` (update e insert)**

En `saveGuest` (~línea 741), el update de miembros existentes:

```tsx
for (const m of editMembers.filter(m => m.id)) await supabase.from('party_members').update({ name: m.name, phone: m.phone || null, rsvp_status: m.rsvp_status }).eq('id', m.id!)
```

cambiar a:

```tsx
for (const m of editMembers.filter(m => m.id)) await supabase.from('party_members').update({
  name: m.name, phone: m.phone || null, rsvp_status: m.rsvp_status,
  allergies: m.allergies.length ? m.allergies : null, tags: m.tags.length ? m.tags : null, notes: m.notes || null,
}).eq('id', m.id!)
```

Y el insert de miembros nuevos (~línea 743):

```tsx
if (toInsert.length > 0) await supabase.from('party_members').insert(toInsert.map(m => ({ guest_id: editGuest.id, event_id: id as string, name: m.name, phone: m.phone || null, rsvp_status: m.rsvp_status })))
```

cambiar el objeto a incluir:

```tsx
  allergies: m.allergies.length ? m.allergies : null, tags: m.tags.length ? m.tags : null, notes: m.notes || null,
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 5: Verificación manual**

`npm run dev`. Editar un invitado, agregar a un acompañante una alergia y una nota, guardar, reabrir el modal: los datos persisten. Confirmar en Supabase que la fila de `party_members` tiene `allergies`/`notes`.

- [ ] **Step 6: Commit**

```bash
git add app/events/[id]/page.tsx
git commit -m "feat(invitados): acompanantes con alergias tags y notas"
```

---

## Self-Review

**Spec coverage:**
- Decisión dos capas → Task 1 (resolución pura) + Task 2 (escritura separada). ✓
- Esquema aditivo (guests + party_members) → MIGRACIÓN SQL. ✓
- Tipos → Task 1 Step 1. ✓
- Comportamiento (asistencia en rsvp_status, atención en columnas, sin legacy nuevo, logueo de error) → Task 2. ✓
- Superficies de render (lista de invitados badge + resolver; editor acompañantes) → Task 3, Task 4. ✓ (mesas/dashboard: no requieren cambio, siguen pintando los 6 valores; se omiten por YAGNI.)
- Rollout (SQL antes del código que la usa) → GATE entre Task 1 y Task 2. ✓
- Pruebas Vitest de mapeo intent → (asistencia, atención) → Task 1 Step 2. ✓
- Fuera de alcance B y C → respetado (no aparecen tareas de extracción ni de pipeline). ✓

**Placeholder scan:** sin TBD/TODO; todo paso con código o comando concreto. ✓

**Type consistency:** `AttentionReason` definido en `lib/types.ts`, importado en `attention.ts` y usado en `page.tsx`. `RsvpResolution` con `rsvp/needsAttention/attentionReason` usado idéntico en Task 2. `resolveRsvpAndAttention(intent, text)` misma firma en ambos webhooks. ✓
