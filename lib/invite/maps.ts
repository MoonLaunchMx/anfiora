// Devuelve la URL para abrir Google Maps: usa el enlace explicito si el usuario
// lo pego; si no, construye una busqueda a partir de la direccion del evento.
// Si no hay ni enlace ni direccion, devuelve null (no se muestra el boton).
export function buildMapsUrl(explicitUrl: string, address: string | null | undefined): string | null {
  const link = explicitUrl.trim()
  if (link) return link
  const query = (address ?? '').trim()
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
