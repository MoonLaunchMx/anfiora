'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import EscalaCinco from '@/app/components/ui/EscalaCinco'
import { anclasDe, EJES_DESEMPENO, NOMBRE_EJE, ANCLAS_RECOMENDACION_CLIENTE } from '@/lib/reviews/ejes'
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

// Lo que el cliente contesta de un proveedor. Solo `rec` es obligatorio: con
// catorce proveedores, pedirle los cinco ejes a cada uno era pedirle 112
// respuestas y nadie terminaba.
type Respuesta = {
  rec: number | null
  ejes: Partial<Record<Eje, number | null>>
  hubo: boolean | null
  imprevisto: number | null
  cobros: boolean | null
  monto: string
  texto: string
}

// manejo_imprevistos no entra aqui: se pregunta aparte, primero si hubo y
// solo entonces como lo resolvio.
const EJES_OPCIONALES = EJES_DESEMPENO.filter(e => e !== 'manejo_imprevistos')

const josefin = { fontFamily: "'Josefin Sans', sans-serif" }

function vacia(): Respuesta {
  return { rec: null, ejes: {}, hubo: null, imprevisto: null, cobros: null, monto: '', texto: '' }
}

function desdeGuardada(g: Guardada | undefined): Respuesta {
  if (!g) return vacia()
  const r = vacia()
  for (const eje of EJES_OPCIONALES) r.ejes[eje] = g[eje] ?? null
  // Guardado con manejo_imprevistos en null puede ser "no hubo" o "no contesto":
  // se lee como no hubo, que es el caso comun y el que no pide nada mas.
  r.imprevisto = g.manejo_imprevistos ?? null
  r.hubo = g.manejo_imprevistos != null ? true : null
  r.rec = g.recontratacion ?? null
  r.cobros = g.cobros_extra ?? null
  r.monto = g.monto_cobros_extra != null ? String(g.monto_cobros_extra) : ''
  r.texto = g.comentarios ?? ''
  return r
}

function cuerpoParaApi(id: string, r: Respuesta) {
  return {
    event_supplier_id: id,
    precio_valor: r.ejes.precio_valor ?? null,
    calidad: r.ejes.calidad ?? null,
    comunicacion: r.ejes.comunicacion ?? null,
    servicio_trato: r.ejes.servicio_trato ?? null,
    manejo_imprevistos: r.hubo === true ? r.imprevisto : null,
    recontratacion: r.rec,
    cobros_extra: r.cobros,
    monto_cobros_extra: r.cobros ? Number(r.monto) || null : null,
    comentarios: r.texto.trim() || null,
  }
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
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({})
  const [abierto, setAbierto] = useState<string | null>(null)
  const [errorPorId, setErrorPorId] = useState<Record<string, string>>({})
  const [enviado, setEnviado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const filaRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const pendientes = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const ultima = useRef<Record<string, Respuesta>>({})

  useEffect(() => {
    let vigente = true
    fetch(`/api/opinion/${token}`)
      .then(async res => {
        if (!vigente) return
        if (!res.ok) { setNoExiste(true); return }
        const d = (await res.json()) as Datos
        setDatos(d)
        const iniciales: Record<string, Respuesta> = {}
        for (const p of d.proveedores) iniciales[p.id] = desdeGuardada(d.respuestas[p.id])
        setRespuestas(iniciales)
        ultima.current = iniciales
      })
      .catch(() => { if (vigente) setNoExiste(true) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [token])

  // Se guarda solo, proveedor por proveedor: si cierran el navegador a la
  // mitad, el planner ya se quedo con lo contestado. Sin recomendacion no hay
  // nada que guardar todavia.
  const guardar = useCallback(async (id: string) => {
    const r = ultima.current[id]
    if (!r || r.rec === null) return
    setGuardando(true)
    const res = await fetch(`/api/opinion/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoParaApi(id, r)),
    }).catch(() => null)
    setGuardando(false)

    if (!res || !res.ok) {
      const motivo = res?.status === 410
        ? 'El link venció.'
        : 'No se pudo guardar. Revisa tu conexión.'
      setErrorPorId(prev => ({ ...prev, [id]: motivo }))
      return
    }
    setErrorPorId(prev => {
      if (!prev[id]) return prev
      const n = { ...prev }
      delete n[id]
      return n
    })
  }, [token])

  const cambiar = (id: string, cambio: Partial<Respuesta>) => {
    setRespuestas(prev => {
      const siguiente = { ...(prev[id] ?? vacia()), ...cambio }
      ultima.current = { ...ultima.current, [id]: siguiente }
      return { ...prev, [id]: siguiente }
    })
    clearTimeout(pendientes.current[id])
    pendientes.current[id] = setTimeout(() => guardar(id), 700)
  }

  const abrirDetalle = (id: string) => {
    const cerrando = abierto === id
    setAbierto(cerrando ? null : id)
    if (cerrando) return
    // Con catorce filas es facil perderse: la que se abre sube a la vista.
    requestAnimationFrame(() => {
      filaRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const enviar = async () => {
    Object.values(pendientes.current).forEach(clearTimeout)
    pendientes.current = {}
    const ids = Object.keys(ultima.current).filter(id => ultima.current[id].rec !== null)
    for (const id of ids) await guardar(id)
    setEnviado(true)
    window.scrollTo({ top: 0 })
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

  const total = datos.proveedores.length
  const listos = datos.proveedores.filter(p => respuestas[p.id]?.rec != null).length

  if (enviado) {
    return (
      <Cascara>
        <h1 className="mt-10 text-xl font-bold">Listo, gracias</h1>
        <p className="mt-2 text-sm text-[#666]">
          Calificaron {listos} de {total} proveedores de {datos.evento.nombre}. Su planner ya lo recibió.
        </p>
        <button type="button" onClick={() => setEnviado(false)} className="mt-6 text-sm font-semibold text-[#48C9B0]">
          Corregir algo
        </button>
      </Cascara>
    )
  }

  return (
    <div className="min-h-dvh bg-white text-[#1D1E20]">
      {/* El encabezado no se va al hacer scroll: con catorce filas es la unica
          referencia de donde estas y cuanto falta. */}
      <header className="sticky top-0 z-20 border-b border-[#eee] bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-5 pb-2.5 pt-3">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-[#bbb]" style={josefin}>Anfiora</p>
          <h1 className="mt-0.5 text-[15px] font-semibold tracking-tight">{datos.evento.nombre}</h1>
          <div className="mt-2 flex items-center justify-between text-[11px] tabular-nums text-[#999]">
            <span>{listos} de {total} calificados</span>
            <span>{listos === total ? 'Listo' : `Te faltan ${total - listos}`}</span>
          </div>
          <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[#f2f2f2]">
            <div className="h-full rounded-full bg-[#48C9B0] transition-all" style={{ width: `${Math.round((listos / total) * 100)}%` }} />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-5 pb-32 pt-4">
        <p className="text-[15px] font-semibold">¿Recomendarían a cada proveedor?</p>
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-[#eee] bg-[#fafafa] px-3 py-2 text-[11px] text-[#666]">
          <span><b className="text-[#1D1E20]">1</b> pésimo</span>
          <span><b className="text-[#1D1E20]">5</b> excelente</span>
        </div>

        <ul className="mt-3 flex flex-col gap-2.5">
          {datos.proveedores.map(p => {
            const r = respuestas[p.id] ?? vacia()
            const calificado = r.rec != null
            const estaAbierto = abierto === p.id
            return (
              <li
                key={p.id}
                ref={n => { filaRefs.current[p.id] = n }}
                className={`scroll-mt-28 rounded-xl border p-3 transition ${
                  estaAbierto ? 'border-[#48C9B0] bg-white shadow-sm'
                  : calificado ? 'border-[#bdebdf] bg-[#f0faf7]'
                  : 'border-[#eee] bg-white'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold leading-tight">{p.nombre}</span>
                    {p.categoria && <span className="mt-0.5 block text-[11px] text-[#999]">{p.categoria}</span>}
                  </span>
                  <span
                    aria-hidden
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                      calificado ? 'border-[#48C9B0] bg-[#48C9B0] text-white' : 'border-dashed border-[#d4a853]'
                    }`}
                  >
                    {calificado && <Check size={10} strokeWidth={3.5} />}
                  </span>
                </div>

                <div className="mt-2.5">
                  <EscalaCinco
                    anclas={ANCLAS_RECOMENDACION_CLIENTE}
                    valor={r.rec}
                    onChange={v => cambiar(p.id, { rec: typeof v === 'number' ? v : null })}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => abrirDetalle(p.id)}
                  aria-expanded={estaAbierto}
                  className="mt-1.5 flex items-center gap-1 text-[11.5px] font-semibold text-[#2e9e88]"
                >
                  {estaAbierto ? 'Cerrar' : 'Contar más'}
                  <ChevronDown size={12} className={`transition-transform ${estaAbierto ? 'rotate-180' : ''}`} />
                </button>

                {errorPorId[p.id] && <p className="mt-1.5 text-[11px] text-[var(--error-text)]">{errorPorId[p.id]}</p>}

                {estaAbierto && (
                  <div className="mt-3 flex flex-col gap-4 border-t border-dashed border-[#e0e0e0] pt-3">
                    {/* El detalle repite de quien es: con la lista larga, el
                        bloque abierto se leia suelto. */}
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">
                      Sobre {p.nombre}
                    </p>

                    {EJES_OPCIONALES.map(eje => (
                      <EscalaCinco
                        key={eje}
                        nombre={NOMBRE_EJE[eje]}
                        anclas={anclasDe('desempeno_cliente', eje)}
                        valor={r.ejes[eje] ?? null}
                        onChange={v => cambiar(p.id, { ejes: { ...r.ejes, [eje]: typeof v === 'number' ? v : null } })}
                      />
                    ))}

                    <div>
                      <p className="text-sm font-medium">¿Hubo algún imprevisto?</p>
                      <div className="mt-2 flex gap-2">
                        {[false, true].map(v => (
                          <button
                            key={String(v)}
                            type="button"
                            aria-pressed={r.hubo === v}
                            onClick={() => cambiar(p.id, { hubo: r.hubo === v ? null : v, imprevisto: v ? r.imprevisto : null })}
                            className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                              r.hubo === v ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] bg-white text-[#666]'
                            }`}
                          >
                            {v ? 'Sí' : 'No'}
                          </button>
                        ))}
                      </div>
                      {r.hubo === true && (
                        <div className="mt-3">
                          <EscalaCinco
                            nombre="¿Cómo lo resolvió?"
                            anclas={anclasDe('desempeno_cliente', 'manejo_imprevistos')}
                            valor={r.imprevisto}
                            onChange={v => cambiar(p.id, { imprevisto: typeof v === 'number' ? v : null })}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium">¿Les cobró algo extra que no estaba acordado?</p>
                      <div className="mt-2 flex gap-2">
                        {[false, true].map(v => (
                          <button
                            key={String(v)}
                            type="button"
                            aria-pressed={r.cobros === v}
                            onClick={() => cambiar(p.id, { cobros: r.cobros === v ? null : v, monto: v ? r.monto : '' })}
                            className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                              r.cobros === v ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] bg-white text-[#666]'
                            }`}
                          >
                            {v ? 'Sí' : 'No'}
                          </button>
                        ))}
                      </div>
                      {r.cobros === true && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <label htmlFor={`monto-${p.id}`} className="text-xs text-[#666]">Monto</label>
                          <input
                            id={`monto-${p.id}`}
                            type="text"
                            inputMode="decimal"
                            value={r.monto}
                            onChange={e => cambiar(p.id, { monto: e.target.value })}
                            placeholder="0.00"
                            className="w-32 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-sm tabular-nums outline-none focus:border-[#48C9B0]"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium">Algo que quieran agregar</p>
                      <textarea
                        value={r.texto}
                        onChange={e => cambiar(p.id, { texto: e.target.value })}
                        maxLength={MAX_COMENTARIOS}
                        rows={2}
                        placeholder="Opcional"
                        className="mt-2 w-full resize-none rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#48C9B0]"
                      />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-[#eee] bg-white/95 backdrop-blur">
        <div
          className="mx-auto w-full max-w-md px-5 pt-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            disabled={listos === 0 || guardando}
            onClick={enviar}
            className="w-full rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white transition hover:bg-[#3aa896] disabled:bg-[#f2f2f2] disabled:text-[#bbb]"
          >
            {guardando ? 'Guardando…' : listos === 0 ? 'Enviar' : listos === total ? `Enviar los ${total}` : `Enviar ${listos} de ${total}`}
          </button>
        </div>
      </footer>
    </div>
  )
}
