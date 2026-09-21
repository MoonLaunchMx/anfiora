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
// estar de acuerdo, y NO resuelven lo mismo:
// - `rpcPlan`: lo que devolvio el RPC plan_del_evento (SECURITY DEFINER,
//   responde igual para el dueno que para un colaborador) — el plan del
//   WORKSPACE DEL EVENTO. Su funcion en Supabase hace
//   `COALESCE(plan_real, 'free')`: si el evento no tiene workspace detras,
//   cae a 'free' por default. Un 'free' que venga de ahi es por eso
//   AMBIGUO — no se sabe si es el plan real o el default.
// - Una lectura directa de `workspaces` por `primary_owner_id`: el plan del
//   workspace PERSONAL de quien CREO el evento — no siempre es el mismo
//   workspace. El proyecto permite crear un evento dentro de un workspace
//   que solo se administra (no se es dueno), asi que un evento de una
//   cuenta Agency puede haber sido creado por alguien cuyo workspace propio
//   es gratuito. Por eso esta fuente NUNCA debe ganarle a un plan de paga
//   confirmado del evento — solo sirve para desambiguar el 'free' (RPC
//   ambiguo o caido) y para traer el sello.
// Regla: un plan de PAGA que venga del RPC manda siempre (nunca es el
// default). Si el RPC no trajo eso (fallo, o trajo 'free' — ambiguo), se usa
// la lectura directa cuando SI encontro fila. Si ninguna fuente confirma
// nada, no se pudo verificar el plan real — y el candado de verdad vive en
// la base, asi que la interfaz nunca debe apretar un tope que no pudo
// comprobar: sin tope.
export function resolverLimiteInvitados(
  rpcPlan: string | null,
  wsEncontrado: boolean,
  wsPlan: string | null,
  wsSello: unknown,
): number | null {
  const rpcPlanNormalizado = normalizarPlan(rpcPlan)
  if (rpcPlanNormalizado !== 'free') return limiteInvitados(rpcPlanNormalizado, null)
  if (wsEncontrado) return limiteInvitados(wsPlan, wsSello)
  return null
}
