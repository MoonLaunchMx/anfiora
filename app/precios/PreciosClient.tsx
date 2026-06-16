'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Minus, ChevronDown, ArrowRight } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { motion, AnimatePresence } from 'framer-motion'
import AuthModal from '@/app/components/auth/AuthModal'
import ContactSalesModal from '@/app/components/ContactSalesModal'
import { supabase } from '@/lib/supabase'
import {
  ANFITRION_PLANS,
  ANFITRION_ILIMITADO,
  ORGANIZADOR_PLANS,
  FOUNDER_MAX,
  SEAT_ADDON_MONTHLY,
  formatMXN,
  type AnfitrionTier,
  type OrganizadorTier,
} from '@/lib/pricing'

interface CardTheme {
  card: string
  name: string
  tagline: string
  price: string
  sub: string
  divider: string
  bulletText: string
  check: string
  support: string
  cta: string
}

const ANFITRION_THEME: Record<AnfitrionTier, CardTheme> = {
  free: {
    card: 'bg-white border-[#e8e8e8]',
    name: 'text-[#0a0a0a]', tagline: 'text-[#999]', price: 'text-[#0a0a0a]', sub: 'text-[#999]',
    divider: 'text-[#999]', bulletText: 'text-[#444]', check: 'text-[#48C9B0]', support: 'text-[#666]',
    cta: 'border border-[#1D1E20] text-[#1D1E20] hover:bg-[#1D1E20] hover:text-white',
  },
  esencial: {
    card: 'bg-[#fffbf0] border-[#f0e6cc]',
    name: 'text-[#0a0a0a]', tagline: 'text-[#a08a5a]', price: 'text-[#0a0a0a]', sub: 'text-[#a08a5a]',
    divider: 'text-[#a08a5a]', bulletText: 'text-[#5a4d33]', check: 'text-[#c49a3a]', support: 'text-[#a08a5a]',
    cta: 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]',
  },
  pro: {
    card: 'bg-[#48C9B0] border-[#48C9B0]',
    name: 'text-white', tagline: 'text-white/80', price: 'text-white', sub: 'text-white/80',
    divider: 'text-white/70', bulletText: 'text-white', check: 'text-white', support: 'text-white/80',
    cta: 'bg-white text-[#1f8f74] hover:bg-white/90',
  },
  gran: {
    card: 'bg-[#1D1E20] border-[#1D1E20]',
    name: 'text-white', tagline: 'text-white/60', price: 'text-white', sub: 'text-white/60',
    divider: 'text-white/50', bulletText: 'text-white/90', check: 'text-[#48C9B0]', support: 'text-white/60',
    cta: 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]',
  },
}

interface OrgCardTheme {
  card: string
  name: string
  tagline: string
  priceMain: string
  priceStrike: string
  perMes: string
  pill: string
  bulletText: string
  check: string
  cta: string
}

const ORGANIZADOR_THEME: Record<OrganizadorTier, OrgCardTheme> = {
  solo: {
    card: 'bg-white border-[#e8e8e8]',
    name: 'text-[#0a0a0a]', tagline: 'text-[#999]', priceMain: 'text-[#0a0a0a]', priceStrike: 'text-[#bbb]', perMes: 'text-[#999]',
    pill: 'border-[#a0e0c0] bg-[#f0fff6] text-[#2a7a50]',
    bulletText: 'text-[#444]', check: 'text-[#48C9B0]',
    cta: 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]',
  },
  studio: {
    card: 'bg-[#48C9B0] border-[#48C9B0]',
    name: 'text-white', tagline: 'text-white/80', priceMain: 'text-white', priceStrike: 'text-white/60', perMes: 'text-white/80',
    pill: 'border-white/30 bg-white/20 text-white',
    bulletText: 'text-white', check: 'text-white',
    cta: 'bg-white text-[#1f8f74] hover:bg-white/90',
  },
  agency: {
    card: 'bg-[#1D1E20] border-[#1D1E20]',
    name: 'text-white', tagline: 'text-white/60', priceMain: 'text-white', priceStrike: 'text-white/40', perMes: 'text-white/60',
    pill: 'border-[#48C9B0]/40 bg-white/10 text-[#48C9B0]',
    bulletText: 'text-white/90', check: 'text-[#48C9B0]',
    cta: 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]',
  },
}

type Vista = 'anfitrion' | 'organizador'
type Billing = 'mensual' | 'anual'
type CompareCol = { label: string; cta?: { text: string; onClick: () => void; variant: 'solid' | 'outline' } }

// TODO (Fase 2): leer cupos en vivo desde la Promotion Code de Stripe via /api/founder-status.
const FOUNDER_REMAINING = 18

type Cell = boolean | string

const ANFITRION_COMPARE: { group: string; rows: { label: string; sub?: string; values: Cell[] }[] }[] = [
  {
    group: 'Gestión de invitados',
    rows: [
      { label: 'Límite de invitados', sub: 'con acompañantes incluidos', values: ['50', '150', '300', '500'] },
      { label: 'Acompañantes, tags, lado y alergias', values: [true, true, true, true] },
      { label: 'RSVP en tiempo real + check-in', values: [true, true, true, true] },
      { label: 'Importar lista por CSV', values: [true, true, true, true] },
      { label: 'Exportar lista (Excel/CSV)', values: [false, true, true, true] },
    ],
  },
  {
    group: 'Mesas y distribución',
    rows: [
      { label: 'Gestión de mesas (capacidad, formas)', values: [true, true, true, true] },
      { label: 'Canvas visual con arrastrar y soltar', sub: 'acomoda invitados en el plano del salón', values: [true, true, true, true] },
      { label: 'Imprimir acomodo de mesas (PDF)', values: [false, true, true, true] },
    ],
  },
  {
    group: 'Timeline y tareas',
    rows: [
      { label: 'Tareas, recordatorios y vista de urgencia', values: [true, true, true, true] },
      { label: 'Tareas ligadas a persona y proveedor', sub: 'asigna responsable y conecta con tu proveedor', values: [true, true, true, true] },
      { label: 'Marcar bloqueante y prioridad', values: [true, true, true, true] },
    ],
  },
  {
    group: 'Presupuesto, proveedores y pagos',
    rows: [
      { label: 'Presupuesto por categorías + salud', values: [true, true, true, true] },
      { label: 'Presupuesto ligado a proveedor y a pagos', sub: 'contratado vs pagado en automático', values: [true, true, true, true] },
      { label: 'Directorio de proveedores + reviews', values: [true, true, true, true] },
      { label: 'Historial de pagos + multi-moneda', values: [true, true, true, true] },
      { label: 'Exportar presupuesto y pagos (Excel/PDF)', values: [false, true, true, true] },
    ],
  },
  {
    group: 'Recuerdos, equipo y automatización',
    rows: [
      { label: 'Álbum (QR) y playlist colaborativos', values: [true, true, true, true] },
      { label: 'Equipo colaborador con roles', sub: 'admin, editor o viewer', values: ANFITRION_PLANS.map(p => `${p.collaborators} ${p.collaborators === 1 ? 'persona' : 'personas'}`) },
      { label: 'Agente de WhatsApp', sub: 'dentro de la app, en planes de pago', values: [false, 'Disponible', 'Disponible', 'Disponible'] },
    ],
  },
  {
    group: 'Soporte',
    rows: [
      { label: 'Soporte', values: ['Centro de ayuda', 'Correo', 'Correo + WhatsApp + demo', 'WhatsApp prioritario'] },
    ],
  },
]

const ORGANIZADOR_COMPARE: { group: string; rows: { label: string; sub?: string; values: Cell[] }[] }[] = [
  {
    group: 'Capacidad',
    rows: [
      { label: 'Eventos activos', sub: 'liberan slot al pasar el evento', values: ['10', '25', '60', 'Ilimitado'] },
      { label: 'Usuarios incluidos', values: ['1', '3', '10', 'Ilimitado'] },
      { label: 'Asiento extra', values: [false, `${formatMXN(SEAT_ADDON_MONTHLY)}/mes`, `${formatMXN(SEAT_ADDON_MONTHLY)}/mes`, 'Incluido'] },
      { label: 'Invitados por evento', values: ['Ilimitado', 'Ilimitado', 'Ilimitado', 'Ilimitado'] },
    ],
  },
  {
    group: 'Plataforma (por evento)',
    rows: [
      { label: 'Invitados, mesas con canvas, timeline ligado', values: [true, true, true, true] },
      { label: 'Presupuesto, proveedores y pagos', values: [true, true, true, true] },
      { label: 'Exportar todo (Excel/PDF)', values: [true, true, true, true] },
      { label: 'Agente de WhatsApp', values: ['Disponible', 'Disponible', 'Disponible', 'Incluido'] },
    ],
  },
  {
    group: 'Marca y escala',
    rows: [
      { label: 'White-label (tu logo y dominio)', values: [false, false, '100%', '100%'] },
      { label: 'API y SLA', values: [false, false, false, true] },
      { label: 'Soporte', values: ['Correo', 'Prioritario', 'Gerente de cuenta', 'Dedicado + SLA'] },
    ],
  },
]

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto h-[18px] w-[18px] text-[#48C9B0]" strokeWidth={3} />
  if (value === false) return <Minus className="mx-auto h-[18px] w-[18px] text-[#cccccc]" strokeWidth={2.5} />
  return <span className="text-[#444]">{value}</span>
}

export default function PreciosClient({ initialVista }: { initialVista: Vista }) {
  const router = useRouter()
  const [vista, setVista] = useState<Vista>(initialVista)
  const [billing, setBilling] = useState<Billing>('mensual')
  const [founder, setFounder] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login')
  const [authRedirect, setAuthRedirect] = useState('/dashboard')
  const [salesOpen, setSalesOpen] = useState(false)

  const openLogin = () => { setAuthRedirect('/dashboard'); setAuthTab('login'); setAuthOpen(true) }
  const openRegister = () => { setAuthRedirect('/dashboard'); setAuthTab('register'); setAuthOpen(true) }
  const openSales = () => setSalesOpen(true)

  // Unico punto que cambia cuando llegue Stripe real: en vez de navegar al mock,
  // hara fetch('/api/checkout') + redirect a la sesion hospedada de Stripe.
  const goToCheckout = async (tipo: Vista, plan: string, billingParam?: Billing) => {
    const params = new URLSearchParams({ tipo, plan })
    if (billingParam) params.set('billing', billingParam)
    const url = `/checkout?${params.toString()}`
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      router.push(url)
    } else {
      setAuthRedirect(url)
      setAuthTab('register')
      setAuthOpen(true)
    }
  }

  const setVistaUrl = (v: Vista) => {
    setVista(v)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/precios?vista=${v}`)
    }
  }

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[#f0ede8] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="shrink-0">
            <img src="/images/isotipoylogo.svg" alt="Anfiora" className="h-8" />
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <Link href="/#features" className="text-sm text-[#888] transition hover:text-[#1D1E20]">Features</Link>
            <Link href="/#compare" className="text-sm text-[#888] transition hover:text-[#1D1E20]">Comparativa</Link>
            <Link href="/precios" className="text-sm font-semibold text-[#1D1E20]">Precios</Link>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openLogin}
              className="rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
              Iniciar sesión
            </button>
            <button onClick={openRegister}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
              Empieza gratis
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-5 pb-24">
        {/* hero */}
        <div className="pt-10 text-center sm:pt-14">
          <h1 className="mx-auto max-w-5xl text-3xl font-extrabold tracking-tight text-[#0a0a0a] sm:text-4xl lg:whitespace-nowrap">
            {vista === 'anfitrion' ? 'Todo tu evento, en un solo lugar' : 'El sistema operativo de tu negocio de eventos'}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-[#666]">
            {vista === 'anfitrion'
              ? 'Invitados, mesas, presupuesto, proveedores y recuerdos. Paga una vez por tu evento. Sin mensualidades.'
              : 'Gestiona todos tus clientes y eventos desde un lugar, con tu equipo. Prueba 14 días, todo desbloqueado.'}
          </p>

          {/* two-door toggle */}
          <div className="mt-6 inline-flex gap-1 rounded-xl bg-[#f2f2f2] p-1">
            <button onClick={() => setVistaUrl('anfitrion')}
              className={`rounded-lg px-5 py-2.5 text-sm transition ${vista === 'anfitrion' ? 'bg-white font-semibold text-[#0a0a0a] shadow-sm' : 'text-[#666]'}`}>
              Soy anfitrión
            </button>
            <button onClick={() => setVistaUrl('organizador')}
              className={`rounded-lg px-5 py-2.5 text-sm transition ${vista === 'organizador' ? 'bg-white font-semibold text-[#0a0a0a] shadow-sm' : 'text-[#666]'}`}>
              Soy planner
            </button>
          </div>

          {vista === 'anfitrion' ? (
            <p className="mt-2.5 text-xs text-[#999]">Organizas <strong>un</strong> evento propio. Pago único, acceso por 12 meses.</p>
          ) : (
            <div className="mt-4 flex items-center justify-center gap-2.5 text-[13px] text-[#666]">
              <span className={billing === 'mensual' ? 'font-semibold text-[#0a0a0a]' : ''}>Mensual</span>
              <button onClick={() => setBilling(b => (b === 'mensual' ? 'anual' : 'mensual'))}
                className={`relative h-[22px] w-10 rounded-full transition ${billing === 'anual' ? 'bg-[#48C9B0]' : 'bg-[#ddd]'}`}>
                <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${billing === 'anual' ? 'left-5' : 'left-[2px]'}`} />
              </button>
              <span className={billing === 'anual' ? 'font-semibold text-[#0a0a0a]' : ''}>Anual <span className="font-bold text-[#2a7a50]">−20%</span></span>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={vista}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {vista === 'anfitrion' ? (
              <AnfitrionView openRegister={openRegister} goToCheckout={goToCheckout} />
            ) : (
              <OrganizadorView openSales={openSales} goToCheckout={goToCheckout} billing={billing} founder={founder} onToggleFounder={() => setFounder(f => !f)} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} redirectTo={authRedirect} />
      <ContactSalesModal isOpen={salesOpen} onClose={() => setSalesOpen(false)} plan={vista} />
    </>
  )
}

function PlanCardShell({ children, className = 'bg-white border-[#e8e8e8]' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col rounded-2xl border p-5 ${className}`}>{children}</div>
}

function Bullets({ items, check = 'text-[#48C9B0]', text = 'text-[#444]' }: { items: string[]; check?: string; text?: string }) {
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {items.map((b, i) => (
        <li key={i} className={`flex gap-2 text-[12.5px] leading-snug ${text}`}>
          <Check className={`mt-[1px] h-[15px] w-[15px] shrink-0 ${check}`} strokeWidth={3} />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  )
}

function CollapsibleCompare({ title, subtitle, groups, cols }: {
  title: string; subtitle: string; groups: typeof ANFITRION_COMPARE; cols: CompareCol[]
}) {
  const [open, setOpen] = useState(false)
  const [clip, setClip] = useState(true)
  return (
    <div className="mt-12 text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-[#999]">{subtitle}</p>
      <button onClick={() => setOpen(o => !o)}
        className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm font-semibold text-[#555] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
        {open ? 'Ocultar comparación' : 'Comparar todos los planes'}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            onAnimationStart={() => setClip(true)}
            onAnimationComplete={() => setClip(false)}
            className={`text-left ${clip ? 'overflow-hidden' : ''}`}
          >
            <ComparisonTable groups={groups} cols={cols} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ComparisonTable({ groups, cols }: { groups: typeof ANFITRION_COMPARE; cols: CompareCol[] }) {
  return (
    <div className="mt-7 overflow-x-auto md:overflow-x-visible">
      <table className="w-full min-w-[640px] table-fixed border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className="sticky top-16 z-20 w-[40%] border-b-2 border-[#e0e0e0] bg-white py-2.5 text-left" />
            {cols.map(c => (
              <th key={c.label} className="sticky top-16 z-20 border-b-2 border-[#e0e0e0] bg-white px-1.5 py-2.5 align-top text-center">
                <div className="font-bold text-[#0a0a0a]">{c.label}</div>
                {c.cta && (
                  <button onClick={c.cta.onClick}
                    className={`mx-auto mt-1.5 block w-full max-w-[110px] rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                      c.cta.variant === 'solid'
                        ? 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]'
                        : 'border border-[#1D1E20] text-[#1D1E20] hover:bg-[#1D1E20] hover:text-white'
                    }`}>
                    {c.cta.text}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-[#444]">
          {groups.map(g => (
            <FragmentGroup key={g.group} group={g} colCount={cols.length} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FragmentGroup({ group, colCount }: { group: typeof ANFITRION_COMPARE[number]; colCount: number }) {
  return (
    <>
      <tr className="bg-[#f2f2f2]">
        <td colSpan={colCount + 1} className="px-2 py-2 text-[11.5px] font-bold uppercase tracking-wide text-[#0a0a0a]">
          {group.group}
        </td>
      </tr>
      {group.rows.map((r, i) => (
        <tr key={i} className="border-b border-[#f2f2f2]">
          <td className="px-2 py-2.5">
            <span className="font-medium text-[#0a0a0a]">{r.label}</span>
            {r.sub && <span className="block text-[11px] text-[#999]">{r.sub}</span>}
          </td>
          {r.values.map((v, j) => (
            <td key={j} className="px-1.5 py-2.5 text-center">
              <CellValue value={v} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// Showcase del agente WhatsApp (feature estrella). `availability` cambia segun la vista.
function WhatsappShowcase({ availability }: { availability: ReactNode }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#cdeee2] bg-gradient-to-br from-[#f0fff8] to-[#e7faf1] shadow-sm">
      <div className="grid gap-6 p-6 sm:grid-cols-[1.1fr_0.9fr] sm:gap-8 sm:p-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] shadow-sm">
              <FaWhatsapp className="h-6 w-6 text-white" />
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-[#1f8f74]">Lo que más enamora a nuestros clientes</div>
              <div className="text-[20px] font-extrabold leading-tight text-[#0a0a0a]">Confirma a tus invitados por WhatsApp, solo</div>
            </div>
          </div>
          <p className="mt-3.5 text-[13.5px] leading-relaxed text-[#555]">
            ¿Cansado de perseguir uno por uno para saber quién va? Tu asistente les escribe por WhatsApp, resuelve sus dudas con inteligencia artificial y va anotando a quién confirma. Tú solo ves tu lista llenarse, sin mover un dedo.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              'Confirma y recuerda por ti, automático',
              'Plantillas listas: personaliza y envía',
              'Resuelve dudas de tus invitados con IA',
              'Hasta 5,000 mensajes incluidos',
            ].map((x, i) => (
              <li key={i} className="flex items-center gap-2 text-[12.5px] font-medium text-[#3f6157]">
                <Check className="h-[14px] w-[14px] shrink-0 text-[#1f8f74]" strokeWidth={3} />{x}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11.5px] text-[#777]">{availability}</p>
          <p className="mt-1 text-[10.5px] text-[#aaa]">Mensajería sujeta a plantillas aprobadas y políticas de WhatsApp.</p>
        </div>
        <div className="flex flex-col justify-center gap-2 rounded-2xl border border-[#d8efe6] bg-white p-4">
          <div className="max-w-[90%] self-start rounded-2xl rounded-tl-sm bg-[#f0f2f5] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#1d2b24] shadow-sm">
            <p>¡Hola María!</p>
            <p className="mt-1.5">Con mucha ilusión <strong className="font-semibold">Frida &amp; Phillip</strong> te invitan a su boda el <strong className="font-semibold">12 de octubre de 2027</strong> a las 5:00 pm en Hacienda San Miguel.</p>
            <p className="mt-1.5">Confirma tu asistencia por aquí, porfa.</p>
          </div>
          <div className="max-w-[88%] self-end rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3.5 py-2 text-[12px] leading-snug text-[#1d2b24] shadow-sm">
            Sí, ahí estaré con mi esposo
          </div>
          <div className="max-w-[88%] self-start rounded-2xl rounded-tl-sm bg-[#f0f2f5] px-3.5 py-2 text-[12px] leading-snug text-[#1d2b24] shadow-sm">
            Listo, te anoté a 2 personas. Gracias por confirmar.
          </div>
          <div className="mt-1 flex items-center gap-1.5 self-center text-[10px] font-semibold text-[#9aa8a0]">
            <FaWhatsapp className="h-3 w-3 text-[#25D366]" /> Respondido automático con IA
          </div>
        </div>
      </div>
    </div>
  )
}

function AnfitrionView({ openRegister, goToCheckout }: { openRegister: () => void; goToCheckout: (tipo: Vista, plan: string, billing?: Billing) => void }) {
  const compareCols: CompareCol[] = ANFITRION_PLANS.map((p): CompareCol => ({
    label: p.name,
    cta: {
      text: p.id === 'free' ? 'Gratis' : 'Elegir',
      onClick: p.id === 'free' ? openRegister : () => goToCheckout('anfitrion', p.id),
      variant: p.id === 'free' ? 'outline' : 'solid',
    },
  }))
  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ANFITRION_PLANS.map(p => {
          const t = ANFITRION_THEME[p.id]
          return (
            <PlanCardShell key={p.id} className={t.card}>
              <div className={`text-base font-bold ${t.name}`}>{p.name}</div>
              <div className={`mb-2 mt-0.5 text-xs ${t.tagline}`}>{p.tagline}</div>
              <div className={`text-[28px] font-extrabold ${t.price}`}>{p.price === 0 ? '$0' : formatMXN(p.price)}</div>
              <div className={`mb-3.5 text-xs ${t.sub}`}>
                hasta {p.guestLimit} invitados{p.price > 0 ? ' · pago único' : ''}
              </div>
              <button
                onClick={p.id === 'free' ? openRegister : () => goToCheckout('anfitrion', p.id)}
                className={`mb-4 rounded-[10px] py-2.5 text-[13px] font-semibold transition ${t.cta}`}>
                {p.cta}
              </button>
              <div className={`mb-2 text-[11px] font-bold tracking-wide ${t.divider}`}>
                {p.id === 'free' ? 'INCLUYE' : `TODO LO DE ${p.id === 'esencial' ? 'FREE' : p.id === 'pro' ? 'ESENCIAL' : 'PRO'}, Y`}
              </div>
              <Bullets items={p.bullets} check={t.check} text={t.bulletText} />
              <div className={`mt-auto pt-3.5 text-[11.5px] ${t.support}`}>Soporte: {p.support}</div>
            </PlanCardShell>
          )
        })}
      </div>

      {/* sin limites - anfitrion (pago unico, invitados ilimitados) */}
      <motion.button
        onClick={() => goToCheckout('anfitrion', 'ilimitado')}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="group mt-3 flex w-full items-center justify-between gap-4 rounded-xl border border-[#2a2b2e] bg-[#1D1E20] px-5 py-4 text-left shadow-sm transition-shadow hover:shadow-xl"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-white">Sin Límites</span>
            <span className="rounded-full bg-[#48C9B0] px-2 py-[2px] text-[10px] font-bold tracking-wide text-white">INVITADOS ILIMITADOS</span>
          </div>
          <div className="mt-0.5 text-xs text-white/60">Para bodas y eventos de más de 500 invitados. Pago único.</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-lg font-extrabold text-white">{formatMXN(ANFITRION_ILIMITADO.price)}</span>
          <span className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2 text-[13px] font-semibold text-white transition group-hover:bg-[#3ab89f]">
            Elegir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </motion.button>

      {/* showcase del agente WhatsApp (feature estrella) */}
      <WhatsappShowcase availability={<><strong className="text-[#1f8f74]">Incluido</strong> en Gran Anfitrión y Sin Límites; <strong className="text-[#1f8f74]">add-on</strong> en Esencial y Pro.</>} />

      {/* salto free -> pago */}
      <div className="mt-7 overflow-hidden rounded-2xl border border-[#a0e0c0]">
        <div className="border-b border-[#d6f0e6] bg-[#f0fff6] px-5 py-3 text-sm font-bold text-[#0a0a0a]">
          Al pasar de Free a un plan de pago, desbloqueas
        </div>
        <div className="grid grid-cols-1 gap-px bg-[#d6f0e6] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Más invitados', d: 'De 50 hasta 150, 300 o 500 invitados con sus acompañantes.' },
            { t: 'Exportar a Excel y PDF', d: 'Lista, acomodo de mesas, presupuesto y pagos listos para descargar.' },
            { t: 'Agente de WhatsApp', d: 'Disponible dentro de la app en los planes de pago: tus invitados confirman solos por chat.' },
            { t: 'Soporte humano', d: 'Correo en Esencial; WhatsApp y mini demo guiada desde Pro.' },
          ].map(x => (
            <div key={x.t} className="bg-white px-4 py-4">
              <div className="mb-1 text-[13.5px] font-bold">{x.t}</div>
              <div className="text-xs leading-relaxed text-[#666]">{x.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* comparativa */}
      <CollapsibleCompare
        title="Todo lo que puedes hacer con Anfiora"
        subtitle="No es una lista de invitados. Es el control completo de tu evento."
        groups={ANFITRION_COMPARE}
        cols={compareCols}
      />
    </>
  )
}

function OrganizadorView({ openSales, goToCheckout, billing, founder, onToggleFounder }: { openSales: () => void; goToCheckout: (tipo: Vista, plan: string, billing?: Billing) => void; billing: Billing; founder: boolean; onToggleFounder: () => void }) {
  const compareCols: CompareCol[] = [
    ...ORGANIZADOR_PLANS.map((p): CompareCol => ({
      label: p.name,
      cta: { text: 'Probar', onClick: () => goToCheckout('organizador', p.id, billing), variant: 'solid' },
    })),
    { label: 'Sin Límites', cta: { text: 'Contacto', onClick: openSales, variant: 'outline' } },
  ]
  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ORGANIZADOR_PLANS.map(p => {
          const base = billing === 'anual' ? p.annualPrice : p.listMonthly
          const main = founder ? p.founderPrice : base
          const strike = founder || billing === 'anual' ? p.listMonthly : null
          const t = ORGANIZADOR_THEME[p.id]
          return (
            <PlanCardShell key={p.id} className={t.card}>
              <div className={`text-base font-bold ${t.name}`}>{p.name}</div>
              <div className={`mb-3 mt-0.5 text-xs ${t.tagline}`}>{p.tagline}</div>
              <div className="flex items-baseline gap-2">
                <div className={`text-[28px] font-extrabold ${t.priceMain}`}>{formatMXN(main)}</div>
                {strike && <div className={`text-sm line-through ${t.priceStrike}`}>{formatMXN(strike)}</div>}
              </div>
              <div className={`text-[11.5px] ${t.perMes}`}>/mes{(founder || billing === 'anual') ? ' · facturado anual' : ''}</div>
              {founder && (
                <div className={`my-2 self-start rounded-md border px-2 py-[3px] text-[10.5px] font-bold ${t.pill}`}>
                  −40% tu primer año
                </div>
              )}
              <button onClick={() => goToCheckout('organizador', p.id, billing)}
                className={`mb-3.5 ${founder ? 'mt-1' : 'mt-4'} rounded-[10px] py-2.5 text-[13px] font-semibold transition ${t.cta}`}>
                Iniciar prueba de 14 días
              </button>
              <Bullets items={p.bullets} check={t.check} text={t.bulletText} />
            </PlanCardShell>
          )
        })}

        {/* Sin Limites */}
        <div className="flex flex-col rounded-2xl border border-[#e4e4e4] bg-[#f2f2f2] p-5">
          <div className="text-base font-bold text-[#0a0a0a]">Sin Límites</div>
          <div className="mb-3 mt-0.5 text-xs text-[#888]">Operaciones grandes</div>
          <div className="text-2xl font-extrabold text-[#0a0a0a]">A medida</div>
          <div className="mb-6 text-[11.5px] text-[#888]">hablemos de tu volumen</div>
          <button onClick={openSales}
            className="mb-3.5 rounded-[10px] border border-[#1D1E20] py-2.5 text-center text-[13px] font-semibold text-[#1D1E20] transition hover:bg-[#1D1E20] hover:text-white">
            Contáctanos
          </button>
          <Bullets items={['Eventos y usuarios ilimitados', 'White-label + API + SLA']} />
        </div>
      </div>

      {/* promo programa fundador (debajo de los precios) */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="mt-5 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#48C9B0] px-6 py-5 shadow-sm sm:flex-row sm:items-center"
      >
        <div className="flex flex-col gap-1.5">
          <span className="w-fit rounded-full bg-white px-2.5 py-[3px] text-[11px] font-bold tracking-wide text-[#1f8f74]">PROGRAMA FUNDADOR</span>
          <div className="text-[15px] font-bold text-white">Sé de los primeros {FOUNDER_MAX} planners y baja −40% tu primer año.</div>
          <div className="text-xs text-white/80">Quedan {FOUNDER_REMAINING} de {FOUNDER_MAX} cupos · se aplica sobre el precio que elijas.</div>
        </div>
        <button
          onClick={onToggleFounder}
          className={`shrink-0 rounded-[10px] px-5 py-2.5 text-[13px] font-semibold transition ${founder ? 'bg-[#1D1E20] text-white' : 'bg-white text-[#1f8f74] hover:bg-white/90'}`}
        >
          {founder ? (
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4" strokeWidth={3} /> Precio fundador aplicado</span>
          ) : 'Aplicar −40% fundador'}
        </button>
      </motion.div>

      <p className="mx-auto mt-4 max-w-2xl text-center text-[12.5px] leading-relaxed text-[#666]">
        En anual se muestra el precio por mes facturado una vez al año. El descuento fundador (−40%) aplica el primer año; después renueva a precio de lista.
      </p>

      <CollapsibleCompare
        title="Compara los planes para planners"
        subtitle="Cada evento incluye toda la profundidad de Anfiora, sin topes de invitados."
        groups={ORGANIZADOR_COMPARE}
        cols={compareCols}
      />
    </>
  )
}
