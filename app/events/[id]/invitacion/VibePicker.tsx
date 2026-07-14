'use client'
import { VIBES_BY_CATEGORY } from '@/lib/invite/vibes'
import type { VibeCategory } from '@/lib/invite/theme'

const CAT_LABELS: Record<VibeCategory, string> = {
  elegantes: 'Elegantes y bodas',
  celebracion: 'Celebración',
  retro: 'Retro',
  musica: 'Por música',
  temporada: 'Por temporada',
}
const CAT_ORDER: VibeCategory[] = ['elegantes', 'celebracion', 'retro', 'musica', 'temporada']

export default function VibePicker({ activeVibeId, onSelect }: { activeVibeId: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {CAT_ORDER.map(cat => (
        <div key={cat}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">{CAT_LABELS[cat]}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {(VIBES_BY_CATEGORY[cat] ?? []).map(v => {
              const active = v.id === activeVibeId
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelect(v.id)}
                  className={`overflow-hidden rounded-xl border-2 text-left transition ${active ? 'border-[#48C9B0]' : 'border-transparent hover:border-[#e0e0e0]'}`}
                >
                  <div
                    className="flex h-16 items-center justify-center px-2 text-center text-sm font-semibold"
                    style={{ background: v.theme.colores.fondo, color: v.theme.colores.acento }}
                  >
                    Ana &amp; Luis
                  </div>
                  <div className="flex items-center justify-between bg-white px-2.5 py-1.5">
                    <span className="truncate text-xs font-medium text-[#1D1E20]">{v.nombre}</span>
                    {active && <span className="ml-1 shrink-0 text-[10px] font-semibold text-[#48C9B0]">Activo</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
