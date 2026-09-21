// Enmascarar un correo ajeno. Puro a proposito: no importa lib/supabase, para
// que se pueda probar con Vitest.
//
// Solo se usa en la pantalla de cuenta equivocada, que es el unico lugar donde
// Anfiora enseña un correo que no es el de quien esta mirando. El link de
// invitacion viaja por WhatsApp y se reenvia, asi que un correo completo a la
// vista se le regala a cualquiera que se encuentre el mensaje.
//
// El DOMINIO se deja entero a proposito: es lo que hace que la persona
// reconozca cual de sus cuentas es, y por si solo no identifica a nadie.

const PUNTOS = '•••'

export function enmascararCorreo(correo: string): string {
  const limpio = (correo ?? '').trim()
  const arroba = limpio.lastIndexOf('@')

  // Sin arroba no es un correo: se enmascara entero antes que enseñarlo.
  if (arroba <= 0 || arroba === limpio.length - 1) {
    return limpio.length > 0 ? PUNTOS : ''
  }

  const usuario = limpio.slice(0, arroba)
  const dominio = limpio.slice(arroba)

  // Con una sola letra no hay nada que revelar en el medio, y enseñar la misma
  // letra dos veces se leeria como si el correo fuera 'aa'.
  if (usuario.length === 1) return `${usuario}${PUNTOS}${dominio}`

  return `${usuario[0]}${PUNTOS}${usuario[usuario.length - 1]}${dominio}`
}
