'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Upload, X, CheckCircle2, Mic, Square } from 'lucide-react'
import type { Section } from '@/lib/invite/schema'
import { parseVideoUrl } from '@/lib/invite/video'
import { parseDriveUrl } from '@/lib/invite/drive'
import { pickAudioMime, extForMime, formatTimer } from '@/lib/invite/audio-recording'
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

function VoiceRecorder({ eventId, onUploaded }: { eventId: string; onUploaded: (url: string) => void }) {
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

  return (
    <div className="flex flex-col gap-1.5">
      {phase === 'idle' && (
        <button
          type="button"
          onClick={start}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#ccc] bg-white px-3 py-3 text-xs font-medium text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
        >
          <Mic size={14} /> Grabar nota de voz
        </button>
      )}

      {phase === 'recording' && (
        <div className="flex items-center gap-3 rounded-lg border border-[#f0c8c8] bg-[#fff6f6] px-3 py-2.5">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#e11d1d]" />
          <span className="flex-1 text-xs font-medium text-[#cc3333]">Grabando… {formatTimer(seconds)}</span>
          <button
            type="button"
            onClick={stop}
            className="flex items-center gap-1.5 rounded-lg bg-[#cc3333] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b82d2d]"
          >
            <Square size={12} fill="currentColor" /> Detener
          </button>
        </div>
      )}

      {phase === 'recorded' && localUrl && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#e0e0e0] bg-white p-2.5">
          <audio key={localUrl} src={localUrl} controls className="w-full" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={regrabar}
              disabled={uploading}
              className="flex items-center gap-1 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0] disabled:opacity-50"
            >
              <Mic size={12} /> Regrabar
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={uploading}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-50"
            >
              {uploading ? 'Guardando…' : 'Usar esta grabación'}
            </button>
          </div>
        </div>
      )}

      {phase === 'idle' && (
        <p className="text-[11px] text-[#999]">Se detiene sola al minuto. Necesita permiso del micrófono.</p>
      )}
      {error && <p className="text-[11px] text-[#b8912f]">{error}</p>}
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
      <label className="mb-1 block text-xs font-medium text-[#555]">Clip de audio (voz, coro, 20-40 seg)</label>
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
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#ccc] bg-white px-3 py-3 text-xs font-medium text-[#888] transition hover:border-[#48C9B0] hover:text-[#48C9B0]">
            <Upload size={14} />
            {uploading ? 'Subiendo...' : 'Subir clip de audio'}
            <input
              type="file"
              accept="audio/*"
              disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
              className="hidden"
            />
          </label>
          <VoiceRecorder eventId={eventId} onUploaded={onChange} />
          {error && <p className="text-[11px] text-[#cc3333]">{error}</p>}
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
          <TextField label="Texto pequeño arriba" value={section.content.kicker} onChange={v => onPatch({ kicker: v })} placeholder="Nuestra boda" />
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} placeholder="Nombre de los anfitriones" />
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
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <TextField label="Descripción" value={section.content.descripcion} onChange={v => onPatch({ descripcion: v })} />
          <p className="text-xs text-[#999]">Se muestra cuando el evento tiene playlist activa.</p>
        </div>
      )
    case 'mesa':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
          <TextField label="Descripción" value={section.content.descripcion} onChange={v => onPatch({ descripcion: v })} />
          <p className="text-xs text-[#999]">Se muestra cuando el evento tiene mesa de regalos activa.</p>
        </div>
      )
    case 'texto':
      return (
        <div className="flex flex-col gap-3">
          <TextField label="Texto pequeño arriba" value={section.content.eyebrow} onChange={v => onPatch({ eyebrow: v })} />
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} />
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
          <GifSearch onSelect={url => onPatch({ url })} />
          {section.content.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={section.content.url} alt="" className="max-h-32 w-full rounded-lg object-contain" />
          )}
          <TextField label="URL de la imagen o GIF" value={section.content.url} onChange={v => onPatch({ url: v })} placeholder="https://media.giphy.com/....gif" />
          <TextField label="Texto opcional (pie)" value={section.content.caption} onChange={v => onPatch({ caption: v })} placeholder="Un pie de foto" />
          <p className="text-xs text-[#999]">Busca arriba o pega el link de un GIF/imagen.</p>
        </div>
      )
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
          <TextField label="Texto opcional (pie)" value={section.content.caption} onChange={v => onPatch({ caption: v })} placeholder="Un pie de video" />
          <p className="text-xs text-[#999]">El video se reproduce cuando el invitado lo toca (sin audio automático).</p>
        </div>
      )
    }
    case 'audio': {
      const drive = parseDriveUrl(section.content.drive_url)
      const hasDriveUrl = section.content.drive_url.trim().length > 0
      return (
        <div className="flex flex-col gap-3">
          <AudioUploadField url={section.content.url} onChange={v => onPatch({ url: v })} />
          <TextField label="Título" value={section.content.titulo} onChange={v => onPatch({ titulo: v })} placeholder="Un mensaje para ti" />
          <TextField label="Texto opcional" value={section.content.caption} onChange={v => onPatch({ caption: v })} placeholder="Escúchalo antes de la fiesta" />
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
          <p className="text-xs text-[#999]">Sube un clip propio o pega un link de Google Drive (o ambos). Nada se reproduce solo: el invitado toca play.</p>
        </div>
      )
    }
    default:
      return null
  }
}
