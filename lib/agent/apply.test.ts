import { describe, it, expect } from 'vitest'
import { applyExtraction, renderAppliedActions, resolveEscalation, type ExtractionResult } from './apply'
import type { PartyMember } from '@/lib/types'

const base: ExtractionResult = {
  attendance: 'none',
  companions: { action: 'none', names: [], decliningNames: [], impliesOthersNotComing: false },
  allergies: [],
  allergyCorrection: false,
  complaint: false,
  confidence: 'high',
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
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'all', names: [], decliningNames: [], impliesOthersNotComing: false } }, guest(), members)
    expect(p.partyMemberUpdates.map(u => u.id).sort()).toEqual(['m1', 'm2'])
    expect(p.partyMemberUpdates.every(u => u.rsvp_status === 'confirmed')).toBe(true)
    expect(p.appliedSummary.confirmedCompanions).toBe(2)
  })
  it('none deja acompanantes intactos', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'none', names: [], decliningNames: [], impliesOthersNotComing: false } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([])
  })
  it('named confirma solo los que existen y escala los extra', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'named', names: ['Ana', 'Primo Pedro'], decliningNames: [], impliesOthersNotComing: false } }, guest(), members)
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', rsvp_status: 'confirmed' }])
    expect(p.appliedSummary.confirmedCompanions).toBe(1)
    expect(p.escalations).toContain('peticion')
  })
  it('partial_ambiguous no toca acompanantes y escala', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'partial_ambiguous', names: [], decliningNames: [], impliesOthersNotComing: false } }, guest(), members)
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
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'all', names: [], decliningNames: [], impliesOthersNotComing: false }, allergies: [{ who: 'titular', name: '', text: 'x' }], confidence: 'low' }, guest(), [member('m1', 'Ana')])
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
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'named', names: ['Ana', 'Ana'], decliningNames: [], impliesOthersNotComing: false } }, guest(), [member('m1', 'Ana')])
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', rsvp_status: 'confirmed' }])
    expect(p.appliedSummary.confirmedCompanions).toBe(1)
  })
  it('named confirma a un acompanante por token parcial (Ana -> Ana Garcia)', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'named', names: ['Ana'], decliningNames: [], impliesOthersNotComing: false } }, guest(), [member('m1', 'Ana Garcia')])
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
    expect(renderAppliedActions({ confirmedGuest: false, declinedGuest: false, confirmedCompanions: 0, declinedCompanions: 0, capturedAllergies: 0, allergyCorrectionFlagged: false, flagged: null })).toBe('')
  })
  it('incluye titular y acompanantes cuando aplica', () => {
    const s = renderAppliedActions({ confirmedGuest: true, declinedGuest: false, confirmedCompanions: 2, declinedCompanions: 0, capturedAllergies: 1, allergyCorrectionFlagged: false, flagged: 'alergia' })
    expect(s).toContain('titular')
    expect(s).toContain('2 acompanante')
    expect(s).toContain('alergia')
    expect(s).toContain('Acciones ya realizadas')
  })
})

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

describe('resolveEscalation — honestidad: no afirmar lo que no se hizo', () => {
  const members = [member('m1', 'Esposa'), member('m2', 'Hijo')]
  it('peticion no cumplida (partial_ambiguous) fuerza hold honesto', () => {
    const plan = applyExtraction(
      { ...base, companions: { action: 'partial_ambiguous', names: [], decliningNames: [], impliesOthersNotComing: false } },
      guest({ rsvp_status: 'confirmed' }), members,
    )
    expect(plan.escalations).toContain('peticion') // precondicion del bug
    expect(resolveEscalation(plan, { complaint: false, escalateQuejas: true })).toBe('peticion')
  })
  it('acompanante nombrado sin match fuerza hold honesto', () => {
    const plan = applyExtraction(
      { ...base, companions: { action: 'named', names: ['Suegra'], decliningNames: [], impliesOthersNotComing: false } },
      guest({ rsvp_status: 'confirmed' }), members,
    )
    expect(resolveEscalation(plan, { complaint: false, escalateQuejas: true })).toBe('peticion')
  })
  it('acompanante confirmado limpio NO fuerza hold (deja responder normal)', () => {
    const plan = applyExtraction(
      { ...base, companions: { action: 'named', names: ['Esposa'], decliningNames: [], impliesOthersNotComing: false } },
      guest({ rsvp_status: 'confirmed' }), members,
    )
    expect(plan.escalations).not.toContain('peticion')
    expect(resolveEscalation(plan, { complaint: false, escalateQuejas: true })).toBeNull()
  })
  it('queja tiene prioridad sobre peticion', () => {
    const plan = applyExtraction(
      { ...base, complaint: true, companions: { action: 'partial_ambiguous', names: [], decliningNames: [], impliesOthersNotComing: false } },
      guest({ rsvp_status: 'confirmed' }), members,
    )
    expect(resolveEscalation(plan, { complaint: true, escalateQuejas: true })).toBe('queja')
  })
  it('queja desactivada en config no escala queja pero si peticion pendiente', () => {
    const plan = applyExtraction(
      { ...base, complaint: true, companions: { action: 'partial_ambiguous', names: [], decliningNames: [], impliesOthersNotComing: false } },
      guest({ rsvp_status: 'confirmed' }), members,
    )
    expect(resolveEscalation(plan, { complaint: true, escalateQuejas: false })).toBe('peticion')
  })
})

describe('applyExtraction — conteo honesto confirmar+declinar (Fase 2.1 fix)', () => {
  const members = [member('m1', 'Olivia'), member('m2', 'Alejandro')]
  it('vamos todos menos Olivia: cuenta 1 confirmado y 1 declinado', () => {
    const p = applyExtraction({ ...base, attendance: 'confirmed', companions: { action: 'all', names: [], decliningNames: ['Olivia'], impliesOthersNotComing: false } }, guest(), members)
    const byId = Object.fromEntries(p.partyMemberUpdates.map(u => [u.id, u.rsvp_status]))
    expect(byId).toEqual({ m1: 'declined', m2: 'confirmed' })
    expect(p.appliedSummary.confirmedCompanions).toBe(1)
    expect(p.appliedSummary.declinedCompanions).toBe(1)
  })
  it('nombre en names Y decliningNames: gana declined y el conteo lo refleja', () => {
    const p = applyExtraction({ ...base, companions: { action: 'named', names: ['Ana'], decliningNames: ['Ana'], impliesOthersNotComing: false } }, guest(), [member('m1', 'Ana')])
    expect(p.partyMemberUpdates).toEqual([{ id: 'm1', rsvp_status: 'declined' }])
    expect(p.appliedSummary.confirmedCompanions).toBe(0)
    expect(p.appliedSummary.declinedCompanions).toBe(1)
  })
})
