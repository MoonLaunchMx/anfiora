// Mandar la invitacion por WhatsApp. Puro a proposito: no importa
// lib/supabase, para que se pueda probar con Vitest.
//
// Se usa wa.me SIN numero. Esa forma abre WhatsApp con el mensaje ya escrito y
// deja que el planner escoja el contacto de su propia libreta, asi que no hace
// falta guardarle el telefono a nadie ni pedir un campo nuevo al dar de alta.

export function enlaceWhatsApp(mensaje: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensaje)}`
}

// El enlace va al final y en su propia linea: WhatsApp solo lo convierte en
// vista previa cuando no lleva texto pegado despues.
export function mensajeEquipo(workspace: string, enlace: string): string {
  const donde = workspace.trim()
  return donde
    ? `Te invito a trabajar conmigo en ${donde}. Entra con este enlace:\n${enlace}`
    : `Te invito a trabajar conmigo en Anfiora. Entra con este enlace:\n${enlace}`
}

export function mensajeCliente(evento: string, enlace: string): string {
  const cual = evento.trim()
  return cual
    ? `Te comparto el acceso a ${cual}. Entra con este enlace:\n${enlace}`
    : `Te comparto tu acceso. Entra con este enlace:\n${enlace}`
}
