import { describe, it, expect } from 'vitest'
import {
  getDefaultAccessMode, getDefaultRequiresApproval,
  resolveAccessMode, resolveRequiresApproval,
  normalizeAccessFields, ACCESS_MODES,
} from './features'
import { EVENT_TYPES } from './event-types'

describe('getDefaultAccessMode', () => {
  it('los eventos de lista curada son privados', () => {
    for (const t of ['boda', 'xv', 'bautizo', 'graduacion']) {
      expect(getDefaultAccessMode(t)).toBe('privada')
    }
  })

  it('todo lo demas es publico', () => {
    for (const t of ['cumpleanos', 'fiesta', 'conferencia', 'congreso', 'caridad',
                     'despedida', 'capacitacion', 'teambuilding', 'lanzamiento',
                     'asamblea', 'retiro', 'campamento', 'otro']) {
      expect(getDefaultAccessMode(t)).toBe('publica')
    }
  })

  it('cae en publica si el tipo no existe o es null', () => {
    expect(getDefaultAccessMode('inexistente')).toBe('publica')
    expect(getDefaultAccessMode(null)).toBe('publica')
  })
})

describe('getDefaultRequiresApproval', () => {
  it('los que antes eran aprobacion piden aprobacion', () => {
    for (const t of ['despedida', 'capacitacion', 'teambuilding', 'lanzamiento',
                     'asamblea', 'retiro', 'campamento', 'otro']) {
      expect(getDefaultRequiresApproval(t)).toBe(true)
    }
  })

  it('los que antes eran abierta no piden aprobacion', () => {
    for (const t of ['cumpleanos', 'fiesta', 'conferencia', 'congreso', 'caridad']) {
      expect(getDefaultRequiresApproval(t)).toBe(false)
    }
  })

  it('los privados nunca piden aprobacion', () => {
    for (const t of ['boda', 'xv', 'bautizo', 'graduacion']) {
      expect(getDefaultRequiresApproval(t)).toBe(false)
    }
  })
})

describe('los 17 tipos declaran su acceso', () => {
  it('cada tipo tiene un modo valido', () => {
    for (const t of EVENT_TYPES) {
      expect(['privada', 'publica']).toContain(t.defaultAccessMode)
      expect(typeof t.defaultRequiresApproval).toBe('boolean')
    }
  })

  it('ningun tipo privado pide aprobacion', () => {
    for (const t of EVENT_TYPES.filter(t => t.defaultAccessMode === 'privada')) {
      expect(t.defaultRequiresApproval).toBe(false)
    }
  })
})

describe('ACCESS_MODES', () => {
  it('son exactamente dos: privada y publica', () => {
    expect(ACCESS_MODES.map(m => m.key)).toEqual(['privada', 'publica'])
  })
})

describe('resolveAccessMode', () => {
  it('lo guardado gana sobre el default del tipo', () => {
    expect(resolveAccessMode('boda', 'publica')).toBe('publica')
    expect(resolveAccessMode('conferencia', 'privada')).toBe('privada')
  })

  it('lectura tolerante: los valores viejos de 3 se leen como publica', () => {
    expect(resolveAccessMode('boda', 'abierta')).toBe('publica')
    expect(resolveAccessMode('boda', 'aprobacion')).toBe('publica')
  })

  it('sin nada guardado cae al default del tipo', () => {
    expect(resolveAccessMode('boda', null)).toBe('privada')
    expect(resolveAccessMode('conferencia', undefined)).toBe('publica')
  })

  it('basura cae al default del tipo', () => {
    expect(resolveAccessMode('boda', 'lo-que-sea')).toBe('privada')
    expect(resolveAccessMode('boda', '')).toBe('privada')
  })
})

describe('resolveRequiresApproval', () => {
  it('un evento privado nunca pide aprobacion, aunque la bandera diga que si', () => {
    expect(resolveRequiresApproval('otro', 'privada', true)).toBe(false)
  })

  it('la bandera guardada gana en un evento publico', () => {
    expect(resolveRequiresApproval('conferencia', 'publica', true)).toBe(true)
    expect(resolveRequiresApproval('otro', 'publica', false)).toBe(false)
  })

  it('lectura tolerante: el viejo aprobacion implica que si', () => {
    expect(resolveRequiresApproval('conferencia', 'aprobacion', null)).toBe(true)
  })

  it('lectura tolerante: el viejo abierta implica que no', () => {
    expect(resolveRequiresApproval('otro', 'abierta', null)).toBe(false)
  })

  it('sin bandera cae al default del tipo', () => {
    expect(resolveRequiresApproval('otro', null, null)).toBe(true)
    expect(resolveRequiresApproval('conferencia', null, undefined)).toBe(false)
  })
})

describe('normalizeAccessFields', () => {
  it('privada borra cupo, precio y aprobacion aunque vengan llenos', () => {
    expect(normalizeAccessFields({
      accessMode: 'privada', guestCap: '100', ticketPrice: '500', requiresApproval: true,
    })).toEqual({ guest_cap: null, ticket_price: null, requires_approval: false })
  })

  it('publica respeta lo que se tecleo', () => {
    expect(normalizeAccessFields({
      accessMode: 'publica', guestCap: '100', ticketPrice: '500', requiresApproval: true,
    })).toEqual({ guest_cap: 100, ticket_price: 500, requires_approval: true })
  })

  it('publica sin cupo ni precio los deja nulos y respeta la aprobacion', () => {
    expect(normalizeAccessFields({
      accessMode: 'publica', guestCap: '', ticketPrice: '', requiresApproval: false,
    })).toEqual({ guest_cap: null, ticket_price: null, requires_approval: false })
  })

  it('un cupo invalido o pasado de la cota se vuelve nulo', () => {
    for (const cap of ['0', '-5', 'abc', '1.5', '1000001']) {
      expect(normalizeAccessFields({
        accessMode: 'publica', guestCap: cap, ticketPrice: '', requiresApproval: false,
      }).guest_cap).toBeNull()
    }
  })

  it('un precio de cero es valido (evento publico gratis con registro)', () => {
    expect(normalizeAccessFields({
      accessMode: 'publica', guestCap: '', ticketPrice: '0', requiresApproval: false,
    }).ticket_price).toBe(0)
  })
})
