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
  'Referrer-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
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
