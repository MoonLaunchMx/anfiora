'use client'

import { landingCopy, type Lang } from './i18n'

type Props = {
  t: (typeof landingCopy)[Lang]
  lang: Lang
  setLang: (l: Lang) => void
  onLogin: () => void
  onRegister: () => void
}

export default function LandingNav({ t, lang, setLang, onLogin, onRegister }: Props) {
  return (
    <nav className="relative z-20 mx-auto flex max-w-[1200px] items-center justify-between px-5 py-5 md:px-10 md:py-6">
      <a href="/" className="shrink-0">
        <img src="/images/isotipoylogo.svg" alt="Anfiora" className="h-7 md:h-8" />
      </a>
      <div className="flex items-center gap-3 md:gap-4">
        <a
          href="#plataforma"
          className="hidden text-sm text-[#555657] transition hover:text-[#1D1E20] md:inline"
        >
          {t.nav.platform}
        </a>
        <a
          href="#para-quien"
          className="mr-1 hidden text-sm text-[#555657] transition hover:text-[#1D1E20] md:inline"
        >
          {t.nav.planners}
        </a>
        <button
          onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          className="rounded-[10px] border border-[#e0e0e0] bg-white px-3 py-2 text-sm leading-none transition hover:border-[#48C9B0]"
        >
          {lang === 'es' ? 'EN' : 'ES'}
        </button>
        <button
          onClick={onLogin}
          className="hidden rounded-[10px] border border-[#e0e0e0] bg-white px-4 py-2 text-sm text-[#555657] transition hover:border-[#48C9B0] hover:text-[#48C9B0] sm:inline-block"
        >
          {t.nav.login}
        </button>
        <button
          onClick={onRegister}
          className="whitespace-nowrap rounded-[10px] bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
        >
          {t.nav.cta}
        </button>
      </div>
    </nav>
  )
}
