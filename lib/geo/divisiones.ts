import { COUNTRIES, sinAcentos, type CountryCode } from '@/lib/phone'

export const PAIS_POR_DEFECTO: CountryCode = 'MX'

// Los paises salen de la misma lista que ya usa el telefono: una sola verdad
// sobre que paises entiende Anfiora.
export const PAISES = COUNTRIES

// Bandera derivada del ISO con los indicadores regionales de Unicode, para no
// mantener 25 emojis a mano ni volver a tocarlos al agregar un pais.
export function bandera(iso: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso)) return ''
  return String.fromCodePoint(
    ...iso.toUpperCase().split('').map(c => 0x1f1e6 + c.charCodeAt(0) - 65),
  )
}

export function nombrePais(iso: string | null): string {
  if (!iso) return ''
  return PAISES.find(p => p.iso === iso)?.name ?? iso
}

// Las divisiones de primer nivel. Empezamos por Mexico y se suma un pais
// cuando un planner real lo pida: agregar uno es agregar una llave aqui, y el
// control de la pantalla no cambia.
export const ESTADOS: Record<string, string[]> = {
  MX: [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
    'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango',
    'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco',
    'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
    'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora',
    'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
  ],
}

// Ciudades principales por estado, con la llave 'ISO|Estado'. NO pretende ser
// el padron completo de municipios: es una ayuda para que las que se teclean
// seguido queden escritas igual. Cualquier otra se escribe a mano y se guarda.
export const CIUDADES: Record<string, string[]> = {
  'MX|Aguascalientes':       ['Aguascalientes', 'Jesús María', 'Calvillo', 'San José de Gracia'],
  'MX|Baja California':      ['Tijuana', 'Mexicali', 'Ensenada', 'Rosarito', 'Tecate', 'Valle de Guadalupe'],
  'MX|Baja California Sur':  ['La Paz', 'Los Cabos', 'San José del Cabo', 'Cabo San Lucas', 'Todos Santos', 'Loreto'],
  'MX|Campeche':             ['Campeche', 'Ciudad del Carmen', 'Champotón'],
  'MX|Chiapas':              ['Tuxtla Gutiérrez', 'San Cristóbal de las Casas', 'Comitán', 'Palenque', 'Tapachula'],
  'MX|Chihuahua':            ['Chihuahua', 'Ciudad Juárez', 'Delicias', 'Cuauhtémoc', 'Creel', 'Hidalgo del Parral'],
  'MX|Ciudad de México':     ['Ciudad de México'],
  'MX|Coahuila':             ['Saltillo', 'Torreón', 'Monclova', 'Piedras Negras', 'Parras de la Fuente'],
  'MX|Colima':               ['Colima', 'Manzanillo', 'Villa de Álvarez', 'Comala'],
  'MX|Durango':              ['Durango', 'Gómez Palacio', 'Lerdo'],
  'MX|Estado de México':     ['Toluca', 'Metepec', 'Valle de Bravo', 'Naucalpan', 'Huixquilucan', 'Tlalnepantla', 'Atizapán de Zaragoza'],
  'MX|Guanajuato':           ['León', 'San Miguel de Allende', 'Guanajuato', 'Celaya', 'Irapuato', 'Dolores Hidalgo', 'Salamanca'],
  'MX|Guerrero':             ['Acapulco', 'Zihuatanejo', 'Ixtapa', 'Taxco', 'Chilpancingo'],
  'MX|Hidalgo':              ['Pachuca', 'Tulancingo', 'Tula de Allende', 'Huasca de Ocampo', 'Mineral del Monte'],
  'MX|Jalisco':              ['Guadalajara', 'Zapopan', 'Puerto Vallarta', 'Tlaquepaque', 'Tonalá', 'Chapala', 'Ajijic', 'Tequila', 'Mazamitla'],
  'MX|Michoacán':            ['Morelia', 'Uruapan', 'Pátzcuaro', 'Zamora', 'Lázaro Cárdenas'],
  'MX|Morelos':              ['Cuernavaca', 'Jiutepec', 'Tepoztlán', 'Yautepec', 'Tequesquitengo'],
  'MX|Nayarit':              ['Tepic', 'Nuevo Vallarta', 'Bucerías', 'Sayulita', 'San Pancho', 'Punta Mita', 'Compostela'],
  'MX|Nuevo León':           ['Monterrey', 'San Pedro Garza García', 'Guadalupe', 'San Nicolás de los Garza', 'Santiago', 'Apodaca'],
  'MX|Oaxaca':               ['Oaxaca de Juárez', 'Puerto Escondido', 'Huatulco', 'Salina Cruz', 'Santo Domingo Tehuantepec'],
  'MX|Puebla':               ['Puebla', 'Cholula', 'Atlixco', 'Tehuacán', 'Cuetzalan'],
  'MX|Querétaro':            ['Querétaro', 'San Juan del Río', 'Tequisquiapan', 'Corregidora', 'El Marqués', 'Bernal'],
  'MX|Quintana Roo':         ['Cancún', 'Playa del Carmen', 'Tulum', 'Cozumel', 'Puerto Morelos', 'Isla Mujeres', 'Bacalar', 'Chetumal'],
  'MX|San Luis Potosí':      ['San Luis Potosí', 'Soledad de Graciano Sánchez', 'Matehuala', 'Ciudad Valles', 'Xilitla'],
  'MX|Sinaloa':              ['Culiacán', 'Mazatlán', 'Los Mochis', 'Guasave'],
  'MX|Sonora':               ['Hermosillo', 'Ciudad Obregón', 'Nogales', 'Puerto Peñasco', 'Guaymas', 'San Carlos'],
  'MX|Tabasco':              ['Villahermosa', 'Cárdenas', 'Comalcalco'],
  'MX|Tamaulipas':           ['Ciudad Victoria', 'Tampico', 'Reynosa', 'Matamoros', 'Nuevo Laredo'],
  'MX|Tlaxcala':             ['Tlaxcala', 'Apizaco', 'Huamantla'],
  'MX|Veracruz':             ['Veracruz', 'Xalapa', 'Boca del Río', 'Córdoba', 'Orizaba', 'Coatzacoalcos', 'Poza Rica'],
  'MX|Yucatán':              ['Mérida', 'Valladolid', 'Progreso', 'Izamal', 'Tizimín'],
  'MX|Zacatecas':            ['Zacatecas', 'Guadalupe', 'Fresnillo', 'Jerez'],
}

export function tieneEstados(iso: string | null | undefined): boolean {
  return !!iso && Array.isArray(ESTADOS[iso])
}

export function estadosDe(iso: string | null | undefined): string[] {
  return iso ? ESTADOS[iso] ?? [] : []
}

export function ciudadesDe(iso: string | null | undefined, estado: string | null | undefined): string[] {
  if (!iso || !estado) return []
  return CIUDADES[`${iso}|${estado}`] ?? []
}

// Para comparar lugares sin pelearse con acentos, mayusculas ni espacios de
// sobra: 'queretaro' y ' Querétaro ' son el mismo lugar.
export function mismoLugar(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return sinAcentos(a).replace(/\s+/g, ' ').trim() === sinAcentos(b).replace(/\s+/g, ' ').trim()
}

// Si lo tecleado coincide con una division oficial, se guarda la oficial. Asi
// una ficha vieja con 'queretaro' se corrige sola al volver a guardarla, sin
// pedirle nada al planner.
export function normalizarEstado(iso: string | null | undefined, escrito: string): string {
  const limpio = escrito.trim()
  if (!limpio) return ''
  return estadosDe(iso).find(e => mismoLugar(e, limpio)) ?? limpio
}

export function normalizarCiudad(
  iso: string | null | undefined,
  estado: string | null | undefined,
  escrito: string,
  conocidas: string[] = [],
): string {
  const limpio = escrito.trim()
  if (!limpio) return ''
  const catalogo = [...conocidas, ...ciudadesDe(iso, estado)]
  return catalogo.find(c => mismoLugar(c, limpio)) ?? limpio
}
