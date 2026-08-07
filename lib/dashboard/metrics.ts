import { estadoPublicacion } from '@/lib/invite/publicacion'
import { parseDressCode } from '@/lib/dresscode'
import { posicionMesa } from './croquis'
import type {
  CancionPedida, Dinero, EventMetrics, Invitados, MesaCroquis, Mesas, MetricsInput,
  Playlist, Proveedores, Regalos, SongRow, Tareas, TaskRow,
} from './types'

function num(v: number | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 100)
}

// Un dia natural sin hora, para comparar fechas de tarea contra hoy sin que la
// hora local mueva el resultado.
function dia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function diaDeYMD(str: string): number | null {
  const [y, m, d] = str.split('T')[0].split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d).getTime()
}

function calcInvitados(input: MetricsInput): Invitados {
  const estados = [
    ...input.guests.map(g => g.rsvp_status),
    ...input.members.map(m => m.rsvp_status),
  ]
  const confirmados = estados.filter(s => s === 'confirmed').length
  const total = estados.length
  return {
    total,
    confirmados,
    pendientes: estados.filter(s => s === 'pending').length,
    declinados: estados.filter(s => s === 'declined').length,
    pctConfirmado: pct(confirmados, total),
    atencion: input.guests.filter(g => g.needs_attention === true).length,
  }
}

function calcDinero(input: MetricsInput): Dinero {
  const estimado = input.budgets.reduce((s, b) => s + num(b.budget_amount), 0)
  const contratados = input.suppliers.filter(s => s.status === 'contratado')
  const contratado = contratados.reduce((s, p) => s + num(p.contract_amount), 0)
  const idsContratados = new Set(contratados.map(s => s.id))
  const pagado = input.payments
    .filter(p => idsContratados.has(p.event_supplier_id))
    .reduce((s, p) => s + num(p.amount), 0)
  return {
    estimado,
    contratado,
    pagado,
    porPagar: Math.max(0, contratado - pagado),
    sinContratar: Math.max(0, estimado - contratado),
    excedido: estimado > 0 && contratado > estimado,
    pctContratado: pct(contratado, estimado),
  }
}

function calcProveedorConSaldo(input: MetricsInput): EventMetrics['proveedorConSaldo'] {
  const pagadoPorProveedor = new Map<string, number>()
  for (const p of input.payments) {
    pagadoPorProveedor.set(p.event_supplier_id, (pagadoPorProveedor.get(p.event_supplier_id) ?? 0) + num(p.amount))
  }
  const conSaldo = input.suppliers
    .filter(s => s.status === 'contratado')
    .map(s => {
      const contratado = num(s.contract_amount)
      const pagado = pagadoPorProveedor.get(s.id) ?? 0
      return { nombre: s.supplier_name ?? 'Proveedor', contratado, pagado, porPagar: Math.max(0, contratado - pagado) }
    })
    .filter(s => s.porPagar > 0)
    .sort((a, b) => b.porPagar - a.porPagar)
  return conSaldo[0] ?? null
}

function calcProveedores(input: MetricsInput): Proveedores {
  const vivos = input.suppliers.filter(s => s.status !== 'descartado')
  return {
    total: vivos.length,
    contratados: vivos.filter(s => s.status === 'contratado').length,
    cotizados: vivos.filter(s => s.status === 'cotizado').length,
    nuevos: vivos.filter(s => s.status === 'nuevo').length,
  }
}

function tareasVivas(input: MetricsInput): TaskRow[] {
  return input.tasks.filter(t => t.is_completed !== true && !!t.task_date)
}

function calcTareas(input: MetricsInput): Tareas {
  const hoyMs = dia(input.hoy)
  const vivas = tareasVivas(input)
  let vencidas = 0, hoy = 0, proximas = 0, bloqueantesVencidas = 0
  for (const t of vivas) {
    const ms = diaDeYMD(t.task_date as string)
    if (ms === null) continue
    if (ms < hoyMs) {
      vencidas++
      if (t.priority === 'bloqueante') bloqueantesVencidas++
    } else if (ms === hoyMs) hoy++
    else proximas++
  }
  return { vencidas, hoy, proximas, bloqueantesVencidas }
}

// La tarea que el dashboard destaca: la mas atrasada; si no hay atrasadas, la
// mas proxima. Las bloqueantes ganan a igualdad de fecha.
function calcTareasOrdenadas(input: MetricsInput): TaskRow[] {
  return tareasVivas(input)
    .map(t => ({ t, ms: diaDeYMD(t.task_date as string) }))
    .filter((x): x is { t: TaskRow; ms: number } => x.ms !== null)
    .sort((a, b) => a.ms - b.ms || Number(b.t.priority === 'bloqueante') - Number(a.t.priority === 'bloqueante'))
    .map(x => x.t)
}

function calcRegalos(input: MetricsInput): Regalos {
  return {
    recibido: input.reservations.reduce((s, r) => s + num(r.amount), 0),
    apartados: input.reservations.length,
    totalItems: input.giftItems.length,
  }
}

function calcMesas(input: MetricsInput): Mesas {
  const capacidad = input.tables.reduce((s, t) => s + num(t.capacity), 0)
  const ocupados = input.seats.filter(s => !!s.guest_id)
  const conLugar = ocupados.reduce((s, seat) => s + Math.max(1, num(seat.party_size)), 0)
  const confirmadosPorCabeza = input.guests
    .filter(g => g.rsvp_status === 'confirmed')
    .reduce((s, g) => s + Math.max(1, num(g.party_size)), 0)
  return {
    mesas: input.tables.length,
    conGente: new Set(ocupados.map(s => s.table_id)).size,
    conLugar,
    sinLugar: Math.max(0, confirmadosPorCabeza - conLugar),
    sillasLibres: Math.max(0, capacidad - conLugar),
  }
}

function calcCroquis(input: MetricsInput): MesaCroquis[] {
  const ocupadosPorMesa = new Map<string, number>()
  for (const s of input.seats) {
    if (!s.guest_id) continue
    ocupadosPorMesa.set(s.table_id, (ocupadosPorMesa.get(s.table_id) ?? 0) + Math.max(1, num(s.party_size)))
  }

  return input.tables.map((t, i) => ({
    id: t.id,
    numero: t.number,
    nombre: t.name,
    forma: t.shape,
    rotacion: num(t.rotation),
    ...posicionMesa(t, i),
    capacidad: num(t.capacity),
    ocupados: ocupadosPorMesa.get(t.id) ?? 0,
  }))
}

// La misma cancion la pide mas de un invitado y llega como filas distintas.
// Se agrupan por titulo y artista, sin acentos ni mayusculas, porque cada quien
// la escribe como quiere. La portada se toma de la primera que traiga una.
export function calcPlaylist(songs: SongRow[]): Playlist {
  const grupos = new Map<string, CancionPedida>()

  for (const s of songs) {
    const titulo = (s.song_title ?? '').trim()
    if (!titulo) continue
    const artista = (s.artist ?? '').trim() || null
    const llave = normalizar(titulo) + '|' + normalizar(artista ?? '')

    const previo = grupos.get(llave)
    if (previo) {
      previo.veces++
      previo.thumbnail = previo.thumbnail ?? s.thumbnail
    } else {
      grupos.set(llave, { titulo, artista, thumbnail: s.thumbnail, veces: 1 })
    }
  }

  const ordenadas = [...grupos.values()].sort((a, b) => b.veces - a.veces || a.titulo.localeCompare(b.titulo))

  return {
    total: songs.filter(s => (s.song_title ?? '').trim()).length,
    distintas: ordenadas.length,
    masPedida: ordenadas[0] ?? null,
  }
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
}

export function computeEventMetrics(input: MetricsInput): EventMetrics {
  const tareasProximas = calcTareasOrdenadas(input)
  return {
    tareasProximas,
    proximaTarea: tareasProximas[0] ?? null,
    event: input.event,
    invitados: calcInvitados(input),
    dinero: calcDinero(input),
    proveedores: calcProveedores(input),
    tareas: calcTareas(input),
    regalos: calcRegalos(input),
    mesas: calcMesas(input),
    playlist: calcPlaylist(input.songs),
    vestimenta: parseDressCode(input.settings?.dress_code),
    croquis: calcCroquis(input),
    invitacion: estadoPublicacion(input.settings?.invite_draft, input.settings?.invite_config),
    accessMode: input.settings?.access_mode ?? null,
    sharedToken: input.settings?.shared_token ?? null,
    proveedorConSaldo: calcProveedorConSaldo(input),
  }
}
