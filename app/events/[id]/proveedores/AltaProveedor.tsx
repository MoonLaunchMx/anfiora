'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, Info, Plus, Search } from 'lucide-react'
import { FiFacebook, FiGlobe, FiInstagram, FiMail } from 'react-icons/fi'
import { FaWhatsapp } from 'react-icons/fa'
import { EventBudget, Currency, formatCurrency } from '@/lib/types'
import { Categoria, activas, buscarPorNombre, nombrePorId } from '@/lib/rolodex/categorias-store'
import {
  EntradaDelRolodex, buscar, contactoRepetido, masUsados, nombresParecidos,
} from '@/lib/rolodex/duplicados'
import { detectCountry, dialCode } from '@/lib/phone'
import {
  PAISES, PAIS_POR_DEFECTO, bandera, ciudadesDe, estadosDe, mismoLugar,
  nombrePais, normalizarCiudad, normalizarEstado, tieneEstados,
} from '@/lib/geo/divisiones'
import SelectorGeo, { OpcionGeo } from '@/app/components/ui/SelectorGeo'
import PhoneInput from '@/app/components/ui/PhoneInput'
import { Modal } from '@/app/components/ui/Modal'
import CategoriaPicker from './CategoriaPicker'

export type EnEstaBoda = {
  event_budget_id: string | null
  quoted_amount: number | null
}

export type ProveedorNuevo = EnEstaBoda & {
  name: string
  category_id: string | null
  subcategory: string | null
  contact_name: string | null
  phone: string | null
  phone_country_code: string | null
  email: string | null
  website: string | null
  instagram: string | null
  facebook: string | null
  country: string | null
  city: string | null
  state_region: string | null
  service_radius_km: number | null
  tags: string[]
  general_notes: string | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  currency: Currency
  budgets: EventBudget[]
  categorias: Categoria[]
  duenoCatalogo: string
  catalogo: EntradaDelRolodex[]
  eventoNombre?: string | null
  onUsarExistente: (supplierId: string, enEstaBoda: EnEstaBoda) => Promise<void>
  onCrearNuevo: (data: ProveedorNuevo) => Promise<void>
  onAbrirEnEstaBoda: (supplierId: string) => void
}

type Fase = 'buscar' | 'existente' | 'nuevo'

const INPUT = 'w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-base text-[#1D1E20] outline-none transition focus:border-[#48C9B0]'
const PREFIJO = 'flex items-center rounded-lg border border-[#e0e0e0] bg-white transition focus-within:border-[#48C9B0]'

function Etiqueta({ children, obligatorio }: { children: React.ReactNode; obligatorio?: boolean }) {
  return (
    <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#888]">
      {children}
      {obligatorio && <span className="text-red-400">*</span>}
    </label>
  )
}

function Seccion({
  titulo, nota, children,
}: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[#f1f1f1] pt-4 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-[12.5px] font-bold text-[#1D1E20]">{titulo}</h3>
        {nota && <span className="text-[10px] font-bold uppercase tracking-wider text-[#bbb]">{nota}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Inicial({ nombre }: { nombre: string }) {
  const letras = nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase()
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1efe8] text-[11px] font-extrabold text-[#5F5C57]">
      {letras || '?'}
    </span>
  )
}

function FilaDelRolodex({ entrada, onClick }: { entrada: EntradaDelRolodex; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition hover:border-[#e8e8e8] hover:bg-[#f8f8f8] ${
        entrada.enEstaBoda ? 'opacity-70' : ''
      }`}
    >
      <Inicial nombre={entrada.nombre} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#1D1E20]">{entrada.nombre}</span>
        <span className="block truncate text-[11.5px] text-[#999]">
          {[entrada.categoria, entrada.ciudad].filter(Boolean).join(' · ') || 'Sin categoría'}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        {entrada.enEstaBoda ? (
          <>
            <span className="rounded-md bg-[#FBF3E0] px-1.5 py-0.5 text-[10px] font-bold text-[#A87C1F]">
              Ya está en esta boda
            </span>
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#999]">
              Abrir ficha <ChevronRight size={11} />
            </span>
          </>
        ) : (
          <>
            <span className="text-[11.5px] font-bold text-[#666]">
              {entrada.veces > 0 ? `${entrada.veces}ª vez` : 'Sin usar'}
            </span>
            {entrada.ultima && <span className="text-[10.5px] text-[#bbb]">{entrada.ultima}</span>}
          </>
        )}
      </span>
    </button>
  )
}

export default function AltaProveedor({
  isOpen, onClose, currency, budgets, categorias, duenoCatalogo, catalogo,
  eventoNombre, onUsarExistente, onCrearNuevo, onAbrirEnEstaBoda,
}: Props) {
  const [fase, setFase]         = useState<Fase>('buscar')
  const [consulta, setConsulta] = useState('')
  const [elegida, setElegida]   = useState<EntradaDelRolodex | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState('')

  const [nombre, setNombre]         = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [contacto, setContacto]     = useState('')
  const [telefono, setTelefono]     = useState('')
  const [instagram, setInstagram]   = useState('')
  const [facebook, setFacebook]     = useState('')
  const [correo, setCorreo]         = useState('')
  const [sitio, setSitio]           = useState('')
  const [pais, setPais]             = useState<string>(PAIS_POR_DEFECTO)
  const [ciudad, setCiudad]         = useState('')
  const [estado, setEstado]         = useState('')
  const [radio, setRadio]           = useState('')
  const [etiquetas, setEtiquetas]   = useState<string[]>([])
  const [etiquetaNueva, setEtiquetaNueva] = useState('')
  const [notas, setNotas]           = useState('')

  const [eventBudgetId, setEventBudgetId] = useState('')
  const [cotizacion, setCotizacion]       = useState('')

  // La boda no guarda pais, asi que el default sale del Rolodex: el pais donde
  // ya trabajas. Un planner de Bogota no tiene por que corregir "Mexico" cada
  // vez que da de alta a alguien.
  const paisDominante = useMemo(() => {
    const cuenta = new Map<string, number>()
    catalogo.forEach(e => { if (e.pais) cuenta.set(e.pais, (cuenta.get(e.pais) ?? 0) + 1) })
    let ganador = PAIS_POR_DEFECTO as string
    let max = 0
    cuenta.forEach((n, iso) => { if (n > max) { max = n; ganador = iso } })
    return ganador
  }, [catalogo])

  useEffect(() => {
    if (!isOpen) return
    setFase('buscar'); setConsulta(''); setElegida(null); setEnviando(false); setError('')
    setNombre(''); setCategoryId(''); setContacto(''); setTelefono('')
    setInstagram(''); setFacebook(''); setCorreo(''); setSitio('')
    setPais(paisDominante); setCiudad(''); setEstado('')
    setRadio(''); setEtiquetas([]); setEtiquetaNueva(''); setNotas('')
    setEventBudgetId(''); setCotizacion('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const resultados = useMemo(
    () => (consulta.trim() ? buscar(catalogo, consulta) : masUsados(catalogo)),
    [catalogo, consulta],
  )

  const parecidos = useMemo(
    () => (fase === 'nuevo' ? nombresParecidos(catalogo, nombre) : []),
    [catalogo, nombre, fase],
  )

  const repetido = useMemo(
    () => (fase === 'nuevo' ? contactoRepetido(catalogo, { telefono, correo }) : null),
    [catalogo, telefono, correo, fase],
  )

  const opcionesPais: OpcionGeo[] = useMemo(
    () => PAISES.map(p => ({ valor: p.name, icono: bandera(p.iso) })),
    [],
  )

  const opcionesEstado: OpcionGeo[] = useMemo(
    () => estadosDe(pais).map(e => ({ valor: e })),
    [pais],
  )

  // Las ciudades que ya usas, del pais y estado elegidos, con cuantos
  // proveedores tienes en cada una. Van primero porque el objetivo real no es
  // la ortografia: es que tus fichas coincidan entre si para que el filtro
  // por ciudad del directorio encuentre a todas.
  const ciudadesQueUsas = useMemo(() => {
    const cuenta = new Map<string, number>()
    catalogo.forEach(e => {
      if (!e.ciudad?.trim()) return
      if (e.pais && e.pais !== pais) return
      if (estado && e.estado && !mismoLugar(e.estado, estado)) return
      const nombre = e.ciudad.trim()
      cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1)
    })
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
  }, [catalogo, pais, estado])

  const opcionesCiudad: OpcionGeo[] = useMemo(() => {
    const usadas: OpcionGeo[] = ciudadesQueUsas.map(([nombre, n]) => ({
      valor: nombre,
      grupo: 'Las que ya usas',
      nota:  n === 1 ? '1 proveedor' : `${n} proveedores`,
    }))
    const sugeridas: OpcionGeo[] = ciudadesDe(pais, estado)
      .filter(c => !usadas.some(u => mismoLugar(u.valor, c)))
      .map(c => ({ valor: c, grupo: `De ${estado}` }))
    return [...usadas, ...sugeridas]
  }, [ciudadesQueUsas, pais, estado])

  const categoriaElegida = categorias.find(c => c.id === categoryId) ?? null

  // Los conceptos se filtran por la categoria del proveedor: la que se esta
  // tecleando si es nuevo, la que ya trae su ficha si viene del Rolodex.
  const categoriaActiva = fase === 'nuevo' ? categoriaElegida?.id ?? null : elegida?.categoriaId ?? null
  const conceptos   = categoriaActiva ? budgets.filter(b => b.category_id === categoriaActiva) : []
  const conceptoSel = eventBudgetId ? budgets.find(b => b.id === eventBudgetId) : null

  const montoCotizado = (): number | null => {
    const limpio = cotizacion.trim()
    if (!limpio) return null
    const n = Number(limpio.replace(/[\s,$]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const irACrear = () => {
    const activasIniciales = activas(categorias)
    const porDefecto = buscarPorNombre(activasIniciales, 'Venue') ?? activasIniciales[0] ?? null
    setNombre(consulta.trim())
    setCategoryId(porDefecto?.id ?? '')
    setError('')
    setFase('nuevo')
  }

  const elegir = (entrada: EntradaDelRolodex) => {
    if (entrada.enEstaBoda) { onAbrirEnEstaBoda(entrada.id); return }
    setElegida(entrada)
    setEventBudgetId('')
    setCotizacion('')
    setError('')
    setFase('existente')
  }

  const agregarEtiqueta = () => {
    const limpia = etiquetaNueva.trim()
    if (!limpia) return
    if (!etiquetas.some(t => t.toLowerCase() === limpia.toLowerCase())) {
      setEtiquetas(prev => [...prev, limpia])
    }
    setEtiquetaNueva('')
  }

  const conEnvio = async (accion: () => Promise<void>) => {
    setEnviando(true); setError('')
    try {
      await accion()
      onClose()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo guardar, intenta de nuevo')
    } finally {
      setEnviando(false)
    }
  }

  const usarExistente = (supplierId: string) =>
    conEnvio(() => onUsarExistente(supplierId, {
      event_budget_id: eventBudgetId || null,
      quoted_amount:   montoCotizado(),
    }))

  const crearNuevo = () => {
    if (!nombre.trim())      { setError('Escribe el nombre del proveedor'); return }
    if (!categoriaElegida)   { setError('Elige una categoría'); return }
    if (!telefono.trim() && !instagram.trim() && !facebook.trim() && !correo.trim()) {
      setError('Agrega al menos un contacto: WhatsApp, Instagram, Facebook o correo')
      return
    }

    const cc = detectCountry(telefono)
    const km = radio.trim() ? Number(radio.trim()) : null

    return conEnvio(() => onCrearNuevo({
      name:               nombre.trim(),
      category_id:        categoriaElegida.id,
      subcategory:        conceptoSel?.subcategory || null,
      contact_name:       contacto.trim() || null,
      phone:              telefono.trim() || null,
      phone_country_code: telefono.trim() && cc ? dialCode(cc) || null : null,
      email:              correo.trim() || null,
      website:            sitio.trim() || null,
      instagram:          instagram.trim().replace(/^@/, '') || null,
      facebook:           facebook.trim().replace(/^@/, '') || null,
      country:            pais || null,
      city:               normalizarCiudad(pais, estado, ciudad, ciudadesQueUsas.map(([n]) => n)) || null,
      state_region:       normalizarEstado(pais, estado) || null,
      service_radius_km:  km !== null && Number.isFinite(km) && km > 0 ? km : null,
      tags:               etiquetas,
      general_notes:      notas.trim() || null,
      event_budget_id:    eventBudgetId || null,
      quoted_amount:      montoCotizado(),
    }))
  }

  // Valor JSX, no componente: declararlo como componente aqui adentro le cambia
  // la identidad en cada render y React remonta los inputs, asi que el campo de
  // cotizacion perderia el foco a cada tecla.
  const camposDeLaBoda = (
    <>
      <div>
        <Etiqueta>Concepto del presupuesto</Etiqueta>
        {conceptos.length > 0 ? (
          <select value={eventBudgetId} onChange={e => setEventBudgetId(e.target.value)} className={INPUT}>
            <option value="">Sin concepto</option>
            {conceptos.map(b => (
              <option key={b.id} value={b.id}>
                {b.subcategory || nombrePorId(categorias, b.category_id)}
                {b.budget_amount ? ` — ${formatCurrency(b.budget_amount, currency)}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-lg border border-dashed border-[#e0e0e0] bg-[#fafafa] px-3 py-2.5 text-center">
            <p className="text-xs text-[#aaa]">
              No hay conceptos de {categoriaElegida?.name ?? elegida?.categoria ?? 'esta categoría'} — créalos en Presupuesto
            </p>
          </div>
        )}
        {conceptoSel && (
          <p className="mt-1 text-[10px] text-[#48C9B0]">
            Meta: {formatCurrency(conceptoSel.budget_amount, currency)}
          </p>
        )}
      </div>

      <div>
        <Etiqueta>Cotización</Etiqueta>
        <div className={PREFIJO}>
          <span className="pl-3 text-sm text-[#aaa]">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={cotizacion}
            onChange={e => setCotizacion(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent px-2 py-2 text-base text-[#1D1E20] outline-none"
          />
        </div>
        <p className="mt-1 text-[10px] text-[#bbb]">
          Si ya te la mandó, entra directo como Cotizado.
        </p>
      </div>
    </>
  )

  const aviso = error ? (
    <p className="mb-3 rounded-lg bg-[#fff0f0] px-3 py-2 text-xs font-semibold text-[#cc3333]">{error}</p>
  ) : null

  return (
    <Modal open={isOpen} onClose={onClose} size={fase === 'nuevo' ? 'xl' : 'md'}>

      {fase === 'buscar' && (
        <>
          <Modal.Header title="Agregar proveedor" subtitle="Busca en tu Rolodex. Si no está, lo creas aquí." />
          <Modal.Body>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
              <input
                type="text"
                autoFocus
                value={consulta}
                onChange={e => setConsulta(e.target.value)}
                placeholder="Escribe el nombre… ej. Flores Bonitas"
                aria-label="Buscar proveedor en tu Rolodex"
                className={`${INPUT} py-2.5 pl-9`}
              />
            </div>

            <p className="mb-1.5 mt-4 text-[10.5px] font-bold uppercase tracking-wider text-[#bbb]">
              {consulta.trim() ? 'En tu Rolodex' : 'Los que más usas'}
            </p>

            <div className="flex flex-col gap-0.5">
              {resultados.map(entrada => (
                <FilaDelRolodex key={entrada.id} entrada={entrada} onClick={() => elegir(entrada)} />
              ))}

              {resultados.length === 0 && (
                <p className="py-5 text-center text-[12.5px] text-[#bbb]">
                  {consulta.trim()
                    ? 'Nada en tu Rolodex se llama así. Créalo abajo.'
                    : 'Todavía no tienes proveedores. Escribe un nombre para crear el primero.'}
                </p>
              )}

              {consulta.trim() && (
                <button
                  type="button"
                  onClick={irACrear}
                  className="mt-1.5 flex w-full items-center gap-3 rounded-lg border-t border-dashed border-[#e0e0e0] px-2.5 pb-2 pt-3 text-left transition hover:bg-[#f8f8f8]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E6F3EC] text-[#1D9E75]">
                    <Plus size={15} strokeWidth={2.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#1D9E75]">
                      Crear «{consulta.trim()}»
                    </span>
                    <span className="block text-[11.5px] text-[#999]">Nuevo proveedor en tu Rolodex</span>
                  </span>
                </button>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-lg px-4 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f0f0f0]"
            >
              Cancelar
            </button>
          </Modal.Footer>
        </>
      )}

      {fase === 'existente' && elegida && (
        <>
          <Modal.Header title="Agregar a esta boda" subtitle={eventoNombre ?? undefined} />
          <Modal.Body>
            {aviso}
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#e8e8e8] bg-[#fafafa] px-3 py-3">
              <Inicial nombre={elegida.nombre} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#1D1E20]">{elegida.nombre}</span>
                <span className="block truncate text-[11.5px] text-[#999]">
                  {[elegida.categoria, elegida.ciudad].filter(Boolean).join(' · ')}
                  {elegida.veces > 0 && ` · la has usado ${elegida.veces} ${elegida.veces === 1 ? 'vez' : 'veces'}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setFase('buscar')}
                className="shrink-0 text-[11.5px] font-bold text-[#999] underline underline-offset-2 transition hover:text-[#1D1E20]"
              >
                Cambiar
              </button>
            </div>
            <div className="space-y-3">
              {camposDeLaBoda}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="ml-auto rounded-lg px-4 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f0f0f0] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => usarExistente(elegida.id)}
              disabled={enviando}
              className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
            >
              {enviando ? 'Agregando...' : 'Agregar a esta boda'}
            </button>
          </Modal.Footer>
        </>
      )}

      {fase === 'nuevo' && (
        <>
          <Modal.Header title="Nuevo proveedor" subtitle="Se guarda en tu Rolodex y entra a esta boda" />
          <Modal.Body>
            {aviso}

            {repetido && (
              <div className="mb-4 flex gap-2.5 rounded-xl bg-[#FBF3E0] px-3 py-3 text-[#A87C1F]">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold">
                    Ese {repetido.campo === 'telefono' ? 'WhatsApp' : 'correo'} ya es de un proveedor tuyo
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-snug opacity-90">
                    Es el mismo contacto de {repetido.entrada.nombre}. Crear otra ficha parte su historial en dos.
                  </p>
                  <div className="mt-2 flex items-center gap-2.5 rounded-lg bg-white/60 px-2.5 py-2">
                    <Inicial nombre={repetido.entrada.nombre} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{repetido.entrada.nombre}</span>
                      <span className="block truncate text-[11px] opacity-75">
                        {[repetido.entrada.categoria, repetido.entrada.ciudad].filter(Boolean).join(' · ')}
                        {repetido.entrada.veces > 0 && ` · ${repetido.entrada.veces} bodas`}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!repetido && parecidos.length > 0 && (
              <div className="mb-4 flex gap-2.5 rounded-xl bg-[#f1efe8] px-3 py-3 text-[#5F5C57]">
                <Info size={15} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold">
                    Tienes {parecidos.length === 1 ? 'uno' : `${parecidos.length}`} con nombre parecido
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-snug opacity-90">
                    Si es el mismo, úsalo y conservas su historial. Si son distintos, sigue creando.
                  </p>
                  {parecidos.map(p => (
                    <div key={p.id} className="mt-2 flex items-center gap-2.5 rounded-lg bg-white/60 px-2.5 py-2">
                      <Inicial nombre={p.nombre} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{p.nombre}</span>
                        <span className="block truncate text-[11px] opacity-75">
                          {[p.categoria, p.ciudad].filter(Boolean).join(' · ')}
                          {p.veces > 0 && ` · ${p.veces} bodas`}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => elegir(p)}
                        className="shrink-0 text-[11.5px] font-extrabold underline underline-offset-2"
                      >
                        {p.enEstaBoda ? 'Abrir ficha' : 'Usar esa'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <Seccion titulo="Quién es">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Etiqueta obligatorio>Categoría</Etiqueta>
                    <CategoriaPicker
                      categorias={categorias}
                      valorId={categoryId || null}
                      onChange={c => { setCategoryId(c.id); setEventBudgetId('') }}
                      duenoCatalogo={duenoCatalogo}
                      className="border-[#e0e0e0]"
                    />
                  </div>
                  <div>
                    <Etiqueta>Persona de contacto</Etiqueta>
                    <input type="text" value={contacto} onChange={e => setContacto(e.target.value)}
                      placeholder="Ej. Marisol Cruz" className={INPUT} />
                  </div>
                </div>
                <div>
                  <Etiqueta obligatorio>Nombre</Etiqueta>
                  <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                    placeholder="Ej. Luz y Sonido Zafiro" className={INPUT} />
                </div>
              </Seccion>

              <Seccion titulo="Cómo lo contactas" nota="Al menos uno">
                <div>
                  <Etiqueta><FaWhatsapp size={12} /> WhatsApp</Etiqueta>
                  <PhoneInput value={telefono} onChange={setTelefono} placeholder="55 1234 5678" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Etiqueta><FiInstagram size={12} /> Instagram</Etiqueta>
                    <div className={PREFIJO}>
                      <span className="pl-3 text-sm text-[#aaa]">@</span>
                      <input type="text" value={instagram}
                        onChange={e => setInstagram(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
                        placeholder="proveedor"
                        className="w-full flex-1 bg-transparent px-2 py-2 text-base text-[#1D1E20] outline-none" />
                    </div>
                  </div>
                  <div>
                    <Etiqueta><FiFacebook size={12} /> Facebook</Etiqueta>
                    <div className={PREFIJO}>
                      <span className="pl-3 text-sm text-[#aaa]">fb.com/</span>
                      <input type="text" value={facebook} onChange={e => setFacebook(e.target.value)}
                        placeholder="proveedor"
                        className="w-full flex-1 bg-transparent px-2 py-2 text-base text-[#1D1E20] outline-none" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Etiqueta><FiMail size={12} /> Correo</Etiqueta>
                    <input type="email" value={correo} onChange={e => setCorreo(e.target.value)}
                      placeholder="hola@proveedor.mx" className={INPUT} />
                  </div>
                  <div>
                    <Etiqueta><FiGlobe size={12} /> Sitio web</Etiqueta>
                    <input type="text" value={sitio} onChange={e => setSitio(e.target.value)}
                      placeholder="proveedor.mx" className={INPUT} />
                  </div>
                </div>
              </Seccion>

              <Seccion titulo="Dónde atiende" nota="Opcional">
                <div>
                  <Etiqueta>País</Etiqueta>
                  <SelectorGeo
                    valor={nombrePais(pais)}
                    onChange={n => {
                      const elegido = PAISES.find(p => p.name === n)
                      setPais(elegido?.iso ?? PAIS_POR_DEFECTO)
                      setEstado(''); setCiudad('')
                    }}
                    opciones={opcionesPais}
                    icono={bandera(pais)}
                    placeholder="Elige el país"
                    buscarPlaceholder="Buscar país…"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Etiqueta>Estado</Etiqueta>
                    <SelectorGeo
                      valor={estado}
                      onChange={e => { setEstado(e); setCiudad('') }}
                      opciones={opcionesEstado}
                      libre={!tieneEstados(pais)}
                      placeholder={tieneEstados(pais) ? 'Elige el estado' : 'Escribe el estado'}
                      buscarPlaceholder={tieneEstados(pais) ? 'Buscar…' : 'Escribe el estado'}
                      sinOpcionesTexto={
                        tieneEstados(pais)
                          ? 'Sin coincidencias'
                          : `Todavía no tenemos la lista de ${nombrePais(pais)}, escríbelo`
                      }
                    />
                  </div>
                  <div>
                    <Etiqueta>Ciudad</Etiqueta>
                    <SelectorGeo
                      valor={ciudad}
                      onChange={setCiudad}
                      opciones={opcionesCiudad}
                      libre
                      placeholder="Elige o escribe"
                      buscarPlaceholder="Buscar o escribir…"
                      sinOpcionesTexto="Escribe el nombre de la ciudad"
                    />
                  </div>
                </div>
                <div>
                  <Etiqueta>Viaja hasta</Etiqueta>
                  <div className={PREFIJO}>
                    <input type="text" inputMode="numeric" value={radio}
                      onChange={e => setRadio(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="150"
                      className="w-full flex-1 bg-transparent px-3 py-2 text-base text-[#1D1E20] outline-none" />
                    <span className="pr-3 text-sm text-[#aaa]">km</span>
                  </div>
                </div>
              </Seccion>

              <Seccion titulo="Cómo lo vas a encontrar después" nota="Opcional">
                <div>
                  <Etiqueta>Etiquetas</Etiqueta>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {etiquetas.map(t => (
                      <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-[#f1efe8] px-2.5 py-1 text-[11.5px] font-semibold text-[#5F5C57]">
                        {t}
                        <button type="button" aria-label={`Quitar ${t}`} className="opacity-55 transition hover:opacity-100"
                          onClick={() => setEtiquetas(prev => prev.filter(x => x !== t))}>×</button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={etiquetaNueva}
                      onChange={e => setEtiquetaNueva(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); agregarEtiqueta() }
                      }}
                      onBlur={agregarEtiqueta}
                      placeholder="+ etiqueta"
                      className="min-w-[110px] flex-1 rounded-full border border-dashed border-[#e0e0e0] bg-transparent px-3 py-1 text-[11.5px] text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
                    />
                  </div>
                </div>
                <div>
                  <Etiqueta>Notas generales</Etiqueta>
                  <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                    placeholder="Lo que quieras recordar de él en cualquier boda"
                    className={`${INPUT} resize-none`} />
                </div>
              </Seccion>

              <Seccion titulo="En esta boda" nota="Opcional">
                <div className="grid gap-3 sm:grid-cols-2">
                  {camposDeLaBoda}
                </div>
              </Seccion>
            </div>
          </Modal.Body>

          <Modal.Footer>
            {repetido ? (
              <>
                <button
                  type="button"
                  onClick={crearNuevo}
                  disabled={enviando}
                  className="ml-auto rounded-lg px-4 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f0f0f0] disabled:opacity-50"
                >
                  Crear otra de todos modos
                </button>
                <button
                  type="button"
                  onClick={() => usarExistente(repetido.entrada.id)}
                  disabled={enviando || repetido.entrada.enEstaBoda}
                  className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
                >
                  {repetido.entrada.enEstaBoda ? 'Ya está en esta boda' : `Usar ${repetido.entrada.nombre}`}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setFase('buscar')}
                  disabled={enviando}
                  className="ml-auto rounded-lg px-4 py-2 text-xs font-medium text-[#666] transition hover:bg-[#f0f0f0] disabled:opacity-50"
                >
                  Volver a buscar
                </button>
                <button
                  type="button"
                  onClick={crearNuevo}
                  disabled={enviando}
                  className="rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
                >
                  {enviando ? 'Guardando...' : 'Crear y agregar'}
                </button>
              </>
            )}
          </Modal.Footer>
        </>
      )}
    </Modal>
  )
}
