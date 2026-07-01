import { describe, it, expect } from 'vitest'
import { mergeAgentConfig, DEFAULT_AGENT_CONFIG } from './config'

describe('mergeAgentConfig', () => {
  it('devuelve el default cuando no hay config', () => {
    expect(mergeAgentConfig(null)).toEqual(DEFAULT_AGENT_CONFIG)
  })
  it('mezcla parcial sobre el default sin perder escalate', () => {
    const m = mergeAgentConfig({ tone: 'formal', escalate: { alergias: false } as any })
    expect(m.tone).toBe('formal')
    expect(m.escalate.alergias).toBe(false)
    expect(m.escalate.quejas).toBe(true)
    expect(m.mode).toBe(DEFAULT_AGENT_CONFIG.mode)
  })
  it('faq invalida cae a arreglo vacio', () => {
    expect(mergeAgentConfig({ faq: 'x' as any }).faq).toEqual([])
  })
})
