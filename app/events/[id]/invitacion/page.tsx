'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Send, Check, LayoutGrid, Eye, X, Maximize2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { resolveDoc, setMeta } from '@/lib/invite/doc'
import type { InviteDoc } from '@/lib/invite/schema'
import { randomToken } from '@/lib/invite'
import { botonClass } from '@/lib/invite/theme-css'
import { parseDressCode, type DressCode } from '@/lib/dresscode'
import { getGuestItinerary } from '@/lib/guest-itinerary'
import type { GuestItineraryItem } from '@/lib/types'
import InvitacionRenderer from '@/app/components/invitacion/InvitacionRenderer'
import PreviewBoundary from '@/app/components/invitacion/PreviewBoundary'
import type { InviteCtx } from '@/app/components/invitacion/types'
import DatePicker from '@/app/components/ui/DatePicker'
import BlockEditor from './BlockEditor'
import RepartoLinks from './RepartoLinks'
import EstiloPanel from './EstiloPanel'
import PersonalizarPanel from './PersonalizarPanel'

type TabKey = 'diseno' | 'enviar'

type EventInfo = {
  name: string
  event_type: string | null
  event_date: string | null
  event_time: string | null
  venue: string | null
  address: string | null
  host_name: string | null
  host_name_2: string | null
}

async function safeSingle<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try {
    const { data, error } = await p
    return error ? null : data
  } catch {
    return null
  }
}


export default function InvitacionPage() {
  const { id } = useParams()
  const eventId = id as string

  const [doc, setDoc] = useState<InviteDoc | null>(null)
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [dressCode, setDressCode] = useState<DressCode | null>(null)
  const [playlistToken, setPlaylistToken] = useState<string | null>(null)
  const [registryToken, setRegistryToken] = useState<string | null>(null)
  const [itinerary, setItinerary] = useState<GuestItineraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('diseno')
  const [disenoSub, setDisenoSub] = useState<'estilo' | 'personalizar' | 'contenido'>('estilo')
  const [previewMode, setPreviewMode] = useState<'movil' | 'escritorio'>('movil')
  const [showPreview, setShowPreview] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const load = async () => {
      const [ev, inviteRow, dressRow, itinRows] = await Promise.all([
        supabase
          .from('events')
          .select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2')
          .eq('id', eventId)
          .single(),
        safeSingle<{ invite_config: unknown; playlist_token: string | null; registry_token: string | null }>(
          supabase.from('event_settings').select('invite_config, playlist_token, registry_token').eq('event_id', eventId).maybeSingle(),
        ),
        safeSingle<{ dress_code: unknown }>(
          supabase.from('event_settings').select('dress_code').eq('event_id', eventId).maybeSingle(),
        ),
        getGuestItinerary(eventId),
      ])
      if (ev.data) setEvent(ev.data)
      setDressCode(parseDressCode(dressRow?.dress_code))
      setPlaylistToken(inviteRow?.playlist_token ?? null)
      setRegistryToken(inviteRow?.registry_token ?? null)
      setItinerary(itinRows)
      setDoc(resolveDoc(inviteRow?.invite_config, () => crypto.randomUUID()))
    }
    load().finally(() => setLoading(false))
  }, [eventId])

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }, [])

  useEffect(() => {
    if (!showPreview) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPreview(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [showPreview])

  const persist = useCallback(async (next: InviteDoc) => {
    setSaving(true)
    try {
      await supabase
        .from('event_settings')
        .upsert({ event_id: eventId, invite_config: next, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [eventId])

  const updateDoc = (next: InviteDoc) => {
    setDoc(next)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => persist(next), 800)
  }

  const handlePublish = async () => {
    if (!doc) return
    const next = setMeta(doc, { publicada: true })
    setDoc(next)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setPublishing(true)
    try {
      await persist(next)
      const { data: pending, error } = await supabase
        .from('guests')
        .select('id')
        .eq('event_id', eventId)
        .is('rsvp_token', null)
      if (!error && pending && pending.length > 0) {
        await Promise.all(
          pending.map(g => supabase.from('guests').update({ rsvp_token: randomToken() }).eq('id', g.id)),
        )
      }
    } catch {
      // rsvp_token puede no existir aun si el SQL de la feature no se ha corrido; no bloquea publicar
    } finally {
      setPublishing(false)
    }
  }

  if (loading || !doc) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#888]">
        No se pudo cargar el evento. Recarga la página o vuelve al inicio.
      </div>
    )
  }

  const sampleCtx: InviteCtx = {
    event,
    guest: { name: 'Invitado de ejemplo', party_size: 2, rsvp_status: 'pending', allergies: [] },
    companions: [
      { name: 'Acompañante', rsvp_status: 'pending', allergies: [] },
    ],
    dressCode,
    itinerary,
    tokens: { playlist: playlistToken, registry: registryToken },
    mode: 'preview',
    onSubmit: undefined,
    deadlinePassed: false,
    botonClassName: botonClass(doc.theme),
  }

  const badgeClass = doc.meta.publicada
    ? 'border-[#c8ede7] bg-[#f0fdfb] text-[#1a9e88]'
    : 'border-[#e0e0e0] bg-[#f8f8f8] text-[#888]'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="shrink-0 border-b border-[#e8e8e8] bg-white px-4 pt-4 pb-4 sm:px-6 sm:pt-5 lg:px-10 lg:pt-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#1D1E20]">Invitación</h1>
            <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${doc.meta.publicada ? 'bg-[#48C9B0]' : 'bg-[#bbb]'}`} />
              {doc.meta.publicada ? 'Publicada' : 'Borrador'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[#888] sm:text-sm">Arma la invitación digital que verán tus invitados.</p>
        </div>

        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex w-full overflow-hidden rounded-lg border border-[#e0e0e0] sm:w-auto">
            <button
              onClick={() => setActiveTab('diseno')}
              className={['flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition sm:flex-none sm:py-1.5', activeTab === 'diseno' ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#f5f5f5]'].join(' ')}
            >
              <LayoutGrid width={13} height={13} /><span>Diseño</span>
            </button>
            <button
              onClick={() => setActiveTab('enviar')}
              className={['flex flex-1 items-center justify-center gap-1.5 border-l border-[#e0e0e0] px-3 py-2 text-xs font-medium transition sm:flex-none sm:py-1.5', activeTab === 'enviar' ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#f5f5f5]'].join(' ')}
            >
              <Send width={13} height={13} /><span>Enviar</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden shrink-0 text-xs text-[#888] sm:inline">Fecha límite</span>
            <div className="flex-1 sm:w-36 sm:flex-none">
              <DatePicker
                value={doc.meta.fecha_limite ?? ''}
                onChange={v => updateDoc(setMeta(doc, { fecha_limite: v || null }))}
                placeholder="Sin límite"
              />
            </div>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm"
            >
              {publishing ? (
                'Publicando...'
              ) : doc.meta.publicada ? (
                <><Check size={14} /> Publicada</>
              ) : (
                <><Send size={14} /> Publicar</>
              )}
            </button>
            <span className="hidden w-14 shrink-0 text-right text-xs text-[#aaa] sm:inline">
              {saved ? 'Guardado' : saving ? 'Guardando...' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-6 lg:px-10">
        {activeTab === 'diseno' ? (
          <div className="grid items-start gap-6 sm:grid-cols-[1fr_360px] lg:gap-8">
            <div className="min-w-0">
              <div className="mb-5 flex gap-6 border-b border-[#eee]">
                {([
                  ['estilo', 'Plantillas'],
                  ['personalizar', 'Personalizar'],
                  ['contenido', 'Contenido'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDisenoSub(key)}
                    className={['-mb-px border-b-2 pb-2.5 text-sm font-semibold transition', disenoSub === key ? 'border-[#48C9B0] text-[#1D1E20]' : 'border-transparent text-[#999] hover:text-[#666]'].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {disenoSub === 'estilo' && <EstiloPanel doc={doc} onChange={updateDoc} />}
              {disenoSub === 'personalizar' && <PersonalizarPanel doc={doc} onChange={updateDoc} />}
              {disenoSub === 'contenido' && <BlockEditor doc={doc} onChange={updateDoc} makeId={() => crypto.randomUUID()} />}
            </div>

            <div className="hidden sm:sticky sm:top-0 sm:block">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#999]">Vista previa</p>
                <button onClick={() => { setPreviewMode('escritorio'); setShowPreview(true) }} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#999] transition hover:text-[#48C9B0]">
                  <Maximize2 size={12} /> Escritorio
                </button>
              </div>
              <div className="flex justify-center">
                <div className="w-full max-w-[360px] overflow-hidden rounded-[2.5rem] border-[10px] border-[#1D1E20] bg-[#1D1E20] shadow-xl">
                  <div className="h-[calc(100dvh-18rem)] max-h-[720px] min-h-[420px] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <PreviewBoundary>
                      <InvitacionRenderer doc={doc} ctx={{ ...sampleCtx, forceMobile: true }} />
                    </PreviewBoundary>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <RepartoLinks eventId={eventId} event={event} />
        )}
      </div>

      {activeTab === 'diseno' && (
        <button
          onClick={() => { setPreviewMode('movil'); setShowPreview(true) }}
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-[#1D1E20] px-4 py-3 text-sm font-semibold text-white shadow-lg sm:hidden"
        >
          <Eye size={16} /> Vista previa
        </button>
      )}

      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[#FBF7F0]"
          >
            <button
              onClick={() => setShowPreview(false)}
              aria-label="Cerrar vista previa"
              className="fixed right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#1D1E20]/85 text-white shadow-lg backdrop-blur transition hover:bg-[#1D1E20]"
              style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
            >
              <X size={18} />
            </button>
            <div className="h-full overflow-y-auto overflow-x-hidden overscroll-contain">
              <div className={previewMode === 'movil' ? 'mx-auto min-h-full w-full max-w-[420px] shadow-2xl' : 'min-h-full w-full'}>
                <PreviewBoundary>
                  <InvitacionRenderer doc={doc} ctx={{ ...sampleCtx, forceMobile: previewMode === 'movil' }} />
                </PreviewBoundary>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
