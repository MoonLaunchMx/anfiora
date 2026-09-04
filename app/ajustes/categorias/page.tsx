'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AlertTriangle } from 'lucide-react'
import { activas, buscarPorNombre, cargarCategorias, type Categoria } from '@/lib/rolodex/categorias-store'
import { parecidas, puedeEliminarse, type CategoriaConUso } from '@/lib/rolodex/vocabulario-admin'
import { renombrar } from '@/lib/rolodex/aplicar-cambios'
import AccionesCategoria from './AccionesCategoria'

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

export default function CategoriasPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [categoriasRaw, setCategoriasRaw] = useState<Categoria[]>([])
  const [categorias, setCategorias] = useState<CategoriaConUso[]>([])
  const [pares, setPares] = useState<[string, string][]>([])
  const [loading, setLoading] = useState(true)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [valorEdicion, setValorEdicion] = useState('')
  const [errorEdicion, setErrorEdicion] = useState('')
  const [mensajeExito, setMensajeExito] = useState<{ id: string; texto: string } | null>(null)

  // Al confirmar con Enter o cancelar con Escape, el input se desmonta de inmediato
  // y el navegador dispara un blur "fantasma" sobre un campo que ya no existe. Sin
  // esta guarda ese blur volveria a llamar a confirmarRenombrar con datos viejos.
  const evitarBlurRef = useRef(false)
  const guardandoRef = useRef(false)
  const mensajeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (mensajeTimeoutRef.current) clearTimeout(mensajeTimeoutRef.current) }, [])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }
    setUserId(user.id)

    const cats = await cargarCategorias(user.id)

    const [{ data: proveedores }, { data: eventos }] = await Promise.all([
      supabase.from('suppliers').select('category_id').eq('user_id', user.id),
      supabase.from('events').select('id').eq('user_id', user.id),
    ])

    const eventIds = (eventos ?? []).map(e => e.id)
    const { data: partidas } = eventIds.length > 0
      ? await supabase.from('event_budgets').select('category_id').in('event_id', eventIds)
      : { data: [] as { category_id: string | null }[] }

    const porProveedores = contarPor(proveedores ?? [])
    const porPartidas = contarPor(partidas ?? [])

    const conUso: CategoriaConUso[] = cats
      .map(c => ({
        id: c.id,
        nombre: c.name,
        uso: {
          proveedores: porProveedores.get(c.id) ?? 0,
          partidas: porPartidas.get(c.id) ?? 0,
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
      setErrorEdicion('Ya tienes una categoría que se llama así. Júntalas en vez de renombrar')
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

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1D1E20] sm:text-2xl">Mis categorías</h1>
        <p className="mt-0.5 text-sm text-[#888]">Así están agrupados tus proveedores y partidas de presupuesto</p>
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
                className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
              >
                Revisar
              </button>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-[#e8e8e8] bg-white">
        {categorias.map((c, i) => (
          <div
            key={c.id}
            className={`flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6
              ${i !== categorias.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}
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
                    : `${plural(c.uso.proveedores, 'proveedor', 'proveedores')} · ${plural(c.uso.partidas, 'partida', 'partidas')}`}
              </p>
              {userId && (
                <AccionesCategoria
                  categoria={c}
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
