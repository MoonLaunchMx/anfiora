'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import LegalLinks from '@/app/components/LegalLinks'
import AuthModal from '@/app/components/auth/AuthModal'

// El navbar y el pie de la landing viven dentro de app/page.tsx, que es un
// client component enorme con todo el copy bilingue. Aqui se repiten con la
// misma forma y el mismo tope de max-w-6xl para que las paginas legales se
// vean como una pagina mas del sitio y el logo no salte al navegar.
//
// Unica diferencia a proposito: no hay cambio de idioma, porque los tres
// documentos solo existen en espanol y una bandera que no hace nada es peor
// que no tenerla. Si algun dia se traducen, aqui entra.

export function SiteNav() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [authAbierto, setAuthAbierto] = useState(false)
  const [tab, setTab] = useState<'login' | 'register'>('login')

  const abrir = (cual: 'login' | 'register') => {
    setTab(cual)
    setAuthAbierto(true)
    setMenuAbierto(false)
  }

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[#f0ede8] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="shrink-0">
            <Image src="/images/isotipoylogo.svg" alt="Anfiora" width={110} height={32} priority className="h-8 w-auto" />
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/#features" className="text-sm text-[#888] transition hover:text-[#1D1E20]">Features</Link>
            <Link href="/#compare" className="text-sm text-[#888] transition hover:text-[#1D1E20]">Comparativa</Link>
            <button
              onClick={() => abrir('login')}
              className="rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => abrir('register')}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
            >
              Empieza gratis
            </button>
          </div>

          <button
            aria-label="Menú"
            aria-expanded={menuAbierto}
            className="flex flex-col gap-1.5 md:hidden"
            onClick={() => setMenuAbierto(v => !v)}
          >
            <span className={`h-0.5 w-5 bg-[#1D1E20] transition-all ${menuAbierto ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`h-0.5 w-5 bg-[#1D1E20] transition-all ${menuAbierto ? 'opacity-0' : ''}`} />
            <span className={`h-0.5 w-5 bg-[#1D1E20] transition-all ${menuAbierto ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>

        {menuAbierto && (
          <div className="border-t border-[#f0ede8] bg-white px-5 md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 py-4">
              <Link href="/#features" className="text-sm text-[#555]" onClick={() => setMenuAbierto(false)}>Features</Link>
              <Link href="/#compare" className="text-sm text-[#555]" onClick={() => setMenuAbierto(false)}>Comparativa</Link>
              <button onClick={() => abrir('login')} className="rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#555]">
                Iniciar sesión
              </button>
              <button onClick={() => abrir('register')} className="rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white">
                Empieza gratis
              </button>
            </div>
          </div>
        )}
      </nav>

      <AuthModal isOpen={authAbierto} onClose={() => setAuthAbierto(false)} defaultTab={tab} lang="es" />
    </>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-white/10 bg-[#1D1E20] px-5 py-4">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <Image
          src="/images/isotipoylogo.svg"
          alt="Anfiora"
          width={110}
          height={24}
          className="h-6 w-auto shrink-0 brightness-0 invert"
        />
        <LegalLinks tono="oscuro" contacto />
        <p className="shrink-0 whitespace-nowrap text-[10px] text-white/20">
          © 2026 Anfiora. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}
