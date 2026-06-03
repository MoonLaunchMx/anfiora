# Onboarding post-registro (rol + foco de eventos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar una sola vez por cuenta el rol (planner/anfitrión) y el foco de eventos del usuario, vía una pantalla de onboarding post-registro en `/bienvenida`.

**Architecture:** Ruta nueva `/bienvenida` (cliente, full-screen, 2 pasos). Doble red de trigger: redirect tras signup + catch-all en dashboard cuando `users.role IS NULL`. Auto-protección en `/bienvenida` cuando el rol ya existe. Fuente única de tipos de evento extraída a `lib/event-types.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Framer Motion, Supabase (browser client), Lucide.

**Nota sobre verificación:** este repo NO tiene suite de tests (regla del MVP). La verificación de cada tarea es `npm run lint` + `npm run build` (cuando aplique) + prueba manual en `npm run dev`. Commit por tarea. Rama: `feature/onboarding-rol`. NADA de push a `main` ni cambios en Supabase por parte del agente; el SQL lo corre Diego.

---

## File Structure

- **Create `lib/event-types.ts`** — fuente única: `EventCategory`, `EventTypeConfig`, `EVENT_TYPES`, `CATEGORIES`, e imports de iconos Lucide usados por la constante. Responsabilidad: catálogo de tipos de evento.
- **Modify `app/components/NewEventModal.tsx`** — dejar de declarar la constante/tipos localmente; importarlos de `lib/event-types.ts`. Comportamiento idéntico.
- **Create `app/bienvenida/page.tsx`** — pantalla de onboarding de 2 pasos. Responsabilidad: capturar rol + event_focus y persistir en `users`.
- **Modify `app/components/auth/AuthModal.tsx`** — tras signup con sesión inmediata, redirigir a `/bienvenida` en vez de `/dashboard`.
- **Modify `app/dashboard/page.tsx`** — en `checkAuth()`, si `users.role IS NULL` redirigir a `/bienvenida` (catch-all tolerante a columna ausente).

---

## Task 1: Extraer tipos de evento a `lib/event-types.ts` (extracción pura)

**Files:**
- Create: `lib/event-types.ts`
- Modify: `app/components/NewEventModal.tsx`

- [ ] **Step 1: Crear `lib/event-types.ts` con la constante y tipos movidos tal cual**

Contenido exacto (mismos `value`/`label`/`category`/icon que hoy en `NewEventModal.tsx:8-54`):

```ts
import {
  Gem, Crown, Cake, GraduationCap, Sun, PartyPopper, Wine,
  Presentation, Monitor, UsersRound, Rocket, Building2,
  Tent, Mic, Flame, HeartHandshake, CalendarDays,
} from 'lucide-react'

export type EventCategory = 'social' | 'corporativo' | 'impacto'

export interface EventTypeConfig {
  value: string
  label: string
  category: EventCategory
  icon: React.ElementType
  hostLabel?: string
  host2Label?: string
  showOrg?: boolean
  showVenue?: boolean
}

export const EVENT_TYPES: EventTypeConfig[] = [
  { value: 'boda',         label: 'Boda',          category: 'social',      icon: Gem,            hostLabel: 'Novia',                 host2Label: 'Novio',  showVenue: true },
  { value: 'xv',           label: 'XV años',        category: 'social',      icon: Crown,          hostLabel: 'Festejada',             showVenue: true },
  { value: 'cumpleanos',   label: 'Cumpleaños',     category: 'social',      icon: Cake,           hostLabel: 'Festejado/a',           showVenue: true },
  { value: 'graduacion',   label: 'Graduación',     category: 'social',      icon: GraduationCap,  hostLabel: 'Graduado/a',            showVenue: true },
  { value: 'bautizo',      label: 'Bautizo',        category: 'social',      icon: Sun,            hostLabel: 'Nombre del bautizado/a', showVenue: true },
  { value: 'fiesta',       label: 'Fiesta',         category: 'social',      icon: PartyPopper,    hostLabel: 'Anfitrión/a',           showVenue: true },
  { value: 'despedida',    label: 'Despedida',      category: 'social',      icon: Wine,           hostLabel: 'Festejado/a',           showVenue: true },
  { value: 'conferencia',  label: 'Conferencia',    category: 'corporativo', icon: Presentation,   hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'capacitacion', label: 'Capacitación',   category: 'corporativo', icon: Monitor,        hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'teambuilding', label: 'Team Building',  category: 'corporativo', icon: UsersRound,     hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'lanzamiento',  label: 'Lanzamiento',    category: 'corporativo', icon: Rocket,         hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'asamblea',     label: 'Asamblea',       category: 'corporativo', icon: Building2,      hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'retiro',       label: 'Retiro',         category: 'impacto',     icon: Tent,           hostLabel: 'Organizador principal' },
  { value: 'congreso',     label: 'Congreso',       category: 'impacto',     icon: Mic,            hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'campamento',   label: 'Campamento',     category: 'impacto',     icon: Flame,          hostLabel: 'Organizador principal' },
  { value: 'caridad',      label: 'Caridad',        category: 'impacto',     icon: HeartHandshake, hostLabel: 'Organizador principal',  showOrg: true },
  { value: 'otro',         label: 'Otro',           category: 'social',      icon: CalendarDays,   hostLabel: 'Anfitrión/a',           showVenue: true },
]

export const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'social',      label: 'Social' },
  { value: 'corporativo', label: 'Corporativo' },
  { value: 'impacto',     label: 'Impacto' },
]
```

- [ ] **Step 2: En `NewEventModal.tsx`, reemplazar el import de Lucide y borrar la constante/tipos locales**

En `app/components/NewEventModal.tsx`:
- Reemplazar el bloque de import de `lucide-react` (líneas ~8-13) para dejar SOLO los iconos que el modal usa fuera de la constante:

```ts
import { ChevronRight, ArrowLeft, X } from 'lucide-react'
```

- Borrar el bloque de tipos `EventCategory` / `EventTypeConfig` (líneas ~17-28).
- Borrar la constante `EVENT_TYPES` (líneas ~30-48) y la constante `CATEGORIES` (líneas ~50-54).
- Agregar el import desde la fuente única (junto a los otros imports del archivo):

```ts
import { EVENT_TYPES, CATEGORIES, EventTypeConfig, EventCategory } from '@/lib/event-types'
```

No cambiar nada más del archivo: `eventType.icon` sigue funcionando porque el icono viene dentro de cada `EventTypeConfig`.

- [ ] **Step 3: Verificar lint + build (extracción no rompe nada)**

Run: `npm run lint && npm run build`
Expected: lint sin errores nuevos; build PASS sin errores de tipo (especialmente "Cannot find name 'EVENT_TYPES'" o iconos sin usar).

- [ ] **Step 4: Prueba manual rápida del modal de alta**

Run: `npm run dev`, abrir dashboard, click "Nuevo evento".
Expected: el paso 1 muestra las 3 categorías y los mismos 16 tipos con sus iconos; seleccionar un tipo abre el paso 2 igual que antes; crear un evento de prueba funciona idéntico.

- [ ] **Step 5: Commit**

```bash
git add lib/event-types.ts app/components/NewEventModal.tsx
git commit -m "refactor(eventos): fuente unica de tipos de evento en lib/event-types"
```

---

## Task 2: Pantalla de onboarding `/bienvenida` (2 pasos)

**Files:**
- Create: `app/bienvenida/page.tsx`

- [ ] **Step 1: Crear `app/bienvenida/page.tsx` con la pantalla completa**

Requisitos de comportamiento:
- `'use client'` + `export const dynamic = 'force-dynamic'`.
- Al montar: `supabase.auth.getUser()`. Si no hay user → `window.location.href = '/'`. Si hay user, leer `users.role`; si `role` ya tiene valor → `window.location.href = '/dashboard'` (auto-protección). La lectura debe ser tolerante: si la query falla (p. ej. columna aún no existe), NO redirigir y dejar continuar el onboarding.
- Estado: `step` (1 | 2), `role` (`'planner' | 'anfitrion' | null`), `focus` (`string[]`), `loading`, `error`.
- Paso 1 (obligatorio): dos cards seleccionables; al elegir rol, avanzar a paso 2. No se avanza sin rol.
- Paso 2 (opcional): multi-select de `EVENT_TYPES` agrupado por `CATEGORIES`; toggle de cada tipo en `focus`. Botón "Continuar" siempre habilitado.
- Al continuar: `update users set role, event_focus where id = user.id`. Antes de redirigir: `localStorage.setItem('gf_welcomed', '1')`. Luego `window.location.href = '/dashboard'`.
- Estilo flat/teal del sistema (`#48C9B0` CTA), sin emojis, iconos Lucide, UI en español, mobile-first.

Código:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { EVENT_TYPES, CATEGORIES } from '@/lib/event-types'
import { Briefcase, PartyPopper, Check, ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Role = 'planner' | 'anfitrion'

export default function BienvenidaPage() {
  const [ready, setReady]     = useState(false)
  const [step, setStep]       = useState<1 | 2>(1)
  const [role, setRole]       = useState<Role | null>(null)
  const [focus, setFocus]     = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      const { data, error: qErr } = await supabase
        .from('users').select('role').eq('id', user.id).single()
      if (!active) return
      if (!qErr && data?.role) { window.location.href = '/dashboard'; return }
      setReady(true)
    })()
    return () => { active = false }
  }, [])

  const toggleFocus = (value: string) => {
    setFocus(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  const selectRole = (r: Role) => { setRole(r); setError(''); setStep(2) }

  const finish = async () => {
    if (!role) { setStep(1); return }
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    const { error: upErr } = await supabase
      .from('users').update({ role, event_focus: focus }).eq('id', user.id)
    if (upErr) {
      setError('No pudimos guardar tu informacion. Intenta de nuevo.')
      setLoading(false)
      return
    }
    localStorage.setItem('gf_welcomed', '1')
    window.location.href = '/dashboard'
  }

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f8f8f8]" />
  }

  const focusTitle = role === 'planner' ? '¿Que tipos de eventos manejas?' : '¿Que tipo de evento organizas?'

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f8f8f8] px-4 py-10">
      <div className="w-full max-w-2xl">

        <div className="mb-8 flex items-center gap-2">
          <div className={'h-1.5 flex-1 rounded-full ' + (step >= 1 ? 'bg-[#48C9B0]' : 'bg-[#e0e0e0]')} />
          <div className={'h-1.5 flex-1 rounded-full ' + (step >= 2 ? 'bg-[#48C9B0]' : 'bg-[#e0e0e0]')} />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              <h1 className="text-2xl font-bold text-[#1D1E20]">Te damos la bienvenida</h1>
              <p className="mt-1.5 text-sm text-[#777]">Cuentanos quien eres para personalizar tu experiencia.</p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => selectRole('planner')}
                  className="group flex flex-col items-start gap-4 rounded-2xl border border-[#e8e8e8] bg-white p-6 text-left transition hover:border-[#48C9B0] hover:bg-[#f0fdfb] active:scale-[0.99]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4f4f4] transition group-hover:bg-[#d0f5ec]">
                    <Briefcase size={20} className="text-[#888] transition group-hover:text-[#0F6E56]" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#1D1E20]">Planner / Organizador profesional</p>
                    <p className="mt-1 text-sm text-[#888]">Organizo eventos para mis clientes.</p>
                  </div>
                </button>

                <button
                  onClick={() => selectRole('anfitrion')}
                  className="group flex flex-col items-start gap-4 rounded-2xl border border-[#e8e8e8] bg-white p-6 text-left transition hover:border-[#48C9B0] hover:bg-[#f0fdfb] active:scale-[0.99]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4f4f4] transition group-hover:bg-[#d0f5ec]">
                    <PartyPopper size={20} className="text-[#888] transition group-hover:text-[#0F6E56]" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#1D1E20]">Anfitrion</p>
                    <p className="mt-1 text-sm text-[#888]">Organizo mi propio evento (boda, XV, fiesta...).</p>
                  </div>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              <button
                onClick={() => { setStep(1); setError('') }}
                className="mb-4 flex items-center gap-1.5 text-xs text-[#888] transition hover:text-[#1D1E20]"
              >
                <ArrowLeft size={13} /> Atras
              </button>

              <h1 className="text-2xl font-bold text-[#1D1E20]">{focusTitle}</h1>
              <p className="mt-1.5 text-sm text-[#777]">Puedes elegir varios. Es opcional.</p>

              <div className="mt-6 flex flex-col gap-6">
                {CATEGORIES.map(cat => (
                  <div key={cat.value}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#999]">{cat.label}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {EVENT_TYPES.filter(t => t.category === cat.value).map(type => {
                        const Icon = type.icon
                        const selected = focus.includes(type.value)
                        return (
                          <button
                            key={type.value}
                            onClick={() => toggleFocus(type.value)}
                            className={
                              'relative flex items-center gap-2.5 rounded-xl border p-3 text-left transition active:scale-[0.98] ' +
                              (selected
                                ? 'border-[#48C9B0] bg-[#f0fdfb]'
                                : 'border-[#e8e8e8] bg-white hover:border-[#48C9B0]')
                            }
                          >
                            <Icon size={16} className={selected ? 'text-[#0F6E56]' : 'text-[#999]'} />
                            <span className="text-sm font-medium text-[#1D1E20]">{type.label}</span>
                            {selected && (
                              <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#48C9B0]">
                                <Check size={11} className="text-white" />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-5 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">
                  {error}
                </div>
              )}

              <button
                onClick={finish}
                disabled={loading}
                className="mt-8 w-full rounded-xl bg-[#48C9B0] py-3 text-sm font-semibold text-white transition hover:bg-[#3ab89f] disabled:opacity-60"
              >
                {loading ? 'Guardando...' : 'Continuar al panel'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: PASS. (El build NO requiere que existan las columnas `role`/`event_focus` en la DB; solo compila TypeScript.)

- [ ] **Step 3: Prueba manual (sin DB aún puede fallar el guardado — eso es esperado)**

Run: `npm run dev`, navegar manualmente a `http://localhost:3000/bienvenida` con sesión iniciada.
Expected: render del paso 1; elegir rol pasa a paso 2; multi-select togglea; "Atras" regresa. El guardado final se valida en Task 5 (tras correr el SQL). Si las columnas no existen aún, mostrará el error rojo "No pudimos guardar..." — comportamiento tolerante correcto.

- [ ] **Step 4: Commit**

```bash
git add app/bienvenida/page.tsx
git commit -m "feat(onboarding): pantalla /bienvenida de 2 pasos (rol + foco de eventos)"
```

---

## Task 3: Redirigir a `/bienvenida` tras signup con sesión inmediata

**Files:**
- Modify: `app/components/auth/AuthModal.tsx:175-184`

- [ ] **Step 1: Cambiar el destino del redirect en `handleRegister`**

En `app/components/auth/AuthModal.tsx`, dentro de `handleRegister`, en el bloque `if (data.session) { ... }`, cambiar el destino de redirección de `/dashboard` a `/bienvenida`. El bloque queda:

```ts
      if (data.session) {
        await fetch('/api/legal/accept', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + data.session.access_token },
        }).catch(() => {})
        window.location.href = '/bienvenida'
      } else {
        setSuccess(t.success_register)
      }
```

No tocar el login (`handleLogin` sigue yendo a `/dashboard`): los que confirman email entran por login y los captura el catch-all del dashboard (Task 4).

- [ ] **Step 2: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/auth/AuthModal.tsx
git commit -m "feat(onboarding): signup con sesion inmediata redirige a /bienvenida"
```

---

## Task 4: Catch-all en dashboard (gate sobre `role IS NULL`)

**Files:**
- Modify: `app/dashboard/page.tsx:122-128`

- [ ] **Step 1: Agregar el gate de rol en `checkAuth()`**

En `app/dashboard/page.tsx`, reemplazar la función `checkAuth` por esta versión. Si `users.role` es null/ausente → redirigir a `/bienvenida`. Tolerante a fallo de query (si la columna aún no existe, NO redirige y deja ver el dashboard):

```ts
  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    const { data: profile, error: profErr } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (!profErr && profile && !profile.role) {
      window.location.href = '/bienvenida'
      return
    }
    setUserEmail(user.email || '')
    const welcomed = localStorage.getItem('gf_welcomed')
    if (!welcomed) { setShowWelcome(true); localStorage.setItem('gf_welcomed', '1') }
  }
```

- [ ] **Step 2: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(onboarding): dashboard redirige a /bienvenida cuando falta el rol"
```

---

## Task 5: Verificación end-to-end en local (tras correr el SQL)

**Pre-requisito (lo corre Diego en Supabase, NO el agente):**

```sql
alter table users add column if not exists role text;
alter table users add column if not exists event_focus text[];
```

- [ ] **Step 1: Confirmar con Diego que el SQL ya corrió en Supabase**

No avanzar hasta tener confirmación explícita. El agente nunca toca Supabase.

- [ ] **Step 2: Flujo nuevo usuario (signup con sesión inmediata)**

Con `npm run dev`: registrar una cuenta nueva de prueba.
Expected: tras crear cuenta cae en `/bienvenida`; elegir rol + algunos tipos; "Continuar al panel" guarda y lleva a `/dashboard`; el welcome NO aparece (porque seteamos `gf_welcomed`). Verificar en Supabase que `users.role` y `users.event_focus` quedaron poblados para ese usuario.

- [ ] **Step 3: Flujo catch-all (usuario sin rol entra por login)**

En Supabase, poner `role = null` a un usuario de prueba existente. Iniciar sesión con él.
Expected: el dashboard redirige a `/bienvenida`. Completar onboarding → vuelve al dashboard y ya no re-gatea.

- [ ] **Step 4: Auto-protección de `/bienvenida`**

Con un usuario que ya tiene `role`, navegar manualmente a `/bienvenida`.
Expected: redirige a `/dashboard` sin mostrar el onboarding.

- [ ] **Step 5: No-regresión del alta de evento**

Crear un evento desde el dashboard.
Expected: el modal y la creación funcionan idénticos (Task 1 no rompió nada).

- [ ] **Step 6: Verificación final de build**

Run: `npm run lint && npm run build`
Expected: PASS. Reportar resultados a Diego y esperar OK para push a la rama.

---

## Self-Review (cobertura del spec)

- Ruta `/bienvenida` 2 pasos → Task 2. ✓
- Trigger doble red (signup redirect → Task 3; catch-all dashboard → Task 4; auto-protección → Task 2 Step 1). ✓
- Paso 1 obligatorio, 2 roles → Task 2. ✓
- Paso 2 multi-select opcional reutilizando EVENT_TYPES → Task 2 + Task 1. ✓
- Extracción pura a `lib/event-types.ts` con iconos limpios → Task 1. ✓
- SQL lo corre Diego; código tolerante a columna ausente → Task 2/4 (queries con manejo de error), Task 5 (pre-requisito). ✓
- Pulido anti doble-popup (`gf_welcomed`) → Task 2 (`finish`) + Task 4 (orden del welcome). ✓
- Verificación lint+build+manual (sin tests por regla MVP) → todas las tasks. ✓
