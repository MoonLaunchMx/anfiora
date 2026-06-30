import { describe, it, expect } from 'vitest'
import { resolveRsvpAndAttention, inferAttentionReason } from './attention'

describe('resolveRsvpAndAttention', () => {
  it('confirma asistencia sin levantar atencion', () => {
    expect(resolveRsvpAndAttention('confirmed', 'si vamos los 3')).toEqual({
      rsvp: 'confirmed', needsAttention: false, attentionReason: null,
    })
  })

  it('declina sin atencion', () => {
    expect(resolveRsvpAndAttention('declined', 'no podremos ir')).toEqual({
      rsvp: 'declined', needsAttention: false, attentionReason: null,
    })
  })

  it('confirma Y levanta atencion de alergia sin perder el confirmed', () => {
    expect(resolveRsvpAndAttention('accion_necesaria', 'si vamos! soy alergico a mariscos')).toEqual({
      rsvp: null, needsAttention: true, attentionReason: 'alergia',
    })
  })

  it('respondio no cambia asistencia ni levanta atencion', () => {
    expect(resolveRsvpAndAttention('respondio', 'gracias por el aviso')).toEqual({
      rsvp: null, needsAttention: false, attentionReason: null,
    })
  })

  it('ambiguous no hace nada', () => {
    expect(resolveRsvpAndAttention('ambiguous', '👍')).toEqual({
      rsvp: null, needsAttention: false, attentionReason: null,
    })
  })
})

describe('inferAttentionReason', () => {
  it('detecta alergia', () => {
    expect(inferAttentionReason('soy celiaco')).toBe('alergia')
  })
  it('detecta queja', () => {
    expect(inferAttentionReason('me parece pesimo la organizacion')).toBe('queja')
  })
  it('detecta peticion de acompanantes', () => {
    expect(inferAttentionReason('puedo llevar a mi pareja?')).toBe('peticion')
  })
  it('detecta duda', () => {
    expect(inferAttentionReason('a que hora es la ceremonia?')).toBe('duda')
  })
  it('cae en otro cuando no hay senal', () => {
    expect(inferAttentionReason('tengo un asunto que comentarles')).toBe('otro')
  })
  it('prioriza alergia sobre duda', () => {
    expect(inferAttentionReason('soy alergico, a que hora sirven la cena?')).toBe('alergia')
  })
})
