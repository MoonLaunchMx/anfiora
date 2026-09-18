'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { supabase } from '@/lib/supabase'

/**
 * Adjunta el id del planner logueado a cada evento de Sentry, para saber a que
 * cuenta le paso el error y no solo pais/navegador.
 *
 * El correo NO se manda: es un dato personal, y mandarlo lo deja guardado en un
 * tercero. Con el id basta; el correo se saca de nuestra base cuando hace falta.
 */
export default function SentryUser() {
  useEffect(() => {
    let active = true

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      const u = data.user
      if (u) Sentry.setUser({ id: u.id })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      if (u) Sentry.setUser({ id: u.id })
      else Sentry.setUser(null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return null
}
