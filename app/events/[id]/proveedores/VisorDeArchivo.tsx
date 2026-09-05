'use client'

import { SquareArrowOutUpRight } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import type { ArchivoAdjunto } from '@/lib/types'
import { esImagen, pesoLegible } from '@/lib/archivos/adjuntos'

type Props = {
  archivo: ArchivoAdjunto
  url: string
  onCerrar: () => void
}

export default function VisorDeArchivo({ archivo, url, onCerrar }: Props) {
  const imagen = esImagen(archivo.tipo)

  const cuando = new Date(archivo.subido).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <Modal open onClose={onCerrar} size="2xl">
      <Modal.Header title={archivo.nombre} subtitle={`${cuando} · ${pesoLegible(archivo.bytes)}`} />

      <Modal.Body className="bg-[#f2f2f2] px-0 py-0">
        {imagen ? (
          <div className="flex min-h-[50dvh] items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={archivo.nombre}
              className="max-h-[70dvh] w-auto max-w-full rounded-lg object-contain shadow-sm"
            />
          </div>
        ) : (
          <iframe
            src={url}
            title={archivo.nombre}
            className="h-[70dvh] w-full border-0 bg-white"
          />
        )}
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-4 py-2 text-sm font-medium text-[#666] transition hover:bg-[#f5f5f5]"
        >
          <SquareArrowOutUpRight size={14} />
          Abrir aparte
        </button>
        <button
          onClick={onCerrar}
          className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3aa896]"
        >
          Cerrar
        </button>
      </Modal.Footer>
    </Modal>
  )
}
