'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type RsvpStatus = 'pending' | 'confirmed' | 'declined'

interface EventItem {
  id: string
  name: string
}

interface Guest {
  id: string
  name: string
  phone: string
  rsvp_status: RsvpStatus
  event_id: string
}

interface WaMessage {
  id: string
  guest_id: string
  event_id: string
  direction: 'sent' | 'received'
  content: string
  created_at: string
}

interface Conversation {
  guest: Guest
  event: EventItem
  lastMessage: WaMessage
  messages: WaMessage[]
}

const rsvpConfig: Record<RsvpStatus, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Confirmado', bg: '#ecfdf5', text: '#065f46' },
  pending:   { label: 'Pendiente',  bg: '#fffbeb', text: '#92400e' },
  declined:  { label: 'Declinó',    bg: '#fef2f2', text: '#991b1b' },
}

function tiempoRelativo(fecha: string): string {
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000)
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  if (diff < 172800) return 'ayer'
  return new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function formatHora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(fecha: string): string {
  const d = new Date(fecha)
  const hoy = new Date()
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

const WA_ICON_FILLED = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

export default function WhatsAppFAB() {
  const [open, setOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [conversaciones, setConversaciones] = useState<Conversation[]>([])
  const [eventos, setEventos] = useState<EventItem[]>([])
  const [filtro, setFiltro] = useState('todos')
  const [seleccionada, setSeleccionada] = useState<Conversation | null>(null)
  const [cargando, setCargando] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (open && isLoggedIn) cargar()
  }, [open, isLoggedIn])

  useEffect(() => {
    if (seleccionada) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [seleccionada])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const cargar = async () => {
    setCargando(true)
    const { data: eventosData } = await supabase
      .from('events').select('id, name').order('event_date', { ascending: true })
    if (!eventosData || eventosData.length === 0) { setCargando(false); return }
    setEventos(eventosData)
    const eventoIds = eventosData.map((e: EventItem) => e.id)
    const { data: mensajes } = await supabase
      .from('wa_messages').select('*').in('event_id', eventoIds).order('created_at', { ascending: true })
    if (!mensajes || mensajes.length === 0) { setCargando(false); return }
    const guestIds = [...new Set(mensajes.map((m: WaMessage) => m.guest_id))]
    const { data: guests } = await supabase
      .from('guests').select('id, name, phone, rsvp_status, event_id').in('id', guestIds)
    if (!guests) { setCargando(false); return }
    const convs: Conversation[] = guestIds.map((gid) => {
      const guest = guests.find((g: Guest) => g.id === gid)
      if (!guest) return null
      const evento = eventosData.find((e: EventItem) => e.id === guest.event_id)
      if (!evento) return null
      const msgs = mensajes.filter((m: WaMessage) => m.guest_id === gid)
      return { guest, event: evento, lastMessage: msgs[msgs.length - 1], messages: msgs }
    }).filter(Boolean) as Conversation[]
    convs.sort((a, b) =>
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    )
    setConversaciones(convs)
    setCargando(false)
  }

  if (!isLoggedIn) return null

  const convsFiltradas = filtro === 'todos'
    ? conversaciones
    : conversaciones.filter(c => c.event.id === filtro)

  return (
    <>
      <style>{`
        @keyframes shimmer-fab {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .fab-shimmer {
          position: relative;
          overflow: hidden;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .fab-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.45) 50%, transparent 60%);
          background-size: 200% 100%;
          background-position: -200% center;
        }
        .fab-shimmer:hover::after {
          animation: shimmer-fab 1.2s ease forwards;
        }
        .fab-shimmer:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(72,201,176,0.5);
        }
        .fab-shimmer:active { transform: scale(0.97); }
      `}</style>

      {/* ── Overlay ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          onClick={() => { setOpen(false); setSeleccionada(null) }}
        />
      )}

      {/* ── Panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white shadow-2xl sm:bottom-24 sm:right-8"
          style={{ width: 'min(480px, calc(100vw - 32px))', height: 'min(680px, calc(100dvh - 80px))' }}
        >
          {/* Header panel */}
          <div className="flex items-center justify-between border-b border-[#e8e8e8] bg-[#48C9B0] px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              {seleccionada ? (
                <>
                  <button onClick={() => setSeleccionada(null)} className="mr-1 rounded-lg p-1 hover:bg-white/20 transition">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M19 12H5M12 5l-7 7 7 7"/>
                    </svg>
                  </button>
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                    {seleccionada.guest.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{seleccionada.guest.name}</p>
                    <p className="text-[11px] text-white/70 leading-tight">{seleccionada.event.name}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-8 w-8 items-center justify-center">{WA_ICON_FILLED}</div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">WhatsApp Hub</p>
                    <p className="text-[11px] text-white/70 leading-tight">{conversaciones.length} conversaciones</p>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => { setOpen(false); setSeleccionada(null) }}
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Vista lista */}
          {!seleccionada && (
            <div className="flex flex-1 flex-col overflow-hidden">
              {eventos.length > 1 && (
                <div className="border-b border-[#e8e8e8] px-3 py-2">
                  <select
                    value={filtro}
                    onChange={e => setFiltro(e.target.value)}
                    className="w-full rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-1.5 text-xs text-[#1D1E20] focus:border-[#48C9B0] focus:outline-none"
                  >
                    <option value="todos">Todos los eventos</option>
                    {eventos.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {cargando ? (
                  [1,2,3].map(i => (
                    <div key={i} className="flex items-center gap-3 border-b border-[#f3f4f6] px-4 py-3">
                      <div className="h-9 w-9 rounded-full bg-[#f3f4f6] animate-pulse shrink-0"/>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 rounded bg-[#f3f4f6] animate-pulse"/>
                        <div className="h-2.5 w-2/3 rounded bg-[#f3f4f6] animate-pulse"/>
                      </div>
                    </div>
                  ))
                ) : convsFiltradas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#48C9B0]/10 text-[#48C9B0]">
                      {WA_ICON_FILLED}
                    </div>
                    <p className="text-sm font-medium text-[#1D1E20]">Sin mensajes aún</p>
                    <p className="mt-1 text-xs text-[#9ca3af]">Los verás aquí cuando envíes tu primera campaña</p>
                  </div>
                ) : (
                  convsFiltradas.map(conv => {
                    const rsvp = rsvpConfig[conv.guest.rsvp_status] ?? rsvpConfig.pending
                    const preview = conv.lastMessage.direction === 'sent'
                      ? `Tú: ${conv.lastMessage.content}`
                      : conv.lastMessage.content
                    return (
                      <button
                        key={conv.guest.id}
                        onClick={() => setSeleccionada(conv)}
                        className="flex w-full items-center gap-3 border-b border-[#f3f4f6] px-4 py-3 text-left transition hover:bg-[#f8fffe]"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#48C9B0]/15">
                          <span className="text-sm font-semibold text-[#0F6E56]">
                            {conv.guest.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="truncate text-sm font-medium text-[#1D1E20]">{conv.guest.name}</span>
                            <span className="shrink-0 text-[10px] text-[#9ca3af]">{tiempoRelativo(conv.lastMessage.created_at)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-[#6b7280]">{preview}</span>
                            <span
                              className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ background: rsvp.bg, color: rsvp.text }}
                            >
                              {rsvp.label}
                            </span>
                          </div>
                          <span className="mt-0.5 block truncate text-[10px] text-[#9ca3af]">{conv.event.name}</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Vista chat individual */}
          {seleccionada && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto bg-[#fafafa] px-3 py-3 space-y-1">
                {(() => {
                  const porFecha: { fecha: string; msgs: WaMessage[] }[] = []
                  seleccionada.messages.forEach(msg => {
                    const fecha = new Date(msg.created_at).toDateString()
                    const grupo = porFecha.find(g => g.fecha === fecha)
                    if (grupo) grupo.msgs.push(msg)
                    else porFecha.push({ fecha, msgs: [msg] })
                  })
                  return porFecha.map(({ fecha, msgs }) => (
                    <div key={fecha}>
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px bg-[#e8e8e8]"/>
                        <span className="text-[10px] text-[#9ca3af] px-2">{formatFecha(msgs[0].created_at)}</span>
                        <div className="flex-1 h-px bg-[#e8e8e8]"/>
                      </div>
                      {msgs.map(msg => (
                        <div key={msg.id} className={`flex mb-1.5 ${msg.direction === 'sent' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                            msg.direction === 'sent'
                              ? 'bg-[#48C9B0]/20 rounded-tr-sm'
                              : 'bg-white border border-[#e8e8e8] rounded-tl-sm shadow-sm'
                          }`}>
                            <p className="text-sm leading-relaxed text-[#1D1E20] break-words">{msg.content}</p>
                            <p className="mt-0.5 text-right text-[10px] text-[#9ca3af]">{formatHora(msg.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                })()}
                <div ref={chatBottomRef}/>
              </div>
              <div className="border-t border-[#e8e8e8] bg-white px-4 py-2.5 text-center">
                <p className="text-xs text-[#9ca3af]">El envío de mensajes estará disponible pronto</p>
              </div>
            </div>
          )}
        </div>
      )}

{/* ── FAB ── */}
      <button
        onClick={() => { setOpen(!open); setSeleccionada(null) }}
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px', 
          zIndex: 9999,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#48C9B0',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(72,201,176,0.4)'
        }}
        className="hidden sm:flex"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        )}
      </button>
    </>
  )
}