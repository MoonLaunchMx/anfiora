'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MoreHorizontal, AlertTriangle } from 'lucide-react'
import { activas, cargarCategorias, type Categoria } from '@/lib/rolodex/categorias-store'
import { parecidas, puedeEliminarse, type CategoriaConUso } from '@/lib/rolodex/vocabulario-admin'

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
  const [categorias, setCategorias] = useState<CategoriaConUso[]>([])
  const [pares, setPares] = useState<[string, string][]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }

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
          oculta: c.archived_at !== null,
        }))
        .sort((a, b) => Number(a.oculta) - Number(b.oculta))

      setCategorias(conUso)
      setPares(parecidas(activas(cats).map((c: Categoria) => c.name)))
      setLoading(false)
    }
    load()
  }, [router])

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
            <div className="flex min-w-0 items-center gap-2">
              <p className={`truncate text-sm font-medium ${c.oculta ? 'text-[#aaa]' : 'text-[#1D1E20]'}`}>
                {c.nombre}
              </p>
              {c.oculta && (
                <span className="shrink-0 rounded-full border border-[#e0e0e0] bg-[#f8f8f8] px-2 py-0.5 text-[10px] font-semibold text-[#999]">
                  Oculta
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p className={`text-xs ${c.oculta ? 'text-[#bbb]' : 'text-[#888]'}`}>
                {puedeEliminarse(c.uso)
                  ? 'Nadie la usa'
                  : `${c.uso.proveedores} proveedores · ${c.uso.partidas} partidas`}
              </p>
              <button
                type="button"
                className="rounded-lg p-1.5 text-[#bbb] transition hover:bg-[#f8f8f8] hover:text-[#888]"
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
