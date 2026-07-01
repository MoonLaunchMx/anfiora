'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  MessageCircle, Clock, Send, Sparkles, Info,
  AlertCircle, CheckCircle, XCircle,
  Megaphone, X, ChevronLeft, ChevronRight, UserRound,
} from 'lucide-react'
import { FaWhatsapp, FaTelegram } from 'react-icons/fa'
import type { InboxConversation, InboxMessage } from '@/lib/omnichannel/inbox-view'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type RsvpStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'mensaje_enviado'
  | 'respondio'
  | 'accion_necesaria'

interface TableAssignment {
  table_name: string | null
  table_number: number | null
}

interface DetalleInvitado {
  side: string | null
  tags: string[] | null
  allergies: string[] | null
}

interface Acompanante {
  id: string
  name: string
  rsvp_status: string | null
  allergies: string[] | null
}

// ─── Constantes RSVP ─────────────────────────────────────────────────────────

const RSVP_CONFIG: Record<RsvpStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  confirmed:        { label: 'Confirmado',      bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <CheckCircle   size={12} /> },
  pending:          { label: 'Pendiente',        bg: 'bg-amber-50',   text: 'text-amber-700',   icon: <Clock         size={12} /> },
  declined:         { label: 'Declinó',          bg: 'bg-red-50',     text: 'text-red-600',     icon: <XCircle       size={12} /> },
  mensaje_enviado:  { label: 'Msg. enviado',     bg: 'bg-blue-50',    text: 'text-blue-700',    icon: <Send          size={12} /> },
  respondio:        { label: 'Respondió',        bg: 'bg-purple-50',  text: 'text-purple-700',  icon: <MessageCircle size={12} /> },
  accion_necesaria: { label: 'Acción necesaria', bg: 'bg-orange-50',  text: 'text-orange-700',  icon: <AlertCircle   size={12} /> },
}

const SIDE_LABEL: Record<string, string> = { novia: 'Novia', novio: 'Novio' }

// ─── Config de canal ───────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<string, {
  label: string
  Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
  color: string
}> = {
  whatsapp: { label: 'WhatsApp', Icon: FaWhatsapp, color: '#25D366' },
  telegram: { label: 'Telegram', Icon: FaTelegram, color: '#229ED9' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tiempoRelativo(fecha: string | null): string {
  if (!fecha) return ''
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000)
  if (diff < 60)     return 'ahora'
  if (diff < 3600)   return `${Math.floor(diff / 60)} min`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`
  if (diff < 172800) return 'ayer'
  return new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function formatHora(fecha: string): string {
  return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function formatFechaChat(fecha: string): string {
  const d    = new Date(fecha)
  const hoy  = new Date()
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString())  return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

function iniciales(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return parts[0]?.[0]?.toUpperCase() || '?'
}

function nombreConv(c: InboxConversation): string {
  return c.guestName ?? c.participantName ?? 'Sin nombre'
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function RsvpBadge({ status, size = 'sm' }: { status: RsvpStatus; size?: 'sm' | 'md' }) {
  const cfg = RSVP_CONFIG[status] ?? RSVP_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium
      ${size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'}
      ${cfg.bg} ${cfg.text}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function CanalBadge({ channel, size = 12 }: { channel: string; size?: number }) {
  const cfg = CHANNEL_CONFIG[channel]
  if (!cfg) return null
  const { Icon, color, label } = cfg
  return (
    <span title={label} className="inline-flex items-center">
      <Icon size={size} style={{ color }} />
    </span>
  )
}

// ─── MODAL PRÓXIMAMENTE ───────────────────────────────────────────────────────

const DEMOS = [
  '/images/wa-demo-1.png',
  '/images/wa-demo-2.png',
  '/images/wa-demo-3.png',
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ModalProximamente({ onClose }: { onClose: () => void }) {
  const [slide, setSlide]       = useState(0)
  const [correo, setCorreo]     = useState('')
  const [enviado, setEnviado]   = useState(false)
  const [sending, setSending]   = useState(false)
  const [errorEmail, setErrorEmail] = useState('')

  async function notificar() {
    if (!correo.trim()) return
    if (!EMAIL_REGEX.test(correo.trim())) {
      setErrorEmail('Ingresa un correo válido, por ejemplo: nombre@dominio.com')
      return
    }
    setErrorEmail('')
    setSending(true)
    try {
      await supabase.from('waitlist_whatsapp').insert({ email: correo.trim() })
    } catch (err: any) {
      console.error('[waitlist]', err?.message ?? err)
    }
    setEnviado(true)
    setSending(false)
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full h-full overflow-hidden rounded-2xl bg-white shadow-2xl flex-col md:flex-row"
        onClick={e => e.stopPropagation()}
      >

        <div className="hidden md:flex md:w-[52%] flex-col bg-[#f8f5f0] shrink-0">
          <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
            <img
              src={DEMOS[slide]}
              alt={`Demo ${slide + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              className="rounded-lg shadow-sm"
            />
          </div>
          <div className="flex flex-col items-center gap-2 pb-5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSlide(s => Math.max(0, s - 1))}
                disabled={slide === 0}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e8e8e8] bg-white text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0] disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <div className="flex gap-1.5">
                {DEMOS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-[#48C9B0]' : 'w-1.5 bg-[#ccc]'}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setSlide(s => Math.min(DEMOS.length - 1, s + 1))}
                disabled={slide === DEMOS.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e8e8e8] bg-white text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0] disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <span className="text-[10px] text-[#9ca3af]">{slide + 1} / {DEMOS.length}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col md:border-l border-[#f0f0f0] overflow-hidden">

          <div className="flex shrink-0 items-center justify-between border-b border-[#f0f0f0] px-6 py-4">
            <img src="/images/logo.svg" alt="Anfiora" className="h-20" />
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#bbb] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto px-6 py-5 gap-4">

            <div>
              <span className="inline-flex rounded-full bg-[#48C9B0]/15 px-3 py-0.5 text-[11px] font-semibold text-[#1D9E75]">
                Próximamente
              </span>
              <h2 className="mt-2 text-[17px] font-bold leading-snug text-[#1D1E20]">
                Tu asistente personal de confirmaciones
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[#6b7280]">
                Las confirmaciones que tardabas semanas en recopilar, listas en 48 horas — sin un solo mensaje manual.
              </p>
            </div>

            <div className="space-y-1.5">
              {[
                'Envío masivo con plantillas personalizadas',
                'Respuestas automáticas 24/7 vía WhatsApp',
                'FAQs antes, durante y después del evento',
                'Actualización automática de estatus y alergias',
              ].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle size={13} className="shrink-0 text-[#48C9B0]" />
                  <span className="text-xs text-[#1D1E20]">{item}</span>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">
                Lo que cobran otros por hacer esto manual
              </p>
              <div className="overflow-hidden rounded-xl border border-[#e8e8e8] text-[11px]">
                <div className="grid grid-cols-3 border-b border-[#e8e8e8] bg-[#fafafa]">
                  <div className="px-3 py-2 text-[#9ca3af]" />
                  <div className="border-l border-[#e8e8e8] px-3 py-2 text-[#9ca3af]">Guest List Experts</div>
                  <div className="border-l border-[#48C9B0]/30 bg-[#f0fdfb] px-3 py-2 font-semibold text-[#1D9E75]">Anfiora IA</div>
                </div>
                {[
                  { campo: 'Precio',         ellos: '$7,000–$8,000',    nosotros: '$1,490 MXN' },
                  { campo: 'Método',         ellos: 'WhatsApp manual',  nosotros: 'Automatizado 24/7' },
                  { campo: 'Disponibilidad', ellos: 'Solo previo',      nosotros: 'Antes, durante y después' },
                  { campo: 'Alergias',       ellos: 'Tú las recopilas', nosotros: 'Se actualizan solas' },
                ].map((row, i, arr) => (
                  <div
                    key={row.campo}
                    className={`grid grid-cols-3 ${i < arr.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}
                  >
                    <div className="px-3 py-2 font-medium text-[#9ca3af]">{row.campo}</div>
                    <div className="border-l border-[#f0f0f0] px-3 py-2 text-[#6b7280]">{row.ellos}</div>
                    <div className="border-l border-[#48C9B0]/20 bg-[#f0fdfb]/50 px-3 py-2 font-semibold text-[#1D9E75]">{row.nosotros}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center text-[11px] text-[#6b7280]">
                Ahorras hasta <span className="font-bold text-[#1D1E20]">$6,510 MXN</span> — y tu IA trabaja mientras duermes.
              </p>
            </div>

            <div className="pb-2">
              {enviado ? (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-[#f0fdfb] py-3 text-sm font-semibold text-[#1D9E75]">
                  <CheckCircle size={15} />
                  Te avisamos en cuanto esté disponible
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={correo}
                    onChange={e => { setCorreo(e.target.value); setErrorEmail('') }}
                    onKeyDown={e => { if (e.key === 'Enter') notificar() }}
                    className={`w-full rounded-xl border bg-[#fafafa] px-3.5 py-2.5 text-sm text-[#1D1E20] placeholder:text-[#bbb] focus:outline-none transition
                      ${errorEmail ? 'border-red-400 focus:border-red-400' : 'border-[#e8e8e8] focus:border-[#48C9B0]'}`}
                  />
                  {errorEmail && (
                    <div className="flex items-center gap-1.5 text-[11px] text-red-500">
                      <AlertCircle size={11} className="shrink-0" />
                      {errorEmail}
                    </div>
                  )}
                  <button
                    onClick={notificar}
                    disabled={!correo.trim() || sending}
                    className="w-full rounded-xl bg-[#48C9B0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-40"
                  >
                    {sending ? '...' : 'Quiero acceso anticipado'}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PANEL LISTA ──────────────────────────────────────────────────────────────

interface PanelListaProps {
  cargando: boolean
  convsFiltradas: InboxConversation[]
  seleccionadaId: string | null
  busqueda: string
  canalFiltro: 'todos' | 'whatsapp' | 'telegram'
  onSelect: (conv: InboxConversation) => void
  onBusqueda: (v: string) => void
  onCanal: (v: 'todos' | 'whatsapp' | 'telegram') => void
  onBroadcast: () => void
}

function PanelLista({
  cargando, convsFiltradas, seleccionadaId, busqueda, canalFiltro, onSelect, onBusqueda, onCanal, onBroadcast
}: PanelListaProps) {
  const filtros: { key: 'todos' | 'whatsapp' | 'telegram'; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'telegram', label: 'Telegram' },
  ]
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[#e8e8e8] px-4 pb-3 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1D1E20]">Mensajes</h2>
          <span className="text-xs text-[#9ca3af]">
            {convsFiltradas.length} conversaci{convsFiltradas.length !== 1 ? 'ones' : 'ón'}
          </span>
        </div>
        <div className="relative">
          <MessageCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
          <input
            type="text"
            placeholder="Buscar invitado..."
            value={busqueda}
            onChange={e => onBusqueda(e.target.value)}
            className="w-full rounded-lg border border-[#e8e8e8] bg-[#fafafa] py-2 pl-8 pr-3 text-sm text-[#1D1E20] placeholder:text-[#bbb] focus:border-[#48C9B0] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {filtros.map(f => (
            <button
              key={f.key}
              onClick={() => onCanal(f.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition
                ${canalFiltro === f.key
                  ? 'bg-[#48C9B0]/15 text-[#1D9E75]'
                  : 'bg-[#f5f5f5] text-[#9ca3af] hover:bg-[#eee]'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={onBroadcast}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1D1E20] py-2 text-xs font-semibold text-white transition hover:bg-[#333]"
        >
          <Megaphone size={13} />
          Enviar campaña masiva
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {cargando ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 border-b border-[#f3f4f6] px-4 py-3.5">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#f0f0f0]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-[#f0f0f0]" />
                <div className="h-2.5 w-2/3 animate-pulse rounded bg-[#f0f0f0]" />
              </div>
            </div>
          ))
        ) : convsFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#48C9B0]/10">
              <MessageCircle size={28} className="text-[#48C9B0]" />
            </div>
            <p className="mb-1 font-semibold text-[#1D1E20]">Sin conversaciones</p>
            <p className="text-xs leading-relaxed text-[#9ca3af]">
              Aquí aparecerán los chats de WhatsApp y Telegram de este evento.
            </p>
          </div>
        ) : (
          convsFiltradas.map(conv => {
            const activa  = seleccionadaId === conv.id
            const prefijo = conv.lastAuthorType === 'ai' ? 'IA: ' : conv.lastAuthorType === 'human' ? 'Tú: ' : ''
            const preview = `${prefijo}${conv.lastMessageText ?? ''}`
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`flex w-full items-center gap-3 border-b border-[#f3f4f6] px-4 py-3.5 text-left transition
                  ${activa ? 'bg-[#f0fdfb]' : 'hover:bg-[#fafafa]'}`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold
                  ${activa ? 'bg-[#48C9B0] text-white' : 'bg-[#48C9B0]/15 text-[#1D9E75]'}`}>
                  {iniciales(nombreConv(conv))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CanalBadge channel={conv.channel} size={11} />
                      <span className="truncate text-[15px] font-medium text-[#1D1E20]">{nombreConv(conv)}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-[#9ca3af]">{tiempoRelativo(conv.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-[#9ca3af]">{preview}</span>
                    {conv.rsvpStatus && <RsvpBadge status={conv.rsvpStatus as RsvpStatus} />}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── BURBUJA ──────────────────────────────────────────────────────────────────

function Burbuja({ m }: { m: InboxMessage }) {
  if (m.authorType === 'contact') {
    return (
      <div className="mb-2.5 flex justify-start">
        <div className="max-w-[78%] rounded-2xl rounded-tl-sm border border-[#e8e8e8] bg-white px-4 py-2.5 shadow-sm">
          <p className="text-[15px] leading-relaxed text-[#1D1E20] break-words">{m.contentText}</p>
          <div className="mt-1 flex items-center gap-1">
            <Clock size={11} className="text-[#9ca3af]" />
            <span className="text-[11px] text-[#9ca3af]">{formatHora(m.providerTimestamp)}</span>
          </div>
        </div>
      </div>
    )
  }
  const esIA = m.authorType === 'ai'
  return (
    <div className="mb-2.5 flex justify-end">
      <div className="max-w-[78%]">
        <div className="mb-1 flex items-center justify-end gap-1">
          {esIA ? <Sparkles size={11} className="text-[#1D9E75]" /> : null}
          <span className={`text-[10px] font-semibold ${esIA ? 'text-[#1D9E75]' : 'text-[#9ca3af]'}`}>{esIA ? 'IA' : 'Tú'}</span>
        </div>
        {esIA ? (
          <div className="rounded-2xl rounded-tr-sm border border-[#cdefe6] bg-[#eafaf5] px-4 py-2.5">
            <p className="text-[15px] leading-relaxed text-[#1D1E20] break-words">{m.contentText}</p>
            <span className="mt-1 block text-right text-[11px] text-[#6f9f91]">{formatHora(m.providerTimestamp)}</span>
          </div>
        ) : (
          <div className="rounded-2xl rounded-tr-sm bg-[#1D1E20] px-4 py-2.5">
            <p className="text-[15px] leading-relaxed text-white break-words">{m.contentText}</p>
            <span className="mt-1 block text-right text-[11px] text-white/55">{formatHora(m.providerTimestamp)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PANEL CHAT ───────────────────────────────────────────────────────────────

interface PanelChatProps {
  conv: InboxConversation
  mensajes: InboxMessage[]
  mensaje: string
  enviando: boolean
  errorEnvio: string | null
  chatBottomRef: React.RefObject<HTMLDivElement | null>
  onMensajeChange: (v: string) => void
  onEnviar: () => void
  onToggleDetalles: () => void
  onToggleAgente: () => void
}

function PanelChat({
  conv, mensajes, mensaje, enviando, errorEnvio, chatBottomRef,
  onMensajeChange, onEnviar, onToggleDetalles, onToggleAgente
}: PanelChatProps) {
  const porFecha: { fecha: string; msgs: InboxMessage[] }[] = []
  mensajes.forEach(m => {
    const fecha = new Date(m.providerTimestamp).toDateString()
    const grupo = porFecha.find(g => g.fecha === fecha)
    if (grupo) grupo.msgs.push(m)
    else porFecha.push({ fecha, msgs: [m] })
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-[#e8e8e8] bg-white px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#48C9B0] text-sm font-semibold text-white">
          {iniciales(nombreConv(conv))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CanalBadge channel={conv.channel} size={13} />
            <span className="truncate text-[15px] font-semibold text-[#1D1E20]">{nombreConv(conv)}</span>
            {conv.rsvpStatus && <RsvpBadge status={conv.rsvpStatus as RsvpStatus} />}
          </div>
        </div>
        <button
          onClick={onToggleAgente}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition
            ${conv.aiEnabled
              ? 'bg-[#48C9B0]/15 text-[#1D9E75] hover:bg-[#48C9B0]/25'
              : 'bg-[#f0f0f0] text-[#666] hover:bg-[#e8e8e8]'}`}
          title={conv.aiEnabled ? 'El agente responde automáticamente' : 'Tú respondes esta conversación'}
        >
          {conv.aiEnabled ? <Sparkles size={13} /> : <UserRound size={13} />}
          {conv.aiEnabled ? 'Agente activo' : 'Yo respondo'}
        </button>
        <button
          onClick={onToggleDetalles}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0] xl:hidden"
        >
          <Info size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#fafafa] px-4 py-4">
        {porFecha.map(({ fecha, msgs }) => (
          <div key={fecha}>
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-[#e8e8e8]" />
              <span className="shrink-0 rounded-full bg-[#f0f0f0] px-3 py-0.5 text-[10px] font-medium text-[#9ca3af]">
                {formatFechaChat(msgs[0].providerTimestamp)}
              </span>
              <div className="flex-1 h-px bg-[#e8e8e8]" />
            </div>
            {msgs.map(m => <Burbuja key={m.id} m={m} />)}
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>

      <div className="shrink-0 border-t border-[#e8e8e8] bg-white px-4 py-3">
        {errorEnvio && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertCircle size={12} />
            {errorEnvio}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={mensaje}
            onChange={e => onMensajeChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnviar() } }}
            placeholder="Escribe un mensaje..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[#e8e8e8] bg-[#fafafa] px-3.5 py-2.5 text-[15px] text-[#1D1E20] placeholder:text-[#bbb] focus:border-[#48C9B0] focus:outline-none"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={onEnviar}
            disabled={!mensaje.trim() || enviando}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#48C9B0] text-white transition hover:bg-[#3ab89f] disabled:opacity-40"
          >
            {enviando
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              : <Send size={16} />
            }
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[#bbb]">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>
    </div>
  )
}

// ─── PANEL DETALLES ───────────────────────────────────────────────────────────

interface PanelDetallesProps {
  conv: InboxConversation
  mesa: TableAssignment | null
  cargandoMesa: boolean
  detalle: DetalleInvitado | null
  acompanantes: Acompanante[]
  onToggleAgente: () => void
  onClose: () => void
}

function PanelDetalles({ conv, mesa, cargandoMesa, detalle, acompanantes, onToggleAgente, onClose }: PanelDetallesProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex shrink-0 items-center justify-between border-b border-[#e8e8e8] px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Detalles</span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-[#bbb] transition hover:text-[#1D1E20] xl:hidden"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-col items-center border-b border-[#f3f4f6] px-4 py-5">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#48C9B0] text-lg font-semibold text-white">
          {iniciales(nombreConv(conv))}
        </div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[15px] font-semibold text-[#1D1E20]">
          <CanalBadge channel={conv.channel} size={14} />
          {nombreConv(conv)}
        </p>
        {conv.rsvpStatus && <RsvpBadge status={conv.rsvpStatus as RsvpStatus} size="md" />}
        {detalle?.allergies && detalle.allergies.length > 0 && (
          <div className="mt-3 w-full">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Alergias</p>
            <div className="flex flex-wrap gap-1.5">
              {detalle.allergies.map(a => (
                <span key={a} className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[12px] font-medium text-orange-700">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Control del agente */}
      <div className="border-b border-[#f3f4f6] px-4 py-3.5">
        <button
          onClick={onToggleAgente}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e8e8e8] px-3.5 py-3 text-left transition hover:border-[#48C9B0]/60"
        >
          <span className="flex items-center gap-2.5">
            {conv.aiEnabled
              ? <Sparkles size={17} className="shrink-0 text-[#1D9E75]" />
              : <UserRound size={17} className="shrink-0 text-[#888]" />}
            <span>
              <span className="block text-[15px] font-medium text-[#1D1E20]">Agente IA</span>
              <span className="block text-[12px] text-[#9ca3af]">
                {conv.aiEnabled ? 'Responde automáticamente' : 'Tú respondes'}
              </span>
            </span>
          </span>
          <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${conv.aiEnabled ? 'bg-[#48C9B0]' : 'bg-[#d4d4d4]'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${conv.aiEnabled ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </button>
      </div>

      <div className="flex-1 space-y-0 divide-y divide-[#f3f4f6] px-4">
        {detalle?.side && (
          <div className="py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Lado</p>
            <p className="text-[15px] text-[#1D1E20]">{SIDE_LABEL[detalle.side] ?? detalle.side}</p>
          </div>
        )}
        <div className="py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Mesa</p>
          {cargandoMesa ? (
            <div className="h-4 w-16 animate-pulse rounded bg-[#f0f0f0]" />
          ) : mesa ? (
            <p className="text-[15px] font-medium text-[#1D1E20]">{mesa.table_name ?? `Mesa ${mesa.table_number}`}</p>
          ) : (
            <p className="text-[15px] text-[#bbb]">Sin asignar</p>
          )}
        </div>
        {acompanantes.length > 0 && (
          <div className="py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">
              Acompañantes ({acompanantes.length})
            </p>
            <div className="space-y-2">
              {acompanantes.map(a => (
                <div key={a.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] text-[#1D1E20]">{a.name}</span>
                    {a.rsvp_status && <RsvpBadge status={a.rsvp_status as RsvpStatus} />}
                  </div>
                  {a.allergies && a.allergies.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.allergies.map(al => (
                        <span key={al} className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[12px] font-medium text-orange-700">
                          {al}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {detalle?.tags && detalle.tags.length > 0 && (
          <div className="py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {detalle.tags.map(tag => (
                <span key={tag} className="rounded-full border border-[#e8e8e8] bg-[#f8f8f8] px-2.5 py-0.5 text-[13px] text-[#555]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

function EmptyChat() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#48C9B0]/10">
        <MessageCircle size={28} className="text-[#48C9B0]" />
      </div>
      <p className="mb-1 font-semibold text-[#1D1E20]">Selecciona una conversación</p>
      <p className="text-sm text-[#9ca3af]">Elige un invitado de la lista para ver el historial</p>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function MensajesPage() {
  const { id: eventId } = useParams<{ id: string }>()

  const [conversaciones, setConversaciones] = useState<InboxConversation[]>([])
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)
  const [mensajes, setMensajes]             = useState<InboxMessage[]>([])
  const [cargando, setCargando]             = useState(true)
  const [mesa, setMesa]                     = useState<TableAssignment | null>(null)
  const [cargandoMesa, setCargandoMesa]     = useState(false)
  const [detalle, setDetalle]               = useState<DetalleInvitado | null>(null)
  const [acompanantes, setAcompanantes]     = useState<Acompanante[]>([])
  const [detallesOpen, setDetallesOpen]     = useState(false)
  const [mensaje, setMensaje]               = useState('')
  const [enviando, setEnviando]             = useState(false)
  const [errorEnvio, setErrorEnvio]         = useState<string | null>(null)
  const [busqueda, setBusqueda]             = useState('')
  const [canalFiltro, setCanalFiltro]       = useState<'todos' | 'whatsapp' | 'telegram'>('todos')
  const [modalProximo, setModalProximo]     = useState(false)

  const chatBottomRef = useRef<HTMLDivElement>(null)

  const seleccionada = conversaciones.find(c => c.id === seleccionadaId) ?? null

  const fetchInbox = useCallback(async (convId?: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setCargando(false); return }
    const qs = new URLSearchParams({ eventId })
    if (convId) qs.set('conversationId', convId)
    const res = await fetch(`/api/omnichannel/inbox?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const json = await res.json()
      setConversaciones(json.conversations ?? [])
      if (convId && json.messages) setMensajes(json.messages)
    }
    setCargando(false)
  }, [eventId])

  useEffect(() => {
    fetchInbox(seleccionadaId ?? undefined)
    const t = setInterval(() => fetchInbox(seleccionadaId ?? undefined), 4000)
    return () => clearInterval(t)
  }, [fetchInbox, seleccionadaId])

  useEffect(() => {
    if (seleccionadaId) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    }
  }, [seleccionadaId, mensajes.length])

  const cargarDetalle = useCallback(async (guestId: string) => {
    const [guestRes, partyRes] = await Promise.all([
      supabase.from('guests').select('side, tags, allergies').eq('id', guestId).maybeSingle(),
      supabase.from('party_members').select('id, name, rsvp_status, allergies').eq('guest_id', guestId).order('created_at', { ascending: true }),
    ])
    if (guestRes.data) {
      setDetalle({ side: guestRes.data.side ?? null, tags: guestRes.data.tags ?? null, allergies: (guestRes.data.allergies as string[] | null) ?? null })
    } else {
      setDetalle(null)
    }
    setAcompanantes((partyRes.data ?? []).map(a => ({
      id: a.id,
      name: a.name,
      rsvp_status: a.rsvp_status ?? null,
      allergies: (a.allergies as string[] | null) ?? null,
    })))
  }, [])

  useEffect(() => {
    if (!seleccionada?.guestId) { setMesa(null); setDetalle(null); setAcompanantes([]); return }
    const guestId = seleccionada.guestId
    setCargandoMesa(true)
    supabase
      .from('table_seats')
      .select('tables(name, number)')
      .eq('guest_id', guestId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.tables) {
          const t = data.tables as any
          setMesa({ table_name: t.name ?? null, table_number: t.number ?? null })
        } else {
          setMesa(null)
        }
        setCargandoMesa(false)
      })
    cargarDetalle(guestId)
    const t = setInterval(() => cargarDetalle(guestId), 4000)
    return () => clearInterval(t)
  }, [seleccionada?.guestId, cargarDetalle])

  async function seleccionar(conv: InboxConversation) {
    setSeleccionadaId(conv.id)
    setDetallesOpen(false)
    setMensajes([])
    await fetchInbox(conv.id)
  }

  async function toggleAgente() {
    if (!seleccionada) return
    const nuevo = !seleccionada.aiEnabled
    setConversaciones(prev => prev.map(c => c.id === seleccionada.id ? { ...c, aiEnabled: nuevo } : c))
    await supabase.from('conversations').update({ ai_enabled: nuevo }).eq('id', seleccionada.id)
  }

  async function enviar() {
    if (!mensaje.trim() || !seleccionadaId || enviando) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/omnichannel/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ conversationId: seleccionadaId, text: mensaje.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? 'Error al enviar')
      }
      setMensaje('')
      await fetchInbox(seleccionadaId)
    } catch (err: any) {
      setErrorEnvio(err?.message ?? 'No se pudo enviar el mensaje')
    } finally {
      setEnviando(false)
    }
  }

  const convsFiltradas = conversaciones.filter(c =>
    (canalFiltro === 'todos' || c.channel === canalFiltro) &&
    nombreConv(c).toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="relative flex h-full overflow-hidden bg-white text-[#1D1E20]">

      {/* COL 1 — Lista */}
      <div className={`
        w-full shrink-0 border-r border-[#e8e8e8]
        lg:w-[280px] xl:w-[300px]
        ${seleccionada ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}
      `}>
        <PanelLista
          cargando={cargando}
          convsFiltradas={convsFiltradas}
          seleccionadaId={seleccionadaId}
          busqueda={busqueda}
          canalFiltro={canalFiltro}
          onSelect={seleccionar}
          onBusqueda={setBusqueda}
          onCanal={setCanalFiltro}
          onBroadcast={() => setModalProximo(true)}
        />
      </div>

      {/* COL 2 — Chat */}
      <div className={`flex-1 flex flex-col min-w-0 ${seleccionada ? 'flex' : 'hidden lg:flex'}`}>
        {seleccionada ? (
          <PanelChat
            conv={seleccionada}
            mensajes={mensajes}
            mensaje={mensaje}
            enviando={enviando}
            errorEnvio={errorEnvio}
            chatBottomRef={chatBottomRef}
            onMensajeChange={setMensaje}
            onEnviar={enviar}
            onToggleDetalles={() => setDetallesOpen(p => !p)}
            onToggleAgente={toggleAgente}
          />
        ) : (
          <EmptyChat />
        )}
      </div>

      {/* COL 3 — Detalles */}
      {seleccionada && (
        <>
          {detallesOpen && (
            <div
              onClick={() => setDetallesOpen(false)}
              className="fixed inset-0 z-30 bg-black/20 xl:hidden"
            />
          )}
          <div className={`
            shrink-0 border-l border-[#e8e8e8] bg-white
            xl:w-[240px] xl:flex xl:flex-col
            ${detallesOpen
              ? 'fixed right-0 top-0 bottom-0 z-40 w-[260px] flex flex-col shadow-xl'
              : 'hidden xl:flex xl:flex-col'
            }
          `}>
            <PanelDetalles
              conv={seleccionada}
              mesa={mesa}
              cargandoMesa={cargandoMesa}
              detalle={detalle}
              acompanantes={acompanantes}
              onToggleAgente={toggleAgente}
              onClose={() => setDetallesOpen(false)}
            />
          </div>
        </>
      )}

      {/* Modal */}
      {modalProximo && (
        <ModalProximamente onClose={() => setModalProximo(false)} />
      )}

    </div>
  )
}
