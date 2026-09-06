'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Globe, Mail, Paperclip, Pencil, Trash2, X } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { FiInstagram } from 'react-icons/fi'
import { supabase } from '@/lib/supabase'
import {
  Currency, formatCurrency,
  EventSupplier, Supplier, EventBudget, SupplierPayment, SupplierStatus,
  SUPPLIER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS, PAID_BY_LABELS,
  SupplierReview, MOTIVO_DESCARTE_LABEL,
} from '@/lib/types'
import { Categoria, nombrePorId } from '@/lib/rolodex/categorias-store'
import { formatDisplay, toWhatsApp } from '@/lib/phone'
import {
  PAISES, PAIS_POR_DEFECTO, bandera, ciudadesDe, estadosDe,
  nombrePais, normalizarCiudad, normalizarEstado, tieneEstados,
} from '@/lib/geo/divisiones'
import SelectorGeo from '@/app/components/ui/SelectorGeo'
import EscalaCinco from '@/app/components/ui/EscalaCinco'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { usePermiso } from '@/lib/event-access-context'
import { carpetasDe, destinosDe, QUE_SIGNIFICA } from '@/lib/rolodex/ficha-por-estado'
import { anclasDe, EJES_DESEMPENO, NOMBRE_EJE, ANCLAS_RECONTRATACION } from '@/lib/reviews/ejes'
import { calcularScores } from '@/lib/reviews/scores'
import { TOPE_COMPROBANTES, TOPE_COTIZACIONES, visibles } from '@/lib/archivos/adjuntos'
import PagoModal from './PagoModal'
import ListaDeArchivos from './ListaDeArchivos'
import ReviewDesempenoModal from './ReviewDesempenoModal'
import { CaminoDelTrato, COLOR_ESTADO, EstatusProveedor, ICONO_ESTADO } from './EstatusProveedor'
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
  onQuitada: (itemId: string) => void
  // Solo cuando la ficha vive en una ventana: en el panel no hay a donde cerrar.
  onCerrar?: () => void
}

// Se dice que fallo la lectura, no que no hay nada: ofrecer "califica" sobre una
// lectura rota lleva al planner a chocar contra una review que si existe.
function ErrorDeReviews() {
  return (
    <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error-text)]">
      No se pudieron cargar las reseñas de este proveedor. Recarga la página antes de calificarlo.
    </p>
  )
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

export default function FichaDelEvento({
  item, budgets, currency, categorias, bodaPaso, onStatusChange, onSaved, onQuitada, onCerrar,
}: Props) {
  const askConfirm = useConfirm()
  const permisoFicha = usePermiso('proveedores')
  const permisoPagos = usePermiso('pagos')

  const [pagos, setPagos] = useState<SupplierPayment[]>([])
  const [cargandoPagos, setCargandoPagos] = useState(true)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [pagoEnEdicion, setPagoEnEdicion] = useState<SupplierPayment | null>(null)
  const [carpeta, setCarpeta] = useState(0)
  const [pagoAbierto, setPagoAbierto] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const [borrador, setBorrador] = useState(() => borradorDe(item))
  const [editandoMontos, setEditandoMontos] = useState(false)
  const [montos, setMontos] = useState(() => montosDe(item))
  const [reviews, setReviews] = useState<SupplierReview[]>([])
  const [cargandoReviews, setCargandoReviews] = useState(true)
  // Una lectura que falla -- tabla ausente, RLS -- no es lo mismo que "nadie lo
  // ha calificado". Sin esta bandera la ficha ofrece escribir una review que
  // quiza ya existe, y el upsert choca contra el indice unico.
  const [errorReviews, setErrorReviews] = useState(false)
  const [mostrarModalDesempeno, setMostrarModalDesempeno] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [eventName, setEventName] = useState('')
  // El dueno de la cuenta, que es de quien cuelga la review -- no quien la
  // teclea. Ver la nota en lib/reviews/useGuardarReview.ts.
  const [duenoEvento, setDuenoEvento] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const carpetas = useMemo(() => carpetasDe(item.status, bodaPaso), [item.status, bodaPaso])
  const cotizaciones = useMemo(() => visibles(item.quote_files), [item.quote_files])
  const destinos = useMemo(() => destinosDe(item.status), [item.status])
  const puedeMover = permisoFicha.editar

  // Todas las reviews del proveedor (todas sus bodas): los scores de la
  // cabecera son la reputacion del proveedor, no solo la de esta boda.
  const scores = useMemo(() => calcularScores(reviews), [reviews])
  const reviewPostEvento = useMemo(
    () => reviews.find(r => r.event_supplier_id === item.id && r.review_type === 'post_evento' && r.autor === 'planner') ?? null,
    [reviews, item.id],
  )
  const reviewDescarte = useMemo(
    () => reviews.find(r => r.event_supplier_id === item.id && r.review_type === 'descarte') ?? null,
    [reviews, item.id],
  )

  useEffect(() => { setCarpeta(0) }, [item.id, item.status])

  useEffect(() => {
    setEditando(false)
    setEditandoMontos(false)
    setErrorGuardar('')
    setBorrador(borradorDe(item))
    setMontos(montosDe(item))
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

  const cargarReviews = (supplierId: string) =>
    supabase.from('supplier_reviews').select('*').eq('supplier_id', supplierId)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error cargando las reviews:', error?.message ?? error, error)
          setErrorReviews(true)
          return
        }
        setErrorReviews(false)
        setReviews((data as SupplierReview[]) ?? [])
      })

  useEffect(() => {
    let vigente = true
    setCargandoReviews(true)
    supabase
      .from('supplier_reviews').select('*')
      .eq('supplier_id', item.supplier_id)
      .then(({ data, error }) => {
        if (!vigente) return
        if (error) {
          console.error('Error cargando las reviews:', error?.message ?? error, error)
          setErrorReviews(true)
        } else {
          setErrorReviews(false)
          setReviews((data as SupplierReview[]) ?? [])
        }
        setCargandoReviews(false)
      })
    return () => { vigente = false }
  }, [item.supplier_id])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  useEffect(() => {
    let vigente = true
    supabase.from('events').select('name, user_id').eq('id', item.event_id).single()
      .then(({ data }) => {
        if (!vigente) return
        setEventName(data?.name ?? '')
        setDuenoEvento(data?.user_id ?? null)
      })
    return () => { vigente = false }
  }, [item.event_id])

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
          country:       borrador.pais || null,
          city:          normalizarCiudad(borrador.pais, borrador.estado, borrador.ciudad) || null,
          state_region:  normalizarEstado(borrador.pais, borrador.estado) || null,
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

  const quitarDeLaBoda = async () => {
    const ok = await askConfirm({
      title: `¿Quitar a ${s.name} de esta boda?`,
      message: pagos.length > 0
        ? `Se borran ${pagos.length === 1 ? 'el pago registrado' : `los ${pagos.length} pagos registrados`} y su vínculo con el presupuesto. El proveedor sigue en tu Rolodex para otras bodas.`
        : 'El proveedor sigue en tu Rolodex para otras bodas.',
    })
    if (!ok) return

    const { error } = await supabase.from('event_suppliers').delete().eq('id', item.id)
    if (error) {
      console.error('Error quitando el proveedor:', error?.message ?? error, error)
      setErrorGuardar('No se pudo quitar de esta boda.')
      return
    }
    onQuitada(item.id)
  }

  const borrarPago = async (pago: SupplierPayment) => {
    const conComprobante = visibles(pago.receipt_files).length
    const ok = await askConfirm({
      title: `¿Eliminar el pago de ${formatCurrency(pago.amount, currency)}?`,
      message: `Bajará el total pagado a ${s.name}. No se puede deshacer.${
        conComprobante
          ? ` Este pago tiene ${conComprobante} comprobante${conComprobante > 1 ? 's' : ''}: se quedan guardados, pero sin este pago ya no habrá dónde verlos.`
          : ''
      }`,
    })
    if (!ok) return

    const { error } = await supabase.from('supplier_payments').delete().eq('id', pago.id)
    if (error) {
      console.error('Error eliminando el pago:', error?.message ?? error, error)
      setErrorGuardar('No se pudo eliminar el pago.')
      return
    }
    setPagos(previos => previos.filter(otro => otro.id !== pago.id))
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

  const moverA = (destino: SupplierStatus) => {
    setMenuAbierto(false)
    if (!permisoFicha.editar) return
    onStatusChange(item.id, destino)
  }

  const sacarDeLaBoda = () => {
    setMenuAbierto(false)
    if (!permisoFicha.borrar) return
    quitarDeLaBoda()
  }

  return (
    <motion.section
      key={item.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 0.9, 0.28, 1] }}
      className="relative flex min-h-0 flex-1 flex-col bg-[#f8f8f8]"
    >
      <header className="shrink-0 bg-white px-4 pb-3 pt-4 lg:px-5">
        <div className="flex items-start gap-3 lg:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#f0e4c8] bg-[#fffbf0] text-[12px] font-bold text-[#b8912f] lg:h-10 lg:w-10 lg:text-[13px]">
            {iniciales(s.name)}
          </span>

          <div className="flex min-w-0 flex-1 flex-col lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-2.5">
            <h2 className="truncate text-[16px] font-bold tracking-tight text-[#1D1E20] lg:text-[17px]">{s.name}</h2>
            <p className="truncate text-[11.5px] text-[#999] lg:text-xs">
              {[categoria, s.subcategory, s.city].filter(Boolean).join(' · ')}
            </p>
            <p className="flex shrink-0 items-center gap-2.5 text-[11px] font-semibold text-[#aaa] lg:text-[11.5px]">
              <span>Propuesta <span className={scores.propuesta == null ? 'text-[#ccc]' : 'text-[#1D1E20]'}>{scores.propuesta ?? '—'}</span></span>
              <span aria-hidden className="text-[#ddd]">·</span>
              <span>Desempeño <span className={scores.desempeno == null ? 'text-[#ccc]' : 'text-[#1D1E20]'}>{scores.desempeno ?? '—'}</span></span>
            </p>
          </div>



          <span className="hidden shrink-0 lg:block">
            <CaminoDelTrato estado={item.status} />
          </span>

          {onCerrar && (
            <button
              onClick={onCerrar}
              aria-label="Cerrar"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#999] transition hover:text-[#1D1E20]"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Escritorio: contactos y el boton de mover */}
        <div className="mt-2.5 hidden flex-wrap items-center gap-1.5 lg:flex">
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

          <div ref={menuRef} className="relative ml-auto shrink-0">
            <button
              onClick={() => puedeMover && setMenuAbierto(v => !v)}
              disabled={!puedeMover}
              className={`flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] bg-white px-2.5 py-1.5 text-xs font-bold text-[#1D1E20] transition ${
                puedeMover ? 'hover:bg-[#f5f5f5]' : 'cursor-default opacity-60'
              }`}
            >
              Mover a
              <ChevronDown size={12} className="text-[#999]" />
            </button>

            {menuAbierto && puedeMover && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 hidden w-64 flex-col gap-0.5 rounded-xl border border-[#e8e8e8] bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,.45)] lg:flex">
                <p className="px-2.5 pb-1 pt-2 text-[9.5px] font-bold uppercase tracking-wider text-[#bbb]">Mover a</p>
                {destinos.map(destino => (
                  <BotonDestino key={destino} destino={destino} onClick={() => moverA(destino)} />
                ))}
                {permisoFicha.borrar && (
                  <>
                    <span className="mx-1.5 my-1 h-px bg-[#eee]" />
                    <BotonQuitar onClick={sacarDeLaBoda} />
                  </>
                )}
              </div>
            )}
          </div>
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
              <Campo etiqueta="País">
                <SelectorGeo
                  valor={nombrePais(borrador.pais)}
                  onChange={n => {
                    const elegido = PAISES.find(p => p.name === n)
                    setBorrador(b => ({ ...b, pais: elegido?.iso ?? PAIS_POR_DEFECTO, estado: '', ciudad: '' }))
                  }}
                  opciones={PAISES.map(p => ({ valor: p.name, icono: bandera(p.iso) }))}
                  icono={bandera(borrador.pais)}
                  placeholder="Elige el país"
                  buscarPlaceholder="Buscar país…"
                />
              </Campo>
              <Campo etiqueta="Estado">
                <SelectorGeo
                  valor={borrador.estado}
                  onChange={e => setBorrador(b => ({ ...b, estado: e, ciudad: '' }))}
                  opciones={estadosDe(borrador.pais).map(e => ({ valor: e }))}
                  libre={!tieneEstados(borrador.pais)}
                  placeholder={tieneEstados(borrador.pais) ? 'Elige el estado' : 'Escribe el estado'}
                  sinOpcionesTexto={
                    tieneEstados(borrador.pais)
                      ? 'Sin coincidencias'
                      : `Todavía no tenemos la lista de ${nombrePais(borrador.pais)}, escríbelo`
                  }
                />
              </Campo>
              <Campo etiqueta="Ciudad">
                <SelectorGeo
                  valor={borrador.ciudad}
                  onChange={c => setBorrador(b => ({ ...b, ciudad: c }))}
                  opciones={ciudadesDe(borrador.pais, borrador.estado).map(c => ({
                    valor: c, grupo: `De ${borrador.estado}`,
                  }))}
                  libre
                  placeholder="Elige o escribe"
                  buscarPlaceholder="Buscar o escribir…"
                  sinOpcionesTexto="Escribe el nombre de la ciudad"
                />
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

            <Bloque titulo={cotizaciones.length ? `Cotizaciones guardadas · ${cotizaciones.length}` : 'Cotizaciones guardadas'}>
              <ListaDeArchivos
                eventId={item.event_id}
                carpeta="cotizaciones"
                dueno={item.id}
                archivos={item.quote_files}
                tope={TOPE_COTIZACIONES}
                puedeEditar={permisoFicha.editar}
                textoVacio="Sube la cotización"
                onCambio={lista => onSaved({ ...item, quote_files: lista })}
              />
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
                    <li key={p.id} className="group overflow-hidden rounded-lg border border-[#e8e8e8] bg-[#fafafa]">
                     <div className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 text-xs text-[#666]">
                        <span className="block text-[#1D1E20]">
                          {new Date(p.payment_date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </span>
                        <span className="truncate">
                          {p.payment_method ? PAYMENT_METHOD_LABELS[p.payment_method] : 'Sin método'}
                          {p.paid_by ? ` · ${PAID_BY_LABELS[p.paid_by]}` : ''}
                          {p.reference ? ` · ${p.reference}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => setPagoAbierto(actual => (actual === p.id ? null : p.id))}
                          aria-expanded={pagoAbierto === p.id}
                          aria-label={`Comprobantes de este pago`}
                          className={`flex items-center gap-1 rounded-full border bg-white px-2 py-1 text-[10.5px] font-bold transition ${
                            visibles(p.receipt_files).length
                              ? 'border-[#e0e0e0] text-[#666] hover:border-[#48C9B0] hover:text-[#3aa896]'
                              : 'border-dashed border-[#e0e0e0] text-[#bbb] hover:border-[#48C9B0] hover:text-[#3aa896]'
                          }`}
                        >
                          <Paperclip size={11} />
                          {visibles(p.receipt_files).length || 'Sin comprobante'}
                        </button>
                        <span className="text-sm font-semibold tabular-nums text-[#1D1E20]">
                          {formatCurrency(p.amount, currency)}
                        </span>
                        {permisoPagos.editar && (
                          <span className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                            <button
                              onClick={() => setPagoEnEdicion(p)}
                              aria-label="Editar el pago"
                              className="flex h-6 w-6 items-center justify-center rounded-md text-[#999] transition hover:bg-white hover:text-[#1D1E20]"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => borrarPago(p)}
                              aria-label="Eliminar el pago"
                              className="flex h-6 w-6 items-center justify-center rounded-md text-[#999] transition hover:bg-white hover:text-[#cc3333]"
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        )}
                      </span>
                     </div>

                     {pagoAbierto === p.id && (
                       <div className="border-t border-dashed border-[#e0e0e0] bg-white px-3 py-2.5">
                         <ListaDeArchivos
                           eventId={item.event_id}
                           carpeta="comprobantes"
                           dueno={p.id}
                           archivos={p.receipt_files}
                           tope={TOPE_COMPROBANTES}
                           puedeEditar={permisoPagos.editar}
                           textoVacio="Sube el comprobante de este pago"
                           onCambio={lista => setPagos(actuales =>
                             actuales.map(otro => (otro.id === p.id ? { ...otro, receipt_files: lista } : otro))
                           )}
                         />
                       </div>
                     )}
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

            {cargandoReviews ? (
              <div className="h-28 animate-pulse rounded-lg bg-[#f5f5f5]" />
            ) : errorReviews ? (
              <ErrorDeReviews />
            ) : reviewPostEvento ? (
              <ResumenPostEvento
                review={reviewPostEvento}
                currency={currency}
                onEditar={permisoFicha.editar ? () => setMostrarModalDesempeno(true) : undefined}
              />
            ) : permisoFicha.editar ? (
              <button
                onClick={() => setMostrarModalDesempeno(true)}
                className="self-start rounded-lg bg-[#48C9B0] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896]"
              >
                Calificar el desempeño
              </button>
            ) : (
              <p className="text-xs text-[#999]">Todavía no se calificó el desempeño de este proveedor.</p>
            )}
          </>
        )}

        {carpetas[carpeta] === 'Motivo' && (
          <>
            <Bloque titulo="Por qué lo descartaste">
              {cargandoReviews ? (
                <div className="h-5 w-40 animate-pulse rounded bg-[#f5f5f5]" />
              ) : errorReviews ? (
                <ErrorDeReviews />
              ) : reviewDescarte?.motivo_descarte ? (
                <p className="text-sm text-[#1D1E20]">{MOTIVO_DESCARTE_LABEL[reviewDescarte.motivo_descarte]}</p>
              ) : (
                <p className="text-xs text-[#999]">Sin motivo registrado.</p>
              )}
            </Bloque>
            <Bloque titulo="Comentarios">
              <Texto valor={reviewDescarte?.comentarios ?? null} vacio="Sin comentarios." />
            </Bloque>
            <Bloque titulo="Notas de esta boda">
              <Texto valor={item.event_notes} vacio="Sin notas." />
            </Bloque>
          </>
        )}
      </div>

      {mostrarModalDesempeno && userId && duenoEvento && (
        <ReviewDesempenoModal
          eventSupplierId={item.id}
          supplierId={item.supplier_id}
          eventId={item.event_id}
          duenoId={duenoEvento}
          createdBy={userId}
          supplierName={s.name}
          eventName={eventName}
          reviewExistente={reviewPostEvento}
          onSaved={() => { setMostrarModalDesempeno(false); cargarReviews(item.supplier_id) }}
          onSkip={() => setMostrarModalDesempeno(false)}
        />
      )}

      {(cobrando || pagoEnEdicion) && (
        <PagoModal
          eventId={item.event_id}
          eventSupplierId={item.id}
          proveedor={s.name}
          currency={currency}
          contratado={contratado}
          pagadoHastaAhora={pagado}
          pago={pagoEnEdicion}
          onGuardado={pago => setPagos(previos =>
            previos.some(otro => otro.id === pago.id)
              ? previos.map(otro => (otro.id === pago.id ? pago : otro))
              : [pago, ...previos]
          )}
          onCerrar={() => { setCobrando(false); setPagoEnEdicion(null) }}
        />
      )}

      <div className="flex shrink-0 items-center gap-2 border-t border-[#e8e8e8] bg-white px-4 py-2.5 lg:hidden">
        {waDigitos && (
          <button
            onClick={() => abrir(`https://wa.me/${waDigitos}`)}
            aria-label="Abrir WhatsApp"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#48C9B0] text-white transition"
          >
            <FaWhatsapp size={16} />
          </button>
        )}
        {s.email && (
          <button onClick={() => abrir(`mailto:${s.email}`)} aria-label="Enviar correo"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#666]">
            <Mail size={16} />
          </button>
        )}
        {igLink && (
          <button onClick={() => abrir(igLink)} aria-label="Abrir Instagram"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#666]">
            <FiInstagram size={16} />
          </button>
        )}
        {webLink && (
          <button onClick={() => abrir(webLink)} aria-label="Abrir sitio web"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8e8e8] bg-white text-[#666]">
            <Globe size={16} />
          </button>
        )}
        <button
          onClick={() => puedeMover && setMenuAbierto(true)}
          disabled={!puedeMover}
          className={`ml-auto flex h-9 shrink-0 items-center gap-1 rounded-lg border border-[#e8e8e8] bg-white pl-1 pr-2 ${puedeMover ? '' : 'cursor-default'}`}
        >
          <EstatusProveedor estado={item.status} />
          {puedeMover && <ChevronDown size={12} className="text-[#999]" />}
        </button>
      </div>

      {/* Movil: las acciones suben como hoja, no cuelgan como menu */}
      {menuAbierto && puedeMover && (
        <div className="absolute inset-0 z-40 lg:hidden">
          <button
            aria-label="Cerrar las acciones"
            onClick={() => setMenuAbierto(false)}
            className="absolute inset-0 bg-black/35"
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 rounded-t-2xl bg-white px-4 pb-5 pt-2.5 shadow-[0_-14px_36px_-20px_rgba(0,0,0,.5)]">
            <span aria-hidden className="mx-auto mb-1 h-1 w-9 rounded-full bg-[#e4e1db]" />
            <div className="pb-1">
              <CaminoDelTrato estado={item.status} />
            </div>
            <p className="pb-1 pt-1 text-[9.5px] font-bold uppercase tracking-wider text-[#bbb]">Mover a</p>
            {destinos.map(destino => (
              <BotonDestino key={destino} destino={destino} grande onClick={() => moverA(destino)} />
            ))}
            {permisoFicha.borrar && <BotonQuitar grande onClick={sacarDeLaBoda} />}
          </div>
        </div>
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
    pais:           s.country || PAIS_POR_DEFECTO,
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

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wider text-[#999]">{etiqueta}</span>
      {children}
    </label>
  )
}

function BotonDestino({ destino, grande, onClick }: {
  destino: SupplierStatus
  grande?: boolean
  onClick: () => void
}) {
  const Icono = ICONO_ESTADO[destino]
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg text-left transition ${
        grande ? 'border border-[#e8e8e8] px-3 py-2.5' : 'px-2.5 py-2 hover:bg-[#f6f6f6]'
      }`}
    >
      <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md ${COLOR_ESTADO[destino]}`}>
        <Icono size={12} strokeWidth={2.6} />
      </span>
      <span className="min-w-0">
        <span className={`block font-semibold text-[#1D1E20] ${grande ? 'text-sm' : 'text-xs'}`}>
          {SUPPLIER_STATUS_LABELS[destino]}
        </span>
        <span className="block truncate text-[11px] text-[#999]">{QUE_SIGNIFICA[destino]}</span>
      </span>
    </button>
  )
}

function BotonQuitar({ grande, onClick }: { grande?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg text-left transition ${
        grande ? 'mt-1 border border-[#ffd9d9] px-3 py-2.5' : 'px-2.5 py-2 hover:bg-[#fff5f5]'
      }`}
    >
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-[#FAEAE6] text-[#cc3333]">
        <Trash2 size={12} strokeWidth={2.6} />
      </span>
      <span className="min-w-0">
        <span className={`block font-semibold text-[#cc3333] ${grande ? 'text-sm' : 'text-xs'}`}>Quitar de esta boda</span>
        <span className="block truncate text-[11px] text-[#999]">Se queda en tu Rolodex</span>
      </span>
    </button>
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

function ResumenPostEvento({ review, currency, onEditar }: {
  review: SupplierReview
  currency: Currency
  onEditar?: () => void
}) {
  return (
    <>
      <Bloque
        titulo="Cómo calificaste el desempeño"
        accion={onEditar ? (
          <button onClick={onEditar} className="flex items-center gap-1 text-[11px] font-semibold text-[#48C9B0] transition hover:text-[#3aa896]">
            <Pencil size={11} /> Editar
          </button>
        ) : null}
      >
        <div className="space-y-4">
          {EJES_DESEMPENO.map(eje => (
            <EscalaCinco
              key={eje}
              nombre={NOMBRE_EJE[eje]}
              anclas={anclasDe('desempeno', eje)}
              valor={review[eje]}
              onChange={() => {}}
              deshabilitado
            />
          ))}
        </div>
      </Bloque>

      <Bloque titulo="¿Lo volverían a contratar?">
        <EscalaCinco
          nombre="Probabilidad de recontratación"
          anclas={ANCLAS_RECONTRATACION}
          valor={review.recontratacion}
          onChange={() => {}}
          deshabilitado
        />
        {review.recontratacion === 1 && (
          <p className="mt-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-xs font-semibold text-[var(--error-text)]">
            Queda vetado: no aparece en sugerencias hasta que alguien lo revierta a mano.
          </p>
        )}
      </Bloque>

      <Bloque titulo="Cobros extra">
        {review.cobros_extra == null ? (
          <p className="text-xs text-[#999]">Sin especificar.</p>
        ) : (
          <p className="text-sm text-[#1D1E20]">
            {review.cobros_extra ? 'Sí' : 'No'}
            {review.cobros_extra && review.monto_cobros_extra ? ` · ${formatCurrency(review.monto_cobros_extra, currency)}` : ''}
          </p>
        )}
      </Bloque>

      <Bloque titulo="Comentarios">
        <Texto valor={review.comentarios} vacio="Sin comentarios." />
      </Bloque>
    </>
  )
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
