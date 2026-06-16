'use client'

import { useEffect, useState } from 'react'
import AuthModal from '@/app/components/auth/AuthModal'
import LandingNav from '@/app/components/landing/LandingNav'
import Hero from '@/app/components/landing/Hero'
import SectionPain from '@/app/components/landing/SectionPain'
import SectionPlatform from '@/app/components/landing/SectionPlatform'
import { landingCopy, type Lang } from '@/app/components/landing/i18n'

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('es')
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login')

  useEffect(() => {
    if (navigator.language?.toLowerCase().startsWith('en')) setLang('en')
  }, [])

  const openLogin = () => {
    setAuthTab('login')
    setAuthOpen(true)
  }
  const openRegister = () => {
    setAuthTab('register')
    setAuthOpen(true)
  }

  const t = landingCopy[lang]

  return (
    <>
      <div key={lang} className="min-h-screen overflow-x-hidden bg-[#fbfaf7] text-[#1D1E20]">
        <LandingNav
          t={t}
          lang={lang}
          setLang={setLang}
          onLogin={openLogin}
          onRegister={openRegister}
        />
        <Hero t={t} onRegister={openRegister} />
        <SectionPain t={t} onPlans={openRegister} />
        <SectionPlatform t={t} />
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
