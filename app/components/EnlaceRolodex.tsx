'use client'

import { useEffect, useState } from 'react'
import { BookUser } from 'lucide-react'
import { planDelWorkspaceActivo } from '@/lib/workspace/cliente'

type Estado = 'cargando' | 'visible' | 'oculto'

// El Rolodex es de plan: free no lo tiene. Mientras no se sepa el plan no se
// pinta nada — ni el boton ni un hueco a medio armar: que aparezca y luego se
// esconda es peor que no mostrarlo ese instante. Cuando resuelve: si la
// lectura fallo se muestra (nunca se le esconde una herramienta a quien si
// paga por un tropiezo de red); si es de paga o trae el sello de fundador se
// muestra; solo se oculta cuando SI se confirmo free sin sello.
function useEstadoRolodex(): Estado {
  const [estado, setEstado] = useState<Estado>('cargando')

  useEffect(() => {
    let vivo = true
    void planDelWorkspaceActivo().then(r => {
      if (!vivo) return
      if (!r) { setEstado('visible'); return }
      setEstado(r.plan === 'free' && r.sello !== 'fundador' ? 'oculto' : 'visible')
    })
    return () => { vivo = false }
  }, [])

  return estado
}

export function EnlaceRolodex() {
  const estado = useEstadoRolodex()
  if (estado !== 'visible') return null

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
