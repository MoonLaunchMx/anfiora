'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AuthModal from '@/app/components/auth/AuthModal'

const translations = {
  es: {
    nav: { features: 'Features', compare: 'Comparativa', login: 'Iniciar sesión', cta: 'Empieza gratis' },
    hero: {
      badge: 'Para todo tipo de organizadores de eventos',
      prefix: 'Gestiona tu', suffix: 'sin el caos',
      sub: 'Lista de invitados, confirmaciones por WhatsApp, álbum colaborativo y playlist — todo en un solo lugar.',
      cta1: 'Empieza gratis', cta2: 'Ver demo →',
      fine: 'Sin tarjeta de crédito · Listo en 2 minutos',
    },
    heroWords: [
      { word: 'evento',             gender: 'o' },
      { word: 'boda',               gender: 'a' },
      { word: 'cumpleaños',         gender: 'o' },
      { word: 'evento corporativo', gender: 'o' },
      { word: 'gala',               gender: 'a' },
    ],
    ctaWords: [
      { word: 'evento',      prefix: 'Tu próximo' },
      { word: 'boda',        prefix: 'Tu próxima' },
      { word: 'gala',        prefix: 'Tu próxima' },
      { word: 'fiesta',      prefix: 'Tu próxima' },
      { word: 'carne asada', prefix: 'Tu próxima' },
    ],
    features: {
      title: 'Todo lo que necesitas para tu evento',
      sub: 'Sin apps extra. Sin hojas de cálculo. Sin WhatsApp caótico.',
      stat: { number: '342', label: 'invitados confirmados', sub: 'en un solo evento' },
      cards: [
        { title: 'Lista de invitados visual',    desc: 'Carga tu CSV, filtra por nombre o estado RSVP. Sin hojas de cálculo, sin caos. Gestiona cientos de invitados desde tu celular.' },
        { title: 'WhatsApp con un clic',         desc: 'Plantillas personalizables. Envía confirmaciones en segundos, sin copiar y pegar números.' },
        { title: 'Álbum colaborativo con QR',    desc: 'Genera un código QR y tus invitados suben fotos desde su celular. Compatible con Google Photos, iCloud y Dropbox.' },
        { title: 'Playlist colaborativa',        desc: 'Cada invitado sugiere hasta 3 canciones. Llega con la playlist perfecta ya lista.' },
        { title: 'Confirmaciones por correo',    desc: 'Envía confirmaciones automáticas por email a cada invitado. Tracking de aperturas incluido.', soon: true },
      ],
      soon: 'Próximamente',
    },
    demo: {
      title: 'Envía confirmaciones\nen segundos',
      sub: 'Selecciona invitados, elige una plantilla y manda el WhatsApp. Sin copiar y pegar. Sin errores. Sin perder tiempo.',
      steps: [
        'Selecciona uno o varios invitados de tu lista',
        'Elige una plantilla de mensaje personalizada',
        'Se abre WhatsApp con el mensaje y número listos',
      ],
      waName: 'Ana Martínez', waOnline: 'en línea',
      messages: [
        { out: true,  text: '¡Hola Ana! Te confirmamos tu lugar en la Boda García & López el 14 de junio. ¿Confirmas tu asistencia?', time: '10:32 am' },
        { out: false, text: '¡Claro que sí! Ahí estaremos 🎉', time: '10:34 am' },
        { out: true,  text: 'Perfecto Ana, ¡los esperamos! 🥂', time: '10:34 am' },
      ],
    },
    compare: {
      title: '¿Por qué no seguir con Excel?',
      sub: 'Porque tu tiempo vale más que copiar y pegar teléfonos.',
      col1: 'Excel', col2: 'Anfiora', hard: 'difícil',
      rows: [
        'Confirmaciones por WhatsApp', 'Estado RSVP en tiempo real',
        'Álbum colaborativo con QR', 'Playlist de invitados',
        'Importar CSV en segundos', 'Funciona perfecto en móvil',
      ],
    },
    cta: {
      eyebrow: 'Empieza hoy', suffix: 'empieza aquí',
      sub: 'Sin tarjeta de crédito. Listo en menos de 2 minutos.',
      btn: 'Crear mi primer evento gratis',
    },
    footer: { copy: '© 2025 Anfiora · Hecho en México 🇲🇽', links: ['Privacidad', 'Términos', 'Contacto'] },
    mockup: {
      tab: 'app.anfiora.mx · Boda García & López',
      event: 'Boda García & López',
      nav: ['Invitados', 'Álbum', 'Playlist', 'Config'],
      listTitle: 'Lista de invitados', add: '+ Añadir',
      colName: 'Nombre', colStatus: 'Estado',
      guests: [
        { name: 'Ana Martínez',  status: 'Confirmado', color: 'bg-[#e1f5ee] text-[#0F6E56]' },
        { name: 'Carlos Ruiz',   status: 'Pendiente',  color: 'bg-[#faeeda] text-[#854F0B]' },
        { name: 'Sofía López',   status: 'Declinado',  color: 'bg-[#fcebeb] text-[#A32D2D]' },
        { name: 'Miguel Torres', status: 'Confirmado', color: 'bg-[#e1f5ee] text-[#0F6E56]' },
      ],
    },
  },
  en: {
    nav: { features: 'Features', compare: 'Compare', login: 'Log in', cta: 'Get started free' },
    hero: {
      badge: 'For all types of event organizers',
      prefix: 'Manage your', suffix: 'without the chaos',
      sub: 'Guest list, WhatsApp confirmations, collaborative album, and playlist — all in one place.',
      cta1: 'Get started free', cta2: 'See demo →',
      fine: 'No credit card required · Ready in 2 minutes',
    },
    heroWords: [
      { word: 'event',           gender: '' },
      { word: 'wedding',         gender: '' },
      { word: 'birthday party',  gender: '' },
      { word: 'corporate event', gender: '' },
      { word: 'gala',            gender: '' },
    ],
    ctaWords: [
      { word: 'event',       prefix: 'Your next' },
      { word: 'wedding',     prefix: 'Your next' },
      { word: 'gala',        prefix: 'Your next' },
      { word: 'party',       prefix: 'Your next' },
      { word: 'celebration', prefix: 'Your next' },
    ],
    features: {
      title: 'Everything you need for your event',
      sub: 'No extra apps. No spreadsheets. No chaotic group chats.',
      stat: { number: '342', label: 'confirmed guests', sub: 'in a single event' },
      cards: [
        { title: 'Visual guest list',          desc: 'Upload your CSV, filter by name or RSVP status. No spreadsheets, no chaos. Manage hundreds of guests from your phone.' },
        { title: 'WhatsApp in one click',       desc: 'Customizable templates per event. Send confirmations in seconds without copying and pasting numbers.' },
        { title: 'Collaborative album with QR', desc: 'Generate a QR code and guests upload photos from their phones. Works with Google Photos, iCloud, and Dropbox.' },
        { title: 'Collaborative playlist',      desc: 'Each guest suggests up to 3 songs. Arrive at your event with the perfect playlist already set.' },
        { title: 'Email confirmations',         desc: 'Send automatic email confirmations to each guest. Open tracking included.', soon: true },
      ],
      soon: 'Coming soon',
    },
    demo: {
      title: 'Send confirmations\nin seconds',
      sub: 'Select guests, choose a template, and send the WhatsApp. No copy-pasting. No errors. No wasted time.',
      steps: [
        'Select one or multiple guests from your list',
        'Choose a personalized message template',
        'WhatsApp opens with the message and number ready',
      ],
      waName: 'Ana Martínez', waOnline: 'online',
      messages: [
        { out: true,  text: "Hi Ana! We're confirming your spot at the García & López Wedding on June 14th. Will you be attending?", time: '10:32 am' },
        { out: false, text: "Of course! We'll be there 🎉", time: '10:34 am' },
        { out: true,  text: "Perfect Ana, we'll see you there! 🥂", time: '10:34 am' },
      ],
    },
    compare: {
      title: 'Why stop using Excel?',
      sub: 'Because your time is worth more than copying and pasting phone numbers.',
      col1: 'Excel', col2: 'Anfiora', hard: 'hard',
      rows: [
        'WhatsApp confirmations', 'Real-time RSVP tracking',
        'Collaborative album with QR', 'Guest playlist',
        'Import CSV in seconds', 'Works perfectly on mobile',
      ],
    },
    cta: {
      eyebrow: 'Start today', suffix: 'starts here',
      sub: 'No credit card required. Ready in under 2 minutes.',
      btn: 'Create my first event free',
    },
    footer: { copy: '© 2025 Anfiora · Made in Mexico 🇲🇽', links: ['Privacy', 'Terms', 'Contact'] },
    mockup: {
      tab: 'app.anfiora.mx · García & López Wedding',
      event: 'García & López Wedding',
      nav: ['Guests', 'Album', 'Playlist', 'Settings'],
      listTitle: 'Guest list', add: '+ Add',
      colName: 'Name', colStatus: 'Status',
      guests: [
        { name: 'Ana Martínez',  status: 'Confirmed', color: 'bg-[#e1f5ee] text-[#0F6E56]' },
        { name: 'Carlos Ruiz',   status: 'Pending',   color: 'bg-[#faeeda] text-[#854F0B]' },
        { name: 'Sofía López',   status: 'Declined',  color: 'bg-[#fcebeb] text-[#A32D2D]' },
        { name: 'Miguel Torres', status: 'Confirmed', color: 'bg-[#e1f5ee] text-[#0F6E56]' },
      ],
    },
  },
}

type Lang = 'es' | 'en'

function useRotating(len: number, interval = 2800) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % len), interval)
    return () => clearInterval(t)
  }, [len, interval])
  return idx
}

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function FadeSection({ children, className = '', delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number
}) {
  const { ref, visible } = useFadeIn()
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
    }}>
      {children}
    </div>
  )
}

const ICONS = [
  <svg key="0" width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="18" height="16" rx="2"/><path d="M2 8h18"/><path d="M7 3v5M15 3v5"/></svg>,
  <svg key="1" width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 2L2 8l6 4 2 8 10-18z"/></svg>,
  <svg key="2" width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="12" y="3" width="7" height="7" rx="1"/><rect x="3" y="12" width="7" height="7" rx="1"/><path d="M12 15.5h7M15.5 12v7"/></svg>,
  <svg key="3" width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  <svg key="4" width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="18" height="14" rx="2"/><path d="M2 9l9 5 9-5"/></svg>,
]

export default function LandingPage() {
  const [lang, setLang]           = useState<Lang>('es')
  const [menuOpen, setMenuOpen]   = useState(false)
  const [authOpen, setAuthOpen]   = useState(false)
  const [authTab, setAuthTab]     = useState<'login' | 'register'>('login')

  useEffect(() => {
    if (navigator.language?.toLowerCase().startsWith('en')) setLang('en')
  }, [])

  const openLogin    = () => { setAuthTab('login');    setAuthOpen(true) }
  const openRegister = () => { setAuthTab('register'); setAuthOpen(true) }

  const t        = translations[lang]
  const heroIdx  = useRotating(t.heroWords.length, 2800)
  const ctaIdx   = useRotating(t.ctaWords.length, 3200)
  const heroWord = t.heroWords[heroIdx]
  const ctaWord  = t.ctaWords[ctaIdx]

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[#f0ede8] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <a href="/landing" className="shrink-0">
            <img src="/images/logo.svg" alt="Anfiora" className="h-8 lg:h-10" />
          </a>
          <div className="hidden items-center gap-3 md:flex">
            <a href="#features" className="text-sm text-[#888] transition hover:text-[#1D1E20]">{t.nav.features}</a>
            <a href="#compare"  className="text-sm text-[#888] transition hover:text-[#1D1E20]">{t.nav.compare}</a>
            <button onClick={() => setLang(l => l === 'es' ? 'en' : 'es')}
              className="rounded-lg border border-[#e0e0e0] px-3 py-2 text-lg transition hover:border-[#48C9B0]"
              title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}>
              {lang === 'es' ? '🇬🇧' : '🇲🇽'}
            </button>
            <button onClick={openLogin}
              className="rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
              {t.nav.login}
            </button>
            <button onClick={openRegister}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
              {t.nav.cta}
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
                <a href="#features" className="text-sm text-[#555]" onClick={() => setMenuOpen(false)}>{t.nav.features}</a>
                <a href="#compare"  className="text-sm text-[#555]" onClick={() => setMenuOpen(false)}>{t.nav.compare}</a>
                <button onClick={() => setLang(l => l === 'es' ? 'en' : 'es')}
                  className="rounded-lg border border-[#e0e0e0] py-2.5 text-base">
                  {lang === 'es' ? '🇬🇧 Switch to English' : '🇲🇽 Cambiar a Español'}
                </button>
                <button onClick={openLogin}
                  className="rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#555]">{t.nav.login}</button>
                <button onClick={openRegister}
                  className="rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white">{t.nav.cta}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <div className="min-h-screen overflow-x-hidden bg-white text-[#1D1E20]">

        {/* ── HERO ── */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pt-24">
          <div className="grid items-center gap-8 md:grid-cols-[45%_55%]">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c8f0e8] bg-[#f0fdf9] px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#48C9B0]" />
                <span className="text-xs font-medium text-[#0F6E56]">{t.hero.badge}</span>
              </div>
              <h1 className="mb-4 text-4xl font-bold leading-[1.2] tracking-tight text-[#1D1E20] md:text-5xl" style={{ fontFamily: 'Georgia, serif' }}>
                {t.hero.prefix}
                <br />
                <AnimatePresence mode="wait">
                  <motion.span key={heroIdx}
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.32, ease: 'easeInOut' }}
                    className="inline-block whitespace-nowrap text-[#48C9B0]">
                    {heroWord.word}
                  </motion.span>
                </AnimatePresence>
                <br />{t.hero.suffix}
              </h1>
              <p className="mb-8 max-w-md text-base leading-relaxed text-[#666] md:text-lg">{t.hero.sub}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={openRegister}
                  className="rounded-xl bg-[#48C9B0] px-7 py-3.5 text-base font-semibold text-white shadow-[0_4px_16px_rgba(72,201,176,0.35)] transition hover:bg-[#3ab89f]">
                  {t.hero.cta1}
                </button>
                <button className="rounded-xl border border-[#e0e0e0] px-7 py-3.5 text-base text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
                  {t.hero.cta2}
                </button>
              </div>
              <p className="mt-4 text-xs text-[#aaa]">{t.hero.fine}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }} className="relative">
              <div className="absolute -right-8 -top-8 h-64 w-64 rounded-full bg-[#e8faf6] opacity-60" />
              <div className="absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-[#f0fdf9] opacity-80" />
              <div className="relative overflow-hidden rounded-2xl border border-[#e8e4de] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                <div className="flex items-center gap-2 border-b border-[#f0ede8] bg-[#f8f5f0] px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-[#ff6b6b]" />
                  <span className="h-3 w-3 rounded-full bg-[#ffd93d]" />
                  <span className="h-3 w-3 rounded-full bg-[#6bcb77]" />
                  <span className="ml-3 text-xs text-[#aaa]">{t.mockup.tab}</span>
                </div>
                <div className="flex min-h-[300px]">
                  <div className="w-36 shrink-0 border-r border-[#f0ede8] bg-[#f8f5f0] p-3">
                    <p className="mb-3 truncate text-[10px] font-medium text-[#999]">{t.mockup.event}</p>
                    {t.mockup.nav.map((label, i) => (
                      <div key={label} className={`mb-1 rounded-md px-2.5 py-2 text-xs ${i === 0 ? 'bg-[#e1f5ee] font-semibold text-[#0F6E56]' : 'text-[#888]'}`}>
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#1D1E20]">{t.mockup.listTitle}</span>
                      <div className="rounded-md bg-[#48C9B0] px-2.5 py-1 text-[10px] font-semibold text-white">{t.mockup.add}</div>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-[#f0ede8]">
                      <div className="grid grid-cols-[1fr_80px] border-b border-[#f0ede8] bg-[#f8f5f0] px-3 py-2">
                        <span className="text-[10px] text-[#aaa]">{t.mockup.colName}</span>
                        <span className="text-[10px] text-[#aaa]">{t.mockup.colStatus}</span>
                      </div>
                      {t.mockup.guests.map((g, i) => (
                        <div key={i} className="grid grid-cols-[1fr_80px] items-center border-b border-[#f8f5f0] px-3 py-2.5 last:border-0">
                          <span className="text-xs text-[#1D1E20]">{g.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-center text-[10px] font-medium ${g.color}`}>{g.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="bg-[#f8f5f0] py-20">
          <div className="mx-auto max-w-6xl px-5">
            <FadeSection className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#1D1E20] md:text-4xl" style={{ fontFamily: 'Georgia, serif' }}>{t.features.title}</h2>
              <p className="mt-3 text-base text-[#888]">{t.features.sub}</p>
            </FadeSection>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FadeSection delay={0.05} className="md:col-span-2">
                <div className="h-full rounded-2xl border border-[#e8e4de] bg-white p-6 transition hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e1f5ee]">{ICONS[0]}</div>
                  <h3 className="mb-2 text-base font-semibold text-[#1D1E20]">{t.features.cards[0].title}</h3>
                  <p className="text-sm leading-relaxed text-[#888]">{t.features.cards[0].desc}</p>
                </div>
              </FadeSection>
              <FadeSection delay={0.1}>
                <div className="h-full rounded-2xl bg-[#48C9B0] p-6">
                  <p className="text-5xl font-bold text-[#04342C]">{t.features.stat.number}</p>
                  <p className="mt-1 text-sm font-medium text-[#0F6E56]">{t.features.stat.label}</p>
                  <p className="mt-3 text-xs text-[#1D9E75]">{t.features.stat.sub}</p>
                </div>
              </FadeSection>
              <FadeSection delay={0.12}>
                <div className="h-full rounded-2xl border border-[#e8e4de] bg-white p-6 transition hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e1f5ee]">{ICONS[1]}</div>
                  <h3 className="mb-2 text-base font-semibold text-[#1D1E20]">{t.features.cards[1].title}</h3>
                  <p className="text-sm leading-relaxed text-[#888]">{t.features.cards[1].desc}</p>
                </div>
              </FadeSection>
              <FadeSection delay={0.14} className="md:col-span-2">
                <div className="h-full rounded-2xl border border-[#e8e4de] bg-white p-6 transition hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e1f5ee]">{ICONS[2]}</div>
                  <h3 className="mb-2 text-base font-semibold text-[#1D1E20]">{t.features.cards[2].title}</h3>
                  <p className="text-sm leading-relaxed text-[#888]">{t.features.cards[2].desc}</p>
                </div>
              </FadeSection>
              <FadeSection delay={0.16}>
                <div className="h-full rounded-2xl border border-[#e8e4de] bg-white p-6 transition hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e1f5ee]">{ICONS[3]}</div>
                  <h3 className="mb-2 text-base font-semibold text-[#1D1E20]">{t.features.cards[3].title}</h3>
                  <p className="text-sm leading-relaxed text-[#888]">{t.features.cards[3].desc}</p>
                </div>
              </FadeSection>
              <FadeSection delay={0.18} className="md:col-span-2">
                <div className="h-full rounded-2xl border border-dashed border-[#c8e6df] bg-[#f8fdfb] p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e1f5ee]">{ICONS[4]}</div>
                    <span className="rounded-full bg-[#e1f5ee] px-3 py-1 text-xs font-semibold text-[#0F6E56]">{t.features.soon}</span>
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-[#1D1E20]">{t.features.cards[4].title}</h3>
                  <p className="text-sm leading-relaxed text-[#888]">{t.features.cards[4].desc}</p>
                </div>
              </FadeSection>
            </div>
          </div>
        </section>

        {/* ── DEMO WHATSAPP ── */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid items-center gap-8 md:grid-cols-[45%_55%]">
              <FadeSection>
                <h2 className="mb-4 text-3xl font-bold tracking-tight text-[#1D1E20] md:text-4xl" style={{ fontFamily: 'Georgia, serif' }}>
                  {t.demo.title.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
                </h2>
                <p className="mb-8 text-base leading-relaxed text-[#888]">{t.demo.sub}</p>
                <div className="flex flex-col gap-5">
                  {t.demo.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#48C9B0] text-xs font-bold text-white">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <p className="pt-1 text-sm leading-relaxed text-[#555]">{step}</p>
                    </div>
                  ))}
                </div>
              </FadeSection>
              <FadeSection delay={0.1}>
                <div className="overflow-hidden rounded-2xl bg-[#075e54] shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
                  <div className="flex items-center gap-3 bg-[#128c7e] px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e1f5ee] text-xs font-bold text-[#0F6E56]">AM</div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.demo.waName}</p>
                      <p className="text-[10px] text-white/60">{t.demo.waOnline}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 px-4 py-5">
                    {t.demo.messages.map((msg, i) => (
                      <div key={i} className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${msg.out ? 'ml-auto rounded-br-sm bg-[#dcf8c6]' : 'mr-auto rounded-bl-sm bg-white'}`}>
                        <p className="text-xs leading-relaxed text-[#1a1a1a]">{msg.text}</p>
                        <p className={`mt-1 text-[9px] text-[#888] ${msg.out ? 'text-right' : ''}`}>{msg.time}{msg.out ? ' ✓✓' : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeSection>
            </div>
          </div>
        </section>

        {/* ── COMPARATIVA ── */}
        <section id="compare" className="bg-[#f8f5f0] py-20">
          <div className="mx-auto max-w-4xl px-5">
            <FadeSection className="mb-12 text-center">
              <h2 className="text-xl font-bold tracking-tight text-[#1D1E20] md:text-2xl" style={{ fontFamily: 'Georgia, serif' }}>
                {t.compare.title}
              </h2>
              <p className="mt-3 text-base text-[#888]">{t.compare.sub}</p>
            </FadeSection>
            <FadeSection delay={0.1}>
              <div className="overflow-hidden rounded-2xl border border-[#e8e4de] bg-white">
                <div className="grid grid-cols-[1fr_120px_140px] border-b border-[#f0ede8] bg-[#f8f5f0] px-5 py-3">
                  <span />
                  <span className="text-center text-xs font-semibold uppercase tracking-wider text-[#aaa]">{t.compare.col1}</span>
                  <span className="text-center text-xs font-semibold uppercase tracking-wider text-[#48C9B0]">{t.compare.col2}</span>
                </div>
                {t.compare.rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_140px] items-center border-b border-[#f8f5f0] px-5 py-4 last:border-0">
                    <span className="text-sm text-[#1D1E20]">{row}</span>
                    <div className="flex justify-center">
                      {i === t.compare.rows.length - 1
                        ? <span className="text-xs text-[#aaa]">{t.compare.hard}</span>
                        : <span className="text-lg text-[#e24b4a]">✕</span>}
                    </div>
                    <div className="flex justify-center">
                      <span className="text-lg text-[#48C9B0]">✓</span>
                    </div>
                  </div>
                ))}
              </div>
            </FadeSection>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section className="bg-[#1D1E20] py-24">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <FadeSection>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#48C9B0]">{t.cta.eyebrow}</p>
              <h2 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl" style={{ fontFamily: 'Georgia, serif' }}>
                {ctaWord.prefix}{' '}
                <AnimatePresence mode="wait">
                  <motion.span key={ctaIdx}
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.32, ease: 'easeInOut' }}
                    className="inline-block whitespace-nowrap text-[#48C9B0]">
                    {ctaWord.word}
                  </motion.span>
                </AnimatePresence>
                <br />{t.cta.suffix}
              </h2>
              <p className="mb-10 text-base text-white/50">{t.cta.sub}</p>
              <button onClick={openRegister}
                className="rounded-xl bg-[#48C9B0] px-10 py-4 text-base font-semibold text-[#04342C] shadow-[0_4px_24px_rgba(72,201,176,0.4)] transition hover:bg-[#5dd4bb]">
                {t.cta.btn}
              </button>
            </FadeSection>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-white/10 bg-[#1D1E20] px-5 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <p className="shrink-0 whitespace-nowrap text-xs font-bold text-white/80" style={{ fontFamily: 'Georgia, serif' }}>
              Anfi<span className="text-[#48C9B0]">ora</span>
            </p>
            <div className="flex shrink-0 gap-5">
              {t.footer.links.map(link => (
                <a key={link} href="#" className="whitespace-nowrap text-[10px] text-white/30 no-underline">{link}</a>
              ))}
            </div>
            <p className="shrink-0 whitespace-nowrap text-[10px] text-white/20">{t.footer.copy}</p>
          </div>
        </footer>

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
