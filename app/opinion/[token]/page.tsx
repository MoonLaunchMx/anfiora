'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import EscalaCinco from '@/app/components/ui/EscalaCinco'
import { anclasDe, EJES_DESEMPENO, NOMBRE_EJE, ANCLAS_RECOMENDACION_CLIENTE, ETIQUETA_NO_APLICO_CLIENTE } from '@/lib/reviews/ejes'
import type { Eje } from '@/lib/reviews/ejes'
import { fechaCortaISO } from '@/lib/rolodex/fecha-corta'
import { MAX_COMENTARIOS } from '@/lib/types'

type Proveedor = { id: string; nombre: string; categoria: string }
type Guardada = Partial<Record<Eje, number | null>> & {
  recontratacion?: number | null
  cobros_extra?: boolean | null
  monto_cobros_extra?: number | null
  comentarios?: string | null
}
type Datos = {
  evento: { nombre: string }
  vence: string | null
  vencido: boolean
  proveedores: Proveedor[]
  respuestas: Record<string, Guardada>
}

type Formulario = {
  valores: Record<Eje, number | 'na' | null>
  recontratacion: number | null
  cobrosExtra: boolean | null
  montoExtra: string
  comentarios: string
}

const josefin = { fontFamily: "'Josefin Sans', sans-serif" }

function vacio(): Formulario {
  return {
    valores: { precio_valor: null, calidad: null, comunicacion: null, servicio_trato: null, manejo_imprevistos: null },
    recontratacion: null, cobrosExtra: null, montoExtra: '', comentarios: '',
  }
}

// Una respuesta ya guardada se precarga para poder corregirla mientras el
// link siga vivo. manejo_imprevistos null en una guardada es "no hubo".
function desdeGuardada(g: Guardada | undefined): Formulario {
  if (!g) return vacio()
  const f = vacio()
  for (const eje of EJES_DESEMPENO) {
    const v = g[eje]
    f.valores[eje] = v != null ? v : (eje === 'manejo_imprevistos' ? 'na' : null)
  }
  f.recontratacion = g.recontratacion ?? null
  f.cobrosExtra = g.cobros_extra ?? null
  f.montoExtra = g.monto_cobros_extra != null ? String(g.monto_cobros_extra) : ''
  f.comentarios = g.comentarios ?? ''
  return f
}

function Cascara({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-[#1D1E20]">
      <div className="mx-auto w-full max-w-md px-5 pb-16 pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#aaa]" style={josefin}>Anfiora</p>
        {children}
      </div>
    </div>
  )
}

export default function OpinionPublicaPage() {
  const { token } = useParams<{ token: string }>()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [noExiste, setNoExiste] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [indice, setIndice] = useState(0)
  const [formularios, setFormularios] = useState<Record<string, Formulario>>({})
  const [problemas, setProblemas] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [terminado, setTerminado] = useState(false)

  useEffect(() => {
    let vigente = true
    fetch(`/api/opinion/${token}`)
      .then(async res => {
        if (!vigente) return
        if (!res.ok) { setNoExiste(true); return }
        const d = (await res.json()) as Datos
        setDatos(d)
        const iniciales: Record<string, Formulario> = {}
        for (const p of d.proveedores) iniciales[p.id] = desdeGuardada(d.respuestas[p.id])
        setFormularios(iniciales)
      })
      .catch(() => { if (vigente) setNoExiste(true) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [token])

  const actual = datos?.proveedores[indice] ?? null
  const form = actual ? (formularios[actual.id] ?? vacio()) : vacio()
  const setForm = (cambio: Partial<Formulario>) => {
    if (!actual) return
    setFormularios(prev => ({ ...prev, [actual.id]: { ...(prev[actual.id] ?? vacio()), ...cambio } }))
  }

  const guardarYSeguir = async () => {
    if (!actual || !datos) return
    setProblemas([])
    setGuardando(true)
    const aNumero = (v: number | 'na' | null) => (v === 'na' ? null : v)
    const res = await fetch(`/api/opinion/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_supplier_id: actual.id,
        precio_valor: aNumero(form.valores.precio_valor),
        calidad: aNumero(form.valores.calidad),
        comunicacion: aNumero(form.valores.comunicacion),
        servicio_trato: aNumero(form.valores.servicio_trato),
        manejo_imprevistos: aNumero(form.valores.manejo_imprevistos),
        recontratacion: form.recontratacion,
        cobros_extra: form.cobrosExtra,
        monto_cobros_extra: form.cobrosExtra ? Number(form.montoExtra) || null : null,
        comentarios: form.comentarios,
      }),
    }).catch(() => null)
    setGuardando(false)

    if (!res) { setProblemas(['No se pudo guardar. Revisa tu conexión e intenta de nuevo.']); return }
    if (res.status === 410) { setDatos({ ...datos, vencido: true }); return }
    if (!res.ok) {
      const cuerpo = await res.json().catch(() => null)
      setProblemas(cuerpo?.problemas ?? ['No se pudo guardar. Intenta de nuevo.'])
      return
    }
    if (indice + 1 >= datos.proveedores.length) setTerminado(true)
    else { setIndice(indice + 1); window.scrollTo({ top: 0 }) }
  }

  if (cargando) return <Cascara><div className="mt-10 h-40 animate-pulse rounded-xl bg-[#f5f5f5]" /></Cascara>
  if (noExiste || !datos) return <Cascara><h1 className="mt-10 text-xl font-bold">Este link no existe.</h1></Cascara>
  if (datos.vencido) {
    return (
      <Cascara>
        <h1 className="mt-10 text-xl font-bold">Este link venció{datos.vence ? ` el ${fechaCortaISO(datos.vence)}` : ''}.</h1>
        <p className="mt-2 text-sm text-[#666]">Pídele a tu planner que lo reactive.</p>
      </Cascara>
    )
  }
  if (datos.proveedores.length === 0) {
    return <Cascara><h1 className="mt-10 text-xl font-bold">No hay proveedores por calificar.</h1></Cascara>
  }
  if (terminado) {
    return (
      <Cascara>
        <h1 className="mt-10 text-xl font-bold">Listo, gracias</h1>
        <p className="mt-2 text-sm text-[#666]">Calificaron a los {datos.proveedores.length} proveedores de {datos.evento.nombre}.</p>
        <button type="button" onClick={() => { setIndice(0); setTerminado(false) }} className="mt-6 text-sm font-semibold text-[#48C9B0]">
          Corregir alguna
        </button>
      </Cascara>
    )
  }

  const total = datos.proveedores.length
  const avance = Math.round((indice / total) * 100)

  return (
    <Cascara>
      <h1 className="mt-2 text-lg font-semibold">{datos.evento.nombre}</h1>

      <div className="mt-6 flex items-center justify-between text-[11.5px] tabular-nums text-[#999]">
        <span>Proveedor {indice + 1} de {total}</span>
        <span>{avance}%</span>
      </div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[#f2f2f2]">
        <div className="h-full rounded-full bg-[#48C9B0] transition-all" style={{ width: `${avance}%` }} />
      </div>

      <h2 className="mt-5 text-[18px] font-semibold tracking-tight">{actual?.nombre}</h2>
      {actual?.categoria && <p className="mt-0.5 text-xs text-[#999]">{actual.categoria}</p>}

      <div className="mt-5 space-y-5">
        {EJES_DESEMPENO.map(eje => (
          <EscalaCinco
            key={eje}
            nombre={NOMBRE_EJE[eje]}
            anclas={anclasDe('desempeno_cliente', eje)}
            valor={form.valores[eje]}
            onChange={v => setForm({ valores: { ...form.valores, [eje]: v } })}
            noAplico={eje === 'manejo_imprevistos'}
            etiquetaNoAplico={ETIQUETA_NO_APLICO_CLIENTE}
          />
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-[#e8d4a6] bg-[var(--accent-bg)] p-3">
        <p className="text-sm font-medium">¿Les cobró algo extra que no estaba acordado?</p>
        <div className="mt-2 flex gap-2">
          {[true, false].map(v => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={form.cobrosExtra === v}
              onClick={() => setForm({ cobrosExtra: v })}
              className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                form.cobrosExtra === v ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] bg-white text-[#666]'
              }`}
            >
              {v ? 'Sí' : 'No'}
            </button>
          ))}
        </div>
        {form.cobrosExtra === true && (
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="monto-extra" className="text-xs text-[#666]">Monto</label>
            <input
              id="monto-extra"
              type="text"
              inputMode="decimal"
              value={form.montoExtra}
              onChange={e => setForm({ montoExtra: e.target.value })}
              placeholder="0.00"
              className="w-32 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-sm tabular-nums outline-none focus:border-[#48C9B0]"
            />
          </div>
        )}
      </div>

      <div className="mt-5">
        <EscalaCinco
          nombre="¿Lo recomendarían?"
          anclas={ANCLAS_RECOMENDACION_CLIENTE}
          valor={form.recontratacion}
          onChange={v => setForm({ recontratacion: typeof v === 'number' ? v : null })}
        />
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium">Algo que quieran agregar</p>
        <textarea
          value={form.comentarios}
          onChange={e => setForm({ comentarios: e.target.value })}
          maxLength={MAX_COMENTARIOS}
          rows={3}
          placeholder="Opcional"
          className="mt-2 w-full resize-none rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#48C9B0]"
        />
      </div>

      {problemas.length > 0 && (
        <div className="mt-4 space-y-1 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2">
          {problemas.map(p => <p key={p} className="text-xs text-[var(--error-text)]">{p}</p>)}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={indice === 0 || guardando}
          onClick={() => { setProblemas([]); setIndice(indice - 1) }}
          className="px-2 py-2 text-sm text-[#666] disabled:opacity-30"
        >
          Atrás
        </button>
        <button
          type="button"
          disabled={guardando}
          onClick={guardarYSeguir}
          className="ml-auto rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : indice + 1 >= total ? 'Terminar' : 'Siguiente'}
        </button>
      </div>
    </Cascara>
  )
}
