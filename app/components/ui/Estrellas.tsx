'use client'

import { Star, StarHalf } from 'lucide-react'

type Props = {
  score: number | null
  tamano?: number
  className?: string
}

// Solo para mostrar. La captura de la review sigue siendo los cinco botones
// numerados de EscalaCinco -- esto nunca reemplaza esa pantalla, solo lee
// el promedio ya guardado. Redondea a la media estrella mas cercana para no
// disfrazar un 4.5 de un 5.
export default function Estrellas({ score, tamano = 13, className = '' }: Props) {
  if (score == null) {
    return <span className={`text-xs font-medium text-[#bbb] ${className}`}>Sin calificar</span>
  }

  const redondeado = Math.max(0, Math.min(5, Math.round(score * 2) / 2))
  const llenas = Math.floor(redondeado)
  const media = redondeado - llenas === 0.5

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="flex items-center gap-px" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => {
          if (i < llenas) return <Star key={i} size={tamano} className="fill-[#d4a853] text-[#d4a853]" />
          if (i === llenas && media) return <StarHalf key={i} size={tamano} className="fill-[#d4a853] text-[#d4a853]" />
          return <Star key={i} size={tamano} className="text-[#e0e0e0]" />
        })}
      </span>
      <span className="text-xs font-semibold tabular-nums text-[#1D1E20]">{score.toFixed(1)}</span>
    </span>
  )
}
