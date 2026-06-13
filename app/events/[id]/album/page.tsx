'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FeatureGuard from '@/app/components/ui/FeatureGuard'
import { QRCodeCanvas } from 'qrcode.react'

function AlbumPageInner() {
  const { id } = useParams()
  const [albumUrl, setAlbumUrl]       = useState('')
  const [eventName, setEventName]     = useState('')
  const [settingsId, setSettingsId]   = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [shared, setShared]           = useState(false)
  const [sharedLink, setSharedLink]   = useState(false)
  const autoSaveTimeoutRef            = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: eventData }, { data: settingsData }] = await Promise.all([
        supabase.from('events').select('name').eq('id', id).single(),
        supabase.from('event_settings').select('id, album_url').eq('event_id', id).single(),
      ])
      if (eventData?.name) setEventName(eventData.name)
      if (settingsData) {
        setSettingsId(settingsData.id)
        if (settingsData.album_url) setAlbumUrl(settingsData.album_url)
      }
    }
    load()
  }, [])

  const handleSave = async (autoSave = false) => {
    setSaving(true); setSaved(false)
    await supabase.from('event_settings').upsert({
      ...(settingsId ? { id: settingsId } : {}),
      event_id: id,
      album_url: albumUrl || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), autoSave ? 2000 : 3000)
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newUrl = e.target.value
    setAlbumUrl(newUrl)
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    if (newUrl.trim()) {
      autoSaveTimeoutRef.current = setTimeout(() => handleSave(true), 1000)
    }
  }

  const shareLinkHandler = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${eventName} - Álbum de fotos`,
          text: `Comparte tus fotos del evento ${eventName}, solo ingresa al siguiente enlace:`,
          url: albumUrl,
        })
      } else {
        await navigator.clipboard.writeText(`Comparte tus fotos del evento ${eventName}, solo ingresa al siguiente enlace:\n${albumUrl}`)
      }
      setSharedLink(true)
      setTimeout(() => setSharedLink(false), 3000)
    } catch {
      try {
        await navigator.clipboard.writeText(`Comparte tus fotos del evento ${eventName}, solo ingresa al siguiente enlace:\n${albumUrl}`)
        setSharedLink(true)
        setTimeout(() => setSharedLink(false), 3000)
      } catch (err) {
        console.error('Error compartiendo:', err)
      }
    }
  }

  const downloadQR = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${eventName} - QR Invitados.png`
    a.click()
  }

  const shareQR = async () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed to generate QR blob')), 'image/png')
      })
      const file = new File([blob], `${eventName} - QR Invitados.png`, { type: 'image/png' })
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: `${eventName} - Álbum de fotos`,
          text: `Comparte tus fotos del evento _${eventName}_, solo ingresa al siguiente enlace: ${albumUrl}`,
        })
      } else {
        await navigator.clipboard.writeText(albumUrl)
      }
      setShared(true)
      setTimeout(() => setShared(false), 3000)
    } catch {
      try {
        await navigator.clipboard.writeText(albumUrl)
        setShared(true)
        setTimeout(() => setShared(false), 3000)
      } catch (err) {
        console.error('Error compartiendo:', err)
      }
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="px-4 py-6 sm:px-6 sm:py-7 lg:px-10 lg:py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-bold text-[#1D1E20] sm:text-xl">Álbum de fotos</h1>
          <p className="mt-0.5 text-xs text-[#888] sm:text-sm">
            Sigue estos pasos para compartir el álbum con tus invitados
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">

          {/* ── Paso 1 ── */}
          <div className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 sm:p-5">
            <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#48C9B0] text-xs font-bold text-white">1</div>
            <h2 className="mb-1.5 text-sm font-semibold text-[#1D1E20]">Crea tu álbum compartido</h2>
            <p className="mb-4 text-xs leading-relaxed text-[#888]">
              Elige una app, activa la colaboración para que tus invitados puedan subir fotos.
            </p>
            <div className="flex flex-col gap-2">
              {[
                { icon: '📸', name: 'Google Photos', desc: 'Gratis · Android e iPhone',           color: '#888',   url: 'https://www.youtube.com/results?search_query=como+crear+album+compartido+google+photos' },
                { icon: '🍎', name: 'iCloud',         desc: 'Gratis · Solo iPhone',               color: '#888',   url: 'https://www.youtube.com/results?search_query=como+crear+album+compartido+icloud+fotos' },
                { icon: '📦', name: 'Dropbox',        desc: 'Implica costo · Android e iPhone',   color: '#b8860b', url: 'https://www.youtube.com/results?search_query=como+crear+carpeta+compartida+dropbox' },
              ].map(app => (
                <div key={app.name} className="flex items-center justify-between rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-[#1D1E20]">{app.icon} {app.name}</p>
                    <p className="text-[11px]" style={{ color: app.color }}>{app.desc}</p>
                  </div>
                  <button
                    onClick={() => window.open(app.url, '_blank')}
                    className="rounded-md border border-[#48C9B0] px-2.5 py-1 text-[11px] font-semibold text-[#1a9e88] transition hover:bg-[#f0fdfb]"
                  >
                    Tutorial
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Paso 2 ── */}
          <div className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 sm:p-5">
            <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#48C9B0] text-xs font-bold text-white">2</div>
            <h2 className="mb-1.5 text-sm font-semibold text-[#1D1E20]">Pega el link aquí</h2>
            <p className="mb-4 text-xs leading-relaxed text-[#888]">
              Copia el link del álbum compartido y pégalo abajo. Funciona con Google Photos, iCloud, Dropbox y OneDrive.
            </p>
            <textarea
              value={albumUrl}
              onChange={handleUrlChange}
              placeholder="https://photos.google.com/share/..."
              rows={3}
              className="w-full resize-none rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 text-xs leading-relaxed text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
            />
            {saved && (
              <p className="mt-2 text-xs text-[#48C9B0]">✓ Link guardado automáticamente</p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleSave(false)}
                disabled={saving || !albumUrl.trim()}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition
                  ${saving ? 'bg-[#a0e0d8] text-white' : 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]'}
                  disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {saving ? 'Guardando...' : '💾 Guardar'}
              </button>
              <button
                onClick={shareLinkHandler}
                disabled={sharedLink || !albumUrl.trim()}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition
                  ${sharedLink ? 'border border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]' : 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]'}
                  disabled:cursor-default disabled:opacity-50`}
              >
                {sharedLink ? '✓ Compartido' : '📤 Compartir'}
              </button>
            </div>
          </div>

          {/* ── Paso 3 ── */}
          <div className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 sm:p-5">
            <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#48C9B0] text-xs font-bold text-white">3</div>
            <h2 className="mb-1.5 text-sm font-semibold text-[#1D1E20]">Comparte el QR</h2>
            <p className="mb-4 text-xs leading-relaxed text-[#888]">
              {albumUrl
                ? 'Tu QR está listo. Descárgalo e imprímelo o compártelo por WhatsApp.'
                : 'El QR aparecerá aquí una vez que guardes el link.'}
            </p>
            {albumUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
                  <QRCodeCanvas value={albumUrl} size={140} />
                </div>
                <div className="flex w-full gap-2">
                  <button
                    onClick={downloadQR}
                    className="flex-1 rounded-lg border border-[#48C9B0] py-2.5 text-sm font-semibold text-[#1a9e88] transition hover:bg-[#f0fdfb]"
                  >
                    ⬇️ Descargar QR
                  </button>
                  <button
                    onClick={shareQR}
                    disabled={shared}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition
                      ${shared ? 'border border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]' : 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]'}
                      disabled:cursor-default`}
                  >
                    {shared ? '✓ Compartido' : '📤 Compartir'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#e0e0e0] py-8 text-center">
                <div className="mb-2 text-3xl">📱</div>
                <p className="text-xs text-[#bbb]">Primero guarda el link</p>
              </div>
            )}
          </div>

          {/* ── Paso 4 ── */}
          <div className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 sm:p-5">
            <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#48C9B0] text-xs font-bold text-white">4</div>
            <h2 className="mb-1.5 text-sm font-semibold text-[#1D1E20]">Diseña e imprime tu QR</h2>
            <p className="mb-4 text-xs leading-relaxed text-[#888]">
              Descarga el QR y personalízalo en Canva para que combine con la decoración. Imprímelo y colócalo en mesas, entrada o invitaciones.
            </p>
            <div className="flex items-center justify-between rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-[#1D1E20]">🎨 Canva</p>
                <p className="text-[11px] text-[#888]">Gratis · Muy fácil de usar</p>
              </div>
              <button
                onClick={() => window.open('https://www.canva.com', '_blank')}
                className="rounded-md border border-[#48C9B0] px-2.5 py-1 text-[11px] font-semibold text-[#1a9e88] transition hover:bg-[#f0fdfb]"
              >
                Abrir
              </button>
            </div>
            <div className="mt-3 rounded-lg border border-[#a0e0d8] bg-[#f0fdfb] px-3 py-2.5 text-[11px] leading-relaxed text-[#1a9e88]">
              💡 En Canva busca "QR code" en plantillas para encontrar diseños listos para bodas y eventos.
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
export default function AlbumPage() {
  return (
    <FeatureGuard feature="album">
      <AlbumPageInner />
    </FeatureGuard>
  )
}
