import { EJES_PROPUESTA, EJES_DESEMPENO } from './ejes'
import type { Eje } from './ejes'
import type { SupplierReview } from '@/lib/types'

// Lo minimo que hace falta para promediar: cualquier fila con estas columnas
// sirve, sin importar cuantas otras traiga la consulta o cuantas le falten.
// Una SupplierReview completa (lo que usa la ficha) cae aqui sola; una fila
// angosta pedida solo para una lista (lo que usan Fichero y Kanban) tambien.
export type ReviewParaScore = Pick<SupplierReview, 'review_type' | 'autor' | Eje>

function promedio(reviews: ReviewParaScore[], ejes: Eje[]): number | null {
  const valores: number[] = []
  for (const review of reviews) {
    for (const eje of ejes) {
      const valor = review[eje]
      if (typeof valor === 'number') valores.push(valor)
    }
  }
  if (valores.length === 0) return null
  const suma = valores.reduce((total, valor) => total + valor, 0)
  return Math.round((suma / valores.length) * 10) / 10
}

export function calcularScores(reviews: ReviewParaScore[]) {
  return {
    propuesta: promedio(
      reviews.filter(r => r.review_type === 'contratacion' || r.review_type === 'descarte'),
      EJES_PROPUESTA,
    ),
    desempeno: promedio(
      reviews.filter(r => r.review_type === 'post_evento' && r.autor === 'planner'),
      EJES_DESEMPENO,
    ),
    clientes: promedio(
      reviews.filter(r => r.review_type === 'post_evento' && r.autor === 'cliente'),
      EJES_DESEMPENO,
    ),
  }
}
