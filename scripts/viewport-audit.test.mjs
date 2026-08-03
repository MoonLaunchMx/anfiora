import { describe, expect, it } from 'vitest'
import { auditSource } from './viewport-audit.mjs'

describe('auditSource', () => {
  it('marca vh en una clase de Tailwind', () => {
    const v = auditSource('app/x.tsx', 'const a = <div className="max-h-[90vh]" />')
    expect(v).toHaveLength(1)
    expect(v[0].rule).toBe('vh')
    expect(v[0].line).toBe(1)
  })

  it('marca vh dentro de un style inline', () => {
    const v = auditSource('app/x.tsx', 'style={{ maxHeight: "90vh" }}')
    expect(v).toHaveLength(1)
  })

  it('marca h-screen y min-h-screen', () => {
    const v = auditSource('app/x.tsx', '<div className="min-h-screen" />\n<div className="h-screen" />')
    expect(v).toHaveLength(2)
    expect(v.every(x => x.rule === 'h-screen')).toBe(true)
  })

  it('no marca dvh, svh ni lvh', () => {
    expect(auditSource('app/x.tsx', 'className="max-h-[92dvh] h-[100svh] min-h-[50lvh]"')).toHaveLength(0)
  })

  it('marca un bottom sheet escrito a mano', () => {
    const src = '<div className="fixed inset-0 z-50">\n<div className="rounded-t-2xl bg-white">'
    const v = auditSource('app/x.tsx', src)
    expect(v.some(x => x.rule === 'modal-a-mano')).toBe(true)
  })

  it('no marca el propio primitivo', () => {
    const src = '<div className="fixed inset-0 z-[300]">\n<div className="rounded-t-2xl">'
    expect(auditSource('app/components/ui/Modal.tsx', src)).toHaveLength(0)
  })

  it('no marca los archivos en lista blanca', () => {
    expect(auditSource('app/globals.css', 'top: -6vh;')).toHaveLength(0)
    expect(auditSource('app/page.tsx', 'className="min-h-screen"')).toHaveLength(0)
  })

  it('reporta el numero de linea correcto', () => {
    const v = auditSource('app/x.tsx', 'linea uno\nlinea dos\nmax-h-[90vh]')
    expect(v[0].line).toBe(3)
  })
})
