import { describe, it, expect } from 'vitest'
import { interpretarEscritura } from './persistencia'

describe('interpretarEscritura', () => {
  it('con filas afectadas y sin error, la escritura paso', () => {
    expect(interpretarEscritura({ error: null, data: [{ event_id: 'e1' }] })).toEqual({ ok: true })
  })

  it('cero filas y sin error es el fallo mudo de RLS, no un exito', () => {
    const r = interpretarEscritura({ error: null, data: [] })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.tipo).toBe('permiso')
  })

  it('data nula sin error tampoco cuenta como exito', () => {
    expect(interpretarEscritura({ error: null, data: null }).ok).toBe(false)
  })

  it('el codigo 42501 se reporta como falta de permiso', () => {
    const r = interpretarEscritura({
      error: { code: '42501', message: 'new row violates row-level security policy for table "event_settings"' },
      data: null,
    })
    expect(r.ok === false && r.tipo).toBe('permiso')
  })

  it('reconoce el rechazo de RLS aunque venga sin codigo', () => {
    const r = interpretarEscritura({
      error: { message: 'new row violates row-level security policy' },
      data: null,
    })
    expect(r.ok === false && r.tipo).toBe('permiso')
  })

  it('el motivo de un fallo de permiso no le echa la culpa al usuario', () => {
    const r = interpretarEscritura({ error: { code: '42501', message: 'row-level security' }, data: null })
    expect(r.ok === false && r.motivo).toContain('permiso')
    expect(r.ok === false && r.motivo).not.toContain('row-level')
  })

  it('el mensaje del candado de configuracion se muestra tal cual', () => {
    const r = interpretarEscritura({
      error: { code: '42501', message: 'Solo el administrador del evento puede cambiar name' },
      data: null,
    })
    expect(r.ok === false && r.motivo).toBe('Solo el administrador del evento puede cambiar name')
  })

  it('un error que no es de permiso conserva su mensaje', () => {
    const r = interpretarEscritura({
      error: { code: 'PGRST204', message: "Could not find the 'invite_draft' column" },
      data: null,
    })
    expect(r.ok === false && r.tipo).toBe('error')
    expect(r.ok === false && r.motivo).toContain('invite_draft')
  })

  it('un error sin mensaje sigue siendo un fallo, con texto generico', () => {
    const r = interpretarEscritura({ error: {}, data: null })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.motivo.length).toBeGreaterThan(0)
  })

  it('una respuesta con error Y filas se trata como fallo', () => {
    expect(interpretarEscritura({ error: { message: 'x' }, data: [{ event_id: 'e1' }] }).ok).toBe(false)
  })
})
