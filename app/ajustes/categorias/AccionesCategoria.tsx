'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { renombrar, ocultar, reactivar } from '@/lib/rolodex/aplicar-cambios'
import { buscarPorNombre, type Categoria } from '@/lib/rolodex/categorias-store'
import { type CategoriaConUso } from '@/lib/rolodex/vocabulario-admin'

type Props = {
  categoria: CategoriaConUso
  todas: Categoria[]
  userId: string
  onCambiado: () => void
}

function plural(n: number, singular: string, otros: string): string {
  return `${n} ${n === 1 ? singular : otros}`
}

type ModalAbierto = 'renombrar' | 'ocultar' | null

export default function AccionesCategoria({ categoria, todas, userId, onCambiado }: Props) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<ModalAbierto>(null)
  const [nombre, setNombre] = useState(categoria.nombre)
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

  const abrirRenombrar = () => {
    setNombre(categoria.nombre)
    setError('')
    setModal('renombrar')
    setOpen(false)
  }

  const abrirOcultar = () => {
    setError('')
    setModal('ocultar')
    setOpen(false)
  }

  const cerrarModal = () => { if (!guardando) setModal(null) }

  const nombreLimpio = nombre.trim()
  const duplicada = (() => {
    if (!nombreLimpio) return false
    const encontrada = buscarPorNombre(todas, nombreLimpio)
    return encontrada !== null && encontrada.id !== categoria.id
  })()
  const sinCambio = nombreLimpio === '' || nombreLimpio === categoria.nombre
  const sinUso = categoria.uso.proveedores === 0 && categoria.uso.partidas === 0

  const handleRenombrar = async () => {
    if (sinCambio || duplicada) return
    setGuardando(true)
    setError('')
    const resultado = await renombrar(userId, categoria.id, categoria.nombre, nombreLimpio)
    setGuardando(false)
    if (!resultado.ok) { setError(resultado.error ?? 'No se pudo cambiar el nombre.'); return }
    setModal(null)
    onCambiado()
  }

  const handleOcultar = async () => {
    setGuardando(true)
    setError('')
    const resultado = await ocultar(categoria.id)
    setGuardando(false)
    if (!resultado.ok) { setError(resultado.error ?? 'No se pudo ocultar la categoría.'); return }
    setModal(null)
    onCambiado()
  }

  const handleReactivar = async () => {
    setGuardando(true)
    setError('')
    const resultado = await reactivar(categoria.id)
    setGuardando(false)
    if (!resultado.ok) { setError(resultado.error ?? 'No se pudo reactivar la categoría.'); return }
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
            onClick={abrirRenombrar}
            className="block w-full px-4 py-2.5 text-left text-sm text-[#1D1E20] hover:bg-[#f8f8f8]"
          >
            Cambiar nombre
          </button>
          <button
            type="button"
            disabled
            className="block w-full cursor-not-allowed border-t border-[#f0f0f0] px-4 py-2.5 text-left text-sm text-[#bbb]"
          >
            Juntar con otra…
            <span className="mt-0.5 block text-[11px] text-[#ccc]">Disponible en el siguiente paso</span>
          </button>
          <button
            type="button"
            onClick={abrirOcultar}
            className="block w-full border-t border-[#f0f0f0] px-4 py-2.5 text-left text-sm text-[#1D1E20] hover:bg-[#f8f8f8]"
          >
            {categoria.oculta ? 'Volver a usarla' : 'Ya no la uso'}
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

      {modal === 'renombrar' && (
        <Modal open onClose={cerrarModal} size="sm">
          <Modal.Header title="Cambiar nombre" onClose={cerrarModal} />
          <Modal.Body>
            <div className="flex flex-col gap-3">
              <input
                autoFocus
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm outline-none transition focus:border-[#48C9B0]"
              />
              {duplicada ? (
                <p className="rounded-lg bg-[#fff0f0] px-3 py-2 text-xs text-[#cc3333]">
                  Ya tienes una categoría que se llama así. Júntalas en vez de renombrar
                </p>
              ) : (
                <p className="rounded-lg bg-[#f0fdfb] px-3 py-2 text-xs text-[#555]">
                  {sinUso ? (
                    'Nadie la usa todavía'
                  ) : (
                    <>
                      Se va a actualizar en <strong className="text-[#1D1E20]">{plural(categoria.uso.proveedores, 'proveedor', 'proveedores')}</strong> y{' '}
                      <strong className="text-[#1D1E20]">{plural(categoria.uso.partidas, 'partida', 'partidas')} de presupuesto</strong>, en todas tus bodas.
                    </>
                  )}
                </p>
              )}
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
              onClick={handleRenombrar}
              disabled={guardando || sinCambio || duplicada}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3aa896] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Cambiar nombre'}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {modal === 'ocultar' && !categoria.oculta && (
        <Modal open onClose={cerrarModal} size="sm">
          <Modal.Header title={`Ocultar "${categoria.nombre}"`} onClose={cerrarModal} />
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
              onClick={handleOcultar}
              disabled={guardando}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Ocultar'}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {modal === 'ocultar' && categoria.oculta && (
        <Modal open onClose={cerrarModal} size="sm">
          <Modal.Header title={`Volver a usar "${categoria.nombre}"`} onClose={cerrarModal} />
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
              onClick={handleReactivar}
              disabled={guardando}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Volver a usarla'}
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  )
}
