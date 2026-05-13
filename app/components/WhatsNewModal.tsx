'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, LayoutList, User, Building2, AlertTriangle,
  Bell, Clock, LucideIcon
} from 'lucide-react'
import { CURRENT_VERSION, changelog, Release } from '@/lib/changelog'

const STORAGE_KEY = 'anfiora_seen_version'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutList, User, Building2, AlertTriangle, Bell, Clock,
}

// ─── MOCKUP DEL TIMELINE ──────────────────────────────────────────────────────

function TimelineMockup() {
  return (
    <div className="h-full w-full overflow-hidden rounded-l-2xl bg-[#f8f5f0]">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-[#e8e4de] bg-[#f0ede8] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#ff6b6b]" />
        <span className="h-2 w-2 rounded-full bg-[#ffd93d]" />
        <span className="h-2 w-2 rounded-full bg-[#6bcb77]" />
        <span className="ml-2 text-[9px] text-[#aaa]">www.anfiora.com · Timeline</span>
      </div>

      {/* App shell */}
      <div className="flex h-full">
        {/* Sidebar mini */}
        <div className="w-20 shrink-0 border-r border-[#e8e4de] bg-[#f8f5f0] p-2">
          {['Invitados','Mesas','Timeline','Presupuesto'].map((item, i) => (
            <div key={item} className={`mb-1 rounded px-1.5 py-1.5 text-[8px] truncate ${i === 2 ? 'bg-white font-semibold text-[#1D1E20]' : 'text-[#aaa]'}`}>
              {item}
            </div>
          ))}
        </div>

        {/* Timeline content */}
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

// ─── MODAL ────────────────────────────────────────────────────────────────────

export function WhatsNewModal() {
  const router = useRouter()
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

  const handleCta = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    setRelease(null)
    router.push(release!.cta.href)
  }

  if (!release) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-col sm:flex-row" style={{ minHeight: '420px' }}>

          {/* Mockup izquierda */}
          <div className="h-56 w-full overflow-hidden sm:h-auto sm:w-[45%]">
            <TimelineMockup />
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

            <div className="mt-5 flex gap-2.5">
              <button onClick={dismiss}
                className="flex-1 rounded-xl border border-[#e0e0e0] py-2.5 text-sm text-[#888] transition hover:bg-[#f8f8f8]">
                Cerrar
              </button>
              <button onClick={handleCta}
                className="flex-[2] rounded-xl bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]">
                {release.cta.label} →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}