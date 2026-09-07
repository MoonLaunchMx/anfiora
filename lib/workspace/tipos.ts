import type { FeatureKey } from '@/lib/features'
import type { PermisosEvento } from '@/lib/permisos/catalogo'
import type { PlanId } from './planes'

export type RolWorkspace = 'dueno' | 'admin' | 'colaborador'
export type RolInvitable = 'admin' | 'colaborador'
export type StatusMiembro = 'pending' | 'active' | 'revoked'

export const ROL_LABEL: Record<RolWorkspace, string> = {
  dueno: 'Dueño',
  admin: 'Administrador',
  colaborador: 'Colaborador',
}

export interface BodaDelWorkspace {
  id: string
  name: string
  event_date: string | null
  event_status: string | null
  features: Record<FeatureKey, boolean>
}

export interface BodaDeMiembro {
  eventId: string
  name: string
  collaboratorId: string
  status: StatusMiembro
  permisos: PermisosEvento
}

export interface Miembro {
  id: string
  email: string
  user_id: string | null
  nombre: string | null
  rol: RolWorkspace
  es_dueno_principal: boolean
  status: StatusMiembro
  invite_token: string | null
  invited_at: string
  accepted_at: string | null
  bodas: BodaDeMiembro[]
}

export interface Cliente {
  id: string
  email: string
  user_id: string | null
  status: StatusMiembro
  invite_token: string | null
  eventId: string
  eventName: string
  permisos: PermisosEvento
}

export interface WorkspaceResumen {
  id: string
  name: string
  plan: PlanId
  miRol: RolWorkspace
  esDuenoPrincipal: boolean
  miembros: Miembro[]
  clientes: Cliente[]
  bodas: BodaDelWorkspace[]
}

export interface WorkspaceListado {
  id: string
  name: string
  plan: PlanId
  miRol: RolWorkspace
}
