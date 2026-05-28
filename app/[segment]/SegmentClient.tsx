'use client'

import { useEffect, useRef, useState } from 'react'
import { notFound } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import AuthModal from '@/app/components/auth/AuthModal'
import { SEGMENTS, SegmentConfig } from './config'

type Lang = 'es' | 'en'

const FEATURES = {
  es: [
    { title: 'Lista de invitados inteligente', desc: 'Carga tu CSV, filtra por nombre o estado RSVP. Gestiona 400+ invitados con acompañantes, etiquetas, alergias y mesas asignadas — desde tu celular.', wide: true, soon: false },
    { title: 'Mesas y plano del salón', desc: 'Arrastra y acomoda a tus invitados en las mesas. Check-in el día del evento.', wide: false, soon: false },
    { title: 'Presupuesto y proveedores', desc: '14 categorías, vincula proveedores a partidas, exporta a Excel o PDF.', wide: false, soon: false },
    { title: 'Álbum colaborativo con QR', desc: 'Genera un QR y tus invitados suben fotos desde su celular el día del evento.', wide: false, soon: false },
    { title: 'Playlist colaborativa', desc: 'Manda un link a tus invitados, que recomienden canciones y exporta la playlist perfecta antes de la boda.', wide: false, soon: false },
    { title: 'Mesa de regalos', desc: 'Tus invitados reservan regalos directamente desde la invitación. Sin duplicados, sin confusión.', wide: false, soon: true },
    { title: 'WhatsApp automatizado con agente IA', desc: 'El agente lee las respuestas de tus invitados y actualiza el RSVP automáticamente. Sin que tengas que hacer nada.', wide: false, soon: true },
  ],
  en: [
    { title: 'Smart guest list', desc: 'Upload your CSV, filter by name or RSVP status. Manage 400+ guests with plus-ones, tags, allergies, and assigned seats — from your phone.', wide: true, soon: false },
    { title: 'Seating chart', desc: 'Drag and drop guests into tables. Check them in on the day of the event.', wide: false, soon: false },
    { title: 'Budget and vendors', desc: '14 categories, link vendors to line items, export to Excel or PDF.', wide: false, soon: false },
    { title: 'Collaborative album with QR', desc: 'Generate a QR code and guests upload photos from their phones on the wedding day.', wide: false, soon: false },
    { title: 'Collaborative playlist', desc: 'Send a link to your guests, let them suggest songs, and export the perfect playlist before the wedding.', wide: false, soon: false },
    { title: 'Gift registry', desc: 'Guests reserve gifts directly from the invitation. No duplicates, no confusion.', wide: false, soon: true },
    { title: 'WhatsApp automation with AI agent', desc: 'The agent reads your guests responses and updates RSVP automatically. No action needed on your end.', wide: false, soon: true },
  ],
}

const IMPORT = {
  es: {
    title: '¿Ya tienes todo en Excel? Tráelo a Anfiora en un clic.',
    sub: 'No empieces de cero. Importa tu lista de invitados, tus mesas y tu presupuesto directamente desde tus archivos. En minutos estás adentro.',
    items: [
      { title: 'Invitados', sub: 'Sube tu CSV y listo' },
      { title: 'Mesas', sub: 'Importa tu distribución' },
      { title: 'Presupuesto', sub: 'Tus partidas al instante' },
    ],
    cta: 'Importar mi Excel ahora →',
  },
  en: {
    title: 'Already have everything in Excel? Bring it to Anfiora in one click.',
    sub: "Don't start from scratch. Import your guest list, seating chart, and budget directly from your files. You're up and running in minutes.",
    items: [
      { title: 'Guests', sub: 'Upload your CSV and done' },
      { title: 'Seating', sub: 'Import your layout' },
      { title: 'Budget', sub: 'Your line items instantly' },
    ],
    cta: 'Import my Excel now →',
  },
}

const COMPARE = {
  es: {
    title: '¿Por qué planear tu evento en Anfiora?',
    sub: 'Porque tu tiempo vale más que copiar y pegar teléfonos.',
    col1: 'Excel', col2: 'Anfiora',
    rows: [
      { label: 'Confirmaciones por WhatsApp', excel: false },
      { label: 'Mesas con drag & drop', excel: false },
      { label: 'Presupuesto con proveedores', excel: false },
      { label: 'Playlist colaborativa de invitados', excel: false },
      { label: 'Álbum con QR el día del evento', excel: false },
      { label: 'Funciona perfecto en móvil', excel: 'difícil' },
    ],
  },
  en: {
    title: 'Why plan your event in Anfiora?',
    sub: 'Because your time is worth more than copying and pasting phone numbers.',
    col1: 'Excel', col2: 'Anfiora',
    rows: [
      { label: 'WhatsApp confirmations', excel: false },
      { label: 'Drag & drop seating chart', excel: false },
      { label: 'Budget with vendors', excel: false },
      { label: 'Collaborative guest playlist', excel: false },
      { label: 'QR album on the wedding day', excel: false },
      { label: 'Works perfectly on mobile', excel: 'hard' },
    ],
  },
}

const MOCKUP = {
  es: {
    tab: 'Boda García & López', listTitle: 'Lista de invitados', add: '+ Añadir', colName: 'Nombre', colStatus: 'Estado',
    guests: [
      { name: 'Ana Martínez', status: 'Confirmado', color: 'bg-[#e1f5ee] text-[#0F6E56]' },
      { name: 'Carlos Ruiz', status: 'Pendiente', color: 'bg-[#faeeda] text-[#854F0B]' },
      { name: 'Sofía López', status: 'Declinado', color: 'bg-[#fcebeb] text-[#A32D2D]' },
      { name: 'Miguel Torres', status: 'Confirmado', color: 'bg-[#e1f5ee] text-[#0F6E56]' },
    ],
  },
  en: {
    tab: 'García & López Wedding', listTitle: 'Guest list', add: '+ Add', colName: 'Name', colStatus: 'Status',
    guests: [
      { name: 'Ana Martínez', status: 'Confirmed', color: 'bg-[#e1f5ee] text-[#0F6E56]' },
      { name: 'Carlos Ruiz', status: 'Pending', color: 'bg-[#faeeda] text-[#854F0B]' },
      { name: 'Sofía López', status: 'Declined', color: 'bg-[#fcebeb] text-[#A32D2D]' },
      { name: 'Miguel Torres', status: 'Confirmed', color: 'bg-[#e1f5ee] text-[#0F6E56]' },
    ],
  },
}

const FEAT_ICONS = [
  <svg key="0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  <svg key="1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  <svg key="2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="16" rx="2"/><path d="M2 8h20M7 3v5M17 3v5"/></svg>,
  <svg key="3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><path d="M14 17.5h7M17.5 14v7"/></svg>,
  <svg key="4" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  <svg key="5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
  <svg key="6" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.9 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
]

const IMPORT_ICONS = [
  <svg key="0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  <svg key="1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  <svg key="2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="16" rx="2"/><path d="M2 8h20"/></svg>,
]

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

const SATOSHI = { fontFamily: 'Satoshi, sans-serif' }

export default function SegmentClient({ config }: { config: SegmentConfig }) {
  const [lang, setLang] = useState<Lang>('es')
  const [menuOpen, setMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login')

  useEffect(() => {
    if (navigator.language?.toLowerCase().startsWith('en')) setLang('en')
  }, [])

  const openLogin = () => { setAuthTab('login'); setAuthOpen(true) }
  const openRegister = () => { setAuthTab('register'); setAuthOpen(true) }

  const features = FEATURES[lang]
  const importT = IMPORT[lang]
  const compare = COMPARE[lang]
  const mockup = MOCKUP[lang]

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[#f0ede8] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <a href="/" className="shrink-0">
            <img src="/images/isotipoylogo.svg" alt="Anfiora" className="h-8" />
          </a>
          <div className="hidden items-center gap-3 md:flex">
            <span className="text-sm text-[#888]">Para wedding planners y novios</span>
            <span className="text-sm text-[#888]">Precios</span>
            <button onClick={() => setLang(l => l === 'es' ? 'en' : 'es')}
              className="rounded-lg border border-[#e0e0e0] px-3 py-2 text-lg transition hover:border-[#48C9B0]">
              {lang === 'es' ? '🇬🇧' : '🇲🇽'}
            </button>
            <button onClick={openLogin}
              className="rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
              {lang === 'es' ? 'Iniciar sesión' : 'Log in'}
            </button>
            <button onClick={openRegister}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
              {lang === 'es' ? 'Empieza gratis' : 'Get started free'}
            </button>
          </div>
          <button className="flex flex-col gap-1.5 md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            <span className={`h-0.5 w-5 bg-[#1D1E20] transition-all ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`h-0.5 w-5 bg-[#1D1E20] transition-all ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`h-0.5 w-5 bg-[#1D1E20] transition-all ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
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
                <button onClick={() => setLang(l => l === 'es' ? 'en' : 'es')}
                  className="rounded-lg border border-[#e0e0e0] py-2.5 text-base">
                  {lang === 'es' ? '🇬🇧 Switch to English' : '🇲🇽 Cambiar a Español'}
                </button>
                <button onClick={openLogin}
                  className="rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#555]">
                  {lang === 'es' ? 'Iniciar sesión' : 'Log in'}
                </button>
                <button onClick={openRegister}
                  className="rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white">
                  {lang === 'es' ? 'Empieza gratis' : 'Get started free'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <div className="min-h-screen overflow-x-hidden bg-white text-[#1D1E20]">

        {/* HERO */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pt-24">
          <div className="grid items-center gap-8 md:grid-cols-[45%_55%]">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c8f0e8] bg-[#f0fdf9] px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#48C9B0]" />
                <span className="text-xs font-medium text-[#0F6E56]">{config.badge}</span>
              </div>
              <h1 className="mb-4 text-3xl font-bold leading-[1.2] tracking-tight text-[#1D1E20] md:text-4xl" style={SATOSHI}>
                {config.title1}<br />
                <span className="text-[#48C9B0]">{config.title2}</span>
              </h1>
              <p className="mb-8 max-w-md text-base leading-relaxed text-[#666]">{config.sub}</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={openRegister}
                  className="rounded-xl bg-[#48C9B0] px-7 py-3.5 text-base font-semibold text-white shadow-[0_4px_16px_rgba(72,201,176,0.35)] transition hover:bg-[#3ab89f]">
                  {lang === 'es' ? 'Empieza gratis' : 'Get started free'}
                </button>
                <button className="rounded-xl border border-[#e0e0e0] px-7 py-3.5 text-base text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
                  {lang === 'es' ? 'Ver demo →' : 'See demo →'}
                </button>
              </div>
              <p className="mt-4 text-xs text-[#aaa]">
                {lang === 'es' ? 'Sin tarjeta de crédito · Listo en 2 minutos' : 'No credit card required · Ready in 2 minutes'}
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }} className="relative">
              <div className="absolute -right-8 -top-8 h-64 w-64 rounded-full bg-[#e8faf6] opacity-60" />
              <div className="absolute -bottom-4 -left-4 h-32 w-32 rounded-full bg-[#f0fdf9] opacity-80" />
              <div className="relative overflow-hidden rounded-2xl border border-[#e8e4de] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                <div className="flex items-center gap-2 border-b border-[#f0ede8] bg-[#f8f5f0] px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-[#ff6b6b]" />
                  <span className="h-3 w-3 rounded-full bg-[#ffd93d]" />
                  <span className="h-3 w-3 rounded-full bg-[#6bcb77]" />
                  <span className="ml-3 text-xs text-[#aaa]">{mockup.tab}</span>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#1D1E20]">{mockup.listTitle}</span>
                    <div className="rounded-md bg-[#48C9B0] px-2.5 py-1 text-[10px] font-semibold text-white">{mockup.add}</div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-[#f0ede8]">
                    <div className="grid grid-cols-[1fr_80px] border-b border-[#f0ede8] bg-[#f8f5f0] px-3 py-2">
                      <span className="text-[10px] text-[#aaa]">{mockup.colName}</span>
                      <span className="text-[10px] text-[#aaa]">{mockup.colStatus}</span>
                    </div>
                    {mockup.guests.map((g, i) => (
                      <div key={i} className="grid grid-cols-[1fr_80px] items-center border-b border-[#f8f5f0] px-3 py-2.5 last:border-0">
                        <span className="text-xs text-[#1D1E20]">{g.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-center text-[10px] font-medium ${g.color}`}>{g.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="bg-[#f8f5f0] py-20">
          <div className="mx-auto max-w-6xl px-5">
            <FadeSection className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#1D1E20] md:text-4xl" style={SATOSHI}>
                {lang === 'es' ? 'Todo lo que necesita tu boda en un solo lugar' : 'Everything your wedding needs in one place'}
              </h2>
              <p className="mt-3 text-base text-[#888]">
                {lang === 'es' ? 'Sin apps extra. Sin Excel. Sin WhatsApp caótico.' : 'No extra apps. No Excel. No chaotic group chats.'}
              </p>
            </FadeSection>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {features.map((card, i) => (
                <FadeSection key={i} delay={i * 0.05} className={card.wide ? 'md:col-span-2' : ''}>
                  <div className={`h-full rounded-2xl border p-6 transition ${
                    card.soon
                      ? 'border-dashed border-[#c8e6df] bg-[#f8fdfb]'
                      : 'border-[#e8e4de] bg-white hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)]'
                  } ${card.wide ? 'flex items-start gap-4' : 'flex flex-col'}`}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e1f5ee]">
                      {FEAT_ICONS[i]}
                    </div>
                    <div className="mt-3">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-base font-semibold text-[#1D1E20]">{card.title}</h3>
                        {card.soon && (
                          <span className="rounded-full bg-[#e1f5ee] px-3 py-0.5 text-xs font-semibold text-[#0F6E56]">
                            {lang === 'es' ? 'Próximamente' : 'Coming soon'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-[#888]">{card.desc}</p>
                    </div>
                  </div>
                </FadeSection>
              ))}
            </div>
          </div>
        </section>

        {/* IMPORTAR DESDE EXCEL */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-5">
            <FadeSection>
              <div className="rounded-2xl border border-[#9FE1CB] bg-[#f0fdf9] p-8 md:p-12">
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c8f0e8]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="16" rx="2"/>
                      <path d="M2 8h20M7 3v5M17 3v5"/>
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#04342C] md:text-3xl" style={SATOSHI}>
                    {importT.title}
                  </h2>
                </div>
                <p className="mb-8 max-w-2xl text-base leading-relaxed text-[#0F6E56]">{importT.sub}</p>
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {importT.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-[#9FE1CB] bg-white p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e1f5ee]">
                        {IMPORT_ICONS[i]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#04342C]">{item.title}</p>
                        <p className="text-xs text-[#0F6E56]">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={openRegister}
                  className="rounded-xl bg-[#48C9B0] px-8 py-3.5 text-base font-semibold text-[#04342C] transition hover:bg-[#3ab89f]">
                  {importT.cta}
                </button>
              </div>
            </FadeSection>
          </div>
        </section>

        {/* COMPARATIVA */}
        <section id="compare" className="bg-[#f8f5f0] py-20">
          <div className="mx-auto max-w-4xl px-5">
            <FadeSection className="mb-12 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-[#1D1E20] md:text-3xl" style={SATOSHI}>
                {compare.title}
              </h2>
              <p className="mt-3 text-base text-[#888]">{compare.sub}</p>
            </FadeSection>
            <FadeSection delay={0.1}>
              <div className="overflow-hidden rounded-2xl border border-[#e8e4de] bg-white">
                <div className="grid grid-cols-[1fr_120px_140px] border-b border-[#f0ede8] bg-[#f8f5f0] px-5 py-3">
                  <span />
                  <span className="text-center text-xs font-semibold uppercase tracking-wider text-[#aaa]">{compare.col1}</span>
                  <span className="text-center text-xs font-semibold uppercase tracking-wider text-[#48C9B0]">{compare.col2}</span>
                </div>
                {compare.rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_140px] items-center border-b border-[#f8f5f0] px-5 py-4 last:border-0">
                    <span className="text-sm text-[#1D1E20]">{row.label}</span>
                    <div className="flex justify-center">
                      {row.excel === false
                        ? <span className="text-lg text-[#e24b4a]">✕</span>
                        : <span className="text-xs text-[#aaa]">{row.excel}</span>}
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

        {/* CTA FINAL */}
        <section className="bg-[#1D1E20] py-24">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <FadeSection>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#48C9B0]">
                {lang === 'es' ? 'Empieza hoy' : 'Start today'}
              </p>
              <h2 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl" style={SATOSHI}>
                {lang === 'es' ? 'Tu boda' : 'Your wedding'}<br />
                <span className="text-[#48C9B0]">{lang === 'es' ? 'empieza aquí' : 'starts here'}</span>
              </h2>
              <p className="mb-10 text-base text-white/50">
                {lang === 'es' ? 'Sin tarjeta de crédito. Listo en menos de 2 minutos.' : 'No credit card required. Ready in under 2 minutes.'}
              </p>
              <button onClick={openRegister}
                className="rounded-xl bg-[#48C9B0] px-10 py-4 text-base font-semibold text-[#04342C] shadow-[0_4px_24px_rgba(72,201,176,0.4)] transition hover:bg-[#5dd4bb]">
                {lang === 'es' ? 'Crear mi primer evento gratis' : 'Create my first event free'}
              </button>
            </FadeSection>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/10 bg-[#1D1E20] px-5 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <img src="/images/isotipologo.svg" alt="Anfiora" className="h-6 shrink-0 brightness-0 invert" />
            <div className="flex shrink-0 gap-5">
              {['Privacidad', 'Términos', 'Contacto'].map(link => (
                <a key={link} href="#" className="whitespace-nowrap text-[10px] text-white/30 no-underline">{link}</a>
              ))}
            </div>
            <p className="shrink-0 whitespace-nowrap text-[10px] text-white/20">© 2025 Anfiora · Hecho en México</p>
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