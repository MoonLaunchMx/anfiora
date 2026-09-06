export const EJES = [
  'precio_valor',
  'calidad',
  'comunicacion',
  'servicio_trato',
  'manejo_imprevistos',
] as const

export type Eje = typeof EJES[number]

export type ContextoAnclas = 'propuesta' | 'desempeno'

export const EJES_PROPUESTA: Eje[] = ['precio_valor', 'calidad', 'comunicacion']
export const EJES_DESEMPENO: Eje[] = [...EJES]

export const NOMBRE_EJE: Record<Eje, string> = {
  precio_valor:       'Precio y valor',
  calidad:            'Calidad',
  comunicacion:       'Comunicación',
  servicio_trato:     'Servicio y trato',
  manejo_imprevistos: 'Manejo de imprevistos',
}

export const DESCRIPCION_EJE_PROPUESTA: Partial<Record<Eje, string>> = {
  precio_valor: 'Qué tan razonable fue lo que cotizó frente a lo que ofrecía',
  calidad:      'Nivel del portafolio y de la propuesta presentada',
  comunicacion: 'Durante la cotización',
}

export const ANCLAS: Record<ContextoAnclas, Partial<Record<Eje, string[]>>> = {
  propuesta: {
    precio_valor: [
      'Fuera de toda proporción',
      'Muy por encima del mercado',
      'En precio de mercado',
      'Caro, pero se justifica',
      'Ofrece más de lo que cobra',
    ],
    calidad: [
      'Portafolio pobre o inconsistente',
      'Cumple lo mínimo, nada memorable',
      'Sólido, sin diferenciador',
      'Trabajo notable, se nota el oficio',
      'Referente en su categoría',
    ],
    comunicacion: [
      'Nunca respondió',
      'Tuve que perseguirlo',
      'Respondía lento o incompleto',
      'Contestaba el mismo día',
      'Proactivo, se adelantaba a mis dudas',
    ],
  },
  desempeno: {
    precio_valor: [
      'Cobró de más y entregó de menos',
      'No valió lo que cobró',
      'Justo lo esperado por el precio',
      'Valió lo que cobró',
      'Entregó más de lo que cobró',
    ],
    calidad: [
      'Muy por debajo de lo prometido',
      'Entregó menos de lo prometido',
      'Entregó lo prometido, sin más',
      'Entregó mejor de lo prometido',
      'Superó lo prometido de forma notoria',
    ],
    comunicacion: [
      'Imposible localizarlo',
      'Tuve que perseguirlo todo el proceso',
      'Respondía, pero yo iniciaba siempre',
      'Accesible y claro todo el proceso',
      'Proactivo, avisaba antes de que preguntara',
    ],
    servicio_trato: [
      'Trató mal al cliente o al equipo',
      'Correcto pero frío',
      'Profesional, sin más',
      'Cálido, el cliente lo notó',
      'El cliente lo mencionó sin que le preguntara',
    ],
    manejo_imprevistos: [
      'Empeoró el problema o lo negó',
      'Se paralizó, lo resolví yo',
      'Resolvió a medias o con ayuda',
      'Resolvió solo, sin alarmar a nadie',
      'Resolvió antes de que nadie lo notara',
    ],
  },
}

export const ANCLAS_RECONTRATACION = [
  'No, rotundamente',
  'Solo si no hay otra opción',
  'Sí, pero solo para cierto tipo de evento',
  'Sí, sin reservas',
  'Definitivamente sí, es mi primera opción',
]

export function anclasDe(contexto: ContextoAnclas, eje: Eje): string[] {
  return ANCLAS[contexto][eje] ?? []
}
