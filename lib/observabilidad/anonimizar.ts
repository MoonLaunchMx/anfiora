// Las direcciones de las pantallas publicas llevan el token en la URL:
// /playlist/<token>, /mesa/<token>, /opinion/<token>, /invite/<token> y
// /invitacion/<slug>/<token>. Ese token ES la llave de entrada; si viaja tal
// cual a Sentry o a PostHog, la llave queda guardada en un tercero y en
// cualquiera que tenga acceso a ese panel.
//
// Aqui se cambia por [token] antes de mandar nada. La ruta se sigue viendo
// ("alguien rompio en /playlist/[token]"), que es lo unico que se necesita
// para depurar o para contar visitas.

const CON_TOKEN_AL_FINAL = ['playlist', 'mesa', 'opinion', 'invite']

export function rutaSinTokens(ruta: string): string {
  const partes = ruta.split('/')

  for (let i = 0; i < partes.length; i++) {
    const anterior = partes[i - 1]
    if (!partes[i]) continue

    if (anterior && CON_TOKEN_AL_FINAL.includes(anterior)) {
      partes[i] = '[token]'
      continue
    }
    // /invitacion/<slug>/<token>: el slug es el nombre de la boda y se queda,
    // el token es el tercer segmento.
    if (partes[i - 2] === 'invitacion' && anterior && anterior !== 'preview') {
      partes[i] = '[token]'
    }
  }

  return partes.join('/')
}

// Tambien se limpia lo que venga en la query (?token=..., ?key=...), que es
// por donde se cuelan los links que se mandan por correo.
const CLAVES_SECRETAS = /^(token|key|secret|access_token|apikey|api_key)$/i

export function urlSinSecretos(url: string): string {
  if (!url) return url

  const corte = url.search(/[?#]/)
  const base = corte === -1 ? url : url.slice(0, corte)
  const resto = corte === -1 ? '' : url.slice(corte)

  let limpia: string
  try {
    const u = new URL(base)
    u.pathname = rutaSinTokens(u.pathname)
    limpia = u.toString()
  } catch {
    limpia = rutaSinTokens(base)
  }

  if (!resto) return limpia

  const separador = resto[0]
  const params = new URLSearchParams(resto.slice(1))
  let cambio = false
  for (const clave of [...params.keys()]) {
    if (CLAVES_SECRETAS.test(clave)) {
      params.set(clave, '[token]')
      cambio = true
    }
  }
  const cola = cambio ? params.toString() : resto.slice(1)
  return cola ? `${limpia}${separador}${cola}` : limpia
}
