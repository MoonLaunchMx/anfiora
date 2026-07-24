# Agente unificado — Fase 2.1 (cambios y correcciones) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el agente pueda declinar acompanantes por nombre y marcar (no auto-cambiar) las correcciones de alergias, sin adivinar.

**Architecture:** Extension aditiva del guardia de Fase 2. La lectura estructurada gana campos para declinaciones explicitas, exclusividad y correccion de alergia; el guardia puro `applyExtraction` los aplica (declinar) o los marca (exclusividad, correccion de alergia). El webhook de Telegram NO cambia (ya enruta extraction -> applyExtraction -> executeWritePlan -> pipeline con appliedSummary).

**Tech Stack:** Next.js 16, TypeScript, @anthropic-ai/sdk 0.91 (tool-use), Supabase, Vitest.

## Global Constraints

- **Construye sobre Fase 2** (en main): `lib/agent/apply.ts`, `lib/agent/extraction.ts`. Rama nueva `feat/agente-fase2.1` desde `main`.
- **Seguridad (decidido):** las alergias NUNCA se auto-borran. Toda correccion/negacion/reasignacion de alergia -> bandera para el organizador, sin tocar datos. (Spec)
- **No adivinar (decidido):** solo se declina a acompanantes nombrados explicitamente. Exclusividad ("solo va X") -> confirma al nombrado + bandera, NO infiere declinaciones. (Spec)
- **Cambios de asistencia** (declinar acompanante nombrado) SI se aplican (bajo riesgo, reversibles). (Spec)
- **Atencion derivada por el codigo:** prioridad `alergia > queja > peticion > duda`. Exclusividad -> `duda`. Correccion de alergia -> `alergia`. (Spec)
- **Solo Telegram.** Sin SQL nuevo (usa `party_members.rsvp_status` y `needs_attention`/`attention_reason`). Reusa `findMember` (match por token).
- Tests Vitest solo para logica pura (`applyExtraction`); `extractFromMessage` y webhook se verifican manual en Telegram (prod). Commits SIN acentos ni enie. Nunca push/merge sin OK de Diego. Claude no toca Supabase.

---

### Task 1: Guardia — declinar acompanantes, exclusividad y correccion de alergia

**Files:**
- Modify: `lib/agent/apply.ts`
- Modify: `lib/agent/apply.test.ts`

**Interfaces:**
- Produces (tipos actualizados): `ExtractionResult.companions` gana `decliningNames: string[]` e `impliesOthersNotComing: boolean`; `ExtractionResult` gana `allergyCorrection: boolean`. `WritePlan.partyMemberUpdates[].rsvp_status` ahora `'confirmed' | 'declined'`. `AppliedSummary` gana `declinedCompanions: number` y `allergyCorrectionFlagged: boolean`.

- [ ] **Step 1: Actualizar los tipos en `lib/agent/apply.ts`**

Reemplazar el bloque de tipos (lineas 3-26) por:

```ts
export type ExtractionResult = {
  attendance: 'confirmed' | 'declined' | 'none'
  companions: {
    action: 'all' | 'none' | 'named' | 'partial_ambiguous'
    names: string[]
    decliningNames: string[]
    impliesOthersNotComing: boolean
  }
  allergies: Array<{ who: 'titular' | 'companion' | 'unknown'; name: string; text: string }>
  allergyCorrection: boolean
  complaint: boolean
  confidence: 'high' | 'medium' | 'low'
}

export type AppliedSummary = {
  confirmedGuest: boolean
  declinedGuest: boolean
  confirmedCompanions: number
  declinedCompanions: number
  capturedAllergies: number
  allergyCorrectionFlagged: boolean
  flagged: AttentionReason | null
}

export type WritePlan = {
  guestUpdate:
    | { rsvp_status?: 'confirmed' | 'declined'; needs_attention?: boolean; attention_reason?: AttentionReason; allergies?: string[] }
    | null
  partyMemberUpdates: Array<{ id: string; rsvp_status?: 'confirmed' | 'declined'; allergies?: string[] }>
  escalations: string[]
  appliedSummary: AppliedSummary
}
```

- [ ] **Step 2: Escribir los tests que fallan** — agregar a `lib/agent/apply.test.ts`

Primero, actualizar el objeto `base` (que hoy no tiene los campos nuevos) para incluir `decliningNames`, `impliesOthersNotComing`, `allergyCorrection`. Cambiar la constante `base`:

```ts
const base: ExtractionResult = {
  attendance: 'none',
  companions: { action: 'none', names: [], decliningNames: [], impliesOthersNotComing: false },
  allergies: [], allergyCorrection: false, complaint: false, confidence: 'high',
}
```

Luego agregar estos casos nuevos al final del archivo:

```ts
describe('applyExtraction — declinar acompanantes (Fase 2.1)', () => {
  const members = [member('m1', 'Olivia Mcdonald'), member('m2', 'Alejandro')]
  it('declina a un acompanante nombrado explicitamente', () => {
    const p = applyExtraction({ ...base, companions: { action: 'none', names: [], decliningNames: ['Olivia'], impliesOthersNotComing: false } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', rsvp_status: 'declined' }])
    expect(p.appliedSummary.declinedCompanions).toBe(1)
  })
  it('nombre a declinar sin match escala peticion', () => {
    const p = applyExtraction({ ...base, companions: { action: 'none', names: [], decliningNames: ['Fulano'], impliesOthersNotComing: false } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.escalations).toContain('peticion')
  })
  it('exclusividad no declina a los demas, solo marca duda', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'named', names: ['Alejandro'], decliningNames: [], impliesOthersNotComing: true } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([{ id: 'm2', rsvp_status: 'confirmed' }])
    expect(p.appliedSummary.declinedCompanions).toBe(0)
    expect(p.guestUpdate?.attention_reason).toBe('duda')
  })
})

describe('applyExtraction — correccion de alergia (Fase 2.1)', () => {
  const members = [member('m1', 'Olivia')]
  it('correccion no escribe alergias, solo marca alergia', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'companion', name: 'Olivia', text: 'gluten' }], allergyCorrection: true }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.allergies).toBeUndefined()
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
    expect(p.appliedSummary.allergyCorrectionFlagged).toBe(true)
    expect(p.appliedSummary.capturedAllergies).toBe(0)
  })
  it('correccion de alergia no bloquea el cambio de asistencia del mismo mensaje', () => {
    const p = applyExtraction({ ...base, companions: { action: 'none', names: [], decliningNames: ['Olivia'], impliesOthersNotComing: false }, allergies: [{ who: 'companion', name: 'Olivia', text: 'nueces' }], allergyCorrection: true }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', rsvp_status: 'declined' }])
    expect(p.appliedSummary.allergyCorrectionFlagged).toBe(true)
  })
})

describe('renderAppliedActions — Fase 2.1', () => {
  it('menciona acompanantes declinados y la correccion de alergia', () => {
    const s = renderAppliedActions({ confirmedGuest: false, declinedGuest: false, confirmedCompanions: 0, declinedCompanions: 1, capturedAllergies: 0, allergyCorrectionFlagged: true, flagged: 'alergia' })
    expect(s).toContain('ya no asistira')
    expect(s).toContain('ajuste sobre una alergia')
  })
})
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npm test -- apply`
Expected: FAIL (campos nuevos no existen / logica no implementada).

- [ ] **Step 4: Implementar la logica en `applyExtraction` y `renderAppliedActions`**

Reemplazar el cuerpo de `applyExtraction` (lineas 47-137) por:

```ts
export function applyExtraction(result: ExtractionResult, guest: ApplyGuest, members: PartyMember[]): WritePlan {
  const escalations: string[] = []
  const guestUpdate: NonNullable<WritePlan['guestUpdate']> = {}
  const memberUpdates = new Map<string, WritePlan['partyMemberUpdates'][number]>()
  const summary: AppliedSummary = {
    confirmedGuest: false, declinedGuest: false, confirmedCompanions: 0, declinedCompanions: 0,
    capturedAllergies: 0, allergyCorrectionFlagged: false, flagged: null,
  }
  const ensure = (id: string) => {
    const cur = memberUpdates.get(id)
    if (cur) return cur
    const o: WritePlan['partyMemberUpdates'][number] = { id }
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

  // Acompanantes: confirmar
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
          const isNew = !memberUpdates.has(found.id)
          ensure(found.id).rsvp_status = 'confirmed'
          if (isNew) summary.confirmedCompanions++
        } else escalations.push('peticion')
      }
      break
    case 'partial_ambiguous':
      escalations.push('peticion')
      break
  }

  // Acompanantes: declinar (nombres explicitos)
  for (const nm of result.companions.decliningNames) {
    const found = findMember(nm, members)
    if (found) {
      const isNew = !memberUpdates.has(found.id)
      ensure(found.id).rsvp_status = 'declined'
      if (isNew) summary.declinedCompanions++
    } else escalations.push('peticion')
  }

  // Exclusividad: no infiere declinaciones, solo marca
  if (result.companions.impliesOthersNotComing) escalations.push('exclusividad')

  // Alergias
  if (result.allergyCorrection) {
    escalations.push('correccion_alergia')
    summary.allergyCorrectionFlagged = true
  } else {
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
  }

  const reason: AttentionReason | null =
    (summary.capturedAllergies > 0 || escalations.includes('alergia') || result.allergyCorrection) ? 'alergia'
    : result.complaint ? 'queja'
    : escalations.includes('peticion') ? 'peticion'
    : escalations.includes('exclusividad') ? 'duda'
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

Y actualizar `renderAppliedActions` para incluir las dos lineas nuevas (agregar despues de la de `confirmedCompanions`):

```ts
  if (applied.declinedCompanions > 0) lines.push(`- Se registro que ${applied.declinedCompanions} acompanante(s) ya no asistira(n).`)
  if (applied.capturedAllergies > 0) lines.push('- Se tomo nota de una alergia o restriccion alimentaria; el organizador la tendra presente.')
  if (applied.allergyCorrectionFlagged) lines.push('- Hay un ajuste sobre una alergia que el organizador revisara.')
```

(La linea de `capturedAllergies` ya existe; asegurar el orden: titular -> declinados -> alergias capturadas -> correccion.)

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npm test -- apply`
Expected: PASS (los 21 previos + los nuevos).

- [ ] **Step 6: tsc**

Run: `npx tsc --noEmit`
Expected: errores ESPERADOS en `lib/agent/extraction.ts` (su FALLBACK no tiene los campos nuevos aun; Task 2 lo arregla). Sin errores nuevos dentro de `lib/agent/apply.ts`.

- [ ] **Step 7: Commit**

```bash
git add lib/agent/apply.ts lib/agent/apply.test.ts
git commit -m "feat(agente): guardia declina acompanantes nombrados + marca exclusividad y correccion de alergia"
```

---

### Task 2: Lectura — esquema de declinaciones, exclusividad y correccion

**Files:**
- Modify: `lib/agent/extraction.ts`

**Interfaces:**
- Consumes: `ExtractionResult` (actualizado en Task 1).

Verificacion: manual (I/O Haiku).

- [ ] **Step 1: Actualizar el `input_schema` del tool `EXTRACTION_TOOL`**

En `companions.properties`, agregar (junto a `action` y `names`):

```ts
          decliningNames: { type: 'array', items: { type: 'string' }, description: 'Nombres de acompanantes que el invitado dice que NO van (ej: "mi esposa Olivia no va"). Vacio si no aplica.' },
          impliesOthersNotComing: { type: 'boolean', description: 'true si el mensaje implica exclusividad ("solo va X", "nada mas va Y") sin nombrar a los que no van.' },
```

Y cambiar `companions.required` a: `['action', 'names', 'decliningNames', 'impliesOthersNotComing']`.

En las propiedades top-level, agregar:

```ts
      allergyCorrection: { type: 'boolean', description: 'true si el mensaje CORRIGE, NIEGA o REASIGNA una alergia ya mencionada ("no es nueces es gluten", "el de las nueces es mi hijo no mi esposa", "quita esa alergia"). En ese caso NO llenes allergies con la correccion.' },
```

Y agregar `allergyCorrection` al `required` top-level (queda `['attendance', 'companions', 'allergies', 'allergyCorrection', 'complaint', 'confidence']`).

- [ ] **Step 2: Actualizar el SYSTEM prompt**

Agregar estas reglas al string `SYSTEM` (dentro de la lista de reglas):

```
- Si dice que un acompanante NO va (ej: "mi esposa Olivia no va"), pon su nombre en companions.decliningNames.
- Si dice que SOLO van ciertas personas sin nombrar a los demas (ej: "solo va mi hijo"), pon companions.impliesOthersNotComing=true y NO adivines quien no va.
- Si el mensaje corrige, niega o reasigna una alergia ya dicha, pon allergyCorrection=true y deja allergies vacio (no metas la correccion como alergia nueva).
```

- [ ] **Step 3: Actualizar el `FALLBACK`**

```ts
const FALLBACK: ExtractionResult = {
  attendance: 'none',
  companions: { action: 'none', names: [], decliningNames: [], impliesOthersNotComing: false },
  allergies: [], allergyCorrection: false, complaint: false, confidence: 'low',
}
```

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (los de Task 1 quedan resueltos con el FALLBACK actualizado). Confirmar que el webhook `app/api/webhook/telegram/route.ts` compila sin cambios (no requiere edicion).

- [ ] **Step 5: Verificacion manual (Telegram, prod tras merge)**

Con @AnfioraEventosbot, evento Olivia & Pedro (Diego con acompanantes Olivia y Alejandro):
1. "Mi esposa Olivia no va" -> Olivia queda `declined` en la lista; la respuesta lo reconoce.
2. "Solo va mi hijo Alejandro" -> Alejandro `confirmed`, Olivia NO cambia por inferencia, bandera de atencion.
3. "No es nueces, es gluten" -> las alergias NO cambian, bandera `alergia`; la respuesta dice que el organizador lo revisa.

- [ ] **Step 6: Commit**

```bash
git add lib/agent/extraction.ts
git commit -m "feat(agente): lectura detecta declinaciones, exclusividad y correccion de alergia"
```

---

### Task 3: Tabla de comportamiento del agente

**Files:**
- Create: `docs/agente-comportamiento.md`

Verificacion: revision de contenido.

- [ ] **Step 1: Crear `docs/agente-comportamiento.md`**

```markdown
# Comportamiento del agente de Anfiora (Telegram)

Referencia unica de "que dice el invitado -> que hace el agente". Todo pasa por el guardia determinista (`lib/agent/apply.ts`): la IA propone, el codigo valida contra la lista real y aplica o marca.

## Asistencia del titular

| El invitado dice | El agente |
|---|---|
| "si voy", "ahi estare" | Confirma al titular (rsvp_status = confirmed) |
| "no voy a poder", "siempre no voy" | Declina al titular (rsvp_status = declined) |
| No menciona su asistencia | No toca la asistencia |

## Acompanantes

| El invitado dice | El agente |
|---|---|
| "vamos todos", "confirmamos todos" | Confirma a TODOS los acompanantes registrados |
| "solo voy yo" | Confirma al titular; los acompanantes quedan pending |
| "voy con Ana" (Ana registrada) | Confirma a Ana |
| "voy con mi primo Luis" (Luis NO registrado) | No crea a Luis; levanta bandera (peticion) |
| "mi esposa Olivia no va" (Olivia registrada) | Declina a Olivia (rsvp_status = declined) |
| "solo va mi hijo" (no nombra a los demas) | Confirma al hijo; NO declina a los demas; levanta bandera (duda) |
| "vamos 2 de 3" (no dice quienes) | No toca acompanantes; levanta bandera (peticion) |

## Alergias

| El invitado dice | El agente |
|---|---|
| "soy alergico a mariscos" | Guarda mariscos en el titular + bandera (alergia) |
| "Ana es vegana" (Ana registrada) | Guarda en la ficha de Ana + bandera |
| "mi esposa es alergica" (sin nombre / no mapeable) | No escribe; levanta bandera (alergia) |
| "no es nueces, es gluten" / "quita esa alergia" / "el de las nueces es mi hijo" | NO cambia alergias (nunca auto-borra); levanta bandera (alergia) para revision humana |

## Otros

| Situacion | El agente |
|---|---|
| Queja ("la organizacion es pesima") | Escala a humano (mensaje de espera) + bandera (queja) |
| Mensaje ambiguo / ininteligible (baja confianza) | No escribe nada; levanta bandera (duda) |
| IA apagada en la conversacion (handoff) | El agente se calla; responde el humano |

## Principios

- **La IA propone, el codigo dispone.** Ninguna escritura al corazon pasa sin el guardia determinista.
- **No adivina.** Nombres se validan contra la lista real; lo ambiguo se marca, no se inventa.
- **Seguridad primero.** Las alergias nunca se auto-borran; toda correccion es bandera humana.
- **Honestidad.** El agente solo afirma acciones que realmente ejecuto.

## Fuera de alcance (por ahora)

- WhatsApp (Fase 4). Panel de configuracion del agente (Fase 3).
- Inferir "mi esposa" -> acompanante especifico sin nombre (casi-humano futuro).
- Editar/borrar alergias por el agente (por diseno: siempre revision humana).
```

- [ ] **Step 2: Commit**

```bash
git add docs/agente-comportamiento.md
git commit -m "docs(agente): tabla de comportamiento del agente (que dice el invitado -> que hace)"
```

---

## Self-Review

**Spec coverage:**
- Declinar acompanantes nombrados -> Task 1 (decliningNames en guardia) + Task 2 (esquema) + tests. ✓
- Exclusividad marca, no infiere -> Task 1 (impliesOthersNotComing -> duda) + tests. ✓
- Correccion de alergia = bandera, no auto-cambio -> Task 1 (allergyCorrection salta escrituras + flag) + Task 2 + tests. ✓
- Cambio de asistencia se aplica aunque haya correccion de alergia -> Task 1 test dedicado. ✓
- Honestidad -> renderAppliedActions con declinados + correccion. ✓
- Webhook sin cambios -> confirmado en Task 2 Step 4. ✓
- Sin SQL nuevo, solo Telegram -> ninguna tarea toca Supabase schema ni WhatsApp. ✓
- Tabla de comportamiento -> Task 3. ✓

**Placeholder scan:** cada paso con codigo o comando concreto. Sin TBD. ✓

**Type consistency:** `ExtractionResult`/`AppliedSummary`/`WritePlan` actualizados en Task 1, esquema+FALLBACK alineados en Task 2. `applyExtraction`/`renderAppliedActions` firmas intactas (solo cambia el contenido de los tipos). `findMember` reusado. ✓

**Riesgo a confirmar en ejecucion:** que `party_members.rsvp_status` acepte `'declined'` en la Supabase compartida (no deberia tener CHECK restrictivo; si lo tuviera, Diego amplia el constraint antes de la verificacion en vivo — mismo patron que el fix de `guests_rsvp_status_check`).
