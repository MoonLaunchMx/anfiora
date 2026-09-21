// Los encabezados de seguridad de todas las respuestas.
//
// Viven aqui, y no solo en next.config.ts, porque en Vercel los de la config
// no llegan al navegador: proxy.ts (el middleware de Next 16) toca TODAS las
// rutas y la respuesta que arma sale sin ellos. Se comprobo el 19-sep en
// produccion: `next start` local los mandaba y el dominio no.
//
// El que de verdad importa es Referrer-Policy. Las pantallas publicas llevan
// el token en la direccion, y sin esto, cuando el invitado abre un link de
// Spotify o de una tienda, su navegador le entrega a ese sitio la direccion
// completa, token incluido.
export const ENCABEZADOS_SEGURIDAD: Record<string, string> = {
  // strict-origin-when-cross-origin y no same-origin: hacia afuera manda solo
  // "https://www.anfiora.com", nunca la ruta, asi que el token no sale. Mandar
  // el dominio (y no nada) es lo que esperan los CDN de las tiendas cuando la
  // mesa de regalos dibuja la foto del producto.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  // microphone=(self) a proposito: la invitacion graba un mensaje de voz
  // (getUserMedia en SectionForm). Camara, ubicacion y pagos no los usa nadie.
  // display-capture no se toca: el widget de feedback graba la pantalla.
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
}

// Para next.config.ts, que los pide como lista de { key, value }.
export const ENCABEZADOS_SEGURIDAD_LISTA = Object.entries(ENCABEZADOS_SEGURIDAD)
  .map(([key, value]) => ({ key, value }))

export function ponerEncabezados(headers: Headers): Headers {
  for (const [clave, valor] of Object.entries(ENCABEZADOS_SEGURIDAD)) {
    headers.set(clave, valor)
  }
  return headers
}
