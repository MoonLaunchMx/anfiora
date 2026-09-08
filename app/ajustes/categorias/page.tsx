'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AlertTriangle } from 'lucide-react'
import { activas, buscarPorNombre, cargarCategorias, crearCategoria, type Categoria } from '@/lib/rolodex/categorias-store'
import { parecidas, puedeEliminarse, type CategoriaConUso } from '@/lib/rolodex/vocabulario-admin'
import { renombrar } from '@/lib/rolodex/aplicar-cambios'
import { puedeAdministrarCategorias, type FilaMiembroDespacho } from '@/lib/permisos/administrar-categorias'
import AccionesCategoria, { type AccionesCategoriaHandle } from './AccionesCategoria'

function plural(n: number, singular: string, otros: string): string {
  return `${n} ${n === 1 ? singular : otros}`
}

function contarPor(filas: { category_id: string | null }[]): Map<string, number> {
  const conteo = new Map<string, number>()
  for (const fila of filas) {
    if (!fila.category_id) continue
    conteo.set(fila.category_id, (conteo.get(fila.category_id) ?? 0) + 1)
  }
  return conteo
}

// Cuenta EVENTOS distintos, no partidas: una boda con 5 partidas de "Venue"
// cuenta como 1, no como 5. Sale gratis de la misma consulta de event_budgets
// que ya trae partidas -- pedirlo aparte, evento por evento, si hubiera sido
// una consulta nueva por fila, no valia la pena y se hubiera omitido.
function contarEventosPor(filas: { category_id: string | null; event_id: string }[]): Map<string, number> {
  const porCategoria = new Map<string, Set<string>>()
  for (const fila of filas) {
    if (!fila.category_id) continue
    if (!porCategoria.has(fila.category_id)) porCategoria.set(fila.category_id, new Set())
    porCategoria.get(fila.category_id)!.add(fila.event_id)
  }
  return new Map(Array.from(porCategoria, ([id, eventos]) => [id, eventos.size]))
}

export default function CategoriasPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [categoriasRaw, setCategoriasRaw] = useState<Categoria[]>([])
  const [categorias, setCategorias] = useState<CategoriaConUso[]>([])
  const [pares, setPares] = useState<[string, string][]>([])
  const [loading, setLoading] = useState(true)
  const [sinAcceso, setSinAcceso] = useState(false)
  const [noVerificado, setNoVerificado] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [valorEdicion, setValorEdicion] = useState('')
  const [errorEdicion, setErrorEdicion] = useState('')
  const [mensajeExito, setMensajeExito] = useState<{ id: string; texto: string } | null>(null)

  const [creando, setCreando] = useState(false)
  const [valorNuevo, setValorNuevo] = useState('')
  const [errorNuevo, setErrorNuevo] = useState('')
  const [resaltadaId, setResaltadaId] = useState<string | null>(null)

  // Al confirmar con Enter o cancelar con Escape, el input se desmonta de inmediato
  // y el navegador dispara un blur "fantasma" sobre un campo que ya no existe. Sin
  // esta guarda ese blur volveria a llamar a confirmarRenombrar con datos viejos.
  const evitarBlurRef = useRef(false)
  const guardandoRef = useRef(false)
  const evitarBlurCrearRef = useRef(false)
  const guardandoCrearRef = useRef(false)
  const mensajeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resaltadaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accionesRefs = useRef(new Map<string, AccionesCategoriaHandle>())

  useEffect(() => () => {
    if (mensajeTimeoutRef.current) clearTimeout(mensajeTimeoutRef.current)
    if (resaltadaTimeoutRef.current) clearTimeout(resaltadaTimeoutRef.current)
  }, [])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }
    setUserId(user.id)

    // Este catalogo es de cuenta, no de boda: administrarlo (archivar,
    // fusionar, renombrar) es cosa de dueño y administradores del despacho,
    // igual que en HubSpot/Asana/Notion. Falla cerrado: un permiso que no se
    // pudo verificar es un permiso negado. El dueño de su propio despacho
    // (workspaces.primary_owner_id) entra siempre, aunque workspace_members
    // no responda -- un colaborador sin fila verificable, no.
    let workspacePropio: { id: string } | null = null
    let errorWorkspace: unknown = null
    try {
      const resultado = await supabase
        .from('workspaces')
        .select('id')
        .eq('primary_owner_id', user.id)
        .maybeSingle()
      workspacePropio = resultado.data
      errorWorkspace = resultado.error
    } catch (e) {
      errorWorkspace = e
    }
    const esDueno = !errorWorkspace && workspacePropio !== null

    let filaMiembro: FilaMiembroDespacho = null
    let errorMiembro: unknown = null
    try {
      const resultado = await supabase
        .from('workspace_members')
        .select('rol')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      filaMiembro = resultado.data
      errorMiembro = resultado.error
    } catch (e) {
      errorMiembro = e
    }

    if (!puedeAdministrarCategorias(filaMiembro, errorMiembro, esDueno)) {
      setNoVerificado(!esDueno && (errorMiembro != null || filaMiembro == null))
      setSinAcceso(true)
      setLoading(false)
      return
    }

    const cats = await cargarCategorias(user.id)

    const [{ data: proveedores }, { data: eventos }] = await Promise.all([
      supabase.from('suppliers').select('category_id').eq('user_id', user.id),
      supabase.from('events').select('id').eq('user_id', user.id),
    ])

    const eventIds = (eventos ?? []).map(e => e.id)
    const { data: partidas } = eventIds.length > 0
      ? await supabase.from('event_budgets').select('category_id, event_id').in('event_id', eventIds)
      : { data: [] as { category_id: string | null; event_id: string }[] }

    const porProveedores = contarPor(proveedores ?? [])
    const porPartidas = contarPor(partidas ?? [])
    const porEventos = contarEventosPor(partidas ?? [])

    const conUso: CategoriaConUso[] = cats
      .map(c => ({
        id: c.id,
        nombre: c.name,
        uso: {
          proveedores: porProveedores.get(c.id) ?? 0,
          partidas: porPartidas.get(c.id) ?? 0,
          eventos: porEventos.get(c.id) ?? 0,
        },
        archivada: c.archived_at !== null,
      }))
      .sort((a, b) => Number(a.archivada) - Number(b.archivada))

    setCategoriasRaw(cats)
    setCategorias(conUso)
    setPares(parecidas(activas(cats).map((c: Categoria) => c.name)))
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const empezarRenombrar = (c: CategoriaConUso) => {
    evitarBlurRef.current = false
    setEditandoId(c.id)
    setValorEdicion(c.nombre)
    setErrorEdicion('')
  }

  const cancelarRenombrar = () => {
    setEditandoId(null)
    setValorEdicion('')
    setErrorEdicion('')
  }

  const confirmarRenombrar = async (c: CategoriaConUso) => {
    if (guardandoRef.current) return
    const nombreLimpio = valorEdicion.trim()
    if (!nombreLimpio || nombreLimpio === c.nombre) { cancelarRenombrar(); return }

    const encontrada = buscarPorNombre(categoriasRaw, nombreLimpio)
    if (encontrada && encontrada.id !== c.id) {
      evitarBlurRef.current = false
      setErrorEdicion('Ya tienes una categoría que se llama así. Fusiónalas en vez de renombrar')
      return
    }
    if (!userId) return

    guardandoRef.current = true
    const resultado = await renombrar(userId, c.id, c.nombre, nombreLimpio)
    guardandoRef.current = false

    if (!resultado.ok) {
      evitarBlurRef.current = false
      setErrorEdicion(resultado.error ?? 'No se pudo cambiar el nombre.')
      return
    }

    setEditandoId(null)
    setErrorEdicion('')
    if (mensajeTimeoutRef.current) clearTimeout(mensajeTimeoutRef.current)
    const texto = puedeEliminarse(c.uso)
      ? 'Actualizada'
      : `Actualizada en ${plural(c.uso.proveedores, 'proveedor', 'proveedores')} y ${plural(c.uso.partidas, 'partida', 'partidas')}`
    setMensajeExito({ id: c.id, texto })
    mensajeTimeoutRef.current = setTimeout(() => setMensajeExito(null), 4000)
    await load()
  }

  const empezarCrear = () => {
    evitarBlurCrearRef.current = false
    setCreando(true)
    setValorNuevo('')
    setErrorNuevo('')
  }

  const cancelarCrear = () => {
    setCreando(false)
    setValorNuevo('')
    setErrorNuevo('')
  }

  const confirmarCrear = async () => {
    if (guardandoCrearRef.current) return
    const nombreLimpio = valorNuevo.trim()
    if (!nombreLimpio) { cancelarCrear(); return }

    const encontrada = buscarPorNombre(categoriasRaw, nombreLimpio)
    if (encontrada) {
      evitarBlurCrearRef.current = false
      setErrorNuevo('Ya tienes una categoría que se llama así')
      if (resaltadaTimeoutRef.current) clearTimeout(resaltadaTimeoutRef.current)
      setResaltadaId(encontrada.id)
      resaltadaTimeoutRef.current = setTimeout(() => setResaltadaId(null), 4000)
      return
    }
    if (!userId) return

    guardandoCrearRef.current = true
    const { categoria, error } = await crearCategoria(userId, nombreLimpio, categoriasRaw)
    guardandoCrearRef.current = false

    if (error || !categoria) {
      evitarBlurCrearRef.current = false
      setErrorNuevo(error ?? 'No se pudo crear la categoría.')
      return
    }

    cancelarCrear()
    await load()
  }

  if (loading) {
    return (
      <div className="flex h-[50dvh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  if (sinAcceso) {
    return (
      <div className="rounded-2xl border border-[#e8e8e8] bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-[#666]">
          Solo el dueño y los administradores pueden administrar categorías.
        </p>
        {noVerificado && (
          <p className="mt-2 text-xs text-[#999]">
            No se pudo verificar tu rol en el despacho.
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1D1E20] sm:text-2xl">Mis categorías</h1>
          <p className="mt-0.5 text-sm text-[#888]">Así están agrupados tus proveedores y partidas de presupuesto</p>
        </div>
        <button
          type="button"
          onClick={empezarCrear}
          className="shrink-0 rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3aa896]"
        >
          Nueva categoría
        </button>
      </div>

      {pares.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {pares.map(([a, b]) => (
            <div
              key={`${a}-${b}`}
              className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
            >
              <AlertTriangle size={16} className="shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-amber-800">{a} / {b}</p>
                <p className="text-xs text-amber-700">Puede que sean la misma escrita distinto</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const queda = categorias.find(c => c.nombre === a)
                  const sobra = categorias.find(c => c.nombre === b)
                  if (!queda || !sobra) return
                  accionesRefs.current.get(sobra.id)?.abrirFusionarCon(queda.id)
                }}
                className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
              >
                Revisar
              </button>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-[#e8e8e8] bg-white">
        {creando && (
          <div className="flex items-center justify-between gap-4 border-b border-[#f0f0f0] px-5 py-3.5 sm:px-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                autoFocus
                value={valorNuevo}
                onChange={e => setValorNuevo(e.target.value)}
                placeholder="Nombre de la categoría"
                onKeyDown={e => {
                  if (e.key === 'Enter') { evitarBlurCrearRef.current = true; confirmarCrear() }
                  if (e.key === 'Escape') { evitarBlurCrearRef.current = true; cancelarCrear() }
                }}
                onBlur={() => {
                  if (evitarBlurCrearRef.current) { evitarBlurCrearRef.current = false; return }
                  confirmarCrear()
                }}
                className="w-full rounded border border-[#e0e0e0] px-2 py-1 text-sm outline-none focus:border-[#48C9B0]"
              />
              {errorNuevo && <p className="text-xs text-[#cc3333]">{errorNuevo}</p>}
            </div>
          </div>
        )}
        {categorias.map((c, i) => (
          <div
            key={c.id}
            className={`flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6 transition-colors
              ${i !== categorias.length - 1 ? 'border-b border-[#f0f0f0]' : ''}
              ${c.id === resaltadaId ? 'bg-[#fffbf0]' : ''}`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {editandoId === c.id ? (
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <input
                    autoFocus
                    value={valorEdicion}
                    onChange={e => setValorEdicion(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { evitarBlurRef.current = true; confirmarRenombrar(c) }
                      if (e.key === 'Escape') { evitarBlurRef.current = true; cancelarRenombrar() }
                    }}
                    onBlur={() => {
                      if (evitarBlurRef.current) { evitarBlurRef.current = false; return }
                      confirmarRenombrar(c)
                    }}
                    className="w-full rounded border border-[#e0e0e0] px-2 py-1 text-sm outline-none focus:border-[#48C9B0]"
                  />
                  {errorEdicion && <p className="text-xs text-[#cc3333]">{errorEdicion}</p>}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => empezarRenombrar(c)}
                    className={`flex-1 truncate text-left text-sm font-medium hover:text-[#48C9B0] ${c.archivada ? 'text-[#aaa]' : 'text-[#1D1E20]'}`}
                  >
                    {c.nombre}
                  </button>
                  {c.archivada && (
                    <span className="shrink-0 rounded-full border border-[#e0e0e0] bg-[#f8f8f8] px-2 py-0.5 text-[10px] font-semibold text-[#999]">
                      Archivada
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p className={`text-xs ${mensajeExito?.id === c.id ? 'font-medium text-[#2a7a50]' : c.archivada ? 'text-[#bbb]' : 'text-[#888]'}`}>
                {mensajeExito?.id === c.id
                  ? mensajeExito.texto
                  : puedeEliminarse(c.uso)
                    ? 'Nadie la usa'
                    : [
                        plural(c.uso.proveedores, 'proveedor', 'proveedores'),
                        plural(c.uso.partidas, 'partida', 'partidas'),
                        c.uso.eventos ? plural(c.uso.eventos, 'evento', 'eventos') : null,
                      ].filter(Boolean).join(' · ')}
              </p>
              {userId && (
                <AccionesCategoria
                  ref={el => {
                    if (el) accionesRefs.current.set(c.id, el)
                    else accionesRefs.current.delete(c.id)
                  }}
                  categoria={c}
                  otrasActivas={categorias.filter(cat => !cat.archivada)}
                  userId={userId}
                  onCambiado={load}
                />
              )}
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
