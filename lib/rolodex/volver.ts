// A donde regresa el boton Volver de la cascara del Rolodex.
//
// El expediente casi siempre se abre desde la ficha de un proveedor dentro de
// un evento, y esa ficha manda su ruta en `?desde=`; Volver tiene que
// devolverte exactamente ahi. Sin `desde`, el escalon de arriba del expediente
// es el directorio. Y estando ya en el directorio, arriba solo queda el
// dashboard.
//
// Solo se aceptan rutas internas: un `desde` con dominio ajeno se ignora.
export function destinoDeVuelta(search: string, pathname: string): string {
  if (pathname === '/rolodex' || pathname === '/rolodex/') return '/dashboard'
  const desde = new URLSearchParams(search).get('desde')
  if (desde && desde.startsWith('/') && !desde.startsWith('//')) return desde
  return '/rolodex'
}
