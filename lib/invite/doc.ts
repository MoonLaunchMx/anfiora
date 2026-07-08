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
