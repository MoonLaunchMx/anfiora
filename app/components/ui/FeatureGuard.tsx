'use client'

import { useState, type ReactNode } from 'react'
import { useEventAccess } from '@/lib/event-access-context'
import { FEATURES, type FeatureKey } from '@/lib/features'

export default function FeatureGuard({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { features, canAdmin, updateFeatures } = useEventAccess()
  const [activating, setActivating] = useState(false)

  if (!features) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  if (features[feature]) return <>{children}</>

  const config = FEATURES.find(f => f.key === feature)!
  const Icon = config.icon

  const handleActivate = async () => {
    setActivating(true)
    await updateFeatures({ ...features, [feature]: true })
    setActivating(false)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f4f4f4]">
        <Icon size={22} className="text-[#aaa]" />
      </div>
      <p className="text-sm font-semibold text-[#1D1E20]">Esta herramienta está desactivada para este evento</p>
      <p className="max-w-sm text-xs leading-relaxed text-[#888]">
        {config.label} no está activa.{' '}
        {canAdmin
          ? 'Puedes activarla aquí o desde Configuración — no se pierde ningún dato.'
          : 'Pide al organizador del evento que la active desde Configuración.'}
      </p>
      {canAdmin && (
        <button
          onClick={handleActivate}
          disabled={activating}
          className="mt-1 rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
        >
          {activating ? 'Activando...' : 'Activar herramienta'}
        </button>
      )}
    </div>
  )
}
