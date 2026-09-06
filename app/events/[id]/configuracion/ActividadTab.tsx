'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Check, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { agrupar, mapaDeRestauraciones } from '@/lib/actividad/agrupar'
import { entidadDeAccion } from '@/lib/actividad/vocabulario'
import { dependienteDe, idPadreDe } from '@/lib/actividad/dependientes'
import {
  planDeRestauracion, tandasPorTabla, arrastrados, insercionDeFila, type Insercion,
} from '@/lib/actividad/restaurar'
import type { FilaAudit, Movimiento, Restauracion } from '@/lib/actividad/tipos'
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
  // entity_id -> cuando volvio por ultima vez. NO es un conjunto de ids: una
  // entidad se borra, se restaura y se vuelve a borrar, y sin la fecha el
  // borrado nuevo heredaba el "Restaurado" del anterior.
  const [restaurados, setRest]    = useState<Map<string, Restauracion>>(new Map())
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
    setFilas(lista)
    setRest(mapaDeRestauraciones(lista))
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
    // "Borrados" es la papelera: solo lo que SIGUE borrado. Al restaurar algo
    // desaparece de aqui, que es como se comportan Notion, Drive y Dropbox: la
    // papelera es una lista de pendientes, no un archivo. El historial completo
    // vive en "Todo", donde el borrado se queda marcado como restaurado.
    (vista === 'todo' || (m.esBorrado && !m.restaurado)) &&
    (!fModulo || m.modulo === fModulo) &&
    (!fPersona || m.persona === fPersona))

  const registros = visibles.reduce((n, m) => n + m.total, 0)

  // Lo que se fue colgando de este movimiento y quedo en otro lote: hoy solo
  // los acompanantes. Se calcula aparte para poder ANUNCIARLO antes de aceptar.
  const arrastrePendiente = (mov: Movimiento, soloEstos?: Set<string>) =>
    arrastrados(planDeRestauracion(mov, soloEstos), filas, restaurados)

  const restaurar = async (mov: Movimiento, soloEstos?: Set<string>) => {
    const base = planDeRestauracion(mov, soloEstos)
    if (base.length === 0) return

    // Los hijos van DESPUES de sus padres: no entran si el padre no existe.
    const extra = arrastrePendiente(mov, soloEstos)
      .map(insercionDeFila)
      .filter((i): i is Insercion => i !== null)
    const plan = [...base, ...extra]

    const que = soloEstos
      ? 'este registro'
      : mov.total > 1 ? `los ${mov.total} registros` : (mov.filas[0].entity_label || 'este registro')

    // tone 'default' y confirmLabel a proposito: el modal trae 'Eliminar' en
    // rojo por omision, porque nacio para borrar. Aqui se restaura. El boton
    // no repite el conteo: eso ya lo dice el titulo.
    const ok = await askConfirm({
      title: `¿Restaurar ${que}?`,
      message: `Vuelven a ${mov.modulo ? LABEL_MODULO[mov.modulo] : 'la boda'} tal como estaban antes de que ${mov.persona} los eliminara, ${cuandoRelativo(mov.cuando)}.`
        + (extra.length
            ? ` Regresan también ${extra.length} ${extra.length === 1 ? 'acompañante que venía' : 'acompañantes que venían'} con ellos.`
            : ''),
      confirmLabel: 'Restaurar',
      cancelLabel: 'Cancelar',
      tone: 'default',
    })
    if (!ok) return

    setError(null)
    setTrabajando(mov.clave)

    // De donde sale la etiqueta y el tipo de cada fila de bitacora. Van las del
    // movimiento MAS las del arrastre: los acompanantes no estan en mov.filas y
    // sin su fila quedaban sin entity_type, que es NOT NULL.
    const fuentes = [...mov.filas, ...arrastrePendiente(mov, soloEstos)]

    // Tanda por tanda y EN ORDEN: dentro de una tabla da igual, pero entre
    // tablas es la dependencia (el acompanante no entra si su invitado
    // todavia no existe), asi que nada de Promise.all.
    //
    // upsert con ignoreDuplicates en vez de insert: mandando la tanda junta,
    // un solo registro que ya estuviera tumbaria a los 42. Postgres se salta
    // los repetidos y los demas entran, que es el "ya estaba" de siempre.
    const hechas: Insercion[] = []

    for (const tanda of tandasPorTabla(plan)) {
      const { error } = await supabase
        .from(tanda[0].tabla)
        .upsert(tanda.map(i => i.fila), { onConflict: 'id', ignoreDuplicates: true })

      // Un aviso no es una pregunta: va como franja, no como modal de
      // confirmar/cancelar.
      if (error) {
        // Lo que YA volvio se registra igual: si no, quedan de vuelta en la
        // boda pero la pantalla sigue creyendo que estan borrados.
        await registrarRestauraciones(hechas, fuentes, mov.modulo)
        setTrabajando(null)
        // El motivo va EN el aviso. Decir solo "no se pudo" obliga a adivinar,
        // y adivinar cuesta una vuelta entera de prueba.
        console.error('[actividad] fallo al restaurar en', tanda[0].tabla, error)
        setError(
          `Regresaron ${hechas.length} de ${plan.length}. Falló al escribir en ${tanda[0].tabla}: ` +
          `${error.message}${error.code ? ` (${error.code})` : ''}`,
        )
        await cargar()
        return
      }

      hechas.push(...tanda)
    }

    const fallo = await registrarRestauraciones(hechas, fuentes, mov.modulo)

    setTrabajando(null)
    if (fallo) setError(fallo)
    await cargar()
  }

  // La bitacora de la restauracion, de un viaje. logAction() pide el usuario y
  // busca su nombre CADA vez que se llama: para 42 registros eran 126 viajes
  // al servidor, que es lo que hacia lenta la restauracion de un lote.
  // Devuelve null si todo bien, o el aviso que hay que enseñar. La bitacora NO
  // es opcional aqui: la pantalla se guia por ella, asi que si no se escribe,
  // lo restaurado sigue viendose como borrado y el planner le pica en vano.
  const registrarRestauraciones = async (
    plan: Insercion[],
    fuentes: FilaAudit[],
    modulo: string | null,
  ): Promise<string | null> => {
    if (plan.length === 0) return null

    const aviso = 'Los registros ya volvieron a la boda, pero no se pudo anotar en la bitácora. Recarga para verlos.'

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return aviso

      const { data: perfil } = await supabase
        .from('users').select('full_name').eq('id', user.id).single()

      const porEntidad = new Map(fuentes.map(f => [f.entity_id, f]))

      const { error } = await supabase.from('event_audit_log').insert(
        plan.map(ins => {
          const fila = porEntidad.get(ins.entityId)
          return {
            event_id:     eventId,
            user_id:      user.id,
            user_email:   user.email ?? '',
            user_name:    perfil?.full_name ?? null,
            action:       ins.accionRestauracion,
            // NOT NULL en la base. La accion siempre trae la entidad delante,
            // asi que sirve de respaldo cuando la fila fuente no aparece.
            entity_type:  fila?.entity_type ?? entidadDeAccion(ins.accionRestauracion),
            entity_id:    ins.entityId,
            entity_label: fila?.entity_label ?? null,
            old_value:    null,
            new_value:    null,
            // El modulo del borrado que se esta deshaciendo. Sin el la fila
            // queda huerfana y se archiva como si fuera de "Equipo".
            modulo,
          }
        }),
      )

      // insert() NO lanza: devuelve el error. Sin revisarlo, un rechazo de la
      // base pasaba callado y la pantalla se quedaba mintiendo.
      if (error) {
        console.warn('[actividad] la bitacora rechazo la restauracion:', error.message)
        return aviso
      }
      return null
    } catch (e) {
      console.warn('[actividad] no se pudo registrar la restauracion:', e)
      return aviso
    }
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

            // El conteo cuenta PRINCIPALES: un invitado con 2 acompanantes es
            // "Alejandra Roldán · +2 acompañantes", no "3 registros". Lo que se
            // fue colgando se dice aparte, que es como se lee la historia.
            // La etiqueta sale de la CABEZA, que es el padre. Buscar "la
            // primera fila que tenga etiqueta" hacia que un proveedor sin
            // nombre guardado se titulara con el monto de uno de sus pagos.
            const etiqueta = mov.principales > 1
              ? <span className="tabular-nums">{mov.principales} registros</span>
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
                        {mov.arrastreTexto && (
                          <span className="shrink-0 font-normal text-[#999]">{mov.arrastreTexto}</span>
                        )}
                        {mov.esBorrado && !mov.restaurado && (
                          <span className="shrink-0 rounded-full border border-[#ffc0c0] bg-[#fff0f0] px-[7px] py-px text-[10.5px] font-medium uppercase tracking-[.03em] text-[#cc3333]">
                            Eliminado
                          </span>
                        )}
                      </span>
                      <span className="mt-px block text-xs text-[#999]">
                        {mov.etiquetaAccion} por{' '}
                        <span className="font-medium" style={{ color: t.tinta }}>{mov.persona}</span>
                        {mov.restauracion && (
                          <> · Restaurado por {mov.restauracion.persona}, {cuandoRelativo(mov.restauracion.cuando)}</>
                        )}
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
                      {/* En movil el chevron es la unica pista de que el
                          renglon abre, porque ahi ya no vive el boton. */}
                      <ChevronDown
                        size={14}
                        className={`text-[#bbb] transition-transform ${estaAbierta ? 'rotate-180' : ''}`}
                      />
                      <span className="hidden min-w-[82px] text-right text-[11.5px] tabular-nums text-[#bbb] sm:block">
                        {cuando}
                      </span>
                      {/* Restaurar solo vive en el renglon en escritorio. En
                          movil baja al detalle: el renglon deja de ir apretado
                          y deja de poderse picar sin querer. */}
                      <span className="hidden justify-end sm:flex sm:min-w-[92px]">
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
                              : 'Restaurar'}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>

                  {estaAbierta && (
                    <Detalle
                      mov={mov}
                      arrastre={arrastrePendiente(mov)}
                      restaurados={restaurados}
                      trabajando={trabajando === mov.clave}
                      onRescatar={id => restaurar(mov, new Set([id]))}
                      onRestaurar={() => restaurar(mov)}
                    />
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
  mov, arrastre, restaurados, trabajando, onRescatar, onRestaurar,
}: {
  mov: Movimiento
  arrastre: FilaAudit[]
  restaurados: Map<string, Restauracion>
  trabajando: boolean
  onRescatar: (entityId: string) => void
  onRestaurar: () => void
}) {
  const campos = camposLegibles(mov.filas[0].old_value ?? mov.filas[0].new_value)
  const enLote = mov.total > 1
  const primeros = mov.filas.slice(0, 5)
  const resto = mov.total - primeros.length

  // Cuelga de otra fila del MISMO movimiento: entonces se dibuja indentado y
  // sin boton propio. Un hijo suelto, sin su padre aqui, se trata como uno mas.
  const presentes = new Set(mov.filas.map(f => f.entity_id).filter((x): x is string => x !== null))
  const cuelga = (f: FilaAudit) => {
    const id = idPadreDe(f.entity_type, f.old_value)
    return id !== null && presentes.has(id)
  }

  return (
    <div className="border-t border-[#f4f4f4] bg-[#fafafa] px-3.5 pb-4 pt-1 sm:pl-[60px] sm:pr-5">
      {/* Solo movil: en escritorio este boton vive en el renglon. */}
      {mov.esBorrado && (
        <div className="pt-3 sm:hidden">
          {mov.restaurado ? (
            <span className="flex items-center gap-1.5 text-[12.5px] text-[#bbb]">
              <Check size={13} />Ya se restauró
            </span>
          ) : (
            <button
              type="button"
              onClick={onRestaurar}
              disabled={trabajando}
              className="w-full rounded-lg bg-[#48C9B0] px-4 py-2.5 text-[13.5px] font-semibold text-[#08312a] disabled:opacity-60"
            >
              {trabajando
                ? 'Restaurando…'
                : 'Restaurar'}
            </button>
          )}
        </div>
      )}

      {arrastre.length > 0 && (
        <div className="mt-3 max-w-[560px] rounded-r-lg border border-l-2 border-[#e8e8e8] border-l-[#d4a853] bg-[#fffbf0] px-3 py-2.5 text-[12.5px] text-[#666]">
          Se llevó también {arrastre.length}{' '}
          {arrastre.length === 1 ? 'acompañante' : 'acompañantes'}, que la app borró
          en otro momento y por eso salen aparte. <b className="font-semibold text-[#1D1E20]">Al restaurar
          desde aquí regresan con ellos.</b>
        </div>
      )}

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
            {mov.dependientes > 0
              ? 'Se eliminó, y lo que se llevó'
              : mov.esBorrado ? 'Se eliminaron' : 'Se editaron'}
          </h4>
          <ul className="m-0 max-w-[560px] list-none p-0">
            {primeros.map(f => {
              // Igual que en el renglon: solo cuenta si volvio DESPUES de
              // este borrado, no en alguno anterior.
              const volvio = f.entity_id ? restaurados.get(f.entity_id) : undefined
              const listo = volvio !== undefined && volvio.cuando > new Date(f.created_at).getTime()
              return (
                <li
                  key={f.id}
                  className={`flex items-center justify-between gap-3 border-b border-[#f0f0f0] py-1.5 text-[12.5px] text-[#666] last:border-b-0 ${
                    cuelga(f) ? 'relative pl-[18px] before:absolute before:left-[5px] before:top-0 before:h-1/2 before:w-px before:bg-[#e8e8e8] after:absolute after:left-[5px] after:top-1/2 after:h-px after:w-2 after:bg-[#e8e8e8]' : ''
                  }`}
                >
                  <span className={`min-w-0 truncate ${cuelga(f) ? '' : 'font-medium text-[#1D1E20]'}`}>
                    {f.entity_label || 'Sin nombre guardado'}
                    {cuelga(f) && (
                      <span className="text-[#bbb]"> · {dependienteDe(f.entity_type)?.uno}</span>
                    )}
                  </span>
                  {/* Al acompanante no se le ofrece rescate individual: cuelga
                      de su invitado, asi que solo no puede volver. */}
                  {mov.esBorrado && !cuelga(f) && (
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
