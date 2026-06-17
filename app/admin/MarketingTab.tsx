'use client'

import { useMemo, useState } from 'react'
import {
  TrendingUp, Target, Sparkles, UserCircle, PartyPopper, MapPin, Info, ArrowRight,
  Smartphone, Monitor, Tablet, HelpCircle,
} from 'lucide-react'
import { AdminUser } from './lib/types'

const ADMIN_EMAIL = 'diego.garza@moonlaunch.mx'
const N_MIN = 10

const SOURCES = ['viral', 'organico', 'meta', 'google', 'referido', 'directo'] as const
type Source = (typeof SOURCES)[number]
const SOURCE_LABEL: Record<Source, string> = {
  viral: 'Viral', organico: 'Organico', meta: 'Meta', google: 'Google', referido: 'Referido', directo: 'Directo',
}
const ZERO_CAC: Source[] = ['viral', 'organico', 'referido']

const DEVICE_META: Record<string, { label: string; icon: typeof Smartphone }> = {
  movil:   { label: 'Movil',   icon: Smartphone },
  desktop: { label: 'Desktop', icon: Monitor },
  tablet:  { label: 'Tablet',  icon: Tablet },
}
const ROLE_LABEL: Record<string, string> = { planner: 'Planner', anfitrion: 'Anfitrion' }

const FUNNEL_STEPS = ['Se registro', 'Creo evento', 'Agrego invitados', 'Paso a pago'] as const

function isPaying(u: AdminUser) { return u.plan === 'pro' || u.plan === 'agency' }

function Tile({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#e8e8e8] bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#999]">{t}</p>
      {children}
    </div>
  )
}
function Val({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[24px] font-extrabold leading-none tracking-tight text-[#1D1E20]">{children}</p>
}
function SectionTitle({ icon: Icon, children }: { icon: typeof Target; children: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#aaa]">
      <Icon size={13} /> {children}
    </p>
  )
}
function Dash() { return <span className="text-[#ccc]">—</span> }

function DistBlock({
  title, note, items, universe, icon,
}: {
  title: string; note: string
  items: { label: string; count: number; icon?: typeof Smartphone }[]
  universe: number; icon?: typeof Smartphone
}) {
  const total = items.reduce((a, i) => a + i.count, 0)
  return (
    <div className="rounded-[11px] border border-[#e8e8e8] bg-white p-3">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-xs font-bold text-[#1D1E20]">{title}</h4>
        <span className="text-[10px] font-semibold text-[#bbb]">{note}</span>
      </div>
      {universe < N_MIN ? (
        <div className="flex flex-col items-center justify-center py-5 text-center">
          <span className="text-[22px] font-extrabold text-[#ddd]">—</span>
          <p className="mt-1 text-[11px] text-[#bbb]">datos insuficientes ({universe}/{N_MIN})</p>
        </div>
      ) : (
        items.filter(i => i.count > 0).map(i => {
          const pct = Math.round((i.count / total) * 100)
          const Ic = i.icon || icon
          return (
            <div key={i.label} className="border-t border-[#f4f4f4] py-2 first:border-t-0">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1D1E20]">
                  {Ic && <Ic size={13} className="text-[#999]" />}{i.label}
                </span>
                <span className="text-xs font-bold text-[#1D1E20]">{pct}%</span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-[#f0f0f0]">
                <div className="h-full rounded-full bg-[#48C9B0]" style={{ width: pct + '%' }} />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export default function MarketingTab({ users }: { users: AdminUser[] }) {
  const [channel, setChannel] = useState<Source | 'todos'>('todos')

  const data = useMemo(() => {
    const real = users.filter(u => u.email !== ADMIN_EMAIL)
    const totalReg = real.length
    const totalPagan = real.filter(isPaying).length

    const channels = SOURCES.map(src => {
      const regs = real.filter(u => u.acquisition_source === src)
      const pagan = regs.filter(isPaying).length
      return { src, registros: regs.length, pagan }
    })
    const sinDato = real.filter(u => !u.acquisition_source).length

    const starChannel = [...channels].filter(c => c.pagan > 0).sort((a, b) => b.pagan - a.pagan)[0]

    const withDevice = real.filter(u => u.device_type)
    const deviceItems = Object.keys(DEVICE_META).map(k => ({
      label: DEVICE_META[k].label, icon: DEVICE_META[k].icon,
      count: withDevice.filter(u => u.device_type === k).length,
    }))

    const withRole = real.filter(u => u.role)
    const roleItems = ['anfitrion', 'planner'].map(k => ({
      label: ROLE_LABEL[k], count: withRole.filter(u => u.role === k).length,
    }))

    const withFocus = real.filter(u => Array.isArray(u.event_focus) && u.event_focus.length > 0)
    const focusCounts: Record<string, number> = {}
    for (const u of withFocus) for (const f of u.event_focus!) focusCounts[f] = (focusCounts[f] || 0) + 1
    const focusItems = Object.entries(focusCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([label, count]) => ({ label, count }))

    const recientes = real.slice(0, 15)

    return {
      real, totalReg, totalPagan, channels, sinDato, starChannel,
      withDevice, deviceItems, withRole, roleItems, withFocus, focusItems, recientes,
    }
  }, [users])

  const funnel = useMemo(() => {
    const base = channel === 'todos' ? data.real : data.real.filter(u => u.acquisition_source === channel)
    const counts = [
      base.length,
      base.filter(u => u.event_count > 0).length,
      base.filter(u => u.total_count > 0).length,
      base.filter(isPaying).length,
    ]
    return { base: base.length, counts }
  }, [channel, data.real])

  const convGlobal = data.totalReg >= N_MIN
    ? ((data.totalPagan / data.totalReg) * 100).toFixed(1) + '%'
    : null

  return (
    <div>
      <SectionTitle icon={TrendingUp}>Indicadores</SectionTitle>
      <div className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile t="Registros">
          <Val>{data.totalReg}</Val>
          <p className="mt-1 text-[11px] font-semibold text-[#bbb]">excluye superadmin</p>
        </Tile>
        <Tile t="Conversion a pago">
          <Val>{convGlobal ?? <Dash />}</Val>
          <p className="mt-1 text-[11px] font-semibold text-[#bbb]">{data.totalPagan}/{data.totalReg} pagan</p>
        </Tile>
        <Tile t="CAC pagado">
          <div className="flex items-end gap-1.5">
            <Val><Dash /></Val>
            <span className="mb-0.5 rounded bg-[#f0f0f0] px-1.5 py-0.5 text-[9px] font-bold text-[#999]">FASE 2</span>
          </div>
          <p className="mt-1 text-[11px] font-semibold text-[#bbb]">requiere registrar gasto</p>
        </Tile>
        <Tile t="Canal estrella">
          {data.starChannel
            ? <>
                <p className="mt-1 flex items-center gap-1 text-[20px] font-extrabold leading-none text-[#1D1E20]">
                  <Sparkles size={16} className="text-[#48C9B0]" /> {SOURCE_LABEL[data.starChannel.src]}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold text-[#bbb]">{data.starChannel.pagan} pagan</p>
              </>
            : <><Val><Dash /></Val><p className="mt-1 text-[11px] font-semibold text-[#bbb]">sin pagos aun</p></>}
        </Tile>
      </div>

      <SectionTitle icon={Target}>De donde vienen</SectionTitle>
      <div className="mb-5 overflow-hidden rounded-[11px] border border-[#e8e8e8] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#eee] text-left text-[10px] font-bold uppercase tracking-wide text-[#999]">
              <th className="px-4 py-2.5">Canal</th>
              <th className="px-4 py-2.5 text-right">Registros</th>
              <th className="px-4 py-2.5 text-right">Pagan</th>
              <th className="px-4 py-2.5 text-right">Conversion</th>
              <th className="px-4 py-2.5 text-right">CAC</th>
            </tr>
          </thead>
          <tbody>
            {data.channels.map(c => {
              const insuf = c.registros < N_MIN
              return (
                <tr key={c.src} className="border-t border-[#f4f4f4] first:border-t-0">
                  <td className="px-4 py-2.5 font-semibold text-[#1D1E20]">{SOURCE_LABEL[c.src]}</td>
                  <td className="px-4 py-2.5 text-right text-[#555]">{c.registros}</td>
                  <td className="px-4 py-2.5 text-right text-[#555]">{c.pagan}</td>
                  <td className="px-4 py-2.5 text-right">
                    {insuf ? <Dash /> : <span className="font-semibold text-[#1D1E20]">{((c.pagan / c.registros) * 100).toFixed(1)}%</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {ZERO_CAC.includes(c.src)
                      ? <span className="rounded-full bg-[#e8faf6] px-2 py-0.5 text-[11px] font-bold text-[#1a7a60]">$0</span>
                      : <span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-[10px] font-bold text-[#999]">FASE 2</span>}
                  </td>
                </tr>
              )
            })}
            {data.sinDato > 0 && (
              <tr className="border-t border-[#f4f4f4] bg-[#fafafa]">
                <td className="px-4 py-2.5 font-semibold text-[#bbb]">Sin dato (previos a la captura)</td>
                <td className="px-4 py-2.5 text-right text-[#bbb]">{data.sinDato}</td>
                <td className="px-4 py-2.5 text-right text-[#bbb]">—</td>
                <td className="px-4 py-2.5 text-right"><Dash /></td>
                <td className="px-4 py-2.5 text-right"><Dash /></td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-start gap-1.5 border-t border-[#f4f4f4] bg-[#fafafa] px-4 py-2 text-[11px] text-[#999]">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>Viral = llego por un enlace compartido de Anfiora (playlist, invitacion o album) — el bucle boca a boca. Conversion en <span className="text-[#ccc]">—</span> cuando el canal tiene menos de {N_MIN} registros. CAC de canales pagados llega en Fase 2; viral, organico y referido siempre $0.</span>
        </div>
      </div>

      <SectionTitle icon={UserCircle}>Quienes son</SectionTitle>
      <div className="mb-5 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
        <DistBlock
          title="Dispositivo"
          note={`${data.withDevice.length}/${data.real.length} con dato`}
          items={data.deviceItems}
          universe={data.withDevice.length}
        />
        <DistBlock
          title="Rol"
          note={`${data.withRole.length}/${data.real.length} con dato`}
          items={data.roleItems}
          universe={data.withRole.length}
          icon={UserCircle}
        />
        <DistBlock
          title="Tipo de evento"
          note={`${data.withFocus.length}/${data.real.length} con dato`}
          items={data.focusItems}
          universe={data.withFocus.length}
          icon={PartyPopper}
        />
        <div className="flex flex-col rounded-[11px] border border-dashed border-[#ddd] bg-white p-3">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="flex items-center gap-1 text-xs font-bold text-[#999]"><MapPin size={13} /> Ciudad</h4>
            <span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-[9px] font-bold text-[#999]">FASE 2</span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
            <span className="text-[28px] font-extrabold text-[#ddd]">—</span>
            <p className="mt-1 text-[11px] text-[#bbb]">Requiere geo server-side<br />(sin guardar IP cruda)</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={TrendingUp}>Embudo de activacion</SectionTitle>
        <select
          value={channel}
          onChange={e => setChannel(e.target.value as Source | 'todos')}
          className="mb-2 rounded-lg bg-[#1D1E20] px-3 py-1.5 text-xs font-medium text-white outline-none"
        >
          <option value="todos">Todos los canales</option>
          {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </select>
      </div>
      <div className="mb-5 rounded-[11px] border border-[#e8e8e8] bg-white p-4">
        {funnel.base === 0 ? (
          <div className="flex items-center gap-2 py-6 text-center text-sm text-[#bbb]">
            <Info size={15} /> Sin registros en este canal todavia.
          </div>
        ) : (
          <div className="space-y-2.5">
            {FUNNEL_STEPS.map((step, i) => {
              const v = funnel.counts[i]
              const top = funnel.counts[0] || 1
              const pctOfTop = Math.round((v / top) * 100)
              const pctOfPrev = i === 0 ? null : Math.round((v / (funnel.counts[i - 1] || 1)) * 100)
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className="flex w-40 shrink-0 items-center gap-1.5 text-xs font-semibold text-[#1D1E20]">
                    {i > 0 && <ArrowRight size={12} className="text-[#ccc]" />}{step}
                  </div>
                  <div className="h-7 flex-1 overflow-hidden rounded-md bg-[#f4f4f4]">
                    <div className="flex h-full items-center rounded-md bg-[#48C9B0] px-2 text-[11px] font-bold text-white transition-all"
                      style={{ width: Math.max(pctOfTop, 8) + '%' }}>{v}</div>
                  </div>
                  <span className="w-12 shrink-0 text-right text-[11px] font-semibold text-[#999]">
                    {funnel.base >= N_MIN && pctOfPrev !== null ? pctOfPrev + '%' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        {funnel.base > 0 && funnel.base < N_MIN && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#bbb]">
            <Info size={12} /> Porcentajes ocultos por muestra baja (n&lt;{N_MIN}); se muestran los conteos.
          </p>
        )}
      </div>

      <SectionTitle icon={HelpCircle}>Altas recientes (verificacion de captura)</SectionTitle>
      <div className="overflow-hidden rounded-[11px] border border-[#e8e8e8] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#eee] text-left text-[10px] font-bold uppercase tracking-wide text-[#999]">
              <th className="px-4 py-2.5">Usuario</th>
              <th className="px-4 py-2.5">Origen</th>
              <th className="px-4 py-2.5">Dispositivo</th>
              <th className="px-4 py-2.5">Campaña</th>
              <th className="px-4 py-2.5">Referrer</th>
            </tr>
          </thead>
          <tbody>
            {data.recientes.map(u => (
              <tr key={u.id} className="border-t border-[#f4f4f4] first:border-t-0">
                <td className="px-4 py-2.5">
                  <div className="truncate text-xs font-semibold text-[#1D1E20]">{u.full_name || u.email}</div>
                  <div className="text-[10px] text-[#aaa]">{u.created_at?.slice(0, 10)}</div>
                </td>
                <td className="px-4 py-2.5">
                  {u.acquisition_source
                    ? <span className="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[11px] font-semibold text-[#555]">{u.acquisition_source}</span>
                    : <Dash />}
                </td>
                <td className="px-4 py-2.5 text-xs text-[#555]">{u.device_type || <Dash />}</td>
                <td className="px-4 py-2.5 text-xs text-[#555]">{u.utm_campaign || <Dash />}</td>
                <td className="px-4 py-2.5 text-xs text-[#555]">{u.referrer_domain || <Dash />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
