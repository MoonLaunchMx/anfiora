'use client'

import { useEffect, useState } from 'react'
import {
  X, LayoutList, User, Building2, AlertTriangle,
  Bell, Clock, Gift, Link2, Coins, Landmark, Heart, LucideIcon,
  SlidersHorizontal, Sparkles, Settings2, UtensilsCrossed,
  LayoutGrid, Images, Music2, Download, ListMusic,
} from 'lucide-react'
import { CURRENT_VERSION, changelog, Release } from '@/lib/changelog'
import { Modal } from '@/app/components/ui/Modal'

const STORAGE_KEY = 'anfiora_seen_version'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutList, User, Building2, AlertTriangle, Bell, Clock, Gift, Link2, Coins, Landmark, Heart,
  SlidersHorizontal, Sparkles, Settings2, UtensilsCrossed, Music2, Download, ListMusic,
}

function HerramientasMockup() {
  const rows: { icon: LucideIcon; label: string; on: boolean }[] = [
    { icon: LayoutGrid,      label: 'Mesas y check-in',      on: true },
    { icon: Gift,            label: 'Mesa de regalos',        on: true },
    { icon: Images,          label: 'Álbum de fotos',         on: true },
    { icon: Music2,          label: 'Playlist',               on: false },
    { icon: UtensilsCrossed, label: 'Planificador de comida', on: false },
  ]
  return (
    <div className="h-full w-full overflow-hidden rounded-l-2xl bg-[#FBF7F0]">
      <div className="flex items-center gap-1.5 border-b border-[#eee4d6] bg-[#F5EFE3] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#ff6b6b]" />
        <span className="h-2 w-2 rounded-full bg-[#ffd93d]" />
        <span className="h-2 w-2 rounded-full bg-[#6bcb77]" />
        <span className="ml-2 text-[9px] text-[#aaa]">anfiora.com · Nuevo evento</span>
      </div>

      <div className="px-4 pb-2 pt-4">
        <p className="text-[7px] uppercase tracking-[0.25em] text-[#bbb]">Paso 3</p>
        <p className="mt-0.5 text-[13px] font-bold text-[#1D1E20]">Activa tus herramientas</p>
      </div>

      <div className="flex flex-col gap-1.5 px-4 pb-4">
        {rows.map(r => {
          const Icon = r.icon
          return (
            <div
              key={r.label}
              className={
                'flex items-center gap-2 rounded-lg border px-2.5 py-2 ' +
                (r.on ? 'border-[#c8ede7] bg-[#f0fdfb]' : 'border-[#eee4d6] bg-white')
              }
            >
              <Icon size={12} className={r.on ? 'text-[#0F6E56]' : 'text-[#bbb]'} />
              <span className={'flex-1 text-[9px] font-medium ' + (r.on ? 'text-[#1D1E20]' : 'text-[#aaa]')}>
                {r.label}
              </span>
              <span className={'relative h-3 w-6 rounded-full ' + (r.on ? 'bg-[#48C9B0]' : 'bg-[#e0e0e0]')}>
                <span className={'absolute top-0.5 h-2 w-2 rounded-full bg-white ' + (r.on ? 'left-3.5' : 'left-0.5')} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MesaRegalosMockup() {
  return (
    <div className="h-full w-full overflow-hidden rounded-l-2xl bg-[#FBF7F0]">
      <div className="flex items-center gap-1.5 border-b border-[#eee4d6] bg-[#F5EFE3] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#ff6b6b]" />
        <span className="h-2 w-2 rounded-full bg-[#ffd93d]" />
        <span className="h-2 w-2 rounded-full bg-[#6bcb77]" />
        <span className="ml-2 text-[9px] text-[#aaa]">anfiora.com · Mesa de regalos</span>
      </div>

      <div className="px-3 pb-2 pt-3 text-center">
        <p className="text-[7px] uppercase tracking-[0.25em] text-[#bbb]">Mesa de regalos</p>
        <p className="mt-0.5 text-[14px] font-bold text-[#1D1E20]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
          Ana &amp; Diego
        </p>
        <p className="mt-0.5 text-[7px] text-[#999]">14 de noviembre de 2026</p>
      </div>

      <div className="space-y-2 px-3">
        {/* Regalo de tienda */}
        <div className="flex gap-2 rounded-lg border border-[#eee4d6] bg-white p-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f0fdfb] text-[#48C9B0]">
            <Gift size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[6px] uppercase tracking-wider text-[#aaa]">Liverpool</p>
            <p className="truncate text-[9px] font-semibold text-[#1D1E20]">Batidora KitchenAid Artisan</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[8px] font-semibold tabular-nums text-[#1D1E20]">$ 8,999</span>
              <span className="rounded-full bg-[#48C9B0] px-2 py-0.5 text-[7px] font-semibold text-white">Lo regalo</span>
            </div>
          </div>
        </div>

        {/* Fondo con progreso */}
        <div className="flex gap-2 rounded-lg border border-[#eee4d6] bg-white p-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f0fdfb] text-[#48C9B0]">
            <Coins size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] font-semibold text-[#1D1E20]">Fondo luna de miel</p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#f0ece3]">
              <div className="h-full w-[64%] rounded-full bg-[#48C9B0]" />
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[7px] tabular-nums text-[#888]">$ 32,000 de $ 50,000</span>
              <span className="rounded-full bg-[#48C9B0] px-2 py-0.5 text-[7px] font-semibold text-white">Aportar</span>
            </div>
          </div>
        </div>

        {/* Sobre */}
        <div className="flex gap-2 rounded-lg border border-[#eee4d6] bg-white p-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f0fdfb] text-[#48C9B0]">
            <Heart size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] font-semibold text-[#1D1E20]">Sobre con cariño</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[7px] italic text-[#999]">Monto libre</span>
              <span className="rounded-full bg-[#48C9B0] px-2 py-0.5 text-[7px] font-semibold text-white">Dejar sobre</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineMockup() {
  return (
    <div className="h-full w-full overflow-hidden rounded-l-2xl bg-[#f8f5f0]">
      <div className="flex items-center gap-1.5 border-b border-[#e8e4de] bg-[#f0ede8] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#ff6b6b]" />
        <span className="h-2 w-2 rounded-full bg-[#ffd93d]" />
        <span className="h-2 w-2 rounded-full bg-[#6bcb77]" />
        <span className="ml-2 text-[9px] text-[#aaa]">anfiora.com · Timeline</span>
      </div>
      <div className="flex h-full">
        <div className="w-20 shrink-0 border-r border-[#e8e4de] bg-[#f8f5f0] p-2">
          {['Invitados','Mesas','Timeline','Presupuesto'].map((item, i) => (
            <div key={item} className={`mb-1 rounded px-1.5 py-1.5 text-[8px] truncate ${i === 2 ? 'bg-white font-semibold text-[#1D1E20]' : 'text-[#aaa]'}`}>
              {item}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-hidden p-3">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-[#aaa]">Junio 2026</p>

          {/* Tarea 1 — bloqueante, vencida */}
          <div className="mb-2 flex items-stretch">
            <div className="flex w-5 flex-col items-center">
              <div className="w-px flex-1 bg-[#e8e8e8]" />
              <div className="h-1.5 w-1.5 rounded-full bg-[#dc2626] flex-shrink-0" />
              <div className="w-px flex-1 bg-[#e8e8e8]" />
            </div>
            <div className="ml-1.5 flex-1 rounded-lg border border-[#e8e8e8] bg-white p-2">
              <div className="flex items-start justify-between gap-1 mb-1">
                <p className="text-[9px] font-medium text-[#1D1E20] leading-tight">Anticipo fotógrafo</p>
                <span className="flex-shrink-0 rounded bg-[#1D1E20] px-1 py-0.5 text-[7px] font-medium text-white flex items-center gap-0.5">
                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                  Bloqueante
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="flex items-center gap-0.5 text-[8px] font-medium text-[#dc2626]">
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  Vencida · 15 jun
                </span>
                <span className="text-[#e0e0e0] text-[7px]">·</span>
                <span className="flex items-center gap-0.5 text-[8px] text-[#48C9B0]">
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                  Focus Studio
                </span>
                <span className="text-[#e0e0e0] text-[7px]">·</span>
                <span className="flex items-center gap-0.5 text-[8px] text-[#888]">
                  <span className="flex h-3 w-3 items-center justify-center rounded-full bg-[#e0f7f2] text-[5px] font-semibold text-[#0F6E56]">DG</span>
                  Diego
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 border-t border-[#f5f5f5] pt-1">
                <span className="text-[7px] text-[#48C9B0] font-medium">Completar</span>
                <span className="text-[#e8e8e8] text-[7px]">|</span>
                <span className="text-[7px] text-[#aaa]">Reagendar</span>
                <span className="text-[#e8e8e8] text-[7px]">|</span>
                <span className="text-[7px] text-[#aaa]">Google Calendar</span>
              </div>
            </div>
          </div>

          {/* Tarea 2 — mañana */}
          <div className="mb-2 flex items-stretch">
            <div className="flex w-5 flex-col items-center">
              <div className="w-px flex-1 bg-[#e8e8e8]" />
              <div className="h-1.5 w-1.5 rounded-full bg-[#d97706] flex-shrink-0" />
              <div className="w-px flex-1 bg-[#e8e8e8]" />
            </div>
            <div className="ml-1.5 flex-1 rounded-lg border border-[#e8e8e8] bg-white p-2">
              <div className="mb-1">
                <p className="text-[9px] font-medium text-[#1D1E20] leading-tight">Reunión con venue</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="flex items-center gap-0.5 text-[8px] font-medium text-[#d97706]">
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  Mañana · 3 pm
                </span>
                <span className="text-[#e0e0e0] text-[7px]">·</span>
                <span className="flex items-center gap-0.5 text-[8px] text-[#48C9B0]">
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                  Hacienda San Gabriel
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 border-t border-[#f5f5f5] pt-1">
                <span className="text-[7px] text-[#48C9B0] font-medium">Completar</span>
                <span className="text-[#e8e8e8] text-[7px]">|</span>
                <span className="text-[7px] text-[#aaa]">Reagendar</span>
              </div>
            </div>
          </div>

          {/* Tarea 3 — completada */}
          <div className="flex items-stretch opacity-40">
            <div className="flex w-5 flex-col items-center">
              <div className="w-px flex-1 bg-[#e8e8e8]" />
              <div className="h-1.5 w-1.5 rounded-full bg-[#e8e8e8] flex-shrink-0" />
              <div className="w-px flex-1 bg-[#e8e8e8]" />
            </div>
            <div className="ml-1.5 flex-1 rounded-lg border border-[#e8e8e8] bg-white p-2">
              <p className="text-[9px] font-medium text-[#bbb] line-through leading-tight">Enviar invitaciones</p>
              <span className="text-[8px] text-[#bbb]">15 jun</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PlaylistMockup() {
  const guests: { initials: string; title: string; artist: string }[] = [
    { initials: 'MR', title: 'Tusa',            artist: 'Karol G, Nicki Minaj' },
    { initials: 'JL', title: 'La Bicicleta',    artist: 'Shakira, Carlos Vives' },
  ]
  return (
    <div className="h-full w-full overflow-hidden rounded-l-2xl bg-[#FBF7F0]">
      <div className="flex items-center gap-1.5 border-b border-[#eee4d6] bg-[#F5EFE3] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#ff6b6b]" />
        <span className="h-2 w-2 rounded-full bg-[#ffd93d]" />
        <span className="h-2 w-2 rounded-full bg-[#6bcb77]" />
        <span className="ml-2 text-[9px] text-[#aaa]">anfiora.com · Playlist</span>
      </div>

      <div className="px-3 pb-2 pt-3 text-center">
        <p className="text-[7px] uppercase tracking-[0.25em] text-[#bbb]">Playlist</p>
        <p className="mt-0.5 text-[14px] font-bold text-[#1D1E20]" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
          Ana &amp; Diego
        </p>
        <p className="mt-0.5 text-[7px] text-[#999]">24 canciones · 3 de los novios · 1h 38m</p>
      </div>

      <div className="space-y-2 px-3">
        {/* Cancion de los novios */}
        <div className="flex items-center gap-2 rounded-lg border border-[#c8ede7] bg-[#f0fdfb] p-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-[#48C9B0]">
            <Heart size={13} fill="currentColor" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] font-semibold text-[#1D1E20]">Perfect</p>
            <p className="truncate text-[7px] text-[#999]">Ed Sheeran</p>
          </div>
          <span className="rounded-full bg-[#48C9B0] px-2 py-0.5 text-[7px] font-semibold text-white">De los novios</span>
        </div>

        {/* Canciones de invitados */}
        {guests.map(g => (
          <div key={g.title} className="flex items-center gap-2 rounded-lg border border-[#eee4d6] bg-white p-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0ece3] text-[7px] font-semibold text-[#999]">
              {g.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-semibold text-[#1D1E20]">{g.title}</p>
              <p className="truncate text-[7px] text-[#999]">{g.artist}</p>
            </div>
            <Music2 size={11} className="shrink-0 text-[#ccc]" />
          </div>
        ))}

        {/* Footer: exportar DJ */}
        <div className="flex items-center justify-between rounded-lg bg-[#1D1E20] px-2.5 py-1.5">
          <span className="flex items-center gap-1 text-[8px] font-medium text-white">
            <Download size={10} /> Descargar para DJ
          </span>
          <span className="text-[7px] text-[#999]">Excel · PDF · M3U</span>
        </div>
      </div>
    </div>
  )
}

export function WhatsNewModal() {
  const [release, setRelease] = useState<Release | null>(null)

  useEffect(() => {
    const seen  = localStorage.getItem(STORAGE_KEY)
    const isNew = localStorage.getItem('gf_welcomed')
    if (!isNew) {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
      return
    }
    if (seen === CURRENT_VERSION) return
    const current = changelog.find(r => r.version === CURRENT_VERSION)
    if (current) setRelease(current)
  }, [])

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    setRelease(null)
  }

  if (!release) return null

  return (
    <Modal open onClose={dismiss} size="xl">
      {/* a sangre: el mockup ocupa la mitad del panel, sin el respiro lateral del cuerpo */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col sm:flex-row" style={{ minHeight: '420px' }}>

          {/* Mockup izquierda (por version del release) */}
          <div className="h-56 w-full overflow-hidden sm:h-auto sm:w-[45%]">
            {release.version === '2026-06-15'
              ? <PlaylistMockup />
              : release.version === '2026-06-12'
                ? <HerramientasMockup />
                : release.version === '2026-06-11'
                  ? <MesaRegalosMockup />
                  : <TimelineMockup />}
          </div>

          {/* Contenido derecha */}
          <div className="flex flex-1 flex-col p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <span className="mb-2 inline-block rounded-full bg-[#f0fdfb] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#48C9B0]">
                  Novedades · {release.date}
                </span>
                <h2 className="text-lg font-bold text-[#1D1E20]">{release.title}</h2>
                <p className="mt-1 text-sm text-[#888]">{release.subtitle}</p>
              </div>
              <button onClick={dismiss} className="flex-shrink-0 text-[#bbb] transition hover:text-[#555]">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-2.5">
              {release.features.map((f, i) => {
                const Icon = ICON_MAP[f.icon]
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    {Icon && <Icon size={14} className="flex-shrink-0 text-[#48C9B0] mt-0.5" />}
                    <p className="text-sm text-[#555] leading-snug">{f.text}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-5">
              <button
                onClick={dismiss}
                className="w-full rounded-xl bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}