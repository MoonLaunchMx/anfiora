'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mergeAgentConfig, DEFAULT_AGENT_CONFIG } from '@/lib/whatsapp/config'
import type { AgentConfig, FaqEntry } from '@/lib/types'
import { Sparkles, Plus, Trash2, Send, Check, AlertCircle } from 'lucide-react'

const ESCALATE_LABELS: Record<keyof AgentConfig['escalate'], string> = {
  alergias: 'Alergias / restricciones',
  quejas: 'Quejas',
  cambios_invitados: 'Cambios de # de invitados',
  fuera_de_info: 'Lo que no este en mi info',
}

export default function AgentePanel({ eventId }: { eventId: string }) {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const [testMsg, setTestMsg] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ kind: string; text: string; reason?: string } | null>(null)

  const [gaps, setGaps] = useState<{ guestId: string; question: string }[]>([])

  const configRef = useRef(config)
  useEffect(() => { configRef.current = config }, [config])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('event_settings').select('agent_config').eq('event_id', eventId).maybeSingle()
      setConfig(mergeAgentConfig(data?.agent_config ?? null))
      setLoading(false)
    })()
    loadGaps()
  }, [eventId])

  async function loadGaps() {
    const { data: guestsNoSe } = await supabase
      .from('guests').select('id').eq('event_id', eventId).eq('wa_needs_human', true).eq('wa_needs_human_reason', 'no_se')
    if (!guestsNoSe?.length) { setGaps([]); return }
    const ids = guestsNoSe.map(g => g.id)
    const { data: msgs } = await supabase
      .from('wa_messages').select('guest_id, content, created_at')
      .in('guest_id', ids).eq('direction', 'received').order('created_at', { ascending: false })
    const seen = new Set<string>()
    const out: { guestId: string; question: string }[] = []
    for (const m of msgs ?? []) {
      if (seen.has(m.guest_id)) continue
      seen.add(m.guest_id)
      out.push({ guestId: m.guest_id, question: m.content })
    }
    setGaps(out)
  }

  async function save(next: AgentConfig) {
    setConfig(next)
    setSaving(true)
    await supabase.from('event_settings').update({ agent_config: next }).eq('event_id', eventId)
    setSaving(false)
    setSavedAt(Date.now())
  }

  async function runTest() {
    if (!testMsg.trim()) return
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/whatsapp/agent/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, message: testMsg.trim(), config }),
      })
      setTestResult(await res.json())
    } catch { setTestResult({ kind: 'error', text: 'No se pudo probar' }) }
    finally { setTesting(false) }
  }

  function addFaq(q = '', a = '') { save({ ...config, faq: [...config.faq, { q, a }] }) }
  function updateFaq(i: number, patch: Partial<FaqEntry>) {
    setConfig(prev => ({ ...prev, faq: prev.faq.map((f, idx) => idx === i ? { ...f, ...patch } : f) }))
  }
  function commitFaq() { save(configRef.current) }
  function removeFaq(i: number) { save({ ...config, faq: config.faq.filter((_, idx) => idx !== i) }) }

  if (loading) return <div className="p-6 text-sm text-[#9ca3af]">Cargando agente...</div>

  return (
    <div className="flex h-full flex-col p-4">

      {/* Encabezado: titulo + estado + master switch */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-[#48C9B0]" />
          <h2 className="text-sm font-semibold text-[#1D1E20]">Agente IA</h2>
          <span className="text-[11px] text-[#9ca3af]">
            {saving
              ? 'Guardando...'
              : savedAt
                ? <span className="inline-flex items-center gap-1"><Check size={12} className="text-[#48C9B0]" /> Guardado</span>
                : config.enabled ? 'Activo' : 'Apagado'}
          </span>
        </div>
        <button
          onClick={() => save({ ...config, enabled: !config.enabled })}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${config.enabled ? 'bg-[#48C9B0]' : 'bg-[#d1d5db]'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${config.enabled ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* 2 columnas */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">

        {/* IZQUIERDA — Ajustes */}
        <div className="min-h-0 space-y-3 overflow-y-auto pr-0.5">

          {/* Modo */}
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Modo</p>
            <div className="grid grid-cols-2 gap-2">
              {(['autonomo', 'copiloto'] as const).map(m => (
                <button key={m} onClick={() => save({ ...config, mode: m })}
                  className={`rounded-lg border px-3 py-2 text-xs transition ${config.mode === m ? 'border-[#48C9B0] bg-[#f0fdfb] font-semibold text-[#1D9E75]' : 'border-[#e8e8e8] text-[#555]'}`}>
                  {m === 'autonomo' ? 'Autonomo (responde solo)' : 'Copiloto (yo apruebo)'}
                </button>
              ))}
            </div>
          </div>

          {/* Temas sensibles */}
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Siempre pasame a mi estos temas</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ESCALATE_LABELS) as (keyof AgentConfig['escalate'])[]).map(k => (
                <label key={k} className="flex items-center gap-2 text-[13px] text-[#1D1E20]">
                  <input type="checkbox" checked={config.escalate[k]}
                    onChange={e => save({ ...config, escalate: { ...config.escalate, [k]: e.target.checked } })} />
                  {ESCALATE_LABELS[k]}
                </label>
              ))}
            </div>
          </div>

          {/* Tono y firma */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Tono</p>
              <div className="flex gap-2">
                {(['calido', 'formal'] as const).map(t => (
                  <button key={t} onClick={() => save({ ...config, tone: t })}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs capitalize transition ${config.tone === t ? 'border-[#48C9B0] bg-[#f0fdfb] font-semibold text-[#1D9E75]' : 'border-[#e8e8e8] text-[#555]'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Firma</p>
              <input value={config.signature} onChange={e => setConfig({ ...config, signature: e.target.value })} onBlur={() => save(configRef.current)}
                placeholder="Los novios" className="w-full rounded-lg border border-[#e8e8e8] bg-[#fafafa] px-3 py-1.5 text-sm focus:border-[#48C9B0] focus:outline-none" />
            </div>
          </div>

          {/* Mensajes del agente */}
          <div className="space-y-2 rounded-xl border border-[#e8e8e8] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Mensajes del agente</p>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#555]">Mensaje de espera (cuando te paso algo a ti)</label>
              <textarea value={config.holdingMessage}
                onChange={e => setConfig({ ...config, holdingMessage: e.target.value })}
                onBlur={() => save(configRef.current)} rows={2}
                className="w-full resize-none rounded-lg border border-[#e8e8e8] bg-[#fafafa] px-3 py-2 text-sm text-[#1D1E20] focus:border-[#48C9B0] focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#555]">Mensaje cuando no sé algo y no te aviso</label>
              <textarea value={config.deflectMessage}
                onChange={e => setConfig({ ...config, deflectMessage: e.target.value })}
                onBlur={() => save(configRef.current)} rows={2}
                className="w-full resize-none rounded-lg border border-[#e8e8e8] bg-[#fafafa] px-3 py-2 text-sm text-[#1D1E20] focus:border-[#48C9B0] focus:outline-none" />
            </div>
          </div>

        </div>

        {/* DERECHA — Conocimiento y prueba */}
        <div className="flex min-h-0 flex-col gap-3">

          {/* FAQ */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#e8e8e8] bg-white p-3">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9ca3af]">Base de conocimiento (FAQ)</p>
              <button onClick={() => addFaq()} className="flex items-center gap-1 text-xs font-semibold text-[#48C9B0]"><Plus size={13} /> Agregar</button>
            </div>
            <p className="mb-2 shrink-0 rounded-lg bg-[#fafafa] p-2 text-[11px] text-[#9ca3af]">
              Lo que ya se de tu evento (fecha, lugar, mesa) lo leo solo. Aqui agrega lo que solo tu sabes: dress code, si pueden ir ninos, etc.
            </p>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
              {config.faq.map((f, i) => (
                <div key={i} className="rounded-lg border border-[#f0f0f0] p-2">
                  <input value={f.q} onChange={e => updateFaq(i, { q: e.target.value })} onBlur={commitFaq}
                    placeholder="Pregunta" className="mb-1 w-full rounded border-0 bg-transparent text-sm font-medium focus:outline-none" />
                  <div className="flex items-start gap-2">
                    <textarea value={f.a} onChange={e => updateFaq(i, { a: e.target.value })} onBlur={commitFaq} rows={1}
                      placeholder="Respuesta oficial" className="flex-1 resize-none rounded bg-[#fafafa] px-2 py-1 text-sm text-[#555] focus:outline-none" />
                    <button onClick={() => removeFaq(i)} className="text-[#bbb] hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {config.faq.length === 0 && <p className="text-xs text-[#bbb]">Sin preguntas aun.</p>}
            </div>
          </div>

          {/* Gaps */}
          {gaps.length > 0 && (
            <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700">Preguntas que no supe responder</p>
              <div className="max-h-24 space-y-1.5 overflow-y-auto">
                {gaps.map((g, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm text-[#1D1E20]">
                    <span className="truncate">{g.question}</span>
                    <button onClick={() => addFaq(g.question, '')} className="shrink-0 text-xs font-semibold text-[#48C9B0]">agregar a FAQ</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sandbox */}
          <div className="shrink-0 rounded-xl border border-[#48C9B0]/30 bg-[#f0fdfb]/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1D9E75]">Prueba tu agente</p>
            <div className="flex items-end gap-2">
              <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runTest() } }}
                placeholder="Escribe como si fueras un invitado..."
                className="flex-1 resize-none rounded-lg border border-[#e8e8e8] bg-white px-3 py-2 text-sm focus:border-[#48C9B0] focus:outline-none" />
              <button onClick={runTest} disabled={testing || !testMsg.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#48C9B0] text-white disabled:opacity-40">
                {testing ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Send size={15} />}
              </button>
            </div>
            {testResult && (
              <div className={`mt-2 rounded-lg p-2.5 text-sm ${testResult.kind === 'handoff' ? 'bg-amber-50 text-amber-800' : 'bg-white text-[#1D1E20]'}`}>
                {testResult.kind === 'handoff' && <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700"><AlertCircle size={11} /> Escala a humano ({testResult.reason})</p>}
                {testResult.text}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
