'use client'

interface Props {
  nombre?: string
  anclas: string[]
  valor: number | 'na' | null
  onChange: (valor: number | 'na' | null) => void
  descripcion?: string
  noAplico?: boolean
  etiquetaNoAplico?: string
  deshabilitado?: boolean
}

export default function EscalaCinco({
  nombre, anclas, valor, onChange,
  descripcion, noAplico = false,
  etiquetaNoAplico = 'No aplicó',
  deshabilitado = false,
}: Props) {
  const activo = (n: number) => valor === n
  // La frase se deriva del boton: en el contexto de los novios ese boton dice
  // "No hubo imprevistos", y una etiqueta fija diria lo contrario debajo.
  const etiqueta =
    valor === 'na' ? `${etiquetaNoAplico}, no cuenta para el promedio`
    : typeof valor === 'number' ? anclas[valor - 1]
    : ''

  return (
    <div className={deshabilitado ? 'opacity-40' : ''}>
      {nombre && <div className="text-sm font-medium text-[var(--text)]">{nombre}</div>}
      {descripcion && (
        <div className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">{descripcion}</div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 gap-1.5 sm:flex-none">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              disabled={deshabilitado}
              aria-pressed={activo(n)}
              onClick={() => onChange(activo(n) ? null : n)}
              className={`h-9 flex-1 rounded-lg border text-sm font-semibold tabular-nums transition-colors sm:h-[30px] sm:w-[30px] sm:flex-none ${
                activo(n)
                  ? 'border-[var(--text)] bg-[var(--text)] text-white'
                  : 'border-[var(--border)] bg-white text-[var(--text-sec)] hover:bg-[var(--hover)]'
              } disabled:cursor-not-allowed`}
            >
              {n}
            </button>
          ))}
        </div>

        {noAplico && (
          <button
            type="button"
            disabled={deshabilitado}
            aria-pressed={valor === 'na'}
            onClick={() => onChange(valor === 'na' ? null : 'na')}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              valor === 'na'
                ? 'border-[var(--text-muted)] bg-[var(--surface-alt)] font-semibold text-[var(--text)]'
                : 'border-dashed border-[var(--border)] bg-white text-[var(--text-sec)] hover:bg-[var(--hover)]'
            }`}
          >
            {etiquetaNoAplico}
          </button>
        )}
      </div>

      <div className="mt-1.5 min-h-[18px] text-xs leading-snug text-[var(--text-sec)]">
        {etiqueta || <span className="text-[var(--text-muted)]">Sin calificar</span>}
      </div>
    </div>
  )
}
