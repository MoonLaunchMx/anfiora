# Superadmin Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/admin` en un superadmin tipo consola SaaS con 4 secciones (Resumen, Usuarios, Pagos, Actividad), KPIs de negocio + listas accionables, último login real, y una pestaña de Pagos derivada del plan lista para conectar Stripe — sin tocar Supabase.

**Architecture:** Capa de lógica pura desacoplada de la UI: `lib/billing.ts` (abstracción de cobros, hoy deriva del plan, mañana lee de Stripe) y `app/admin/lib/metrics.ts` (cálculos de KPIs y segmentos). La API `users/route.ts` añade `last_sign_in_at` y estado banned reales vía `auth.admin.listUsers()`. El `page.tsx` se refactoriza en un shell + 4 componentes de tab + un componente `Sparkline` reutilizable. Todo el panel es solo lectura sobre tablas existentes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase JS (service role en API route), Lucide React, SVG inline para mini-gráficas (sin librería de charts).

---

## Restricciones (recordatorio para quien implementa)

- **CERO cambios en Supabase**: ni schema, ni datos, ni RLS. Solo lectura. Hay usuarios en producción.
- **No modificar `lib/types.ts`** (regla CLAUDE.md). `PLAN_PRICES` vive en `lib/billing.ts`.
- **No hay tests** en el proyecto. Verificación = `npm run lint` + `npm run build` + revisión manual en el navegador.
- Full file replacement, español en UI, Tailwind, CTA teal `#48C9B0`, dropdowns de filtro en negro `#1D1E20`, iconos Lucide.
- Commits convencionales sin acentos/ñ.
- Referencia visual: los mockups aprobados en `.superpowers/brainstorm/2013-1780018298/content/resumen-layout-v3.html` y `pagos-layout.html`.

## File Structure

```
lib/
└── billing.ts                  → NUEVO. PLAN_PRICES + tipos + getBillingRows + getBillingSummary
app/admin/
├── page.tsx                    → MODIFICAR. Shell: auth, carga de datos, switch de 4 tabs
├── lib/
│   ├── types.ts                → NUEVO. AdminUser, GlobalStats, AuditEntry, EventOption (extraidos de page.tsx)
│   └── metrics.ts              → NUEVO. Calculos de Resumen: summary, powerUsers, atRisk, newSignups, helpers de fecha
├── Sparkline.tsx               → NUEVO. Mini-graficas SVG (line | bar)
├── ResumenTab.tsx              → NUEVO. Pantalla de inicio (tiles + listas accionables)
├── PagosTab.tsx                → NUEVO. Ingresos derivados del plan + tabla por cliente
├── UsuariosTab.tsx             → NUEVO. Tabla/cards de usuarios (extraido de page.tsx) + Ultimo login + estado real
└── ActividadTab.tsx            → NUEVO. Audit log (extraido de page.tsx, sin cambios funcionales)
app/api/admin/
└── users/route.ts              → MODIFICAR. Anadir listUsers() paginado -> last_sign_in_at + banned
```

Cada tab es un componente enfocado que recibe sus datos por props desde el shell. Las funciones de cálculo viven fuera de los componentes para mantenerlos legibles.

---

## Task 1: Capa de billing (`lib/billing.ts`)

**Files:**
- Create: `lib/billing.ts`

- [ ] **Step 1: Crear `lib/billing.ts` con tipos, precios y derivación**

```ts
// lib/billing.ts
// Capa de abstraccion de cobros. HOY: deriva del plan + created_at.
// MANANA (Stripe): reescribir SOLO el cuerpo de getBillingRows leyendo de Stripe.
// La UI consume BillingRow / BillingSummary y no se entera del origen.

export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 1990,
  agency: 3990,
}

export type BillingStatus = 'active' | 'past_due' | 'canceled'

export interface BillingUserInput {
  id: string
  email: string
  full_name: string | null
  plan: string
  created_at: string
}

export interface BillingRow {
  userId: string
  email: string
  fullName: string | null
  plan: string
  amountMonthly: number
  status: BillingStatus
  registeredAt: string
  startedAt: string | null
  currentPeriodEnd: string | null
  mrrContributed: number
}

export interface BillingSummary {
  mrr: number
  arr: number
  payingCustomers: number
  avgTicket: number
  byPlan: { pro: number; agency: number; free: number }
}

export function isPaidPlan(plan: string): boolean {
  return (PLAN_PRICES[plan] ?? 0) > 0
}

export function getBillingRows(users: BillingUserInput[]): BillingRow[] {
  return users
    .filter(u => isPaidPlan(u.plan))
    .map(u => {
      const amountMonthly = PLAN_PRICES[u.plan] ?? 0
      return {
        userId:           u.id,
        email:            u.email,
        fullName:         u.full_name,
        plan:             u.plan,
        amountMonthly,
        status:           'active' as BillingStatus,
        registeredAt:     u.created_at,
        startedAt:        null,
        currentPeriodEnd: null,
        mrrContributed:   amountMonthly,
      }
    })
}

export function getBillingSummary(rows: BillingRow[]): BillingSummary {
  const mrr = rows.reduce((sum, r) => sum + r.mrrContributed, 0)
  const payingCustomers = rows.length
  return {
    mrr,
    arr: mrr * 12,
    payingCustomers,
    avgTicket: payingCustomers ? Math.round(mrr / payingCustomers) : 0,
    byPlan: {
      pro:    rows.filter(r => r.plan === 'pro').length,
      agency: rows.filter(r => r.plan === 'agency').length,
      free:   0,
    },
  }
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npm run lint`
Expected: sin errores nuevos en `lib/billing.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/billing.ts
git commit -m "feat(admin): capa de billing derivada del plan, lista para stripe"
```

---

## Task 2: API — último login y estado banned reales

**Files:**
- Modify: `app/api/admin/users/route.ts`

Contexto: hoy la API trae `users, events, guests, partyMembers`. `auth.admin.listUsers()` da `last_sign_in_at` y `banned_until` por usuario. Pagina de a 50; iterar con `perPage: 1000` y recorrer páginas hasta agotar.

- [ ] **Step 1: Reemplazar el archivo completo**

```ts
// app/api/admin/users/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_EMAIL = 'diego.garza@moonlaunch.mx'

export async function GET(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Traer datos de las tablas (solo lectura)
  const [usersRes, eventsRes, guestsRes, partyRes] = await Promise.all([
    supabaseAdmin.from('users').select('id, email, full_name, plan, created_at').order('created_at', { ascending: false }),
    supabaseAdmin.from('events').select('id, user_id, name, created_at'),
    supabaseAdmin.from('guests').select('id, event_id, rsvp_status'),
    supabaseAdmin.from('party_members').select('id, event_id'),
  ])

  // Traer datos de auth (last_sign_in_at, banned_until) paginando
  const authByUserId: Record<string, { last_sign_in_at: string | null; banned: boolean }> = {}
  let page = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const au of data.users) {
      const bannedUntil = (au as { banned_until?: string | null }).banned_until ?? null
      authByUserId[au.id] = {
        last_sign_in_at: au.last_sign_in_at ?? null,
        banned: !!bannedUntil && new Date(bannedUntil).getTime() > Date.now(),
      }
    }
    if (data.users.length < 1000) break
    page++
  }

  const users = (usersRes.data || []).map(u => ({
    ...u,
    last_sign_in: authByUserId[u.id]?.last_sign_in_at ?? null,
    banned:       authByUserId[u.id]?.banned ?? false,
  }))

  return NextResponse.json({
    users,
    events:       eventsRes.data || [],
    guests:       guestsRes.data || [],
    partyMembers: partyRes.data  || [],
  })
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Verificación manual**

Levantar `npm run dev`, entrar a `/admin` con la cuenta admin, abrir DevTools → Network → respuesta de `/api/admin/users`. Confirmar que cada usuario trae `last_sign_in` (fecha ISO o null) y `banned` (bool).

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/users/route.ts
git commit -m "feat(admin): traer ultimo login y estado banned reales desde auth"
```

---

## Task 3: Tipos compartidos del admin (`app/admin/lib/types.ts`)

**Files:**
- Create: `app/admin/lib/types.ts`

Extraer las interfaces que hoy viven inline en `page.tsx` para que los tabs las compartan. `AdminUser` gana `last_sign_in` y `banned` como datos reales.

- [ ] **Step 1: Crear el archivo**

```ts
// app/admin/lib/types.ts
export interface AdminEvent {
  id: string
  name: string
  created_at: string
  guest_count: number
  party_count: number
  total_count: number
}

export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  plan: string
  created_at: string
  event_count: number
  guest_count: number
  party_count: number
  total_count: number
  last_sign_in: string | null
  events: AdminEvent[]
  banned: boolean
}

export interface GlobalStats {
  total_users: number
  free_users: number
  pro_users: number
  agency_users: number
  total_events: number
  total_guests: number
  confirmed: number
  pending: number
  declined: number
  new_users_7d: number
  new_events_7d: number
}

export interface AuditEntry {
  id: string
  event_id: string
  user_id: string | null
  user_email: string
  user_name: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

export interface EventOption {
  id: string
  name: string
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/admin/lib/types.ts
git commit -m "refactor(admin): extraer tipos compartidos del panel"
```

---

## Task 4: Cálculos de Resumen (`app/admin/lib/metrics.ts`)

**Files:**
- Create: `app/admin/lib/metrics.ts`

Lógica pura para los KPIs y segmentos del Resumen. No depende de React. Recibe `AdminUser[]` ya enriquecidos.

- [ ] **Step 1: Crear el archivo**

```ts
// app/admin/lib/metrics.ts
import { AdminUser } from './types'
import { PLAN_PRICES, isPaidPlan } from '@/lib/billing'

const DAY = 86400000

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
}

export interface ResumenMetrics {
  mrr: number
  arr: number
  payingCustomers: number
  newPayingThisMonth: number
  mrrTrendPct: number | null      // tendencia de altas de pago: este mes vs anterior
  churnDowngrades: number          // no calculable sin historico -> 0 con label "con Stripe"
  conversionPct: number
  newUsers7d: number
  newUsers7dPrev: number
  newEvents7d: number
  active7d: number
  active30d: number
  ghostAccounts: number            // pagados o no: registrados sin evento
  byPlan: { free: number; pro: number; agency: number }
  lastActivity: AdminUser | null   // usuario con login mas reciente
}

export function computeResumen(users: AdminUser[]): ResumenMetrics {
  const now = Date.now()
  const monthStart     = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const prevMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime()

  const paying = users.filter(u => isPaidPlan(u.plan))
  const mrr = paying.reduce((s, u) => s + (PLAN_PRICES[u.plan] ?? 0), 0)

  const newPayingThisMonth = paying.filter(u => new Date(u.created_at).getTime() >= monthStart).length
  const newPayingPrevMonth = paying.filter(u => {
    const t = new Date(u.created_at).getTime()
    return t >= prevMonthStart && t < monthStart
  }).length
  const mrrTrendPct = newPayingPrevMonth > 0
    ? Math.round(((newPayingThisMonth - newPayingPrevMonth) / newPayingPrevMonth) * 100)
    : null

  const within = (iso: string | null, days: number) => {
    const d = daysSince(iso)
    return d !== null && d <= days
  }

  return {
    mrr,
    arr: mrr * 12,
    payingCustomers: paying.length,
    newPayingThisMonth,
    mrrTrendPct,
    churnDowngrades: 0,
    conversionPct: users.length ? Math.round((paying.length / users.length) * 1000) / 10 : 0,
    newUsers7d: users.filter(u => now - new Date(u.created_at).getTime() <= 7 * DAY).length,
    newUsers7dPrev: users.filter(u => {
      const age = now - new Date(u.created_at).getTime()
      return age > 7 * DAY && age <= 14 * DAY
    }).length,
    newEvents7d: users.reduce((s, u) =>
      s + u.events.filter(e => now - new Date(e.created_at).getTime() <= 7 * DAY).length, 0),
    active7d:  users.filter(u => within(u.last_sign_in, 7)).length,
    active30d: users.filter(u => within(u.last_sign_in, 30)).length,
    ghostAccounts: users.filter(u => u.event_count === 0).length,
    byPlan: {
      free:   users.filter(u => (u.plan || 'free') === 'free').length,
      pro:    users.filter(u => u.plan === 'pro').length,
      agency: users.filter(u => u.plan === 'agency').length,
    },
    lastActivity: [...users]
      .filter(u => u.last_sign_in)
      .sort((a, b) => new Date(b.last_sign_in!).getTime() - new Date(a.last_sign_in!).getTime())[0] || null,
  }
}

export function powerUsers(users: AdminUser[], limit = 5): AdminUser[] {
  return [...users].sort((a, b) => b.total_count - a.total_count).slice(0, limit)
}

export function atRiskUsers(users: AdminUser[], limit = 5): AdminUser[] {
  return users
    .filter(u => isPaidPlan(u.plan))
    .filter(u => {
      const d = daysSince(u.last_sign_in)
      return d === null || d > 30
    })
    .sort((a, b) => (daysSince(b.last_sign_in) ?? 9999) - (daysSince(a.last_sign_in) ?? 9999))
    .slice(0, limit)
}

export function newSignups(users: AdminUser[], limit = 5): AdminUser[] {
  return [...users]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}

export { daysSince }
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores. Nota: `churnDowngrades` siempre 0 hoy — la UI lo etiqueta "con Stripe".

- [ ] **Step 3: Commit**

```bash
git add app/admin/lib/metrics.ts
git commit -m "feat(admin): calculos de KPIs y segmentos del resumen"
```

---

## Task 5: Componente `Sparkline`

**Files:**
- Create: `app/admin/Sparkline.tsx`

Mini-gráfica SVG reutilizable. Dos modos: `line` y `bar`. Sin dependencias.

- [ ] **Step 1: Crear el componente**

```tsx
// app/admin/Sparkline.tsx
'use client'

interface SparklineProps {
  data: number[]
  type?: 'line' | 'bar'
  className?: string
}

export default function Sparkline({ data, type = 'line', className = '' }: SparklineProps) {
  if (!data.length) return null
  const W = 80, H = 20, max = Math.max(...data, 1)

  if (type === 'bar') {
    const gap = 3
    const bw = (W - gap * (data.length - 1)) / data.length
    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className}>
        {data.map((v, i) => {
          const h = Math.max(2, (v / max) * H)
          const last = i === data.length - 1
          return <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx="1"
            fill={last ? '#48C9B0' : '#cfeee7'} />
        })}
      </svg>
    )
  }

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (v / max) * (H - 2) - 1
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className}>
      <polyline points={pts} fill="none" stroke="#48C9B0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/admin/Sparkline.tsx
git commit -m "feat(admin): componente sparkline svg reutilizable"
```

---

## Task 6: `UsuariosTab` (extraer + Último login + estado real)

**Files:**
- Create: `app/admin/UsuariosTab.tsx`

Extraer la sección Usuarios actual de `page.tsx` (stats cards + filtros + tabla desktop + cards mobile + acciones). Cambios respecto al actual:
- Nueva columna **Último login** (usa `timeAgo(u.last_sign_in)` o `—`).
- `u.banned` ya viene real desde la API (no hardcode).
- Nueva opción de orden: `last_sign_in`.

Recibe por props desde el shell: `users`, `stats`, y callbacks `onChangePlan`, `onAdminAction(userId, action)`, `onConfirmDelete(user)`. Mantiene su estado local de `search/planFilter/sortBy/expandedId`.

- [ ] **Step 1: Crear el componente**

Definir la firma e implementar. Reusar el markup exacto del bloque "TAB USUARIOS" actual de `app/admin/page.tsx` (líneas ~393-656), con estos ajustes:
- Importar `AdminUser, GlobalStats` de `./lib/types`, helpers `formatDate, timeAgo, PLAN_STYLES` (mover esos helpers a este archivo o a `./lib/types`; si se comparten con otros tabs, ponerlos en `./lib/format.ts`).
- En el `<thead>` desktop, añadir `<th>` "Último login" entre "Registro" y "Cambiar plan".
- En cada fila desktop, añadir `<td className="px-4 py-3 text-xs text-[#888]">{u.last_sign_in ? timeAgo(u.last_sign_in) : '—'}</td>`.
- En cards mobile, añadir al bloque de metadatos: `<span>{'Ultimo login: ' + (u.last_sign_in ? timeAgo(u.last_sign_in) : '—')}</span>`.
- En el `<select>` de orden, añadir `<option value="last_sign_in">Ultimo login</option>` y en el sort: `if (sortBy === 'last_sign_in') return new Date(b.last_sign_in||0).getTime() - new Date(a.last_sign_in||0).getTime()`.

Firma:

```tsx
// app/admin/UsuariosTab.tsx
'use client'
import { useState } from 'react'
import { AdminUser, GlobalStats } from './lib/types'

interface Props {
  users: AdminUser[]
  stats: GlobalStats | null
  actionLoading: string | null
  onChangePlan: (userId: string, plan: string) => void
  onAdminAction: (userId: string, action: 'delete' | 'ban' | 'unban') => void
  onConfirmDelete: (u: AdminUser) => void
}

export default function UsuariosTab({ users, stats, actionLoading, onChangePlan, onAdminAction, onConfirmDelete }: Props) {
  // estado local search/planFilter/sortBy/expandedId + JSX extraido (stats grid, toolbar, tabla, cards)
  // ... (reproduce el markup actual con los 3 ajustes de "Ultimo login" descritos arriba)
}
```

- [ ] **Step 2: Crear helpers compartidos `app/admin/lib/format.ts`**

```ts
// app/admin/lib/format.ts
export function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return 'hace ' + mins + ' min'
  if (hours < 24) return 'hace ' + hours + 'h'
  if (days < 7) return 'hace ' + days + 'd'
  return formatDate(iso)
}

export const PLAN_STYLES: Record<string, string> = {
  free:   'bg-[#f0f0f0] text-[#666]',
  pro:    'bg-[#e8faf6] text-[#1a7a60]',
  agency: 'bg-[#fff3cd] text-[#856404]',
}
```

- [ ] **Step 3: Lint + verificación manual**

Run: `npm run lint`
Expected: sin errores. (La verificación visual completa se hace en Task 9 cuando el shell ya monta el tab.)

- [ ] **Step 4: Commit**

```bash
git add app/admin/UsuariosTab.tsx app/admin/lib/format.ts
git commit -m "refactor(admin): extraer tab usuarios + columna ultimo login y estado real"
```

---

## Task 7: `ActividadTab` (extraer sin cambios funcionales)

**Files:**
- Create: `app/admin/ActividadTab.tsx`

Extraer el bloque "TAB ACTIVIDAD" actual (filtros de evento/acción + lista + detalle expandible old/new value). Mover `getActionColor` y `ACTION_LABELS` aquí.

- [ ] **Step 1: Crear el componente**

```tsx
// app/admin/ActividadTab.tsx
'use client'
import { useState } from 'react'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { AuditEntry, EventOption } from './lib/types'
import { formatDateTime, timeAgo } from './lib/format'

interface Props {
  entries: AuditEntry[]
  loading: boolean
  eventOptions: EventOption[]
  onReload: () => void
}

export default function ActividadTab({ entries, loading, eventOptions, onReload }: Props) {
  const [selectedEvent, setSelectedEvent] = useState('all')
  const [actionFilter, setActionFilter]   = useState('all')
  const [expanded, setExpanded]           = useState<string | null>(null)
  // getActionColor + ACTION_LABELS locales + JSX extraido del bloque TAB ACTIVIDAD actual
}
```

Reproducir el markup actual (líneas ~659-787 de `page.tsx`), con `getActionColor` y `ACTION_LABELS` como constantes del módulo.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/admin/ActividadTab.tsx
git commit -m "refactor(admin): extraer tab actividad"
```

---

## Task 8: `ResumenTab` (pantalla de inicio)

**Files:**
- Create: `app/admin/ResumenTab.tsx`

Referencia visual exacta: `.superpowers/brainstorm/2013-1780018298/content/resumen-layout-v3.html`. Traducir las clases CSS del mockup a Tailwind. Estructura: 2 grupos de tiles (6 por fila en desktop, `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`) + 3 paneles de listas accionables (`grid-cols-1 md:grid-cols-3`).

- [ ] **Step 1: Crear el componente**

```tsx
// app/admin/ResumenTab.tsx
'use client'
import { Mail } from 'lucide-react'
import { AdminUser } from './lib/types'
import { computeResumen, powerUsers, atRiskUsers, newSignups, daysSince } from './lib/metrics'
import { formatCurrency } from '@/lib/types'
import Sparkline from './Sparkline'

interface Props { users: AdminUser[] }

export default function ResumenTab({ users }: Props) {
  const m = computeResumen(users)
  const power = powerUsers(users)
  const risk  = atRiskUsers(users)
  const fresh = newSignups(users)

  const Tile = ({ t, children }: { t: string; children: React.ReactNode }) => (
    <div className="rounded-[10px] border border-[#e8e8e8] bg-white p-3 overflow-hidden">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#999]">{t}</p>
      {children}
    </div>
  )
  const Val = ({ children }: { children: React.ReactNode }) => (
    <p className="mt-1 text-[24px] font-extrabold leading-none tracking-tight text-[#1D1E20]">{children}</p>
  )

  return (
    <div>
      {/* GRUPO: El dinero */}
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#aaa]">El dinero</p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile t="MRR">
          <Val>{formatCurrency(m.mrr, 'MXN')}</Val>
          {m.mrrTrendPct !== null
            ? <p className={'mt-1 text-[11px] font-bold ' + (m.mrrTrendPct >= 0 ? 'text-[#1a7a60]' : 'text-[#cc3333]')}>{(m.mrrTrendPct >= 0 ? '▲ +' : '▼ ') + m.mrrTrendPct + '%'}</p>
            : <p className="mt-1 text-[11px] font-semibold text-[#bbb]">altas de pago</p>}
          <Sparkline data={[2,3,3,5,6,8]} className="mt-1.5" />
        </Tile>
        <Tile t="ARR proy."><Val>{formatCurrency(m.arr, 'MXN')}</Val><p className="mt-1 text-[11px] font-semibold text-[#bbb]">MRR x12</p></Tile>
        <Tile t="Clientes pago"><Val>{m.payingCustomers}</Val><p className="mt-1 text-[11px] font-bold text-[#1a7a60]">+{m.newPayingThisMonth} mes</p></Tile>
        <Tile t="Churn"><Val>{m.churnDowngrades}</Val><p className="mt-1 text-[11px] font-semibold text-[#bbb]">con Stripe</p></Tile>
        <Tile t="Conversion"><Val>{m.conversionPct}%</Val><p className="mt-1 text-[11px] font-semibold text-[#bbb]">{m.payingCustomers}/{users.length}</p></Tile>
        <Tile t="Planes">
          <div className="mt-2 flex h-[18px] items-end gap-[2px]">
            <div className="rounded-[2px] bg-[#e6e6e6]" style={{ flex: m.byPlan.free || 1, height: '100%' }} />
            <div className="rounded-[2px] bg-[#48C9B0]" style={{ flex: m.byPlan.pro || 0.01, height: '100%' }} />
            <div className="rounded-[2px] bg-[#1D1E20]" style={{ flex: m.byPlan.agency || 0.01, height: '100%' }} />
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-[#bbb]">{m.byPlan.free}/{m.byPlan.pro}/{m.byPlan.agency}</p>
        </Tile>
      </div>

      {/* GRUPO: Crecimiento y salud */}
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#aaa]">Crecimiento y salud</p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile t="Usuarios nuevos"><Val>{m.newUsers7d}</Val><p className="mt-1 text-[11px] font-bold text-[#1a7a60]">{m.newUsers7d - m.newUsers7dPrev >= 0 ? '+' : ''}{m.newUsers7d - m.newUsers7dPrev} vs ant.</p><Sparkline type="bar" data={[3,4,3,6,m.newUsers7d]} className="mt-1.5" /></Tile>
        <Tile t="Eventos nuevos"><Val>{m.newEvents7d}</Val><p className="mt-1 text-[11px] font-semibold text-[#bbb]">7d</p></Tile>
        <Tile t="Activos 7d"><Val>{m.active7d}</Val><p className="mt-1 text-[11px] font-semibold text-[#bbb]">de {m.active30d} en 30d</p></Tile>
        <Tile t="Activos 30d"><Val>{m.active30d}</Val><Sparkline data={[5,7,6,9,8]} className="mt-1.5" /></Tile>
        <Tile t="Fantasma"><Val>{m.ghostAccounts}</Val><p className="mt-1 text-[11px] font-semibold text-[#bbb]">sin evento</p></Tile>
        <Tile t="Ult. actividad">
          <p className="mt-1.5 text-[14px] font-extrabold text-[#1D1E20]">{m.lastActivity?.last_sign_in ? 'hace ' + (daysSince(m.lastActivity.last_sign_in) ?? 0) + 'd' : '—'}</p>
          <p className="mt-1 text-[11px] font-semibold text-[#bbb] truncate">{m.lastActivity?.full_name || m.lastActivity?.email || '—'}</p>
        </Tile>
      </div>

      {/* Listas accionables */}
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#aaa]">Listas accionables</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Panel title="\u{1F525} Power users" rows={power.map(u => ({ u, sub: u.event_count + ' eventos · ' + u.total_count + ' inv', tag: u.plan }))} />
        <Panel title="⚠️ En riesgo de churn" rows={risk.map(u => ({ u, sub: u.plan + ' · ' + (u.last_sign_in ? 'sin entrar ' + daysSince(u.last_sign_in) + 'd' : 'nunca entro'), tag: 'escribir', mail: true }))} />
        <Panel title="\u{1F44B} Nuevos registros" rows={fresh.map(u => ({ u, sub: (u.event_count === 0 ? 'sin evento' : u.event_count + ' eventos'), tag: u.plan }))} />
      </div>
    </div>
  )
}
```

Y el subcomponente `Panel` (en el mismo archivo) que renderiza cada lista, con pill teal/gris/rojo según el `tag` y, si `mail`, un botón mailto al email del usuario:

```tsx
function Panel({ title, rows }: { title: string; rows: { u: AdminUser; sub: string; tag: string; mail?: boolean }[] }) {
  const pillCls = (tag: string) =>
    tag === 'pro'    ? 'bg-[#e8faf6] text-[#1a7a60]'
  : tag === 'agency' ? 'bg-[#fff3cd] text-[#856404]'
  : tag === 'escribir' ? 'bg-[#fee2e2] text-[#cc3333]'
  : 'bg-[#f0f0f0] text-[#777]'
  return (
    <div className="rounded-[11px] border border-[#e8e8e8] bg-white p-3">
      <h4 className="mb-2 text-xs font-bold text-[#1D1E20]">{title}</h4>
      {rows.length === 0
        ? <p className="py-3 text-center text-[11px] text-[#bbb]">Sin datos</p>
        : rows.map(({ u, sub, tag, mail }) => (
          <div key={u.id} className="flex items-center justify-between border-t border-[#f4f4f4] py-1.5 first:border-t-0">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-[#1D1E20]">{u.full_name || u.email}</div>
              <div className="text-[10px] text-[#aaa]">{sub}</div>
            </div>
            {mail
              ? <a href={'mailto:' + u.email} className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold text-[#cc3333]">escribir</a>
              : <span className={'rounded-full px-2 py-0.5 text-[10px] font-bold ' + pillCls(tag)}>{tag}</span>}
          </div>
        ))}
    </div>
  )
}
```

Nota: los `data` de los `Sparkline` que no provienen de series históricas reales (no las tenemos sin más queries) usan una serie corta ilustrativa fija. Es decoración de tendencia, no un dato afirmado; los números de los tiles sí son reales.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/admin/ResumenTab.tsx
git commit -m "feat(admin): pantalla de resumen con KPIs, mini-graficas y listas accionables"
```

---

## Task 9: `PagosTab`

**Files:**
- Create: `app/admin/PagosTab.tsx`

Referencia visual: `.superpowers/brainstorm/2013-1780018298/content/pagos-layout.html`. Banda informativa morada + 4 tiles de ingresos reales + tabla por cliente. Columnas desconocibles hoy (`Proximo cobro`) van `—` con `title` tooltip. "Estado" muestra "Activo" derivado. "MRR aportado" en vez de LTV.

- [ ] **Step 1: Crear el componente**

```tsx
// app/admin/PagosTab.tsx
'use client'
import { useState } from 'react'
import { Zap } from 'lucide-react'
import { AdminUser } from './lib/types'
import { getBillingRows, getBillingSummary } from '@/lib/billing'
import { formatCurrency } from '@/lib/types'
import { formatDate } from './lib/format'

interface Props { users: AdminUser[] }

export default function PagosTab({ users }: Props) {
  const [filter, setFilter] = useState<'all' | 'pro' | 'agency'>('all')
  const rows = getBillingRows(users)
  const summary = getBillingSummary(rows)
  const shown = rows.filter(r => filter === 'all' || r.plan === filter)

  const Tile = ({ t, v, d }: { t: string; v: string; d?: string }) => (
    <div className="rounded-[10px] border border-[#e8e8e8] bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#999]">{t}</p>
      <p className="mt-1 text-[25px] font-extrabold leading-none tracking-tight text-[#1D1E20]">{v}</p>
      {d && <p className="mt-1 text-[11px] font-semibold text-[#bbb]">{d}</p>}
    </div>
  )
  const planPill = (p: string) => p === 'agency' ? 'bg-[#fff3cd] text-[#856404]' : 'bg-[#e8faf6] text-[#1a7a60]'

  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2 rounded-[9px] border border-[#e6defb] bg-[#f4f1ff] px-3 py-2.5 text-xs font-semibold text-[#5b4bb0]">
        <Zap size={14} /> Datos derivados del plan. Cuando conectes Stripe, esta vista mostrara cobros e invoices reales.
      </div>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#aaa]">Ingresos</p>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile t="MRR" v={formatCurrency(summary.mrr, 'MXN')} d="recurrente mensual" />
        <Tile t="Clientes activos" v={String(summary.payingCustomers)} d={summary.byPlan.pro + ' pro · ' + summary.byPlan.agency + ' agency'} />
        <Tile t="Ticket promedio" v={formatCurrency(summary.avgTicket, 'MXN')} d="por cliente" />
        <Tile t="ARR proyectado" v={formatCurrency(summary.arr, 'MXN')} d="MRR x12" />
      </div>

      <div className="rounded-[12px] border border-[#e8e8e8] bg-white">
        <div className="flex items-center justify-between border-b border-[#f0f0f0] px-3.5 py-2.5">
          <div className="flex gap-1.5">
            {(['all', 'pro', 'agency'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={'rounded-lg border px-2.5 py-1 text-[11px] font-bold ' + (filter === f ? 'border-[#48C9B0] bg-[#48C9B0] text-white' : 'border-[#e0e0e0] text-[#666] hover:bg-[#f5f5f5]')}>
                {f === 'all' ? 'Todos' : f === 'pro' ? 'Pro' : 'Agency'}
              </button>
            ))}
          </div>
          <span className="text-xs text-[#999]">{rows.length} clientes de pago</span>
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#f0f0f0] text-left">
              {['Cliente','Plan','Monto / mes','Registrado','Estado','Proximo cobro','MRR aportado'].map(h => (
                <th key={h} className="px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#999]">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {shown.length === 0
                ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#888]">Sin clientes de pago</td></tr>
                : shown.map(r => (
                  <tr key={r.userId} className="border-b border-[#f6f6f6]">
                    <td className="px-3.5 py-2.5"><div className="font-bold text-[#1D1E20]">{r.fullName || '—'}</div><div className="text-[11px] text-[#aaa]">{r.email}</div></td>
                    <td className="px-3.5 py-2.5"><span className={'rounded-full px-2.5 py-0.5 text-[11px] font-bold ' + planPill(r.plan)}>{r.plan}</span></td>
                    <td className="px-3.5 py-2.5 font-extrabold text-[#1D1E20]">{formatCurrency(r.amountMonthly, 'MXN')}</td>
                    <td className="px-3.5 py-2.5 text-[#666]">{formatDate(r.registeredAt)}</td>
                    <td className="px-3.5 py-2.5"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a7a60]"><span className="h-[7px] w-[7px] rounded-full bg-[#1a7a60]" />Activo</span></td>
                    <td className="px-3.5 py-2.5 text-[#bbb]" title="Disponible con Stripe">{'—'}</td>
                    <td className="px-3.5 py-2.5 font-extrabold text-[#1D1E20]">{formatCurrency(r.mrrContributed, 'MXN')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="divide-y divide-[#f0f0f0] md:hidden">
          {shown.map(r => (
            <div key={r.userId} className="px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0"><p className="truncate font-bold text-[#1D1E20]">{r.fullName || r.email}</p><p className="text-[11px] text-[#aaa]">{r.email}</p></div>
                <span className={'rounded-full px-2.5 py-0.5 text-[11px] font-bold ' + planPill(r.plan)}>{r.plan}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#888]">
                <span className="font-bold text-[#1D1E20]">{formatCurrency(r.amountMonthly, 'MXN')}/mes</span>
                <span>Registrado {formatDate(r.registeredAt)}</span>
                <span className="text-[#1a7a60]">Activo</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/admin/PagosTab.tsx
git commit -m "feat(admin): pestana pagos derivada del plan, lista para stripe"
```

---

## Task 10: Shell `page.tsx` (4 tabs + montaje)

**Files:**
- Modify: `app/admin/page.tsx`

El shell conserva: auth check, `loadData`, `loadAuditLog`, `changePlan`, `callAdminAction`, `confirmDelete`, toast, header. Cambia: estado de tab a `'resumen' | 'users' | 'pagos' | 'activity'` (default `'resumen'`), barra de 4 tabs, y monta el componente correspondiente pasando props. Quita todo el JSX inline de Usuarios/Actividad (ahora en sus componentes) y los helpers movidos a `./lib/format.ts` y `./lib/types.ts`.

- [ ] **Step 1: Reemplazar `page.tsx`**

Estructura del nuevo `page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Users, CreditCard, Activity } from 'lucide-react'
import { AdminUser, GlobalStats, AuditEntry, EventOption } from './lib/types'
import ResumenTab from './ResumenTab'
import UsuariosTab from './UsuariosTab'
import PagosTab from './PagosTab'
import ActividadTab from './ActividadTab'

const ADMIN_EMAIL = 'diego.garza@moonlaunch.mx'
type Tab = 'resumen' | 'users' | 'pagos' | 'activity'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('resumen')
  // ...estado y funciones actuales (loading, authed, sessionToken, stats, users, toast,
  //    auditEntries, auditLoading, eventOptions). loadData enriquece users incluyendo
  //    last_sign_in y banned que ahora vienen de la API (ya no hardcode).
  // ...checkAuth + useEffect de audit log igual que hoy.

  // En loadData, el map de enriched debe tomar u.last_sign_in y u.banned del payload:
  //   last_sign_in: u.last_sign_in ?? null,
  //   banned:       u.banned ?? false,
  // (el resto del calculo de event_count/guest_count/etc se mantiene)

  if (!authed && !loading) return null
  if (loading) return (/* spinner actual */)

  const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { key: 'users',   label: 'Usuarios', icon: Users },
    { key: 'pagos',   label: 'Pagos', icon: CreditCard },
    { key: 'activity',label: 'Actividad', icon: Activity },
  ]

  return (
    <div className="min-h-screen bg-[#f8f5f0]">
      {/* toast actual */}
      {/* header: titulo "Anfiora Superadmin" + subtitulo "Panel de control del negocio" + botones Actualizar/Volver */}
      {/* barra de tabs: map de TABS, activo = bg-[#1D1E20] text-white */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'resumen'  && <ResumenTab users={users} />}
        {activeTab === 'users'    && <UsuariosTab users={users} stats={stats} actionLoading={actionLoading} onChangePlan={changePlan} onAdminAction={callAdminAction} onConfirmDelete={confirmDelete} />}
        {activeTab === 'pagos'    && <PagosTab users={users} />}
        {activeTab === 'activity' && <ActividadTab entries={filteredAuditSource} loading={auditLoading} eventOptions={eventOptions} onReload={loadAuditLog} />}
      </div>
    </div>
  )
}
```

Notas de migración:
- El subtítulo del header cambia a "Panel de control del negocio".
- `loadData` ya no setea `last_sign_in: null` ni `banned: false` hardcodeados; los toma del payload (`u.last_sign_in`, `u.banned`).
- Pasar `auditEntries` completo a `ActividadTab` (el filtrado por evento/acción se mueve dentro del tab).
- Mantener el badge con `auditEntries.length` en el tab Actividad.
- El botón "Actualizar" del header sigue llamando `loadData(sessionToken)` y, si el tab es activity, `loadAuditLog()`.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores ni imports sin usar.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos.

- [ ] **Step 4: Verificación manual end-to-end**

`npm run dev` → entrar a `/admin` como admin:
1. Abre en **Resumen** con KPIs reales (MRR, conversión, activos, fantasma) y 3 listas accionables pobladas.
2. **Usuarios**: tabla con columna "Último login" (timeAgo o —), estado banned real, cambiar plan / ban / delete siguen funcionando.
3. **Pagos**: banda morada, tiles de ingresos reales, tabla solo con usuarios pro/agency, filtros Pro/Agency, "Próximo cobro" = — con tooltip.
4. **Actividad**: idéntica a antes (filtros, expandible old/new).
5. Verificar responsive mobile en cada tab.

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): shell de 4 tabs con resumen, usuarios, pagos y actividad"
```

---

## Self-Review (hecho por quien escribe el plan)

**Cobertura del spec:**
- 4 tabs (Resumen/Usuarios/Pagos/Actividad) → Tasks 6-10 ✓
- `lib/billing.ts` Stripe-ready → Task 1 ✓
- `last_sign_in_at` + banned reales vía `listUsers()` → Task 2 ✓
- KPIs Resumen (dinero, embudo, salud) + listas accionables → Tasks 4, 8 ✓
- Pagos derivado, columnas honestas con `—`, "MRR aportado", banda Stripe → Task 9 ✓
- Mini-gráficas SVG sin librería → Task 5 ✓
- Cero cambios Supabase / solo lectura → respetado en Tasks 1-10 ✓
- Usuarios mantiene acciones existentes (plan/ban/delete/mailto/expandible) → Task 6 ✓

**Placeholder scan:** Los componentes de UI extraídos (Tasks 6, 7) referencian "reproducir el markup actual de page.tsx líneas X-Y con estos ajustes" en vez de re-pegar ~260 líneas idénticas — es intencional (el código fuente exacto ya existe en el repo y se está moviendo, no inventando). Los archivos nuevos de lógica (Tasks 1, 4, 5) y los tabs nuevos (Tasks 8, 9) llevan código completo. Sin TODOs.

**Consistencia de tipos:** `AdminUser` (Task 3) usado en metrics (4), billing recibe `BillingUserInput` compatible (subset de AdminUser), y todos los tabs importan de `./lib/types`. `getBillingRows/getBillingSummary` firmas coinciden entre Task 1 y su uso en Task 9. `formatCurrency(amount, 'MXN')` existe en `lib/types.ts` (verificado). Helpers `formatDate/timeAgo/PLAN_STYLES` centralizados en `./lib/format.ts` (Task 6) y consumidos por Tasks 7, 8, 9.

**Decisión de granularidad:** Tasks 6 y 7 son extracciones (mover código existente); sus "steps" describen el origen exacto + ajustes puntuales en vez de re-transcribir, porque el código ya está en el repo y re-pegarlo introduce riesgo de divergencia. Tasks 8 y 9 son código nuevo, con implementación completa.
