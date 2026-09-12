'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { destinoDeVuelta } from '@/lib/rolodex/volver'

export default function VolverRolodex() {
  const pathname = usePathname()
  const [href, setHref] = useState('/dashboard')

  useEffect(() => {
    setHref(destinoDeVuelta(window.location.search, pathname))
  }, [pathname])

  return (
    <a href={href} className="flex items-center gap-1.5 text-xs text-[#888] transition hover:text-[#48C9B0]">
      <ArrowLeft size={14} />
      Volver
    </a>
  )
}
