import { MODULOS, type Modulo, type Nivel, type PermisosEvento } from '@/lib/permisos/catalogo'
import { normalizarPermisos } from '@/lib/permisos/resolver'
import type { RolInvitable } from './tipos'

const ORDEN: Record<Nivel, number> = { ninguno: 0, ver: 1, editar: 2, total: 3 }
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizarCorreo(s: string): string {
  return (s || '').trim().toLowerCase()
}

export function nivelMayor(a: Nivel, b: Nivel): Nivel {
  return ORDEN[a] >= ORDEN[b] ? a : b
}

// El kit habitual es lo que la persona ya tiene en sus otras bodas: por modulo,
// el nivel mas alto que aparezca. Si no tiene nada, el kit es vacio y la
// pantalla precarga su propio punto de partida.
export function kitDesde(filas: { permisos: unknown }[]): PermisosEvento {
  const kit: PermisosEvento = {}
  for (const f of filas) {
    const p = normalizarPermisos(f.permisos)
    for (const m of MODULOS) {
      const n = p[m]
      if (!n || n === 'ninguno') continue
      kit[m] = nivelMayor(kit[m] ?? 'ninguno', n)
    }
  }
  return kit
}

function tieneAlgo(p: PermisosEvento): boolean {
  return MODULOS.some(m => p[m] && p[m] !== 'ninguno')
}

// `role` legado se sigue escribiendo como punto de partida: los helpers de
// Postgres (is_event_editor) todavia lo leen. editor si edita algo, viewer si no.
function roleLegado(p: PermisosEvento): 'editor' | 'viewer' {
  return MODULOS.some(m => p[m] === 'editar' || p[m] === 'total') ? 'editor' : 'viewer'
}

export interface BodaElegida { eventId: string; permisos: PermisosEvento }

export interface FilaMiembroNueva {
  workspace_id: string
  email: string
  rol: RolInvitable
  es_dueno_principal: false
  status: 'pending'
  invite_token: string
  invited_by: string
  kit_habitual: PermisosEvento | null
}

export interface FilaColaboradorNueva {
  event_id: string
  email: string
  invited_by: string
  status: 'pending'
  tipo: 'equipo'
  role: 'editor' | 'viewer'
  permisos: PermisosEvento
}

export function filasDeAlta(p: {
  workspaceId: string
  email: string
  rol: RolInvitable
  bodas: BodaElegida[]
  invitedBy: string
  token: string
}): { miembro: FilaMiembroNueva; colaboradores: FilaColaboradorNueva[] } {
  const email = normalizarCorreo(p.email)
  const conAlgo = p.rol === 'admin' ? [] : p.bodas
    .map(b => ({ eventId: b.eventId, permisos: normalizarPermisos(b.permisos) }))
    .filter(b => tieneAlgo(b.permisos))

  const colaboradores: FilaColaboradorNueva[] = conAlgo.map(b => ({
    event_id: b.eventId, email, invited_by: p.invitedBy, status: 'pending',
    tipo: 'equipo', role: roleLegado(b.permisos), permisos: b.permisos,
  }))

  const kit = p.rol === 'admin' ? null : kitDesde(conAlgo)

  return {
    miembro: {
      workspace_id: p.workspaceId, email, rol: p.rol, es_dueno_principal: false,
      status: 'pending', invite_token: p.token, invited_by: p.invitedBy, kit_habitual: kit,
    },
    colaboradores,
  }
}

export interface Validacion { ok: boolean; error: string | null }

const ok: Validacion = { ok: true, error: null }
const falla = (error: string): Validacion => ({ ok: false, error })

export function validarAltaEquipo(p: {
  email: string
  miembros: { email: string; status: string }[]
}): Validacion {
  const email = normalizarCorreo(p.email)
  if (!RE_CORREO.test(email)) return falla('Escribe un correo válido')
  const vivo = p.miembros.find(m => normalizarCorreo(m.email) === email && m.status !== 'revoked')
  if (vivo) return falla('Esa persona ya es de tu equipo')
  return ok
}

export function validarCliente(p: {
  email: string
  eventId: string
  colaboradores: { email: string; event_id: string; tipo: string | null; status: string }[]
  miembros: { email: string; status: string }[]
}): Validacion {
  const email = normalizarCorreo(p.email)
  if (!RE_CORREO.test(email)) return falla('Escribe un correo válido')
  if (p.miembros.some(m => normalizarCorreo(m.email) === email && m.status !== 'revoked')) {
    return falla('Es de tu equipo: dale acceso desde su ficha')
  }
  const vivas = p.colaboradores.filter(c => normalizarCorreo(c.email) === email && c.status !== 'revoked')
  if (vivas.some(c => c.event_id === p.eventId)) return falla('Ese correo ya tiene acceso a esta boda')
  if (vivas.some(c => c.tipo === 'cliente')) {
    return falla('Ese correo ya es cliente de otra boda. Un cliente solo tiene una')
  }
  return ok
}

// Al aceptar el enlace de miembro se activan, de un jalon, todas las filas de
// colaborador que la invitacion dejo pendientes en bodas de ESE workspace.
export function filasParaActivar(p: {
  email: string
  colaboradores: { id: string; email: string; status: string; event_id: string }[]
  eventosDelWorkspace: string[]
}): string[] {
  const email = normalizarCorreo(p.email)
  const propios = new Set(p.eventosDelWorkspace)
  return p.colaboradores
    .filter(c => normalizarCorreo(c.email) === email && c.status === 'pending' && propios.has(c.event_id))
    .map(c => c.id)
}

export type { Modulo }
