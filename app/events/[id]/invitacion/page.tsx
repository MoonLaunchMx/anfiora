'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Send, Check, Paintbrush, Eye, X, Maximize2, Plus, RotateCcw, AlertTriangle, Users } from 'lucide-react'
import { TabToggle, type TabItem } from '@/app/components/ui/TabToggle'
import { Modal } from '@/app/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { resolveDoc, setMeta, seedAccessFromColumns } from '@/lib/invite/doc'
import { estadoPublicacion } from '@/lib/invite/publicacion'
import type { InviteDoc } from '@/lib/invite/schema'
import { randomToken } from '@/lib/invite'
import { botonClass } from '@/lib/invite/theme-css'
import { parseDressCode, type DressCode } from '@/lib/dresscode'
import { getGuestItinerary } from '@/lib/guest-itinerary'
import { resolveAccessMode } from '@/lib/features'
import type { GuestItineraryItem } from '@/lib/types'
import InvitacionRenderer from '@/app/components/invitacion/InvitacionRenderer'
import PreviewBoundary from '@/app/components/invitacion/PreviewBoundary'
import type { InviteCtx } from '@/app/components/invitacion/types'
import DatePicker from '@/app/components/ui/DatePicker'
import BlockEditor from './BlockEditor'
import RepartoLinks from './RepartoLinks'
import AccesoPanel from './AccesoPanel'
import { useSalidaGuard } from '../SalidaGuardProvider'
import EstiloPanel from './EstiloPanel'
import PersonalizarPanel from './PersonalizarPanel'

type TabKey = 'diseno' | 'enviar' | 'config'

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

// meta.access viene vacio en docs viejos (el schema lo rellena con null/[]);
// asi se distingue de un evento que de verdad nunca tuvo cupo/precio/acompanantes.
function accessIsEmpty(access: InviteDoc['meta']['access']): boolean {
  return access.guest_cap === null && access.ticket_price === null && access.max_companions === null
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
  const [publishedDoc, setPublishedDoc] = useState<InviteDoc | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
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
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [previewMode, setPreviewMode] = useState<'movil' | 'escritorio'>('movil')
  const [showPreview, setShowPreview] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const salidaGuard = useSalidaGuard()
  const publishRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    const load = async () => {
      const [ev, inviteRow, dressRow, itinRows] = await Promise.all([
        supabase
          .from('events')
          .select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2, guest_cap, ticket_price')
          .eq('id', eventId)
          .single(),
        safeSingle<{ invite_config: unknown; invite_draft: unknown; playlist_token: string | null; registry_token: string | null; max_companions: number | null }>(
          supabase.from('event_settings').select('invite_config, invite_draft, playlist_token, registry_token, max_companions').eq('event_id', eventId).maybeSingle(),
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
      // El editor edita el BORRADOR; los invitados ven lo PUBLICADO (invite_config).
      // Si el borrador aun no existe (evento previo a la migracion), arranca de lo publicado.
      const draftRaw = inviteRow?.invite_draft ?? inviteRow?.invite_config
      let draftDoc = resolveDoc(draftRaw, () => crypto.randomUUID())
      let configDoc = resolveDoc(inviteRow?.invite_config, () => crypto.randomUUID())
      // Seed: eventos que ya tenian cupo/precio/acompanantes en columnas (modelo
      // previo a esta feature) nunca tuvieron meta.access en NINGUNO de los dos
      // docs. Se siembra en draft Y config para que publicar los preserve (en
      // vez de ponerlos en null) y para que abrir el editor no invente un
      // "cambios sin publicar" de la nada. Cada doc se siembra POR SEPARADO:
      // un objeto compartido pisaria la cuenta de cobro (cobro_payment_methods)
      // del doc publicado con la del borrador.
      if (accessIsEmpty(draftDoc.meta.access) && accessIsEmpty(configDoc.meta.access)) {
        const cols = {
          guest_cap: ev.data?.guest_cap ?? null,
          ticket_price: ev.data?.ticket_price ?? null,
          max_companions: inviteRow?.max_companions ?? null,
        }
        draftDoc = seedAccessFromColumns(draftDoc, cols)
        configDoc = seedAccessFromColumns(configDoc, cols)
      }
      setDoc(draftDoc)
      setPublishedDoc(configDoc)
    }
    load().finally(() => setLoading(false))
  }, [eventId])

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }, [])

  // Guardian de salida + aviso del navegador: solo con cambios sin publicar.
  useEffect(() => {
    const dirty = !!doc && !!publishedDoc && estadoPublicacion(doc, publishedDoc) === 'cambios'
    salidaGuard?.registrar({ dirty, publish: () => publishRef.current() })
    if (!dirty) return () => salidaGuard?.registrar(null)
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      salidaGuard?.registrar(null)
    }
  }, [doc, publishedDoc, salidaGuard])

  useEffect(() => { if (disenoSub !== 'contenido') setAddSectionOpen(false) }, [disenoSub])

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

  // El autosave escribe SOLO al borrador. Lo publicado (invite_config) no se
  // toca hasta que el anfitrion publica: es lo que evita que cada edicion salga
  // en vivo a los links ya repartidos.
  const persist = useCallback(async (next: InviteDoc) => {
    setSaving(true)
    try {
      await supabase
        .from('event_settings')
        .upsert({ event_id: eventId, invite_draft: next, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
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

  // Descartar: el borrador vuelve a lo publicado. Se pierde lo editado desde
  // la ultima publicacion. Solo aparece cuando hay cambios sin publicar.
  const handleDiscard = async () => {
    if (!publishedDoc) return
    setDiscardOpen(false)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setDoc(publishedDoc)
    await persist(publishedDoc)
  }

  const handlePublish = async () => {
    if (!doc) return
    const next = setMeta(doc, { publicada: true })
    setDoc(next)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setPublishing(true)
    try {
      // Publicar copia el borrador ENCIMA de lo publicado y sincroniza ambos,
      // para que el estado vuelva a "Publicada" (draft == config).
      await supabase
        .from('event_settings')
        .upsert({ event_id: eventId, invite_config: next, invite_draft: next, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
      setPublishedDoc(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)

      // Leer access_mode para determinar si se escriben columnas de cupo/precio.
      // Si el evento es privada, las columnas van a null.
      const { data: settings } = await supabase
        .from('event_settings')
        .select('shared_token, access_mode')
        .eq('event_id', eventId)
        .maybeSingle()
      const esPublica = resolveAccessMode(event?.event_type ?? null, settings?.access_mode) === 'publica'

      // Cupo/precio/acompanantes se CUENTAN/FILTRAN en el endpoint de registro,
      // por eso su valor publicado sigue viviendo en columnas ademas del doc.
      // PERO: solo cuando el evento es publica. Si es privada, las columnas son null.
      // cobro_payment_methods solo se pinta: viaja dentro de invite_config, sin columna.
      await supabase
        .from('events')
        .update({
          guest_cap: esPublica ? next.meta.access.guest_cap : null,
          ticket_price: esPublica ? next.meta.access.ticket_price : null
        })
        .eq('id', eventId)
      await supabase
        .from('event_settings')
        .update({
          max_companions: esPublica ? next.meta.access.max_companions : null
        })
        .eq('event_id', eventId)

      // El token de la puerta publica nace con la invitacion publicada. El
      // .is(null) del update es la red: si se publica dos veces (o desde dos
      // pestanas), el token NO se regenera y los links repartidos siguen vivos.
      if (settings && !settings.shared_token) {
        await supabase
          .from('event_settings')
          .update({ shared_token: randomToken() })
          .eq('event_id', eventId)
          .is('shared_token', null)
      }

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
  // El guardian llama publish sin cerrar sobre un doc viejo: siempre el actual.
  publishRef.current = handlePublish

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

  const estado = estadoPublicacion(doc, publishedDoc ?? doc)
  const sello = {
    borrador:  { cls: 'border-[#e0e0e0] bg-[#f8f8f8] text-[#888]',    dot: 'bg-[#bbb]',     label: 'Borrador' },
    publicada: { cls: 'border-[#c8ede7] bg-[#f0fdfb] text-[#1a9e88]', dot: 'bg-[#48C9B0]',  label: 'Publicada' },
    cambios:   { cls: 'border-[#f0e2c0] bg-[#fffbf0] text-[#8a6d1f]', dot: 'bg-[#d4a853]',  label: 'Cambios sin publicar' },
  }[estado]

  const INVITE_TABS: TabItem[] = [
    { key: 'config', label: 'Acceso', icon: Users },
    { key: 'diseno', label: 'Diseño', icon: Paintbrush },
    { key: 'enviar', label: 'Enviar', icon: Send },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="shrink-0 border-b border-[#e8e8e8] bg-white px-4 pt-4 pb-4 sm:px-6 sm:pt-5 lg:px-10 lg:pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {/* Izquierda: titulo + estado + subtitulo */}
          <div className="min-w-0 sm:shrink">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#1D1E20]">Invitación</h1>
              <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sello.cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sello.dot}`} />
                {sello.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#888] sm:text-sm">Arma la invitación digital que verán tus invitados.</p>
          </div>

          {/* Centro: pestanas al nivel del titulo */}
          <div className="flex justify-center overflow-x-auto sm:flex-1">
            <TabToggle tabs={INVITE_TABS} active={activeTab} onChange={(k) => setActiveTab(k as TabKey)} />
          </div>

          {/* Derecha: fecha limite + acciones */}
          <div className="flex items-center gap-2.5 sm:shrink-0">
            <span className="hidden shrink-0 text-xs text-[#888] sm:inline">Fecha límite</span>
            <div className="flex-1 sm:w-36 sm:flex-none">
              <DatePicker
                value={doc.meta.fecha_limite ?? ''}
                onChange={v => updateDoc(setMeta(doc, { fecha_limite: v || null }))}
                placeholder="Sin límite"
              />
            </div>
            {estado === 'cambios' && (
              <button
                onClick={() => setDiscardOpen(true)}
                disabled={publishing}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-[#a06b6b] transition hover:bg-[#fbf1f1] hover:text-[#cc3333] disabled:opacity-60"
              >
                <RotateCcw size={13} /> Descartar
              </button>
            )}
            <button
              onClick={handlePublish}
              disabled={publishing || estado === 'publicada'}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3ab89f] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm"
            >
              {publishing ? (
                'Publicando...'
              ) : estado === 'publicada' ? (
                <><Check size={14} /> Publicada</>
              ) : estado === 'cambios' ? (
                <><Send size={14} /> Publicar cambios</>
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

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {activeTab === 'diseno' ? (
          <div className="grid gap-6 sm:h-full sm:min-h-0 sm:grid-rows-1 sm:grid-cols-[1fr_360px] lg:gap-8">
            <div className="min-w-0 pb-6 sm:h-full sm:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="sticky top-0 z-20 mb-5 flex items-end justify-between gap-4 border-b border-[#eee] bg-white pt-5">
                <div className="flex gap-6">
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
                {disenoSub === 'contenido' && (
                  <button
                    type="button"
                    onClick={() => setAddSectionOpen(true)}
                    aria-label="Agregar sección"
                    className="mb-1.5 flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-[#ccc] px-2.5 py-2 text-xs font-medium text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0] md:py-1.5"
                  >
                    <Plus size={16} />
                    <span className="hidden md:inline">Agregar sección</span>
                  </button>
                )}
              </div>
              {disenoSub === 'estilo' && <EstiloPanel doc={doc} onChange={updateDoc} />}
              {disenoSub === 'personalizar' && <PersonalizarPanel doc={doc} onChange={updateDoc} />}
              {disenoSub === 'contenido' && <BlockEditor doc={doc} onChange={updateDoc} makeId={() => crypto.randomUUID()} addOpen={addSectionOpen} onAddOpenChange={setAddSectionOpen} />}
            </div>

            <div className="hidden sm:flex sm:h-full sm:flex-col sm:pt-5 sm:pb-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#999]">Vista previa</p>
                <button onClick={() => { setPreviewMode('escritorio'); setShowPreview(true) }} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#999] transition hover:text-[#48C9B0]">
                  <Maximize2 size={12} /> Escritorio
                </button>
              </div>
              <div className="flex flex-1 min-h-0 justify-center">
                <div className="h-full w-full max-w-[360px] overflow-hidden rounded-[2.5rem] border-[10px] border-[#1D1E20] bg-[#1D1E20] shadow-xl">
                  <div className="h-full min-h-[420px] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <PreviewBoundary>
                      <InvitacionRenderer doc={doc} ctx={{ ...sampleCtx, forceMobile: true }} />
                    </PreviewBoundary>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'enviar' ? (
          <div className="pt-5 pb-6">
            <RepartoLinks eventId={eventId} event={event} />
          </div>
        ) : (
          <div className="pt-5 pb-6">
            <AccesoPanel eventId={eventId} event={event} doc={doc} onChange={updateDoc} />
          </div>
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

      <Modal open={discardOpen} onClose={() => setDiscardOpen(false)} size="sm">
        <Modal.Header title="¿Descartar los cambios?" />
        <Modal.Body>
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff0f0]">
              <AlertTriangle size={17} className="text-[#cc3333]" />
            </div>
            <p className="text-sm leading-relaxed text-[#666]">
              Tu invitación volverá a la última versión publicada. Lo que editaste desde entonces se pierde.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex w-full flex-col gap-2">
            <button
              onClick={handleDiscard}
              className="rounded-lg bg-[#cc3333] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#b82d2d]"
            >
              Descartar cambios
            </button>
            <button
              onClick={() => setDiscardOpen(false)}
              className="rounded-lg px-4 py-2 text-xs font-medium text-[#999] transition hover:bg-[#f5f5f5]"
            >
              Cancelar
            </button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
