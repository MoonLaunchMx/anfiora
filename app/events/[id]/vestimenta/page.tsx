'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { parseDressCode, defaultDressCode, type DressCode } from '@/lib/dresscode'
import DressCodeEditor from './DressCodeEditor'
import DressCodePreview from './DressCodePreview'

export default function VestimentaPage() {
  const { id } = useParams()
  const [dc, setDc] = useState<DressCode>(defaultDressCode())
  const [eventName, setEventName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: ev }, { data: settings }] = await Promise.all([
        supabase.from('events').select('name').eq('id', id).single(),
        supabase.from('event_settings').select('dress_code').eq('event_id', id).maybeSingle(),
      ])
      if (ev) setEventName(ev.name)
      setDc(parseDressCode(settings?.dress_code))
      setLoading(false)
    }
    load()
  }, [id])

  const save = async () => {
    setSaving(true)
    await supabase
      .from('event_settings')
      .upsert({ event_id: id, dress_code: dc, updated_at: new Date().toISOString() }, { onConflict: 'event_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1D1E20]">Código de vestimenta</h1>
            <p className="mt-0.5 text-sm text-[#888]">Define qué ponerse. Se comparte en la invitación y como texto.</p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-[#e8e8e8] bg-white p-5">
            <DressCodeEditor dc={dc} onChange={setDc} />
          </div>
          <div>
            <DressCodePreview dc={dc} eventName={eventName} />
          </div>
        </div>
      </div>
    </div>
  )
}
