# Detalle del cambio solicitado (attention_detail) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar el mensaje literal que dispara una atencion en `guests.attention_detail` y mostrarlo truncado bajo la pildora en la lista de invitados.

**Architecture:** Columna nullable aditiva. La funcion pura `applyExtraction` recibe el mensaje entrante y lo escribe junto a `needs_attention` (path agente Telegram); el path legacy WhatsApp lo escribe en su objeto `updates`. La UI lo lee y trunca. Se limpia al resolver la atencion.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Vitest.

## Global Constraints

- Commits convencionales sin acentos ni enie (`fix:`, `feat:`, `docs:`).
- UI en espanol CON acentos (producto MX).
- Solo Tailwind en UI, estilo flat, sin emojis.
- Sin tablas nuevas en Supabase (columna en tabla existente OK).
- `lib/types.ts`: cambio aditivo (campo opcional), no rompe consumidores.
- SECUENCIA DE DESPLIEGUE INVERTIDA: el `ALTER TABLE guests ADD COLUMN attention_detail TEXT;` lo corre Diego en Supabase ANTES de pushear el codigo. El CTO confirma la columna y recien entonces pushea.
- Limite defensivo del detalle: 500 caracteres.

---

### Task 1: `applyExtraction` escribe `attention_detail` (funcion pura, TDD)

**Files:**
- Modify: `lib/agent/apply.ts`
- Test: `lib/agent/apply.test.ts`

**Interfaces:**
- Consumes: `ExtractionResult`, `ApplyGuest`, `PartyMember` (ya existen).
- Produces:
  - `WritePlan['guestUpdate']` gana campo opcional `attention_detail?: string`.
  - Nueva firma: `applyExtraction(result: ExtractionResult, guest: ApplyGuest, members: PartyMember[], incomingMessage?: string): WritePlan` (4to parametro opcional, retrocompatible).
  - Constante modulo: `MAX_ATTENTION_DETAIL = 500`.
  - Regla: cuando el plan pone `guestUpdate.needs_attention = true`, si `incomingMessage` (trim) no es vacio, pone `guestUpdate.attention_detail = incomingMessage.trim().slice(0, 500)`. En turno sin atencion, NO se setea. Con mensaje vacio/ausente, NO se setea.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `lib/agent/apply.test.ts`:

```ts
describe('applyExtraction — attention_detail (Camino B)', () => {
  const members = [member('m1', 'Esposa'), member('m2', 'Hijo')]
  const MSG = 'Hola, oye siempre si va mi esposa'

  it('guarda el mensaje literal cuando marca atencion (peticion)', () => {
    const p = applyExtraction(
      { ...base, companions: { action: 'partial_ambiguous', names: [], decliningNames: [], impliesOthersNotComing: false } },
      guest({ rsvp_status: 'confirmed' }), members, MSG,
    )
    expect(p.guestUpdate?.needs_attention).toBe(true)
    expect(p.guestUpdate?.attention_detail).toBe(MSG)
  })

  it('guarda el mensaje tambien en atencion por baja confianza', () => {
    const p = applyExtraction({ ...base, confidence: 'low' }, guest(), members, MSG)
    expect(p.guestUpdate?.attention_reason).toBe('duda')
    expect(p.guestUpdate?.attention_detail).toBe(MSG)
  })

  it('NO setea detalle en un turno limpio (sin atencion)', () => {
    const p = applyExtraction(
      { ...base, companions: { action: 'named', names: ['Esposa'], decliningNames: [], impliesOthersNotComing: false } },
      guest({ rsvp_status: 'confirmed' }), members, MSG,
    )
    expect(p.guestUpdate?.needs_attention).toBeUndefined()
    expect(p.guestUpdate?.attention_detail).toBeUndefined()
  })

  it('con mensaje vacio no setea detalle aunque marque atencion', () => {
    const p = applyExtraction(
      { ...base, companions: { action: 'partial_ambiguous', names: [], decliningNames: [], impliesOthersNotComing: false } },
      guest({ rsvp_status: 'confirmed' }), members, '   ',
    )
    expect(p.guestUpdate?.needs_attention).toBe(true)
    expect(p.guestUpdate?.attention_detail).toBeUndefined()
  })

  it('recorta mensajes largos a 500 chars', () => {
    const long = 'a'.repeat(800)
    const p = applyExtraction(
      { ...base, companions: { action: 'partial_ambiguous', names: [], decliningNames: [], impliesOthersNotComing: false } },
      guest({ rsvp_status: 'confirmed' }), members, long,
    )
    expect(p.guestUpdate?.attention_detail?.length).toBe(500)
  })

  it('sin el 4to argumento sigue funcionando (retrocompatible)', () => {
    const p = applyExtraction(
      { ...base, companions: { action: 'partial_ambiguous', names: [], decliningNames: [], impliesOthersNotComing: false } },
      guest({ rsvp_status: 'confirmed' }), members,
    )
    expect(p.guestUpdate?.needs_attention).toBe(true)
    expect(p.guestUpdate?.attention_detail).toBeUndefined()
  })
})
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npx --no-install vitest run lib/agent/apply.test.ts`
Expected: FAIL (attention_detail es undefined; el 4to parametro no existe / no se usa).

- [ ] **Step 3: Implementar el minimo en `lib/agent/apply.ts`**

3a. Agregar `attention_detail?: string` al tipo `guestUpdate` de `WritePlan`:

```ts
export type WritePlan = {
  guestUpdate:
    | { rsvp_status?: 'confirmed' | 'declined'; needs_attention?: boolean; attention_reason?: AttentionReason; allergies?: string[]; attention_detail?: string }
    | null
  partyMemberUpdates: Array<{ id: string; rsvp_status?: 'confirmed' | 'declined'; allergies?: string[] }>
  escalations: string[]
  appliedSummary: AppliedSummary
}
```

3b. Agregar la constante bajo el bloque de tipos (cerca de `type ApplyGuest`):

```ts
const MAX_ATTENTION_DETAIL = 500
```

3c. Cambiar la firma y agregar un helper local al inicio del cuerpo de `applyExtraction`:

```ts
export function applyExtraction(result: ExtractionResult, guest: ApplyGuest, members: PartyMember[], incomingMessage?: string): WritePlan {
  const detail = incomingMessage?.trim().slice(0, MAX_ATTENTION_DETAIL) || ''
```

3d. En el early-return de baja confianza, setear el detalle antes de `return`:

```ts
  if (result.confidence === 'low') {
    escalations.push('baja_confianza')
    guestUpdate.needs_attention = true
    guestUpdate.attention_reason = 'duda'
    if (detail) guestUpdate.attention_detail = detail
    summary.flagged = 'duda'
    return { guestUpdate, partyMemberUpdates: [], escalations, appliedSummary: summary }
  }
```

3e. En el bloque final `if (reason) {`, setear el detalle:

```ts
  if (reason) {
    guestUpdate.needs_attention = true
    guestUpdate.attention_reason = reason
    if (detail) guestUpdate.attention_detail = detail
    summary.flagged = reason
  }
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npx --no-install vitest run lib/agent/apply.test.ts`
Expected: PASS (todos, incluidos los 34 previos + los 6 nuevos).

- [ ] **Step 5: Commit**

```bash
git add lib/agent/apply.ts lib/agent/apply.test.ts
git commit -m "feat(agente): applyExtraction guarda attention_detail al marcar atencion"
```

---

### Task 2: Wiring de webhooks (Telegram + WhatsApp)

**Files:**
- Modify: `app/api/webhook/telegram/route.ts`
- Modify: `app/api/webhook/whatsapp/route.ts`

**Interfaces:**
- Consumes: `applyExtraction(..., incomingMessage?)` de Task 1.
- Produces: ambos webhooks escriben `attention_detail` cuando marcan atencion. (Verificacion manual: I/O con Telegram/WhatsApp/Supabase, norma del proyecto.)

- [ ] **Step 1: Telegram — pasar el texto entrante a applyExtraction**

En `app/api/webhook/telegram/route.ts`, la llamada actual:

```ts
    const plan = applyExtraction(
      extraction,
      { rsvp_status: guestRow?.rsvp_status ?? 'pending', allergies: guestRow?.allergies },
      partyMembers ?? [],
    )
```

Cambiar a:

```ts
    const plan = applyExtraction(
      extraction,
      { rsvp_status: guestRow?.rsvp_status ?? 'pending', allergies: guestRow?.allergies },
      partyMembers ?? [],
      update.text,
    )
```

- [ ] **Step 2: WhatsApp — escribir attention_detail en updates**

En `app/api/webhook/whatsapp/route.ts`, el bloque actual (~linea 117-120):

```ts
      const res = resolveRsvpAndAttention(interpretation.intent, text)
      ...
      if (res.needsAttention) { updates.needs_attention = true; updates.attention_reason = res.attentionReason }
```

Cambiar la linea del `if` a:

```ts
      if (res.needsAttention) { updates.needs_attention = true; updates.attention_reason = res.attentionReason; updates.attention_detail = text }
```

- [ ] **Step 3: Typecheck**

Run: `npx --no-install tsc --noEmit`
Expected: sin errores nuevos en los dos route.ts (se permite el ruido de entorno solo si falta alguna dep; en este worktree el arbol esta completo, esperar 0 errores).

- [ ] **Step 4: Commit**

```bash
git add app/api/webhook/telegram/route.ts app/api/webhook/whatsapp/route.ts
git commit -m "feat(webhooks): guardar attention_detail con el mensaje entrante"
```

---

### Task 3: Tipo Guest + limpieza al resolver + render truncado en la lista

**Files:**
- Modify: `lib/types.ts`
- Modify: `app/events/[id]/page.tsx`

**Interfaces:**
- Consumes: `guest.attention_detail` (columna DB) y `applyExtraction`/webhooks de Tasks 1-2.
- Produces: campo en el tipo `Guest`; UI que muestra el detalle truncado en card, tabla y modal; limpieza en `onResolveAttention`. (Verificacion manual: UI, flujo local -> preview.)

- [ ] **Step 1: Agregar el campo al tipo Guest**

En `lib/types.ts`, dentro de la interface/tipo `Guest`, junto a `needs_attention?` y `attention_reason?`:

```ts
  needs_attention?: boolean
  attention_reason?: AttentionReason | null
  attention_detail?: string | null
```

- [ ] **Step 2: Limpiar el detalle al marcar atencion como resuelta**

En `app/events/[id]/page.tsx`, la funcion `onResolveAttention` (hoy ~linea 891-893):

```ts
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, needs_attention: false, attention_reason: null } : g))
    setEditGuest(prev => prev ? { ...prev, needs_attention: false, attention_reason: null } : null)
    await supabase.from('guests').update({ needs_attention: false, attention_reason: null }).eq('id', guestId)
```

Cambiar las tres lineas a incluir `attention_detail: null`:

```ts
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, needs_attention: false, attention_reason: null, attention_detail: null } : g))
    setEditGuest(prev => prev ? { ...prev, needs_attention: false, attention_reason: null, attention_detail: null } : null)
    await supabase.from('guests').update({ needs_attention: false, attention_reason: null, attention_detail: null }).eq('id', guestId)
```

- [ ] **Step 3: Render en la card mobile (SwipeableGuestCard)**

En la card, el bloque de la pildora vive dentro de `<div className="mt-0.5 flex flex-wrap items-center gap-1">`. Justo DESPUES de ese `</div>` (el que cierra la fila de pildora + tags), agregar la linea de detalle:

```tsx
              {guest.needs_attention && guest.attention_detail && (
                <p className="mt-0.5 truncate text-[11px] text-[#888]" title={guest.attention_detail}>
                  {guest.attention_detail}
                </p>
              )}
```

- [ ] **Step 4: Render en la fila de tabla desktop**

En la fila desktop, la pildora `<button ...>` vive dentro del `<div onClick={() => openEdit(guest)} className="flex cursor-pointer items-center gap-1.5 flex-wrap">`. Inmediatamente DESPUES del cierre `</div>` de ese contenedor de nombre+pildora, agregar:

```tsx
                      {guest.needs_attention && guest.attention_detail && (
                        <p className="ml-2 max-w-[280px] truncate text-[11px] text-[#888]" title={guest.attention_detail}>
                          {guest.attention_detail}
                        </p>
                      )}
```

- [ ] **Step 5: Render en el modal de editar (EditGuestModal)**

En `EditGuestModal`, dentro del bloque de atencion existente (`{guest.needs_attention && (` con la clase `mb-4 flex ... rounded-lg border p-3`), reemplazar el contenido para incluir el detalle bajo el label. El bloque actual:

```tsx
        {guest.needs_attention && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border p-3" style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)' }}>
            <AlertTriangle size={14} style={{ color: 'var(--error-text)', flexShrink: 0 }} />
            <span className="flex-1 text-xs" style={{ color: 'var(--error-text)' }}>
              {ATTENTION_LABEL[guest.attention_reason || 'otro']}
            </span>
            <button onClick={onResolveAttention} className="text-xs font-semibold" style={{ color: '#48C9B0' }}>
              Marcar atención como resuelta
            </button>
          </div>
        )}
```

Cambiarlo a (label + detalle con clamp, boton abajo):

```tsx
        {guest.needs_attention && (
          <div className="mb-4 rounded-lg border p-3" style={{ background: 'var(--error-bg)', borderColor: 'var(--error-border)' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: 'var(--error-text)', flexShrink: 0 }} />
              <span className="flex-1 text-xs font-semibold" style={{ color: 'var(--error-text)' }}>
                {ATTENTION_LABEL[guest.attention_reason || 'otro']}
              </span>
              <button onClick={onResolveAttention} className="text-xs font-semibold" style={{ color: '#48C9B0' }}>
                Marcar atención como resuelta
              </button>
            </div>
            {guest.attention_detail && (
              <p className="mt-2 line-clamp-3 text-xs" style={{ color: 'var(--text-sec)' }}>
                “{guest.attention_detail}”
              </p>
            )}
          </div>
        )}
```

- [ ] **Step 6: Typecheck + build**

Run: `npx --no-install tsc --noEmit && npm run build`
Expected: typecheck sin errores; build compila (necesita `.env.local` presente para la fase de page-data; si falta, restaurarlo desde el repo principal solo para el build y borrarlo despues — esta gitignored).

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts "app/events/[id]/page.tsx"
git commit -m "feat(invitados): mostrar attention_detail truncado bajo la pildora"
```

---

## Despliegue (fuera de las tareas de codigo — coordinar con Diego)

1. Diego corre en Supabase prod: `ALTER TABLE guests ADD COLUMN attention_detail TEXT;`
2. CTO confirma la columna (query read-only).
3. CTO rebasa sobre `main` actualizado, corre build + tests, y pushea.
4. Verificacion manual en prod: mandar un mensaje ambiguo por Telegram y ver el detalle en la lista; resolver la atencion y ver que se limpia.

## Self-Review

- **Cobertura del spec:** dato (Task 3 + ALTER), escritura Telegram (Task 1+2), escritura WhatsApp (Task 2), limpieza (Task 3 Step 2), FE 3 lugares (Task 3 Steps 3-5), limite 500 (Task 1), edge mensaje vacio (Task 1), secuencia invertida (seccion Despliegue). Cubierto.
- **Placeholders:** ninguno; todo el codigo es concreto.
- **Consistencia de tipos:** `attention_detail?: string` en `WritePlan.guestUpdate` (Task 1) y `attention_detail?: string | null` en `Guest` (Task 3); el webhook escribe string, la UI lee string|null|undefined — coherente. `MAX_ATTENTION_DETAIL` definido y usado en Task 1.
