'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Minus, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import AuthModal from '@/app/components/auth/AuthModal'
import ContactSalesModal from '@/app/components/ContactSalesModal'
import {
  ANFITRION_PLANS,
  ORGANIZADOR_PLANS,
  WHATSAPP_ADDON,
  FOUNDER_MAX,
  SEAT_ADDON_MONTHLY,
  founderMonthly,
  annualMonthly,
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
    card: 'bg-[#fdf8ee] border-[#f0e3c4]',
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
      { label: 'Agente IA por WhatsApp (add-on)', values: [false, 'Disponible', 'Disponible', 'Disponible'] },
    ],
  },
  {
    group: 'Soporte',
    rows: [
      { label: 'Atención', values: ['Centro de ayuda', 'Correo', 'Correo + WhatsApp + demo', 'WhatsApp prioritario'] },
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
      { label: 'Agente IA por WhatsApp', values: ['Disponible', 'Disponible', 'Disponible', 'Incluido'] },
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
  const [vista, setVista] = useState<Vista>(initialVista)
  const [billing, setBilling] = useState<Billing>('mensual')
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login')
  const [salesOpen, setSalesOpen] = useState(false)

  const openLogin = () => { setAuthTab('login'); setAuthOpen(true) }
  const openRegister = () => { setAuthTab('register'); setAuthOpen(true) }
  const openSales = () => setSalesOpen(true)

  const setVistaUrl = (v: Vista) => {
    setVista(v)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/precios?vista=${v}`)
    }
  }

  const anfitrionCols = ANFITRION_PLANS.map(p => p.name)
  const organizadorCols = [...ORGANIZADOR_PLANS.map(p => p.name), 'Sin Límites']

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-[#f0ede8] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="shrink-0">
            <img src="/images/isotipoylogo.svg" alt="Anfiora" className="h-8" />
          </Link>
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

      {vista === 'organizador' && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#1D1E20] px-5 py-2.5 text-center text-[13px] text-white">
          <span className="rounded-full bg-[#48C9B0] px-2.5 py-[3px] text-[11px] font-bold tracking-wide text-white">PROGRAMA FUNDADOR</span>
          <span><strong>−40% tu primer año.</strong> Para los primeros {FOUNDER_MAX} planners.</span>
          <span className="font-bold text-[#48C9B0]">Quedan {FOUNDER_REMAINING} de {FOUNDER_MAX} cupos</span>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-5 pb-24">
        {/* hero */}
        <div className="pt-10 text-center sm:pt-14">
          <h1 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-[#0a0a0a] sm:text-4xl">
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
            <p className="mt-2.5 text-xs text-[#999]">Organizas <strong>un</strong> evento propio. Pago único, acceso hasta 60 días después del evento.</p>
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

        {vista === 'anfitrion' ? (
          <AnfitrionView openRegister={openRegister} openSales={openSales} cols={anfitrionCols} />
        ) : (
          <OrganizadorView openRegister={openRegister} openSales={openSales} billing={billing} cols={organizadorCols} />
        )}
      </main>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
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
  title: string; subtitle: string; groups: typeof ANFITRION_COMPARE; cols: string[]
}) {
  const [open, setOpen] = useState(false)
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
            className="overflow-hidden text-left"
          >
            <ComparisonTable groups={groups} cols={cols} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ComparisonTable({ groups, cols }: { groups: typeof ANFITRION_COMPARE; cols: string[] }) {
  return (
    <div className="mt-7 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b-2 border-[#e0e0e0]">
            <th className="w-[42%] py-2.5 text-left" />
            {cols.map(c => (
              <th key={c} className="px-1.5 py-2.5 text-center font-bold text-[#0a0a0a]">{c}</th>
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
      <tr className="bg-[#f8f8f8]">
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

function AnfitrionView({ openRegister, openSales, cols }: { openRegister: () => void; openSales: () => void; cols: string[] }) {
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
                onClick={openRegister}
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

      {/* sin limites + addon */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-[#e4e4e4] bg-[#f2f2f2] px-4 py-3.5">
          <div>
            <div className="text-sm font-bold text-[#0a0a0a]">Sin Límites</div>
            <div className="text-xs text-[#888]">Más de 500 invitados</div>
          </div>
          <button onClick={openSales}
            className="rounded-lg border border-[#1D1E20] px-3.5 py-1.5 text-[13px] font-semibold text-[#1D1E20] transition hover:bg-[#1D1E20] hover:text-white">
            Contáctanos
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#a0e0c0] bg-[#f0fff6] px-4 py-3.5">
          <div>
            <div className="text-sm font-bold text-[#2a7a50]">Agente IA por WhatsApp</div>
            <div className="text-xs text-[#666]">Confirma a tus invitados solo. {formatMXN(WHATSAPP_ADDON.price)} / {WHATSAPP_ADDON.messages.toLocaleString('es-MX')} mensajes.</div>
          </div>
          <button onClick={openRegister} className="shrink-0 rounded-lg bg-[#48C9B0] px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#3ab89f]">
            Agregar
          </button>
        </div>
      </div>

      {/* salto free -> pago */}
      <div className="mt-7 overflow-hidden rounded-2xl border border-[#d4a853]">
        <div className="border-b border-[#f0e6cc] bg-[#fffbf0] px-5 py-3 text-sm font-bold text-[#0a0a0a]">
          Al pasar de Free a un plan de pago, desbloqueas
        </div>
        <div className="grid grid-cols-1 gap-px bg-[#f0e6cc] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Más invitados', d: 'De 50 hasta 150, 300 o 500 invitados con sus acompañantes.' },
            { t: 'Exportar a Excel y PDF', d: 'Lista, acomodo de mesas, presupuesto y pagos listos para descargar.' },
            { t: 'Agente IA por WhatsApp', d: 'Disponible como add-on: tus invitados confirman solos por chat.' },
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
        cols={cols}
      />
    </>
  )
}

function OrganizadorView({ openRegister, openSales, billing, cols }: { openRegister: () => void; openSales: () => void; billing: Billing; cols: string[] }) {
  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ORGANIZADOR_PLANS.map(p => {
          const base = billing === 'anual' ? annualMonthly(p.listMonthly) : p.listMonthly
          const founder = founderMonthly(base)
          const t = ORGANIZADOR_THEME[p.id]
          return (
            <PlanCardShell key={p.id} className={t.card}>
              <div className={`text-base font-bold ${t.name}`}>{p.name}</div>
              <div className={`mb-3 mt-0.5 text-xs ${t.tagline}`}>{p.tagline}</div>
              <div className="flex items-baseline gap-2">
                <div className={`text-[28px] font-extrabold ${t.priceMain}`}>{formatMXN(founder)}</div>
                <div className={`text-sm line-through ${t.priceStrike}`}>{formatMXN(base)}</div>
              </div>
              <div className={`text-[11.5px] ${t.perMes}`}>/mes{billing === 'anual' ? ' · facturado anual' : ''}</div>
              <div className={`my-2 self-start rounded-md border px-2 py-[3px] text-[10.5px] font-bold ${t.pill}`}>
                −40% tu primer año
              </div>
              <button onClick={openRegister}
                className={`mb-3.5 mt-1 rounded-[10px] py-2.5 text-[13px] font-semibold transition ${t.cta}`}>
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

      <p className="mx-auto mt-2 max-w-3xl text-center text-[11.5px] text-[#bbb]">
        En anual se muestra el precio por mes facturado una vez al año. El descuento fundador (−40%) aplica el primer año; después renueva a precio de lista.
      </p>

      <CollapsibleCompare
        title="Compara los planes para planners"
        subtitle="Cada evento incluye toda la profundidad de Anfiora, sin topes de invitados."
        groups={ORGANIZADOR_COMPARE}
        cols={cols}
      />
    </>
  )
}
