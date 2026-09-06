'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { parseDressCode, defaultDressCode, type DressCode } from '@/lib/dresscode'
import DressCodeEditor from './DressCodeEditor'
import DressCodePreview from './DressCodePreview'
import { usePermiso } from '@/lib/event-access-context'
import { Cargando } from '@/app/components/ui/Cargando'

export default function VestimentaPage() {
  const { id } = useParams()
  const permiso = usePermiso('vestimenta')
  const [dc, setDc] = useState<DressCode>(defaultDressCode())
  const [eventName, setEventName] = useState('')
  const [eventType, setEventType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: ev }, { data: settings }] = await Promise.all([
        supabase.from('events').select('name, event_type').eq('id', id).single(),
        supabase.from('event_settings').select('dress_code').eq('event_id', id).maybeSingle(),
      ])
      if (ev) {
        setEventName(ev.name)
        setEventType(ev.event_type ?? null)
      }
      setDc(parseDressCode(settings?.dress_code))
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }, [])

  const persist = async (data: DressCode) => {
    if (!permiso.editar) return
    setSaving(true)
    await supabase
      .from('event_settings')
      .upsert({ event_id: id, dress_code: data, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Autoguardado: cada cambio (incluidas las fotos) se guarda solo tras una pausa
  const updateDc = (next: DressCode) => {
    setDc(next)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => persist(next), 800)
  }

  const saveNow = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    persist(dc)
  }

  if (loading) return <Cargando />

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header sticky */}
      <div className="shrink-0 border-b border-[#e8e8e8] bg-white px-4 pt-4 pb-4 sm:px-6 sm:pt-5 lg:px-10 lg:pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-[#1D1E20]">Dress code</h1>
            <p className="mt-0.5 text-xs text-[#888] sm:text-sm">Comparte qué ponerse con tus invitados.</p>
          </div>
          {permiso.editar && <button
            onClick={saveNow}
            disabled={saving}
            className={(saved ? 'border border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]' : saving ? 'bg-[#a0e0d8] text-white' : 'bg-[#48C9B0] text-white hover:bg-[#3ab89f]') + ' shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed'}
          >
            {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar'}
          </button>}
        </div>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-6 lg:px-10">
        {permiso.editar ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="rounded-2xl border border-[#e8e8e8] bg-white p-5">
              <DressCodeEditor dc={dc} onChange={updateDc} eventType={eventType} />
            </div>
            <div>
              <DressCodePreview dc={dc} eventName={eventName} />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md">
            <DressCodePreview dc={dc} eventName={eventName} />
          </div>
        )}
      </div>
    </div>
  )
}
