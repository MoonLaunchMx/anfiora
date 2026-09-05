import { describe, it, expect } from 'vitest'
import {
  EntradaDelRolodex, normalizar, buscar, masUsados, nombresParecidos, contactoRepetido,
} from './duplicados'

function ficha(p: Partial<EntradaDelRolodex> & { nombre: string }): EntradaDelRolodex {
  return {
    id:         p.id ?? p.nombre,
    nombre:     p.nombre,
    categoria:   p.categoria ?? null,
    categoriaId: p.categoriaId ?? null,
    pais:        p.pais ?? null,
    estado:      p.estado ?? null,
    ciudad:      p.ciudad ?? null,
    telefono:   p.telefono ?? null,
    correo:     p.correo ?? null,
    veces:      p.veces ?? 1,
    ultima:     p.ultima ?? null,
    enEstaBoda: p.enEstaBoda ?? false,
  }
}

const CATALOGO: EntradaDelRolodex[] = [
  ficha({ nombre: 'Flores Bonitas',       categoria: 'Decoración', ciudad: 'Querétaro', veces: 4, telefono: '+524421184420', correo: 'hola@floresbonitas.mx' }),
  ficha({ nombre: 'Floristería La Alameda', categoria: 'Decoración', ciudad: 'CDMX', veces: 1 }),
  ficha({ nombre: 'DJ Ultra Mix',         categoria: 'Entretenimiento', ciudad: 'Querétaro', veces: 6, enEstaBoda: true }),
  ficha({ nombre: 'Estudio Marfil',       categoria: 'Imagen', ciudad: 'CDMX', veces: 5 }),
  ficha({ nombre: 'Pastelería Amélie',    categoria: 'Banquete', ciudad: 'Querétaro', veces: 4 }),
]

describe('normalizar', () => {
  it('quita acentos, mayusculas y espacios de sobra', () => {
    expect(normalizar('  Pastelería   AMÉLIE ')).toBe('pasteleria amelie')
  })
})

describe('buscar', () => {
  it('sin nada escrito no devuelve nada', () => {
    expect(buscar(CATALOGO, '')).toEqual([])
    expect(buscar(CATALOGO, '   ')).toEqual([])
  })

  it('encuentra sin importar acentos ni mayusculas', () => {
    expect(buscar(CATALOGO, 'AMELIE').map(e => e.nombre)).toEqual(['Pastelería Amélie'])
  })

  it('tambien busca por categoria y por ciudad', () => {
    expect(buscar(CATALOGO, 'decoracion')).toHaveLength(2)
    expect(buscar(CATALOGO, 'cdmx')).toHaveLength(2)
  })

  it('el que empieza con lo escrito va primero, aunque otro se use mas', () => {
    const r = buscar(CATALOGO, 'flor')
    expect(r.map(e => e.nombre)).toEqual(['Flores Bonitas', 'Floristería La Alameda'])
  })

  it('a igualdad de arranque manda el que mas has usado', () => {
    const r = buscar(
      [ficha({ nombre: 'Zafiro Uno', veces: 1 }), ficha({ nombre: 'Zafiro Dos', veces: 9 })],
      'zafiro',
    )
    expect(r[0].nombre).toBe('Zafiro Dos')
  })

  it('el que ya esta en esta boda tambien sale, para que no lo vuelvas a crear', () => {
    expect(buscar(CATALOGO, 'dj').map(e => e.nombre)).toEqual(['DJ Ultra Mix'])
  })

  it('respeta el tope', () => {
    expect(buscar(CATALOGO, 'a', 2)).toHaveLength(2)
  })
})

describe('masUsados', () => {
  it('ordena por cuantas veces lo has usado', () => {
    expect(masUsados(CATALOGO).map(e => e.nombre)).toEqual([
      'Estudio Marfil', 'Flores Bonitas', 'Pastelería Amélie', 'Floristería La Alameda',
    ])
  })

  it('no ofrece uno que ya esta en esta boda', () => {
    expect(masUsados(CATALOGO).some(e => e.nombre === 'DJ Ultra Mix')).toBe(false)
  })

  it('ignora fichas que nunca has usado en una boda', () => {
    const solo = [ficha({ nombre: 'De la expo', veces: 0 })]
    expect(masUsados(solo)).toEqual([])
  })
})

describe('nombresParecidos', () => {
  it('marca el nombre que contiene a lo que escribiste', () => {
    expect(nombresParecidos(CATALOGO, 'Flores Bonita').map(e => e.nombre)).toEqual(['Flores Bonitas'])
  })

  it('marca tambien al reves, cuando escribiste de mas', () => {
    expect(nombresParecidos(CATALOGO, 'Flores Bonitas QRO').map(e => e.nombre)).toEqual(['Flores Bonitas'])
  })

  it('el mismo nombre con acentos distintos cuenta como parecido', () => {
    expect(nombresParecidos(CATALOGO, 'pasteleria amelie')).toHaveLength(1)
  })

  it('dos o tres letras no marcan a medio catalogo', () => {
    expect(nombresParecidos(CATALOGO, 'DJ')).toEqual([])
  })

  it('sin nombre no hay aviso', () => {
    expect(nombresParecidos(CATALOGO, '  ')).toEqual([])
  })
})

describe('contactoRepetido', () => {
  it('reconoce el mismo numero escrito a la mexicana', () => {
    const r = contactoRepetido(CATALOGO, { telefono: '442 118 4420' })
    expect(r?.entrada.nombre).toBe('Flores Bonitas')
    expect(r?.campo).toBe('telefono')
  })

  it('reconoce el mismo numero ya en E.164', () => {
    expect(contactoRepetido(CATALOGO, { telefono: '+52 442 118 4420' })?.campo).toBe('telefono')
  })

  it('un numero distinto no avisa', () => {
    expect(contactoRepetido(CATALOGO, { telefono: '442 000 0000' })).toBeNull()
  })

  it('el correo avisa sin importar mayusculas ni espacios', () => {
    const r = contactoRepetido(CATALOGO, { correo: '  HOLA@FloresBonitas.mx ' })
    expect(r?.entrada.nombre).toBe('Flores Bonitas')
    expect(r?.campo).toBe('correo')
  })

  it('si coinciden los dos, manda el telefono', () => {
    expect(contactoRepetido(CATALOGO, {
      telefono: '4421184420', correo: 'hola@floresbonitas.mx',
    })?.campo).toBe('telefono')
  })

  it('sin contacto no hay aviso', () => {
    expect(contactoRepetido(CATALOGO, {})).toBeNull()
    expect(contactoRepetido(CATALOGO, { telefono: '', correo: '' })).toBeNull()
  })

  it('un telefono que no se puede leer no truena', () => {
    expect(contactoRepetido(CATALOGO, { telefono: 'no es un numero' })).toBeNull()
  })
})
