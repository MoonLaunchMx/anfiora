'use client'
 
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  MessageCircle, Clock, Send, Sparkles, Info,
  AlertCircle, CheckCircle, XCircle,
  Megaphone, X,
} from 'lucide-react'
 
// ─── Tipos ───────────────────────────────────────────────────────────────────
 
type RsvpStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'mensaje_enviado'
  | 'respondio'
  | 'accion_necesaria'
 
interface Guest {
  id: string
  name: string
  phone: string
  rsvp_status: RsvpStatus
  side: string | null
  tags: string[] | null
  allergies: string[] | null
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
 
interface TableAssignment {
  table_name: string | null
  table_number: number | null
}
 
interface Conversation {
  guest: Guest
  lastMessage: WaMessage
  messages: WaMessage[]
}
 
// ─── Constantes de estilos RSVP ───────────────────────────────────────────────
 
const RSVP_CONFIG: Record<RsvpStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  confirmed:        { label: 'Confirmado',      bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <CheckCircle   size={12} /> },
  pending:          { label: 'Pendiente',        bg: 'bg-amber-50',   text: 'text-amber-700',   icon: <Clock         size={12} /> },
  declined:         { label: 'Declinó',          bg: 'bg-red-50',     text: 'text-red-600',     icon: <XCircle       size={12} /> },
  mensaje_enviado:  { label: 'Msg. enviado',     bg: 'bg-blue-50',    text: 'text-blue-700',    icon: <Send          size={12} /> },
  respondio:        { label: 'Respondió',        bg: 'bg-purple-50',  text: 'text-purple-700',  icon: <MessageCircle size={12} /> },
  accion_necesaria: { label: 'Acción necesaria', bg: 'bg-orange-50',  text: 'text-orange-700',  icon: <AlertCircle   size={12} /> },
}
 
const SIDE_LABEL: Record<string, string> = { novia: 'Novia', novio: 'Novio' }
 
// ─── Helpers ─────────────────────────────────────────────────────────────────
 
function tiempoRelativo(fecha: string): string {
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
 
// ─── Badge RSVP ──────────────────────────────────────────────────────────────
 
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
 
// ─── PANEL LISTA — fuera del componente principal para evitar re-renders ──────
 
interface PanelListaProps {
  cargando: boolean
  convsFiltradas: Conversation[]
  seleccionada: Conversation | null
  busqueda: string
  totalEnviados: number
  onSelect: (conv: Conversation) => void
  onBusqueda: (v: string) => void
}
 
function PanelLista({
  cargando, convsFiltradas, seleccionada, busqueda, totalEnviados, onSelect, onBusqueda
}: PanelListaProps) {
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
        <button
          onClick={() => {/* TODO: broadcast */ }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1D1E20] py-2 text-xs font-semibold text-white transition hover:bg-[#333]"
        >
          <Megaphone size={13} />
          Enviar campaña masiva
        </button>
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#9ca3af]">Mensajes enviados</span>
            <span className="text-[11px] font-semibold text-[#1D1E20]">
              {totalEnviados.toLocaleString('es-MX')}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
            <div
              className="h-full rounded-full bg-[#48C9B0] transition-all duration-500"
              style={{ width: `${Math.min((totalEnviados / 5000) * 100, 100)}%` }}
            />
          </div>
        </div>
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
              Aquí aparecerán los chats cuando envíes tu primera campaña de WhatsApp.
            </p>
          </div>
        ) : (
          convsFiltradas.map(conv => {
            const activa  = seleccionada?.guest.id === conv.guest.id
            const preview = conv.lastMessage.direction === 'sent'
              ? `Tú: ${conv.lastMessage.content}`
              : conv.lastMessage.content
            return (
              <button
                key={conv.guest.id}
                onClick={() => onSelect(conv)}
                className={`flex w-full items-center gap-3 border-b border-[#f3f4f6] px-4 py-3.5 text-left transition
                  ${activa ? 'bg-[#f0fdfb]' : 'hover:bg-[#fafafa]'}`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold
                  ${activa ? 'bg-[#48C9B0] text-white' : 'bg-[#48C9B0]/15 text-[#1D9E75]'}`}>
                  {iniciales(conv.guest.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[#1D1E20]">{conv.guest.name}</span>
                    <span className="shrink-0 text-[10px] text-[#9ca3af]">{tiempoRelativo(conv.lastMessage.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-[#9ca3af]">{preview}</span>
                    <RsvpBadge status={conv.guest.rsvp_status} />
                  </div>
                  {conv.lastMessage.direction === 'sent' && (
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[#48C9B0]">
                      <Sparkles size={9} />
                      IA
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
 
// ─── PANEL CHAT — fuera del componente principal ──────────────────────────────
 
interface PanelChatProps {
  conv: Conversation
  mensaje: string
  enviando: boolean
  errorEnvio: string | null
  chatBottomRef: React.RefObject<HTMLDivElement | null>
  onMensajeChange: (v: string) => void
  onEnviar: () => void
  onToggleDetalles: () => void
}
 
function PanelChat({
  conv, mensaje, enviando, errorEnvio, chatBottomRef,
  onMensajeChange, onEnviar, onToggleDetalles
}: PanelChatProps) {
  const porFecha: { fecha: string; msgs: WaMessage[] }[] = []
  conv.messages.forEach(msg => {
    const fecha = new Date(msg.created_at).toDateString()
    const grupo = porFecha.find(g => g.fecha === fecha)
    if (grupo) grupo.msgs.push(msg)
    else porFecha.push({ fecha, msgs: [msg] })
  })
 
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[#e8e8e8] bg-white px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#48C9B0] text-sm font-semibold text-white">
          {iniciales(conv.guest.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[#1D1E20]">{conv.guest.name}</span>
            <RsvpBadge status={conv.guest.rsvp_status} />
          </div>
          <p className="text-xs text-[#9ca3af]">{conv.guest.phone}</p>
        </div>
        <button
          onClick={onToggleDetalles}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e8e8e8] text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0] xl:hidden"
        >
          <Info size={15} />
        </button>
      </div>
 
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto bg-[#fafafa] px-4 py-4">
        {porFecha.map(({ fecha, msgs }) => (
          <div key={fecha}>
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-[#e8e8e8]" />
              <span className="shrink-0 rounded-full bg-[#f0f0f0] px-3 py-0.5 text-[10px] font-medium text-[#9ca3af]">
                {formatFechaChat(msgs[0].created_at)}
              </span>
              <div className="flex-1 h-px bg-[#e8e8e8]" />
            </div>
            {msgs.map(msg => (
              <div key={msg.id} className={`mb-2 flex ${msg.direction === 'sent' ? 'justify-end' : 'justify-start'}`}>
                {msg.direction === 'sent' ? (
                  <div className="max-w-[75%]">
                    <div className="mb-0.5 flex items-center justify-end gap-1">
                      <Sparkles size={10} className="text-[#48C9B0]" />
                      <span className="text-[9px] font-medium text-[#48C9B0]">IA</span>
                    </div>
                    <div className="rounded-2xl rounded-tr-sm bg-[#48C9B0] px-3.5 py-2.5">
                      <p className="text-sm leading-relaxed text-white break-words">{msg.content}</p>
                      <div className="mt-1 flex justify-end">
                        <span className="text-[10px] text-white/60">{formatHora(msg.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[75%] rounded-2xl rounded-tl-sm border border-[#e8e8e8] bg-white px-3.5 py-2.5 shadow-sm">
                    <p className="text-sm leading-relaxed text-[#1D1E20] break-words">{msg.content}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Clock size={10} className="text-[#9ca3af]" />
                      <span className="text-[10px] text-[#9ca3af]">{formatHora(msg.created_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        <div ref={chatBottomRef} />
      </div>
 
      {/* Input */}
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
            className="flex-1 resize-none rounded-xl border border-[#e8e8e8] bg-[#fafafa] px-3.5 py-2.5 text-sm text-[#1D1E20] placeholder:text-[#bbb] focus:border-[#48C9B0] focus:outline-none"
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
 
// ─── PANEL DETALLES — fuera del componente principal ─────────────────────────
 
interface PanelDetallesProps {
  conv: Conversation
  mesa: TableAssignment | null
  cargandoMesa: boolean
  onClose: () => void
}
 
function PanelDetalles({ conv, mesa, cargandoMesa, onClose }: PanelDetallesProps) {
  const g = conv.guest
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
          {iniciales(g.name)}
        </div>
        <p className="mb-1.5 text-sm font-semibold text-[#1D1E20]">{g.name}</p>
        <RsvpBadge status={g.rsvp_status} size="md" />
      </div>
 
      <div className="flex-1 space-y-0 divide-y divide-[#f3f4f6] px-4">
        {g.side && (
          <div className="py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Lado</p>
            <p className="text-sm text-[#1D1E20]">{SIDE_LABEL[g.side] ?? g.side}</p>
          </div>
        )}
 
        <div className="py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Mesa</p>
          {cargandoMesa ? (
            <div className="h-4 w-16 animate-pulse rounded bg-[#f0f0f0]" />
          ) : mesa ? (
            <p className="text-sm font-medium text-[#1D1E20]">{mesa.table_name ?? `Mesa ${mesa.table_number}`}</p>
          ) : (
            <p className="text-sm text-[#bbb]">Sin asignar</p>
          )}
        </div>
 
        {g.tags && g.tags.length > 0 && (
          <div className="py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {g.tags.map(tag => (
                <span key={tag} className="rounded-full border border-[#e8e8e8] bg-[#f8f8f8] px-2.5 py-0.5 text-[11px] text-[#555]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
 
        {g.allergies && g.allergies.length > 0 && (
          <div className="py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Alergias</p>
            <div className="flex flex-wrap gap-1.5">
              {g.allergies.map(a => (
                <span key={a} className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-medium text-orange-700">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
 
        <div className="py-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-[#48C9B0]/20 bg-[#48C9B0]/8 p-3">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-[#48C9B0]" />
            <div>
              <p className="text-[11px] font-semibold text-[#1D9E75]">Agente IA activo</p>
              <p className="text-[11px] leading-relaxed text-[#6b7280]">
                Respondiendo automáticamente via webhook de Twilio.
              </p>
            </div>
          </div>
        </div>
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
 
  const [conversaciones, setConversaciones] = useState<Conversation[]>([])
  const [seleccionada, setSeleccionada]     = useState<Conversation | null>(null)
  const [cargando, setCargando]             = useState(true)
  const [mesa, setMesa]                     = useState<TableAssignment | null>(null)
  const [cargandoMesa, setCargandoMesa]     = useState(false)
  const [detallesOpen, setDetallesOpen]     = useState(false)
  const [mensaje, setMensaje]               = useState('')
  const [enviando, setEnviando]             = useState(false)
  const [errorEnvio, setErrorEnvio]         = useState<string | null>(null)
  const [busqueda, setBusqueda]             = useState('')
 
  const chatBottomRef = useRef<HTMLDivElement>(null)
 
  useEffect(() => {
    if (seleccionada) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    }
  }, [seleccionada?.guest.id, seleccionada?.messages.length])
 
  const cargar = useCallback(async () => {
    setCargando(true)
    const { data: mensajes } = await supabase
      .from('wa_messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
 
    if (!mensajes || mensajes.length === 0) { setCargando(false); return }
 
    const guestIds = [...new Set(mensajes.map((m: WaMessage) => m.guest_id))]
    const { data: guests } = await supabase
      .from('guests')
      .select('id, name, phone, rsvp_status, side, tags, allergies, event_id')
      .in('id', guestIds)
 
    if (!guests) { setCargando(false); return }
 
    const convs: Conversation[] = guestIds
      .map((gid) => {
        const guest = guests.find((g: Guest) => g.id === gid)
        if (!guest) return null
        const msgs = mensajes.filter((m: WaMessage) => m.guest_id === gid)
        return { guest, lastMessage: msgs[msgs.length - 1], messages: msgs }
      })
      .filter(Boolean) as Conversation[]
 
    convs.sort((a, b) =>
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    )
 
    setConversaciones(convs)
 
    if (seleccionada) {
      const actualizada = convs.find(c => c.guest.id === seleccionada.guest.id)
      if (actualizada) setSeleccionada(actualizada)
    }
 
    setCargando(false)
  }, [eventId, seleccionada?.guest.id])
 
  useEffect(() => { cargar() }, [eventId])
 
  useEffect(() => {
    if (!seleccionada) { setMesa(null); return }
    setCargandoMesa(true)
    supabase
      .from('table_seats')
      .select('tables(name, number)')
      .eq('guest_id', seleccionada.guest.id)
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
  }, [seleccionada?.guest.id])
 
  async function enviarMensaje() {
    if (!mensaje.trim() || !seleccionada || enviando) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: seleccionada.guest.id,
          eventId,
          phone:   seleccionada.guest.phone,
          message: mensaje.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? 'Error al enviar')
      }
      setMensaje('')
      await cargar()
    } catch (err: any) {
      setErrorEnvio(err?.message ?? 'No se pudo enviar el mensaje')
    } finally {
      setEnviando(false)
    }
  }
 
  const convsFiltradas = conversaciones.filter(c =>
    c.guest.name.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.guest.phone.includes(busqueda)
  )
 
  const totalEnviados = conversaciones.reduce(
    (acc, c) => acc + c.messages.filter(m => m.direction === 'sent').length, 0
  )
 
  return (
    <div className="flex h-full overflow-hidden bg-white text-[#1D1E20]">
 
      {/* COL 1 — Lista */}
      <div className={`
        w-full shrink-0 border-r border-[#e8e8e8]
        lg:w-[280px] xl:w-[300px]
        ${seleccionada ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}
      `}>
        <PanelLista
          cargando={cargando}
          convsFiltradas={convsFiltradas}
          seleccionada={seleccionada}
          busqueda={busqueda}
          totalEnviados={totalEnviados}
          onSelect={(conv) => { setSeleccionada(conv); setDetallesOpen(false) }}
          onBusqueda={setBusqueda}
        />
      </div>
 
      {/* COL 2 — Chat */}
      <div className={`flex-1 flex flex-col min-w-0 ${seleccionada ? 'flex' : 'hidden lg:flex'}`}>
        {seleccionada ? (
          <PanelChat
            conv={seleccionada}
            mensaje={mensaje}
            enviando={enviando}
            errorEnvio={errorEnvio}
            chatBottomRef={chatBottomRef}
            onMensajeChange={setMensaje}
            onEnviar={enviarMensaje}
            onToggleDetalles={() => setDetallesOpen(p => !p)}
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
              onClose={() => setDetallesOpen(false)}
            />
          </div>
        </>
      )}
 
    </div>
  )
}