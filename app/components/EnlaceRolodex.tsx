'use client'

import { useEffect, useState } from 'react'
import { BookUser } from 'lucide-react'
import { planDelWorkspaceActivo } from '@/lib/workspace/cliente'

// El Rolodex es de plan: free no lo tiene. Mientras no se sepa el plan o si
// ya se confirmo que paga o que trae el sello de fundador el boton se
// muestra — nunca se esconde una herramienta a quien si paga por un tropiezo
// de red. Solo se oculta cuando SI se confirmo free sin sello.
function useTieneRolodex(): boolean {
  const [oculto, setOculto] = useState(false)

  useEffect(() => {
    let vivo = true
    void planDelWorkspaceActivo().then(r => {
      if (!vivo || !r) return
      setOculto(r.plan === 'free' && r.sello !== 'fundador')
    })
    return () => { vivo = false }
  }, [])

  return !oculto
}

export function EnlaceRolodex() {
  const tieneRolodex = useTieneRolodex()
  if (!tieneRolodex) return null

  return (
    <button
      onClick={() => window.location.href = '/rolodex'}
      title="Rolodex"
      className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-2.5 py-2 text-xs text-[#888] transition hover:border-[#48C9B0] hover:text-[#1a9e88]"
    >
      <BookUser size={16} />
      <span className="hidden sm:inline">Rolodex</span>
    </button>
  )
}
