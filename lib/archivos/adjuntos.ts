import type { ArchivoAdjunto } from '@/lib/types'

export const MAX_BYTES = 10 * 1024 * 1024
export const TOPE_COTIZACIONES = 10
export const TOPE_COMPROBANTES = 5

export const CARPETAS = ['cotizaciones', 'comprobantes'] as const
export type Carpeta = typeof CARPETAS[number]

export const TIPOS_PERMITIDOS = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif',
] as const

const POR_EXTENSION: Record<string, string> = {
  pdf:  'application/pdf',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
}

export function visibles(lista: ArchivoAdjunto[] | null | undefined): ArchivoAdjunto[] {
  return (lista ?? []).filter(a => !a.borrado)
}

export function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf('.')
  if (punto < 0 || punto === nombre.length - 1) return 'bin'
  return nombre.slice(punto + 1).toLowerCase()
}

// El navegador entrega file.type vacio para un HEIC mas seguido de lo que
// parece, y el bucket rechaza por content-type: hay que deducirlo o no sube.
export function tipoDeArchivo(nombre: string, tipoDelNavegador: string): string {
  if (tipoDelNavegador) return tipoDelNavegador
  return POR_EXTENSION[extensionDe(nombre)] ?? ''
}

export function esImagen(tipo: string): boolean {
  return tipo.startsWith('image/')
}

export function pesoLegible(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// El nombre del archivo es un uuid y nunca el que teclea la persona: sin
// traversal, sin acentos rotos y sin datos del cliente escritos en la ruta.
// El segundo segmento es el que la policy del bucket traduce a modulo.
export function rutaDe(
  eventId: string, carpeta: Carpeta, dueno: string, nombre: string, uuid: string,
): string {
  return `${eventId}/${carpeta}/${dueno}/${uuid}.${extensionDe(nombre)}`
}

export function validarArchivo(
  nombre: string, tipoDelNavegador: string, bytes: number, yaHay: number, tope: number,
): string | null {
  if (yaHay >= tope) {
    return `Ya tienes ${tope} archivos aquí. Quita alguno antes de subir otro.`
  }

  const tipo = tipoDeArchivo(nombre, tipoDelNavegador)
  if (!TIPOS_PERMITIDOS.includes(tipo as typeof TIPOS_PERMITIDOS[number])) {
    return `${nombre} no se puede guardar. Solo entran PDF y fotos (JPG, PNG o HEIC).`
  }

  if (bytes > MAX_BYTES) {
    return `${nombre} pesa ${pesoLegible(bytes)}. El tope son 10 MB: vuelve a escanearlo en calidad media o mándalo partido en dos.`
  }

  return null
}
