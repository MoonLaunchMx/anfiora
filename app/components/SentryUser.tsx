'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { supabase } from '@/lib/supabase'

/**
 * Adjunta el planner logueado (id + email) a cada evento de Sentry. Asi los
 * reportes muestran "a que cuenta" le paso el error, no solo pais/navegador.
 */
export default function SentryUser() {
  useEffect(() => {
    let active = true

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      const u = data.user
      if (u) Sentry.setUser({ id: u.id, email: u.email })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      if (u) Sentry.setUser({ id: u.id, email: u.email })
      else Sentry.setUser(null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return null
}
