# Asientos por persona — Plan de implementacion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada invitado y cada acompanante tenga su propio lugar en Mesas, se pueda sentar, mover y quitar de uno en uno (arrastrando en escritorio, tocando en celular, en lista y en plano) y que Invitados muestre la mesa de cada persona.

**Architecture:** `table_seats` gana `party_member_id`; una fila = una persona. Las filas viejas (una por familia con `party_size = N`) se entienden como "legado" y se expanden a una fila por persona al primer movimiento individual (la app) o de golpe (SQL 2, despues del deploy). Toda la logica de personas, ocupacion, mapa de asientos, operaciones y etiquetas vive pura en `lib/mesas/asientos.ts` con tests; la pagina de Mesas solo pinta y ejecuta ops. Nuevos componentes en `app/events/[id]/mesas/` (panel, modales, menu, chips). DnD con `@dnd-kit/core` solo con `MouseSensor`.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase JS, @dnd-kit/core 6 (ya instalado), Vitest, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-22-asientos-por-persona-design.md`

## Global Constraints

- Rama `fix/fallos-mudos-invitados-mesas` (PR 1) es la base: este trabajo va encima, en la rama `feat/asientos-por-persona` desde ese commit. Worktree `C:\Users\diego\Documents\anfiora-fallos-mudos`.
- Cero `alert()`. Toda escritura pasa por `falloDeEscritura` (`lib/escrituras/fallo.ts`) y `useToast().fallo` (`app/components/ui/Toast.tsx`) con Reintentar. Crear antes de borrar o sobrescribir.
- Copy en espanol de Mexico con acentos en pantalla; commits ASCII (`feat:`/`fix:`), sin acentos.
- UI: Tailwind, teal `#48C9B0` para CTA, negro `#1D1E20` solo filtros, Lucide, sin emojis, "evento" nunca "boda".
- SQL: dos archivos en `docs/superpowers/plans/sql/`. SQL 1 solo agrega y se corre ANTES del deploy (Diego lo corre). SQL 2 se entrega SOLO cuando el deploy este arriba.
- No se toca Supabase desde aqui. No `git push` sin OK de Diego.
- Verificacion: `npx vitest run`, `npx tsc --noEmit`, `npm run build` con el dev server apagado.

---

### Task 1: SQL 1 (antes del deploy) y SQL 2 (despues)

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-22-asientos-1-antes-del-deploy.sql`
- Create: `docs/superpowers/plans/sql/2026-09-22-asientos-2-despues-del-deploy.sql`

**Interfaces:**
- Produces: columna `public.table_seats.party_member_id uuid null`, indices parciales `table_seats_titular_unico` y `table_seats_acompanante_unico`.

- [ ] **Step 1: Escribir SQL 1**

```sql
-- Asientos por persona, paso 1 de 2. SOLO AGREGA: el codigo en produccion
-- ignora la columna nueva y sigue leyendo party_size. Se corre ANTES del
-- deploy del PR "asientos por persona".
--
-- Una fila de table_seats pasa a ser UNA persona:
--   titular      guest_id = X, party_member_id = null
--   acompanante  guest_id = X, party_member_id = M
-- Las filas de hoy (party_member_id null, party_size = N) quedan como
-- "legado" y las expande el paso 2.
--
-- CORRERLO ENTERO DE UN JALON.

BEGIN;

-- 0. Candado: hoy no debe haber dos filas para el mismo invitado.
DO $$
DECLARE dup int;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT guest_id FROM public.table_seats WHERE guest_id IS NOT NULL
    GROUP BY guest_id HAVING count(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE EXCEPTION 'Hay % invitados con mas de un asiento. Revisar antes: SELECT guest_id, count(*) FROM table_seats GROUP BY 1 HAVING count(*) > 1', dup;
  END IF;
END $$;

-- 1. La columna
ALTER TABLE public.table_seats
  ADD COLUMN IF NOT EXISTS party_member_id uuid NULL
  REFERENCES public.party_members(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS table_seats_party_member_idx
  ON public.table_seats(party_member_id);

-- 2. Un lugar por persona
CREATE UNIQUE INDEX IF NOT EXISTS table_seats_titular_unico
  ON public.table_seats(guest_id) WHERE party_member_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS table_seats_acompanante_unico
  ON public.table_seats(party_member_id) WHERE party_member_id IS NOT NULL;

COMMIT;

-- Verificacion (debe dar una fila con party_member_id y dos indices):
-- SELECT column_name, is_nullable FROM information_schema.columns
--  WHERE table_name = 'table_seats' AND column_name = 'party_member_id';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'table_seats'
--    AND indexname IN ('table_seats_titular_unico','table_seats_acompanante_unico');
```

- [ ] **Step 2: Escribir SQL 2**

```sql
-- Asientos por persona, paso 2 de 2. Se corre DESPUES de que el deploy este
-- arriba. Expande cada familia "legado" (una fila con party_size = N) a una
-- fila por acompanante en la misma mesa y deja al titular en party_size = 1.
-- Es lo mismo que hace la app al primer movimiento individual: aqui de golpe.
--
-- Idempotente: un acompanante que ya tiene fila no se duplica (indice unico).

BEGIN;

DO $$
DECLARE
  fila record;
  m record;
  siguiente int;
BEGIN
  FOR fila IN
    SELECT s.id, s.table_id, s.event_id, s.guest_id
      FROM public.table_seats s
     WHERE s.party_member_id IS NULL
       AND s.guest_id IS NOT NULL
       AND s.party_size > 1
       AND NOT EXISTS (SELECT 1 FROM public.table_seats x
                        WHERE x.guest_id = s.guest_id AND x.party_member_id IS NOT NULL)
  LOOP
    SELECT coalesce(max(seat_number), 0) INTO siguiente
      FROM public.table_seats WHERE table_id = fila.table_id;
    FOR m IN SELECT id FROM public.party_members WHERE guest_id = fila.guest_id ORDER BY created_at, id
    LOOP
      siguiente := siguiente + 1;
      INSERT INTO public.table_seats (table_id, event_id, guest_id, party_member_id, seat_number, party_size)
      VALUES (fila.table_id, fila.event_id, fila.guest_id, m.id, siguiente, 1)
      ON CONFLICT DO NOTHING;
    END LOOP;
    -- Crear antes de sobrescribir: el titular baja a 1 solo despues de los inserts.
    UPDATE public.table_seats SET party_size = 1 WHERE id = fila.id;
  END LOOP;
END $$;

COMMIT;

-- Verificacion: cero filas legado.
-- SELECT count(*) AS legado FROM public.table_seats
--  WHERE party_member_id IS NULL AND party_size > 1;
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-22-asientos-1-antes-del-deploy.sql docs/superpowers/plans/sql/2026-09-22-asientos-2-despues-del-deploy.sql
git commit -m "docs(sql): asientos por persona, columna y expansion de familias"
```

---

### Task 2: Tipos y logica pura de asientos

**Files:**
- Modify: `lib/types.ts` (tipo `TableSeat`, ~linea 411)
- Create: `lib/mesas/asientos.ts`
- Test: `lib/mesas/asientos.test.ts`

**Interfaces:**
- Produces:
```ts
export type Persona = { clave: string; guestId: string; memberId: string | null; nombre: string; titular: string | null; rsvp: string; checkedIn: boolean }
export type Fila = { id: string; table_id: string; event_id: string; guest_id: string | null; party_member_id: string | null; party_size: number; seat_number: number }
export type Lugar = { seatId: string; tableId: string; legado: boolean }
export type Op =
  | { kind: 'insert'; row: { table_id: string; event_id: string; guest_id: string; party_member_id: string | null; seat_number: number; party_size: 1 } }
  | { kind: 'mover'; seatId: string; table_id: string; seat_number: number }
  | { kind: 'encoger'; seatId: string }   // party_size -> 1
  | { kind: 'delete'; seatId: string }
export function claveDe(guestId: string, memberId: string | null): string
export function personasDe(guests: { id: string; name: string; rsvp_status: string; checked_in: boolean; party_members: { id: string; name: string; rsvp_status: string; checked_in: boolean }[] }[]): Persona[]
export function esLegado(fila: Fila, filas: Fila[]): boolean
export function mapaAsientos(filas: Fila[], personas: Persona[]): Map<string, Lugar>
export function ocupacionDe(tableId: string, filas: Fila[]): number
export function personasEnMesa(tableId: string, filas: Fila[], personas: Persona[]): Persona[]
export function opsExpandir(guestId: string, filas: Fila[], personas: Persona[]): Op[]
export function opsSentar(persona: Persona, tableId: string, eventId: string, filas: Fila[], personas: Persona[]): Op[]
export function opsQuitar(persona: Persona, filas: Fila[], personas: Persona[]): Op[]
export function etiquetaSeparado(persona: Persona, mapa: Map<string, Lugar>, personas: Persona[], numeroDeMesa: (tableId: string) => number): string | null
```

- [ ] **Step 1: Agregar campos al tipo `TableSeat` en `lib/types.ts`**

```ts
export type TableSeat = {
  id: string
  table_id: string
  event_id: string
  seat_number: number
  guest_id: string | null
  party_member_id?: string | null
  party_size?: number
  created_at: string
  guest?: Pick<Guest, 'id' | 'name' | 'rsvp_status'>
}
```

- [ ] **Step 2: Escribir los tests**

```ts
import { describe, it, expect } from 'vitest'
import { personasDe, esLegado, mapaAsientos, ocupacionDe, personasEnMesa, opsExpandir, opsSentar, opsQuitar, etiquetaSeparado, claveDe, type Fila } from './asientos'

const guests = [
  { id: 'g1', name: 'Diego Garza', rsvp_status: 'confirmed', checked_in: false, party_members: [
    { id: 'm1', name: 'Carmen Rodríguez', rsvp_status: 'confirmed', checked_in: false },
    { id: 'm2', name: 'Ximena Garza', rsvp_status: 'pending', checked_in: false },
  ] },
  { id: 'g2', name: 'Rosa Garza', rsvp_status: 'confirmed', checked_in: true, party_members: [] },
]
const personas = personasDe(guests)
const fila = (p: Partial<Fila> & { id: string; table_id: string }): Fila => ({ event_id: 'e', guest_id: 'g1', party_member_id: null, party_size: 1, seat_number: 1, ...p })

describe('personasDe', () => {
  it('una persona por titular y por acompanante, con clave y titular', () => {
    expect(personas.map(p => p.clave)).toEqual(['g1', 'm1', 'm2', 'g2'])
    expect(personas[1]).toMatchObject({ guestId: 'g1', memberId: 'm1', titular: 'Diego Garza', nombre: 'Carmen Rodríguez' })
    expect(personas[0].titular).toBeNull()
    expect(claveDe('g1', 'm1')).toBe('m1')
  })
})

describe('esLegado', () => {
  it('fila de titular con party_size > 1 y sin filas de acompanantes', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 })]
    expect(esLegado(filas[0], filas)).toBe(true)
  })
  it('deja de ser legado en cuanto un acompanante tiene fila', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 }), fila({ id: 's2', table_id: 't2', party_member_id: 'm1' })]
    expect(esLegado(filas[0], filas)).toBe(false)
  })
})

describe('mapaAsientos y ocupacion', () => {
  it('una fila legado sienta a toda la familia y cuenta N', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 })]
    const mapa = mapaAsientos(filas, personas)
    expect(mapa.get('g1')).toEqual({ seatId: 's1', tableId: 't1', legado: true })
    expect(mapa.get('m2')).toEqual({ seatId: 's1', tableId: 't1', legado: true })
    expect(ocupacionDe('t1', filas)).toBe(3)
  })
  it('filas por persona cuentan 1 cada una', () => {
    const filas = [fila({ id: 's1', table_id: 't1' }), fila({ id: 's2', table_id: 't2', party_member_id: 'm1' })]
    expect(ocupacionDe('t1', filas)).toBe(1)
    expect(ocupacionDe('t2', filas)).toBe(1)
    expect(mapaAsientos(filas, personas).get('m2')).toBeUndefined()
    expect(personasEnMesa('t2', filas, personas).map(p => p.clave)).toEqual(['m1'])
  })
})

describe('opsExpandir', () => {
  it('inserta una fila por acompanante en la misma mesa y luego encoge al titular', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3, seat_number: 4 })]
    const ops = opsExpandir('g1', filas, personas)
    expect(ops).toEqual([
      { kind: 'insert', row: { table_id: 't1', event_id: 'e', guest_id: 'g1', party_member_id: 'm1', seat_number: 5, party_size: 1 } },
      { kind: 'insert', row: { table_id: 't1', event_id: 'e', guest_id: 'g1', party_member_id: 'm2', seat_number: 6, party_size: 1 } },
      { kind: 'encoger', seatId: 's1' },
    ])
  })
  it('sin fila legado no hace nada', () => {
    expect(opsExpandir('g1', [fila({ id: 's1', table_id: 't1' })], personas)).toEqual([])
  })
})

describe('opsSentar', () => {
  it('persona sin lugar: un insert con el siguiente numero de la mesa destino', () => {
    const filas = [fila({ id: 's9', table_id: 't2', guest_id: 'g2', seat_number: 2 })]
    expect(opsSentar(personas[1], 't2', 'e', filas, personas)).toEqual([
      { kind: 'insert', row: { table_id: 't2', event_id: 'e', guest_id: 'g1', party_member_id: 'm1', seat_number: 3, party_size: 1 } },
    ])
  })
  it('persona ya sentada: un solo mover, nunca borrar y crear', () => {
    const filas = [fila({ id: 's2', table_id: 't1', party_member_id: 'm1' })]
    expect(opsSentar(personas[1], 't2', 'e', filas, personas)).toEqual([{ kind: 'mover', seatId: 's2', table_id: 't2', seat_number: 1 }])
  })
  it('acompanante de familia legado: primero expande, luego mueve su fila nueva', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 })]
    const ops = opsSentar(personas[2], 't2', 'e', filas, personas)
    expect(ops.map(o => o.kind)).toEqual(['insert', 'insert', 'encoger', 'mover'])
    expect(ops[3]).toEqual({ kind: 'mover', seatId: 'nuevo:m2', table_id: 't2', seat_number: 1 })
  })
})

describe('opsQuitar', () => {
  it('persona con fila: un delete', () => {
    const filas = [fila({ id: 's2', table_id: 't1', party_member_id: 'm1' })]
    expect(opsQuitar(personas[1], filas, personas)).toEqual([{ kind: 'delete', seatId: 's2' }])
  })
  it('titular de familia legado: expande y borra solo su fila', () => {
    const filas = [fila({ id: 's1', table_id: 't1', party_size: 3 })]
    const ops = opsQuitar(personas[0], filas, personas)
    expect(ops.map(o => o.kind)).toEqual(['insert', 'insert', 'encoger', 'delete'])
    expect(ops[3]).toEqual({ kind: 'delete', seatId: 's1' })
  })
})

describe('etiquetaSeparado', () => {
  const num = (t: string) => ({ t1: 2, t2: 5 }[t] ?? 0)
  it('nada cuando la familia esta junta o sin mesa', () => {
    const mapa = mapaAsientos([fila({ id: 's1', table_id: 't1', party_size: 3 })], personas)
    expect(etiquetaSeparado(personas[0], mapa, personas, num)).toBeNull()
    expect(etiquetaSeparado(personas[1], mapa, personas, num)).toBeNull()
    expect(etiquetaSeparado(personas[3], new Map(), personas, num)).toBeNull()
  })
  it('acompanante en otra mesa que su titular: la mesa del titular', () => {
    const mapa = mapaAsientos([fila({ id: 's1', table_id: 't1' }), fila({ id: 's2', table_id: 't2', party_member_id: 'm1' })], personas)
    expect(etiquetaSeparado(personas[1], mapa, personas, num)).toBe('Mesa 2')
    expect(etiquetaSeparado(personas[0], mapa, personas, num)).toBe('+1 en Mesa 5')
  })
  it('titular con acompanantes en varias mesas', () => {
    const mapa = mapaAsientos([fila({ id: 's1', table_id: 't1' }), fila({ id: 's2', table_id: 't2', party_member_id: 'm1' }), fila({ id: 's3', table_id: 't3', party_member_id: 'm2' })], personas)
    expect(etiquetaSeparado(personas[0], mapa, personas, num)).toBe('+2 en otras mesas')
  })
})
```

- [ ] **Step 3: Correr y ver que falla**

Run: `npx vitest run lib/mesas`
Expected: FAIL, `./asientos` no existe.

- [ ] **Step 4: Implementar `lib/mesas/asientos.ts`**

```ts
// Una fila de table_seats es UNA persona. Las filas "legado" (una por familia
// con party_size = N, lo que habia antes) se entienden aqui y se expanden a
// una fila por persona al primer movimiento individual. Nada en este archivo
// toca la base: solo describe operaciones que la pagina ejecuta en orden.

export type Persona = { clave: string; guestId: string; memberId: string | null; nombre: string; titular: string | null; rsvp: string; checkedIn: boolean }
export type Fila = { id: string; table_id: string; event_id: string; guest_id: string | null; party_member_id: string | null; party_size: number; seat_number: number }
export type Lugar = { seatId: string; tableId: string; legado: boolean }
export type Op =
  | { kind: 'insert'; row: { table_id: string; event_id: string; guest_id: string; party_member_id: string | null; seat_number: number; party_size: 1 } }
  | { kind: 'mover'; seatId: string; table_id: string; seat_number: number }
  | { kind: 'encoger'; seatId: string }
  | { kind: 'delete'; seatId: string }

type GuestLike = { id: string; name: string; rsvp_status: string; checked_in: boolean; party_members: { id: string; name: string; rsvp_status: string; checked_in: boolean }[] }

export const claveDe = (guestId: string, memberId: string | null) => memberId ?? guestId

export function personasDe(guests: GuestLike[]): Persona[] {
  const out: Persona[] = []
  for (const g of guests) {
    out.push({ clave: g.id, guestId: g.id, memberId: null, nombre: g.name, titular: null, rsvp: g.rsvp_status, checkedIn: !!g.checked_in })
    for (const m of g.party_members) out.push({ clave: m.id, guestId: g.id, memberId: m.id, nombre: m.name || 'Acompañante', titular: g.name, rsvp: m.rsvp_status, checkedIn: !!m.checked_in })
  }
  return out
}

export function esLegado(fila: Fila, filas: Fila[]): boolean {
  if (fila.party_member_id || !fila.guest_id || fila.party_size <= 1) return false
  return !filas.some(f => f.guest_id === fila.guest_id && f.party_member_id)
}

export function mapaAsientos(filas: Fila[], personas: Persona[]): Map<string, Lugar> {
  const mapa = new Map<string, Lugar>()
  for (const f of filas) {
    if (!f.guest_id) continue
    if (f.party_member_id) { mapa.set(f.party_member_id, { seatId: f.id, tableId: f.table_id, legado: false }); continue }
    const legado = esLegado(f, filas)
    mapa.set(f.guest_id, { seatId: f.id, tableId: f.table_id, legado })
    if (legado) for (const p of personas) if (p.guestId === f.guest_id && p.memberId) mapa.set(p.clave, { seatId: f.id, tableId: f.table_id, legado: true })
  }
  return mapa
}

export function ocupacionDe(tableId: string, filas: Fila[]): number {
  return filas.filter(f => f.table_id === tableId).reduce((n, f) => n + (esLegado(f, filas) ? f.party_size : 1), 0)
}

export function personasEnMesa(tableId: string, filas: Fila[], personas: Persona[]): Persona[] {
  const mapa = mapaAsientos(filas, personas)
  return personas.filter(p => mapa.get(p.clave)?.tableId === tableId)
}

function siguienteAsiento(tableId: string, filas: Fila[], reservados: number): number {
  return filas.filter(f => f.table_id === tableId).reduce((m, f) => Math.max(m, f.seat_number), 0) + 1 + reservados
}

// Id provisional de una fila que se inserta en esta misma tanda de ops. El
// ejecutor lo sustituye por el id real que devuelve el insert.
export const idNuevo = (memberId: string) => 'nuevo:' + memberId

export function opsExpandir(guestId: string, filas: Fila[], personas: Persona[]): Op[] {
  const titular = filas.find(f => f.guest_id === guestId && !f.party_member_id)
  if (!titular || !esLegado(titular, filas)) return []
  const ops: Op[] = []
  let i = 0
  for (const p of personas) {
    if (p.guestId !== guestId || !p.memberId) continue
    ops.push({ kind: 'insert', row: { table_id: titular.table_id, event_id: titular.event_id, guest_id: guestId, party_member_id: p.memberId, seat_number: siguienteAsiento(titular.table_id, filas, i), party_size: 1 } })
    i++
  }
  ops.push({ kind: 'encoger', seatId: titular.id })
  return ops
}

function lugarTrasExpandir(persona: Persona, filas: Fila[], expansion: Op[]): { seatId: string; tableId: string } | null {
  const propia = filas.find(f => persona.memberId ? f.party_member_id === persona.memberId : (f.guest_id === persona.guestId && !f.party_member_id))
  if (propia) return { seatId: propia.id, tableId: propia.table_id }
  const nueva = expansion.find(o => o.kind === 'insert' && o.row.party_member_id === persona.memberId)
  if (nueva && nueva.kind === 'insert') return { seatId: idNuevo(persona.memberId!), tableId: nueva.row.table_id }
  return null
}

export function opsSentar(persona: Persona, tableId: string, eventId: string, filas: Fila[], personas: Persona[]): Op[] {
  const expansion = opsExpandir(persona.guestId, filas, personas)
  const lugar = lugarTrasExpandir(persona, filas, expansion)
  if (lugar && lugar.tableId === tableId && expansion.length === 0) return []
  if (lugar) return [...expansion, { kind: 'mover', seatId: lugar.seatId, table_id: tableId, seat_number: siguienteAsiento(tableId, filas, 0) }]
  return [{ kind: 'insert', row: { table_id: tableId, event_id: eventId, guest_id: persona.guestId, party_member_id: persona.memberId, seat_number: siguienteAsiento(tableId, filas, 0), party_size: 1 } }]
}

export function opsQuitar(persona: Persona, filas: Fila[], personas: Persona[]): Op[] {
  const expansion = opsExpandir(persona.guestId, filas, personas)
  const lugar = lugarTrasExpandir(persona, filas, expansion)
  if (!lugar) return []
  return [...expansion, { kind: 'delete', seatId: lugar.seatId }]
}

export function etiquetaSeparado(persona: Persona, mapa: Map<string, Lugar>, personas: Persona[], numeroDeMesa: (tableId: string) => number): string | null {
  const mio = mapa.get(persona.clave)
  if (!mio) return null
  if (persona.memberId) {
    const titular = mapa.get(persona.guestId)
    if (!titular || titular.tableId === mio.tableId) return null
    return 'Mesa ' + numeroDeMesa(titular.tableId)
  }
  const fuera = personas.filter(p => p.guestId === persona.guestId && p.memberId).map(p => mapa.get(p.clave)).filter((l): l is Lugar => !!l && l.tableId !== mio.tableId)
  if (fuera.length === 0) return null
  const mesas = new Set(fuera.map(l => l.tableId))
  return '+' + fuera.length + (mesas.size === 1 ? ' en Mesa ' + numeroDeMesa(fuera[0].tableId) : ' en otras mesas')
}
```

- [ ] **Step 5: Correr los tests**

Run: `npx vitest run lib/mesas`
Expected: PASS (13 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/mesas/asientos.ts lib/mesas/asientos.test.ts
git commit -m "feat(mesas): logica pura de asientos por persona con filas legado"
```

---

### Task 3: Ejecutor de ops contra Supabase

**Files:**
- Create: `lib/mesas/ejecutar.ts`

**Interfaces:**
- Consumes: `Op`, `idNuevo` de Task 2; `falloDeEscritura`, `Fallo` de `lib/escrituras/fallo.ts`.
- Produces: `export async function ejecutarOps(supabase: SupabaseClient, ops: Op[]): Promise<Fallo | null>`

- [ ] **Step 1: Implementar**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { falloDeEscritura, type Fallo } from '@/lib/escrituras/fallo'
import type { Op } from './asientos'

// Corre las ops en orden y se detiene en la primera que no entra. Los inserts
// devuelven su id y sustituyen los ids provisionales ('nuevo:<memberId>') de
// las ops que siguen, para que expandir + mover sea una sola tanda.
export async function ejecutarOps(supabase: SupabaseClient, ops: Op[]): Promise<Fallo | null> {
  const reales = new Map<string, string>()
  const idDe = (seatId: string) => reales.get(seatId) ?? seatId
  for (const op of ops) {
    if (op.kind === 'insert') {
      const r = await supabase.from('table_seats').insert(op.row).select('id')
      const f = falloDeEscritura(r, 1)
      if (f) return f
      if (op.row.party_member_id) reales.set('nuevo:' + op.row.party_member_id, (r.data as { id: string }[])[0].id)
    } else if (op.kind === 'mover') {
      const f = falloDeEscritura(await supabase.from('table_seats').update({ table_id: op.table_id, seat_number: op.seat_number }).eq('id', idDe(op.seatId)).select('id'))
      if (f) return f
    } else if (op.kind === 'encoger') {
      const f = falloDeEscritura(await supabase.from('table_seats').update({ party_size: 1 }).eq('id', idDe(op.seatId)).select('id'))
      if (f) return f
    } else {
      const f = falloDeEscritura(await supabase.from('table_seats').delete().eq('id', idDe(op.seatId)).select('id'))
      if (f) return f
    }
  }
  return null
}
```

- [ ] **Step 2: `npx tsc --noEmit` limpio y commit**

```bash
git add lib/mesas/ejecutar.ts
git commit -m "feat(mesas): ejecutor de ops de asientos con ids provisionales"
```

---

### Task 4: Los otros lectores de `table_seats`

**Files:**
- Modify: `app/events/[id]/mensajes/page.tsx:829-833`
- Modify: `lib/agent/context-pack.ts:47-51`
- Modify: `lib/guests/delete.ts` (sin cambio: las filas de acompanante llevan `guest_id` y se borran con el invitado; solo confirmar)

- [ ] **Step 1: En ambos, la consulta del titular pasa a filtrar la fila del titular**

`mensajes/page.tsx`:
```ts
    supabase
      .from('table_seats')
      .select('tables(name, number)')
      .eq('guest_id', guestId)
      .is('party_member_id', null)
      .maybeSingle()
```
`lib/agent/context-pack.ts`:
```ts
    supabase
      .from('table_seats')
      .select('tables(name, number)')
      .eq('guest_id', guestId)
      .is('party_member_id', null)
      .maybeSingle(),
```

- [ ] **Step 2: Commit**

```bash
git add "app/events/[id]/mensajes/page.tsx" lib/agent/context-pack.ts
git commit -m "fix(mesas): el asistente y mensajes leen solo la fila del titular"
```

---

### Task 5: Invitados muestra la mesa de cada persona

**Files:**
- Modify: `app/events/[id]/page.tsx` — `GuestTableInfo` (~245), carga en `loadGuests` (~831-860), `guestTableMap` usos (760, 1459, 1514, 1543, 1572, 1603, 1955)

**Interfaces:**
- Consumes: `mapaAsientos`, `personasDe`, `Fila` de Task 2.

- [ ] **Step 1: Cargar filas completas y construir el mapa por persona**

En `loadGuests`, la consulta de asientos pasa a traer las columnas de `Fila`:
```ts
      fetchAll<Fila>((f, t) =>
        supabase.from('table_seats').select('id, table_id, event_id, guest_id, party_member_id, party_size, seat_number').eq('event_id', id).order('id').range(f, t)),
```
y el mapa:
```ts
    const tableById = new Map((tablesData || []).map(t => [t.id, t]))
    const personas = personasDe(guestsData.map(g => ({ ...g, checked_in: !!g.checked_in, party_members: membersByGuest.get(g.id) || [] })))
    const seatMap = new Map<string, GuestTableInfo>()
    for (const [clave, lugar] of mapaAsientos(seatsData, personas)) {
      const table = tableById.get(lugar.tableId)
      if (table) seatMap.set(clave, { tableNumber: table.number, tableName: table.name })
    }
    setGuestTableMap(seatMap)
```
El mapa queda indexado por `clave` (id del acompanante o del invitado), asi que `guestTableMap.get(g.id)` sigue funcionando para titulares.

- [ ] **Step 2: Acompanantes en columna, filtro y Excel**

- Linea 1514: `member: m => { const t = guestTableMap.get(m.id); return t ? \`Mesa ${t.tableNumber}\` : '' }`
- Linea 760 (filtro `table`): un invitado pasa el filtro si el o cualquiera de sus acompanantes esta en esa mesa:
```ts
          case 'table': { const mesas = [g.id, ...g.party_members.map(m => m.id)].map(k => guestTableMap.get(k)).filter(Boolean).map(t => `Mesa ${t!.tableNumber}`); return mesas.includes(f.value) }
```
- Linea 1603 (valores del filtro): incluir claves de acompanantes: `guests.flatMap(g => [g.id, ...g.party_members.map(m => m.id)]).map(k => ...)`.
- Excel (1543): agregar por acompanante su mesa en la columna `'Acompañantes'`: `g.party_members.map(m => (m.name || 'Acompañante') + (guestTableMap.get(m.id) ? ' (Mesa ' + guestTableMap.get(m.id)!.tableNumber + ')' : '')).join(', ')`.
- Fila de acompanante en la tabla (buscar donde se pinta `m.name` en las filas satelite, cerca de 1994-2010): agregar el mismo chip de mesa que el titular usando `getTableLabel(m.id)`.

- [ ] **Step 3: `npx tsc --noEmit` y commit**

```bash
git add "app/events/[id]/page.tsx"
git commit -m "feat(invitados): cada acompanante muestra su propia mesa"
```

---

### Task 6: Mesas lee y pinta por persona

**Files:**
- Modify: `app/events/[id]/mesas/page.tsx` — tipos (137-145), `getSeatColors` (170-182), `loadData`/`loadTables` (1316-1352), `getOccupied`/`gSeatMap` (1356-1361), stats (1363), `handleEditSave` capacidad (1373-1391, 1434-1437), `TableDetailModal` (464-500), lista escritorio (1744-1770), cards celular (1790-1810), `handlePrint` (1534).

**Interfaces:**
- Consumes: Task 2 y 3.
- Produces (estado de pagina que usan Tasks 7-10): `personas: Persona[]`, `filas: Fila[]`, `mapa: Map<string, Lugar>`, `ocupacion(tableId)`, `enMesa(tableId): Persona[]`, `sinMesa: Persona[]`, `numeroDeMesa(tableId)`.

- [ ] **Step 1: Estado derivado**

Tras `setTables(...)` en `loadData` y `loadTables`, guardar las filas crudas: `setFilas((sR.data||[]) as Fila[])`. Y con `useMemo`:
```ts
  const personas = useMemo(() => personasDe(guests), [guests])
  const mapa = useMemo(() => mapaAsientos(filas, personas), [filas, personas])
  const ocupacion = useCallback((tableId: string) => ocupacionDe(tableId, filas), [filas])
  const enMesa = useCallback((tableId: string) => personasEnMesa(tableId, filas, personas), [filas, personas])
  const sinMesa = useMemo(() => personas.filter(p => !mapa.has(p.clave)), [personas, mapa])
  const numeroDeMesa = useCallback((tableId: string) => tables.find(t => t.id === tableId)?.number ?? 0, [tables])
```
`getOccupied(t)` pasa a `ocupacion(t.id)`; `gSeatMap` se elimina y sus usos pasan a `mapa`. Las stats: `unassigned = sinMesa.filter(p => p.rsvp === 'confirmed').length`; "Confirmados" cuenta personas confirmadas.

- [ ] **Step 2: Pintar por persona**

En `TableDetailModal`, lista escritorio y cards celular, cambiar el `table.seats.map(seat => seat.guest ...)` por `enMesa(table.id).map(p => ...)`: una fila por persona con `p.nombre`, chip gris `de {p.titular}` cuando `p.memberId`, chip ambar `etiquetaSeparado(p, mapa, personas, numeroDeMesa)` cuando no es null, estatus por `STATUS_COLORS[p.rsvp]`, check-in por persona (`toggleCheckin` si `!p.memberId`, `toggleMemberCheckin` si `p.memberId`), boton X → `quitarPersona(p)` (Task 7) y en celular el toque abre `PersonaMenu` (Task 7). Las filas satelite de acompanantes desaparecen: cada quien es su fila.

`getSeatColors(table, i)` pasa a `enMesa(table.id)[i]?.rsvp` (ya no hereda el estatus del titular). `TableSVG` recibe `ocupados: Persona[]` en vez de calcular.

`handlePrint`: por mesa, `enMesa(t.id)` una fila cada uno, con "de {titular}" en la columna nombre.

- [ ] **Step 3: Editar invitado ya no valida capacidad ni toca `table_seats`**

Borrar el bloque `if (seatRecord) {...}` de validacion (1373-1391) y el `update({ party_size })` (1434-1437). Un acompanante nuevo nace sin mesa y aparece en el panel.

- [ ] **Step 4: `npx tsc --noEmit`, `npx vitest run`, commit**

```bash
git add "app/events/[id]/mesas/page.tsx"
git commit -m "feat(mesas): la pagina lee y pinta un lugar por persona"
```

---

### Task 7: Acciones y flujos de toque (Asignar, Mover, Quitar)

**Files:**
- Create: `app/events/[id]/mesas/ModalAsignar.tsx` (sustituye la funcion interna `ModalAsignar`, 1146-1201)
- Create: `app/events/[id]/mesas/ModalElegirMesa.tsx` (sustituye `ModalMover`, 1203-1221)
- Create: `app/events/[id]/mesas/PersonaMenu.tsx`
- Modify: `app/events/[id]/mesas/page.tsx` — `doAssign`, `handleSelectGuest`, `handleMove`, `moverAsiento`, `removeGuest`, `quitarDeMesa` (1485-1545) se reemplazan por las acciones de abajo.

**Interfaces:**
- Produces en la pagina:
```ts
  const sentarPersonas = async (claves: string[], tableId: string): Promise<boolean>   // sienta o mueve, en orden, con expansion
  const quitarPersona = async (p: Persona): Promise<boolean>
```
- `ModalAsignar` props: `{ table: TableRecord | null; personas: Persona[]; mapa: Map<string, Lugar>; ocupacion: (id: string) => number; numeroDeMesa: (id: string) => number; onSentar: (claves: string[]) => Promise<boolean>; onClose: () => void }`
- `ModalElegirMesa` props: `{ abierto: { personas: Persona[]; titulo: string } | null; tables: TableRecord[]; ocupacion: (id: string) => number; mapa: Map<string, Lugar>; onElegir: (tableId: string) => Promise<boolean>; onClose: () => void }`
- `PersonaMenu` props: `{ persona: Persona | null; onMover: () => void; onVer: () => void; onQuitar: () => void; onClose: () => void }`

- [ ] **Step 1: Acciones en la pagina**

```ts
  const sentarPersonas = async (claves: string[], tableId: string): Promise<boolean> => {
    if (!permiso.editar) return false
    const t = tables.find(x => x.id === tableId); if (!t) return false
    const gente = claves.map(c => personas.find(p => p.clave === c)).filter((p): p is Persona => !!p)
    const nuevos = gente.filter(p => mapa.get(p.clave)?.tableId !== tableId).length
    if (nuevos > t.capacity - ocupacion(tableId)) {
      await loadTables()
      toast.error({ titulo: `La Mesa ${t.number} ya no tiene lugar para ${nuevos}`, detalle: 'Alguien más la ocupó. La pantalla ya se actualizó.' })
      return false
    }
    // Cada persona es su propia tanda: filas y numeros de asiento se recalculan
    // con lo que ya entro, y si una falla las anteriores se quedan (son verdad).
    let filasVivas = filas
    for (const p of gente) {
      const ops = opsSentar(p, tableId, eventId as string, filasVivas, personas)
      const fallo = await ejecutarOps(supabase, ops)
      if (fallo) {
        await loadTables()
        toast.fallo({ titulo: gente.length === 1 ? `No se sentó a ${p.nombre} en la Mesa ${t.number}` : `No se sentó a todos en la Mesa ${t.number}`, fallo, reintentar: () => sentarPersonas(claves, tableId), clave: 'sentar-' + tableId })
        return false
      }
      filasVivas = await filasDeLaBase()
    }
    await loadTables()
    return true
  }

  const quitarPersona = async (p: Persona): Promise<boolean> => {
    if (!permiso.editar) return false
    const fallo = await ejecutarOps(supabase, opsQuitar(p, filas, personas))
    if (fallo) { await loadTables(); toast.fallo({ titulo: `No se quitó a ${p.nombre} de la mesa`, fallo, reintentar: () => quitarPersona(p) }); return false }
    await loadTables()
    return true
  }
```
donde `filasDeLaBase` es `async () => ((await supabase.from('table_seats').select('*').eq('event_id', eventId)).data || []) as Fila[]`.

`removeGuest(seatId, name)` (con su `askConfirm`) pasa a `removeGuest(p: Persona)` y llama `quitarPersona(p)`.

- [ ] **Step 2: `ModalAsignar.tsx` por persona**

Buscador + lista de `personas` (titular y debajo sus acompanantes con chip `de …`). Cada renglon: checkbox, nombre, a la derecha `Mesa N` (de `mapa`) o `Sin mesa`; si ya esta en esta mesa sale atenuado y sin checkbox. Al buscar por texto se filtra por nombre de la persona o de su titular. Boton `Sentar a {n}` desactivado si `n === 0` o `n > libres`; bajo el buscador el texto `${libres} lugares libres · ${ocupados}/${capacidad}`. `onSentar(claves)` y al resolver `true` cerrar.

- [ ] **Step 3: `ModalElegirMesa.tsx`**

Lista de `tables` ordenadas por numero: `Mesa N · nombre` y a la derecha `k libres` o `llena` (atenuada y sin click) o `aquí está` (si `mapa.get(persona.clave)?.tableId === t.id`, atenuada). Si el grupo tiene familia en esa mesa: `· aquí está {titular o nombre}`. Necesita `abierto.personas.length` lugares libres. Boton `Mover` / `Sentar a N`.

- [ ] **Step 4: `PersonaMenu.tsx`**

`Modal size="sm"` con tres botones a lo ancho: `Mover a otra mesa`, `Ver invitado`, `Quitar de la mesa` (rojo). En la pagina: `setPersonaMenu(p)` al tocar un renglon en celular; `onMover` abre `ModalElegirMesa` con `{ personas: [p], titulo: 'Mover a ' + p.nombre }`; `onVer` abre `openEditGuest(guests.find(g => g.id === p.guestId)!)`; `onQuitar` llama `removeGuest(p)`.

`SinMesaPanel` (Task 8) usa el mismo `ModalElegirMesa` para "Sentar a los N" con `personas` = la familia sin mesa.

- [ ] **Step 5: Verificar en local y commit**

`npx tsc --noEmit`, `npx vitest run`. Con SQL 1 corrido en la base, en `npm run dev -- -p 3001`: sentar a dos acompanantes en una mesa distinta de su titular, mover a uno, quitar a otro. Cada accion recarga y la etiqueta ambar aparece.

```bash
git add "app/events/[id]/mesas/"
git commit -m "feat(mesas): sentar, mover y quitar de uno en uno, tocando"
```

---

### Task 8: Panel "Sin mesa"

**Files:**
- Create: `app/events/[id]/mesas/SinMesaPanel.tsx`
- Modify: `app/events/[id]/mesas/page.tsx` — layout de la vista lista (escritorio `hidden sm:grid`) y `CanvasFullscreen` (barra lateral izquierda)

**Interfaces:**
- Props: `{ sinMesa: Persona[]; busqueda: string; setBusqueda: (v: string) => void; onSentarGrupo: (personas: Persona[]) => void; onVer: (p: Persona) => void; render: (p: Persona) => React.ReactNode }`. `render` pinta cada persona: en Task 9 sera el chip arrastrable; hasta entonces un `div` con nombre y chip `de …`.

- [ ] **Step 1: Componente**

Cabecera `SIN MESA · {n}` con `Users` de Lucide; buscador; grupos: por `guestId`, titulo `Familia {apellido del titular}` cuando hay mas de una persona (`titular.split(' ').slice(-1)[0]`) y link `Sentar a los {k}` a la derecha; personas sin familia bajo `Sin familia`. Cuando `sinMesa` esta vacio: `Todos tienen mesa` en teal. Ancho 230px en escritorio, `hidden sm:flex`.

- [ ] **Step 2: Montar en lista y plano**

Vista lista escritorio: `grid grid-cols-[230px_1fr]` con el panel a la izquierda y la lista actual a la derecha. En `CanvasFullscreen`, nueva prop `panel: React.ReactNode` que se pinta como columna izquierda fija fuera del area con scroll (`flex` con el canvas ocupando el resto). El contador `12 sin mesa` en ambar en la barra superior.

- [ ] **Step 3: Commit**

```bash
git add "app/events/[id]/mesas/"
git commit -m "feat(mesas): panel de personas sin mesa en lista y plano"
```

---

### Task 9: Arrastrar en la vista lista

**Files:**
- Create: `app/events/[id]/mesas/PersonaChip.tsx`
- Modify: `app/events/[id]/mesas/page.tsx` — envolver la vista lista en `DndContext`; tarjetas de mesa `useDroppable`; panel `useDroppable({ id: 'panel' })`.

**Interfaces:**
- `PersonaChip` props: `{ persona: Persona; etiqueta: string | null; arrastrable: boolean; onTap?: () => void }` — `useDraggable({ id: 'p:' + persona.clave, data: { persona } })`.
- `onDragEnd`: `over.id === 'panel'` → `quitarPersona(p)` (solo si tiene lugar); `over.id === 't:' + tableId` → `sentarPersonas([p.clave], tableId)`; sin `over` → nada.

- [ ] **Step 1: Sensores y contexto**

```ts
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }))
```
Solo mouse: con el dedo las personas se tocan, no se arrastran (la lista sigue haciendo scroll). `DragOverlay` pinta el chip que se arrastra.

- [ ] **Step 2: Destinos**

Cada tarjeta de mesa en escritorio: `const { setNodeRef, isOver } = useDroppable({ id: 't:' + table.id, disabled: ocupacion(table.id) >= table.capacity })`; cuando `isOver` y hay lugar: borde teal y una fila punteada `Soltar aquí a {nombre}`. Panel: cuando se arrastra a alguien sentado, su cabecera dice `Suelta aquí para quitar de la mesa`.

- [ ] **Step 3: Commit**

```bash
git add "app/events/[id]/mesas/"
git commit -m "feat(mesas): arrastrar personas entre el panel y las mesas en la lista"
```

---

### Task 10: Arrastrar en el plano

**Files:**
- Modify: `app/events/[id]/mesas/page.tsx` — extraer `seatPositions(table): { w: number; h: number; seats: { x: number; y: number }[] }` de `TableSVG` (184-330) para las 6 formas; `TableSVG` la usa. En el render de cada mesa del plano (955-1000): `useDroppable({ id: 't:' + table.id })` en el wrapper y, encima del SVG, un `div` absoluto de 16px por silla ocupada (`enMesa(table.id)[i]`) con `PersonaChip` en modo silla (`useDraggable`, `title` con nombre · de titular · estatus, `onMouseDown` con `stopPropagation` para no arrastrar la mesa, `data-canvas-item`).
- El `DndContext` de Task 9 envuelve tambien `CanvasFullscreen`; el mismo `onDragEnd`.

- [ ] **Step 1: `seatPositions`**

Para `round`: `r = max(28, min(44, 20 + cap*2))`, `orbit = r + 12`, `size = (orbit + 13) * 2`, silla i en `(size/2 + cos(a)*orbit, size/2 + sin(a)*orbit)` con `a = 2πi/cap − π/2`. Las otras cinco formas copian las formulas que ya estan en `TableSVG` (oval, rectangle, square, halfmoon, row) devolviendo `{ w, h, seats }`. `getTableSvgDims` pasa a `const { w, h } = seatPositions(table)`.

- [ ] **Step 2: Sillas arrastrables y mesa como destino**

Mientras se arrastra: la mesa bajo el cursor con lugar toma borde teal 3px (`isOver`), la llena no reacciona. Con `zoom` distinto de 1 los rects que usa dnd-kit son de pantalla, no hace falta corregir nada. Soltar fuera de toda mesa: nada. Soltar en el panel: quitar.

- [ ] **Step 3: Buscar en el plano prende la silla**

`matchingIds` (826-830) ya prende mesas por nombre de invitado o acompanante; agregar `matchingClaves` para atenuar todas las sillas menos las de las personas que coinciden.

- [ ] **Step 4: `npm run build` con el dev server apagado, commit**

```bash
git add "app/events/[id]/mesas/page.tsx"
git commit -m "feat(mesas): arrastrar personas en el plano, silla por silla"
```

---

### Task 11: Verificacion final y entrega

- [ ] `npx vitest run` (todo), `npx tsc --noEmit`, `npm run build` sin dev server.
- [ ] Pasos de prueba en local para Diego, con SQL 1 corrido:
  1. Evento con una familia de 4 sentada desde antes (fila legado). Abrir Mesas: se ve igual que antes (4 en su mesa, 4/10).
  2. Arrastrar a un hijo del plano a otra mesa: la familia se expande sola, la mesa origen baja a 3/10, la etiqueta ambar aparece en los dos lados.
  3. En celular (DevTools modo dispositivo): tocar mesa → Asignar → palomear 2 → Sentar a 2. Tocar persona → Mover → elegir mesa. Tocar persona → Quitar.
  4. Con Network Offline: cada accion regresa la pantalla y sale el toast con Reintentar.
  5. Invitados: columna Mesa y filtro por mesa muestran a los acompanantes.
- [ ] SQL 2 se entrega SOLO cuando el deploy este en produccion.
