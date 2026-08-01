import { createHash, timingSafeEqual } from 'node:crypto'

// Comparacion en tiempo constante. Se digieren ambos lados porque
// timingSafeEqual exige buferes de la misma longitud y lanza si no lo son:
// sin el digest, un secreto de largo distinto tumbaria la ruta en vez de
// devolver 401.
export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false
  const given = (authorizationHeader ?? '').replace('Bearer ', '')
  return timingSafeEqual(
    createHash('sha256').update(given).digest(),
    createHash('sha256').update(secret).digest(),
  )
}
