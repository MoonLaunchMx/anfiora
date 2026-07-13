'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { Upload, X, CheckCircle2, Mic, Square, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Section } from '@/lib/invite/schema'
import { parseVideoUrl } from '@/lib/invite/video'
import { parseDriveUrl } from '@/lib/invite/drive'
import { pickAudioMime, extForMime, formatTimer } from '@/lib/invite/audio-recording'
import { addFotos, removeFotoAt, moveFoto, MAX_GALERIA_FOTOS } from '@/lib/invite/galeria'
import { supabase } from '@/lib/supabase'
import GifSearch from './GifSearch'

const PROVIDER_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  drive: 'Google Drive',
}

const MAX_RECORDING_SECONDS = 60

type UploadResult = { url: string; error?: undefined } | { url?: undefined; error: string }

async function uploadAudioToBucket(eventId: string, blob: Blob, filename: string): Promise<UploadResult> {
  const safe = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const path = `audio/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`
  const { error } = await supabase.storage.from('event-media').upload(path, blob, {
    upsert: false,
    contentType: blob.type || undefined,
  })
  if (error) return { error: 'No se pudo subir el audio. Intenta de nuevo.' }
  return { url: supabase.storage.from('event-media').getPublicUrl(path).data.publicUrl }
}

async function uploadImageToBucket(eventId: string, file: File): Promise<UploadResult> {
  const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const path = `imagenes/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`
  const { error } = await supabase.storage.from('event-media').upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) return { error: 'No se pudo subir la imagen. Intenta de nuevo.' }
  return { url: supabase.storage.from('event-media').getPublicUrl(path).data.publicUrl }
}

function ImageUploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
  const { id } = useParams()
  const eventId = String(id)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const upload = async (file: File) => {
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('Elige un archivo de imagen.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('La imagen no debe pesar más de 15 MB.')
      return
    }
    setUploading(true)
    const res = await uploadImageToBucket(eventId, file)
    setUploading(false)
    if (res.error) setError(res.error)
    else if (res.url) onUploaded(res.url)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#ccc] bg-white px-2 py-2.5 text-center text-xs font-medium text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
        <Upload size={14} />
        {uploading ? 'Subiendo...' : 'Subir imagen (galería o cámara)'}
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
          className="hidden"
        />
      </label>
      {error && <p className="text-[11px] text-[#cc3333]">{error}</p>}
    </div>
  )
}

function GaleriaField({
  fotos,
  titulo,
  onPatch,
}: {
  fotos: string[]
  titulo: string
  onPatch: (patch: Record<string, unknown>) => void
}) {
  const { id } = useParams()
  const eventId = String(id)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const full = fotos.length >= MAX_GALERIA_FOTOS

  const uploadFiles = async (fileList: FileList) => {
    setError('')
    const room = MAX_GALERIA_FOTOS - fotos.length
    if (room <= 0) return
    const picked = Array.from(fileList).slice(0, room)
    setUploading(true)
    const urls: string[] = []
    for (const file of picked) {
      if (!file.type.startsWith('image/')) { setError('Solo se pueden subir imágenes.'); continue }
      if (file.size > 15 * 1024 * 1024) { setError('Cada foto debe pesar menos de 15 MB.'); continue }
      const res = await uploadImageToBucket(eventId, file)
      if (res.error) setError(res.error)
      else if (res.url) urls.push(res.url)
    }
    setUploading(false)
    if (urls.length) onPatch({ fotos: addFotos(fotos, urls) })
  }

  return (
    <div className="flex flex-col gap-3">
      <TextField label="Título opcional" value={titulo} onChange={v => onPatch({ titulo: v })} placeholder="Nuestros momentos" />

      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {fotos.map((url, i) => (
            <div key={`${url}-${i}`} className="relative overflow-hidden rounded-lg border border-[#e0e0e0] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-[4/5] w-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => onPatch({ fotos: removeFotoAt(fotos, i) })}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                aria-label="Quitar foto"
              >
                <X size={13} />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/50 to-transparent px-1 py-1">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => onPatch({ fotos: moveFoto(fotos, i, -1) })}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white transition hover:bg-white/20 disabled:opacity-30"
                  aria-label="Mover a la izquierda"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  disabled={i === fotos.length - 1}
                  onClick={() => onPatch({ fotos: moveFoto(fotos, i, 1) })}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white transition hover:bg-white/20 disabled:opacity-30"
                  aria-label="Mover a la derecha"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {full ? (
        <p className="text-[11px] text-[#999]">Máximo {MAX_GALERIA_FOTOS} fotos.</p>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#ccc] bg-white px-2 py-2.5 text-center text-xs font-medium text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
          <Upload size={14} />
          {uploading ? 'Subiendo...' : 'Agregar fotos (galería o cámara)'}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={e => { const fs = e.target.files; if (fs && fs.length) uploadFiles(fs); e.target.value = '' }}
            className="hidden"
          />
        </label>
      )}
      {error && <p className="text-[11px] text-[#cc3333]">{error}</p>}
    </div>
  )
}

function useVoiceRecorder(eventId: string, onUploaded: (url: string) => void) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'recorded'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [localUrl, setLocalUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const blobRef = useRef<Blob | null>(null)
  const mimeRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const supported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => () => {
    clearTimer()
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl) }, [localUrl])

  const stop = useCallback(() => {
    clearTimer()
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  useEffect(() => {
    if (phase === 'recording' && seconds >= MAX_RECORDING_SECONDS) stop()
  }, [phase, seconds, stop])

  const start = async () => {
    setError('')
    if (!supported) {
      setError('Tu navegador no permite grabar audio. Usa subir clip o Google Drive.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickAudioMime(m => MediaRecorder.isTypeSupported(m))
      mimeRef.current = mime
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const type = mimeRef.current || rec.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        blobRef.current = blob
        setLocalUrl(URL.createObjectURL(blob))
        setPhase('recorded')
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      recorderRef.current = rec
      rec.start()
      setSeconds(0)
      setPhase('recording')
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setError('No pudimos acceder al micrófono. Revisa los permisos del navegador.')
      setPhase('idle')
    }
  }

  const regrabar = () => {
    setLocalUrl(null)
    blobRef.current = null
    setSeconds(0)
    setError('')
    setPhase('idle')
  }

  const confirm = async () => {
    if (!blobRef.current) return
    setUploading(true)
    setError('')
    const ext = extForMime(mimeRef.current || blobRef.current.type)
    const res = await uploadAudioToBucket(eventId, blobRef.current, `voicenote.${ext}`)
    setUploading(false)
    if (res.error) { setError(res.error); return }
    if (res.url) onUploaded(res.url)
  }

  return { phase, seconds, localUrl, uploading, error, supported, start, stop, regrabar, confirm }
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

function MoreOptions({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 self-start text-xs font-medium text-[#888] transition hover:text-[#48C9B0]"
      >
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        Más opciones
      </button>
      {open && <div className="flex flex-col gap-3">{children}</div>}
    </div>
  )
}

function AudioUploadField({
  url, onChange,
}: {
  url: string
  onChange: (v: string) => void
}) {
  const { id } = useParams()
  const eventId = String(id)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const rec = useVoiceRecorder(eventId, onChange)

  const upload = async (file: File) => {
    setError('')
    if (file.size > 15 * 1024 * 1024) {
      setError('El clip no debe pesar más de 15 MB.')
      return
    }
    setUploading(true)
    const res = await uploadAudioToBucket(eventId, file, file.name)
    setUploading(false)
    if (res.error) setError(res.error)
    else if (res.url) onChange(res.url)
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#555]">Audio de la invitación (voz, coro, 20-40 seg)</label>
      {url ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[#e0e0e0] bg-white p-2.5">
          <audio key={url} src={url} controls preload="none" className="w-full" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex items-center gap-1 self-start text-xs text-[#cc3333] transition hover:underline"
          >
            <X size={12} /> Quitar audio
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#ccc] bg-white px-2 py-2.5 text-center text-xs font-medium text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
              <Upload size={14} />
              {uploading ? 'Subiendo...' : 'Subir clip'}
              <input
                type="file"
                accept="audio/*"
                disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={rec.start}
              disabled={rec.phase !== 'idle'}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#ccc] bg-white px-2 py-2.5 text-xs font-medium text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0] disabled:opacity-50"
            >
              <Mic size={14} /> Grabar voz
            </button>
          </div>

          {rec.phase === 'recording' && (
            <div className="flex items-center gap-3 rounded-lg border border-[#f0c8c8] bg-[#fff6f6] px-3 py-2.5">
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#e11d1d]" />
              <span className="flex-1 text-xs font-medium text-[#cc3333]">Grabando… {formatTimer(rec.seconds)}</span>
              <button
                type="button"
                onClick={rec.stop}
                className="flex items-center gap-1.5 rounded-lg bg-[#cc3333] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b82d2d]"
              >
                <Square size={12} fill="currentColor" /> Detener
              </button>
            </div>
          )}

          {rec.phase === 'recorded' && rec.localUrl && (
            <div className="flex flex-col gap-2 rounded-lg border border-[#e0e0e0] bg-white p-2.5">
              <audio key={rec.localUrl} src={rec.localUrl} controls className="w-full" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={rec.regrabar}
                  disabled={rec.uploading}
                  className="flex items-center gap-1 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0] disabled:opacity-50"
                >
                  <Mic size={12} /> Regrabar
                </button>
                <button
                  type="button"
                  onClick={rec.confirm}
                  disabled={rec.uploading}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-50"
                >
                  {rec.uploading ? 'Guardando…' : 'Usar esta grabación'}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-[11px] text-[#cc3333]">{error}</p>}
          {rec.error && <p className="text-[11px] text-[#b8912f]">{rec.error}</p>}
          {rec.phase === 'idle' && !error && !rec.error && (
            <p className="text-[11px] text-[#999]">La grabación se detiene sola al minuto y pide permiso del micrófono.</p>
          )}
        </div>
      )}
    </div>
  )
}

function TextField({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#555]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#d0d0d0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
      />
    </div>
  )
}

function TextAreaField({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#555]">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-none rounded-lg border border-[#d0d0d0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
      />
    </div>
  )
}

function ToggleField({
  label, value, onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs font-medium text-[#555]">{label}</p>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors
          ${value ? 'bg-[#48C9B0]' : 'bg-[#d8d8d8]'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
            ${value ? 'translate-x-5' : 'translate-x-1'}`}
        />
      </button>
    </div>
  )
}

export default function SectionForm({
  section, onPatch,
}: {
  section: Section
  onPatch: (patch: Record<string, unknown>) => void
}) {
  switch (section.type) {
    case 'portada':
      return (
        <div className="flex flex-col gap-3">
          <FieldRow>
            <TextField label="Texto pequeño arriba" value={section.content.kicker} onChange={v => onPatch({ kicker: v })} placeholder="Nuestra boda" />
            <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} placeholder="Nombre de los anfitriones" />
          </FieldRow>
          <TextAreaField label="Subtítulo" value={section.content.subtitulo} onChange={v => onPatch({ subtitulo: v })} placeholder="Una frase corta de bienvenida" />
        </div>
      )
    case 'saludo':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <TextAreaField label="Mensaje" value={section.content.mensaje} onChange={v => onPatch({ mensaje: v })} />
        </div>
      )
    case 'detalles':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <ToggleField label="Mostrar botón de Google Maps" value={section.content.mostrar_mapa} onChange={v => onPatch({ mostrar_mapa: v })} />
          {section.content.mostrar_mapa && (
            <>
              <TextField label="Enlace de Google Maps (opcional)" value={section.content.maps_url} onChange={v => onPatch({ maps_url: v })} placeholder="Pega un link de Maps o déjalo vacío" />
              <p className="text-xs text-[#999]">Si lo dejas vacío, usamos la dirección del evento.</p>
            </>
          )}
          <p className="text-xs text-[#999]">Los datos (fecha, hora, lugar, dirección) se toman del evento.</p>
        </div>
      )
    case 'dress_code':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <p className="text-xs text-[#999]">El contenido se toma de la configuración de vestimenta del evento.</p>
        </div>
      )
    case 'itinerario':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <p className="text-xs text-[#999]">El contenido se toma del itinerario del evento.</p>
        </div>
      )
    case 'rsvp':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <TextAreaField label="Texto" value={section.content.texto} onChange={v => onPatch({ texto: v })} />
        </div>
      )
    case 'enganche':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <ToggleField label="Mostrar playlist" value={section.content.mostrar_playlist} onChange={v => onPatch({ mostrar_playlist: v })} />
          <ToggleField label="Mostrar mesa de regalos" value={section.content.mostrar_mesa} onChange={v => onPatch({ mostrar_mesa: v })} />
        </div>
      )
    case 'playlist':
      return (
        <div className="flex flex-col gap-3">
          <FieldRow>
            <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
            <TextField label="Descripción" value={section.content.descripcion} onChange={v => onPatch({ descripcion: v })} />
          </FieldRow>
          <p className="text-xs text-[#999]">Se muestra cuando el evento tiene playlist activa.</p>
        </div>
      )
    case 'mesa':
      return (
        <div className="flex flex-col gap-3">
          <FieldRow>
            <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
            <TextField label="Descripción" value={section.content.descripcion} onChange={v => onPatch({ descripcion: v })} />
          </FieldRow>
          <p className="text-xs text-[#999]">Se muestra cuando el evento tiene mesa de regalos activa.</p>
        </div>
      )
    case 'texto':
      return (
        <div className="flex flex-col gap-3">
          <FieldRow>
            <TextField label="Texto pequeño arriba" value={section.content.eyebrow} onChange={v => onPatch({ eyebrow: v })} />
            <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          </FieldRow>
          <TextAreaField label="Cuerpo" value={section.content.cuerpo} onChange={v => onPatch({ cuerpo: v })} />
        </div>
      )
    case 'cierre':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <p className="text-xs text-[#999]">La firma usa los nombres del evento (los mismos de la portada).</p>
        </div>
      )
    case 'media':
      return (
        <div className="flex flex-col gap-3">
          {section.content.url ? (
            <div className="flex flex-col gap-2 rounded-lg border border-[#e0e0e0] bg-white p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={section.content.url} alt="" className="max-h-40 w-full rounded-md object-contain" />
              <button
                type="button"
                onClick={() => onPatch({ url: '' })}
                className="flex items-center gap-1 self-start text-xs text-[#cc3333] transition hover:underline"
              >
                <X size={12} /> Quitar
              </button>
            </div>
          ) : (
            <>
              <ImageUploadButton onUploaded={url => onPatch({ url })} />
              <GifSearch onSelect={url => onPatch({ url })} />
            </>
          )}
          <MoreOptions>
            <TextField label="Texto opcional (pie)" value={section.content.caption} onChange={v => onPatch({ caption: v })} placeholder="Un pie de foto" />
          </MoreOptions>
        </div>
      )
    case 'galeria':
      return <GaleriaField fotos={section.content.fotos} titulo={section.content.titulo} onPatch={onPatch} />
    case 'video': {
      const parsed = parseVideoUrl(section.content.url)
      const hasUrl = section.content.url.trim().length > 0
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Enlace del video" value={section.content.url} onChange={v => onPatch({ url: v })} placeholder="YouTube, TikTok, Instagram o Google Drive" />
          {hasUrl && parsed && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#2a7a50]">
              <CheckCircle2 size={13} /> Video de {PROVIDER_LABEL[parsed.provider]} detectado
            </p>
          )}
          {hasUrl && !parsed && (
            <p className="text-[11px] text-[#b8912f]">No reconocimos el enlace. Usa un link de YouTube, TikTok, Instagram o Google Drive.</p>
          )}
          {parsed?.provider === 'drive' && (
            <p className="text-[11px] text-[#999]">En Google Drive comparte el archivo como "Cualquiera con el enlace" para que se vea.</p>
          )}
          <MoreOptions>
            <TextField label="Texto opcional (pie)" value={section.content.caption} onChange={v => onPatch({ caption: v })} placeholder="Un pie de video" />
          </MoreOptions>
        </div>
      )
    }
    case 'audio': {
      const drive = parseDriveUrl(section.content.drive_url)
      const hasDriveUrl = section.content.drive_url.trim().length > 0
      return (
        <div className="flex flex-col gap-3">
          <AudioUploadField url={section.content.url} onChange={v => onPatch({ url: v })} />
          <FieldRow>
            <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} placeholder="Un mensaje para ti" />
            <TextField label="Texto opcional" value={section.content.caption} onChange={v => onPatch({ caption: v })} placeholder="Escúchalo antes de la fiesta" />
          </FieldRow>
          <MoreOptions>
            <TextField label="Enlace de Google Drive (opcional)" value={section.content.drive_url} onChange={v => onPatch({ drive_url: v })} placeholder="https://drive.google.com/file/d/..." />
            {hasDriveUrl && drive && (
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#2a7a50]">
                <CheckCircle2 size={13} /> Audio de Google Drive detectado
              </p>
            )}
            {hasDriveUrl && !drive && (
              <p className="text-[11px] text-[#b8912f]">No reconocimos el enlace. Copia el link de un archivo de Google Drive.</p>
            )}
            {hasDriveUrl && drive && (
              <p className="text-[11px] text-[#999]">En Google Drive comparte el archivo como "Cualquiera con el enlace" para que se escuche.</p>
            )}
          </MoreOptions>
        </div>
      )
    }
    default:
      return null
  }
}
