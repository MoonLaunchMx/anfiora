'use client'

import { CircleAlert } from 'lucide-react'
import { buildUrgencias } from '@/lib/dashboard/urgencias'
import FeedAtencion from '../FeedAtencion'
import CajaShell, { type PropsCaja } from './CajaShell'

const MAX = 3

export default function CajaAtencion({ m, puedeVerDinero, modoPersonalizar, onQuitar }: PropsCaja) {
  // Sin tareas: viven en la caja de pendientes, donde ademas se palomean.
  const urgencias = buildUrgencias([m], { puedeVerDinero, sinTareas: true })

  return (
    <CajaShell
      id="atencion"
      titulo="Requiere tu atención"
      Icono={CircleAlert}
      meta={urgencias.length > MAX ? `Mostrando ${MAX} de ${urgencias.length}` : 'Ordenado por urgencia'}
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      <FeedAtencion urgencias={urgencias} titulo="" mostrarEvento={false} max={MAX} enmarcado={false} />
    </CajaShell>
  )
}
