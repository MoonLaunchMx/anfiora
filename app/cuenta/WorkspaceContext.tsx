'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { fetchWorkspace } from '@/lib/workspace/cliente'
import type { WorkspaceListado, WorkspaceResumen } from '@/lib/workspace/tipos'

interface Ctx {
  activo: WorkspaceResumen | null
  workspaces: WorkspaceListado[]
  cargando: boolean
  error: string | null
  recargar: () => Promise<void>
}

const WorkspaceCtx = createContext<Ctx>({ activo: null, workspaces: [], cargando: true, error: null, recargar: async () => {} })

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams()
  const pedido = params.get('ws') ?? undefined
  const [activo, setActivo] = useState<WorkspaceResumen | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceListado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    try {
      const r = await fetchWorkspace(pedido)
      setWorkspaces(r.workspaces)
      setActivo(r.activo)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar')
    } finally {
      setCargando(false)
    }
  }, [pedido])

  useEffect(() => { recargar() }, [recargar])

  const value = useMemo(() => ({ activo, workspaces, cargando, error, recargar }), [activo, workspaces, cargando, error, recargar])
  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>
}

export const useWorkspace = () => useContext(WorkspaceCtx)
