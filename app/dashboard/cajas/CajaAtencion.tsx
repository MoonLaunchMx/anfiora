'use client'

import { buildUrgencias } from '@/lib/dashboard/urgencias'
import FeedAtencion from '../FeedAtencion'
import CajaShell, { type PropsCaja } from './CajaShell'

const MAX = 3

export default function CajaAtencion({ m, puedeVerDinero, modoPersonalizar, onQuitar }: PropsCaja) {
  const urgencias = buildUrgencias([m], { puedeVerDinero })

  return (
    <CajaShell
      id="atencion"
      titulo="Requiere tu atención"
      meta={urgencias.length > MAX ? `Mostrando ${MAX} de ${urgencias.length}` : 'Ordenado por urgencia'}
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      <FeedAtencion urgencias={urgencias} titulo="" mostrarEvento={false} max={MAX} enmarcado={false} />
    </CajaShell>
  )
}
