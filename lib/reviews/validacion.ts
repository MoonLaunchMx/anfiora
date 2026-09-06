import { EJES_PROPUESTA, EJES_DESEMPENO } from './ejes'
import type { Eje } from './ejes'
import {
  MAX_RAZONES_SELECCION, MAX_COMENTARIOS,
} from '@/lib/types'
import type {
  ReviewType, MotivoDescarte, RazonSeleccion,
} from '@/lib/types'

export type BorradorReview = {
  review_type: ReviewType
  // null, no []: la spec (5.3) pide null cuando la pregunta no existe en ese
  // tipo de review. Un arreglo vacio dice "contesto y no eligio nada".
  razones_seleccion: RazonSeleccion[] | null
  motivo_descarte: MotivoDescarte | null
  recontratacion: number | null
  cobros_extra: boolean | null
  comentarios: string | null
} & Record<Eje, number | null>

const llenos = (b: BorradorReview, ejes: Eje[]) =>
  ejes.filter(eje => b[eje] !== null && b[eje] !== undefined).length

export function validarReview(b: BorradorReview): string[] {
  const problemas: string[] = []

  if (b.comentarios && b.comentarios.length > MAX_COMENTARIOS) {
    problemas.push(`Los comentarios no pueden pasar de ${MAX_COMENTARIOS} caracteres.`)
  }

  if (b.review_type === 'contratacion') {
    if (llenos(b, EJES_PROPUESTA) < EJES_PROPUESTA.length) {
      problemas.push('Califica la propuesta en los tres ejes.')
    }
    if ((b.razones_seleccion?.length ?? 0) === 0) {
      problemas.push('Dinos por qué elegimos a este proveedor.')
    }
    if ((b.razones_seleccion?.length ?? 0) > MAX_RAZONES_SELECCION) {
      problemas.push('Puedes elegir máximo dos razones.')
    }
  }

  if (b.review_type === 'descarte') {
    if (!b.motivo_descarte) {
      problemas.push('Dinos por qué lo descartamos.')
    }
    const calificados = llenos(b, EJES_PROPUESTA)
    if (calificados > 0 && calificados < EJES_PROPUESTA.length) {
      problemas.push('Califica los tres ejes o ninguno, no a medias.')
    }
  }

  if (b.review_type === 'post_evento') {
    const obligatorios = EJES_DESEMPENO.filter(eje => eje !== 'manejo_imprevistos')
    if (llenos(b, obligatorios) < obligatorios.length) {
      problemas.push('Califica el desempeño en todos los ejes.')
    }
    if (b.recontratacion === null) {
      problemas.push('Contesta si lo volverías a contratar.')
    }
    if (b.cobros_extra === null) {
      problemas.push('Contesta si hubo cobros extra.')
    }
  }

  return problemas
}
