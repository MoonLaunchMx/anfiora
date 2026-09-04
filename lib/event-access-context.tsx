'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveFeatures, type FeatureKey } from '@/lib/features'
import { logAction } from '@/lib/audit'
import {
  normalizarPermisos, nivelEfectivo, puede, permisosDesdeRolLegado,
  type RolCuenta, type ContextoPermiso,
} from '@/lib/permisos/resolver'
import type { Modulo, Nivel, PermisosEvento } from '@/lib/permisos/catalogo'

// ============================================
// Roles disponibles — owner es implícito (events.user_id)
// ============================================
export type CollaboratorRole = 'owner' | 'admin' | 'editor' | 'viewer'

// ============================================
// Lo que expone el context a toda la app
// ============================================
interface EventAccessContextType {
  role: CollaboratorRole | null
  isOwner: boolean
  canEdit: boolean      // owner + admin + editor
  canAdmin: boolean     // owner + admin
  canInvite: boolean    // owner + admin
  isLoading: boolean
  hasAccess: boolean
  features: Record<FeatureKey, boolean> | null   // null mientras carga
  updateFeatures: (next: Record<FeatureKey, boolean>) => Promise<boolean>
  rolCuenta: RolCuenta
  permisos: PermisosEvento | null
  nivelDeModulo: (modulo: Modulo) => Nivel
}

const EventAccessContext = createContext<EventAccessContextType>({
  role: null,
  isOwner: false,
  canEdit: false,
  canAdmin: false,
  canInvite: false,
  isLoading: true,
  hasAccess: false,
  features: null,
  updateFeatures: async () => false,
  rolCuenta: null,
  permisos: null,
  nivelDeModulo: () => 'ninguno',
})

// ============================================
// Provider — va en events/[id]/layout.tsx
// Hace UNA query, todos los hijos la consumen del context
// ============================================
export function EventAccessProvider({
  children,
  eventId,
}: {
  children: ReactNode
  eventId: string
}) {
  const [role, setRole] = useState<CollaboratorRole | null>(null)
  const [features, setFeatures] = useState<Record<FeatureKey, boolean> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [rolCuenta, setRolCuenta] = useState<RolCuenta>(null)
  const [permisos, setPermisos] = useState<PermisosEvento | null>(null)

  useEffect(() => {
    async function checkAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Si la columna enabled_features aun no existe en la DB, la query de
        // settings regresa error y data null -> resolveFeatures(type, null) = legacy
        const [{ data: event }, { data: settings }] = await Promise.all([
          supabase.from('events').select('user_id, event_type').eq('id', eventId).single(),
          supabase.from('event_settings').select('enabled_features').eq('event_id', eventId).maybeSingle(),
        ])

        if (event) {
          setFeatures(resolveFeatures(event.event_type, settings?.enabled_features ?? null))
        }

        if (event?.user_id === user.id) {
          setRole('owner')
          setRolCuenta('dueno')
          return
        }

        const { data: collaborator } = await supabase
          .from('event_collaborators')
          .select('role, status')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single()

        if (collaborator) {
          setRole(collaborator.role as CollaboratorRole)
        }

        // Membresia de despacho y permisos por herramienta: consultas aparte,
        // tolerantes a que workspaces/workspace_members/permisos aun no existan.
        // Si fallan con error de Postgrest, data llega null y se cae al respaldo
        // legado (comportamiento de hoy). Try/catch propio: si alguna truena con
        // una excepcion real (no un error tolerado), igual debe caer al respaldo
        // legado, nunca dejar permisos en null.
        try {
          const { data: ev } = await supabase
            .from('events')
            .select('workspace_id')
            .eq('id', eventId)
            .maybeSingle()

          if (ev?.workspace_id) {
            const { data: miembro } = await supabase
              .from('workspace_members')
              .select('rol')
              .eq('workspace_id', ev.workspace_id)
              .eq('user_id', user.id)
              .eq('status', 'active')
              .maybeSingle()
            setRolCuenta((miembro?.rol as RolCuenta) ?? null)
          }

          const { data: fila } = await supabase
            .from('event_collaborators')
            .select('permisos')
            .eq('event_id', eventId)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle()

          setPermisos(
            fila?.permisos != null
              ? normalizarPermisos(fila.permisos)
              : permisosDesdeRolLegado(collaborator?.role),
          )
        } catch {
          setPermisos(permisosDesdeRolLegado(collaborator?.role))
        }
      } catch {
        console.error('[event-access] Error verificando acceso')
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [eventId])

  // Persiste el JSON completo (las 5 claves explicitas) y actualiza el estado local
  const updateFeatures = async (next: Record<FeatureKey, boolean>) => {
    const old = features
    const { error } = await supabase
      .from('event_settings')
      .upsert(
        { event_id: eventId, enabled_features: next, updated_at: new Date().toISOString() },
        { onConflict: 'event_id' },
      )
    if (error) {
      console.error('[event-access] Error guardando herramientas:', error.message)
      return false
    }
    setFeatures(next)
    logAction({
      eventId,
      action: 'event.settings_updated',
      entityType: 'settings',
      entityLabel: 'Herramientas del evento',
      oldValue: old ?? undefined,
      newValue: next,
    })
    return true
  }

  // Derivar permisos del rol — una sola fuente de verdad
  const isOwner = role === 'owner'
  const canAdmin = role === 'owner' || role === 'admin'
  const canEdit = role === 'owner' || role === 'admin' || role === 'editor'
  const canInvite = role === 'owner' || role === 'admin'
  const hasAccess = role !== null

  const ctxPermiso: ContextoPermiso = {
    esDuenoDelEvento: isOwner,
    rolCuenta,
    permisos,
    features,
  }

  const nivelDeModulo = (modulo: Modulo): Nivel => nivelEfectivo(ctxPermiso, modulo)

  return (
    <EventAccessContext.Provider value={{
      role,
      isOwner,
      canEdit,
      canAdmin,
      canInvite,
      isLoading,
      hasAccess,
      features,
      updateFeatures,
      rolCuenta,
      permisos,
      nivelDeModulo,
    }}>
      {children}
    </EventAccessContext.Provider>
  )
}

// ============================================
// Hook — lo que usan todos los componentes hijos
// ============================================
export function useEventAccess() {
  return useContext(EventAccessContext)
}

export function usePermiso(modulo: Modulo) {
  const { nivelDeModulo } = useEventAccess()
  const nivel = nivelDeModulo(modulo)
  return {
    nivel,
    ver: puede(nivel, 'ver'),
    editar: puede(nivel, 'editar'),
    borrar: puede(nivel, 'borrar'),
  }
}
