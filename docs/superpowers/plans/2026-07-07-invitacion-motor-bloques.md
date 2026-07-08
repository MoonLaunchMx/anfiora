# Invitación RSVP — Motor de bloques · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la invitación RSVP en un documento de bloques editables (agregar/quitar/reordenar/editar), con un renderer único que pinta el mismo doc en el preview del editor y en la página pública del invitado.

**Architecture:** El doc `{v, meta, sections}` vive en `event_settings.invite_config` (JSONB). Zod (acotado a `lib/invite/`) valida cada bloque con defaults; `resolveDoc` descarta lo inválido sin romper. Un `InvitacionRenderer` mapea `type → componente`, usado en preview y público. La personalización por invitado se inyecta en render, no se guarda en el doc. Sin IA.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Zod v4 (nuevo, acotado), Supabase (service role en API), @dnd-kit (reordenar), Tailwind v4, Vitest (lógica pura).

## Global Constraints

- **Reglas de código Anfiora:** full file replacement al pegar; sin comentarios salvo WHY no-obvio; UI en español CON acentos y ñ; commits SIN acentos ni ñ, convencionales (`feat:`, `fix:`, `docs:`).
- **UI CTA en teal `#48C9B0`**; negro `#1D1E20` solo para dropdowns de filtro; sin emojis en UI; iconos Lucide.
- **Estética invitación pública:** crema, Josefin Sans display (`style={{ fontFamily: "'Josefin Sans', sans-serif" }}`), General Sans body, acento dorado `#d4a853`.
- **Tests Vitest solo para lógica pura**; UI y endpoints con I/O se verifican manual (local → preview → main).
- **Supabase:** nunca aplicar SQL sin código pusheado y OK explícito de Diego. Nunca `git push` sin permiso.
- **Sin tablas nuevas.** Cambios aditivos: `guests.rsvp_token`, `event_settings.invite_config`.
- **Zod acotado:** solo en `lib/invite/`. No tocar parsers existentes (`parseDressCode`, `mergeInviteConfig` viejo, etc.).
- **Reusar helpers existentes de `lib/invite.ts`:** `randomToken`, `slugifyEvent`, `resolveInviteHeading`, `resolveEventKicker`, `isInviteOpen`, `buildRsvpUpdate` (ya construidos y testeados).
- **Feature key nueva `invitacion`** en `lib/features.ts` (ON en sociales), gateada en `layout.tsx` — mismo patrón que `vestimenta`.

---

## File Structure

```
lib/invite/
  schema.ts        → Zod: *Content por tipo, SectionSchema (discriminated union), MetaSchema, InviteDocSchema, CONTENT_BY_TYPE, SECTION_TYPES, tipos z.infer
  doc.ts           → emptySection, defaultDoc, resolveDoc, addSection, removeSection, moveSection, updateSectionContent, setMeta
  doc.test.ts      → Vitest de doc.ts + schema
lib/invite.ts      → helpers puros (ya existe; se le quitan InviteConfig/defaultInviteConfig/mergeInviteConfig)
app/components/invitacion/
  InvitacionRenderer.tsx  → switch(type) → componente; recibe { doc, ctx }
  types.ts                → tipo InviteCtx (event, guest, party, dressCode, itinerary, tokens, mode, onSubmit)
  sections/
    PortadaSection.tsx, SaludoSection.tsx, DetallesSection.tsx, DressCodeSection.tsx,
    ItinerarioSection.tsx, RsvpSection.tsx, EngancheSection.tsx, TextoSection.tsx, CierreSection.tsx
app/invitacion/[slug]/[token]/
  page.tsx                → server + generateMetadata (OG)
  InvitacionClient.tsx    → 'use client', arma ctx público + POST
app/api/invitacion/[token]/route.ts → GET (extender: doc + dressCode + itinerary) + POST (nuevo)
app/events/[id]/invitacion/
  page.tsx                → config: editor de bloques + preview teléfono + reparto
  BlockEditor.tsx         → lista reordenable de bloques + editar content + agregar/quitar
  SectionForm.tsx         → form por tipo (campos de content)
  RepartoLinks.tsx        → lista de invitados, copiar/enviar WhatsApp, estado confirmación
lib/features.ts, lib/event-types.ts → key 'invitacion'
app/events/[id]/layout.tsx           → FEATURE_BY_PATH + NavItem "Invitación"
lib/types.ts                         → re-export InviteDoc (reemplaza InviteConfig)
```

---

## FASE 1 — Motor puro (Zod + resolver + ops) · TDD estricto

### Task 1: Instalar Zod y crear el schema de bloques

**Files:**
- Modify: `package.json` (dependencia `zod`)
- Create: `lib/invite/schema.ts`
- Test: `lib/invite/doc.test.ts` (se inicia aquí)

**Interfaces:**
- Produces: `CONTENT_BY_TYPE` (record type→ZodObject), `SECTION_TYPES: SectionType[]`, `SectionSchema`, `MetaSchema`, `InviteDocSchema`; tipos `Section`, `SectionType`, `InviteMeta`, `InviteDoc`.

- [ ] **Step 1: Instalar Zod** (pedir OK a Diego antes de instalar)

Run: `npm install zod`
Expected: `zod` aparece en `package.json` dependencies.

- [ ] **Step 2: Escribir `lib/invite/schema.ts`**

```ts
import { z } from 'zod'

const PortadaContent = z.object({
  kicker: z.string().default(''),
  titulo: z.string().default(''),
  subtitulo: z.string().default(''),
})
const SaludoContent = z.object({
  titulo: z.string().default('Hola'),
  mensaje: z.string().default('Nos encantaría que nos acompañes en este día tan especial.'),
})
const DetallesContent = z.object({
  titulo: z.string().default('Los detalles'),
  mostrar_mapa: z.boolean().default(true),
})
const DressCodeContent = z.object({
  titulo: z.string().default('Código de vestimenta'),
})
const ItinerarioContent = z.object({
  titulo: z.string().default('Itinerario del día'),
})
const RsvpContent = z.object({
  titulo: z.string().default('Confirma tu asistencia'),
  texto: z.string().default('Ayúdanos a organizar todo confirmando si nos acompañas.'),
})
const EngancheContent = z.object({
  titulo: z.string().default('Sé parte de la fiesta'),
  mostrar_playlist: z.boolean().default(true),
  mostrar_mesa: z.boolean().default(true),
})
const TextoContent = z.object({
  eyebrow: z.string().default(''),
  titulo: z.string().default(''),
  cuerpo: z.string().default(''),
})
const CierreContent = z.object({
  titulo: z.string().default('Te esperamos'),
  firma: z.string().default(''),
})

export const CONTENT_BY_TYPE = {
  portada: PortadaContent,
  saludo: SaludoContent,
  detalles: DetallesContent,
  dress_code: DressCodeContent,
  itinerario: ItinerarioContent,
  rsvp: RsvpContent,
  enganche: EngancheContent,
  texto: TextoContent,
  cierre: CierreContent,
} as const

export type SectionType = keyof typeof CONTENT_BY_TYPE
export const SECTION_TYPES = Object.keys(CONTENT_BY_TYPE) as SectionType[]

export const SectionSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('portada'),    content: PortadaContent }),
  z.object({ id: z.string(), type: z.literal('saludo'),     content: SaludoContent }),
  z.object({ id: z.string(), type: z.literal('detalles'),   content: DetallesContent }),
  z.object({ id: z.string(), type: z.literal('dress_code'), content: DressCodeContent }),
  z.object({ id: z.string(), type: z.literal('itinerario'), content: ItinerarioContent }),
  z.object({ id: z.string(), type: z.literal('rsvp'),       content: RsvpContent }),
  z.object({ id: z.string(), type: z.literal('enganche'),   content: EngancheContent }),
  z.object({ id: z.string(), type: z.literal('texto'),      content: TextoContent }),
  z.object({ id: z.string(), type: z.literal('cierre'),     content: CierreContent }),
])

export const MetaSchema = z.object({
  publicada: z.boolean().default(false),
  fecha_limite: z.string().nullable().default(null),
})

export const InviteDocSchema = z.object({
  v: z.literal(1).default(1),
  meta: MetaSchema.default({}),
  sections: z.array(SectionSchema).default([]),
})

export type Section = z.infer<typeof SectionSchema>
export type InviteMeta = z.infer<typeof MetaSchema>
export type InviteDoc = z.infer<typeof InviteDocSchema>
```

- [ ] **Step 3: Escribir el test de `emptySection` (falla — aún no existe `doc.ts`)**

```ts
// lib/invite/doc.test.ts
import { describe, it, expect } from 'vitest'
import { emptySection, defaultDoc, resolveDoc, addSection, removeSection, moveSection, updateSectionContent, setMeta } from './doc'
import { SECTION_TYPES } from './schema'

let n = 0
const makeId = () => `id-${++n}`

describe('emptySection', () => {
  it('crea un bloque con puros defaults y el id dado', () => {
    const s = emptySection('portada', 'abc')
    expect(s).toEqual({ id: 'abc', type: 'portada', content: { kicker: '', titulo: '', subtitulo: '' } })
  })
  it('funciona para todos los tipos sin lanzar', () => {
    for (const t of SECTION_TYPES) {
      const s = emptySection(t, 't')
      expect(s.type).toBe(t)
      expect(s.id).toBe('t')
    }
  })
})
```

- [ ] **Step 4: Correr el test — falla**

Run: `npx vitest run lib/invite/doc.test.ts`
Expected: FAIL con "Failed to resolve import './doc'".

- [ ] **Step 5: Commit del schema**

```bash
git add package.json package-lock.json lib/invite/schema.ts lib/invite/doc.test.ts
git commit -m "feat(invitacion): schema Zod de bloques + zod dep"
```

---

### Task 2: `emptySection`, `defaultDoc`, `resolveDoc`

**Files:**
- Create: `lib/invite/doc.ts`
- Test: `lib/invite/doc.test.ts` (se extiende)

**Interfaces:**
- Consumes: `CONTENT_BY_TYPE`, `SectionSchema`, `MetaSchema`, `SECTION_TYPES`, tipos de `schema.ts`.
- Produces: `emptySection(type, id): Section`, `defaultDoc(makeId): InviteDoc`, `resolveDoc(raw, makeId): InviteDoc`.

- [ ] **Step 1: Escribir `lib/invite/doc.ts` (parte 1)**

```ts
import { CONTENT_BY_TYPE, SectionSchema, MetaSchema } from './schema'
import type { InviteDoc, InviteMeta, Section, SectionType } from './schema'

const DEFAULT_ORDER: SectionType[] = [
  'portada', 'saludo', 'detalles', 'itinerario', 'dress_code', 'rsvp', 'enganche', 'cierre',
]

export function emptySection(type: SectionType, id: string): Section {
  return { id, type, content: CONTENT_BY_TYPE[type].parse({}) } as Section
}

export function defaultDoc(makeId: () => string): InviteDoc {
  return {
    v: 1,
    meta: MetaSchema.parse({}),
    sections: DEFAULT_ORDER.map(t => emptySection(t, makeId())),
  }
}

export function resolveDoc(raw: unknown, makeId: () => string): InviteDoc {
  if (!raw || typeof raw !== 'object') return defaultDoc(makeId)
  const r = raw as Record<string, unknown>
  const rawSections = Array.isArray(r.sections) ? r.sections : []
  const seen = new Set<string>()
  const sections: Section[] = []
  for (const s of rawSections) {
    const parsed = SectionSchema.safeParse(s)
    if (!parsed.success) continue
    if (seen.has(parsed.data.id)) continue
    seen.add(parsed.data.id)
    sections.push(parsed.data)
  }
  if (sections.length === 0) return defaultDoc(makeId)
  const metaParsed = MetaSchema.safeParse(r.meta)
  const meta: InviteMeta = metaParsed.success ? metaParsed.data : MetaSchema.parse({})
  return { v: 1, meta, sections }
}
```

- [ ] **Step 2: Correr el test de Task 1 — pasa**

Run: `npx vitest run lib/invite/doc.test.ts`
Expected: PASS (emptySection).

- [ ] **Step 3: Agregar tests de `resolveDoc` y `defaultDoc`**

```ts
describe('defaultDoc', () => {
  it('trae los 8 bloques por defecto en orden', () => {
    const d = defaultDoc(makeId)
    expect(d.v).toBe(1)
    expect(d.meta).toEqual({ publicada: false, fecha_limite: null })
    expect(d.sections.map(s => s.type)).toEqual(
      ['portada', 'saludo', 'detalles', 'itinerario', 'dress_code', 'rsvp', 'enganche', 'cierre'],
    )
  })
})

describe('resolveDoc', () => {
  it('null/basura -> doc por defecto', () => {
    expect(resolveDoc(null, makeId).sections.length).toBe(8)
    expect(resolveDoc('x', makeId).sections.length).toBe(8)
  })
  it('descarta secciones invalidas en silencio', () => {
    const raw = {
      meta: { publicada: true, fecha_limite: '2026-03-01' },
      sections: [
        { id: 'a', type: 'portada', content: {} },
        { id: 'b', type: 'no-existe', content: {} },
        { id: 'c', type: 'saludo', content: { mensaje: 'Hola' } },
      ],
    }
    const d = resolveDoc(raw, makeId)
    expect(d.sections.map(s => s.type)).toEqual(['portada', 'saludo'])
    expect(d.meta.publicada).toBe(true)
  })
  it('rellena content parcial con defaults', () => {
    const d = resolveDoc({ sections: [{ id: 'a', type: 'saludo', content: {} }] }, makeId)
    const saludo = d.sections[0]
    expect(saludo.content).toHaveProperty('titulo')
    expect(saludo.content).toHaveProperty('mensaje')
  })
  it('deduplica ids', () => {
    const d = resolveDoc({
      sections: [
        { id: 'x', type: 'portada', content: {} },
        { id: 'x', type: 'saludo', content: {} },
      ],
    }, makeId)
    expect(d.sections.length).toBe(1)
  })
  it('meta invalida -> defaults, conservando secciones', () => {
    const d = resolveDoc({ meta: 'malo', sections: [{ id: 'a', type: 'cierre', content: {} }] }, makeId)
    expect(d.meta).toEqual({ publicada: false, fecha_limite: null })
    expect(d.sections.length).toBe(1)
  })
})
```

- [ ] **Step 4: Correr — pasa**

Run: `npx vitest run lib/invite/doc.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/invite/doc.ts lib/invite/doc.test.ts
git commit -m "feat(invitacion): resolveDoc tolerante + defaultDoc + emptySection"
```

---

### Task 3: Operaciones de array (add/remove/move/update/setMeta)

**Files:**
- Modify: `lib/invite/doc.ts`
- Test: `lib/invite/doc.test.ts`

**Interfaces:**
- Produces: `addSection(doc, type, makeId): InviteDoc`, `removeSection(doc, id): InviteDoc`, `moveSection(doc, id, toIndex): InviteDoc`, `updateSectionContent(doc, id, patch): InviteDoc`, `setMeta(doc, patch): InviteDoc`. Todas inmutables (devuelven doc nuevo).

- [ ] **Step 1: Escribir los tests (fallan)**

```ts
const base = () => defaultDoc(makeId)

describe('ops de array', () => {
  it('addSection agrega al final sin mutar', () => {
    const d0 = base()
    const len = d0.sections.length
    const d1 = addSection(d0, 'texto', makeId)
    expect(d1.sections.length).toBe(len + 1)
    expect(d1.sections.at(-1)!.type).toBe('texto')
    expect(d0.sections.length).toBe(len) // no mutado
  })
  it('removeSection quita por id', () => {
    const d0 = base()
    const id = d0.sections[0].id
    const d1 = removeSection(d0, id)
    expect(d1.sections.find(s => s.id === id)).toBeUndefined()
  })
  it('moveSection reubica por indice y hace clamp', () => {
    const d0 = base()
    const id = d0.sections[0].id
    const d1 = moveSection(d0, id, 3)
    expect(d1.sections[3].id).toBe(id)
    const d2 = moveSection(d0, id, 999)
    expect(d2.sections.at(-1)!.id).toBe(id)
  })
  it('updateSectionContent hace merge del patch', () => {
    const d0 = base()
    const s = d0.sections.find(x => x.type === 'saludo')!
    const d1 = updateSectionContent(d0, s.id, { mensaje: 'Nuevo' })
    const s1 = d1.sections.find(x => x.id === s.id)!
    expect((s1.content as any).mensaje).toBe('Nuevo')
    expect((s1.content as any).titulo).toBeDefined()
  })
  it('setMeta hace merge', () => {
    const d1 = setMeta(base(), { publicada: true })
    expect(d1.meta.publicada).toBe(true)
    expect(d1.meta.fecha_limite).toBeNull()
  })
})
```

- [ ] **Step 2: Correr — falla**

Run: `npx vitest run lib/invite/doc.test.ts`
Expected: FAIL ("addSection is not a function").

- [ ] **Step 3: Implementar en `lib/invite/doc.ts`**

```ts
export function addSection(doc: InviteDoc, type: SectionType, makeId: () => string): InviteDoc {
  return { ...doc, sections: [...doc.sections, emptySection(type, makeId())] }
}

export function removeSection(doc: InviteDoc, id: string): InviteDoc {
  return { ...doc, sections: doc.sections.filter(s => s.id !== id) }
}

export function moveSection(doc: InviteDoc, id: string, toIndex: number): InviteDoc {
  const from = doc.sections.findIndex(s => s.id === id)
  if (from === -1) return doc
  const next = [...doc.sections]
  const [item] = next.splice(from, 1)
  const clamped = Math.max(0, Math.min(toIndex, next.length))
  next.splice(clamped, 0, item)
  return { ...doc, sections: next }
}

export function updateSectionContent(doc: InviteDoc, id: string, patch: Record<string, unknown>): InviteDoc {
  return {
    ...doc,
    sections: doc.sections.map(s =>
      s.id === id ? ({ ...s, content: { ...s.content, ...patch } } as Section) : s,
    ),
  }
}

export function setMeta(doc: InviteDoc, patch: Partial<InviteMeta>): InviteDoc {
  return { ...doc, meta: { ...doc.meta, ...patch } }
}
```

- [ ] **Step 4: Correr — pasa**

Run: `npx vitest run lib/invite/doc.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck y commit**

Run: `npx tsc --noEmit` → sin errores.

```bash
git add lib/invite/doc.ts lib/invite/doc.test.ts
git commit -m "feat(invitacion): ops inmutables de bloques (add/remove/move/update/meta)"
```

---

## FASE 2 — Renderer + página pública + POST

> UI/API: se verifican manual (local → preview). No hay test-first; cada task termina en `npx tsc --noEmit` limpio + verificación en localhost.

### Task 4: Renderer único + componentes de sección

**Files:**
- Create: `app/components/invitacion/types.ts`
- Create: `app/components/invitacion/InvitacionRenderer.tsx`
- Create: `app/components/invitacion/sections/*.tsx` (9 archivos)

**Interfaces:**
- Consumes: `InviteDoc`, `Section` de `lib/invite/schema`; `DressCode` de `lib/dresscode`; helpers de `lib/invite.ts`.
- Produces: `InviteCtx` (tipo), `InvitacionRenderer({ doc, ctx })`.

- [ ] **Step 1: `types.ts` — el contexto de render**

```ts
import type { DressCode } from '@/lib/dresscode'

export type InviteGuest = {
  name: string
  party_size: number
  rsvp_status: string
  allergies: string[]
}
export type InviteCompanion = { id?: string; name: string; rsvp_status: string; allergies: string[] }

export type InviteCtx = {
  event: {
    name: string; event_type: string | null; event_date: string | null; event_time: string | null
    venue: string | null; address: string | null; host_name: string | null; host_name_2: string | null
  }
  guest: InviteGuest
  companions: InviteCompanion[]
  dressCode: DressCode | null
  itinerary: { start_time: string; title: string; location: string | null }[]
  tokens: { playlist: string | null; registry: string | null }
  mode: 'preview' | 'public'
  onSubmit?: (payload: import('@/lib/invite').RsvpSubmission) => Promise<void>
  deadlinePassed?: boolean
}
```

- [ ] **Step 2: `InvitacionRenderer.tsx` — el switch**

```tsx
'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import type { InviteCtx } from './types'
import PortadaSection from './sections/PortadaSection'
import SaludoSection from './sections/SaludoSection'
import DetallesSection from './sections/DetallesSection'
import DressCodeSection from './sections/DressCodeSection'
import ItinerarioSection from './sections/ItinerarioSection'
import RsvpSection from './sections/RsvpSection'
import EngancheSection from './sections/EngancheSection'
import TextoSection from './sections/TextoSection'
import CierreSection from './sections/CierreSection'

export default function InvitacionRenderer({ doc, ctx }: { doc: InviteDoc; ctx: InviteCtx }) {
  return (
    <div className="flex flex-col">
      {doc.sections.map(s => {
        switch (s.type) {
          case 'portada':    return <PortadaSection    key={s.id} content={s.content} ctx={ctx} />
          case 'saludo':     return <SaludoSection     key={s.id} content={s.content} ctx={ctx} />
          case 'detalles':   return <DetallesSection   key={s.id} content={s.content} ctx={ctx} />
          case 'dress_code': return <DressCodeSection  key={s.id} content={s.content} ctx={ctx} />
          case 'itinerario': return <ItinerarioSection key={s.id} content={s.content} ctx={ctx} />
          case 'rsvp':       return <RsvpSection       key={s.id} content={s.content} ctx={ctx} />
          case 'enganche':   return <EngancheSection   key={s.id} content={s.content} ctx={ctx} />
          case 'texto':      return <TextoSection      key={s.id} content={s.content} ctx={ctx} />
          case 'cierre':     return <CierreSection     key={s.id} content={s.content} ctx={ctx} />
          default:           return <div key={(s as any).id} className="px-6 py-3 text-center text-xs text-[#bbb]">Sección no disponible</div>
        }
      })}
    </div>
  )
}
```

- [ ] **Step 3: Componentes de sección (uno por archivo)**

Cada componente recibe `{ content, ctx }` (props tipadas al content de su tipo). Reglas por componente:
- **PortadaSection:** título = `content.titulo || resolveInviteHeading(ctx.event)`; kicker = `content.kicker || resolveEventKicker(ctx.event.event_type)`; muestra fecha (`ctx.event.event_date` formateada es-MX) y `ctx.event.venue`. Josefin Sans en el título.
- **SaludoSection:** `"${content.titulo}, ${ctx.guest.name}"` + `content.mensaje` + chip "Reservamos lugar para ti + N acompañante(s)" con `N = ctx.event`... usa `ctx.companions.length`.
- **DetallesSection:** tarjetas Cuándo (`event_date`+`event_time`), Dónde (`venue`+`address`); si `content.mostrar_mapa` y hay address, link a `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`.
- **DressCodeSection:** si `!ctx.dressCode || !isDressCodeConfigured(ctx.dressCode)` → en `mode==='preview'` muestra aviso "Configúralo en Estilo → Dress code"; en `mode==='public'` no pinta nada (`return null`). Si hay dato: nivel (`resolveNivelLabel`), colores (swatches), recomendaciones, nota, guía ellas/ellos, fotos por género (reusa la lógica visual de `DressCodePreview`).
- **ItinerarioSection:** si `ctx.itinerary.length === 0` → preview: aviso "Se mostrará cuando configures el itinerario en Timeline"; public: `return null`. Si hay: lista hora/título/ubicación.
- **RsvpSection:** fila por persona (invitado + `ctx.companions`), pills Asisto/No podré, chips de alergias; botón "Confirmar asistencia". Si `ctx.deadlinePassed` o `ctx.mode==='preview'` → controles deshabilitados + nota ("Vista previa — así confirmará tu invitado" / "Confirmaciones cerradas"). Al enviar arma `RsvpSubmission` y llama `ctx.onSubmit`.
- **EngancheSection:** tarjeta playlist si `content.mostrar_playlist && ctx.tokens.playlist` → link `/playlist/${token}`; tarjeta mesa si `content.mostrar_mesa && ctx.tokens.registry` → `/mesa/${token}`.
- **TextoSection:** `content.eyebrow`, `content.titulo`, `content.cuerpo` (respeta saltos de línea con `whitespace-pre-line`). Si los tres vacíos → `return null`.
- **CierreSection:** `content.titulo`, firma = `content.firma || resolveInviteHeading(ctx.event)`, + "Hecho con Anfiora".

Props tipadas: importar el content por tipo con `Extract<Section, { type: 'portada' }>['content']`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/components/invitacion
git commit -m "feat(invitacion): renderer unico + componentes de seccion"
```

---

### Task 5: Página pública `/invitacion/[slug]/[token]` + GET extendido

**Files:**
- Modify: `app/api/invitacion/[token]/route.ts` (extender GET)
- Create: `app/invitacion/[slug]/[token]/page.tsx`
- Create: `app/invitacion/[slug]/[token]/InvitacionClient.tsx`

**Interfaces:**
- Consumes: `resolveDoc` (con `makeId = () => crypto.randomUUID()`), `InvitacionRenderer`, `InviteCtx`, `isInviteOpen`.
- Produces: JSON del GET con `{ event, guest, companions, doc, dressCode, itinerary, tokens }`.

- [ ] **Step 1: Extender el GET** para devolver además `invite_config` resuelto (`resolveDoc`), `dress_code` (parseado), itinerario visible (query defensiva a `event_itinerary_moments`; envolver en try/catch → `[]` si la tabla no existe), y `tokens` de playlist/mesa. Mantener acotado al invitado del token; nunca otros invitados/teléfonos.

- [ ] **Step 2: `page.tsx`** server component con `generateMetadata({ params })`: fetch mínimo por token (nombre evento, fecha, heading) → `title`, `description`, `openGraph`. Renderiza `<InvitacionClient token={token} />`.

- [ ] **Step 3: `InvitacionClient.tsx`** (`'use client'`): `useEffect` hace `GET /api/invitacion/${token}`; arma `InviteCtx` con `mode='public'`, `deadlinePassed = !isInviteOpen(doc.meta, todayISO)`, `onSubmit` que hace `POST`. Estados: cargando (spinner), token inválido/borrador (404 amable), ok → `<InvitacionRenderer doc={doc} ctx={ctx} />` en contenedor crema centrado mobile-first.

- [ ] **Step 4: Typecheck + verificación manual**

Run: `npx tsc --noEmit`
Manual (tras SQL en local, ver Task 9): abrir `/invitacion/evento/{token}` de un invitado real publicado → se ve la invitación completa con sus secciones.

- [ ] **Step 5: Commit**

```bash
git add app/api/invitacion app/invitacion
git commit -m "feat(invitacion): pagina publica + GET extendido con doc y dress code"
```

---

### Task 6: `POST /api/invitacion/[token]` (confirmar)

**Files:**
- Modify: `app/api/invitacion/[token]/route.ts` (agregar POST)

**Interfaces:**
- Consumes: `buildRsvpUpdate`, `isInviteOpen`, `logAction`.

- [ ] **Step 1: Implementar POST** — valida token → `meta.publicada` → `isInviteOpen(meta, today)`; parsea el body a `RsvpSubmission`; `buildRsvpUpdate(sub, { deadlinePassed })`; escribe `guests` (`rsvp_status`, `allergies`) + upsert `party_members` (por `id` o por `name`); `logAction({ action: 'guest.rsvp', ... })` silent-fail. Respuestas 200/404/410 amables.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Verificación manual** (tras SQL): confirmar desde la página → revisar en Supabase que `guests.rsvp_status`/`allergies` y `party_members` quedaron correctos; reabrir el link muestra el estado actual (idempotente).

- [ ] **Step 4: Commit**

```bash
git add app/api/invitacion
git commit -m "feat(invitacion): POST confirmar asistencia (guests + party_members)"
```

---

## FASE 3 — Editor de bloques + preview

### Task 7: Config del anfitrión — editor + preview teléfono + autoguardado

**Files:**
- Create: `app/events/[id]/invitacion/page.tsx`
- Create: `app/events/[id]/invitacion/BlockEditor.tsx`
- Create: `app/events/[id]/invitacion/SectionForm.tsx`

**Interfaces:**
- Consumes: `resolveDoc`, ops de `doc.ts`, `InvitacionRenderer`, `SECTION_TYPES`, `CONTENT_BY_TYPE`.

- [ ] **Step 1: `page.tsx`** — carga `event`, `event_settings.invite_config`, dress code, un invitado de ejemplo (o placeholder `{ name: 'Invitado de ejemplo', party_size: 2 }`). Estado `doc` vía `resolveDoc`. Layout patrón Dress code: header sticky (Borrador/Publicada + Publicar + fecha límite) · izquierda `BlockEditor` · derecha teléfono con `InvitacionRenderer mode='preview'`. **Autoguardado** (debounce 0.8s) del doc a `invite_config` (patrón de `vestimenta/page.tsx`). Botón Publicar: `setMeta(doc, { publicada: true })` + genera `rsvp_token` faltantes (update masivo a `guests` sin token del evento).

- [ ] **Step 2: `BlockEditor.tsx`** — lista de `doc.sections` con `@dnd-kit` (SortableContext, PointerSensor distance 5 / TouchSensor delay 200 como playlist). Cada fila: handle de arrastre, nombre del tipo, botón quitar (`removeSection`), y expandible a `<SectionForm>`. Botón "+ Agregar sección" con menú de `SECTION_TYPES` no-únicos (permite duplicar `texto`; los de referencia como `dress_code`/`itinerario` se pueden limitar a 1). `onChange(nextDoc)` sube al padre.

- [ ] **Step 3: `SectionForm.tsx`** — form por tipo: recibe `section` y `onPatch(patch)`. Renderiza inputs según `section.type` (textos, textarea para `cuerpo`/`mensaje`, toggles para `mostrar_mapa`/`mostrar_playlist`/`mostrar_mesa`, DatePicker para nada aquí). Cada cambio → `updateSectionContent`.

- [ ] **Step 4: Typecheck + verificación manual**

Run: `npx tsc --noEmit`
Manual: abrir `/events/{id}/invitacion` → agregar/quitar/reordenar bloques → editar textos → ver el teléfono actualizarse en vivo → autoguardado muestra "Guardando..."/"Guardado" → refresh persiste.

- [ ] **Step 5: Commit**

```bash
git add app/events/[id]/invitacion
git commit -m "feat(invitacion): editor de bloques + preview telefono + autoguardado"
```

---

### Task 8: Reparto de links por WhatsApp

**Files:**
- Create: `app/events/[id]/invitacion/RepartoLinks.tsx`
- Modify: `app/events/[id]/invitacion/page.tsx` (montar Reparto, p. ej. pestaña "Enviar")

**Interfaces:**
- Consumes: `slugifyEvent`, `guests` (con `rsvp_token`, `rsvp_status`).

- [ ] **Step 1: `RepartoLinks.tsx`** — lista de invitados del evento; por cada uno construye `link = ${origin}/invitacion/${slugifyEvent(event)}/${guest.rsvp_token}`; botón **copiar** y **enviar por WhatsApp** (`https://wa.me/${phone}?text=${encodeURIComponent(plantilla.replace('{link}', link))}`), reusando el sistema de plantillas del guest list + plantilla nueva "Te comparto la invitación: {link}". Columna estado de confirmación (badge por `rsvp_status`). Selección múltiple opcional. Deshabilitar si `!guest.rsvp_token` (invitación no publicada) con aviso "Publica la invitación para generar los links".

- [ ] **Step 2: Montar en `page.tsx`** como pestaña "Enviar" junto a "Diseño".

- [ ] **Step 3: Typecheck + verificación manual**

Run: `npx tsc --noEmit`
Manual: publicar → cada invitado tiene link; copiar y enviar por WhatsApp abre el chat con el texto correcto.

- [ ] **Step 4: Commit**

```bash
git add app/events/[id]/invitacion
git commit -m "feat(invitacion): reparto de links por WhatsApp + estado de confirmacion"
```

---

## FASE 4 — Feature toggle + limpieza de tipos + SQL

### Task 9: Registrar `invitacion` como feature + NavItem + SQL doc

**Files:**
- Modify: `lib/features.ts` (key `invitacion`)
- Modify: `lib/event-types.ts` (ON en sociales)
- Modify: `app/events/[id]/layout.tsx` (NavItem + `FEATURE_BY_PATH`)
- Modify: `lib/types.ts` (quitar `InviteConfig`, re-export `InviteDoc`)
- Modify: `lib/invite.ts` (quitar `InviteConfig`/`defaultInviteConfig`/`mergeInviteConfig`)

**Interfaces:**
- Sigue el patrón exacto de `vestimenta` (ver commit `e1e70bc`).

- [ ] **Step 1: `lib/features.ts`** — agregar `'invitacion'` a `FeatureKey`; entrada en `FEATURES` (`label: 'Invitación'`, icon `MailOpen` de lucide, `navPaths: ['/invitacion']`); `LEGACY_FEATURES.invitacion = true`; agregar `invitacion:` a `getDefaultFeatures` y `resolveFeatures`.

- [ ] **Step 2: `lib/event-types.ts`** — agregar `'invitacion'` a `defaultFeatures` de los tipos sociales (boda, xv, cumpleanos, graduacion, bautizo, fiesta, despedida).

- [ ] **Step 3: `layout.tsx`** — NavItem `{ type:'item', label:'Invitación', labelMobile:'Invitación', path:'/invitacion', adminOnly:false, iconos MailOpen }` (colocarla después de Invitados o antes de Estilo); agregar `'/invitacion': 'invitacion'` a `FEATURE_BY_PATH`.

- [ ] **Step 4: Limpiar tipos** — en `lib/invite.ts` borrar `InviteConfig`/`defaultInviteConfig`/`mergeInviteConfig`; en `lib/types.ts` cambiar `export type { InviteConfig } from './invite'` por `export type { InviteDoc } from './invite/schema'`. Ajustar cualquier import roto.

- [ ] **Step 5: Typecheck + tests + build**

Run: `npx tsc --noEmit && npm test && rm -rf .next && npm run build`
Expected: todo verde; `/invitacion/[slug]/[token]` y `/events/[id]/invitacion` en la lista de rutas.

- [ ] **Step 6: Commit**

```bash
git add lib/features.ts lib/event-types.ts app/events/[id]/layout.tsx lib/types.ts lib/invite.ts
git commit -m "feat(invitacion): feature activable en sociales + NavItem + limpieza de tipos"
```

- [ ] **Step 7: SQL (documentar, NO ejecutar sin push + OK de Diego)**

`docs/superpowers/plans/sql/2026-07-06-invitacion.sql` ya tiene:
```sql
alter table guests add column if not exists rsvp_token text unique;
alter table event_settings add column if not exists invite_config jsonb;
```
Aplicar en Supabase SOLO tras push de la rama y con OK explícito de Diego.

---

## Self-Review (cobertura del spec)

- §2 modelo doc → Task 1 (schema) + Task 2 (resolveDoc). ✅
- §3 tipos de sección → Task 1 (schemas) + Task 4 (componentes). ✅
- §4 Zod acotado → Task 1 (solo `lib/invite/`). ✅
- §5 doc por defecto → Task 2 (`defaultDoc`, orden con rsvp abajo). ✅
- §6 renderer único → Task 4. ✅
- §7.1 página pública → Task 5; §7.2 config → Task 7 + Task 8. ✅
- §8 GET/POST → Task 5 (GET) + Task 6 (POST). ✅
- §9 feature toggle → Task 9. ✅
- §10 SQL aditivo → Task 9 Step 7. ✅
- §11 lógica pura + limpieza InviteConfig → Task 1-3 + Task 9 Step 4. ✅
- §13 fuera de alcance (sin IA, sin galería, sin inline) → respetado (no hay tasks de eso). ✅
- §14 reglas de oro → estructura de tasks las honra. ✅
