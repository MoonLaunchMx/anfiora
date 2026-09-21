// Datos de pais/ciudad para el formulario de solicitud de acceso (MuroModal).
// Archivo de datos puro, sin tabla en Supabase: Mexico es el mercado real de
// Anfiora hoy, asi que trae su lista de ciudades; el resto del mundo solo
// trae el pais y la ciudad se captura como texto libre.

export interface Pais {
  nombre: string
  codigo: string
}

// Mexico primero porque es el default del selector.
export const PAISES: Pais[] = [
  { nombre: 'México', codigo: 'MX' },
  { nombre: 'Estados Unidos', codigo: 'US' },
  { nombre: 'España', codigo: 'ES' },
  { nombre: 'Colombia', codigo: 'CO' },
  { nombre: 'Argentina', codigo: 'AR' },
  { nombre: 'Chile', codigo: 'CL' },
  { nombre: 'Perú', codigo: 'PE' },
  { nombre: 'Ecuador', codigo: 'EC' },
  { nombre: 'Guatemala', codigo: 'GT' },
  { nombre: 'Costa Rica', codigo: 'CR' },
  { nombre: 'Panamá', codigo: 'PA' },
  { nombre: 'República Dominicana', codigo: 'DO' },
  { nombre: 'Puerto Rico', codigo: 'PR' },
  { nombre: 'Honduras', codigo: 'HN' },
  { nombre: 'El Salvador', codigo: 'SV' },
  { nombre: 'Nicaragua', codigo: 'NI' },
  { nombre: 'Venezuela', codigo: 'VE' },
  { nombre: 'Bolivia', codigo: 'BO' },
  { nombre: 'Paraguay', codigo: 'PY' },
  { nombre: 'Uruguay', codigo: 'UY' },
  { nombre: 'Brasil', codigo: 'BR' },
  { nombre: 'Canadá', codigo: 'CA' },
  { nombre: 'Otro', codigo: 'OTRO' },
]

export const CODIGO_PAIS_DEFAULT = 'MX'

export interface CiudadMexico {
  nombre: string
  estado: string
}

// Las 32 capitales de estado mas las ciudades grandes donde de verdad hay
// bodas (lista de Diego), sin duplicar. Orden alfabetico por nombre.
export const CIUDADES_MEXICO: CiudadMexico[] = [
  { nombre: 'Acapulco', estado: 'Guerrero' },
  { nombre: 'Aguascalientes', estado: 'Aguascalientes' },
  { nombre: 'Campeche', estado: 'Campeche' },
  { nombre: 'Cancún', estado: 'Quintana Roo' },
  { nombre: 'Chetumal', estado: 'Quintana Roo' },
  { nombre: 'Chihuahua', estado: 'Chihuahua' },
  { nombre: 'Chilpancingo', estado: 'Guerrero' },
  { nombre: 'Ciudad de México', estado: 'Ciudad de México' },
  { nombre: 'Ciudad Victoria', estado: 'Tamaulipas' },
  { nombre: 'Colima', estado: 'Colima' },
  { nombre: 'Cuernavaca', estado: 'Morelos' },
  { nombre: 'Culiacán', estado: 'Sinaloa' },
  { nombre: 'Durango', estado: 'Durango' },
  { nombre: 'Ensenada', estado: 'Baja California' },
  { nombre: 'Guadalajara', estado: 'Jalisco' },
  { nombre: 'Guanajuato', estado: 'Guanajuato' },
  { nombre: 'Hermosillo', estado: 'Sonora' },
  { nombre: 'Ixtapa', estado: 'Guerrero' },
  { nombre: 'La Paz', estado: 'Baja California Sur' },
  { nombre: 'León', estado: 'Guanajuato' },
  { nombre: 'Los Cabos', estado: 'Baja California Sur' },
  { nombre: 'Mazatlán', estado: 'Sinaloa' },
  { nombre: 'Mérida', estado: 'Yucatán' },
  { nombre: 'Mexicali', estado: 'Baja California' },
  { nombre: 'Monterrey', estado: 'Nuevo León' },
  { nombre: 'Morelia', estado: 'Michoacán' },
  { nombre: 'Oaxaca de Juárez', estado: 'Oaxaca' },
  { nombre: 'Pachuca', estado: 'Hidalgo' },
  { nombre: 'Playa del Carmen', estado: 'Quintana Roo' },
  { nombre: 'Puebla', estado: 'Puebla' },
  { nombre: 'Puerto Vallarta', estado: 'Jalisco' },
  { nombre: 'Querétaro', estado: 'Querétaro' },
  { nombre: 'Riviera Maya', estado: 'Quintana Roo' },
  { nombre: 'Saltillo', estado: 'Coahuila' },
  { nombre: 'San Luis Potosí', estado: 'San Luis Potosí' },
  { nombre: 'San Miguel de Allende', estado: 'Guanajuato' },
  { nombre: 'Tepic', estado: 'Nayarit' },
  { nombre: 'Tequisquiapan', estado: 'Querétaro' },
  { nombre: 'Tijuana', estado: 'Baja California' },
  { nombre: 'Tlaxcala', estado: 'Tlaxcala' },
  { nombre: 'Toluca', estado: 'Estado de México' },
  { nombre: 'Torreón', estado: 'Coahuila' },
  { nombre: 'Tulum', estado: 'Quintana Roo' },
  { nombre: 'Tuxtla Gutiérrez', estado: 'Chiapas' },
  { nombre: 'Valle de Bravo', estado: 'Estado de México' },
  { nombre: 'Veracruz', estado: 'Veracruz' },
  { nombre: 'Villahermosa', estado: 'Tabasco' },
  { nombre: 'Xalapa', estado: 'Veracruz' },
  { nombre: 'Zacatecas', estado: 'Zacatecas' },
]

export function nombrePais(codigo: string): string {
  return PAISES.find(p => p.codigo === codigo)?.nombre ?? codigo
}
