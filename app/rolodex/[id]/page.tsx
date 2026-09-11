'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CalendarCheck, Globe, Mail, MapPin } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { FiFacebook, FiInstagram } from 'react-icons/fi'
import { supabase } from '@/lib/supabase'
import { Currency, Supplier, formatCurrency } from '@/lib/types'
import { Categoria, cargarCategorias, nombrePorId } from '@/lib/rolodex/categorias-store'
import { contactosDe, telefonoCrudoDe } from '@/lib/rolodex/contactos'
import type { ContactoTipo } from '@/lib/rolodex/contactos'
import { formatDisplay } from '@/lib/phone'
import {
  armarFilas, partirActivosHistorial, tasaDeCierre, ahorroNegociado, rangoContratado,
  ultimoCierre, calificaciones, hoyISO, mesYAno, iniciales,
} from '@/lib/rolodex/expediente'
import type { FilaExpediente, ReviewCruda } from '@/lib/rolodex/expediente'
import { Cargando } from '@/app/components/ui/Cargando'
import Estrellas from '@/app/components/ui/Estrellas'
import { TablaExpediente, FilasExpediente } from './Tablas'
import type { Carpeta } from './Tablas'

type Estado =
  | { fase: 'cargando' }
  | { fase: 'no-encontrado' }
  | { fase: 'error' }
  | { fase: 'listo'; proveedor: Supplier; categorias: Categoria[]; filas: FilaExpediente[]; reviews: ReviewCruda[] }

export default function ExpedientePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [carpeta, setCarpeta] = useState<Carpeta | null>(null)
  const hoy = useMemo(() => hoyISO(), [])

  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const { data: proveedor, error } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle()
      if (!vivo) return
      if (error) { setEstado({ fase: 'error' }); return }
      if (!proveedor) { setEstado({ fase: 'no-encontrado' }); return }

      const [vinculosRes, reviewsRes, categorias] = await Promise.all([
        supabase.from('event_suppliers').select('id, event_id, status, quoted_amount').eq('supplier_id', id),
        supabase.from('supplier_reviews')
          .select('event_supplier_id, review_type, autor, precio_valor, calidad, comunicacion, servicio_trato, manejo_imprevistos, razones_seleccion, motivo_descarte, comentarios')
          .eq('supplier_id', id),
        cargarCategorias(proveedor.user_id),
      ])
      if (!vivo) return
      if (vinculosRes.error || reviewsRes.error) { setEstado({ fase: 'error' }); return }

      const vinculos = vinculosRes.data ?? []
      const ids = vinculos.map(v => v.id)
      const idsEventos = [...new Set(vinculos.map(v => v.event_id))]

      const [eventosRes, partidasRes, pagosRes] = await Promise.all([
        idsEventos.length
          ? supabase.from('events').select('id, name, event_date, event_end_date, venue, currency').in('id', idsEventos)
          : Promise.resolve({ data: [], error: null }),
        ids.length
          ? supabase.from('event_budgets').select('event_supplier_id, contract_amount').in('event_supplier_id', ids)
          : Promise.resolve({ data: [], error: null }),
        ids.length
          ? supabase.from('supplier_payments').select('event_supplier_id, amount').in('event_supplier_id', ids)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (!vivo) return
      if (eventosRes.error || partidasRes.error || pagosRes.error) { setEstado({ fase: 'error' }); return }

      const reviews = (reviewsRes.data ?? []) as ReviewCruda[]
      const filas = armarFilas({
        vinculos,
        eventos: eventosRes.data ?? [],
        partidas: partidasRes.data ?? [],
        pagos: pagosRes.data ?? [],
        reviews,
      })
      setEstado({ fase: 'listo', proveedor: proveedor as Supplier, categorias, filas, reviews })
    }
    cargar().catch(() => { if (vivo) setEstado({ fase: 'error' }) })
    return () => { vivo = false }
  }, [id])

  const partes = useMemo(
    () => estado.fase === 'listo' ? partirActivosHistorial(estado.filas, hoy) : { activos: [], historial: [] },
    [estado, hoy],
  )

  // Se abre en Activos; si no hay ninguno, en Historial. Solo la primera vez.
  useEffect(() => {
    if (estado.fase !== 'listo' || carpeta) return
    setCarpeta(partes.activos.length > 0 || partes.historial.length === 0 ? 'activos' : 'historial')
  }, [estado.fase, carpeta, partes])

  if (estado.fase === 'cargando') {
    return <div className="flex h-[50dvh]"><Cargando /></div>
  }

  if (estado.fase === 'no-encontrado' || estado.fase === 'error') {
    return (
      <div className="rounded-2xl border border-[#e8e8e8] bg-white px-6 py-10 text-center">
        <p className="text-sm font-medium text-[#666]">
          {estado.fase === 'error' ? 'No se pudo cargar el expediente.' : 'No encontramos este proveedor en tu Rolodex.'}
        </p>
        <a href="/dashboard" className="mt-3 inline-block text-xs font-semibold text-[#1a9e88] hover:underline">Ir al dashboard</a>
      </div>
    )
  }

  const { proveedor: s, categorias, filas, reviews } = estado
  const categoria = nombrePorId(categorias, s.category_id)
  const moneda: Currency = filas[0]?.moneda ?? 'MXN'
  const enlace = Object.fromEntries(contactosDe(s).map(c => [c.tipo, c.href])) as Partial<Record<ContactoTipo, string>>
  const telCrudo = telefonoCrudoDe(s)
  const telVisible = telCrudo ? formatDisplay(telCrudo) : null
  const ubicacion = [s.city, s.state_region].filter(Boolean).join(', ')
  const cierre = ultimoCierre(filas)
  const tasa = tasaDeCierre(filas)
  const ahorro = ahorroNegociado(filas)
  const rango = rangoContratado(filas)
  const calif = calificaciones(reviews)
  const abrir = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
  const abrirFicha = (f: FilaExpediente) => router.push(`/events/${f.eventoId}/proveedores?proveedor=${f.vinculoId}`)
  const filasCarpeta = carpeta === 'historial' ? partes.historial : partes.activos
  const carpetaActual: Carpeta = carpeta ?? 'activos'

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white">

      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#f0e4c8] bg-[#fffbf0] text-[15px] font-extrabold text-[#b8912f] sm:h-14 sm:w-14 sm:text-[17px]">
            {iniciales(s.name)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-extrabold leading-tight tracking-tight text-[#1D1E20] sm:text-xl">{s.name}</h1>
              {categoria && (
                <span className="rounded-full border border-[#e8e8e8] bg-[#f2f2f2] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#666]">
                  {categoria}
                </span>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-[#999]">
              {ubicacion && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-[#c4c4c4]" />
                  {ubicacion}{s.service_radius_km ? ` · cubre ${s.service_radius_km} km` : ''}
                </span>
              )}
              {ubicacion && cierre && <span>·</span>}
              {cierre && (
                <span className="inline-flex items-center gap-1">
                  <CalendarCheck size={12} className="text-[#c4c4c4]" />
                  Último cierre: <b className="font-semibold text-[#1D1E20]">{cierre.nombre}</b>{cierre.fecha ? ` (${mesYAno(cierre.fecha)})` : ''}
                </span>
              )}
            </p>
            {(s.contact_name || telVisible || s.email) && (
              <p className="text-[12.5px] text-[#666]">
                {[s.contact_name && <b key="n" className="font-semibold text-[#1D1E20]">{s.contact_name}</b>, telVisible && <span key="t" className="tabular-nums">{telVisible}</span>, s.email]
                  .filter(Boolean)
                  .map((parte, i) => <span key={i}>{i > 0 && <span className="text-[#c4c4c4]"> · </span>}{parte}</span>)}
              </p>
            )}
          </div>
        </div>

        {(enlace.whatsapp || enlace.correo || enlace.instagram || enlace.facebook || enlace.sitio) && (
          <div className="flex shrink-0 items-center gap-2 pl-16 sm:pl-0">
            {enlace.whatsapp && (
              <button onClick={() => abrir(enlace.whatsapp!)}
                className="flex items-center gap-1.5 rounded-[10px] bg-[#48C9B0] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#3aa896]">
                <FaWhatsapp size={14} /> WhatsApp
              </button>
            )}
            {(enlace.correo || enlace.instagram || enlace.facebook || enlace.sitio) && (
              <span className="flex gap-0.5 rounded-[10px] border border-[#e8e8e8] bg-white p-[3px]">
                {enlace.correo && <BotonIcono etiqueta="Enviar correo" onClick={() => abrir(enlace.correo!)}><Mail size={14} /></BotonIcono>}
                {enlace.instagram && <BotonIcono etiqueta="Abrir Instagram" onClick={() => abrir(enlace.instagram!)}><FiInstagram size={14} /></BotonIcono>}
                {enlace.facebook && <BotonIcono etiqueta="Abrir Facebook" onClick={() => abrir(enlace.facebook!)}><FiFacebook size={14} /></BotonIcono>}
                {enlace.sitio && <BotonIcono etiqueta="Abrir sitio web" onClick={() => abrir(enlace.sitio!)}><Globe size={14} /></BotonIcono>}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-[#e8e8e8] bg-[#e8e8e8] lg:grid-cols-5">
        <Kpi etiqueta="Tasa de cierre" pie={tasa.porcentaje != null ? 'cotizaciones que se convirtieron en contrato' : 'todavía no le has pedido cotización'}>
          {tasa.porcentaje != null
            ? <><span className="tabular-nums">{tasa.porcentaje}%</span><small className="text-xs font-semibold text-[#999]">{tasa.contratados} de {tasa.cotizados}</small></>
            : <SinDato texto="Sin datos" />}
        </Kpi>
        <Kpi etiqueta="Ahorro negociado" pie={ahorro.n === 0 ? 'falta un evento con cotizado y contratado' : ahorro.n === 1 ? 'de una sola vez' : 'promedio del cotizado al contratado'}>
          {ahorro.promedio != null
            ? <span className={`tabular-nums ${ahorro.promedio <= 0 ? 'text-[#1D9E75]' : 'text-[#A63B27]'}`}>{ahorro.promedio > 0 ? '+' : ''}{ahorro.promedio}%</span>
            : <SinDato texto="Sin datos" />}
        </Kpi>
        <Kpi etiqueta="Calificación del planner" pie={calif.eventosCalificados > 0 ? `${calif.eventosCalificados} ${calif.eventosCalificados === 1 ? 'evento calificado' : 'eventos calificados'}` : 'ningún evento calificado'}>
          <Estrellas score={calif.planner} tamano={13} />
        </Kpi>
        <Kpi etiqueta="Satisfacción del cliente" pie={calif.opiniones > 0 ? `${calif.opiniones} ${calif.opiniones === 1 ? 'opinión directa' : 'opiniones directas'}` : 'sin opiniones todavía'}>
          {calif.cliente != null ? <Estrellas score={calif.cliente} tamano={13} /> : <SinDato texto="Sin opinión" />}
        </Kpi>
        <Kpi etiqueta="Rango de inversión" pie={rango ? (rango.min === rango.max ? '1 contrato' : 'contratos habituales') : 'ningún contrato todavía'} chico>
          {rango
            ? <span className="tabular-nums">{rango.min === rango.max ? formatCurrency(rango.min, moneda) : `${formatCurrency(rango.min, moneda)} – ${formatCurrency(rango.max, moneda)}`}</span>
            : <SinDato texto="Sin datos" />}
        </Kpi>
      </div>

      <div className="flex gap-[3px] border-t border-[#e8e8e8] bg-[#f8f8f8] px-4 pt-3">
        {(['activos', 'historial'] as const).map(nombre => {
          const n = nombre === 'activos' ? partes.activos.length : partes.historial.length
          const activa = carpetaActual === nombre
          return (
            <button
              key={nombre}
              type="button"
              onClick={() => setCarpeta(nombre)}
              className={`relative top-px flex items-center gap-1.5 rounded-t-[10px] border border-b-0 border-[#e4e1db] px-3.5 pb-2 pt-2 text-xs font-semibold transition ${
                activa ? 'bg-white pb-2.5 text-[#1D1E20]' : 'bg-[#efede8] text-[#8a8a8a] hover:text-[#5F5C57]'
              }`}
            >
              {nombre === 'activos' ? 'Activos' : 'Historial'}
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${activa ? 'bg-[#f4f4f4] text-[#666]' : 'bg-white/70 text-[#777]'}`}>{n}</span>
            </button>
          )
        })}
      </div>

      <div className="border-t border-[#e4e1db] bg-white">
        <div className="hidden lg:block">
          <TablaExpediente filas={filasCarpeta} carpeta={carpetaActual} hoy={hoy} moneda={moneda} onAbrir={abrirFicha} />
        </div>
        <div className="lg:hidden">
          <FilasExpediente filas={filasCarpeta} carpeta={carpetaActual} hoy={hoy} moneda={moneda} onAbrir={abrirFicha} />
        </div>
      </div>
    </div>
  )
}

function Kpi({ etiqueta, pie, chico, children }: { etiqueta: string; pie: string; chico?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 bg-white px-4 py-3.5">
      <span className="text-[10px] font-bold uppercase tracking-[.09em] text-[#999]">{etiqueta}</span>
      <span className={`flex items-baseline gap-1.5 font-extrabold leading-tight tracking-tight text-[#1D1E20] ${chico ? 'text-[15px] sm:text-base' : 'text-xl'}`}>{children}</span>
      <span className="text-[11px] text-[#999]">{pie}</span>
    </div>
  )
}

function SinDato({ texto }: { texto: string }) {
  return <span className="text-sm font-semibold text-[#c4c4c4]">{texto}</span>
}

function BotonIcono({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={etiqueta} title={etiqueta}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#777] transition hover:bg-[#f4f4f4] hover:text-[#1D1E20]">
      {children}
    </button>
  )
}
