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
