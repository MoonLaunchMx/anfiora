import type { SupplierReview } from '@/lib/types'

// Lo minimo que hace falta para decidir un veto. Se pide un Pick y no la fila
// entera para que la consulta pueda traer cuatro columnas en vez de treinta.
export type ReviewParaVeto = Pick<
  SupplierReview,
  'supplier_id' | 'review_type' | 'autor' | 'recontratacion'
>

// Un proveedor queda vetado cuando el planner contesto 1 en "lo volverias a
// contratar" despues del evento. No es un score bajo, es una exclusion: deja de
// ofrecerse como sugerencia.
//
// Se DERIVA de la review en vez de guardarse en una columna aparte, y eso es lo
// que hace que revertirlo a mano sea posible sin pantalla nueva: se corrige esa
// review y el veto se cae solo. Una bandera aparte se desincroniza el dia que
// alguien edita la calificacion.
//
// La voz de los novios NO veta (spec 3.4): el veto es una facultad del planner.
// Un novio molesto por algo ajeno al proveedor borraria a alguien bueno del
// catalogo de todo el despacho.
export function idsVetados(reviews: ReviewParaVeto[]): Set<string> {
  const vetados = new Set<string>()
  for (const review of reviews) {
    if (review.review_type !== 'post_evento') continue
    if (review.autor !== 'planner') continue
    if (review.recontratacion !== 1) continue
    vetados.add(review.supplier_id)
  }
  return vetados
}
