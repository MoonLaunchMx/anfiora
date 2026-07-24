# i18n Fase 1 — Motor + Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar el motor de i18n propio y tipado en `lib/i18n`, y dejar bilingue (es/en) el shell que se ve en toda la app: layout de evento, sidebar, bottom nav, menu de usuario, selector de idioma en `/perfil`, y `<html lang>` dinamico. El idioma se guarda en `users.locale`.

**Architecture:** Un diccionario por idioma (`es.ts` fuente de verdad; `en.ts` tipado contra `typeof es` para que falte-una-clave = build truena). Un provider de React expone `useT()`/`useLocale()`/`useSetLocale()`. La preferencia vive en `users.locale` (verdad) espejada en `localStorage` (paint sin parpadeo). Las pantallas piden etiquetas por clave con puntos (`t('nav.invitados')`); jamas concatenan frases; fechas/numeros salen de `Intl`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (browser client `lib/supabase.ts`), Vitest para logica pura. Cero dependencias nuevas.

## Global Constraints

- **Cero dependencias nuevas.** Regla "stack no cambiar". Nada de next-intl ni i18next.
- **UI CON acentos y en espanol/ingles correctos.** El diccionario `es` lleva acentos y enes; "sin acentos" aplica solo a mensajes de git.
- **Sin emojis, sin banderas.** El selector dice `Español` / `English` en texto. No replicar el toggle 🇬🇧/🇲🇽 de la landing.
- **Solo Tailwind** salvo excepciones ya existentes en el archivo que se edita.
- **Lucide para iconos.** No SVG manuales nuevos.
- **Commits convencionales sin acentos ni ename:** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.
- **Tests:** Vitest para logica pura (motor). UI y persistencia se verifican manual por flujo local -> preview -> main.
- **Regla de sincronia Supabase<->Vercel:** el codigo que lee `users.locale` debe tener fallback a `'es'` y estar pusheado ANTES de correr el `ALTER TABLE`. Ver Task 6.
- **Alias de imports:** `@/` mapea a la raiz del repo (`tsconfig` paths `@/*`).
- **El provider expone SOLO el idioma de la cuenta.** Las paginas publicas (invitacion, puerta, playlist, mesa-regalos) NO deben consumir `useT()`/`useLocale()` — leeran `events.locale` en Fase 5. Prohibido por diseno.

---

## File Structure

**Nuevos:**
- `lib/i18n/index.ts` — tipo `Locale`, tipos `Translations`/`TKey`, `translate()`, interpolacion, plurales, helpers de validacion.
- `lib/i18n/format.ts` — `formatNumberI18n`, `formatEventDateI18n` con `Intl` segun locale.
- `lib/i18n/es.ts` — diccionario espanol (fuente de verdad), `as const`, exporta `type Translations`.
- `lib/i18n/en.ts` — diccionario ingles, tipado `: Translations`.
- `lib/i18n/context.tsx` — `I18nProvider`, `useT`, `useLocale`, `useSetLocale`.
- `lib/i18n/persist.ts` — `saveUserLocale()` escribe `users.locale` para la sesion actual.
- `app/components/LocaleSync.tsx` — reconcilia `users.locale` -> provider al cargar (usuarios logueados).
- `app/components/ui/LocaleSelector.tsx` — segmentado `Español`/`English` reutilizable.
- `lib/i18n/index.test.ts`, `lib/i18n/format.test.ts` — Vitest.

**Modificados:**
- `app/layout.tsx` — montar `<I18nProvider>` + `<LocaleSync/>`; quitar `lang="es"` fijo del `<html>` (lo maneja el provider).
- `app/perfil/page.tsx` — leer/escribir `users.locale`, render de `<LocaleSelector/>`.
- `app/events/[id]/layout.tsx` — nav labels, EVENT_TYPE/STATUS labels, menu de usuario, textos sueltos, fecha localizada, toggle de idioma en el dropdown.

---

## Task 1: Motor de traduccion (nucleo puro)

**Files:**
- Create: `lib/i18n/index.ts`
- Test: `lib/i18n/index.test.ts`

**Interfaces:**
- Produces:
  - `type Locale = 'es' | 'en'`
  - `const LOCALES: Locale[]`, `const DEFAULT_LOCALE: Locale`
  - `function isValidLocale(v: unknown): v is Locale`
  - `type Node = string | Plural | { [k: string]: Node }` ; `type Plural = { one: string; other: string }`
  - `function translate(dict: Node, key: string, params?: Record<string, string | number>, locale?: Locale): string`
  - `type DotKeys<T>` y `type TKey` se definen en Task 3 (dependen de `Translations`). Aqui `translate` recibe `key: string`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/i18n/index.test.ts
import { describe, it, expect } from 'vitest'
import { translate, isValidLocale, DEFAULT_LOCALE, LOCALES } from './index'

const dict = {
  common: { save: 'Guardar', loading: 'Cargando...' },
  invitados: {
    titulo: 'Invitados',
    saludo: 'Hola {name}',
    confirmados: { one: '{n} confirmado', other: '{n} confirmados' },
  },
}

describe('translate', () => {
  it('resuelve una clave anidada por puntos', () => {
    expect(translate(dict, 'common.save')).toBe('Guardar')
  })
  it('interpola parametros con {llaves}', () => {
    expect(translate(dict, 'invitados.saludo', { name: 'Diego' })).toBe('Hola Diego')
  })
  it('deja el {token} intacto si falta el parametro', () => {
    expect(translate(dict, 'invitados.saludo')).toBe('Hola {name}')
  })
  it('elige singular con Intl.PluralRules', () => {
    expect(translate(dict, 'invitados.confirmados', { n: 1 }, 'es')).toBe('1 confirmado')
  })
  it('elige plural con Intl.PluralRules', () => {
    expect(translate(dict, 'invitados.confirmados', { n: 5 }, 'es')).toBe('5 confirmados')
  })
  it('plural en ingles respeta las reglas de en', () => {
    expect(translate(dict, 'invitados.confirmados', { n: 1 }, 'en')).toBe('1 confirmado')
  })
  it('clave inexistente cae en la propia clave (fallback visible)', () => {
    expect(translate(dict, 'no.existe')).toBe('no.existe')
  })
  it('clave que apunta a un objeto (no hoja) cae en la clave', () => {
    expect(translate(dict, 'common')).toBe('common')
  })
})

describe('isValidLocale', () => {
  it('acepta es/en', () => {
    expect(isValidLocale('es')).toBe(true)
    expect(isValidLocale('en')).toBe(true)
  })
  it('rechaza otros', () => {
    expect(isValidLocale('fr')).toBe(false)
    expect(isValidLocale(null)).toBe(false)
  })
})

describe('constantes', () => {
  it('DEFAULT_LOCALE es es', () => expect(DEFAULT_LOCALE).toBe('es'))
  it('LOCALES trae es y en', () => expect(LOCALES).toEqual(['es', 'en']))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/i18n/index.test.ts`
Expected: FAIL con "Cannot find module './index'" o "translate is not a function".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/i18n/index.ts
export type Locale = 'es' | 'en'

export const LOCALES: Locale[] = ['es', 'en']
export const DEFAULT_LOCALE: Locale = 'es'

export const LOCALE_TO_BCP47: Record<Locale, string> = {
  es: 'es-MX',
  en: 'en-US',
}

export type Plural = { one: string; other: string }
export type Node = string | Plural | { [k: string]: Node }

export function isValidLocale(v: unknown): v is Locale {
  return v === 'es' || v === 'en'
}

function isPlural(node: Node): node is Plural {
  return typeof node === 'object' && node !== null && typeof (node as Plural).other === 'string'
}

function resolve(dict: Node, key: string): Node | undefined {
  let current: Node | undefined = dict
  for (const part of key.split('.')) {
    if (current === undefined || typeof current === 'string' || isPlural(current)) return undefined
    current = (current as Record<string, Node>)[part]
  }
  return current
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in params ? String(params[k]) : `{${k}}`,
  )
}

export function translate(
  dict: Node,
  key: string,
  params?: Record<string, string | number>,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const node = resolve(dict, key)
  if (node === undefined) return key

  if (typeof node === 'string') return interpolate(node, params)

  if (isPlural(node)) {
    const n = Number(params?.n ?? 0)
    const form = new Intl.PluralRules(LOCALE_TO_BCP47[locale]).select(n)
    const template = (node as Record<string, string>)[form] ?? node.other
    return interpolate(template, params)
  }

  return key
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/i18n/index.test.ts`
Expected: PASS (todos los casos).

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/index.ts lib/i18n/index.test.ts
git commit -m "feat(i18n): motor de traduccion con interpolacion y plurales"
```

---

## Task 2: Formateo de fechas y numeros por locale

**Files:**
- Create: `lib/i18n/format.ts`
- Test: `lib/i18n/format.test.ts`

**Interfaces:**
- Consumes: `Locale`, `LOCALE_TO_BCP47` de `lib/i18n/index.ts`.
- Produces:
  - `function formatNumberI18n(n: number, locale: Locale): string`
  - `function formatEventDateI18n(start: string | null | undefined, end: string | null | undefined, locale: Locale): string`

- [ ] **Step 1: Write the failing test**

```ts
// lib/i18n/format.test.ts
import { describe, it, expect } from 'vitest'
import { formatNumberI18n, formatEventDateI18n } from './format'

describe('formatNumberI18n', () => {
  it('agrupa miles segun locale', () => {
    expect(formatNumberI18n(1990, 'es')).toBe('1,990')
    expect(formatNumberI18n(1990, 'en')).toBe('1,990')
  })
})

describe('formatEventDateI18n', () => {
  it('un solo dia en espanol', () => {
    expect(formatEventDateI18n('2026-07-24', null, 'es')).toBe('24 de julio de 2026')
  })
  it('un solo dia en ingles', () => {
    expect(formatEventDateI18n('2026-07-24', null, 'en')).toBe('July 24, 2026')
  })
  it('vacio devuelve cadena vacia', () => {
    expect(formatEventDateI18n(null, null, 'es')).toBe('')
  })
  it('rango mismo mes en ingles usa el locale', () => {
    expect(formatEventDateI18n('2026-07-24', '2026-07-26', 'en')).toContain('2026')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/i18n/format.test.ts`
Expected: FAIL con "Cannot find module './format'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/i18n/format.ts
import { LOCALE_TO_BCP47, type Locale } from './index'

export function formatNumberI18n(n: number, locale: Locale): string {
  return n.toLocaleString(LOCALE_TO_BCP47[locale])
}

function parseYMD(str: string): Date | null {
  const clean = str.split('T')[0]
  const [y, m, d] = clean.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function formatEventDateI18n(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: Locale,
): string {
  if (!start) return ''
  const bcp = LOCALE_TO_BCP47[locale]
  const from = parseYMD(start)
  if (!from) return ''

  const to = end ? parseYMD(end) : null
  const singleDay = !to || to.getTime() <= from.getTime()

  if (singleDay) {
    return from.toLocaleDateString(bcp, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const sameYear = from.getFullYear() === to!.getFullYear()
  const sameMonth = sameYear && from.getMonth() === to!.getMonth()

  if (sameMonth) {
    const left = from.toLocaleDateString(bcp, { day: 'numeric' })
    const right = to!.toLocaleDateString(bcp, { day: 'numeric', month: 'long', year: 'numeric' })
    return `${left} – ${right}`
  }

  if (sameYear) {
    const left = from.toLocaleDateString(bcp, { day: 'numeric', month: 'long' })
    const right = to!.toLocaleDateString(bcp, { day: 'numeric', month: 'long', year: 'numeric' })
    return `${left} – ${right}`
  }

  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  const left = from.toLocaleDateString(bcp, opts).replace(/\./g, '')
  const right = to!.toLocaleDateString(bcp, opts).replace(/\./g, '')
  return `${left} – ${right}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/i18n/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/format.ts lib/i18n/format.test.ts
git commit -m "feat(i18n): formateo de fecha y numero por locale"
```

---

## Task 3: Diccionarios es/en del shell + tipos de clave

**Files:**
- Create: `lib/i18n/es.ts`
- Create: `lib/i18n/en.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `const es` (`as const`) y `const en: Translations`
  - `type Translations = typeof es`
  - `type TKey = DotKeys<Translations>` (union de todas las claves con puntos)
  - Namespaces del shell: `common`, `nav`, `eventType`, `eventStatus`, `userMenu`, `layout`.

- [ ] **Step 1: Crear el diccionario fuente `es.ts`**

```ts
// lib/i18n/es.ts
export const es = {
  common: {
    loading: 'Cargando...',
    save: 'Guardar',
    cancel: 'Cancelar',
  },
  nav: {
    invitados: 'Invitados',
    invitacion: 'Invitación',
    mensajes: 'Mensajes',
    mesas: 'Mesas',
    timeline: 'Timeline',
    comida: 'Comida',
    mesaRegalos: 'Mesa de regalos',
    mesaRegalosMobile: 'Regalos',
    finanzas: 'Finanzas',
    presupuesto: 'Presupuesto',
    proveedores: 'Proveedores',
    pagos: 'Pagos',
    recuerdos: 'Recuerdos',
    album: 'Album',
    playlist: 'Playlist',
    estilo: 'Estilo',
    dressCode: 'Dress code',
    configuracion: 'Configuración',
    configuracionMobile: 'Config',
  },
  eventType: {
    boda: 'Boda',
    cumpleanos: 'Cumpleaños',
    fiesta: 'Fiesta',
    corporativo: 'Corporativo',
    bautizo: 'Bautizo',
    otro: 'Otro',
  },
  eventStatus: {
    active: 'Activo',
    paused: 'Pausado',
    cancelled: 'Cancelado',
    completed: 'Completado',
  },
  userMenu: {
    account: 'Mi cuenta',
    profile: 'Mi perfil',
    feedback: 'Enviar feedback',
    logout: 'Cerrar sesión',
  },
  layout: {
    home: 'Inicio',
    myEvents: 'Mis eventos',
    expand: 'Expandir',
    collapse: 'Colapsar',
    language: 'Idioma',
  },
} as const

export type Translations = typeof es

type Leaf = string | { one: string; other: string }
export type DotKeys<T> = {
  [K in keyof T & string]: T[K] extends Leaf ? K : `${K}.${DotKeys<T[K]>}`
}[keyof T & string]

export type TKey = DotKeys<Translations>
```

- [ ] **Step 2: Crear el diccionario `en.ts` tipado (la red de seguridad)**

```ts
// lib/i18n/en.ts
import type { Translations } from './es'

export const en: Translations = {
  common: {
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
  },
  nav: {
    invitados: 'Guests',
    invitacion: 'Invitation',
    mensajes: 'Messages',
    mesas: 'Tables',
    timeline: 'Timeline',
    comida: 'Food',
    mesaRegalos: 'Gift registry',
    mesaRegalosMobile: 'Gifts',
    finanzas: 'Finances',
    presupuesto: 'Budget',
    proveedores: 'Vendors',
    pagos: 'Payments',
    recuerdos: 'Memories',
    album: 'Album',
    playlist: 'Playlist',
    estilo: 'Style',
    dressCode: 'Dress code',
    configuracion: 'Settings',
    configuracionMobile: 'Settings',
  },
  eventType: {
    boda: 'Wedding',
    cumpleanos: 'Birthday',
    fiesta: 'Party',
    corporativo: 'Corporate',
    bautizo: 'Baptism',
    otro: 'Other',
  },
  eventStatus: {
    active: 'Active',
    paused: 'Paused',
    cancelled: 'Cancelled',
    completed: 'Completed',
  },
  userMenu: {
    account: 'My account',
    profile: 'My profile',
    feedback: 'Send feedback',
    logout: 'Log out',
  },
  layout: {
    home: 'Home',
    myEvents: 'My events',
    expand: 'Expand',
    collapse: 'Collapse',
    language: 'Language',
  },
}
```

- [ ] **Step 3: Verificar que el tipado obliga cobertura (prueba de la red de seguridad)**

Borra temporalmente la linea `logout: 'Log out',` de `en.ts` y corre:

Run: `npx tsc --noEmit`
Expected: FAIL con error tipo "Property 'logout' is missing in type ... but required in type 'Translations'".

Vuelve a poner la linea. Esto confirma que una clave faltante en ingles rompe el build.

- [ ] **Step 4: Verificar build limpio con ambos diccionarios completos**

Run: `npx tsc --noEmit`
Expected: sin errores en `lib/i18n/*`.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/es.ts lib/i18n/en.ts
git commit -m "feat(i18n): diccionarios es/en del shell con cobertura tipada"
```

---

## Task 4: Provider de React y hooks

**Files:**
- Create: `lib/i18n/context.tsx`

**Interfaces:**
- Consumes: `translate`, `DEFAULT_LOCALE`, `isValidLocale`, `Node`, `Locale` de `./index`; `es`, `en`, `TKey` de `./es`/`./en`.
- Produces:
  - `function I18nProvider({ children }: { children: React.ReactNode }): JSX.Element`
  - `function useT(): (key: TKey, params?: Record<string, string | number>) => string`
  - `function useLocale(): Locale`
  - `function useSetLocale(): (l: Locale) => void`
  - Constante exportada `LOCALE_STORAGE_KEY = 'anfiora_locale'`

- [ ] **Step 1: Implementar el provider**

```tsx
// lib/i18n/context.tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { translate, DEFAULT_LOCALE, isValidLocale, type Locale, type Node } from './index'
import { es, type TKey } from './es'
import { en } from './en'

export const LOCALE_STORAGE_KEY = 'anfiora_locale'

const DICTS: Record<Locale, Node> = {
  es: es as unknown as Node,
  en: en as unknown as Node,
}

type Ctx = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && isValidLocale(stored)) {
      setLocaleState(stored)
      return
    }
    if (navigator.language?.toLowerCase().startsWith('en')) setLocaleState('en')
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, l)
    } catch {
      /* storage bloqueado: el idioma vive solo en memoria esta sesion */
    }
  }, [])

  const t = useCallback(
    (key: TKey, params?: Record<string, string | number>) =>
      translate(DICTS[locale], key, params, locale),
    [locale],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

function useCtx(): Ctx {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT/useLocale/useSetLocale deben usarse dentro de <I18nProvider>')
  return ctx
}

export function useT() {
  return useCtx().t
}

export function useLocale() {
  return useCtx().locale
}

export function useSetLocale() {
  return useCtx().setLocale
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add lib/i18n/context.tsx
git commit -m "feat(i18n): provider de React con useT/useLocale/useSetLocale"
```

---

## Task 5: Montar el provider en el layout raiz + `<html lang>` dinamico + LocaleSync

**Files:**
- Create: `app/components/LocaleSync.tsx`
- Modify: `app/layout.tsx` (montar provider, envolver children; el `<html lang="es">` se queda como valor inicial de SSR y el provider lo corrige en cliente)

**Interfaces:**
- Consumes: `I18nProvider`, `useSetLocale`, `LOCALE_STORAGE_KEY` de `lib/i18n/context`; `isValidLocale` de `lib/i18n/index`; `supabase` de `lib/supabase`.
- Produces: `function LocaleSync(): null` — componente sin UI que reconcilia `users.locale` con el provider.

- [ ] **Step 1: Crear LocaleSync (reconciliacion usuarios logueados)**

Lee `users.locale` con **fallback silencioso**: si la columna aun no existe (antes del ALTER), la query devuelve error y no se hace nada. Cumple la regla de sincronia.

```tsx
// app/components/LocaleSync.tsx
'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { isValidLocale } from '@/lib/i18n/index'
import { useSetLocale, LOCALE_STORAGE_KEY } from '@/lib/i18n/context'

export default function LocaleSync() {
  const setLocale = useSetLocale()

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data, error } = await supabase
        .from('users')
        .select('locale')
        .eq('id', user.id)
        .single()

      // Antes del ALTER la columna no existe -> error; no hacemos nada.
      if (error || !data || cancelled) return

      const remote = (data as { locale?: string }).locale
      if (isValidLocale(remote)) {
        setLocale(remote)
        try { localStorage.setItem(LOCALE_STORAGE_KEY, remote) } catch { /* noop */ }
      }
    }
    sync()
    return () => { cancelled = true }
  }, [setLocale])

  return null
}
```

- [ ] **Step 2: Montar el provider y LocaleSync en `app/layout.tsx`**

Agrega los imports al inicio del archivo (junto a los otros imports de componentes):

```tsx
import { I18nProvider } from '@/lib/i18n/context'
import LocaleSync from './components/LocaleSync'
```

Envuelve el contenido del `<body>` con `<I18nProvider>` y monta `<LocaleSync/>` justo dentro. El `<html lang="es">` se deja como esta (valor inicial de servidor); el provider lo actualiza en cliente via `document.documentElement.lang`. Reemplaza el bloque de `<body>` para que quede asi:

```tsx
      <body>
        <I18nProvider>
          <LocaleSync />
          <PostHogProvider>{children}</PostHogProvider>
          <SentryUser />
          <CosmeticBoundary zona="analytics">
            <AttributionCapture />
          </CosmeticBoundary>
          <FeedbackModal />
          <LegalGate />
          <CosmeticBoundary zona="banner-instalar">
            <InstallPrompt />
          </CosmeticBoundary>
```

(El resto del `<body>` — el `<Script id="sw-register">` y el cierre — se conserva; solo cierra el `</I18nProvider>` antes de `</body>`.)

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK, sin errores de tipos.

- [ ] **Step 4: Verificacion manual (local)**

Run: `npm run dev`
En `http://localhost:3000`, abre la consola del navegador y ejecuta:
```js
localStorage.setItem('anfiora_locale', 'en'); location.reload()
```
Expected: `document.documentElement.lang` pasa a `'en'` (verificar con `document.documentElement.lang` en consola). Regresa con `localStorage.setItem('anfiora_locale','es'); location.reload()`.

- [ ] **Step 5: Commit**

```bash
git add app/components/LocaleSync.tsx app/layout.tsx
git commit -m "feat(i18n): montar provider en layout raiz con html lang dinamico y LocaleSync"
```

---

## Task 6: Columna `users.locale` + helper de persistencia

**Files:**
- Create: `lib/i18n/persist.ts`
- Create: `docs/superpowers/plans/sql/2026-07-24-users-locale.sql` (para correr en Supabase; NO se ejecuta desde codigo)

**Interfaces:**
- Consumes: `supabase` de `lib/supabase`; `Locale` de `lib/i18n/index`.
- Produces: `async function saveUserLocale(locale: Locale): Promise<{ ok: boolean }>`

**Orden de despliegue (regla de sincronia):**
1. Esta tarea agrega el helper con fallback y se **pushea a main** primero.
2. El codigo que lee `users.locale` (LocaleSync de Task 5, perfil de Task 7) ya tolera que la columna no exista (error silencioso).
3. **Solo despues** se corre el SQL en Supabase.

- [ ] **Step 1: Escribir el SQL de migracion (documento, no ejecutar aun)**

```sql
-- docs/superpowers/plans/sql/2026-07-24-users-locale.sql
-- Correr en Supabase SQL Editor DESPUES de pushear el codigo de la Fase 1.
alter table public.users
  add column locale text not null default 'es';

alter table public.users
  add constraint users_locale_check check (locale in ('es', 'en'));
```

- [ ] **Step 2: Escribir el helper de persistencia**

```ts
// lib/i18n/persist.ts
import { supabase } from '@/lib/supabase'
import type { Locale } from './index'

export async function saveUserLocale(locale: Locale): Promise<{ ok: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { error } = await supabase
    .from('users')
    .update({ locale })
    .eq('id', user.id)

  // Antes del ALTER la columna no existe -> error; el idioma igual quedo
  // aplicado en el provider + localStorage, asi que no rompemos el flujo.
  return { ok: !error }
}
```

- [ ] **Step 3: Verificar build**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit (este commit es el que se pushea antes del ALTER)**

```bash
git add lib/i18n/persist.ts docs/superpowers/plans/sql/2026-07-24-users-locale.sql
git commit -m "feat(i18n): helper saveUserLocale y SQL de users.locale (correr tras push)"
```

- [ ] **Step 5: Checkpoint de despliegue (accion del humano)**

Tras pushear a `main` y verificar preview, correr el SQL del Step 1 en el SQL Editor de Supabase. Confirmar con:
```sql
select column_name, column_default from information_schema.columns
where table_schema='public' and table_name='users' and column_name='locale';
```
Expected: una fila `locale | 'es'::text`.

---

## Task 7: `LocaleSelector` + integracion en `/perfil`

**Files:**
- Create: `app/components/ui/LocaleSelector.tsx`
- Modify: `app/perfil/page.tsx` (leer `locale` en el load; render del selector)

**Interfaces:**
- Consumes: `useLocale`, `useSetLocale` de `lib/i18n/context`; `saveUserLocale` de `lib/i18n/persist`; `LOCALES`, `type Locale` de `lib/i18n/index`.
- Produces: `function LocaleSelector({ className }: { className?: string }): JSX.Element`

- [ ] **Step 1: Crear el componente segmentado (texto, sin banderas)**

```tsx
// app/components/ui/LocaleSelector.tsx
'use client'

import { useLocale, useSetLocale } from '@/lib/i18n/context'
import { saveUserLocale } from '@/lib/i18n/persist'
import { LOCALES, type Locale } from '@/lib/i18n/index'

const LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
}

export default function LocaleSelector({ className = '' }: { className?: string }) {
  const locale = useLocale()
  const setLocale = useSetLocale()

  const choose = (l: Locale) => {
    if (l === locale) return
    setLocale(l)
    void saveUserLocale(l)
  }

  return (
    <div className={`inline-flex rounded-[10px] border border-[#e0e0e0] bg-[#f8f8f8] p-0.5 ${className}`}>
      {LOCALES.map(l => {
        const active = l === locale
        return (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition
              ${active
                ? 'bg-white text-[#1D1E20] shadow-sm'
                : 'text-[#888] hover:text-[#1D1E20]'
              }`}
          >
            {LABELS[l]}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Leer `locale` en el load de `/perfil`**

En `app/perfil/page.tsx`, dentro del `load()` (linea ~138), agrega `locale` al select y reconcilia con el provider. Cambia el select y agrega el import + un `useSetLocale`:

Import (junto a los otros):
```tsx
import LocaleSelector from '@/app/components/ui/LocaleSelector'
import { useSetLocale } from '@/lib/i18n/context'
import { isValidLocale } from '@/lib/i18n/index'
```

Dentro del componente `PerfilPage`, cerca de los otros hooks:
```tsx
  const setLocale = useSetLocale()
```

Cambia el query del load:
```tsx
      const { data } = await supabase
        .from('users')
        .select('full_name, phone, plan, role, locale')
        .eq('id', user.id)
        .single()

      if (data) {
        setName(data.full_name || '')
        setPhone(data.phone || '')
        setPlan(data.plan || 'free')
        setRole(data.role || '')
        if (isValidLocale(data.locale)) setLocale(data.locale)
      }
```

- [ ] **Step 3: Renderizar el selector en la pagina**

Agrega una seccion de idioma en el JSX de `/perfil`, usando el mismo patron `Field` que ya existe en el archivo. Colocala junto a los datos de perfil (nombre/telefono):

```tsx
        <Field label="Idioma de la aplicación" hint="Afecta los menús y textos de tu cuenta.">
          <LocaleSelector />
        </Field>
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: OK.

- [ ] **Step 5: Verificacion manual (local, tras correr el SQL de Task 6)**

Run: `npm run dev`
En `/perfil`: cambiar a `English`, recargar la pagina -> el selector sigue en English (persistio en `users.locale`). En Supabase, `select locale from users where id = '<tu-id>'` -> `en`. Regresar a Español.

- [ ] **Step 6: Commit**

```bash
git add app/components/ui/LocaleSelector.tsx app/perfil/page.tsx
git commit -m "feat(i18n): selector de idioma en perfil con persistencia"
```

---

## Task 8: Toggle de idioma en el menu de usuario del layout de evento

**Files:**
- Modify: `app/events/[id]/layout.tsx` (agregar el toggle de idioma al dropdown de avatar, en ambas copias: `AvatarDropdown` desktop y el dropdown mobile inline)

**Interfaces:**
- Consumes: `LocaleSelector` de `app/components/ui/LocaleSelector`.

- [ ] **Step 1: Importar el selector**

En `app/events/[id]/layout.tsx`, junto a los imports existentes:
```tsx
import LocaleSelector from '@/app/components/ui/LocaleSelector'
```

- [ ] **Step 2: Agregar la fila de idioma al `AvatarDropdown` (desktop)**

Dentro del componente `AvatarDropdown` (linea ~434), despues del boton "Enviar feedback" y antes del boton de logout, inserta:

```tsx
      <div className="border-t border-[#f0f0f0] px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Idioma</p>
        <LocaleSelector className="w-full" />
      </div>
```

- [ ] **Step 3: Agregar la misma fila al dropdown mobile inline**

En el header mobile (linea ~540, el bloque `avatarOpen && (...)`), inserta el mismo bloque antes del boton de logout:

```tsx
              <div className="border-t border-[#f0f0f0] px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Idioma</p>
                <LocaleSelector className="w-full" />
              </div>
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: OK.

- [ ] **Step 5: Verificacion manual (local)**

En un evento (`/events/<id>`), abrir el menu de avatar (desktop y mobile) -> aparece el toggle Español/English; cambiar idioma cambia el `<html lang>` y persiste al recargar.

- [ ] **Step 6: Commit**

```bash
git add app/events/[id]/layout.tsx
git commit -m "feat(i18n): toggle de idioma en el menu de usuario del evento"
```

---

## Task 9: Traducir el shell del layout de evento

**Files:**
- Modify: `app/events/[id]/layout.tsx`

**Interfaces:**
- Consumes: `useT`, `useLocale` de `lib/i18n/context`; `formatEventDateI18n` de `lib/i18n/format`; `type TKey` de `lib/i18n/es`.

Este task reemplaza las etiquetas hardcodeadas del shell por `t()`. Los `NAV_ITEMS` guardan **claves** en vez de texto; se localizan dentro del componente con `useMemo`.

- [ ] **Step 1: Cambiar `NAV_ITEMS` para que `label`/`labelMobile` sean claves de traduccion**

Reemplaza cada `label`/`labelMobile` string por su clave `TKey`. Cambia tambien los tipos `NavItem`/`NavGroup`/`NavSubItem` para tipar `label`/`labelMobile` como `TKey`. Ejemplo del primer item y un grupo (aplica el mismo patron a todos):

```tsx
import type { TKey } from '@/lib/i18n/es'

type NavSubItem = {
  label: TKey
  labelMobile?: TKey
  path: string
  iconOutline: React.ReactNode
  iconFilled: React.ReactNode
}

type NavItem = {
  type: 'item'
  label: TKey
  labelMobile: TKey
  path: string
  adminOnly: boolean
  iconOutline: React.ReactNode
  iconFilled: React.ReactNode
}

type NavGroup = {
  type: 'group'
  label: TKey
  labelMobile: TKey
  defaultPath: string
  iconOutline: React.ReactNode
  iconFilled: React.ReactNode
  children: NavSubItem[]
}
```

Mapa de reemplazos de `NAV_ITEMS` (label -> clave):
- Invitados -> `'nav.invitados'` (mobile `'nav.invitados'`)
- Invitación -> `'nav.invitacion'`
- Mensajes -> `'nav.mensajes'`
- Mesas -> `'nav.mesas'`
- Timeline -> `'nav.timeline'`
- Comida -> `'nav.comida'`
- Mesa de regalos -> `'nav.mesaRegalos'` (mobile `'nav.mesaRegalosMobile'`)
- Finanzas (grupo) -> `'nav.finanzas'`; hijos: `'nav.presupuesto'`, `'nav.proveedores'`, `'nav.pagos'`
- Recuerdos (grupo) -> `'nav.recuerdos'`; hijos: `'nav.album'`, `'nav.playlist'`
- Estilo (grupo) -> `'nav.estilo'`; hijo Dress code -> `'nav.dressCode'` (mobile `'nav.dressCode'`)
- Configuracion -> `'nav.configuracion'` (mobile `'nav.configuracionMobile'`)

- [ ] **Step 2: Localizar las entradas dentro del componente**

Dentro de `EventLayoutInner`, agrega los hooks y un `useMemo` que traduce las etiquetas justo antes de `filterNavByFeatures`. Reemplaza el uso de `NAV_ITEMS` por la version localizada:

```tsx
  const t = useT()
  const locale = useLocale()

  const localizedNav = useMemo<NavEntry[]>(() => {
    const localizeEntry = (entry: NavEntry): NavEntry => {
      if (entry.type === 'item') {
        return { ...entry, label: t(entry.label) as unknown as TKey, labelMobile: t(entry.labelMobile) as unknown as TKey }
      }
      return {
        ...entry,
        label: t(entry.label) as unknown as TKey,
        labelMobile: t(entry.labelMobile) as unknown as TKey,
        children: entry.children.map(c => ({
          ...c,
          label: t(c.label) as unknown as TKey,
          ...(c.labelMobile ? { labelMobile: t(c.labelMobile) as unknown as TKey } : {}),
        })),
      }
    }
    return NAV_ITEMS.map(localizeEntry)
  }, [t])
```

> Nota de tipos: los builders (`buildMobileItems`, `renderSidebarItem`, etc.) esperan `string` para pintar. Como `TKey` es `string`, el texto ya traducido se renderiza tal cual. El `as unknown as TKey` mantiene la forma del tipo `NavEntry` sin reescribir los builders. Alternativa mas limpia si el revisor lo prefiere: cambiar `label`/`labelMobile` de los builders a `string` y guardar el texto traducido en un tipo `LocalizedNavEntry` aparte; documentar la eleccion.

Reemplaza la construccion de `visibleEntries` para partir de `localizedNav`:
```tsx
  const visibleEntries = filterNavByFeatures(
    localizedNav.filter(entry =>
      entry.type === 'item' ? (!entry.adminOnly || canAdmin) : true
    ),
    features,
  )
```

- [ ] **Step 3: Localizar `EVENT_TYPE_LABELS` y `EVENT_STATUS_STYLES`**

Estos mapas viven a nivel de modulo con texto fijo. Deja los estilos (colores) en el mapa y saca el texto a claves. Reemplaza los usos:

- `EVENT_TYPE_LABELS[event.event_type]` (lineas ~584 y ~717) por:
```tsx
  {t(`eventType.${event.event_type}` as TKey)}
```
- El `label` de `EVENT_STATUS_STYLES[displayStatus]` (badge, linea ~591): reemplaza `badgeStyle.label` por:
```tsx
  {t(`eventStatus.${displayStatus}` as TKey)}
```
(Elimina la propiedad `label` de `EVENT_STATUS_STYLES` o dejala sin usar; el color `dot`/`badge` se conserva.)

- [ ] **Step 4: Localizar textos sueltos del shell**

Reemplazar cada literal por su `t()`:
- `'Cargando...'` (linea ~424) -> `{t('common.loading')}`
- `'Mi cuenta'` (varias) -> `{t('userMenu.account')}` (usar en `userName || t('userMenu.account')`)
- `'Mi perfil'` -> `{t('userMenu.profile')}`
- `'Enviar feedback'` -> `{t('userMenu.feedback')}`
- `'Cerrar sesion'` -> `{t('userMenu.logout')}`
- `'Mis eventos'` (linea ~603) -> `{t('layout.myEvents')}`
- `'Inicio'` (bottom nav, linea ~770) -> `{t('layout.home')}`
- `title={collapsed ? 'Expandir' : 'Colapsar'}` (linea ~697) -> `title={collapsed ? t('layout.expand') : t('layout.collapse')}`
- `<span ...>Colapsar</span>` (linea ~703) -> `{t('layout.collapse')}`

- [ ] **Step 5: Localizar la fecha del evento en el header**

Reemplaza las dos llamadas a `formatEventDate(event.event_date, event.event_end_date)` (lineas ~595 y ~721) por la version con locale:
```tsx
import { formatEventDateI18n } from '@/lib/i18n/format'
// ...
  {formatEventDateI18n(event.event_date, event.event_end_date, locale)}
```
(Puedes quitar el import de `formatEventDate` de `@/lib/types` si ya no se usa en este archivo.)

- [ ] **Step 6: Verificar build**

Run: `npm run build`
Expected: OK. Si `tsc` marca una clave inexistente en algun `t(...)`, corrige la clave (es la red de seguridad funcionando).

- [ ] **Step 7: Verificacion manual (local)**

Run: `npm run dev`
En un evento: con idioma en English, el sidebar, bottom nav, headers, tipo/estado del evento, menu de usuario y la fecha del header aparecen en ingles. Cambiar a Español revierte todo. Colapsar/expandir sidebar mantiene traducciones.

- [ ] **Step 8: Commit**

```bash
git add app/events/[id]/layout.tsx
git commit -m "feat(i18n): shell del layout de evento bilingue es/en"
```

---

## Self-Review (hecho al escribir el plan)

**Cobertura del spec Fase 1:**
- Motor `lib/i18n` (index, format, es, en, context) -> Tasks 1-4. ✓
- `users.locale` (columna dedicada, check, orden de despliegue) -> Task 6. ✓
- Provider en layout raiz + `<html lang>` dinamico + espejo localStorage -> Tasks 4-5. ✓
- Selector en `/perfil` + menu de usuario -> Tasks 7-8. ✓
- Shell migrado (layout evento, sidebar, bottom nav, menu usuario) -> Task 9. ✓
- Red de seguridad tipada (falta clave = build truena) -> Task 3 Step 3 lo prueba explicitamente. ✓
- Reglas: sin emojis/banderas (Task 7 texto), fecha/numero por Intl (Task 2), fallback pre-ALTER (Tasks 5/6). ✓

**Placeholder scan:** sin TBD/TODO; todo el codigo nuevo esta completo. Los edits a archivos existentes citan lineas reales y muestran el codigo a insertar.

**Consistencia de tipos:** `translate(dict,key,params,locale)` mismo orden en index/context. `Locale`, `TKey`, `Node`, `saveUserLocale`, `formatEventDateI18n`, `formatNumberI18n` usados con la misma firma en todos los tasks. `LOCALE_STORAGE_KEY` definido en context (Task 4) y consumido en Task 5.

**Fuera de alcance (confirmado):** `events.locale` y todo lo saliente -> Fase 5 (avisar a Diego). Superficies del invitado -> feature aparte. Modulos internos (dashboard, invitados, finanzas, etc.) -> Fases 2-4.
```
