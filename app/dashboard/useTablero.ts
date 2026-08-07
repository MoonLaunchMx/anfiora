'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cajasDisponibles, cifrasDisponibles, mezclarAcomodo, mismasCajas,
  type Acomodo, type Caja, type CifraId,
} from '@/lib/dashboard/tablero'
import { cargarTablero, guardarAcomodo } from '@/lib/dashboard/tablero-store'

export type EstadoTablero = {
  acomodo: Acomodo | null
  cifrasDisp: CifraId[]
  error: boolean
  aplicar: (siguiente: Acomodo) => void
  mover: (cajas: Caja[]) => void
  persistir: () => Promise<void>
}

// El acomodo se guarda junto al evento al que pertenece. Asi, al cambiar de
// evento, lo cargado deja de coincidir y la pantalla muestra su esqueleto sin
// tener que reiniciar el estado dentro del efecto.
type Cargado = { eventId: string; acomodo: Acomodo; cifrasDisp: CifraId[] }

// Constante de modulo para que la lista vacia sea siempre la misma: creada al
// vuelo, cambiaria las dependencias de los callbacks en cada render.
const SIN_CIFRAS: CifraId[] = []

export function useTablero(
  eventId: string,
  eventType: string | null,
  puedeVerDinero: boolean,
): EstadoTablero {
  const [cargado, setCargado] = useState<Cargado | null>(null)
  const [error, setError] = useState(false)

  // El ultimo acomodo vivo, para que persistir() no dependa de que el estado ya
  // se haya vuelto a renderizar tras el ultimo arrastre. Lleva su evento para
  // no escribir en el evento nuevo lo que se movio en el anterior.
  const ultimo = useRef<Cargado | null>(null)

  useEffect(() => {
    let cancelado = false

    const cargar = async () => {
      const { acomodo: guardado, enabledFeatures } = await cargarTablero(eventId)
      if (cancelado) return
      const cifras = cifrasDisponibles(eventType, enabledFeatures, puedeVerDinero)
      const cajas = cajasDisponibles(eventType, enabledFeatures)
      const mezclado = mezclarAcomodo(guardado, cifras, cajas)
      const siguiente: Cargado = { eventId, acomodo: mezclado, cifrasDisp: cifras }
      ultimo.current = siguiente
      setCargado(siguiente)
      setError(false)
    }

    cargar()
    return () => { cancelado = true }
  }, [eventId, eventType, puedeVerDinero])

  const vigente = cargado && cargado.eventId === eventId ? cargado : null
  const acomodo = vigente?.acomodo ?? null
  const cifrasDisp = vigente?.cifrasDisp ?? SIN_CIFRAS

  const guardar = useCallback(async (a: Acomodo) => {
    const ok = await guardarAcomodo(eventId, a)
    setError(!ok)
  }, [eventId])

  const aplicar = useCallback((siguiente: Acomodo) => {
    ultimo.current = { eventId, acomodo: siguiente, cifrasDisp }
    setCargado(prev => (prev && prev.eventId === eventId ? { ...prev, acomodo: siguiente } : prev))
    guardar(siguiente)
  }, [eventId, cifrasDisp, guardar])

  // Solo mueve el estado; escribir queda para persistir(). Mientras se arrastra
  // llegan decenas de avisos y guardar en cada uno seria una tormenta.
  const mover = useCallback((cajas: Caja[]) => {
    if (!acomodo || mismasCajas(acomodo.cajas, cajas)) return
    const siguiente: Acomodo = { v: 1, cifras: acomodo.cifras, cajas, ocultas: acomodo.ocultas }
    ultimo.current = { eventId, acomodo: siguiente, cifrasDisp }
    setCargado(prev => (prev && prev.eventId === eventId ? { ...prev, acomodo: siguiente } : prev))
  }, [acomodo, eventId, cifrasDisp])

  const persistir = useCallback(async () => {
    const u = ultimo.current
    if (u && u.eventId === eventId) await guardar(u.acomodo)
  }, [eventId, guardar])

  return { acomodo, cifrasDisp, error, aplicar, mover, persistir }
}
