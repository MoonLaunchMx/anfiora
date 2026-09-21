'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LegalLinks from '@/app/components/LegalLinks'

// El navbar y el pie de la landing. Los comparten la landing y /preguntas para
// que las dos paginas se vean y se muevan igual: si viven copiados, se separan.
// Las paginas legales llevan su propia version a ancho completo en
// app/components/legal/SiteChrome.tsx.

type Lang = 'es' | 'en'

const TEXTOS = {
  es: { features: 'Features', compare: 'Comparativa', login: 'Iniciar sesión', cta: 'Empieza gratis', copy: '© 2026 Anfiora · Hecho en México 🇲🇽' },
  en: { features: 'Features', compare: 'Compare', login: 'Log in', cta: 'Get started free', copy: '© 2026 Anfiora · Made in Mexico 🇲🇽' },
}

type NavProps = {
  lang: Lang
  onCambiarIdioma: () => void
  onLogin: () => void
  onRegistro: () => void
  // En la landing las anclas son de la misma pagina; desde otra ruta tienen que regresar a la landing.
  desdeOtraPagina?: boolean
}

export function LandingNav({ lang, onCambiarIdioma, onLogin, onRegistro, desdeOtraPagina = false }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const t = TEXTOS[lang]
  const base = desdeOtraPagina ? '/' : ''

  return (
    <nav className="sticky top-0 z-50 border-b border-[#f0ede8] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <a href="/" className="shrink-0">
          <img src="/images/isotipoylogo.svg" alt="Anfiora" className="h-8" />
        </a>
        <div className="hidden items-center gap-3 md:flex">
          <a href={`${base}#features`} className="text-sm text-[#888] transition hover:text-[#1D1E20]">{t.features}</a>
          <a href={`${base}#compare`} className="text-sm text-[#888] transition hover:text-[#1D1E20]">{t.compare}</a>
          <button onClick={onCambiarIdioma}
            className="rounded-lg border border-[#e0e0e0] px-3 py-2 text-lg transition hover:border-[#48C9B0]"
            title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}>
            {lang === 'es' ? '🇬🇧' : '🇲🇽'}
          </button>
          <button onClick={onLogin}
            className="rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
            {t.login}
          </button>
          <button onClick={onRegistro}
            className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
            {t.cta}
          </button>
        </div>
        <button className="flex flex-col gap-1.5 md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          <span className={`h-0.5 w-5 bg-[#1D1E20] transition-all ${menuOpen ? 'translate-y-2 rotate-45' : ''}`}/>
          <span className={`h-0.5 w-5 bg-[#1D1E20] transition-all ${menuOpen ? 'opacity-0' : ''}`}/>
          <span className={`h-0.5 w-5 bg-[#1D1E20] transition-all ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`}/>
        </button>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-[#f0ede8] bg-white px-5 md:hidden"
          >
            <div className="flex flex-col gap-3 py-4">
              <a href={`${base}#features`} className="text-sm text-[#555]" onClick={() => setMenuOpen(false)}>{t.features}</a>
              <a href={`${base}#compare`} className="text-sm text-[#555]" onClick={() => setMenuOpen(false)}>{t.compare}</a>
              <button onClick={onCambiarIdioma}
                className="rounded-lg border border-[#e0e0e0] py-2.5 text-base">
                {lang === 'es' ? '🇬🇧 Switch to English' : '🇲🇽 Cambiar a Español'}
              </button>
              <button onClick={onLogin}
                className="rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#555]">{t.login}</button>
              <button onClick={onRegistro}
                className="rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white">{t.cta}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

export function LandingFooter({ lang }: { lang: Lang }) {
  return (
    <footer className="border-t border-white/10 bg-[#1D1E20] px-5 py-4">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <img src="/images/isotipoylogo.svg" alt="Anfiora" className="h-6 shrink-0 brightness-0 invert" />
        <LegalLinks tono="oscuro" idioma={lang} contacto preguntas />
        <p className="shrink-0 whitespace-nowrap text-[10px] text-white/20">{TEXTOS[lang].copy}</p>
      </div>
    </footer>
  )
}
