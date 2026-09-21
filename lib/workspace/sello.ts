import { PLANES, normalizarPlan } from './planes'

export type Sello = 'fundador' | null

export const LUGARES_FUNDADOR = 25

export function normalizarSello(raw: unknown): Sello {
  if (typeof raw !== 'string') return null
  return raw.trim().toLowerCase() === 'fundador' ? 'fundador' : null
}

export function hayLugarDeFundador(ocupados: number): boolean {
  return ocupados < LUGARES_FUNDADOR
}

export function limiteEventos(plan: string | null | undefined, sello: unknown): number | null {
  if (normalizarSello(sello)) return null
  // Mismo numero que en supabase/migrations/
  return PLANES[normalizarPlan(plan)].eventosActivos
}

export function limiteInvitados(plan: string | null | undefined, sello: unknown): number | null {
  if (normalizarSello(sello)) return null
  // Mismo numero que en supabase/migrations/
  return PLANES[normalizarPlan(plan)].invitadosPorEvento
}

// El tope de invitados de un evento se arma con dos fuentes que pueden no
// estar de acuerdo:
// - `rpcPlan`: lo que devolvio el RPC plan_del_evento (SECURITY DEFINER,
//   responde igual para el dueno que para un colaborador). Su funcion en
//   Supabase hace `COALESCE(plan_real, 'free')`: si el evento no tiene
//   workspace detras, cae a 'free' por default. Un 'free' que venga de ahi
//   es por eso AMBIGUO — no se sabe si es el plan real o el default.
// - Una lectura directa de `workspaces` por el dueno: mas confiable (trae
//   tambien el sello) pero puede no encontrar nada por RLS (un colaborador
//   no siempre puede leer el workspace ajeno) o porque la columna `sello`
//   todavia no existe.
// Regla: la lectura directa manda cuando SI encontro una fila (`wsEncontrado`).
// Si no la encontro, solo se confia en el RPC cuando trajo un plan de PAGA
// (eso nunca es el default). Si ninguna fuente confirma nada, no se pudo
// verificar el plan real — y el candado de verdad vive en la base, asi que
// la interfaz nunca debe apretar un tope que no pudo comprobar: sin tope.
export function resolverLimiteInvitados(
  rpcPlan: string | null,
  wsEncontrado: boolean,
  wsPlan: string | null,
  wsSello: unknown,
): number | null {
  if (wsEncontrado) return limiteInvitados(wsPlan, wsSello)
  if (rpcPlan !== null && rpcPlan !== 'free') return limiteInvitados(rpcPlan, null)
  return null
}
