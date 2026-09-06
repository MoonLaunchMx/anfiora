'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Check, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logAction } from '@/lib/audit'
import { ACCIONES_RESTAURACION, type AuditAction, type AuditEntityType } from '@/lib/actividad/vocabulario'
import { agrupar } from '@/lib/actividad/agrupar'
import { planDeRestauracion, esConflictoDeLlave } from '@/lib/actividad/restaurar'
import type { FilaAudit, Movimiento } from '@/lib/actividad/tipos'
import { MODULOS_CONFIG, type Modulo } from '@/lib/permisos/catalogo'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { Cargando } from '@/app/components/ui/Cargando'

const LABEL_MODULO: Record<string, string> =
  Object.fromEntries(MODULOS_CONFIG.map(m => [m.key, m.label]))

const ICONO_MODULO: Record<string, React.ElementType> =
  Object.fromEntries(MODULOS_CONFIG.map(m => [m.key, m.icon]))

// La herramienta como columna propia y no enterrada en la glosa: es lo que se
// busca al barrer la lista con la vista. Un movimiento sin modulo (equipo,
// evento) cae en "Equipo", que es donde se configuran.
function ChipModulo({ modulo }: { modulo: string | null }) {
  const Icono = modulo ? ICONO_MODULO[modulo] : Users
  const texto = modulo ? (LABEL_MODULO[modulo] ?? modulo) : 'Equipo'
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#e8e8e8] bg-[#f8f8f8] px-2 py-1 text-[11.5px] text-[#666]">
      {Icono && <Icono size={12} className="shrink-0 text-[#999]" />}
      <span className="truncate">{texto}</span>
    </span>
  )
}

// Tonos apagados: distinguen a las personas sin competir con el rojo de
// "Eliminado" ni con el teal del boton. Se asignan por nombre, asi que la
// misma persona sale siempre igual.
const TONOS = [
  { fondo: '#2F7D6B', tinta: '#25604F' },
  { fondo: '#9A6B2F', tinta: '#7A5321' },
  { fondo: '#4A5E9E', tinta: '#3A4A80' },
  { fondo: '#8A4B72', tinta: '#6E3A5B' },
  { fondo: '#5B7A3A', tinta: '#48602D' },
  { fondo: '#8A5340', tinta: '#6E4133' },
]

function tono(nombre: string) {
  let h = 0
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TONOS[h % TONOS.length]
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(' ').filter(Boolean)
  return (p.length >= 2 ? p[0][0] + p[1][0] : (p[0]?.[0] ?? '?')).toUpperCase()
}

// Mismo formato que usa el chat de Mensajes, para que los dos se lean igual.
function encabezadoDia(fecha: string): string {
  const d = new Date(fecha)
  const hoy = new Date()
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

function cuandoRelativo(fecha: string): string {
  const d = new Date(fecha)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`

  const hoy = new Date()
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return `hace ${Math.floor(min / 60)} h`
  if (d.toDateString() === ayer.toDateString()) {
    return `ayer, ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
  }
  const dias = Math.floor(min / 1440)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

// Columnas que no le dicen nada a nadie en el detalle.
const OCULTAS = new Set([
  'id', 'event_id', 'user_id', 'created_at', 'updated_at', 'guest_id',
  'table_id', 'supplier_id', 'event_supplier_id', 'event_budget_id',
])

const NOMBRE_CAMPO: Record<string, string> = {
  name: 'Nombre', phone: 'Teléfono', email: 'Correo', notes: 'Notas',
  party_size: 'Lugares', rsvp_status: 'Confirmación', side: 'Lado',
  title: 'Título', amount: 'Monto', capacity: 'Capacidad', number: 'Número',
  shape: 'Forma', category: 'Categoría', subcategory: 'Partida',
  budget_amount: 'Estimado', quoted_amount: 'Cotizado',
  contract_amount: 'Contratado', payment_date: 'Fecha del pago',
  payment_method: 'Método', paid_by: 'Pagó', reference: 'Referencia',
  song_title: 'Canción', artist: 'Artista', guest_name: 'Sugerida por',
  task_date: 'Fecha', priority: 'Prioridad', status: 'Estado',
  price: 'Precio', store: 'Tienda',
}

function nombreCampo(k: string): string {
  return NOMBRE_CAMPO[k] ?? k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

function valorCampo(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function camposLegibles(old: Record<string, unknown> | null): [string, string][] {
  if (!old) return []
  return Object.entries(old)
    .filter(([k, v]) => !OCULTAS.has(k) && v !== null && v !== '')
    .slice(0, 12)
    .map(([k, v]) => [nombreCampo(k), valorCampo(v)])
}

export default function ActividadTab({ eventId }: { eventId: string }) {
  const askConfirm = useConfirm()

  const [filas, setFilas]         = useState<FilaAudit[]>([])
  const [restaurados, setRest]    = useState<Set<string>>(new Set())
  const [loading, setLoading]     = useState(true)
  const [vista, setVista]         = useState<'todo' | 'borrados'>('todo')
  const [fModulo, setFModulo]     = useState('')
  const [fPersona, setFPersona]   = useState('')
  const [abierta, setAbierta]     = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const cargar = async () => {
    const { data } = await supabase
      .from('event_audit_log')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(500)

    const lista = (data ?? []) as FilaAudit[]
    const yaVolvieron = new Set(
      lista
        .filter(f => (ACCIONES_RESTAURACION as readonly string[]).includes(f.action))
        .map(f => f.entity_id)
        .filter((x): x is string => x !== null),
    )
    setFilas(lista)
    setRest(yaVolvieron)
    setLoading(false)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  const movimientos = useMemo(() => agrupar(filas, restaurados), [filas, restaurados])

  const modulosUsados = useMemo(
    () => [...new Set(movimientos.map(m => m.modulo).filter((m): m is Modulo => m !== null))],
    [movimientos],
  )
  const personas = useMemo(
    () => [...new Set(movimientos.map(m => m.persona))],
    [movimientos],
  )

  const visibles = movimientos.filter(m =>
    (vista === 'todo' || m.esBorrado) &&
    (!fModulo || m.modulo === fModulo) &&
    (!fPersona || m.persona === fPersona))

  const registros = visibles.reduce((n, m) => n + m.total, 0)

  const restaurar = async (mov: Movimiento, soloEstos?: Set<string>) => {
    const plan = planDeRestauracion(mov, soloEstos)
    if (plan.length === 0) return

    const que = soloEstos
      ? 'este registro'
      : mov.total > 1 ? `los ${mov.total} registros` : (mov.filas[0].entity_label || 'este registro')

    const varios = !soloEstos && mov.total > 1

    // tone 'default' y confirmLabel a proposito: el modal trae 'Eliminar' en
    // rojo por omision, porque nacio para borrar. Aqui se restaura.
    const ok = await askConfirm({
      title: `¿Restaurar ${que}?`,
      message: `Vuelven a ${mov.modulo ? LABEL_MODULO[mov.modulo] : 'la boda'} tal como estaban antes de que ${mov.persona} los eliminara, ${cuandoRelativo(mov.cuando)}.`,
      confirmLabel: varios ? `Restaurar los ${mov.total}` : 'Restaurar',
      cancelLabel: 'Cancelar',
      tone: 'default',
    })
    if (!ok) return

    setError(null)
    setTrabajando(mov.clave)
    let volvieron = 0

    // Uno por uno y en orden: el padre tiene que existir antes que el hijo,
    // asi que nada de Promise.all.
    for (const ins of plan) {
      const { error } = await supabase.from(ins.tabla).insert(ins.fila)

      // Un aviso no es una pregunta: va como franja, no como modal de
      // confirmar/cancelar.
      if (error && !esConflictoDeLlave(error)) {
        setTrabajando(null)
        setError(`Regresaron ${volvieron} de ${plan.length}. El resto sigue en la bitácora para intentarlo otra vez.`)
        await cargar()
        return
      }

      volvieron += 1
      const fila = mov.filas.find(f => f.entity_id === ins.entityId)
      await logAction({
        eventId,
        action: ins.accionRestauracion as AuditAction,
        entityType: (fila?.entity_type ?? 'guest') as AuditEntityType,
        entityId: ins.entityId,
        entityLabel: fila?.entity_label ?? undefined,
      })
    }

    setTrabajando(null)
    await cargar()
  }

  if (loading) return <Cargando />

  if (movimientos.length === 0) {
    return (
      <div className="px-5 py-14 text-center text-[13px] text-[#999]">
        Todavía no hay actividad en esta boda
      </div>
    )
  }

  let diaActual: string | null = null

  return (
    <div>
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[#e8e8e8] px-3.5 py-3 sm:px-5">
        <div className="inline-flex gap-0.5 rounded-lg bg-[#1D1E20] p-[3px]">
          {(['todo', 'borrados'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`rounded-md px-3 py-[5px] text-[12.5px] transition ${
                vista === v
                  ? 'bg-white/[.14] font-medium text-white'
                  : 'text-white/55 hover:text-white/85'
              }`}
            >
              {v === 'todo' ? 'Todo' : 'Borrados'}
            </button>
          ))}
        </div>

        <SelectNegro
          value={fModulo}
          onChange={setFModulo}
          placeholder="Todas las herramientas"
          opciones={modulosUsados.map(m => ({ valor: m, texto: LABEL_MODULO[m] ?? m }))}
        />
        <SelectNegro
          value={fPersona}
          onChange={setFPersona}
          placeholder="Todo el equipo"
          opciones={personas.map(p => ({ valor: p, texto: p }))}
        />

        <span className="ml-auto text-xs tabular-nums text-[#999]">
          {visibles.length} {visibles.length === 1 ? 'movimiento' : 'movimientos'}
          {registros !== visibles.length && ` · ${registros} registros`}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 border-b border-[#ffc0c0] bg-[#fff0f0] px-3.5 py-2.5 text-[12.5px] text-[#cc3333] sm:px-5">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 font-medium underline underline-offset-2"
          >
            Cerrar
          </button>
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="px-5 py-14 text-center text-[13px] text-[#999]">
          Nada que mostrar con estos filtros.
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {visibles.map(mov => {
            const dia = encabezadoDia(mov.cuando)
            const nuevoDia = dia !== diaActual
            if (nuevoDia) diaActual = dia
            const t = tono(mov.persona)
            const estaAbierta = abierta === mov.clave
            const cuando = cuandoRelativo(mov.cuando)

            const etiqueta = mov.total > 1
              ? <span className="tabular-nums">{mov.total} registros</span>
              : mov.filas[0].entity_label
                ? mov.filas[0].entity_label
                : <span className="font-normal italic text-[#bbb]">Sin nombre guardado</span>

            return (
              <li key={mov.clave}>
                {nuevoDia && (
                  <div className="sticky top-0 z-[2] border-b border-[#e8e8e8] bg-[#f2f2f2] px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[.07em] text-[#999] sm:px-5">
                    {dia}
                  </div>
                )}

                <div className="border-t border-[#f4f4f4] first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setAbierta(estaAbierta ? null : mov.clave)}
                    aria-expanded={estaAbierta}
                    className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-[#fafafa] sm:grid-cols-[28px_minmax(0,1fr)_128px_auto] sm:gap-3 sm:px-5"
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10.5px] font-semibold text-white"
                      style={{ background: t.fondo }}
                    >
                      {iniciales(mov.persona)}
                    </span>

                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-[7px] text-[13.5px] font-medium text-[#1D1E20]">
                        {etiqueta}
                        {mov.esBorrado && !mov.restaurado && (
                          <span className="shrink-0 rounded-full border border-[#ffc0c0] bg-[#fff0f0] px-[7px] py-px text-[10.5px] font-medium uppercase tracking-[.03em] text-[#cc3333]">
                            Eliminado
                          </span>
                        )}
                      </span>
                      <span className="mt-px block text-xs text-[#999]">
                        {mov.etiquetaAccion} por{' '}
                        <span className="font-medium" style={{ color: t.tinta }}>{mov.persona}</span>
                        {/* En pantalla chica no hay columna de herramienta ni
                            de fecha: las dos bajan aqui. */}
                        <span className="text-[#bbb] sm:hidden">
                          {' · '}{mov.modulo ? LABEL_MODULO[mov.modulo] : 'Equipo'} · {cuando}
                        </span>
                      </span>
                    </span>

                    <span className="hidden min-w-0 sm:block">
                      <ChipModulo modulo={mov.modulo} />
                    </span>

                    <span className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2.5">
                      <ChevronDown
                        size={14}
                        className={`hidden text-[#bbb] transition-transform sm:block ${estaAbierta ? 'rotate-180' : ''}`}
                      />
                      <span className="hidden min-w-[82px] text-right text-[11.5px] tabular-nums text-[#bbb] sm:block">
                        {cuando}
                      </span>
                      <span className="flex justify-end sm:min-w-[92px]">
                        {mov.esBorrado && (mov.restaurado ? (
                          <span className="flex items-center gap-1 whitespace-nowrap text-[11.5px] text-[#bbb]">
                            <Check size={12} />Restaurado
                          </span>
                        ) : (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={e => { e.stopPropagation(); restaurar(mov) }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); restaurar(mov) }
                            }}
                            className="whitespace-nowrap rounded-md border border-transparent px-2.5 py-1 text-[12.5px] font-medium text-[#1D9E75] transition hover:border-[#48C9B0] hover:bg-[#48C9B0] hover:text-white"
                          >
                            {trabajando === mov.clave
                              ? 'Restaurando…'
                              : mov.total > 1 ? `Restaurar los ${mov.total}` : 'Restaurar'}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>

                  {estaAbierta && (
                    <Detalle mov={mov} restaurados={restaurados} onRescatar={id => restaurar(mov, new Set([id]))} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Detalle({
  mov, restaurados, onRescatar,
}: {
  mov: Movimiento
  restaurados: Set<string>
  onRescatar: (entityId: string) => void
}) {
  const campos = camposLegibles(mov.filas[0].old_value ?? mov.filas[0].new_value)
  const enLote = mov.total > 1
  const primeros = mov.filas.slice(0, 5)
  const resto = mov.total - primeros.length

  return (
    <div className="border-t border-[#f4f4f4] bg-[#fafafa] px-3.5 pb-4 pt-1 sm:pl-[60px] sm:pr-5">
      {campos.length > 0 && (
        <>
          <h4 className="mb-2 mt-3 text-[10.5px] font-semibold uppercase tracking-[.06em] text-[#bbb]">
            {mov.esBorrado ? 'Lo que se llevó' : 'Lo que cambió'}
          </h4>
          <dl className="grid max-w-[560px] grid-cols-1 gap-x-4 gap-y-0.5 text-[12.5px] sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-y-[5px]">
            {campos.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-[#999]">{k}</dt>
                <dd className="m-0 mb-[7px] tabular-nums text-[#666] sm:mb-0">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {enLote && (
        <>
          <h4 className="mb-2 mt-3 text-[10.5px] font-semibold uppercase tracking-[.06em] text-[#bbb]">
            {mov.esBorrado ? 'Se eliminaron' : 'Se editaron'}
          </h4>
          <ul className="m-0 max-w-[560px] list-none p-0">
            {primeros.map(f => {
              const listo = f.entity_id !== null && restaurados.has(f.entity_id)
              return (
                <li key={f.id} className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] py-1.5 text-[12.5px] text-[#666] last:border-b-0">
                  <span className="min-w-0 truncate">{f.entity_label || 'Sin nombre guardado'}</span>
                  {mov.esBorrado && (
                    listo ? (
                      <span className="whitespace-nowrap px-1.5 py-0.5 text-[11.5px] text-[#bbb]">Restaurado</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => f.entity_id && onRescatar(f.entity_id)}
                        className="whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11.5px] text-[#1D9E75] transition hover:bg-[#48C9B0]/[.14]"
                      >
                        Restaurar solo este
                      </button>
                    )
                  )}
                </li>
              )
            })}
          </ul>
          {resto > 0 && <p className="pt-[7px] text-xs text-[#bbb]">y {resto} más</p>}
        </>
      )}
    </div>
  )
}

function SelectNegro({
  value, onChange, placeholder, opciones,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  opciones: { valor: string; texto: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={placeholder}
        className="cursor-pointer appearance-none rounded-lg bg-[#1D1E20] py-[7px] pl-3 pr-7 text-[12.5px] text-white"
      >
        <option value="">{placeholder}</option>
        {opciones.map(o => (
          <option key={o.valor} value={o.valor}>{o.texto}</option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50"
      />
    </div>
  )
}
