// La puerta de aceptacion de terminos vive en el layout raiz, o sea que corre
// en TODAS las rutas. Antes solo se excluian las tres paginas legales, asi que
// un planner con sesion guardada abria la landing, una invitacion o la mesa de
// regalos y se comia un modal bloqueante en una pagina publica.
//
// Va por lista blanca a proposito: una ruta publica nueva no vuelve a caer en
// la trampa por olvido.
const RUTAS_CON_CUENTA = [
  '/dashboard',
  '/events',
  '/perfil',
  '/configuracion',
  '/ajustes',
  '/admin',
  '/mensajes',
  '/rolodex',
]

export function puertaAplica(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return RUTAS_CON_CUENTA.some(r => pathname === r || pathname.startsWith(r + '/'))
}
