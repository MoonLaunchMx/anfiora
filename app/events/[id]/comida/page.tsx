'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FeatureGuard from '@/app/components/ui/FeatureGuard'

type MealLevel = 0 | 1 | 2 | 3
type CategoryId = 'carne' | 'verduras' | 'alcohol' | 'noalcohol' | 'frutas'

type Category = {
  id: CategoryId
  emoji: string
  name: string
  sub: string
  levels: string[]
  levelSubs: string[]
  unit: string
  perPersonPerMeal: number[]
  color: string
  resultBg: string
  resultText: string
}

const CATEGORIES: Category[] = [
  {
    id: 'carne', emoji: '🥩', name: 'Carne', sub: 'Arrachera, ribeye, salchichas',
    levels: ['Poquita', 'Normal', 'Mucha', 'Brutal'],
    levelSubs: ['200g/p', '350g/p', '500g/p', '700g/p'],
    unit: 'kg', perPersonPerMeal: [0.2, 0.35, 0.5, 0.7],
    color: '#10B981', resultBg: '#F0FDF4', resultText: '#065F46',
  },
  {
    id: 'verduras', emoji: '🥗', name: 'Verduras y guarnición', sub: 'Ensalada, tortillas, limones',
    levels: ['Poca', 'Normal', 'Bastante', 'Ensalada bar'],
    levelSubs: ['100g/p', '150g/p', '250g/p', '400g/p'],
    unit: 'kg', perPersonPerMeal: [0.1, 0.15, 0.25, 0.4],
    color: '#10B981', resultBg: '#F0FDF4', resultText: '#065F46',
  },
  {
    id: 'alcohol', emoji: '🍹', name: 'Bebidas con alcohol', sub: 'Cerveza, cócteles, vino',
    levels: ['Tranqui', 'Social', 'Fiestero', 'Leyenda'],
    levelSubs: ['2/p', '4/p', '8/p', '15/p'],
    unit: 'pz', perPersonPerMeal: [2, 4, 8, 15],
    color: '#6366F1', resultBg: '#EEF2FF', resultText: '#3730A3',
  },
  {
    id: 'noalcohol', emoji: '💧', name: 'Bebidas sin alcohol', sub: 'Agua, refresco, jugos',
    levels: ['Poco', 'Normal', 'Bastante', 'Full hidratación'],
    levelSubs: ['500ml/p', '1L/p', '1.5L/p', '2L/p'],
    unit: 'L', perPersonPerMeal: [0.5, 1, 1.5, 2],
    color: '#0EA5E9', resultBg: '#F0F9FF', resultText: '#0C4A6E',
  },
  {
    id: 'frutas', emoji: '🍉', name: 'Frutas y postres', sub: 'Fruta de temporada, pastel',
    levels: ['Poca', 'Normal', 'Bastante', 'Frutería completa'],
    levelSubs: ['100g/p', '200g/p', '300g/p', '500g/p'],
    unit: 'kg', perPersonPerMeal: [0.1, 0.2, 0.3, 0.5],
    color: '#F59E0B', resultBg: '#FFFBEB', resultText: '#78350F',
  },
]

const MEALS = [
  { id: 'desayuno', label: 'Desayuno', emoji: '🌅' },
  { id: 'comida',   label: 'Comida',   emoji: '☀️' },
  { id: 'cena',     label: 'Cena',     emoji: '🌙' },
]

function fmt(val: number, unit: string): string {
  if (unit === 'kg' && val < 1) return (val * 1000).toFixed(0) + ' g'
  if (unit === 'L'  && val < 1) return (val * 1000).toFixed(0) + ' ml'
  return val % 1 === 0 ? val.toFixed(0) + ' ' + unit : val.toFixed(1) + ' ' + unit
}

function buildWaText(
  eventName: string, guests: number, days: number,
  activeMeals: string[], activeCategories: CategoryId[],
  levels: Record<CategoryId, MealLevel>, categories: Category[]
): string {
  const lines: string[] = []
  lines.push(`🛒 *Lista de compras — ${eventName}*`)
  lines.push(`👥 ${guests} personas · ${days} día${days > 1 ? 's' : ''} · ${activeMeals.join(', ')}`)
  lines.push('')
  const multiplier = guests * days * activeMeals.length
  for (const cat of categories) {
    if (!activeCategories.includes(cat.id)) continue
    const lvl = levels[cat.id]
    const total = cat.perPersonPerMeal[lvl] * multiplier
    lines.push(`${cat.emoji} *${cat.name}*`)
    if (cat.id === 'carne') {
      lines.push(`  • Arrachera: ${fmt(total * 0.6, 'kg')}`)
      lines.push(`  • Ribeye: ${fmt(total * 0.4, 'kg')}`)
      lines.push(`  • Salchichas: ${Math.ceil(guests / 4)} paq`)
      lines.push(`  • Carbón: ${fmt(total * 1.5, 'kg')}`)
    } else if (cat.id === 'verduras') {
      lines.push(`  • Ensalada/verduras: ${fmt(total * 0.5, cat.unit)}`)
      lines.push(`  • Tortillas: ${fmt(guests * days * activeMeals.length * 0.05, 'kg')}`)
      lines.push(`  • Limones + sal: ${fmt(total * 0.15, cat.unit)}`)
    } else {
      lines.push(`  • Total: ${fmt(total, cat.unit)}`)
    }
    lines.push('')
  }
  return encodeURIComponent(lines.join('\n'))
}

function ComidaPageInner() {
  const { id } = useParams()

  const [eventName, setEventName]           = useState('')
  const [confirmedGuests, setConfirmedGuests] = useState(0)
  const [eventDays, setEventDays]           = useState(1)
  const [loading, setLoading]               = useState(true)
  const [isTrip, setIsTrip]                 = useState(false)
  const [dateRange, setDateRange]           = useState('')

  const [activeCategories, setActiveCategories] = useState<Set<CategoryId>>(new Set(['carne', 'verduras']))
  const [levels, setLevels] = useState<Record<CategoryId, MealLevel>>({
    carne: 1, verduras: 1, alcohol: 1, noalcohol: 1, frutas: 1,
  })
  const [activeMeals, setActiveMeals] = useState<Set<string>>(new Set(['comida']))
  const [activeDay, setActiveDay] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('events').select('name, event_date, event_end_date').eq('id', id).single()

      if (data) {
        setEventName(data.name || '')
        if (data.event_date && data.event_end_date) {
          const [sy, sm, sd] = data.event_date.split('T')[0].split('-').map(Number)
          const [ey, em, ed] = data.event_end_date.split('T')[0].split('-').map(Number)
          const start = new Date(sy, sm - 1, sd)
          const end   = new Date(ey, em - 1, ed)
          const days  = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
          setEventDays(days)
          setIsTrip(days > 1)
          const fmtDate = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
          setDateRange(fmtDate(start) + ' – ' + fmtDate(end))
          if (days > 1) setActiveMeals(new Set(['desayuno', 'comida', 'cena']))
        }
      }

      const [{ data: guests }, { data: members }] = await Promise.all([
        supabase.from('guests').select('id').eq('event_id', id).eq('rsvp_status', 'confirmed'),
        supabase.from('party_members').select('id').eq('event_id', id).eq('rsvp_status', 'confirmed'),
      ])
      setConfirmedGuests((guests?.length || 0) + (members?.length || 0))
      setLoading(false)
    }
    load()
  }, [id])

  const toggleCategory = (catId: CategoryId) => {
    setActiveCategories(prev => {
      const n = new Set(prev); n.has(catId) ? n.delete(catId) : n.add(catId); return n
    })
  }

  const toggleMeal = (mealId: string) => {
    setActiveMeals(prev => {
      if (prev.size === 1 && prev.has(mealId)) return prev
      const n = new Set(prev); n.has(mealId) ? n.delete(mealId) : n.add(mealId); return n
    })
  }

  const setLevel = (catId: CategoryId, lvl: MealLevel) => {
    setLevels(prev => ({ ...prev, [catId]: lvl }))
  }

  const mealsPerDay  = activeMeals.size
  const multiplierTotal = confirmedGuests * eventDays * mealsPerDay
  const multiplierDay   = confirmedGuests * mealsPerDay
  const getMultiplier   = () => activeDay === null ? multiplierTotal : multiplierDay

  const getListItems = (cat: Category) => {
    const m = getMultiplier()
    const total = cat.perPersonPerMeal[levels[cat.id]] * m
    if (cat.id === 'carne') return [
      { name: 'Arrachera (60%)',      qty: fmt(total * 0.6, 'kg') },
      { name: 'Ribeye (40%)',         qty: fmt(total * 0.4, 'kg') },
      { name: 'Salchichas para asar', qty: Math.ceil(confirmedGuests / 4) + ' paq' },
      { name: 'Carbón vegetal',       qty: fmt(total * 1.5, 'kg') },
    ]
    if (cat.id === 'verduras') return [
      { name: 'Ensalada / verduras', qty: fmt(total * 0.5, cat.unit) },
      { name: 'Tortillas',           qty: fmt(confirmedGuests * (activeDay === null ? eventDays : 1) * mealsPerDay * 0.05, 'kg') },
      { name: 'Limones + sal',       qty: fmt(total * 0.15, cat.unit) },
    ]
    if (cat.id === 'alcohol') return [
      { name: 'Cerveza',         qty: fmt(total * 0.75, 'pz') },
      { name: 'Vino / cócteles', qty: fmt(total * 0.25, 'pz') },
    ]
    return [{ name: cat.name, qty: fmt(total, cat.unit) }]
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-[#999]">Cargando...</p>
    </div>
  )

  const activeCatList = CATEGORIES.filter(c => activeCategories.has(c.id))

  // ── Panel de lista (reutilizado en mobile y desktop) ──
  const ShoppingList = () => (
    <div className="flex flex-col gap-3">
      {/* Tabs días — solo viaje */}
      {isTrip && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActiveDay(null)}
            className={'flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ' +
              (activeDay === null ? 'border-[#4338CA] bg-[#4338CA] text-white' : 'border-[#e8e8e8] bg-[#f8f8f8] text-[#888]')}>
            Total del viaje
          </button>
          {Array.from({ length: eventDays }, (_, i) => (
            <button key={i} onClick={() => setActiveDay(i + 1)}
              className={'flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ' +
                (activeDay === i + 1 ? 'border-[#4338CA] bg-[#4338CA] text-white' : 'border-[#e8e8e8] bg-[#f8f8f8] text-[#888]')}>
              Día {i + 1}
            </button>
          ))}
        </div>
      )}

      {activeCatList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e0e0e0] py-10 text-center">
          <p className="text-sm text-[#bbb]">Activa al menos una categoría</p>
        </div>
      ) : (
        <>
          {activeCatList.map(cat => (
            <div key={cat.id} className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
              <div className="flex items-center gap-2 border-b border-[#f8f8f8] bg-[#fafafa] px-4 py-2.5">
                <span className="text-sm">{cat.emoji}</span>
                <span className="text-xs font-semibold text-[#1D1E20]">{cat.name}</span>
              </div>
              <div className="divide-y divide-[#f8f8f8]">
                {getListItems(cat).map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-[#1D1E20]">{item.name}</span>
                    <span className="text-sm font-semibold text-[#1D1E20]">{item.qty}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => {
              const text = buildWaText(
                eventName, confirmedGuests, eventDays,
                MEALS.filter(m => activeMeals.has(m.id)).map(m => m.label),
                Array.from(activeCategories), levels, CATEGORIES
              )
              window.open('https://wa.me/?text=' + text, '_blank')
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-sm font-semibold text-white transition hover:bg-[#1ebe5d] active:scale-[0.98]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Compartir lista por WhatsApp
          </button>
        </>
      )}
    </div>
  )

  // ── Panel de controles ──
  const Controls = () => (
    <div className="flex flex-col gap-4">

      {/* Banner viaje */}
      {isTrip && (
        <div className="flex items-center gap-3 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3">
          <span className="text-lg">✈️</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#3730A3]">{eventName}</p>
            <p className="text-xs text-[#6366F1]">{dateRange}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold leading-none text-[#4338CA]">{eventDays}</p>
            <p className="text-[11px] text-[#6366F1]">días</p>
          </div>
        </div>
      )}

      {/* Comidas del día */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">
          {isTrip ? 'Comidas por día' : 'Comidas del evento'}
        </p>
        <div className="flex gap-2">
          {MEALS.map(meal => {
            const on = activeMeals.has(meal.id)
            return (
              <button key={meal.id} onClick={() => toggleMeal(meal.id)}
                className={'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition ' +
                  (on ? 'border-[#48C9B0] bg-[#f0fdfb] text-[#065F46]' : 'border-[#e8e8e8] bg-[#f8f8f8] text-[#bbb]')}>
                <span>{meal.emoji}</span>
                <span>{meal.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Categorías */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">¿Qué van a querer?</p>
        <div className="flex flex-col gap-3">
          {CATEGORIES.map(cat => {
            const isActive = activeCategories.has(cat.id)
            const lvl = levels[cat.id]
            const total = cat.perPersonPerMeal[lvl] * multiplierTotal
            const pct = (lvl / 3) * 100

            return (
              <div key={cat.id}
                className={'rounded-xl border transition ' + (isActive ? 'border-[#48C9B0] bg-white' : 'border-[#e8e8e8] bg-white')}>
                <div className="flex cursor-pointer items-center gap-3 px-4 py-3"
                  onClick={() => toggleCategory(cat.id)}>
                  <span className="text-base">{cat.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1D1E20]">{cat.name}</p>
                    <p className="text-[11px] text-[#aaa]">{cat.sub}</p>
                  </div>
                  <div className={'relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ' + (isActive ? 'bg-[#48C9B0]' : 'bg-[#e0e0e0]')}>
                    <div className={'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ' + (isActive ? 'left-[18px]' : 'left-0.5')} />
                  </div>
                </div>

                {isActive && (
                  <div className="border-t border-[#f0f0f0] px-4 pb-4 pt-3">
                    <div className="mb-2 flex justify-between">
                      {cat.levels.map((label, i) => (
                        <button key={i} onClick={() => setLevel(cat.id, i as MealLevel)}
                          className={'flex-1 text-center text-[10px] transition ' + (lvl === i ? 'font-semibold text-[#1D1E20]' : 'text-[#bbb]')}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="relative mb-2 h-2 cursor-pointer rounded-full bg-[#f0f0f0]"
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const pct  = (e.clientX - rect.left) / rect.width
                        setLevel(cat.id, Math.min(3, Math.max(0, Math.round(pct * 3))) as MealLevel)
                      }}>
                      <div className="absolute left-0 top-0 h-full rounded-full transition-all"
                        style={{ width: pct + '%', background: cat.color }} />
                      <div className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 bg-white shadow transition-all"
                        style={{ left: `calc(${pct}% - 10px)`, borderColor: cat.color }} />
                    </div>
                    <div className="mb-3 flex justify-between">
                      {cat.levelSubs.map((sub, i) => (
                        <span key={i} className={'flex-1 text-center text-[10px] ' + (lvl === i ? 'font-semibold text-[#555]' : 'text-[#ddd]')}>
                          {sub}
                        </span>
                      ))}
                    </div>
                    <div className="rounded-lg px-3 py-2 text-center text-xs font-semibold"
                      style={{ background: cat.resultBg, color: cat.resultText }}>
                      {cat.perPersonPerMeal[lvl]}{cat.unit === 'pz' ? '' : cat.unit === 'L' ? 'L' : 'g'} por persona
                      {' · '}
                      {fmt(total, cat.unit)} total
                      {isTrip && ` (${eventDays}d × ${mealsPerDay}c)`}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">

      {/* ── HEADER ── */}
      <div className="shrink-0 border-b border-[#e8e8e8] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#1D1E20] sm:text-xl">🍽️ Comida</h1>
            <p className="mt-0.5 text-xs text-[#888]">Calcula cuánto comprar para tu evento</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#e8e8e8] bg-[#f8f8f8] px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-[#10B981]" />
            <span className="text-sm font-semibold text-[#1D1E20]">{confirmedGuests}</span>
            <span className="text-xs text-[#888]">confirmados</span>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── MOBILE: scroll vertical ── */}
        <div className="flex flex-1 flex-col overflow-y-auto lg:hidden">
          <div className="px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-lg">
              <Controls />
              {activeCatList.length > 0 && (
                <>
                  <div className="my-5 h-px bg-[#e8e8e8]" />
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">Lista de compras</p>
                    <p className="text-xs text-[#bbb]">{confirmedGuests} personas · {eventDays} día{eventDays > 1 ? 's' : ''}</p>
                  </div>
                  <ShoppingList />
                </>
              )}
              <div className="h-8" />
            </div>
          </div>
        </div>

        {/* ── DESKTOP: split view ── */}
        <div className="hidden min-h-0 flex-1 lg:flex">

          {/* Izquierda — controles */}
          <div className="w-[480px] shrink-0 overflow-y-auto border-r border-[#e8e8e8] bg-[#fafafa] px-8 py-6">
            <Controls />
            <div className="h-8" />
          </div>

          {/* Derecha — lista en tiempo real */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
            <div className="shrink-0 border-b border-[#e8e8e8] px-6 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#1D1E20]">Lista de compras</p>
                <p className="text-xs text-[#bbb]">{confirmedGuests} personas · {eventDays} día{eventDays > 1 ? 's' : ''} · {mealsPerDay} comida{mealsPerDay > 1 ? 's' : ''}/día</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <ShoppingList />
              <div className="h-8" />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
export default function ComidaPage() {
  return (
    <FeatureGuard feature="comida">
      <ComidaPageInner />
    </FeatureGuard>
  )
}
