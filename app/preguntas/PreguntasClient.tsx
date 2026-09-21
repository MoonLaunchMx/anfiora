'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import AuthModal from '@/app/components/auth/AuthModal'
import { LandingNav, LandingFooter } from '@/app/components/LandingChrome'
import { FAQ } from '@/lib/faq'

const SATOSHI = { fontFamily: 'Satoshi, sans-serif' }

type Lang = 'es' | 'en'

export default function PreguntasClient() {
  const [lang, setLang] = useState<Lang>('es')
  const [open, setOpen] = useState<number | null>(0)
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register')

  const t = FAQ[lang]
  const openLogin    = () => { setAuthTab('login');    setAuthOpen(true) }
  const openRegister = () => { setAuthTab('register'); setAuthOpen(true) }

  return (
    <>
      <LandingNav
        lang={lang}
        onCambiarIdioma={() => setLang(l => l === 'es' ? 'en' : 'es')}
        onLogin={openLogin}
        onRegistro={openRegister}
        desdeOtraPagina
      />

      <div className="min-h-[100dvh] bg-white">
        <main className="mx-auto max-w-6xl px-5 py-14 md:py-20">
          <div className="grid gap-8 md:grid-cols-[300px_minmax(0,1fr)] md:gap-16">
            <div className="md:sticky md:top-24 md:self-start">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0F6E56]">{t.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-[#1D1E20] md:text-4xl" style={SATOSHI}>
                {t.title}
              </h1>
              <p className="mt-3 text-base leading-relaxed text-[#888]">{t.sub}</p>
            </div>

            <div className="border-b border-[#e8e4de]">
              {t.items.map((item, i) => {
                const isOpen = open === i
                return (
                  <div key={item.q} className="border-t border-[#e8e4de]">
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left">
                      <span className={`text-base font-semibold leading-snug transition ${isOpen ? 'text-[#0F6E56]' : 'text-[#1D1E20]'}`}>
                        {item.q}
                      </span>
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${isOpen ? 'rotate-45 border-[#e1f5ee] bg-[#e1f5ee] text-[#0F6E56]' : 'border-[#e8e4de] text-[#888]'}`}>
                        <Plus size={14} strokeWidth={2.2} />
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden">
                          <p className="max-w-[80ch] pb-6 text-[15px] leading-relaxed text-[#666] md:pr-12">{item.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </div>
        </main>

        <section className="bg-[#1D1E20] py-16">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#48C9B0]">{t.ctaEyebrow}</p>
            <h2 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl" style={SATOSHI}>
              {t.ctaTitle}
            </h2>
            <p className="mb-8 text-base text-white/50">{t.ctaSub}</p>
            <button
              onClick={openRegister}
              className="cursor-pointer rounded-xl bg-[#48C9B0] px-10 py-4 text-base font-semibold text-[#04342C] shadow-[0_4px_24px_rgba(72,201,176,0.4)] transition hover:bg-[#5dd4bb]">
              {t.ctaBtn}
            </button>
          </div>
        </section>

        <LandingFooter lang={lang} />
      </div>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab={authTab}
        lang={lang}
      />
    </>
  )
}
