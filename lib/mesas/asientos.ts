// Una fila de table_seats es UNA persona. Las filas "legado" (una por familia
// con party_size = N, lo que habia antes) se entienden aqui y se expanden a
// una fila por persona al primer movimiento individual. Nada en este archivo
// toca la base: solo describe operaciones que la pagina ejecuta en orden.

export type Persona = {
  clave: string
  guestId: string
  memberId: string | null
  nombre: string
  titular: string | null
  grupo: string | null
  rsvp: string
  checkedIn: boolean
}

export type Fila = {
  id: string
  table_id: string
  event_id: string
  guest_id: string | null
  party_member_id: string | null
  party_size: number
  seat_number: number
}

export type Lugar = { seatId: string; tableId: string; legado: boolean }

export type Op =
  | { kind: 'insert'; row: { table_id: string; event_id: string; guest_id: string; party_member_id: string | null; seat_number: number; party_size: 1 } }
  | { kind: 'mover'; seatId: string; table_id: string; seat_number: number }
  | { kind: 'encoger'; seatId: string }
  | { kind: 'delete'; seatId: string }

type MemberLike = { id: string; name: string; rsvp_status: string; checked_in?: boolean }
type GuestLike = { id: string; name: string; rsvp_status: string; checked_in?: boolean; side?: string | null; party_members: MemberLike[] }

export const claveDe = (guestId: string, memberId: string | null) => memberId ?? guestId

export function personasDe(guests: GuestLike[]): Persona[] {
  const out: Persona[] = []
  for (const g of guests) {
    const grupo = g.side || null
    out.push({ clave: g.id, guestId: g.id, memberId: null, nombre: g.name, titular: null, grupo, rsvp: g.rsvp_status, checkedIn: !!g.checked_in })
    for (const m of g.party_members) {
      out.push({ clave: m.id, guestId: g.id, memberId: m.id, nombre: m.name || 'Acompañante', titular: g.name, grupo, rsvp: m.rsvp_status, checkedIn: !!m.checked_in })
    }
  }
  return out
}

export function esLegado(fila: Fila, filas: Fila[]): boolean {
  if (fila.party_member_id || !fila.guest_id || fila.party_size <= 1) return false
  return !filas.some(f => f.guest_id === fila.guest_id && f.party_member_id)
}

export function mapaAsientos(filas: Fila[], personas: Persona[]): Map<string, Lugar> {
  const mapa = new Map<string, Lugar>()
  for (const f of filas) {
    if (!f.guest_id) continue
    if (f.party_member_id) { mapa.set(f.party_member_id, { seatId: f.id, tableId: f.table_id, legado: false }); continue }
    const legado = esLegado(f, filas)
    mapa.set(f.guest_id, { seatId: f.id, tableId: f.table_id, legado })
    if (legado) for (const p of personas) if (p.guestId === f.guest_id && p.memberId) mapa.set(p.clave, { seatId: f.id, tableId: f.table_id, legado: true })
  }
  return mapa
}

export function ocupacionDe(tableId: string, filas: Fila[]): number {
  return filas.filter(f => f.table_id === tableId).reduce((n, f) => n + (esLegado(f, filas) ? f.party_size : 1), 0)
}

export function personasEnMesa(tableId: string, filas: Fila[], personas: Persona[]): Persona[] {
  const mapa = mapaAsientos(filas, personas)
  return personas.filter(p => mapa.get(p.clave)?.tableId === tableId)
}

function siguienteAsiento(tableId: string, filas: Fila[], reservados: number): number {
  return filas.filter(f => f.table_id === tableId).reduce((m, f) => Math.max(m, f.seat_number), 0) + 1 + reservados
}

// Id provisional de una fila que se inserta en esta misma tanda de ops. El
// ejecutor lo sustituye por el id real que devuelve el insert.
export const idNuevo = (memberId: string) => 'nuevo:' + memberId

export function opsExpandir(guestId: string, filas: Fila[], personas: Persona[]): Op[] {
  const titular = filas.find(f => f.guest_id === guestId && !f.party_member_id)
  if (!titular || !esLegado(titular, filas)) return []
  const ops: Op[] = []
  let i = 0
  for (const p of personas) {
    if (p.guestId !== guestId || !p.memberId) continue
    ops.push({ kind: 'insert', row: { table_id: titular.table_id, event_id: titular.event_id, guest_id: guestId, party_member_id: p.memberId, seat_number: siguienteAsiento(titular.table_id, filas, i), party_size: 1 } })
    i++
  }
  ops.push({ kind: 'encoger', seatId: titular.id })
  return ops
}

function lugarTrasExpandir(persona: Persona, filas: Fila[], expansion: Op[]): { seatId: string; tableId: string } | null {
  const propia = filas.find(f => persona.memberId ? f.party_member_id === persona.memberId : (f.guest_id === persona.guestId && !f.party_member_id))
  if (propia) return { seatId: propia.id, tableId: propia.table_id }
  const nueva = expansion.find(o => o.kind === 'insert' && o.row.party_member_id === persona.memberId)
  if (nueva && nueva.kind === 'insert' && persona.memberId) return { seatId: idNuevo(persona.memberId), tableId: nueva.row.table_id }
  return null
}

export function opsSentar(persona: Persona, tableId: string, eventId: string, filas: Fila[], personas: Persona[]): Op[] {
  const expansion = opsExpandir(persona.guestId, filas, personas)
  const lugar = lugarTrasExpandir(persona, filas, expansion)
  if (lugar && lugar.tableId === tableId && expansion.length === 0) return []
  if (lugar) return [...expansion, { kind: 'mover', seatId: lugar.seatId, table_id: tableId, seat_number: siguienteAsiento(tableId, filas, 0) }]
  return [{ kind: 'insert', row: { table_id: tableId, event_id: eventId, guest_id: persona.guestId, party_member_id: persona.memberId, seat_number: siguienteAsiento(tableId, filas, 0), party_size: 1 } }]
}

export function opsQuitar(persona: Persona, filas: Fila[], personas: Persona[]): Op[] {
  const expansion = opsExpandir(persona.guestId, filas, personas)
  const lugar = lugarTrasExpandir(persona, filas, expansion)
  if (!lugar) return []
  return [...expansion, { kind: 'delete', seatId: lugar.seatId }]
}

// Etiqueta ambar: solo cuando la familia esta repartida. Para el acompanante,
// la mesa de su titular; para el titular, cuantos acompanantes tiene en otra.
export function etiquetaSeparado(persona: Persona, mapa: Map<string, Lugar>, personas: Persona[], numeroDeMesa: (tableId: string) => number): string | null {
  const mio = mapa.get(persona.clave)
  if (!mio) return null
  if (persona.memberId) {
    const titular = mapa.get(persona.guestId)
    if (!titular || titular.tableId === mio.tableId) return null
    return 'Mesa ' + numeroDeMesa(titular.tableId)
  }
  const fuera = personas
    .filter(p => p.guestId === persona.guestId && p.memberId)
    .map(p => mapa.get(p.clave))
    .filter((l): l is Lugar => !!l && l.tableId !== mio.tableId)
  if (fuera.length === 0) return null
  const mesas = new Set(fuera.map(l => l.tableId))
  return '+' + fuera.length + (mesas.size === 1 ? ' en Mesa ' + numeroDeMesa(fuera[0].tableId) : ' en otras mesas')
}
