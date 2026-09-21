import { describe, it, expect } from 'vitest'
import {
  ahorroDe,
  armarFilas,
  partirActivosHistorial,
  tasaDeCierre,
  ahorroNegociado,
  rangoContratado,
  ultimoCierre,
  calificaciones,
  diasEntre,
  etiquetaRelativa,
  fechaLarga,
  mesYAno,
  totales,
  iniciales,
  hoyISO,
} from './expediente'
import type { EventoCrudo, PagoCrudo, PartidaCruda, ReviewCruda, VinculoCrudo } from './expediente'

const HOY = '2026-09-11'

const eventos: EventoCrudo[] = [
  { id: 'e-ana',    name: 'Ana & Rodrigo',   event_date: '2026-11-14', event_end_date: null,         venue: 'Hacienda San José', currency: 'MXN' },
  { id: 'e-regina', name: 'Regina & Pablo',  event_date: '2027-02-21', event_end_date: null,         venue: null,                currency: 'MXN' },
  { id: 'e-camila', name: 'Camila & Andrés', event_date: '2027-05-08', event_end_date: '2027-05-09', venue: 'San Miguel',        currency: 'MXN' },
  { id: 'e-val',    name: 'Valeria & Diego', event_date: '2026-03-22', event_end_date: null,         venue: 'El Carmen',         currency: 'MXN' },
  { id: 'e-pau',    name: 'Paulina & Marco', event_date: '2025-11-09', event_end_date: null,         venue: null,                currency: 'MXN' },
  { id: 'e-ren',    name: 'Renata & Iker',   event_date: '2025-08-17', event_end_date: null,         venue: null,                currency: 'MXN' },
]

const vinculos: VinculoCrudo[] = [
  { id: 'v-ana',    event_id: 'e-ana',    status: 'contratado', quoted_amount: 58000 },
  { id: 'v-regina', event_id: 'e-regina', status: 'cotizado',   quoted_amount: 62000 },
  { id: 'v-camila', event_id: 'e-camila', status: 'nuevo',      quoted_amount: null },
  { id: 'v-val',    event_id: 'e-val',    status: 'contratado', quoted_amount: 52000 },
  { id: 'v-pau',    event_id: 'e-pau',    status: 'contratado', quoted_amount: 44000 },
  { id: 'v-ren',    event_id: 'e-ren',    status: 'descartado', quoted_amount: 61000 },
]

const partidas: PartidaCruda[] = [
  { event_supplier_id: 'v-ana', contract_amount: 30000 },
  { event_supplier_id: 'v-ana', contract_amount: 24000 },
  { event_supplier_id: 'v-val', contract_amount: 47000 },
  { event_supplier_id: 'v-pau', contract_amount: 38000 },
  { event_supplier_id: 'v-regina', contract_amount: null },
  { event_supplier_id: null, contract_amount: 999 },
]

const pagos: PagoCrudo[] = [
  { event_supplier_id: 'v-ana', amount: 20000 },
  { event_supplier_id: 'v-ana', amount: 7000 },
  { event_supplier_id: 'v-val', amount: 47000 },
  { event_supplier_id: 'v-pau', amount: 38000 },
]

const vacia = { precio_valor: null, calidad: null, comunicacion: null, servicio_trato: null, manejo_imprevistos: null, razones_seleccion: null, motivo_descarte: null, comentarios: null }

const reviews: ReviewCruda[] = [
  { ...vacia, event_supplier_id: 'v-val', review_type: 'contratacion', autor: 'planner', razones_seleccion: ['precio', 'calidad'], comentarios: 'Buena propuesta' },
  { ...vacia, event_supplier_id: 'v-val', review_type: 'post_evento',  autor: 'planner', precio_valor: 5, calidad: 5, comunicacion: 5, servicio_trato: 5, manejo_imprevistos: 5, comentarios: 'Entregó el álbum en 3 semanas.' },
  { ...vacia, event_supplier_id: 'v-val', review_type: 'post_evento',  autor: 'cliente', precio_valor: 5, calidad: 5, comunicacion: 4, servicio_trato: 5, manejo_imprevistos: 5 },
  { ...vacia, event_supplier_id: 'v-pau', review_type: 'contratacion', autor: 'planner', razones_seleccion: ['decision_cliente'] },
  { ...vacia, event_supplier_id: 'v-pau', review_type: 'post_evento',  autor: 'planner', precio_valor: 4, calidad: 4, comunicacion: 4, servicio_trato: 4, manejo_imprevistos: 4 },
  { ...vacia, event_supplier_id: 'v-ren', review_type: 'descarte',     autor: 'planner', motivo_descarte: 'cliente_eligio_otro', comentarios: 'Se fueron con el del venue.' },
]

const filas = armarFilas({ vinculos, eventos, partidas, pagos, reviews })
const porId = (id: string) => filas.find(f => f.vinculoId === id)!

describe('ahorroDe', () => {
  it('baja del cotizado al contratado en porcentaje entero', () => {
    expect(ahorroDe(58000, 54000)).toBe(-7)
    expect(ahorroDe(44000, 38000)).toBe(-14)
  })
  it('sube cuando el contrato quedo arriba', () => {
    expect(ahorroDe(9000, 10500)).toBe(17)
  })
  it('sin los dos montos no hay ahorro', () => {
    expect(ahorroDe(null, 54000)).toBeNull()
    expect(ahorroDe(58000, null)).toBeNull()
    expect(ahorroDe(0, 54000)).toBeNull()
    expect(ahorroDe(58000, 0)).toBeNull()
  })
})

describe('armarFilas', () => {
  it('una fila por vinculo con evento conocido', () => {
    expect(filas).toHaveLength(6)
    expect(armarFilas({ vinculos: [{ id: 'x', event_id: 'no-existe', status: 'nuevo', quoted_amount: null }], eventos, partidas, pagos, reviews })).toHaveLength(0)
  })
  it('el contratado es la suma de sus partidas con contrato', () => {
    expect(porId('v-ana').contratado).toBe(54000)
    expect(porId('v-regina').contratado).toBeNull()
    expect(porId('v-camila').contratado).toBeNull()
  })
  it('pagado, por pagar y porcentaje', () => {
    const ana = porId('v-ana')
    expect(ana.pagado).toBe(27000)
    expect(ana.porPagar).toBe(27000)
    expect(ana.porcentajePagado).toBe(50)
    expect(porId('v-val').porPagar).toBe(0)
    expect(porId('v-val').porcentajePagado).toBe(100)
    expect(porId('v-regina').porPagar).toBeNull()
    expect(porId('v-regina').porcentajePagado).toBeNull()
  })
  it('el ahorro por fila', () => {
    expect(porId('v-ana').ahorro).toBe(-7)
    expect(porId('v-val').ahorro).toBe(-10)
    expect(porId('v-regina').ahorro).toBeNull()
  })
  it('por que: razones de contratacion o motivo de descarte, en palabras', () => {
    expect(porId('v-val').porQue).toBe('Mejor precio · Mejor calidad o portafolio')
    expect(porId('v-pau').porQue).toBe('Decisión del cliente')
    expect(porId('v-ren').porQue).toBe('El cliente eligió a otro')
    expect(porId('v-ana').porQue).toBeNull()
  })
  it('planner y cliente por evento', () => {
    expect(porId('v-val').planner).toBe(5)
    expect(porId('v-val').cliente).toBe(4.8)
    expect(porId('v-pau').planner).toBe(4)
    expect(porId('v-pau').cliente).toBeNull()
    expect(porId('v-ren').planner).toBeNull()
  })
  it('el comentario prefiere el de desempeno, luego contratacion o descarte', () => {
    expect(porId('v-val').comentario).toBe('Entregó el álbum en 3 semanas.')
    expect(porId('v-ren').comentario).toBe('Se fueron con el del venue.')
    expect(porId('v-pau').comentario).toBeNull()
  })
  it('lleva nombre, lugar y moneda del evento', () => {
    expect(porId('v-ana').nombre).toBe('Ana & Rodrigo')
    expect(porId('v-ana').lugar).toBe('Hacienda San José')
    expect(porId('v-ana').moneda).toBe('MXN')
  })
})

describe('partirActivosHistorial', () => {
  it('parte por la fecha de fin y ordena cada lado', () => {
    const { activos, historial } = partirActivosHistorial(filas, HOY)
    expect(activos.map(f => f.vinculoId)).toEqual(['v-ana', 'v-regina', 'v-camila'])
    expect(historial.map(f => f.vinculoId)).toEqual(['v-val', 'v-pau', 'v-ren'])
  })
  it('un evento de varios dias sigue activo hasta su ultimo dia', () => {
    const f = [{ fecha: '2026-09-09', fechaFin: '2026-09-11' }, { fecha: '2026-09-09', fechaFin: '2026-09-10' }]
    const { activos, historial } = partirActivosHistorial(f, HOY)
    expect(activos).toHaveLength(1)
    expect(historial).toHaveLength(1)
  })
  it('el dia del evento es activo; sin fecha es activo', () => {
    const f = [{ fecha: HOY, fechaFin: null }, { fecha: null, fechaFin: null }]
    expect(partirActivosHistorial(f, HOY).activos).toHaveLength(2)
  })
})

describe('KPIs', () => {
  it('tasa de cierre: contratados entre los que llegaron a cotizar', () => {
    expect(tasaDeCierre(filas)).toEqual({ contratados: 3, cotizados: 5, porcentaje: 60 })
    expect(tasaDeCierre([{ estatus: 'nuevo' }])).toEqual({ contratados: 0, cotizados: 0, porcentaje: null })
  })
  it('ahorro negociado promedia solo las filas con los dos montos', () => {
    expect(ahorroNegociado(filas)).toEqual({ promedio: -10, n: 3 })
    expect(ahorroNegociado([{ ahorro: null }])).toEqual({ promedio: null, n: 0 })
  })
  it('rango de lo contratado', () => {
    expect(rangoContratado(filas)).toEqual({ min: 38000, max: 54000 })
    expect(rangoContratado([{ contratado: null }, { contratado: 0 }])).toBeNull()
  })
  it('ultimo cierre: el contratado con fecha mas reciente', () => {
    expect(ultimoCierre(filas)).toEqual({ nombre: 'Ana & Rodrigo', fecha: '2026-11-14' })
    expect(ultimoCierre([{ estatus: 'cotizado', nombre: 'x', fecha: '2026-01-01' }])).toBeNull()
  })
  it('calificaciones globales con conteo de eventos', () => {
    expect(calificaciones(reviews)).toEqual({ planner: 4.5, cliente: 4.8, eventosCalificados: 2, opiniones: 1 })
    expect(calificaciones([])).toEqual({ planner: null, cliente: null, eventosCalificados: 0, opiniones: 0 })
  })
})

describe('fechas', () => {
  it('dias entre dos fechas sin corrimiento UTC', () => {
    expect(diasEntre('2026-09-11', '2026-11-14')).toBe(64)
    expect(diasEntre('2026-09-11', '2026-09-11')).toBe(0)
    expect(diasEntre('2026-09-11', '2026-09-10')).toBe(-1)
    expect(diasEntre('rara', '2026-09-10')).toBeNull()
  })
  it('etiqueta relativa', () => {
    expect(etiquetaRelativa('2026-11-14', null, HOY)).toBe('en 64 días')
    expect(etiquetaRelativa('2026-09-12', null, HOY)).toBe('mañana')
    expect(etiquetaRelativa('2026-09-11', null, HOY)).toBe('hoy')
    expect(etiquetaRelativa('2026-09-10', '2026-09-12', HOY)).toBe('en curso')
    expect(etiquetaRelativa('2026-03-22', null, HOY)).toBe('concluido')
    expect(etiquetaRelativa(null, null, HOY)).toBe('')
  })
  it('fecha larga y mes con año', () => {
    expect(fechaLarga('2026-11-14')).toBe('14 nov 2026')
    expect(fechaLarga('2026-07-26')).toBe('26 jul 2026')
    expect(fechaLarga(null)).toBe('')
    expect(mesYAno('2026-03-22')).toBe('mar 2026')
  })
  it('hoyISO usa la fecha local', () => {
    expect(hoyISO(new Date(2026, 8, 11, 23, 30))).toBe('2026-09-11')
    expect(hoyISO(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })
})

describe('totales', () => {
  it('suma lo que hay y promedia estrellas', () => {
    const { historial } = partirActivosHistorial(filas, HOY)
    expect(totales(historial)).toEqual({
      eventos: 3, contratados: 2,
      cotizado: 157000, contratado: 85000, pagado: 85000, porPagar: 0,
      ahorro: -12, planner: 4.5, cliente: 4.8,
    })
  })
  it('activos con un solo contratado', () => {
    const { activos } = partirActivosHistorial(filas, HOY)
    const t = totales(activos)
    expect(t.eventos).toBe(3)
    expect(t.contratados).toBe(1)
    expect(t.cotizado).toBe(120000)
    expect(t.contratado).toBe(54000)
    expect(t.porPagar).toBe(27000)
    expect(t.planner).toBeNull()
  })
})

describe('iniciales', () => {
  it('dos letras del nombre', () => {
    expect(iniciales('Estudio Marfil')).toBe('EM')
    expect(iniciales('DJ Riviera maya')).toBe('DR')
    expect(iniciales('  Solo ')).toBe('S')
  })
})
