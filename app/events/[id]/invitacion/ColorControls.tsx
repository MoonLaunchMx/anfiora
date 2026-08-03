'use client'
import { useEffect, useState } from 'react'
import ColorEditor from './ColorEditor'
import { Modal } from '@/app/components/ui/Modal'

type Colores = {
  fondo: string
  texto: string
  titulo?: string
  tarjeta?: string
  acento: string
  botonBg: string
  botonTexto: string
}

type ColorToken = keyof Colores

const TOKENS: { key: ColorToken; label: string }[] = [
  { key: 'fondo', label: 'Fondo' },
  { key: 'titulo', label: 'Título' },
  { key: 'texto', label: 'Cuerpo' },
  { key: 'tarjeta', label: 'Cajas' },
  { key: 'acento', label: 'Acento' },
  { key: 'botonBg', label: 'Botón' },
  { key: 'botonTexto', label: 'Texto botón' },
]

const ROW1 = TOKENS.slice(0, 3)
const ROW2 = TOKENS.slice(3)

export default function ColorControls({
  colores,
  onColores,
}: {
  colores: Colores
  onColores: (patch: Partial<Colores>) => void
}) {
  const [open, setOpen] = useState<ColorToken | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const modalOpen = open !== null && isMobile
  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [modalOpen])

  const apply = (token: ColorToken, v: string) => onColores({ [token]: v } as Partial<Colores>)
  const openLabel = TOKENS.find(t => t.key === open)?.label
  const valueOf = (key: ColorToken) =>
    colores[key] ?? (key === 'titulo' ? colores.texto : key === 'tarjeta' ? '#ffffff' : '#000000')

  const renderCircle = ({ key, label }: { key: ColorToken; label: string }) => (
    <div key={key} className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen(open === key ? null : key)}
        className={`h-10 w-10 rounded-full shadow-sm outline-none transition-transform hover:scale-105 ${open === key ? 'border-2 border-[#48C9B0]' : 'border border-[#e0e0e0]'}`}
        style={{ background: valueOf(key) }}
        aria-label={label}
      />
      <span className="text-[10px] text-[#666]">{label}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-4">
        <div className="flex justify-around gap-2 sm:contents">{ROW1.map(renderCircle)}</div>
        <div className="flex justify-around gap-2 sm:contents">{ROW2.map(renderCircle)}</div>
      </div>

      {open && !isMobile && (
        <ColorEditor
          label={openLabel ?? ''}
          value={valueOf(open)}
          onChange={v => apply(open, v)}
          onClose={() => setOpen(null)}
        />
      )}

      {modalOpen && open && (
        <Modal open onClose={() => setOpen(null)} size="sm">
          <Modal.Header title={openLabel ?? 'Elegir color'} />
          <Modal.Body>
            <ColorEditor
              label={openLabel ?? ''}
              value={valueOf(open)}
              onChange={v => apply(open, v)}
              onClose={() => setOpen(null)}
              fluid
            />
          </Modal.Body>
        </Modal>
      )}
    </div>
  )
}
