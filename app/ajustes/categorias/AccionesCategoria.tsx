'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { archivar, restaurar } from '@/lib/rolodex/aplicar-cambios'
import { type CategoriaConUso } from '@/lib/rolodex/vocabulario-admin'

type Props = {
  categoria: CategoriaConUso
  onCambiado: () => void
}

function plural(n: number, singular: string, otros: string): string {
  return `${n} ${n === 1 ? singular : otros}`
}

type ModalAbierto = 'archivar' | null

export default function AccionesCategoria({ categoria, onCambiado }: Props) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<ModalAbierto>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const abrirArchivar = () => {
    setError('')
    setModal('archivar')
    setOpen(false)
  }

  const cerrarModal = () => { if (!guardando) setModal(null) }

  const handleArchivar = async () => {
    setGuardando(true)
    setError('')
    const resultado = await archivar(categoria.id)
    setGuardando(false)
    if (!resultado.ok) { setError(resultado.error ?? 'No se pudo archivar la categoría.'); return }
    setModal(null)
    onCambiado()
  }

  const handleRestaurar = async () => {
    setGuardando(true)
    setError('')
    const resultado = await restaurar(categoria.id)
    setGuardando(false)
    if (!resultado.ok) { setError(resultado.error ?? 'No se pudo restaurar la categoría.'); return }
    setModal(null)
    onCambiado()
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="rounded-lg p-1.5 text-[#bbb] transition hover:bg-[#f8f8f8] hover:text-[#888]"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-[#e8e8e8] bg-white shadow-lg">
          <button
            type="button"
            disabled
            className="block w-full cursor-not-allowed px-4 py-2.5 text-left text-sm text-[#bbb]"
          >
            Juntar con otra…
            <span className="mt-0.5 block text-[11px] text-[#ccc]">Disponible en el siguiente paso</span>
          </button>
          <button
            type="button"
            onClick={abrirArchivar}
            className="block w-full border-t border-[#f0f0f0] px-4 py-2.5 text-left text-sm text-[#1D1E20] hover:bg-[#f8f8f8]"
          >
            {categoria.archivada ? 'Restaurar' : 'Archivar'}
          </button>
          <button
            type="button"
            disabled
            className="block w-full cursor-not-allowed border-t border-[#f0f0f0] px-4 py-2.5 text-left text-sm text-[#bbb]"
          >
            Eliminar
            <span className="mt-0.5 block text-[11px] text-[#ccc]">Disponible en el siguiente paso</span>
          </button>
        </div>
      )}

      {modal === 'archivar' && !categoria.archivada && (
        <Modal open onClose={cerrarModal} size="sm">
          <Modal.Header title={`Archivar "${categoria.nombre}"`} onClose={cerrarModal} />
          <Modal.Body>
            <div className="flex flex-col gap-3">
              <p className="rounded-lg bg-[#f0fdfb] px-3 py-2 text-xs text-[#555]">
                Deja de aparecer cuando captures proveedores o partidas.{' '}
                <strong className="text-[#1D1E20]">
                  Tus {plural(categoria.uso.proveedores, 'proveedor', 'proveedores')} que ya la tienen no cambian
                </strong>, y su historial se conserva.
              </p>
              {error && <p className="text-xs text-[#cc3333]">{error}</p>}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={cerrarModal}
              disabled={guardando}
              className="px-4 py-2 text-sm text-[#666] transition hover:text-[#1D1E20] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleArchivar}
              disabled={guardando}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Archivar'}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {modal === 'archivar' && categoria.archivada && (
        <Modal open onClose={cerrarModal} size="sm">
          <Modal.Header title={`Restaurar "${categoria.nombre}"`} onClose={cerrarModal} />
          <Modal.Body>
            <div className="flex flex-col gap-3">
              <p className="rounded-lg bg-[#f0fdfb] px-3 py-2 text-xs text-[#555]">
                Vuelve a aparecer en los menús al capturar proveedores y partidas.
              </p>
              {error && <p className="text-xs text-[#cc3333]">{error}</p>}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={cerrarModal}
              disabled={guardando}
              className="px-4 py-2 text-sm text-[#666] transition hover:text-[#1D1E20] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRestaurar}
              disabled={guardando}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Restaurar'}
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  )
}
