# Código de vestimenta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada evento un código de vestimenta estructurado que el organizador edita en `/events/[id]/vestimenta`, se comparte como texto copiable, y que la invitación RSVP lee de `event_settings.dress_code`.

**Architecture:** Lógica pura en `lib/dresscode.ts` (tipos, constantes, parse, texto), cubierta con Vitest. UI cliente en `app/events/[id]/vestimenta/` (page + editor + preview). Persistencia aditiva: un campo `event_settings.dress_code JSONB`. Fotos de ejemplo a Supabase Storage. Sin tablas nuevas.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase (browser client), Lucide React, Vitest.

## Global Constraints

- Sin tablas nuevas: el dress code vive en `event_settings.dress_code JSONB` (aditivo).
- Nada toca Supabase (schema/datos/Storage) hasta que el código esté pusheado (sincronía Supabase↔Vercel). El `ALTER` y el bucket los aplica Diego tras el push.
- UI en español **con** acentos y ñ; mensajes de commit **sin** acentos ni ñ, convencionales (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Sin emojis en UI. Íconos solo Lucide React.
- CTA en teal `#48C9B0`. Acento dorado `#d4a853`. Negro `#1D1E20` solo para dropdowns de filtro. Estilo flat, mobile-first.
- Solo Tailwind (sin inline styles salvo excepción justificada, p. ej. color dinámico de swatch).
- Vitest solo para lógica pura; UI e I/O se verifican manual (local → preview → main).
- `lib/types.ts` y `app/events/[id]/layout.tsx` son archivos compartidos por features en paralelo (RSVP, itinerario): editar al mínimo y coordinar el orden de merge.
- Commits terminan con la línea: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Lógica pura y tipos (`lib/dresscode.ts`)

**Files:**
- Create: `lib/dresscode.ts`
- Test: `lib/dresscode.test.ts`

**Interfaces:**
- Produces:
  - `type DressCodeNivel = 'casual' | 'casual_elegante' | 'coctel' | 'formal' | 'etiqueta' | 'tematico'`
  - `type DressCodeColor = { hex: string; nombre: string }`
  - `type DressCode = { nivel: DressCodeNivel | null; nivel_custom: string | null; colores_sugeridos: DressCodeColor[]; colores_evitar: DressCodeColor[]; recomendaciones: string[]; nota_libre: string; guia_ellas: string | null; guia_ellos: string | null; fotos_ejemplo: string[] }`
  - `const NIVELES: { id: DressCodeNivel; label: string; desc: string }[]`
  - `const RECOMENDACIONES_SUGERIDAS: string[]`
  - `function defaultDressCode(): DressCode`
  - `function parseDressCode(raw: unknown): DressCode`
  - `function isDressCodeConfigured(dc: DressCode): boolean`
  - `function resolveNivelLabel(dc: DressCode): string | null`
  - `function resolveNivelDesc(dc: DressCode): string | null`
  - `function buildDressCodeText(dc: DressCode, opts?: { eventName?: string }): string`

- [ ] **Step 1: Write the failing test**

Create `lib/dresscode.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  defaultDressCode,
  parseDressCode,
  isDressCodeConfigured,
  resolveNivelLabel,
  buildDressCodeText,
  type DressCode,
} from './dresscode'

describe('defaultDressCode', () => {
  it('devuelve un objeto vacio valido', () => {
    const dc = defaultDressCode()
    expect(dc.nivel).toBeNull()
    expect(dc.colores_sugeridos).toEqual([])
    expect(dc.recomendaciones).toEqual([])
    expect(dc.nota_libre).toBe('')
    expect(dc.fotos_ejemplo).toEqual([])
  })
})

describe('parseDressCode', () => {
  it('null o undefined -> default', () => {
    expect(parseDressCode(null)).toEqual(defaultDressCode())
    expect(parseDressCode(undefined)).toEqual(defaultDressCode())
  })

  it('normaliza campos faltantes', () => {
    const dc = parseDressCode({ nivel: 'coctel' })
    expect(dc.nivel).toBe('coctel')
    expect(dc.colores_sugeridos).toEqual([])
    expect(dc.nota_libre).toBe('')
  })

  it('descarta nivel invalido a null', () => {
    expect(parseDressCode({ nivel: 'space-suit' }).nivel).toBeNull()
  })

  it('filtra colores con hex invalido', () => {
    const dc = parseDressCode({
      colores_sugeridos: [
        { hex: '#3A5A40', nombre: 'Salvia' },
        { hex: 'nope', nombre: 'Malo' },
        { hex: '#FFF', nombre: 'Corto' },
      ],
    })
    expect(dc.colores_sugeridos.map(c => c.hex)).toEqual(['#3A5A40', '#FFF'])
  })

  it('recorta fotos_ejemplo a 3', () => {
    const dc = parseDressCode({ fotos_ejemplo: ['a', 'b', 'c', 'd', 'e'] })
    expect(dc.fotos_ejemplo).toHaveLength(3)
  })
})

describe('isDressCodeConfigured', () => {
  it('default -> false', () => {
    expect(isDressCodeConfigured(defaultDressCode())).toBe(false)
  })
  it('con nivel -> true', () => {
    expect(isDressCodeConfigured({ ...defaultDressCode(), nivel: 'formal' })).toBe(true)
  })
  it('solo nota libre con espacios -> false', () => {
    expect(isDressCodeConfigured({ ...defaultDressCode(), nota_libre: '   ' })).toBe(false)
  })
})

describe('resolveNivelLabel', () => {
  it('mapea id a etiqueta legible', () => {
    expect(resolveNivelLabel({ ...defaultDressCode(), nivel: 'coctel' })).toBe('Cóctel')
  })
  it('tematico usa nivel_custom', () => {
    expect(resolveNivelLabel({ ...defaultDressCode(), nivel: 'tematico', nivel_custom: 'Años 20' })).toBe('Años 20')
  })
  it('sin nivel -> null', () => {
    expect(resolveNivelLabel(defaultDressCode())).toBeNull()
  })
})

describe('buildDressCodeText', () => {
  it('arma texto con secciones presentes', () => {
    const dc: DressCode = {
      ...defaultDressCode(),
      nivel: 'coctel',
      colores_sugeridos: [{ hex: '#3A5A40', nombre: 'Salvia' }, { hex: '#DAD7CD', nombre: 'Arena' }],
      colores_evitar: [{ hex: '#FFFFFF', nombre: 'Blanco' }],
      recomendaciones: ['Tacón bajo, es jardín'],
    }
    const txt = buildDressCodeText(dc, { eventName: 'Boda Ana & Luis' })
    expect(txt).toContain('Boda Ana & Luis')
    expect(txt).toContain('Cóctel')
    expect(txt).toContain('Salvia')
    expect(txt).toContain('Arena')
    expect(txt).toContain('Blanco')
    expect(txt).toContain('Tacón bajo, es jardín')
  })

  it('omite secciones vacias', () => {
    const txt = buildDressCodeText({ ...defaultDressCode(), nivel: 'formal' })
    expect(txt).toContain('Formal')
    expect(txt).not.toContain('Colores sugeridos')
    expect(txt).not.toContain('Evita')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dresscode`
Expected: FAIL con "Cannot find module './dresscode'" (o export inexistente).

- [ ] **Step 3: Write minimal implementation**

Create `lib/dresscode.ts`:

```ts
export type DressCodeNivel =
  | 'casual'
  | 'casual_elegante'
  | 'coctel'
  | 'formal'
  | 'etiqueta'
  | 'tematico'

export type DressCodeColor = { hex: string; nombre: string }

export type DressCode = {
  nivel: DressCodeNivel | null
  nivel_custom: string | null
  colores_sugeridos: DressCodeColor[]
  colores_evitar: DressCodeColor[]
  recomendaciones: string[]
  nota_libre: string
  guia_ellas: string | null
  guia_ellos: string | null
  fotos_ejemplo: string[]
}

export const NIVELES: { id: DressCodeNivel; label: string; desc: string }[] = [
  { id: 'casual',          label: 'Casual',          desc: 'Cómodo y relajado' },
  { id: 'casual_elegante', label: 'Casual elegante', desc: 'Arreglado sin exagerar' },
  { id: 'coctel',          label: 'Cóctel',          desc: 'Vestido corto o traje' },
  { id: 'formal',          label: 'Formal',          desc: 'Vestido largo o traje oscuro' },
  { id: 'etiqueta',        label: 'Etiqueta',        desc: 'Smoking o gala' },
  { id: 'tematico',        label: 'Temático',        desc: 'Tú defines el código' },
]

export const RECOMENDACIONES_SUGERIDAS: string[] = [
  'Tacón bajo, es jardín',
  'Lleva abrigo, refresca de noche',
  'Evita blanco',
  'Ceremonia religiosa',
  'Alberca o playa',
]

const NIVEL_IDS = new Set(NIVELES.map(n => n.id))
const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/

export function defaultDressCode(): DressCode {
  return {
    nivel: null,
    nivel_custom: null,
    colores_sugeridos: [],
    colores_evitar: [],
    recomendaciones: [],
    nota_libre: '',
    guia_ellas: null,
    guia_ellos: null,
    fotos_ejemplo: [],
  }
}

function parseColors(raw: unknown): DressCodeColor[] {
  if (!Array.isArray(raw)) return []
  const out: DressCodeColor[] = []
  for (const c of raw) {
    if (c && typeof c === 'object' && typeof (c as any).hex === 'string' && HEX_RE.test((c as any).hex)) {
      out.push({ hex: (c as any).hex, nombre: typeof (c as any).nombre === 'string' ? (c as any).nombre : '' })
    }
  }
  return out
}

function parseStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string')
}

export function parseDressCode(raw: unknown): DressCode {
  if (!raw || typeof raw !== 'object') return defaultDressCode()
  const r = raw as Record<string, unknown>
  const nivel = typeof r.nivel === 'string' && NIVEL_IDS.has(r.nivel as DressCodeNivel)
    ? (r.nivel as DressCodeNivel)
    : null
  return {
    nivel,
    nivel_custom: typeof r.nivel_custom === 'string' ? r.nivel_custom : null,
    colores_sugeridos: parseColors(r.colores_sugeridos),
    colores_evitar: parseColors(r.colores_evitar),
    recomendaciones: parseStrings(r.recomendaciones),
    nota_libre: typeof r.nota_libre === 'string' ? r.nota_libre : '',
    guia_ellas: typeof r.guia_ellas === 'string' ? r.guia_ellas : null,
    guia_ellos: typeof r.guia_ellos === 'string' ? r.guia_ellos : null,
    fotos_ejemplo: parseStrings(r.fotos_ejemplo).slice(0, 3),
  }
}

export function isDressCodeConfigured(dc: DressCode): boolean {
  return Boolean(
    dc.nivel ||
    dc.colores_sugeridos.length ||
    dc.colores_evitar.length ||
    dc.recomendaciones.length ||
    dc.nota_libre.trim() ||
    (dc.guia_ellas && dc.guia_ellas.trim()) ||
    (dc.guia_ellos && dc.guia_ellos.trim()) ||
    dc.fotos_ejemplo.length,
  )
}

export function resolveNivelLabel(dc: DressCode): string | null {
  if (!dc.nivel) return null
  if (dc.nivel === 'tematico') return dc.nivel_custom?.trim() || 'Temático'
  return NIVELES.find(n => n.id === dc.nivel)?.label ?? null
}

export function resolveNivelDesc(dc: DressCode): string | null {
  if (!dc.nivel || dc.nivel === 'tematico') return null
  return NIVELES.find(n => n.id === dc.nivel)?.desc ?? null
}

function colorNames(colors: DressCodeColor[]): string {
  return colors.map(c => c.nombre.trim() || c.hex).join(', ')
}

export function buildDressCodeText(dc: DressCode, opts: { eventName?: string } = {}): string {
  const lines: string[] = []
  const header = opts.eventName ? `Código de vestimenta — ${opts.eventName}` : 'Código de vestimenta'
  lines.push(header)
  const label = resolveNivelLabel(dc)
  if (label) {
    const desc = resolveNivelDesc(dc)
    lines.push(desc ? `Nivel: ${label} (${desc.toLowerCase()})` : `Nivel: ${label}`)
  }
  if (dc.colores_sugeridos.length) lines.push(`Colores sugeridos: ${colorNames(dc.colores_sugeridos)}`)
  if (dc.colores_evitar.length) lines.push(`Evita: ${colorNames(dc.colores_evitar)}`)
  if (dc.recomendaciones.length) lines.push(`Notas: ${dc.recomendaciones.join('. ')}.`)
  if (dc.nota_libre.trim()) lines.push(dc.nota_libre.trim())
  return lines.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dresscode`
Expected: PASS (todos los describes verdes).

- [ ] **Step 5: Commit**

```bash
git add lib/dresscode.ts lib/dresscode.test.ts
git commit -m "feat(vestimenta): logica pura del codigo de vestimenta (parse, labels, texto copiable)"
```

---

### Task 2: Tipo en `event_settings` + grupo de nav "Estilo" + ruta

**Files:**
- Modify: `lib/types.ts` (agregar `dress_code` a `EventSettings`)
- Modify: `app/events/[id]/layout.tsx` (grupo de nav "Estilo")
- Create: `app/events/[id]/vestimenta/page.tsx` (shell que carga/guarda + monta editor y preview)
- Create: `app/events/[id]/vestimenta/DressCodeEditor.tsx` (placeholder mínimo esta task)
- Create: `app/events/[id]/vestimenta/DressCodePreview.tsx` (placeholder mínimo esta task)

**Interfaces:**
- Consumes: `DressCode`, `defaultDressCode`, `parseDressCode` de `lib/dresscode.ts`.
- Produces: ruta navegable `/events/[id]/vestimenta` con estado `dc: DressCode`, `setDc`, y guardado a `event_settings.dress_code`.

- [ ] **Step 1: Agregar el campo al tipo `EventSettings`**

En `lib/types.ts`, dentro del tipo `EventSettings` (después de `enabled_features`), agregar:

```ts
  dress_code: import('./dresscode').DressCode | null
```

(Import inline para no reordenar imports del archivo compartido.)

- [ ] **Step 2: Agregar el grupo de nav "Estilo"**

En `app/events/[id]/layout.tsx`:

2a. En el import de `lucide-react` (línea 6), agregar `Shirt` y `Palette` a la lista.

2b. En `NAV_ITEMS`, insertar este grupo **antes** del item `Configuracion` (después del grupo `Recuerdos`):

```tsx
  {
    type: 'group',
    label: 'Estilo', labelMobile: 'Estilo',
    defaultPath: '/vestimenta',
    iconOutline: <Palette width={18} height={18} strokeWidth={1.5} />,
    iconFilled:  <Palette width={18} height={18} strokeWidth={2.5} />,
    children: [
      {
        label: 'Codigo de vestimenta', labelMobile: 'Vestimenta', path: '/vestimenta',
        iconOutline: <Shirt width={18} height={18} strokeWidth={1.5} />,
        iconFilled:  <Shirt width={18} height={18} strokeWidth={2.5} />,
      },
    ],
  },
```

Nota: el sub-item "Moodboard" se agregará aquí cuando se construya esa feature. `labelMobile` en `NavSubItem` es opcional; el bottom-nav usa `child.label`, así que el label debe ser corto — se deja "Codigo de vestimenta" (el nav lo maneja; si se ve largo en mobile se ajusta luego). Sin acentos en estos labels porque conviven con el resto del archivo que hoy no usa acentos en `NAV_ITEMS`.

- [ ] **Step 3: Crear placeholders de editor y preview**

Create `app/events/[id]/vestimenta/DressCodeEditor.tsx`:

```tsx
'use client'
import type { DressCode } from '@/lib/dresscode'

export default function DressCodeEditor({ dc }: { dc: DressCode; onChange: (next: DressCode) => void }) {
  return <div className="text-sm text-[#999]">Editor en construcción ({dc.nivel ?? 'sin nivel'})</div>
}
```

Create `app/events/[id]/vestimenta/DressCodePreview.tsx`:

```tsx
'use client'
import type { DressCode } from '@/lib/dresscode'

export default function DressCodePreview({ dc }: { dc: DressCode; eventName: string }) {
  return <div className="text-sm text-[#999]">Vista previa en construcción ({dc.nivel ?? 'sin nivel'})</div>
}
```

- [ ] **Step 4: Crear la página shell con carga/guardado**

Create `app/events/[id]/vestimenta/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { parseDressCode, defaultDressCode, type DressCode } from '@/lib/dresscode'
import DressCodeEditor from './DressCodeEditor'
import DressCodePreview from './DressCodePreview'

export default function VestimentaPage() {
  const { id } = useParams()
  const [dc, setDc] = useState<DressCode>(defaultDressCode())
  const [eventName, setEventName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: ev }, { data: settings }] = await Promise.all([
        supabase.from('events').select('name').eq('id', id).single(),
        supabase.from('event_settings').select('dress_code').eq('event_id', id).maybeSingle(),
      ])
      if (ev) setEventName(ev.name)
      setDc(parseDressCode(settings?.dress_code))
      setLoading(false)
    }
    load()
  }, [id])

  const save = async () => {
    setSaving(true)
    await supabase
      .from('event_settings')
      .upsert({ event_id: id, dress_code: dc, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1D1E20]">Código de vestimenta</h1>
            <p className="mt-0.5 text-sm text-[#888]">Define qué ponerse. Se comparte en la invitación y como texto.</p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-[#e8e8e8] bg-white p-5">
            <DressCodeEditor dc={dc} onChange={setDc} />
          </div>
          <div>
            <DressCodePreview dc={dc} eventName={eventName} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verificar build + nav manual**

Run: `npm run build`
Expected: build limpio (sin errores de tipos).
Verificación manual (dev): abrir un evento → el sidebar muestra grupo **Estilo → Código de vestimenta** → navega a `/events/{id}/vestimenta` → se ve el encabezado, botón Guardar, y placeholders. Guardar no truena (aunque la columna aún no exista en Supabase local, el error se ignora en UI; si tienes DB local con la columna, persiste).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts app/events/[id]/layout.tsx app/events/[id]/vestimenta/
git commit -m "feat(vestimenta): grupo de nav Estilo + ruta con carga y guardado de dress_code"
```

---

### Task 3: Editor completo (`DressCodeEditor.tsx`)

**Files:**
- Modify: `app/events/[id]/vestimenta/DressCodeEditor.tsx`

**Interfaces:**
- Consumes: `DressCode`, `NIVELES`, `RECOMENDACIONES_SUGERIDAS`, `type DressCodeColor` de `lib/dresscode.ts`; prop `onChange: (next: DressCode) => void`.
- Produces: edición completa de todos los campos vía `onChange`.

- [ ] **Step 1: Implementar el editor**

Reemplazar `app/events/[id]/vestimenta/DressCodeEditor.tsx` por:

```tsx
'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { NIVELES, RECOMENDACIONES_SUGERIDAS, type DressCode, type DressCodeColor } from '@/lib/dresscode'

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#999]">{label}</p>
      {children}
    </div>
  )
}

function ColorRow({
  colors, onChange, avoid,
}: { colors: DressCodeColor[]; onChange: (next: DressCodeColor[]) => void; avoid?: boolean }) {
  const add = () => onChange([...colors, { hex: '#d4a853', nombre: '' }])
  const remove = (i: number) => onChange(colors.filter((_, idx) => idx !== i))
  const update = (i: number, patch: Partial<DressCodeColor>) =>
    onChange(colors.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))

  return (
    <div className="flex flex-wrap items-start gap-3">
      {colors.map((c, i) => (
        <div key={i} className="relative">
          <label
            className={`block h-11 w-11 cursor-pointer rounded-lg border ${avoid ? 'border-[#ffc0c0]' : 'border-black/10'}`}
            style={{ background: c.hex }}
          >
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#d4a853'}
              onChange={e => update(i, { hex: e.target.value })}
              className="h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <input
            value={c.nombre}
            onChange={e => update(i, { nombre: e.target.value })}
            placeholder="Nombre"
            className="mt-1 w-16 rounded border border-[#e8e8e8] px-1 py-0.5 text-[10px] text-[#666] focus:border-[#48C9B0] focus:outline-none"
          />
          <button
            onClick={() => remove(i)}
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#e8e8e8] bg-white text-[#999] hover:text-[#cc3333]"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex h-11 w-11 items-center justify-center rounded-lg border-2 border-dashed border-[#e0e0e0] text-[#bbb] hover:border-[#48C9B0] hover:text-[#48C9B0]"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

export default function DressCodeEditor({
  dc, onChange,
}: { dc: DressCode; onChange: (next: DressCode) => void }) {
  const [nuevaRec, setNuevaRec] = useState('')
  const patch = (p: Partial<DressCode>) => onChange({ ...dc, ...p })

  const toggleRec = (rec: string) => {
    patch({
      recomendaciones: dc.recomendaciones.includes(rec)
        ? dc.recomendaciones.filter(r => r !== rec)
        : [...dc.recomendaciones, rec],
    })
  }
  const addRec = () => {
    const v = nuevaRec.trim()
    if (v && !dc.recomendaciones.includes(v)) patch({ recomendaciones: [...dc.recomendaciones, v] })
    setNuevaRec('')
  }

  const chips = Array.from(new Set([...RECOMENDACIONES_SUGERIDAS, ...dc.recomendaciones]))

  return (
    <div>
      <Section label="Nivel de formalidad">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NIVELES.map(n => {
            const on = dc.nivel === n.id
            return (
              <button
                key={n.id}
                onClick={() => patch({ nivel: on ? null : n.id })}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  on ? 'border-[#d4a853] bg-[#fffbf0]' : 'border-[#e8e8e8] hover:border-[#d4a853]/60'
                }`}
              >
                <p className="text-[13px] font-bold text-[#1D1E20]">{n.label}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-[#888]">{n.desc}</p>
              </button>
            )
          })}
        </div>
        {dc.nivel === 'tematico' && (
          <input
            value={dc.nivel_custom ?? ''}
            onChange={e => patch({ nivel_custom: e.target.value })}
            placeholder="Describe el tema (ej. Años 20, Blanco total...)"
            className="mt-3 w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none"
          />
        )}
      </Section>

      <Section label="Colores sugeridos">
        <ColorRow colors={dc.colores_sugeridos} onChange={c => patch({ colores_sugeridos: c })} />
      </Section>

      <Section label="Colores a evitar">
        <ColorRow colors={dc.colores_evitar} onChange={c => patch({ colores_evitar: c })} avoid />
      </Section>

      <Section label="Recomendaciones rápidas">
        <div className="flex flex-wrap gap-2">
          {chips.map(rec => {
            const on = dc.recomendaciones.includes(rec)
            return (
              <button
                key={rec}
                onClick={() => toggleRec(rec)}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition ${
                  on ? 'border-[#d4a853] bg-[#fffbf0] text-[#1D1E20]' : 'border-[#e8e8e8] text-[#888] hover:border-[#d4a853]/60'
                }`}
              >
                {rec}
              </button>
            )
          })}
        </div>
        <div className="mt-2.5 flex gap-2">
          <input
            value={nuevaRec}
            onChange={e => setNuevaRec(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRec())}
            placeholder="Agregar recomendación propia"
            className="flex-1 rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none"
          />
          <button onClick={addRec} className="rounded-lg border border-[#e8e8e8] px-3 text-sm text-[#666] hover:border-[#48C9B0]">
            Agregar
          </button>
        </div>
      </Section>

      <Section label="Nota libre">
        <textarea
          value={dc.nota_libre}
          onChange={e => patch({ nota_libre: e.target.value })}
          rows={3}
          placeholder="Ej. El jardín es de pasto natural, considera el tipo de zapato."
          className="w-full resize-y rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none"
        />
      </Section>

      <Section label="Guía por género (opcional)">
        <div className="grid gap-3 sm:grid-cols-2">
          <textarea
            value={dc.guia_ellas ?? ''}
            onChange={e => patch({ guia_ellas: e.target.value || null })}
            rows={2}
            placeholder="Para ellas..."
            className="w-full resize-y rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none"
          />
          <textarea
            value={dc.guia_ellos ?? ''}
            onChange={e => patch({ guia_ellos: e.target.value || null })}
            rows={2}
            placeholder="Para ellos..."
            className="w-full resize-y rounded-lg border border-[#e8e8e8] px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none"
          />
        </div>
      </Section>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build + manual**

Run: `npm run build`
Expected: build limpio.
Manual (dev): en `/vestimenta`, seleccionar nivel (toggle on/off, "Temático" muestra input), agregar/quitar colores y editar su hex+nombre, activar chips y agregar uno propio, escribir nota y guías. Guardar y recargar: el estado persiste (si la columna existe en tu DB local).

- [ ] **Step 3: Commit**

```bash
git add app/events/[id]/vestimenta/DressCodeEditor.tsx
git commit -m "feat(vestimenta): editor completo (nivel, colores, recomendaciones, notas, guia por genero)"
```

---

### Task 4: Vista previa del invitado + "Copiar como texto" (`DressCodePreview.tsx`)

**Files:**
- Modify: `app/events/[id]/vestimenta/DressCodePreview.tsx`

**Interfaces:**
- Consumes: `DressCode`, `isDressCodeConfigured`, `resolveNivelLabel`, `resolveNivelDesc`, `buildDressCodeText` de `lib/dresscode.ts`; props `dc`, `eventName`.

- [ ] **Step 1: Implementar el preview + copiar**

Reemplazar `app/events/[id]/vestimenta/DressCodePreview.tsx` por:

```tsx
'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import {
  isDressCodeConfigured, resolveNivelLabel, resolveNivelDesc, buildDressCodeText,
  type DressCode,
} from '@/lib/dresscode'

export default function DressCodePreview({ dc, eventName }: { dc: DressCode; eventName: string }) {
  const [copied, setCopied] = useState(false)
  const configured = isDressCodeConfigured(dc)
  const label = resolveNivelLabel(dc)
  const desc = resolveNivelDesc(dc)

  const copy = async () => {
    await navigator.clipboard.writeText(buildDressCodeText(dc, { eventName }))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="sticky top-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#999]">Vista del invitado</p>
        <button
          onClick={copy}
          disabled={!configured}
          className="flex items-center gap-1.5 rounded-lg border border-[#e8e8e8] px-2.5 py-1.5 text-xs font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0] disabled:opacity-50"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copiado' : 'Copiar texto'}
        </button>
      </div>

      <div className="rounded-2xl border border-[#e8e8e8] bg-[#f8f8f8] p-2.5">
        {!configured ? (
          <div className="rounded-xl border border-dashed border-[#e0e0e0] bg-white px-4 py-10 text-center text-sm text-[#bbb]">
            Configura el código para ver la vista previa
          </div>
        ) : (
          <div className="rounded-xl border border-[#e8e8e8] bg-white px-4 py-5 text-center">
            <p className="text-[11px] tracking-wide text-[#888]">{eventName.toUpperCase()}</p>
            {label && <p className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#1D1E20]">{label}</p>}
            {desc && <p className="text-xs text-[#888]">{desc}</p>}

            {dc.colores_sugeridos.length > 0 && (
              <>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#999]">Colores sugeridos</p>
                <div className="mt-2 flex justify-center gap-2">
                  {dc.colores_sugeridos.map((c, i) => (
                    <span key={i} className="h-6 w-6 rounded-full border border-black/10" style={{ background: c.hex }} title={c.nombre} />
                  ))}
                </div>
              </>
            )}

            {dc.colores_evitar.length > 0 && (
              <>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#999]">Evita</p>
                <div className="mt-2 flex justify-center gap-2">
                  {dc.colores_evitar.map((c, i) => (
                    <span key={i} className="h-6 w-6 rounded-full border border-[#e0e0e0]" style={{ background: c.hex }} title={c.nombre} />
                  ))}
                </div>
              </>
            )}

            {dc.recomendaciones.length > 0 && (
              <p className="mt-4 rounded-lg border border-[#f0e2bf] bg-[#fffbf0] px-3 py-2 text-left text-xs leading-relaxed text-[#1D1E20]">
                {dc.recomendaciones.join('. ')}.
              </p>
            )}

            {dc.nota_libre.trim() && (
              <p className="mt-2 text-left text-xs leading-relaxed text-[#666]">{dc.nota_libre}</p>
            )}

            {(dc.guia_ellas?.trim() || dc.guia_ellos?.trim()) && (
              <div className="mt-3 grid gap-2 text-left sm:grid-cols-2">
                {dc.guia_ellas?.trim() && (
                  <div className="rounded-lg bg-[#f8f8f8] px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Ellas</p>
                    <p className="mt-0.5 text-xs text-[#666]">{dc.guia_ellas}</p>
                  </div>
                )}
                {dc.guia_ellos?.trim() && (
                  <div className="rounded-lg bg-[#f8f8f8] px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Ellos</p>
                    <p className="mt-0.5 text-xs text-[#666]">{dc.guia_ellos}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build + manual**

Run: `npm run build`
Expected: build limpio.
Manual (dev): con el editor, ver que el preview refleja en vivo nivel/colores/recomendaciones/notas/guías; con todo vacío muestra el estado "Configura el código..."; "Copiar texto" copia el mensaje (pegar en cualquier campo para verificar). En mobile, el preview aparece debajo del editor.

- [ ] **Step 3: Commit**

```bash
git add app/events/[id]/vestimenta/DressCodePreview.tsx
git commit -m "feat(vestimenta): vista del invitado en vivo + copiar como texto"
```

---

### Task 5: Fotos de ejemplo (Supabase Storage)

**Files:**
- Modify: `app/events/[id]/vestimenta/DressCodeEditor.tsx` (sección de fotos)

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; bucket público `event-media`, ruta `dress-code/{eventId}/{timestamp-filename}`.
- Produces: `dc.fotos_ejemplo` como array de URLs públicas (máx. 3).

- [ ] **Step 1: Agregar sección de fotos al editor**

En `app/events/[id]/vestimenta/DressCodeEditor.tsx`:

1a. Ampliar imports:
```tsx
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { X, Plus, ImagePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
```

1b. Dentro del componente, agregar estado de subida y handler (después de `const patch = ...`):
```tsx
  const { id } = useParams()
  const [uploading, setUploading] = useState(false)

  const uploadFoto = async (file: File) => {
    if (dc.fotos_ejemplo.length >= 3) return
    setUploading(true)
    const path = `dress-code/${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { error } = await supabase.storage.from('event-media').upload(path, file, { upsert: false })
    if (!error) {
      const { data } = supabase.storage.from('event-media').getPublicUrl(path)
      patch({ fotos_ejemplo: [...dc.fotos_ejemplo, data.publicUrl] })
    }
    setUploading(false)
  }
```

1c. Agregar esta `Section` justo antes del cierre del `return` (después de la guía por género):
```tsx
      <Section label="Fotos de ejemplo (opcional)">
        <div className="flex flex-wrap gap-3">
          {dc.fotos_ejemplo.map((url, i) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-[#e8e8e8]">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => patch({ fotos_ejemplo: dc.fotos_ejemplo.filter((_, idx) => idx !== i) })}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[#999] hover:text-[#cc3333]"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {dc.fotos_ejemplo.length < 3 && (
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[#e0e0e0] text-[#bbb] hover:border-[#48C9B0] hover:text-[#48C9B0]">
              <ImagePlus size={18} />
              <span className="text-[10px]">{uploading ? 'Subiendo...' : 'Subir'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f); e.target.value = '' }}
              />
            </label>
          )}
        </div>
      </Section>
```

- [ ] **Step 2: Mostrar fotos en el preview**

En `app/events/[id]/vestimenta/DressCodePreview.tsx`, antes del cierre del bloque `configured`, agregar (después de las guías por género):
```tsx
            {dc.fotos_ejemplo.length > 0 && (
              <div className="mt-3 flex justify-center gap-2">
                {dc.fotos_ejemplo.map((url, i) => (
                  <img key={i} src={url} alt="" className="h-16 w-16 rounded-lg border border-[#e8e8e8] object-cover" />
                ))}
              </div>
            )}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build limpio. (La verificación real de subida es manual y requiere el bucket `event-media` creado en Supabase; se prueba en preview tras el push — ver §Verificación.)

- [ ] **Step 4: Commit**

```bash
git add app/events/[id]/vestimenta/DressCodeEditor.tsx app/events/[id]/vestimenta/DressCodePreview.tsx
git commit -m "feat(vestimenta): fotos de ejemplo con subida a Storage y preview"
```

---

## Verificación (local → preview → main)

1. `npm test -- dresscode` verde.
2. `npm run build` limpio.
3. Local (localhost:3000): nav muestra **Estilo → Código de vestimenta**; editar todos los campos; preview en vivo; "Copiar texto" produce el mensaje esperado.
4. **Tras push**, Diego aplica en Supabase (regla de sincronía):
   - `ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS dress_code JSONB;`
   - Crear bucket **público** `event-media` (si no existe) con política de subida para usuarios autenticados; las fotos se sirven por URL pública para que la invitación las muestre.
5. Preview (Vercel): probar guardado real, subida de fotos, recarga persiste, y abrir la invitación RSVP del evento para confirmar que la sección de dress code se renderiza (cuando esa feature consuma `lib/dresscode.ts`).
6. Merge a main.

## Coordinación con features en paralelo

- `event_settings.dress_code` es el contrato que la invitación RSVP lee (spec RSVP §5/§12). La invitación importará `lib/dresscode.ts` (`parseDressCode`, `resolveNivelLabel`, etc.) para renderizar; no reimplementa el formato.
- Archivos compartidos tocados: `lib/types.ts` (una línea aditiva en `EventSettings`) y `app/events/[id]/layout.tsx` (grupo de nav). Coordinar orden de merge con RSVP/itinerario para evitar conflictos.
- El sub-item **Moodboard** se agregará al grupo "Estilo" cuando esa feature se construya (spec aparte).
- **Diferido:** el botón "Jalar paleta del moodboard" (spec §3/§4) queda fuera de esta v1 porque el moodboard aún no existe y su paleta (`event_settings.moodboard_palette`) todavía no se crea. Se agrega al editor cuando el moodboard aterrice.
