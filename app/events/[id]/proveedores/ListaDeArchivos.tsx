'use client'

import { useRef, useState } from 'react'
import { AlertCircle, Eye, FileText, Image as ImageIcon, Plus, Trash2, Upload } from 'lucide-react'
import type { ArchivoAdjunto } from '@/lib/types'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { type Carpeta, esImagen, pesoLegible, validarArchivo, visibles } from '@/lib/archivos/adjuntos'
import { abrirArchivo, quitarArchivo, subirAlBucket, subirArchivo } from '@/lib/archivos/bucket'
import VisorDeArchivo from './VisorDeArchivo'

const ACEPTA = 'application/pdf,image/jpeg,image/png,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.heic,.heif'

type Props = {
  eventId: string
  carpeta: Carpeta
  dueno: string
  archivos: ArchivoAdjunto[]
  tope: number
  puedeEditar: boolean
  textoVacio: string
  onCambio: (lista: ArchivoAdjunto[]) => void
  // false cuando la fila dueña todavia no existe -- un pago que se esta
  // capturando. El archivo sube al bucket y la lista viaja con quien guarde.
  persistir?: boolean
}

export default function ListaDeArchivos({
  eventId, carpeta, dueno, archivos, tope, puedeEditar, textoVacio, onCambio, persistir = true,
}: Props) {
  const askConfirm = useConfirm()
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState('')
  const [error, setError] = useState('')
  const [viendo, setViendo] = useState<{ archivo: ArchivoAdjunto; url: string } | null>(null)
  const [abriendo, setAbriendo] = useState('')

  const lista = visibles(archivos)

  const elegir = async (file: File | undefined) => {
    if (!file) return
    setError('')

    const problema = validarArchivo(file.name, file.type, file.size, lista.length, tope)
    if (problema) { setError(problema); return }

    setSubiendo(file.name)

    if (persistir) {
      const res = await subirArchivo(eventId, carpeta, dueno, file)
      setSubiendo('')
      if (res.error) setError(res.error)
      else if (res.lista) onCambio(res.lista)
      return
    }

    const res = await subirAlBucket(eventId, carpeta, dueno, file)
    setSubiendo('')
    if (res.error) setError(res.error)
    else if (res.archivo) onCambio([...(archivos ?? []), res.archivo])
  }

  const abrir = async (archivo: ArchivoAdjunto) => {
    setError('')
    setAbriendo(archivo.path)
    const url = await abrirArchivo(archivo.path)
    setAbriendo('')
    if (!url) { setError('No se pudo abrir el archivo. Intenta de nuevo.'); return }
    setViendo({ archivo, url })
  }

  const quitar = async (archivo: ArchivoAdjunto) => {
    const ok = await askConfirm({
      title: 'Quitar este archivo',
      message: `${archivo.nombre} deja de verse aquí. El archivo se queda guardado y se puede recuperar.`,
      confirmLabel: 'Quitar',
      tone: 'danger',
    })
    if (!ok) return

    setError('')

    // Sin fila que actualizar, quitarlo es sacarlo de la lista que todavia no
    // se guarda. El objeto se queda en el bucket, como en todos los demas casos.
    if (!persistir) {
      onCambio((archivos ?? []).filter(otro => otro.path !== archivo.path))
      return
    }

    const res = await quitarArchivo(carpeta, dueno, archivo.path)
    if (res.error) setError(res.error)
    else if (res.lista) onCambio(res.lista)
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={entrada}
        type="file"
        accept={ACEPTA}
        className="hidden"
        onChange={e => { elegir(e.target.files?.[0]); e.target.value = '' }}
      />

      {lista.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {lista.map((archivo, i) => (
            <li
              key={archivo.path}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                i === 0 ? 'border-[#a8e0d4] bg-white' : 'border-[#e8e8e8] bg-[#fafafa]'
              }`}
            >
              <span className={`flex h-9 w-8 shrink-0 items-center justify-center rounded border bg-white ${
                esImagen(archivo.tipo) ? 'border-[#c3d2e6] text-[#5b7fb5]' : 'border-[#e6c4c1] text-[#c4483f]'
              }`}>
                {esImagen(archivo.tipo) ? <ImageIcon size={15} /> : <FileText size={15} />}
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-semibold text-[#1D1E20]">{archivo.nombre}</span>
                <span className="text-[11px] tabular-nums text-[#999]">
                  {new Date(archivo.subido).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  {' · '}{pesoLegible(archivo.bytes)}
                </span>
              </span>

              {carpeta === 'cotizaciones' && i === 0 && lista.length > 1 && (
                <span className="shrink-0 rounded-full bg-[#e4f7f2] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#2b8b78]">
                  Vigente
                </span>
              )}

              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={() => abrir(archivo)}
                  disabled={abriendo === archivo.path}
                  aria-label={`Ver ${archivo.nombre}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#999] transition hover:bg-white hover:text-[#1D1E20] disabled:opacity-40"
                >
                  <Eye size={15} />
                </button>
                {puedeEditar && (
                  <button
                    onClick={() => quitar(archivo)}
                    aria-label={`Quitar ${archivo.nombre}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[#999] transition hover:bg-white hover:text-[#cc3333]"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {subiendo && (
        <div className="flex items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white px-3 py-2">
          <span className="h-9 w-8 shrink-0 animate-pulse rounded bg-[#f0f0f0]" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate text-[13px] font-semibold text-[#1D1E20]">{subiendo}</span>
            <span className="block h-1 overflow-hidden rounded-full bg-[#f0f0f0]">
              <span className="block h-full w-2/3 animate-pulse rounded-full bg-[#48C9B0]" />
            </span>
          </span>
        </div>
      )}

      {puedeEditar && lista.length === 0 && !subiendo && (
        <button
          onClick={() => entrada.current?.click()}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-[#e0e0e0] bg-[#fcfcfc] px-4 py-5 text-center transition hover:border-[#48C9B0]"
        >
          <Upload size={20} className="text-[#bbb]" />
          <span className="text-[13px] font-bold text-[#1D1E20]">{textoVacio}</span>
          <span className="max-w-[38ch] text-[11.5px] text-[#999]">
            PDF o foto, hasta 10 MB. Se guarda privado: solo lo abre quien tiene acceso a esta boda.
          </span>
        </button>
      )}

      {puedeEditar && lista.length > 0 && !subiendo && (
        <button
          onClick={() => entrada.current?.click()}
          className="flex items-center gap-1 self-start text-[11px] font-bold text-[#48C9B0] transition hover:text-[#3aa896]"
        >
          <Plus size={11} /> Agregar otro
        </button>
      )}

      {!puedeEditar && lista.length === 0 && (
        <p className="text-xs text-[#999]">Todavía no hay archivos aquí.</p>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2 text-xs text-[#cc3333]">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {viendo && (
        <VisorDeArchivo archivo={viendo.archivo} url={viendo.url} onCerrar={() => setViendo(null)} />
      )}
    </div>
  )
}
