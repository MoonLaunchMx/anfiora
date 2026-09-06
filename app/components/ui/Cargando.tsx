'use client'

/**
 * La espera del sistema. UNICO componente de carga de Anfiora: si una pantalla
 * necesita esperar, usa este y no dibuja el suyo.
 *
 * El isotipo vive en un hueco de tamano fijo con la clase `anf-respira`. Para
 * meter la animacion propia del logo mas adelante se cambia SOLO el contenido
 * de ese hueco y la regla en globals.css — ninguna pantalla que lo use se entera.
 */
export function Cargando({
  mensaje = 'Cargando',
  detalle,
  pantallaCompleta = false,
}: {
  mensaje?: string
  detalle?: string
  pantallaCompleta?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 bg-white px-6 text-center ${
        pantallaCompleta ? 'h-[100dvh]' : 'flex-1'
      }`}
    >
      {/* Hueco reservado para la animacion del logo */}
      <div className="grid h-14 w-14 place-items-center">
        <img
          src="/images/isotipo.svg"
          alt="Anfiora"
          className="anf-respira h-14 w-14 object-contain"
        />
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        <span className="anf-pulso h-1.5 w-1.5 rounded-full bg-[#48C9B0]" />
        <span className="anf-pulso h-1.5 w-1.5 rounded-full bg-[#48C9B0] [animation-delay:160ms]" />
        <span className="anf-pulso h-1.5 w-1.5 rounded-full bg-[#48C9B0] [animation-delay:320ms]" />
      </div>

      <div className="flex flex-col gap-1" role="status" aria-live="polite">
        <p className="text-[13px] font-medium text-[#666]">{mensaje}</p>
        {detalle && <p className="text-[11px] text-[#bbb]">{detalle}</p>}
      </div>
    </div>
  )
}
