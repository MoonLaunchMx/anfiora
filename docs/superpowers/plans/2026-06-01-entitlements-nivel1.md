# Entitlements Nivel 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la capa de entitlements (catalogo + resolver + keys) y aplicarla en el muro de invitados y el candado de eventos (regla B), sin romper a los usuarios actuales.

**Architecture:** Las reglas viven como datos en `lib/pricing.ts` (catalogo). Un unico resolver `lib/entitlements.ts` expone `getGuestLimit`, `getActiveEventLimit`, `can`, etc. Los call-sites preguntan por capacidad, nunca por nombre de plan. El tier de pago unico vive en `events.plan_tier`; la suscripcion planner en `users.plan`. Los permisos se otorgan via un API route mock (mismo seam que usara el webhook de Stripe).

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (service role en API routes), Tailwind, Framer Motion.

**Verificacion (sin suite de tests):** El repo no usa tests (regla del proyecto: "sin tests durante MVP"). Cada tarea verifica con `npx tsc --noEmit` + `npm run lint` (sin errores nuevos en el archivo tocado) + un escenario manual en `npm run dev` donde aplique. Commits frecuentes.

---

## Garantias de no-romper-usuarios (requisito de primera clase)

1. **`normalizePlan`** mapea valores legacy de `users.plan` (`pro`/`agency`) a planes actuales **antes** de la migracion de DB, conservando su experiencia (siguen con invitados ilimitados). Nada se rompe aunque la DB aun no se migre.
2. **`plan_tier` ausente** (pre-migracion) se trata como `'free'` → los free siguen en 50 (igual que hoy), los legacy pro/agency siguen ilimitados (igual que hoy).
3. **El candado de eventos solo aplica al CREAR** un evento nuevo. Nunca bloquea ni borra eventos ya existentes. Un free con 3 eventos viejos los conserva; solo no podra crear el 4o.
4. **Orden seguro:** primero se pushea el codigo (degrada bien sin la columna), DESPUES se corre el SQL en Supabase. El codigo nunca asume que la columna ya existe.

---

## File Structure

- `lib/pricing.ts` — **Modify.** Agrega tipo `Feature` y campo `features` a cada plan (el catalogo de capacidades como datos).
- `lib/entitlements.ts` — **Create.** El resolver: `normalizePlan`, `isPlanner`, `getGuestLimit`, `getActiveEventLimit`, `getSeatLimit`, `getFeatures`, `can`. Funciones puras, importan de `pricing.ts`.
- `lib/types.ts` — **Modify.** Agrega `plan_tier?: AnfitrionTier` al tipo `Event`.
- `app/components/EventLimitModal.tsx` — **Create.** Modal del candado de eventos.
- `app/events/[id]/page.tsx` — **Modify.** El muro de invitados usa `getGuestLimit(ownerPlan, eventPlanTier)` en vez del check hardcodeado `pro`/`agency`.
- `app/events/new/page.tsx` — **Modify.** Antes de crear, cuenta eventos activos y aplica `getActiveEventLimit`; si excede, muestra `EventLimitModal`.
- `app/api/checkout/grant/route.ts` — **Create.** Otorga el permiso (mock): anfitrion → `events.plan_tier`; organizador → `users.plan`. Auth por Bearer, service role.
- `app/checkout/CheckoutClient.tsx` — **Modify.** `pay()` llama al grant antes de redirigir a `/checkout/exito`.

**Migracion de DB (manual, requiere OK de Diego):** documentada en la Tarea 8. Se corre en Supabase DESPUES de pushear el codigo.

---

### Task 1: Catalogo de capacidades en `lib/pricing.ts`

**Files:**
- Modify: `lib/pricing.ts`

- [ ] **Step 1: Agregar el tipo `Feature` despues de los tipos de tier**

Localiza (cerca de la linea 6):

```ts
export type AnfitrionTier = 'free' | 'esencial' | 'pro' | 'gran'
export type OrganizadorTier = 'solo' | 'studio' | 'agency'
```

Agrega justo debajo:

```ts
export type Feature = 'export' | 'whatsapp_agent'
```

- [ ] **Step 2: Agregar `features` a la interface `AnfitrionPlan`**

En `export interface AnfitrionPlan {` agrega una linea:

```ts
  features: Feature[]
```

- [ ] **Step 3: Agregar `features` a la interface `OrganizadorPlan`**

En `export interface OrganizadorPlan {` agrega una linea:

```ts
  features: Feature[]
```

- [ ] **Step 4: Poblar `features` en cada objeto de `ANFITRION_PLANS`**

Agrega el campo `features` a cada objeto (junto a `bullets`):
- `free`: `features: [],`
- `esencial`: `features: ['export'],`
- `pro`: `features: ['export', 'whatsapp_agent'],`
- `gran`: `features: ['export', 'whatsapp_agent'],`

- [ ] **Step 5: Poblar `features` en cada objeto de `ORGANIZADOR_PLANS`**

- `solo`: `features: ['export', 'whatsapp_agent'],`
- `studio`: `features: ['export', 'whatsapp_agent'],`
- `agency`: `features: ['export', 'whatsapp_agent'],`

- [ ] **Step 6: Verificar typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/pricing.ts
git commit -m "feat(entitlements): catalogo de capacidades (features) por plan"
```

---

### Task 2: Resolver `lib/entitlements.ts`

**Files:**
- Create: `lib/entitlements.ts`

- [ ] **Step 1: Crear el archivo completo**

```ts
import {
  ANFITRION_PLANS,
  ORGANIZADOR_PLANS,
  type AnfitrionTier,
  type OrganizadorTier,
  type Feature,
} from './pricing'

export type PlannerTier = OrganizadorTier
export type UserPlan = 'free' | PlannerTier

const FREE_GUEST_LIMIT = 50

// users.plan puede traer valores legacy ('pro'/'agency') de cuentas viejas.
// Los normalizamos a un valor actual sin romper su experiencia previa.
export function normalizePlan(raw: string | null | undefined): UserPlan {
  switch (raw) {
    case 'solo':
    case 'studio':
    case 'agency':
      return raw
    case 'pro': // legacy: era ilimitado -> lo tratamos como planner para no capar
      return 'studio'
    default:
      return 'free'
  }
}

export function isPlanner(raw: string | null | undefined): boolean {
  const p = normalizePlan(raw)
  return p === 'solo' || p === 'studio' || p === 'agency'
}

export function getGuestLimit(
  userPlan: string | null | undefined,
  eventTier: AnfitrionTier | null | undefined,
): number {
  if (isPlanner(userPlan)) return Infinity
  const tier = eventTier ?? 'free'
  const plan = ANFITRION_PLANS.find(p => p.id === tier)
  return plan ? plan.guestLimit : FREE_GUEST_LIMIT
}

export function getActiveEventLimit(userPlan: string | null | undefined): number {
  if (!isPlanner(userPlan)) return 1
  const plan = ORGANIZADOR_PLANS.find(p => p.id === normalizePlan(userPlan))
  return plan ? plan.activeEvents : 1
}

export function getSeatLimit(userPlan: string | null | undefined): number {
  if (!isPlanner(userPlan)) return 1
  const plan = ORGANIZADOR_PLANS.find(p => p.id === normalizePlan(userPlan))
  return plan ? plan.seats : 1
}

export function getFeatures(
  userPlan: string | null | undefined,
  eventTier: AnfitrionTier | null | undefined,
): Set<Feature> {
  if (isPlanner(userPlan)) {
    const plan = ORGANIZADOR_PLANS.find(p => p.id === normalizePlan(userPlan))
    return new Set(plan ? plan.features : [])
  }
  const plan = ANFITRION_PLANS.find(p => p.id === (eventTier ?? 'free'))
  return new Set(plan ? plan.features : [])
}

export function can(
  userPlan: string | null | undefined,
  eventTier: AnfitrionTier | null | undefined,
  feature: Feature,
): boolean {
  return getFeatures(userPlan, eventTier).has(feature)
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Verificacion manual de la logica (sin framework de tests)**

Run: `node -e "const e=require('child_process'); console.log('skip')"` — NO aplica (es TS). En su lugar, valida la logica leyendo: `getGuestLimit('free','free')` debe ser 50; `getGuestLimit('free','gran')` = 500; `getGuestLimit('studio', undefined)` = Infinity; `getActiveEventLimit('free')` = 1; `getActiveEventLimit('studio')` = 25; `normalizePlan('pro')` = 'studio'. Confirmar a ojo contra `lib/pricing.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/entitlements.ts
git commit -m "feat(entitlements): resolver unico (getGuestLimit, getActiveEventLimit, can)"
```

---

### Task 3: Tipo `Event.plan_tier` en `lib/types.ts`

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Importar `AnfitrionTier` al inicio del archivo**

Agrega como primera linea del archivo:

```ts
import type { AnfitrionTier } from './pricing'
```

- [ ] **Step 2: Agregar `plan_tier` al tipo `Event`**

En `export type Event = {` (linea ~61), agrega antes de `created_at`:

```ts
  plan_tier?: AnfitrionTier
```

(Opcional `?` porque pre-migracion la columna no existe y llega `undefined`.)

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat(entitlements): plan_tier en el tipo Event"
```

---

### Task 4: Refactor del muro de invitados

**Files:**
- Modify: `app/events/[id]/page.tsx`

- [ ] **Step 1: Importar el resolver**

Localiza el import existente `import { ANFITRION_PLANS } from '@/lib/pricing'` y reemplazalo por:

```ts
import { getGuestLimit } from '@/lib/entitlements'
```

(Si `ANFITRION_PLANS` se usa en otro lado del archivo, mantenlo y agrega la linea del resolver aparte.)

- [ ] **Step 2: Agregar estado para el tier del evento**

Junto a la declaracion `const [ownerPlan, setOwnerPlan] = useState(...)`, agrega:

```ts
const [eventPlanTier, setEventPlanTier] = useState<string | undefined>(undefined)
```

- [ ] **Step 3: Guardar el tier al cargar el evento**

Donde se carga el evento y se llama `setOwnerPlan(owner?.plan ?? 'free')` (linea ~462), agrega debajo:

```ts
setEventPlanTier(data.plan_tier)
```

(`data` es el evento ya cargado; pre-migracion sera `undefined`, lo cual el resolver maneja.)

- [ ] **Step 4: Reemplazar el calculo del limite**

Reemplaza estas dos lineas (linea ~494-495):

```ts
const FREE_GUEST_LIMIT = ANFITRION_PLANS.find(p => p.id === 'free')!.guestLimit
const guestLimit = ownerPlan === 'pro' || ownerPlan === 'agency' ? Infinity : FREE_GUEST_LIMIT
```

por:

```ts
const guestLimit = getGuestLimit(ownerPlan, eventPlanTier as AnfitrionTier | undefined)
```

Y agrega el import del tipo al inicio: `import type { AnfitrionTier } from '@/lib/pricing'`.

- [ ] **Step 5: Verificar typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.
Run: `npm run lint`
Expected: sin errores nuevos en `events/[id]/page.tsx`.

- [ ] **Step 6: Verificacion manual en dev**

Run: `npm run dev` (puerto 3001). Escenario: evento de un owner free → el contador muestra `/ 50`. (El tier por-evento solo cambia tras Tarea 8 + un grant.)

- [ ] **Step 7: Commit**

```bash
git add app/events/[id]/page.tsx
git commit -m "feat(entitlements): muro de invitados via resolver (tier por evento)"
```

---

### Task 5: Modal del candado de eventos

**Files:**
- Create: `app/components/EventLimitModal.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client'

import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

interface EventLimitModalProps {
  isOpen: boolean
  onClose: () => void
  isPlanner: boolean
  limit: number
}

export default function EventLimitModal({ isOpen, onClose, isPlanner, limit }: EventLimitModalProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-[#e8e8e8] bg-white p-6 text-center shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0fdfb]">
          <CalendarClock className="h-6 w-6 text-[#1f8f74]" />
        </div>
        <h2 className="text-lg font-bold text-[#1D1E20]">
          {isPlanner ? 'Llegaste al limite de eventos de tu plan' : 'Ya tienes un evento activo'}
        </h2>
        <p className="mt-2 text-sm text-[#666]">
          {isPlanner
            ? <>Tu plan permite <strong className="text-[#1D1E20]">{limit}</strong> eventos activos. Termina o archiva uno, o sube de plan para manejar mas.</>
            : <>Con tu plan puedes tener <strong className="text-[#1D1E20]">un evento activo</strong> a la vez. Terminalo o archivalo para crear otro, o hazte Planner para varios a la vez.</>}
        </p>
        <Link
          href="/precios?vista=organizador"
          className="mt-5 block w-full rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
        >
          Ver planes Planner
        </Link>
        <button
          onClick={onClose}
          className="mt-2.5 w-full rounded-lg border border-[#e0e0e0] py-2.5 text-sm text-[#666] transition hover:bg-[#f8f8f8]"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/components/EventLimitModal.tsx
git commit -m "feat(entitlements): modal del candado de eventos"
```

---

### Task 6: Candado en la creacion de eventos

**Files:**
- Modify: `app/events/new/page.tsx`

- [ ] **Step 1: Imports**

Agrega:

```ts
import { getActiveEventLimit, isPlanner } from '@/lib/entitlements'
import EventLimitModal from '@/app/components/EventLimitModal'
```

- [ ] **Step 2: Estado del modal**

Junto a los otros `useState`, agrega:

```ts
const [showEventLimit, setShowEventLimit] = useState(false)
const [limitInfo, setLimitInfo] = useState<{ planner: boolean; limit: number }>({ planner: false, limit: 1 })
```

- [ ] **Step 3: Chequear el candado dentro de `handleCreate`, despues de obtener `user`**

Justo despues de `if (!user) { window.location.href = '/'; return }` y ANTES del insert del evento, agrega:

```ts
const { data: userRow } = await supabase.from('users').select('plan').eq('id', user.id).single()
const { count } = await supabase
  .from('events')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .or('event_status.is.null,event_status.not.in.(completed,cancelled)')
const activeLimit = getActiveEventLimit(userRow?.plan)
if ((count ?? 0) >= activeLimit) {
  setLimitInfo({ planner: isPlanner(userRow?.plan), limit: activeLimit })
  setShowEventLimit(true)
  setLoading(false)
  return
}
```

- [ ] **Step 4: Renderizar el modal**

Antes del cierre del componente (antes del ultimo `</div>` del return principal), agrega:

```tsx
<EventLimitModal
  isOpen={showEventLimit}
  onClose={() => setShowEventLimit(false)}
  isPlanner={limitInfo.planner}
  limit={limitInfo.limit}
/>
```

- [ ] **Step 5: Verificar typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.
Run: `npm run lint`
Expected: sin errores nuevos en `events/new/page.tsx`.

- [ ] **Step 6: Verificacion manual en dev**

Con un usuario free que ya tiene 1 evento activo: ir a crear otro → debe aparecer `EventLimitModal` y NO crear el evento. Marcar el evento existente como completado (en configuracion/status) → ahora si deja crear.

- [ ] **Step 7: Commit**

```bash
git add app/events/new/page.tsx
git commit -m "feat(entitlements): candado de eventos al crear (regla B)"
```

---

### Task 7: API route de grant (mock) + wiring del checkout

**Files:**
- Create: `app/api/checkout/grant/route.ts`
- Modify: `app/checkout/CheckoutClient.tsx`

- [ ] **Step 1: Crear el API route**

```ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { ANFITRION_PLANS, ORGANIZADOR_PLANS } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tipo, plan } = await req.json()

  if (tipo === 'organizador') {
    if (!ORGANIZADOR_PLANS.some(p => p.id === plan)) {
      return NextResponse.json({ error: 'Plan invalido' }, { status: 400 })
    }
    const { error } = await admin.from('users').update({ plan }).eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // anfitrion: aplica el tier al evento activo del usuario
  if (!ANFITRION_PLANS.some(p => p.id === plan) || plan === 'free') {
    return NextResponse.json({ error: 'Plan invalido' }, { status: 400 })
  }
  const { data: ev } = await admin
    .from('events')
    .select('id')
    .eq('user_id', user.id)
    .or('event_status.is.null,event_status.not.in.(completed,cancelled)')
    .order('created_at', { ascending: false })
    .limit(1)
  const eventId = ev?.[0]?.id
  if (!eventId) return NextResponse.json({ error: 'Sin evento activo' }, { status: 400 })
  const { error } = await admin.from('events').update({ plan_tier: plan }).eq('id', eventId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, eventId })
}
```

- [ ] **Step 2: Importar supabase en `CheckoutClient.tsx`**

Agrega:

```ts
import { supabase } from '@/lib/supabase'
```

- [ ] **Step 3: Reemplazar la funcion `pay`**

Localiza:

```ts
  const pay = () => {
    setLoading(true)
    const params = new URLSearchParams({ tipo, plan })
    if (tipo === 'organizador') params.set('billing', billing)
    setTimeout(() => router.push(`/checkout/exito?${params.toString()}`), 1100)
  }
```

Reemplaza por:

```ts
  const pay = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      try {
        await fetch('/api/checkout/grant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ tipo, plan }),
        })
      } catch {
        // mock: si falla el grant no bloqueamos la pantalla de exito
      }
    }
    const params = new URLSearchParams({ tipo, plan })
    if (tipo === 'organizador') params.set('billing', billing)
    router.push(`/checkout/exito?${params.toString()}`)
  }
```

- [ ] **Step 4: Verificar typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.
Run: `npm run lint`
Expected: sin errores nuevos en los archivos tocados.

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/grant/route.ts app/checkout/CheckoutClient.tsx
git commit -m "feat(entitlements): grant mock al pagar (anfitrion->plan_tier, planner->users.plan)"
```

> Nota: el grant de anfitrion requiere la columna `events.plan_tier`. Antes de la Tarea 8 devolvera 500 (capturado, no rompe la UI). El grant de organizador (`users.plan`) funciona desde ya.

---

### Task 8: Migracion de DB en Supabase (MANUAL — requiere OK explicito de Diego)

**Esto NO es codigo. Se corre en el SQL editor de Supabase DESPUES de pushear las Tareas 1-7 a la rama.** Regla del repo: nunca tocar Supabase sin instruccion directa.

- [ ] **Step 1: Confirmar que el codigo de las Tareas 1-7 esta pusheado a la rama**

```bash
git log --oneline -8
git push origin feature/paywall-monetization
```

- [ ] **Step 2: Correr el SQL en Supabase (con aprobacion de Diego)**

```sql
-- 1. Columna del tier por evento (no rompe: default 'free')
alter table events add column if not exists plan_tier text not null default 'free';

-- 2. Indice para el conteo de eventos activos (rendimiento del candado)
create index if not exists idx_events_user_status on events (user_id, event_status);

-- 3. Migrar valores legacy de users.plan (pro -> studio para no capar a nadie)
update users set plan = 'studio' where plan = 'pro';
-- 'agency' legacy ya es un tier planner valido; 'free' se queda igual.
```

- [ ] **Step 3: Definir el plan de Maruka (usuario de ventas) para pruebas**

Decidir con Diego: para probar el muro free, `update users set plan = 'free' where email = 'maruka...';` o para probar planner, `update users set plan = 'studio' where email = 'maruka...';`.

- [ ] **Step 4: Verificacion manual end-to-end en dev**

1. Usuario free, evento free → muro topa en 50.
2. Pagar (mock) un tier anfitrion desde el muro → `/api/checkout/grant` 200 → refrescar el evento → el limite sube a 150/300/500.
3. Usuario free con 1 evento activo → crear otro → `EventLimitModal` bloquea.
4. Pagar (mock) un plan planner → `users.plan` = tier → ahora deja crear varios eventos (hasta el limite).

---

### Task 9: Verificacion de compatibilidad de `users.plan`

**Files:**
- Inspect: `app/perfil/page.tsx`, `app/admin/page.tsx` (y cualquier lectura de `users.plan`)

- [ ] **Step 1: Localizar lecturas de `users.plan`**

Run: `rg "\.plan" app/perfil app/admin --type ts -n` (o usar la herramienta de busqueda).
Expected: identificar donde se muestra el plan.

- [ ] **Step 2: Confirmar que solo se muestra como string**

Verificar que perfil/admin renderizan `plan` como texto (no hacen logica `=== 'pro'`). Si alguno asume valores viejos para gating, refactorizar a `lib/entitlements`. Si solo lo muestran, no se toca nada.

- [ ] **Step 3: Commit (si hubo cambios)**

```bash
git add -A
git commit -m "chore(entitlements): compat de lectura de users.plan en perfil/admin"
```

---

## Self-Review

- **Cobertura del spec:** catalogo (T1), resolver (T2), tipo plan_tier (T3), muro via resolver (T4), candado regla B (T5+T6), grant mock = seam de Stripe (T7), migracion no-breaking (T8), compat (T9). ✅
- **Sin placeholders:** todo el codigo esta completo; el SQL esta escrito; los escenarios manuales son concretos.
- **Consistencia de tipos:** `getGuestLimit(userPlan, eventTier)`, `getActiveEventLimit(userPlan)`, `isPlanner(raw)`, `Feature`, `AnfitrionTier` usados igual en todas las tareas.
- **No-breaking:** garantias documentadas arriba; el candado es solo-al-crear; el codigo degrada sin la columna; orden push-luego-SQL.

## Diferido (Nivel 2+, aditivo sin reescritura)

- Catalogo en tabla `plan_catalog` / config editable sin deploy.
- Overrides por cliente + grandfathering (snapshot de limite al comprar).
- Gating de features (`can(...,'export')`, `'whatsapp_agent'`) en los call-sites (botones export, etc.).
- Ventana 18 meses (`events.tier_purchased_at`), trial 14 dias (`users.trial_ends_at`), IDs de Stripe, y el webhook real reemplazando al grant mock.
