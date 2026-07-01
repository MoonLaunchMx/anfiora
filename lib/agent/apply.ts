import type { AttentionReason, PartyMember } from '@/lib/types'

export type ExtractionResult = {
  attendance: 'confirmed' | 'declined' | 'none'
  companions: { action: 'all' | 'none' | 'named' | 'partial_ambiguous'; names: string[] }
  allergies: Array<{ who: 'titular' | 'companion' | 'unknown'; name: string; text: string }>
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
  const memberUpdates = new Map<string, WritePlan['partyMemberUpdates'][number]>()
  const summary: AppliedSummary = {
    confirmedGuest: false, declinedGuest: false, confirmedCompanions: 0, capturedAllergies: 0, flagged: null,
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
        if (found) { ensure(found.id).rsvp_status = 'confirmed'; summary.confirmedCompanions++ }
        else escalations.push('peticion')
      }
      break
    case 'partial_ambiguous':
      escalations.push('peticion')
      break
  }

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

export function renderAppliedActions(applied?: AppliedSummary | null): string {
  if (!applied) return ''
  const lines: string[] = []
  if (applied.confirmedGuest) lines.push('- Se confirmo la asistencia del invitado titular.')
  if (applied.declinedGuest) lines.push('- Se registro que el invitado titular no podra asistir.')
  if (applied.confirmedCompanions > 0) lines.push(`- Se confirmo la asistencia de ${applied.confirmedCompanions} acompanante(s).`)
  if (applied.capturedAllergies > 0) lines.push('- Se tomo nota de una alergia o restriccion alimentaria; el organizador la tendra presente.')
  if (!lines.length) return ''
  return `\n--- Acciones ya realizadas en este turno (son verdaderas; puedes mencionarlas con naturalidad al invitado) ---\n${lines.join('\n')}`
}
