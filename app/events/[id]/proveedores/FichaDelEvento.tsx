'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Globe, Mail, Pencil, Star } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { FiInstagram } from 'react-icons/fi'
import { supabase } from '@/lib/supabase'
import {
  Currency, formatCurrency,
  EventSupplier, Supplier, EventBudget, SupplierPayment, SupplierStatus,
  SUPPLIER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS, PAID_BY_LABELS,
  RESPONSE_SPEEDS, RESPONSE_SPEED_LABELS, ResponseSpeed,
} from '@/lib/types'
import { Categoria, nombrePorId } from '@/lib/rolodex/categorias-store'
import { formatDisplay, toWhatsApp } from '@/lib/phone'
import { usePermiso } from '@/lib/event-access-context'
import { accionesDe, carpetasDe, type Accion } from '@/lib/rolodex/ficha-por-estado'
import PagoModal from './PagoModal'
import PhoneInput from '@/app/components/ui/PhoneInput'

type SupplierWithDetails = EventSupplier & { supplier: Supplier }

type Props = {
  item: SupplierWithDetails
  budgets: EventBudget[]
  currency: Currency
  categorias: Categoria[]
  bodaPaso: boolean
  onStatusChange: (itemId: string, nuevo: SupplierStatus) => void
  onSaved: (item: SupplierWithDetails) => void
}

const CHIP_ESTATUS: Record<SupplierStatus, string> = {
  nuevo:      'bg-[#f1efe8] text-[#5F5C57]',
  cotizado:   'bg-[#FBF3E0] text-[#A87C1F]',
  contratado: 'bg-[#E6F3EC] text-[#1D9E75]',
  descartado: 'bg-[#FAEAE6] text-[#A63B27]',
}

const ORDEN_CAMINO: SupplierStatus[] = ['nuevo', 'cotizado', 'contratado']

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

export default function FichaDelEvento({
  item, budgets, currency, categorias, bodaPaso, onStatusChange, onSaved,
}: Props) {
  const permisoFicha = usePermiso('proveedores')
  const permisoPagos = usePermiso('pagos')

  const [pagos, setPagos] = useState<SupplierPayment[]>([])
  const [cargandoPagos, setCargandoPagos] = useState(true)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [carpeta, setCarpeta] = useState(0)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const [borrador, setBorrador] = useState(() => borradorDe(item))
  const [editandoMontos, setEditandoMontos] = useState(false)
  const [montos, setMontos] = useState(() => montosDe(item))
  const [resena, setResena] = useState(() => resenaDe(item))
  const menuRef = useRef<HTMLDivElement>(null)

  const carpetas = useMemo(() => carpetasDe(item.status, bodaPaso), [item.status, bodaPaso])
  const acciones = useMemo(
    () => accionesDe(item.status, bodaPaso).filter(accion =>
      accion.separador
        ? true
        : accion.texto === 'Registrar un pago' ? permisoPagos.editar : permisoFicha.editar
    ),
    [item.status, bodaPaso, permisoFicha.editar, permisoPagos.editar]
  )
  const hayAcciones = acciones.some(accion => !accion.separador)

  useEffect(() => { setCarpeta(0) }, [item.id, item.status])

  useEffect(() => {
    setEditando(false)
    setEditandoMontos(false)
    setErrorGuardar('')
    setBorrador(borradorDe(item))
    setMontos(montosDe(item))
    setResena(resenaDe(item))
  }, [item])

  useEffect(() => {
    let vigente = true
    setCargandoPagos(true)
    supabase
      .from('supplier_payments').select('*')
      .eq('event_supplier_id', item.id)
      .order('payment_date', { ascending: false })
      .then(({ data }) => {
        if (!vigente) return
        setPagos((data as SupplierPayment[]) ?? [])
        setCargandoPagos(false)
      })
    return () => { vigente = false }
  }, [item.id])

  useEffect(() => {
    if (!menuAbierto) return
    const alClicarFuera = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', alClicarFuera)
    return () => document.removeEventListener('mousedown', alClicarFuera)
  }, [menuAbierto])

  const s = item.supplier
  const categoria = nombrePorId(categorias, s.category_id)

  const telCrudo   = s.phone ? (s.phone.startsWith('+') ? s.phone : `${s.phone_country_code ?? '+52'} ${s.phone}`) : null
  const waDigitos  = telCrudo ? toWhatsApp(telCrudo) : null
  const telVisible = telCrudo ? formatDisplay(telCrudo) : null
  const igLink     = s.instagram ? `https://instagram.com/${s.instagram.replace('@', '')}` : null
  const webLink    = s.website ? (s.website.startsWith('http') ? s.website : `https://${s.website}`) : null

  const partida     = budgets.find(b => b.id === item.event_budget_id)
  const presupuesto = partida?.budget_amount ?? null
  const pagado      = pagos.reduce((suma, p) => suma + (p.amount || 0), 0)
  const contratado  = item.contract_amount ?? null
  const falta       = contratado ? Math.max(0, contratado - pagado) : null
  const avance      = contratado && contratado > 0 ? Math.min(100, Math.round((pagado / contratado) * 100)) : 0

  const abrir = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

  const guardarFicha = async () => {
    if (!permisoFicha.editar) { setErrorGuardar('No tienes permiso para editar proveedores en esta boda.'); return }
    if (!borrador.nombre.trim()) { setErrorGuardar('El proveedor necesita un nombre.'); return }
    setGuardando(true)
    setErrorGuardar('')
    try {
      const { data: proveedor, error: errProveedor } = await supabase
        .from('suppliers')
        .update({
          name:          borrador.nombre.trim(),
          contact_name:  borrador.contacto.trim() || null,
          phone:         borrador.telefono.trim() || null,
          email:         borrador.correo.trim() || null,
          instagram:     borrador.instagram.trim() || null,
          website:       borrador.sitio.trim() || null,
          city:          borrador.ciudad.trim() || null,
          state_region:  borrador.estado.trim() || null,
          general_notes: borrador.notasProveedor.trim() || null,
        })
        .eq('id', item.supplier_id)
        .select()
        .single()

      // Un UPDATE que no alcanza ninguna fila no da error: devuelve cero filas.
      if (errProveedor) throw errProveedor
      if (!proveedor) throw new Error('No se guardó: la ficha no te pertenece.')

      const { data: enLaBoda, error: errBoda } = await supabase
        .from('event_suppliers')
        .update({ event_notes: borrador.notasBoda.trim() || null })
        .eq('id', item.id)
        .select()
        .single()

      if (errBoda) throw errBoda
      if (!enLaBoda) throw new Error('No se guardaron las notas de esta boda.')

      onSaved({ ...(enLaBoda as EventSupplier), supplier: proveedor as Supplier })
      setEditando(false)
    } catch (err: any) {
      console.error('Error guardando la ficha:', err?.message ?? err, err)
      setErrorGuardar(err?.message ?? 'No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // Los tres updates de la ficha comparten el mismo cuidado: un UPDATE que no
  // alcanza ninguna fila devuelve cero filas sin error, y el guardado se pierde
  // en silencio.
  const guardarEnLaBoda = async (cambios: Record<string, unknown>, alTerminar?: () => void) => {
    if (!permisoFicha.editar) { setErrorGuardar('No tienes permiso para editar proveedores en esta boda.'); return }
    setGuardando(true)
    setErrorGuardar('')
    try {
      const { data, error } = await supabase
        .from('event_suppliers')
        .update(cambios)
        .eq('id', item.id)
        .select()
        .single()

      if (error) throw error
      if (!data) throw new Error('No se guardó: no alcanzó ninguna fila.')

      onSaved({ ...(data as EventSupplier), supplier: item.supplier })
      alTerminar?.()
    } catch (err: any) {
      console.error('Error guardando en la boda:', err?.message ?? err, err)
      setErrorGuardar(err?.message ?? 'No se pudo guardar. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const guardarMontos = () => {
    const cotizado = montos.cotizado.trim() === '' ? null : Number(montos.cotizado)
    const contrato  = montos.contratado.trim() === '' ? null : Number(montos.contratado)
    if ((cotizado != null && isNaN(cotizado)) || (contrato != null && isNaN(contrato))) {
      setErrorGuardar('Los montos tienen que ser números.')
      return
    }
    guardarEnLaBoda(
      {
        quoted_amount:   cotizado,
        contract_amount: contrato,
        event_budget_id: montos.partida || null,
      },
      () => setEditandoMontos(false)
    )
  }

  const guardarResena = () => guardarEnLaBoda({
    rating:         resena.estrellas || null,
    response_speed: resena.velocidad,
    review_text:    resena.nota.trim() || null,
  })

  const ejecutar = (accion: Accion) => {
    setMenuAbierto(false)
    if (accion.texto === 'Registrar un pago') {
      if (permisoPagos.editar) setCobrando(true)
      return
    }
    if (!permisoFicha.editar) return
    if (accion.nuevoEstado) { onStatusChange(item.id, accion.nuevoEstado); return }
    const destino = carpetas.indexOf('Reseña')
    if (accion.texto === 'Calificar' && destino !== -1) setCarpeta(destino)
  }

  return (
    <motion.section
      key={item.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 0.9, 0.28, 1] }}
      className="flex min-h-0 flex-1 flex-col bg-[#f8f8f8]"
    >
      <header className="shrink-0 bg-white px-5 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#f0e4c8] bg-[#fffbf0] text-[13px] font-bold text-[#b8912f]">
            {iniciales(s.name)}
          </span>

          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2 className="truncate text-[17px] font-bold tracking-tight text-[#1D1E20]">{s.name}</h2>
            <p className="truncate text-xs text-[#999]">
              {[categoria, s.subcategory, s.city].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div ref={menuRef} className="relative shrink-0">
            <button
              onClick={() => hayAcciones && setMenuAbierto(v => !v)}
              disabled={!hayAcciones}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${CHIP_ESTATUS[item.status]} ${hayAcciones ? '' : 'cursor-default'}`}
            >
              {SUPPLIER_STATUS_LABELS[item.status]}
              {hayAcciones && <ChevronDown size={12} className="opacity-70" />}
            </button>

            {menuAbierto && hayAcciones && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-56 flex-col gap-0.5 rounded-xl border border-[#e8e8e8] bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,.45)]">
                <p className="px-2.5 pb-1 pt-2 text-[9.5px] font-bold uppercase tracking-wider text-[#bbb]">
                  Qué puedes hacer
                </p>
                {acciones.map((accion, i) =>
                  accion.separador ? (
                    <span key={`sep-${i}`} className="mx-1.5 my-1 h-px bg-[#eee]" />
                  ) : (
                    <button
                      key={accion.texto}
                      onClick={() => ejecutar(accion)}
                      className={`rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition ${
                        accion.tono === 'principal' ? 'bg-[#48C9B0] text-white hover:bg-[#3aa896]'
                        : accion.tono === 'mala'    ? 'text-[#cc3333] hover:bg-[#fff5f5]'
                                                    : 'text-[#1D1E20] hover:bg-[#f6f6f6]'
                      }`}
                    >
                      {accion.texto}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {waDigitos && (
            <button
              onClick={() => abrir(`https://wa.me/${waDigitos}`)}
              className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#3aa896]"
            >
              <FaWhatsapp size={13} /> WhatsApp
            </button>
          )}
          {s.email && (
            <button onClick={() => abrir(`mailto:${s.email}`)} aria-label="Enviar correo"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#777] transition hover:text-[#1D1E20]">
              <Mail size={13} />
            </button>
          )}
          {igLink && (
            <button onClick={() => abrir(igLink)} aria-label="Abrir Instagram"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#777] transition hover:text-[#1D1E20]">
              <FiInstagram size={13} />
            </button>
          )}
          {webLink && (
            <button onClick={() => abrir(webLink)} aria-label="Abrir sitio web"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#777] transition hover:text-[#1D1E20]">
              <Globe size={13} />
            </button>
          )}

          <span className="ml-auto flex items-center gap-1.5" aria-hidden>
            {ORDEN_CAMINO.map((paso, i) => {
              const indiceActual = item.status === 'descartado' ? 2 : ORDEN_CAMINO.indexOf(item.status)
              const esAqui = item.status === 'descartado' ? i === 2 : i === indiceActual
              const hecho  = i < indiceActual
              return (
                <span
                  key={paso}
                  className={`h-1.5 w-1.5 rounded-full ${
                    esAqui
                      ? item.status === 'descartado'
                        ? 'bg-[#cc3333] ring-[3px] ring-[#cc3333]/20'
                        : 'bg-[#48C9B0] ring-[3px] ring-[#48C9B0]/25'
                      : hecho ? 'bg-[#c4c4c4]' : 'bg-[#e8e8e8]'
                  }`}
                />
              )
            })}
          </span>
        </div>
      </header>

      <div className="flex shrink-0 gap-[3px] px-4">
        {carpetas.map((nombre, i) => (
          <button
            key={nombre}
            onClick={() => setCarpeta(i)}
            className={`relative top-px flex items-center gap-1.5 rounded-t-[10px] border border-b-0 border-[#e4e1db] px-3.5 pb-2 pt-2 text-xs font-semibold transition ${
              i === carpeta ? 'bg-white pb-2.5 text-[#1D1E20]' : 'bg-[#efede8] text-[#8a8a8a] hover:text-[#5F5C57]'
            }`}
          >
            {nombre}
            {nombre === 'Pagos' && pagos.length > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${i === carpeta ? 'bg-[#f4f4f4] text-[#666]' : 'bg-white/70 text-[#777]'}`}>
                {pagos.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border-t border-[#e4e1db] bg-white px-5 py-4">
        {carpetas[carpeta] === 'Contacto' && (editando ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Nombre del proveedor">
                <input value={borrador.nombre} onChange={e => setBorrador(b => ({ ...b, nombre: e.target.value }))} className={INPUT} />
              </Campo>
              <Campo etiqueta="Persona de contacto">
                <input value={borrador.contacto} onChange={e => setBorrador(b => ({ ...b, contacto: e.target.value }))} placeholder="Con quién hablas" className={INPUT} />
              </Campo>
              <Campo etiqueta="WhatsApp">
                <PhoneInput value={borrador.telefono} onChange={valor => setBorrador(b => ({ ...b, telefono: valor }))} placeholder="55 1234 5678" />
              </Campo>
              <Campo etiqueta="Correo">
                <input type="email" value={borrador.correo} onChange={e => setBorrador(b => ({ ...b, correo: e.target.value }))} placeholder="contacto@proveedor.com" className={INPUT} />
              </Campo>
              <Campo etiqueta="Instagram">
                <input value={borrador.instagram} onChange={e => setBorrador(b => ({ ...b, instagram: e.target.value }))} placeholder="@usuario" className={INPUT} />
              </Campo>
              <Campo etiqueta="Sitio">
                <input value={borrador.sitio} onChange={e => setBorrador(b => ({ ...b, sitio: e.target.value }))} placeholder="proveedor.com" className={INPUT} />
              </Campo>
              <Campo etiqueta="Ciudad">
                <input value={borrador.ciudad} onChange={e => setBorrador(b => ({ ...b, ciudad: e.target.value }))} className={INPUT} />
              </Campo>
              <Campo etiqueta="Estado">
                <input value={borrador.estado} onChange={e => setBorrador(b => ({ ...b, estado: e.target.value }))} className={INPUT} />
              </Campo>
            </div>

            <Campo etiqueta="Notas de esta boda">
              <textarea rows={3} value={borrador.notasBoda} onChange={e => setBorrador(b => ({ ...b, notasBoda: e.target.value }))} placeholder="Acuerdos, pendientes, detalles de esta boda" className={`${INPUT} resize-none`} />
            </Campo>

            <Campo etiqueta="Notas del proveedor">
              <textarea rows={2} value={borrador.notasProveedor} onChange={e => setBorrador(b => ({ ...b, notasProveedor: e.target.value }))} placeholder="Lo que aplica para todas tus bodas con él" className={`${INPUT} resize-none`} />
            </Campo>

            {errorGuardar && (
              <p className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2 text-xs text-[#cc3333]">{errorGuardar}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={guardarFicha}
                disabled={guardando}
                className="rounded-lg bg-[#48C9B0] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => { setEditando(false); setBorrador(borradorDe(item)); setErrorGuardar('') }}
                className="rounded-lg border border-[#e0e0e0] bg-white px-3.5 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f5f5f5]"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <Bloque
              titulo="Cómo le hablas"
              accion={permisoFicha.editar ? (
                <button onClick={() => setEditando(true)} className="flex items-center gap-1 text-[11px] font-semibold text-[#48C9B0] transition hover:text-[#3aa896]">
                  <Pencil size={11} /> Editar
                </button>
              ) : null}
            >
              <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                <Dato etiqueta="WhatsApp" valor={telVisible} />
                <Dato etiqueta="Correo" valor={s.email} />
                <Dato etiqueta="Instagram" valor={s.instagram} />
                <Dato etiqueta="Sitio" valor={s.website} />
                <Dato etiqueta="Persona de contacto" valor={s.contact_name} />
                <Dato etiqueta="Dónde" valor={[s.city, s.state_region].filter(Boolean).join(', ') || null} />
              </dl>
              <p className="mt-3 text-[11px] text-[#aaa]">
                Esto vive en tu Rolodex: si lo corriges, queda corregido en todas tus bodas.
              </p>
            </Bloque>

            <Bloque titulo="Notas de esta boda">
              <Texto valor={item.event_notes} vacio="Sin notas de esta boda." />
            </Bloque>

            <Bloque titulo="Notas del proveedor">
              <Texto valor={s.general_notes} vacio="Sin notas generales." />
            </Bloque>
          </>
        ))}

        {carpetas[carpeta] === 'Cotización' && (editandoMontos ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Cotizado">
                <input
                  type="number"
                  inputMode="decimal"
                  value={montos.cotizado}
                  onChange={e => setMontos(m => ({ ...m, cotizado: e.target.value }))}
                  placeholder="0.00"
                  className={INPUT}
                />
              </Campo>
              <Campo etiqueta="Contratado">
                <input
                  type="number"
                  inputMode="decimal"
                  value={montos.contratado}
                  onChange={e => setMontos(m => ({ ...m, contratado: e.target.value }))}
                  placeholder="0.00"
                  className={INPUT}
                />
              </Campo>
            </div>

            <Campo etiqueta="Partida del presupuesto">
              <select value={montos.partida} onChange={e => setMontos(m => ({ ...m, partida: e.target.value }))} className={INPUT}>
                <option value="">Sin ligar a ninguna partida</option>
                {budgets.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.subcategory || nombrePorId(categorias, b.category_id)}
                  </option>
                ))}
              </select>
            </Campo>

            {errorGuardar && (
              <p className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2 text-xs text-[#cc3333]">{errorGuardar}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={guardarMontos}
                disabled={guardando}
                className="rounded-lg bg-[#48C9B0] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => { setEditandoMontos(false); setMontos(montosDe(item)); setErrorGuardar('') }}
                className="rounded-lg border border-[#e0e0e0] bg-white px-3.5 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f5f5f5]"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <Bloque
              titulo="Los tres montos"
              accion={permisoFicha.editar ? (
                <button onClick={() => setEditandoMontos(true)} className="flex items-center gap-1 text-[11px] font-semibold text-[#48C9B0] transition hover:text-[#3aa896]">
                  <Pencil size={11} /> Editar
                </button>
              ) : null}
            >
              <div className="grid overflow-hidden rounded-xl border border-[#e8e8e8] lg:grid-cols-3 lg:gap-px lg:bg-[#e8e8e8]">
                <Renglon etiqueta="Presupuestado" valor={presupuesto} currency={currency} />
                <Renglon etiqueta="Cotizado" valor={item.quoted_amount} currency={currency} />
                <Renglon
                  etiqueta="Contratado"
                  valor={contratado}
                  currency={currency}
                  vacio="Sin contratar"
                  fuerte
                  color={contratado ? 'text-[#1D9E75]' : undefined}
                />
              </div>
              <Diferencia
                presupuesto={presupuesto}
                cotizado={item.quoted_amount}
                contratado={contratado}
                currency={currency}
              />
            </Bloque>

            <Bloque titulo="Partida del presupuesto">
              {partida ? (
                <p className="text-sm text-[#1D1E20]">
                  {partida.subcategory || nombrePorId(categorias, partida.category_id)}
                </p>
              ) : (
                <p className="text-xs text-[#999]">Sin ligar a ninguna partida.</p>
              )}
            </Bloque>
          </>
        ))}

        {carpetas[carpeta] === 'Pagos' && (
          <>
            <Bloque titulo="Lo que llevas">
              <div className="grid overflow-hidden rounded-xl border border-[#e8e8e8] lg:grid-cols-3 lg:gap-px lg:bg-[#e8e8e8]">
                <Renglon etiqueta="Contratado" valor={contratado} currency={currency} />
                <Renglon etiqueta="Pagado" valor={cargandoPagos ? null : pagado} currency={currency} color="text-[#1D9E75]" />
                <Renglon etiqueta="Falta" valor={cargandoPagos ? null : falta} currency={currency} fuerte />
              </div>
              {contratado ? (
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#f0f0f0]">
                  <div className="h-full rounded-full bg-[#1D9E75] transition-all duration-500" style={{ width: `${avance}%` }} />
                </div>
              ) : null}
            </Bloque>

            <Bloque
              titulo={pagos.length > 0 ? `Pagos registrados · ${pagos.length}` : 'Pagos registrados'}
              accion={permisoPagos.editar ? (
                <button
                  onClick={() => setCobrando(true)}
                  className="rounded-lg bg-[#48C9B0] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#3aa896]"
                >
                  + Registrar pago
                </button>
              ) : null}
            >
              {cargandoPagos ? (
                <div className="h-12 animate-pulse rounded-lg bg-[#f5f5f5]" />
              ) : pagos.length === 0 ? (
                <p className="text-xs text-[#999]">Todavía no le registras pagos.</p>
              ) : (
                <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
                  {pagos.map(p => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e8e8e8] bg-[#fafafa] px-3 py-2">
                      <span className="min-w-0 text-xs text-[#666]">
                        <span className="block text-[#1D1E20]">
                          {new Date(p.payment_date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                        <span className="truncate">
                          {p.payment_method ? PAYMENT_METHOD_LABELS[p.payment_method] : 'Sin método'}
                          {p.paid_by ? ` · ${PAID_BY_LABELS[p.paid_by]}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[#1D1E20]">
                        {formatCurrency(p.amount, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>
          </>
        )}

        {carpetas[carpeta] === 'Reseña' && (
          <>
            <div className="rounded-xl border border-[#f0e4c8] bg-[#fffbf0] px-4 py-3 text-xs font-medium text-[#b8912f]">
              Esta boda ya pasó. ¿Cómo te fue con {s.name}?
            </div>

            <Bloque titulo="Tu calificación">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    disabled={!permisoFicha.editar}
                    onClick={() => setResena(r => ({ ...r, estrellas: r.estrellas === n ? 0 : n }))}
                    aria-label={`${n} de 5`}
                    className="transition disabled:cursor-default"
                  >
                    <Star
                      size={22}
                      className={n <= resena.estrellas ? 'fill-[#48C9B0] text-[#48C9B0]' : 'fill-transparent text-[#d8d8d8]'}
                    />
                  </button>
                ))}
              </div>
            </Bloque>

            <Bloque titulo="Qué tan rápido contesta">
              <div className="flex flex-wrap gap-1.5">
                {RESPONSE_SPEEDS.map(velocidad => (
                  <button
                    key={velocidad}
                    disabled={!permisoFicha.editar}
                    onClick={() => setResena(r => ({ ...r, velocidad: r.velocidad === velocidad ? null : velocidad }))}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition disabled:cursor-default ${
                      resena.velocidad === velocidad
                        ? 'border-[#1D1E20] bg-[#1D1E20] text-white'
                        : 'border-[#e0e0e0] bg-white text-[#666] hover:bg-[#f5f5f5]'
                    }`}
                  >
                    {RESPONSE_SPEED_LABELS[velocidad]}
                  </button>
                ))}
              </div>
            </Bloque>

            <Bloque titulo="Nota">
              {permisoFicha.editar ? (
                <textarea
                  rows={3}
                  value={resena.nota}
                  onChange={e => setResena(r => ({ ...r, nota: e.target.value }))}
                  placeholder="Cómo cumplió el día del evento"
                  className={`${INPUT} resize-none`}
                />
              ) : (
                <Texto valor={item.review_text} vacio="Sin nota de cómo te fue." />
              )}
            </Bloque>

            {errorGuardar && (
              <p className="rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2 text-xs text-[#cc3333]">{errorGuardar}</p>
            )}

            {permisoFicha.editar && (
              <button
                onClick={guardarResena}
                disabled={guardando}
                className="self-start rounded-lg bg-[#48C9B0] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : 'Guardar la reseña'}
              </button>
            )}
          </>
        )}

        {carpetas[carpeta] === 'Motivo' && (
          <>
            <Bloque titulo="Por qué lo descartaste">
              <p className="text-xs text-[#999]">
                Todavía no se guarda el motivo del descarte. Es la columna que falta del spec.
              </p>
            </Bloque>
            <Bloque titulo="Notas de esta boda">
              <Texto valor={item.event_notes} vacio="Sin notas." />
            </Bloque>
            <p className="text-[11px] text-[#aaa]">Sin estrellas: nunca trabajaste con él, no hay nada que calificar.</p>
          </>
        )}
      </div>

      {cobrando && (
        <PagoModal
          eventSupplierId={item.id}
          proveedor={s.name}
          currency={currency}
          contratado={contratado}
          pagadoHastaAhora={pagado}
          onGuardado={pago => setPagos(previos => [pago, ...previos])}
          onCerrar={() => setCobrando(false)}
        />
      )}

    </motion.section>
  )
}

const INPUT = 'w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#48C9B0]'

function borradorDe(item: SupplierWithDetails) {
  const s = item.supplier
  return {
    nombre:         s.name ?? '',
    contacto:       s.contact_name ?? '',
    telefono:       s.phone ?? '',
    correo:         s.email ?? '',
    instagram:      s.instagram ?? '',
    sitio:          s.website ?? '',
    ciudad:         s.city ?? '',
    estado:         s.state_region ?? '',
    notasProveedor: s.general_notes ?? '',
    notasBoda:      item.event_notes ?? '',
  }
}

function montosDe(item: SupplierWithDetails) {
  return {
    cotizado:   item.quoted_amount?.toString() ?? '',
    contratado: item.contract_amount?.toString() ?? '',
    partida:    item.event_budget_id ?? '',
  }
}

function resenaDe(item: SupplierWithDetails) {
  return {
    estrellas: item.rating ?? 0,
    velocidad: item.response_speed as ResponseSpeed | null,
    nota:      item.review_text ?? '',
  }
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-[#999]">{etiqueta}</span>
      {children}
    </label>
  )
}

function Bloque({ titulo, accion, children }: { titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-[#999]">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#bbb]">{etiqueta}</dt>
      <dd className={`truncate text-[13px] ${valor ? 'text-[#1D1E20]' : 'text-[#ccc]'}`}>{valor || '—'}</dd>
    </div>
  )
}

function Texto({ valor, vacio }: { valor: string | null; vacio: string }) {
  if (!valor) return <p className="text-xs text-[#999]">{vacio}</p>
  return <p className="whitespace-pre-wrap text-sm text-[#555]">{valor}</p>
}

function Renglon({ etiqueta, valor, currency, vacio, fuerte, color }: {
  etiqueta: string
  valor: number | null
  currency: Currency
  vacio?: string
  fuerte?: boolean
  color?: string
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 border-b border-[#f2f2f2] px-3.5 py-2.5 last:border-b-0 lg:flex-col lg:items-start lg:justify-start lg:gap-0.5 lg:border-b-0 lg:py-3 ${fuerte ? 'bg-[#fafafa]' : 'bg-white'}`}>
      <span className={`text-[13px] lg:text-[10px] lg:font-bold lg:uppercase lg:tracking-wider ${fuerte ? 'font-semibold text-[#1D1E20] lg:text-[#999]' : 'text-[#666] lg:text-[#999]'}`}>
        {etiqueta}
      </span>
      <span className={`text-[15px] font-bold tabular-nums lg:text-[17px] ${valor == null ? 'text-[#ccc]' : color ?? 'text-[#1D1E20]'}`}>
        {valor == null ? (vacio ?? '—') : formatCurrency(valor, currency)}
      </span>
    </div>
  )
}

function Diferencia({ presupuesto, cotizado, contratado, currency }: {
  presupuesto: number | null
  cotizado: number | null
  contratado: number | null
  currency: Currency
}) {
  // Contra el presupuesto, que es la meta. Mientras no haya contrato manda lo cotizado.
  const contra = contratado ?? cotizado
  if (presupuesto == null || contra == null || contra === presupuesto) return null

  const diferencia = contra - presupuesto

  return (
    <div className="mt-2.5">
      {diferencia < 0 ? (
        <span className="rounded-lg bg-[#E6F3EC] px-2.5 py-1 text-xs font-bold text-[#1D9E75]">
          Ahorraste {formatCurrency(-diferencia, currency)}
        </span>
      ) : (
        <span className="rounded-lg bg-[#FAEAE6] px-2.5 py-1 text-xs font-bold text-[#cc3333]">
          {formatCurrency(diferencia, currency)} por encima
        </span>
      )}
    </div>
  )
}
