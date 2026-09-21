'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { archivar, restaurar, fusionar, eliminar } from '@/lib/rolodex/aplicar-cambios'
import { puedeEliminarse, type CategoriaConUso } from '@/lib/rolodex/vocabulario-admin'

type Props = {
  categoria: CategoriaConUso
  otrasActivas: CategoriaConUso[]
  userId: string
  onCambiado: () => void
}

export type AccionesCategoriaHandle = {
  abrirFusionarCon: (quedaId: string) => void
}

function plural(n: number, singular: string, otros: string): string {
  return `${n} ${n === 1 ? singular : otros}`
}

// Solo menciona lo que de verdad la usa: si nada mas hay partidas sin
// proveedores (o al reves) decir "0 proveedores" seria confuso.
function razonUso(uso: CategoriaConUso['uso']): string {
  const partes: string[] = []
  if (uso.proveedores > 0) partes.push(plural(uso.proveedores, 'proveedor', 'proveedores'))
  if (uso.partidas > 0) partes.push(plural(uso.partidas, 'partida', 'partidas'))
  return `La están usando ${partes.join(' y ')}`
}

type ModalAbierto = 'archivar' | 'fusionar' | 'eliminar' | null

const AccionesCategoria = forwardRef<AccionesCategoriaHandle, Props>(function AccionesCategoria(
  { categoria, otrasActivas, userId, onCambiado },
  ref,
) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<ModalAbierto>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [quedaId, setQuedaId] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  const puedeBorrar = puedeEliminarse(categoria.uso)
  const opciones = otrasActivas.filter(c => c.id !== categoria.id)
  const destino = opciones.find(c => c.id === quedaId) ?? null

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useImperativeHandle(ref, () => ({
    abrirFusionarCon: (id: string) => {
      setError('')
      setQuedaId(id)
      setModal('fusionar')
      setOpen(false)
    },
  }))

  const abrirArchivar = () => {
    setError('')
    setModal('archivar')
    setOpen(false)
  }

  const abrirFusionar = () => {
    setError('')
    setQuedaId(opciones[0]?.id ?? '')
    setModal('fusionar')
    setOpen(false)
  }

  const abrirEliminar = () => {
    if (!puedeBorrar) return
    setError('')
    setModal('eliminar')
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

  const handleFusionar = async () => {
    if (!destino) { setError('Elige con cuál se queda.'); return }
    setGuardando(true)
    setError('')
    const resultado = await fusionar(userId, categoria.id, destino.id, destino.nombre)
    setGuardando(false)
    if (!resultado.ok) { setError(resultado.error ?? 'No se pudo fusionar la categoría.'); return }
    setModal(null)
    onCambiado()
  }

  const handleEliminar = async () => {
    setGuardando(true)
    setError('')
    const resultado = await eliminar(userId, categoria.id)
    setGuardando(false)
    if (!resultado.ok) { setError(resultado.error ?? 'No se pudo eliminar la categoría.'); return }
    setModal(null)
    onCambiado()
  }

  const consecuencia = destino
    ? puedeEliminarse(categoria.uso)
      ? `"${categoria.nombre}" no la usa nadie; solo desaparecerá de tus menús.`
      : (() => {
          const partes: string[] = []
          if (categoria.uso.proveedores > 0) partes.push(plural(categoria.uso.proveedores, 'proveedor', 'proveedores'))
          if (categoria.uso.partidas > 0) partes.push(plural(categoria.uso.partidas, 'partida', 'partidas'))
          return `${partes.join(' y ')} pasan de "${categoria.nombre}" a "${destino.nombre}". La categoría "${categoria.nombre}" desaparece de tus menús.`
        })()
    : ''

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
            onClick={abrirFusionar}
            disabled={opciones.length === 0}
            className={`block w-full px-4 py-2.5 text-left text-sm ${opciones.length === 0 ? 'cursor-not-allowed text-[#bbb]' : 'text-[#1D1E20] hover:bg-[#f8f8f8]'}`}
          >
            Fusionar
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
            onClick={abrirEliminar}
            disabled={!puedeBorrar}
            className={`block w-full border-t border-[#f0f0f0] px-4 py-2.5 text-left text-sm ${puedeBorrar ? 'text-[#1D1E20] hover:bg-[#f8f8f8]' : 'cursor-not-allowed text-[#bbb]'}`}
          >
            Eliminar
            {!puedeBorrar && (
              <span className="mt-0.5 block text-[11px] text-[#ccc]">{razonUso(categoria.uso)}</span>
            )}
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

      {modal === 'fusionar' && (
        <Modal open onClose={cerrarModal} size="sm">
          <Modal.Header title={`Fusionar "${categoria.nombre}"`} onClose={cerrarModal} />
          <Modal.Body>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#666]">¿Cuál se queda?</label>
                <select
                  value={quedaId}
                  onChange={e => setQuedaId(e.target.value)}
                  className="w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm outline-none focus:border-[#48C9B0]"
                >
                  {opciones.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              {destino && (
                <p className="rounded-lg bg-[#f0fdfb] px-3 py-2 text-xs text-[#555]">{consecuencia}</p>
              )}
              <p className="text-xs font-medium text-[#cc3333]">Esto no se puede deshacer.</p>
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
              onClick={handleFusionar}
              disabled={guardando || !destino}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
            >
              {guardando ? 'Fusionando...' : 'Fusionar'}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {modal === 'eliminar' && (
        <Modal open onClose={cerrarModal} size="sm">
          <Modal.Header title={`Eliminar "${categoria.nombre}"`} onClose={cerrarModal} />
          <Modal.Body>
            <div className="flex flex-col gap-3">
              <p className="rounded-lg bg-[#f0fdfb] px-3 py-2 text-xs text-[#555]">
                Nadie la usa: {categoria.uso.proveedores} proveedores, {categoria.uso.partidas} partidas. Se puede quitar sin consecuencias.
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
              onClick={handleEliminar}
              disabled={guardando}
              className="rounded-lg bg-[#cc3333] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b82e2e] disabled:opacity-50"
            >
              {guardando ? 'Eliminando...' : 'Eliminar'}
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  )
})

export default AccionesCategoria
