import { toE164 } from '@/lib/phone'

// Una ficha del catalogo con lo poco que el alta necesita saber de ella: como
// se llama, como se le contacta y que tanto la has usado. La pagina la arma
// desde Supabase; aqui adentro no se sabe nada de Supabase ni de React.
export type EntradaDelRolodex = {
  id: string
  nombre: string
  categoria: string | null
  categoriaId: string | null
  pais: string | null
  estado: string | null
  ciudad: string | null
  telefono: string | null
  correo: string | null
  etiquetas: string[]
  veces: number
  ultima: string | null
  enEstaBoda: boolean
}

export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function campos(e: EntradaDelRolodex): string[] {
  return [e.nombre, e.categoria ?? '', e.ciudad ?? ''].map(normalizar)
}

// Busca por nombre, categoria o ciudad. Los que ya estan en esta boda SI
// aparecen: si el planner los busca y no salen va a creer que no los tiene y
// va a crear un duplicado, que es justo lo que esta pantalla existe para evitar.
export function buscar(entradas: EntradaDelRolodex[], consulta: string, tope = 5): EntradaDelRolodex[] {
  const q = normalizar(consulta)
  if (!q) return []

  return entradas
    .filter(e => campos(e).some(c => c.includes(q)))
    .sort((a, b) => {
      const arranca = (e: EntradaDelRolodex) => (normalizar(e.nombre).startsWith(q) ? 0 : 1)
      return arranca(a) - arranca(b)
        || b.veces - a.veces
        || a.nombre.localeCompare(b.nombre, 'es')
    })
    .slice(0, tope)
}

// El estado vacio del buscador. Aqui si se excluyen los que ya estan en la
// boda: es un atajo para agregar, y ofrecer uno que no se puede agregar es
// ofrecer un callejon.
export function masUsados(entradas: EntradaDelRolodex[], tope = 4): EntradaDelRolodex[] {
  return entradas
    .filter(e => !e.enEstaBoda && e.veces > 0)
    .sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, tope)
}

// Aviso SUAVE. Dos floristas de verdad pueden llamarse parecido, asi que esto
// informa y no bloquea. Se exige que el nombre corto tenga al menos 4 letras
// para que "DJ" no marque como parecido a todo el catalogo.
const MINIMO_PARA_PARECERSE = 4

export function nombresParecidos(
  entradas: EntradaDelRolodex[],
  nombre: string,
  tope = 3,
): EntradaDelRolodex[] {
  const n = normalizar(nombre)
  if (!n) return []

  return entradas
    .filter(e => {
      const otro = normalizar(e.nombre)
      if (otro === n) return true
      const corto = otro.length < n.length ? otro : n
      if (corto.length < MINIMO_PARA_PARECERSE) return false
      return otro.includes(n) || n.includes(otro)
    })
    .sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, tope)
}

export type ContactoRepetido = {
  entrada: EntradaDelRolodex
  campo: 'telefono' | 'correo'
}

// Aviso FUERTE. Un nombre parecido es coincidencia; un telefono repetido es la
// misma persona. Se compara normalizado a E.164, para que "442 118 4420" y
// "+524421184420" sean el mismo numero. El telefono manda sobre el correo
// porque es el contacto que el planner de verdad usa.
export function contactoRepetido(
  entradas: EntradaDelRolodex[],
  contacto: { telefono?: string | null; correo?: string | null },
): ContactoRepetido | null {
  const tel = contacto.telefono ? toE164(contacto.telefono) : null
  if (tel) {
    const hit = entradas.find(e => e.telefono && toE164(e.telefono) === tel)
    if (hit) return { entrada: hit, campo: 'telefono' }
  }

  const correo = contacto.correo?.trim().toLowerCase() || null
  if (correo) {
    const hit = entradas.find(e => e.correo?.trim().toLowerCase() === correo)
    if (hit) return { entrada: hit, campo: 'correo' }
  }

  return null
}
