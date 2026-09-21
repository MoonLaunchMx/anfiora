'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { urlSinSecretos } from '@/lib/observabilidad/anonimizar'

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthogInstance = usePostHog()

  useEffect(() => {
    if (pathname && posthogInstance) {
      let url = window.origin + pathname
      const search = searchParams.toString()
      if (search) {
        url += '?' + search
      }
      posthogInstance.capture('$pageview', { '$current_url': urlSinSecretos(url) })
    }
  }, [pathname, searchParams, posthogInstance])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: 'identified_only',
      capture_pageview: false,
      // Red de seguridad: cualquier evento que PostHog arme por su cuenta
      // (clics, referer, salidas) tambien pasa por aqui. Las direcciones de
      // playlist, mesa de regalos, opinion, invitacion e invitacion de equipo
      // llevan el token adentro, y ese token es la llave de entrada.
      sanitize_properties: (props) => {
        for (const clave of ['$current_url', '$referrer', '$pathname', '$initial_current_url']) {
          const valor = props[clave]
          if (typeof valor === 'string') props[clave] = urlSinSecretos(valor)
        }
        return props
      },
    })
  }, [])

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}
