import { EJES_PROPUESTA, EJES_DESEMPENO } from './ejes'
import type { Eje } from './ejes'
import type { SupplierReview } from '@/lib/types'

function promedio(reviews: SupplierReview[], ejes: Eje[]): number | null {
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

export function calcularScores(reviews: SupplierReview[]) {
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
