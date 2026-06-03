import type React from 'react'
import { Briefcase, PartyPopper } from 'lucide-react'

export type Role = 'planner' | 'anfitrion'

export interface RoleConfig {
  value: Role
  shortLabel: string
  label: string
  description: string
  icon: React.ElementType
}

export const ROLES: RoleConfig[] = [
  { value: 'planner',   shortLabel: 'Planner',   label: 'Planner / Organizador profesional', description: 'Organizo eventos para mis clientes.', icon: Briefcase },
  { value: 'anfitrion', shortLabel: 'Anfitrión', label: 'Anfitrión', description: 'Organizo mi propio evento (boda, XV, fiesta...).', icon: PartyPopper },
]

export function getRole(value: string | null | undefined): RoleConfig | undefined {
  return ROLES.find(r => r.value === value)
}
