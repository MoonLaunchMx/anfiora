import { CONTENT_BY_TYPE, SectionSchema, MetaSchema } from './schema'
import type { InviteDoc, InviteMeta, Section, SectionType } from './schema'
import { ThemeSchema, DEFAULT_THEME, type Theme } from './theme'
import { getVibe } from './vibes'

const DEFAULT_ORDER: SectionType[] = [
  'portada', 'saludo', 'detalles', 'itinerario', 'dress_code', 'rsvp', 'playlist', 'mesa', 'cierre',
]

// El bloque 'enganche' (playlist + mesa juntos) se separo en dos bloques.
// Los docs viejos se expanden a 'playlist' y 'mesa' segun sus toggles, en su lugar.
function migrateEngancheSections(sections: Section[], makeId: () => string): Section[] {
  const out: Section[] = []
  for (const s of sections) {
    if (s.type === 'enganche') {
      if (s.content.mostrar_playlist) out.push(emptySection('playlist', makeId()))
      if (s.content.mostrar_mesa) out.push(emptySection('mesa', makeId()))
    } else {
      out.push(s)
    }
  }
  return out
}

export function emptySection(type: SectionType, id: string): Section {
  return { id, type, content: CONTENT_BY_TYPE[type].parse({}) } as Section
}

export function defaultDoc(makeId: () => string): InviteDoc {
  return {
    v: 2,
    meta: MetaSchema.parse({}),
    theme: DEFAULT_THEME,
    sections: DEFAULT_ORDER.map(t => emptySection(t, makeId())),
  }
}

export function resolveDoc(raw: unknown, makeId: () => string): InviteDoc {
  if (!raw || typeof raw !== 'object') return defaultDoc(makeId)
  const r = raw as Record<string, unknown>
  const rawSections = Array.isArray(r.sections) ? r.sections : []
  const seen = new Set<string>()
  const parsedSections: Section[] = []
  for (const s of rawSections) {
    const parsed = SectionSchema.safeParse(s)
    if (!parsed.success) continue
    if (seen.has(parsed.data.id)) continue
    seen.add(parsed.data.id)
    parsedSections.push(parsed.data)
  }
  if (parsedSections.length === 0) return defaultDoc(makeId)
  const sections = migrateEngancheSections(parsedSections, makeId)
  const metaParsed = MetaSchema.safeParse(r.meta)
  const meta: InviteMeta = metaParsed.success ? metaParsed.data : MetaSchema.parse({})
  const themeParsed = ThemeSchema.safeParse(r.theme)
  const theme = themeParsed.success ? themeParsed.data : DEFAULT_THEME
  return { v: 2, meta, theme, sections }
}

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

// Siembra los 3 numericos desde columnas (modelo previo a esta feature),
// preservando el resto de meta.access DE ESTE DOC (cobro_payment_methods
// incluido). Llamar por separado para draft y config: un objeto compartido
// entre ambos pisaria la cuenta de cobro del que se llame despues.
export function seedAccessFromColumns(
  doc: InviteDoc,
  cols: { guest_cap: number | null; ticket_price: number | null; max_companions: number | null },
): InviteDoc {
  return setMeta(doc, {
    access: {
      ...doc.meta.access,
      guest_cap: cols.guest_cap,
      ticket_price: cols.ticket_price,
      max_companions: cols.max_companions,
    },
  })
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export function applyVibe(doc: InviteDoc, vibeId: string): InviteDoc {
  const theme = ThemeSchema.parse(getVibe(vibeId).theme)
  return { ...doc, theme }
}

export function setTheme(doc: InviteDoc, patch: DeepPartial<Theme>): InviteDoc {
  const t = doc.theme
  const merged = {
    ...t,
    ...patch,
    colores: { ...t.colores, ...(patch.colores ?? {}) },
    fonts: { ...t.fonts, ...(patch.fonts ?? {}) },
    boton: { ...t.boton, ...(patch.boton ?? {}) },
    fondo: { ...t.fondo, ...(patch.fondo ?? {}) },
    anim: { ...t.anim, ...(patch.anim ?? {}) },
    carrusel: { ...t.carrusel, ...(patch.carrusel ?? {}) },
    copy: { ...t.copy, ...(patch.copy ?? {}) },
  }
  return { ...doc, theme: ThemeSchema.parse(merged) }
}
