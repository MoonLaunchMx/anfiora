'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import HsvColorPicker from './HsvColorPicker'

const QUICK_SWATCHES = ['#ffffff', '#1D1E20', '#48C9B0', '#F4C430', '#d4a853', '#e11d1d', '#c76b86', '#6b8455', '#8b5cf6', '#0d5a6e']

const DIRS: { c: string; d: number }[] = [
  { c: '↑', d: 0 },
  { c: '↗', d: 45 },
  { c: '→', d: 90 },
  { c: '↘', d: 135 },
  { c: '↓', d: 180 },
]

export default function ColorEditor({
  label,
  value,
  onChange,
  onClose,
  fluid = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onClose: () => void
  fluid?: boolean
}) {
  const isGradient = value.includes('gradient')
  const [mode, setMode] = useState<'solido' | 'gradiente'>(isGradient ? 'gradiente' : 'solido')

  const hexes = value.match(/#[0-9a-fA-F]{3,6}/g) ?? []
  const [a, setAState] = useState(hexes[0] ?? '#6a2cf5')
  const [b, setBState] = useState(hexes[1] ?? '#ff5e8a')
  const [angle, setAngleState] = useState(Number(value.match(/(\d+)deg/)?.[1] ?? 135))
  const [editStop, setEditStop] = useState<'a' | 'b'>('a')

  const emitGradient = (na: string, nb: string, nAngle: number) => {
    onChange(`linear-gradient(${nAngle}deg, ${na}, ${nb})`)
  }
  const setA = (v: string) => { setAState(v); emitGradient(v, b, angle) }
  const setB = (v: string) => { setBState(v); emitGradient(a, v, angle) }
  const setAngle = (v: number) => { setAngleState(v); emitGradient(a, b, v) }

  const solidHex = /^#([0-9a-fA-F]{3,6})$/.test(value) ? value : (value.match(/#[0-9a-fA-F]{3,6}/)?.[0] ?? '#48C9B0')

  const goSolido = () => {
    setMode('solido')
    onChange(solidHex)
  }
  const goGradiente = () => {
    setMode('gradiente')
    emitGradient(a, b, angle)
  }

  return (
    // fluid = va dentro del primitivo Modal: el marco y el encabezado los pone el modal
    <div className={`w-full ${fluid ? '' : 'max-w-[260px] rounded-2xl border border-[#e8e8e8] bg-white p-3 shadow-sm'}`}>
      {!fluid && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#1D1E20]">{label}</span>
          <button type="button" onClick={onClose} className="text-[#bbb] transition hover:text-[#666]" aria-label="Cerrar">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-3 flex overflow-hidden rounded-lg border border-[#e0e0e0]">
        <button
          type="button"
          onClick={goSolido}
          className={`flex-1 py-1.5 text-xs transition ${mode === 'solido' ? 'bg-[#f0f0f0] font-semibold text-[#1D1E20]' : 'text-[#999]'}`}
        >
          Sólido
        </button>
        <button
          type="button"
          onClick={goGradiente}
          className={`flex-1 py-1.5 text-xs transition ${mode === 'gradiente' ? 'bg-[#f0f0f0] font-semibold text-[#1D1E20]' : 'text-[#999]'}`}
        >
          Gradiente
        </button>
      </div>

      {mode === 'solido' ? (
        <>
          <HsvColorPicker value={solidHex} onChange={v => onChange(v)} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_SWATCHES.map(sw => (
              <button
                key={sw}
                type="button"
                onClick={() => onChange(sw)}
                className="h-7 w-7 rounded-full border border-[#e0e0e0]"
                style={{ background: sw }}
                aria-label={sw}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="h-9 w-full rounded-lg border border-[#e0e0e0]" style={{ background: `linear-gradient(${angle}deg, ${a}, ${b})` }} />

          <div className="mt-3">
            <span className="text-[10px] font-medium text-[#666]">Dirección</span>
            <div className="mt-1 flex gap-1.5">
              {DIRS.map(({ c, d }) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setAngle(d)}
                  className={`h-8 w-8 rounded-lg border text-sm transition ${angle === d ? 'border-[#48C9B0] text-[#1D1E20]' : 'border-[#e0e0e0] text-[#999]'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <span className="text-[10px] font-medium text-[#666]">Colores</span>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setEditStop('a')}
                className="flex items-center gap-1.5 text-[10px] text-[#666]"
              >
                <span
                  className={`h-8 w-8 rounded-full border-2 ${editStop === 'a' ? 'border-[#48C9B0]' : 'border-[#e0e0e0]'}`}
                  style={{ background: a }}
                />
                Color 1
              </button>
              <button
                type="button"
                onClick={() => setEditStop('b')}
                className="flex items-center gap-1.5 text-[10px] text-[#666]"
              >
                <span
                  className={`h-8 w-8 rounded-full border-2 ${editStop === 'b' ? 'border-[#48C9B0]' : 'border-[#e0e0e0]'}`}
                  style={{ background: b }}
                />
                Color 2
              </button>
            </div>
          </div>

          <div className="mt-2">
            <HsvColorPicker value={editStop === 'a' ? a : b} onChange={v => (editStop === 'a' ? setA(v) : setB(v))} />
          </div>
        </>
      )}
    </div>
  )
}
