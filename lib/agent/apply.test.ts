import { describe, it, expect } from 'vitest'
import { applyExtraction, renderAppliedActions, type ExtractionResult } from './apply'
import type { PartyMember } from '@/lib/types'

const base: ExtractionResult = {
  attendance: 'none', companions: { action: 'none', names: [] },
  allergies: [], complaint: false, confidence: 'high',
}
const member = (id: string, name: string, extra: Partial<PartyMember> = {}): PartyMember => ({
  id, guest_id: 'g1', event_id: 'e1', name, rsvp_status: 'pending', ...extra,
})
const guest = (over: Partial<{ rsvp_status: string; allergies: string[] | null }> = {}) =>
  ({ rsvp_status: 'pending', allergies: null, ...over })

describe('applyExtraction — asistencia', () => {
  it('confirma al titular', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed' }, guest(), [])
    expect(p.guestUpdate?.rsvp_status).toBe('confirmed')
    expect(p.appliedSummary.confirmedGuest).toBe(true)
  })
  it('no reescribe si ya estaba confirmado', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed' }, guest({ rsvp_status: 'confirmed' }), [])
    expect(p.guestUpdate?.rsvp_status).toBeUndefined()
    expect(p.appliedSummary.confirmedGuest).toBe(true)
  })
  it('attendance none no toca asistencia', () => {
    expect(applyExtraction(base, guest(), []).guestUpdate).toBeNull()
  })
})

describe('applyExtraction — acompanantes', () => {
  const members = [member('m1', 'Ana'), member('m2', 'Luis')]
  it('all confirma a todos', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'all', names: [] } }, guest(), members)
    expect(p.partyMemberUpdates.map(u => u.id).sort()).toEqual(['m1', 'm2'])
    expect(p.partyMemberUpdates.every(u => u.rsvp_status === 'confirmed')).toBe(true)
    expect(p.appliedSummary.confirmedCompanions).toBe(2)
  })
  it('none deja acompanantes intactos', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'none', names: [] } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
  })
  it('named confirma solo los que existen y escala los extra', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'named', names: ['Ana', 'Primo Pedro'] } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', rsvp_status: 'confirmed' }])
    expect(p.appliedSummary.confirmedCompanions).toBe(1)
    expect(p.escalations).toContain('peticion')
  })
  it('partial_ambiguous no toca acompanantes y escala', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'partial_ambiguous', names: [] } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.escalations).toContain('peticion')
    expect(p.guestUpdate?.attention_reason).toBe('peticion')
  })
})

describe('applyExtraction — alergias', () => {
  const members = [member('m1', 'Ana')]
  it('titular escribe en guests.allergies', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'titular', name: '', text: 'mariscos' }] }, guest(), members)
    expect(p.guestUpdate?.allergies).toEqual(['mariscos'])
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
    expect(p.appliedSummary.capturedAllergies).toBe(1)
  })
  it('companion con nombre que existe escribe en su ficha', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'companion', name: 'Ana', text: 'gluten' }] }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', allergies: ['gluten'] }])
    expect(p.appliedSummary.capturedAllergies).toBe(1)
  })
  it('companion sin match no escribe, solo escala', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'companion', name: 'Esposa', text: 'gluten' }] }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.allergies).toBeUndefined()
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
  })
  it('unknown no escribe, solo escala', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'unknown', name: '', text: 'nueces' }] }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
  })
  it('no duplica una alergia que ya tenia el titular', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'titular', name: '', text: 'mariscos' }] }, guest({ allergies: ['mariscos'] }), members)
    expect(p.guestUpdate?.allergies).toEqual(['mariscos'])
  })
})

describe('applyExtraction — confianza y prioridad', () => {
  it('low confidence no escribe al corazon, solo escala duda', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'all', names: [] }, allergies: [{ who: 'titular', name: '', text: 'x' }], confidence: 'low' }, guest(), [member('m1', 'Ana')])
    expect(p.guestUpdate?.rsvp_status).toBeUndefined()
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.attention_reason).toBe('duda')
    expect(p.escalations).toContain('baja_confianza')
  })
  it('prioridad alergia sobre queja', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'titular', name: '', text: 'x' }], complaint: true }, guest(), [])
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
  })
  it('queja sin alergia levanta queja', () => {
    expect(applyExtraction({ ...base, complaint: true }, guest(), []).guestUpdate?.attention_reason).toBe('queja')
  })
})

describe('applyExtraction — regresion findMember y conteo', () => {
  it('no escribe alergia a un nombre que solo coincide por subcadena (Ana vs Mariana)', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'companion', name: 'Ana', text: 'gluten' }] }, guest(), [member('m1', 'Mariana')])
    expect(p.partyMemberUpdates).toEqual([])
    expect(p.guestUpdate?.attention_reason).toBe('alergia')
  })
  it('named con nombre duplicado no doble-cuenta acompanantes', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'named', names: ['Ana', 'Ana'] } }, guest(), [member('m1', 'Ana')])
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', rsvp_status: 'confirmed' }])
    expect(p.appliedSummary.confirmedCompanions).toBe(1)
  })
  it('named confirma a un acompanante por token parcial (Ana -> Ana Garcia)', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'named', names: ['Ana'] } }, guest(), [member('m1', 'Ana Garcia')])
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', rsvp_status: 'confirmed' }])
  })
  it('allergy con text vacio no levanta bandera de alergia', () => {
    const p = applyExtraction({ ...base, allergies: [{ who: 'titular', name: '', text: '   ' }] }, guest(), [])
    expect(p.guestUpdate).toBeNull()
  })
})

describe('renderAppliedActions', () => {
  it('vacio cuando no hay acciones', () => {
    expect(renderAppliedActions(null)).toBe('')
    expect(renderAppliedActions({ confirmedGuest: false, declinedGuest: false, confirmedCompanions: 0, capturedAllergies: 0, flagged: null })).toBe('')
  })
  it('incluye titular y acompanantes cuando aplica', () => {
    const s = renderAppliedActions({ confirmedGuest: true, declinedGuest: false, confirmedCompanions: 2, capturedAllergies: 1, flagged: 'alergia' })
    expect(s).toContain('titular')
    expect(s).toContain('2 acompanante')
    expect(s).toContain('alergia')
    expect(s).toContain('Acciones ya realizadas')
  })
})
