'use client'

import { useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Modal } from '@/app/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { interpretarEscritura } from '@/lib/invite/persistencia'
import { normalizarCategoria } from '@/lib/rolodex/categorias'
import { nombrePorId, type Categoria } from '@/lib/rolodex/categorias-store'
import { formatCurrency } from '@/lib/types'
import type { Currency, EventBudget, SupplierStatus } from '@/lib/types'

type Props = {
  item: {
    id: string
    event_id: string
    status: SupplierStatus
    quoted_amount: number | null
    supplier: { name: string; category_id: string | null }
  }
  budgets: EventBudget[]
  categorias: Categoria[]
  currency: Currency
  nombreDeProveedor: (eventSupplierId: string) => string
  etiquetaGuardar?: string
  onClose: () => void
  onGuardado: (budgets: EventBudget[]) => void
}

// Una fila de la lista: una partida existente o una que se va a crear al
// guardar. `monto` es lo contratado por ESA partida, escrito por el planner.
type Fila = {
  clave: string
  id: string | null
  nombre: string
  categoriaId: string | null
  estimado: number
  tomadaPor: string | null
  marcada: boolean
  monto: string
}

const SIN_CATEGORIA = 'Sin categoría'

function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(/[\s,$]/g, '')
  if (!limpio) return null
  const n = Number(limpio)
  return Number.isFinite(n) && n >= 0 ? n : null
}

// El precio de cada partida se captura aqui, en el momento en que de verdad
// se sabe: al contratar. Contratar y ligar son el mismo acto, asi que no
// puede quedar un contrato que Presupuesto no vea.
export default function PartidasModal({
  item, budgets, categorias, currency, nombreDeProveedor, etiquetaGuardar = 'Guardar', onClose, onGuardado,
}: Props) {
  const [filas, setFilas] = useState<Fila[]>(() => budgets.map(b => {
    const mia = b.event_supplier_id === item.id
    return {
      clave: b.id,
      id: b.id,
      nombre: b.subcategory || nombrePorId(categorias, b.category_id) || 'Partida',
      categoriaId: b.category_id ?? null,
      estimado: Number(b.budget_amount) || 0,
      tomadaPor: b.event_supplier_id && !mia ? nombreDeProveedor(b.event_supplier_id) : null,
      marcada: mia,
      monto: mia ? String(b.contract_amount ?? b.budget_amount ?? '') : '',
    }
  }))
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const q = normalizarCategoria(busqueda)
  const visibles = q ? filas.filter(f => normalizarCategoria(f.nombre).includes(q)) : filas
  const nombreTecleado = busqueda.trim()
  const yaExiste = nombreTecleado !== '' && filas.some(f => normalizarCategoria(f.nombre) === q)
  const puedeCrear = nombreTecleado !== '' && !yaExiste

  // Agrupadas por categoria solo para leerlas: la categoria no limita nada.
  const grupos = useMemo(() => {
    const porNombre = new Map<string, Fila[]>()
    visibles.forEach(f => {
      const nombre = f.categoriaId ? (nombrePorId(categorias, f.categoriaId) || SIN_CATEGORIA) : SIN_CATEGORIA
      ;(porNombre.get(nombre) ?? porNombre.set(nombre, []).get(nombre)!).push(f)
    })
    return [...porNombre.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [visibles, categorias])

  const marcadas = filas.filter(f => f.marcada)
  const total = marcadas.reduce((suma, f) => suma + (aNumero(f.monto) ?? 0), 0)
  const cotizado = item.quoted_amount

  const alternar = (clave: string) => {
    setFilas(prev => prev.map(f => {
      if (f.clave !== clave || f.tomadaPor) return f
      const marcada = !f.marcada
      return { ...f, marcada, monto: marcada && !f.monto ? (f.estimado ? String(f.estimado) : '') : f.monto }
    }))
  }

  const cambiarMonto = (clave: string, monto: string) => {
    setFilas(prev => prev.map(f => (f.clave === clave ? { ...f, monto } : f)))
  }

  // Crear no sale de la pantalla: la partida nace con el nombre tecleado, la
  // categoria del proveedor, y el monto que se capture como estimado.
  const crear = () => {
    const nombre = nombreTecleado
    if (!nombre) return
    setFilas(prev => [...prev, {
      clave: 'nueva-' + Date.now(),
      id: null,
      nombre,
      categoriaId: item.supplier.category_id,
      estimado: 0,
      tomadaPor: null,
      marcada: true,
      monto: '',
    }])
    setBusqueda('')
  }

  const guardar = async () => {
    setError('')
    for (const f of marcadas) {
      if (aNumero(f.monto) === null) { setError(`Escribe el monto de ${f.nombre}.`); return }
    }
    setGuardando(true)

    const eranMias = new Set(budgets.filter(b => b.event_supplier_id === item.id).map(b => b.id))
    // Cada escritura se interpreta con interpretarEscritura: un UPDATE que RLS
    // filtra no da error, solo cero filas, y eso tambien es un fallo.
    type Escritura = PromiseLike<Parameters<typeof interpretarEscritura>[0]>
    const escrituras: Escritura[] = []

    for (const f of filas) {
      if (f.id && f.marcada) {
        escrituras.push(supabase.from('event_budgets')
          .update({ event_supplier_id: item.id, contract_amount: aNumero(f.monto) })
          .eq('id', f.id).select('id'))
      } else if (f.id && !f.marcada && eranMias.has(f.id)) {
        escrituras.push(supabase.from('event_budgets')
          .update({ event_supplier_id: null, contract_amount: null })
          .eq('id', f.id).select('id'))
      } else if (!f.id && f.marcada) {
        const monto = aNumero(f.monto) ?? 0
        escrituras.push(supabase.from('event_budgets')
          .insert({
            event_id: item.event_id,
            category_id: f.categoriaId,
            subcategory: f.nombre,
            budget_amount: monto,
            event_supplier_id: item.id,
            contract_amount: monto,
          })
          .select('id'))
      }
    }

    const resultados = await Promise.all(escrituras.map(e => Promise.resolve(e)))
    const fallo = resultados.map(r => interpretarEscritura(r)).find(r => !r.ok)
    if (fallo && !fallo.ok) {
      setGuardando(false)
      setError(fallo.motivo)
      return
    }

    const { data: frescos } = await supabase
      .from('event_budgets').select('*').eq('event_id', item.event_id).order('created_at', { ascending: true })
    setGuardando(false)
    onGuardado((frescos ?? []) as EventBudget[])
  }

  const diferencia = cotizado != null && marcadas.length > 0 ? total - cotizado : null

  return (
    <Modal open onClose={onClose} size="lg">
      <Modal.Header
        title={`¿En qué partidas va ${item.supplier.name}?`}
        subtitle={nombrePorId(categorias, item.supplier.category_id) || undefined}
        right={cotizado != null ? (
          <span className="block text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#999]">Te cotizó</span>
            <span className="block text-sm font-bold tabular-nums text-[#1D1E20]">{formatCurrency(cotizado, currency)}</span>
          </span>
        ) : undefined}
      />
      <Modal.Body>
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && puedeCrear) { e.preventDefault(); crear() } }}
          placeholder="Buscar o crear partida"
          className="mb-3 w-full rounded-lg border border-[#e0e0e0] bg-[#fafafa] px-3 py-2 text-sm outline-none transition focus:border-[#48C9B0] focus:bg-white"
        />

        {filas.length === 0 && !puedeCrear && (
          <p className="rounded-lg border border-dashed border-[#e0e0e0] px-3 py-3 text-sm text-[#888]">
            Este evento todavía no tiene partidas. Escribe el nombre de la primera.
          </p>
        )}

        <div className="space-y-3">
          {grupos.map(([categoria, lista]) => (
            <div key={categoria}>
              <p className="mb-1 text-[9.5px] font-bold uppercase tracking-[0.11em] text-[#bbb]">{categoria}</p>
              <ul className="space-y-0.5">
                {lista.map(f => (
                  <li key={f.clave} className={`rounded-lg px-2 py-1.5 ${f.marcada ? 'bg-[#f0faf7]' : ''} ${f.tomadaPor ? 'opacity-60' : ''}`}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={f.marcada}
                      disabled={!!f.tomadaPor}
                      onClick={() => alternar(f.clave)}
                      className="flex w-full items-center gap-2.5 text-left disabled:cursor-not-allowed"
                    >
                      <span className={`flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] ${f.marcada ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] bg-white'}`}>
                        {f.marcada && <Check size={11} strokeWidth={3.5} />}
                      </span>
                      <span className={`min-w-0 flex-1 truncate text-[13px] ${f.marcada ? 'font-semibold' : ''}`}>{f.nombre}</span>
                      {f.tomadaPor ? (
                        <span className="shrink-0 rounded-full border border-[#e0e0e0] bg-[#f5f5f5] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[#999]">{f.tomadaPor}</span>
                      ) : (
                        <span className="shrink-0 text-[11px] tabular-nums text-[#999]">{f.id ? `est. ${formatCurrency(f.estimado, currency)}` : 'nueva'}</span>
                      )}
                    </button>
                    {f.marcada && (
                      <div className="mt-1.5 flex items-center gap-2 pl-[27px]">
                        <label htmlFor={`monto-${f.clave}`} className="text-[11px] text-[#666]">Contratado</label>
                        <input
                          id={`monto-${f.clave}`}
                          type="text"
                          inputMode="decimal"
                          value={f.monto}
                          onChange={e => cambiarMonto(f.clave, e.target.value)}
                          placeholder="0"
                          className="w-32 rounded-lg border border-[#e0e0e0] px-2.5 py-1.5 text-right text-sm tabular-nums outline-none focus:border-[#48C9B0]"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {puedeCrear && (
          <button
            type="button"
            onClick={crear}
            className="mt-3 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-[#48C9B0] px-3 py-2 text-left text-sm font-medium text-[#2e9e88] transition hover:bg-[#f0faf7]"
          >
            <Plus size={14} /> Crear partida “{nombreTecleado}”
          </button>
        )}

        <div className="mt-4 border-t border-[#f2f2f2] pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#999]">Contratado</span>
            <span className="text-lg font-bold tabular-nums">{formatCurrency(total, currency)}</span>
          </div>
          {diferencia != null && diferencia !== 0 && (
            <p className={`mt-1.5 inline-block rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${diferencia < 0 ? 'bg-[#E6F3EC] text-[#1D9E75]' : 'bg-[#FAEAE6] text-[#cc3333]'}`}>
              {diferencia < 0
                ? `Ahorraste ${formatCurrency(-diferencia, currency)} contra lo cotizado`
                : `${formatCurrency(diferencia, currency)} por encima de lo cotizado`}
            </p>
          )}
          {marcadas.length === 0 && (
            <p className="mt-1.5 text-[11.5px] text-[#999]">Sin partidas, el contrato no tiene dónde vivir. Puedes dejarlo para después.</p>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-[var(--error-text)]">{error}</p>}
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          disabled={guardando}
          className="px-3 py-2 text-sm text-[#666] hover:text-[#1D1E20] disabled:opacity-50"
        >
          Después
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="ml-auto rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : etiquetaGuardar}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
