# Invitación — Editor de diseño · Fase 1 (Fundaciones de tema) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una capa de **tema** (tokens de diseño) sobre el motor de bloques de la invitación, con un registro de 21 Vibes, migración tolerante v1→v2, carga dinámica de Google Fonts y render que consume los tokens vía CSS variables — dejando el look actual como Vibe default (`anfiora-claro`).

**Architecture:** El `InviteDoc` gana un campo `theme`. Un `ThemeProvider` traduce el tema a CSS variables + clases de fuente que envuelven el `InvitacionRenderer` compartido (editor y público). Las secciones dejan de hardcodear color/fuente y leen las CSS variables. Toda la lógica pura (schema, registro de vibes, resolución/migración, mapeo a CSS, URL de fuentes) va con tests Vitest; la UI se verifica manual en el dev server.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Zod, Vitest, Google Fonts (vía `<link>` dinámico).

## Global Constraints

- Tests con **Vitest** solo para lógica pura (`npm test`). UI/render se verifica **manual** en dev server (`localhost:3007` en este worktree) — flujo local → preview → main.
- **Retrocompatibilidad total:** un `InviteDoc` viejo (sin `theme`, `v:1`) debe seguir funcionando, resolviendo al Vibe default `anfiora-claro`. Nunca romper docs existentes.
- **Sin tablas nuevas** en Supabase. `theme` vive dentro de `event_settings.invite_config` (JSONB, ya existe). Cero ALTER en esta fase.
- **Fuentes:** solo Google Fonts gratis, `display: swap`, cargar únicamente las familias usadas por el doc.
- UI en español, con acentos. Commits convencionales **sin acentos ni ñ**. Sin emojis en UI.
- Color botón CTA de Anfiora real: `#48C9B0`. Botón Anfiora = **redondo (~10px) + sombra suave teal**, NO pill.
- Design tokens/estilo: flat, limpio; no inline styles salvo lo justificado (aquí las CSS variables del tema son la excepción justificada).

---

## File Structure

- `lib/invite/theme.ts` — **crear.** Tipos + Zod del `Theme`, `ThemeId`/`VibeId`, enums de botón/fondo/animación, `DEFAULT_THEME`.
- `lib/invite/vibes.ts` — **crear.** Registro de los 21 Vibes (data), `getVibe(id)`, `VIBES`, `VIBE_IDS`.
- `lib/invite/schema.ts` — **modificar.** `InviteDoc` gana `theme`, bump `v` a 2 (tolerante).
- `lib/invite/doc.ts` — **modificar.** `resolveDoc` resuelve/migra `theme`; `defaultDoc` incluye `theme`.
- `lib/invite/theme-css.ts` — **crear.** `themeCssVars(theme)` → objeto de CSS variables; `botonClass(theme)` → className; `fontFamilyCss(fontId)`.
- `lib/invite/fonts.ts` — **crear.** Catálogo de fuentes (id → familia Google + axes) y `googleFontsHref(fontIds)`.
- `app/components/invitacion/ThemeProvider.tsx` — **crear.** Envuelve el render, aplica CSS vars + monta `<link>` de fuentes.
- `app/components/invitacion/InvitacionRenderer.tsx` — **modificar.** Envolver output en `ThemeProvider` usando `doc.theme`.
- `app/components/invitacion/SectionShell.tsx` — **modificar.** Fondo del `<section>` desde CSS var.
- `app/components/invitacion/sections/*.tsx` — **modificar (11 archivos).** Reemplazar colores/fuentes hardcodeados por CSS vars.
- `app/globals.css` — **modificar.** Clases de estilo de botón del tema (`.inv-btn-*`) y fallback de CSS vars.
- Tests: `lib/invite/theme.test.ts`, `lib/invite/vibes.test.ts`, `lib/invite/doc.test.ts` (existe — extender), `lib/invite/theme-css.test.ts`, `lib/invite/fonts.test.ts`.

---

## Task 1: Tipos + Zod del Theme

**Files:**
- Create: `lib/invite/theme.ts`
- Test: `lib/invite/theme.test.ts`

**Interfaces:**
- Produces:
  - `type VibeCategory = 'elegantes'|'celebracion'|'retro'|'musica'|'temporada'`
  - `type ButtonForma = 'pill'|'redondo'|'recto'`
  - `type ButtonEstilo = 'relleno'|'contorno'|'degradado'|'elevado'|'retro3d'|'neon'|'cromo'`
  - `type FondoTipo = 'solido'|'gradiente'|'imagen'|'animado'`
  - `type EffectId` (union de strings de efectos + `'none'`)
  - `type SiAnimId`, `type NoAnimId`
  - `ThemeSchema` (Zod) y `type Theme = z.infer<typeof ThemeSchema>`
  - `DEFAULT_THEME: Theme`
  - `ThemeColorsSchema`, `ThemeFontsSchema`, `ThemeBotonSchema`, `ThemeFondoSchema`, `ThemeAnimSchema`

- [ ] **Step 1: Write the failing test**

```ts
// lib/invite/theme.test.ts
import { describe, it, expect } from 'vitest'
import { ThemeSchema, DEFAULT_THEME } from './theme'

describe('ThemeSchema', () => {
  it('parses the default theme unchanged', () => {
    const parsed = ThemeSchema.parse(DEFAULT_THEME)
    expect(parsed.vibeId).toBe('anfiora-claro')
    expect(parsed.colores.acento).toBe('#48C9B0')
    expect(parsed.boton.forma).toBe('redondo')
  })

  it('fills defaults for a partial theme', () => {
    const parsed = ThemeSchema.parse({ vibeId: 'fiesta' })
    expect(parsed.vibeId).toBe('fiesta')
    expect(parsed.colores.fondo).toBeTypeOf('string')
    expect(parsed.fonts.cuerpo).toBeTypeOf('string')
    expect(parsed.boton.estilo).toBeTypeOf('string')
  })

  it('rejects an invalid button forma', () => {
    const bad = { ...DEFAULT_THEME, boton: { forma: 'circulo', estilo: 'relleno' } }
    expect(ThemeSchema.safeParse(bad).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/invite/theme.test.ts`
Expected: FAIL — `Cannot find module './theme'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/invite/theme.ts
import { z } from 'zod'

export const VIBE_CATEGORIES = ['elegantes', 'celebracion', 'retro', 'musica', 'temporada'] as const
export type VibeCategory = (typeof VIBE_CATEGORIES)[number]

export const BUTTON_FORMAS = ['pill', 'redondo', 'recto'] as const
export type ButtonForma = (typeof BUTTON_FORMAS)[number]

export const BUTTON_ESTILOS = ['relleno', 'contorno', 'degradado', 'elevado', 'retro3d', 'neon', 'cromo'] as const
export type ButtonEstilo = (typeof BUTTON_ESTILOS)[number]

export const FONDO_TIPOS = ['solido', 'gradiente', 'imagen', 'animado'] as const
export type FondoTipo = (typeof FONDO_TIPOS)[number]

export const EFFECT_IDS = [
  'none', 'gradiente-vivo', 'confeti', 'grid-synthwave', 'estrellas', 'olas', 'bokeh',
  'petalos', 'hojas', 'papel-cuaderno', 'papel-cuadricula', 'aurora', 'halftone', 'papel-arrugado',
] as const
export type EffectId = (typeof EFFECT_IDS)[number]

export const SI_ANIM_IDS = [
  'confeti', 'corazones', 'destellos', 'fuegos', 'globos', 'emojis', 'champan', 'arcade', 'jackpot', 'bola-disco', 'estrellas',
] as const
export type SiAnimId = (typeof SI_ANIM_IDS)[number]

export const NO_ANIM_IDS = [
  'calido', 'lluvia', 'luces-off', 'corazon-roto', 'matorral', 'nevada', 'scratch',
] as const
export type NoAnimId = (typeof NO_ANIM_IDS)[number]

export const ThemeColorsSchema = z.object({
  fondo: z.string().default('#ffffff'),
  texto: z.string().default('#1D1E20'),
  acento: z.string().default('#48C9B0'),
  botonBg: z.string().default('#48C9B0'),
  botonTexto: z.string().default('#ffffff'),
})

export const ThemeFontsSchema = z.object({
  titulo: z.string().default('josefin-sans'),
  cuerpo: z.string().default('general-sans'),
})

export const ThemeBotonSchema = z.object({
  forma: z.enum(BUTTON_FORMAS).default('redondo'),
  estilo: z.enum(BUTTON_ESTILOS).default('elevado'),
})

export const ThemeFondoSchema = z.object({
  tipo: z.enum(FONDO_TIPOS).default('solido'),
  efectoId: z.enum(EFFECT_IDS).default('none'),
})

export const ThemeAnimSchema = z.object({
  si: z.enum(SI_ANIM_IDS).default('confeti'),
  no: z.enum(NO_ANIM_IDS).default('calido'),
})

export const ThemeSchema = z.object({
  vibeId: z.string().default('anfiora-claro'),
  colores: ThemeColorsSchema.default(() => ThemeColorsSchema.parse({})),
  fonts: ThemeFontsSchema.default(() => ThemeFontsSchema.parse({})),
  boton: ThemeBotonSchema.default(() => ThemeBotonSchema.parse({})),
  fondo: ThemeFondoSchema.default(() => ThemeFondoSchema.parse({})),
  anim: ThemeAnimSchema.default(() => ThemeAnimSchema.parse({})),
  copy: z.record(z.string(), z.string()).default({}),
})

export type Theme = z.infer<typeof ThemeSchema>

export const DEFAULT_THEME: Theme = ThemeSchema.parse({
  vibeId: 'anfiora-claro',
  colores: { fondo: '#ffffff', texto: '#1D1E20', acento: '#48C9B0', botonBg: '#48C9B0', botonTexto: '#ffffff' },
  fonts: { titulo: 'josefin-sans', cuerpo: 'general-sans' },
  boton: { forma: 'redondo', estilo: 'elevado' },
  fondo: { tipo: 'solido', efectoId: 'none' },
  anim: { si: 'confeti', no: 'calido' },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/invite/theme.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/invite/theme.ts lib/invite/theme.test.ts
git commit -m "feat(invitacion): tipos y schema Zod del theme"
```

---

## Task 2: Registro de los 21 Vibes

**Files:**
- Create: `lib/invite/vibes.ts`
- Test: `lib/invite/vibes.test.ts`

**Interfaces:**
- Consumes (de Task 1): `Theme`, `ThemeSchema`, `VibeCategory`.
- Produces:
  - `type Vibe = { id: string; nombre: string; categoria: VibeCategory; theme: Theme }`
  - `VIBES: Vibe[]` (21 entradas)
  - `VIBE_IDS: string[]`
  - `getVibe(id: string): Vibe` (cae a `anfiora-claro` si no existe)
  - `VIBES_BY_CATEGORY: Record<VibeCategory, Vibe[]>`

- [ ] **Step 1: Write the failing test**

```ts
// lib/invite/vibes.test.ts
import { describe, it, expect } from 'vitest'
import { VIBES, VIBE_IDS, getVibe } from './vibes'
import { ThemeSchema } from './theme'

describe('vibes registry', () => {
  it('has 21 vibes with unique ids', () => {
    expect(VIBES).toHaveLength(21)
    expect(new Set(VIBE_IDS).size).toBe(21)
  })

  it('every vibe theme parses against ThemeSchema and its vibeId matches its id', () => {
    for (const v of VIBES) {
      expect(() => ThemeSchema.parse(v.theme)).not.toThrow()
      expect(v.theme.vibeId).toBe(v.id)
    }
  })

  it('getVibe returns anfiora-claro for unknown ids', () => {
    expect(getVibe('no-existe').id).toBe('anfiora-claro')
    expect(getVibe('fiesta').id).toBe('fiesta')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/invite/vibes.test.ts`
Expected: FAIL — `Cannot find module './vibes'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/invite/vibes.ts
import { ThemeSchema, type Theme, type VibeCategory } from './theme'

export type Vibe = { id: string; nombre: string; categoria: VibeCategory; theme: Theme }

function v(
  id: string, nombre: string, categoria: VibeCategory,
  t: {
    fondo: string; texto: string; acento: string; botonBg: string; botonTexto: string
    titulo: string; forma: Theme['boton']['forma']; estilo: Theme['boton']['estilo']
    fondoTipo?: Theme['fondo']['tipo']; efecto?: Theme['fondo']['efectoId']
    si?: Theme['anim']['si']; no?: Theme['anim']['no']
  },
): Vibe {
  const theme = ThemeSchema.parse({
    vibeId: id,
    colores: { fondo: t.fondo, texto: t.texto, acento: t.acento, botonBg: t.botonBg, botonTexto: t.botonTexto },
    fonts: { titulo: t.titulo, cuerpo: 'general-sans' },
    boton: { forma: t.forma, estilo: t.estilo },
    fondo: { tipo: t.fondoTipo ?? 'solido', efectoId: t.efecto ?? 'none' },
    anim: { si: t.si ?? 'confeti', no: t.no ?? 'calido' },
  })
  return { id, nombre, categoria, theme }
}

export const VIBES: Vibe[] = [
  // elegantes
  v('anfiora-claro', 'Anfiora Claro', 'elegantes', { fondo: '#ffffff', texto: '#1D1E20', acento: '#48C9B0', botonBg: '#48C9B0', botonTexto: '#ffffff', titulo: 'josefin-sans', forma: 'redondo', estilo: 'elevado', si: 'confeti', no: 'calido' }),
  v('anfiora-noche', 'Anfiora Noche', 'elegantes', { fondo: '#1D1E20', texto: '#f5f5f5', acento: '#F4C430', botonBg: '#48C9B0', botonTexto: '#1D1E20', titulo: 'josefin-sans', forma: 'redondo', estilo: 'elevado', fondoTipo: 'animado', efecto: 'estrellas', si: 'destellos', no: 'calido' }),
  v('romantico', 'Romántico', 'elegantes', { fondo: 'linear-gradient(160deg,#fbe9ec,#eabfce)', texto: '#8a4a5e', acento: '#c76b86', botonBg: '#c76b86', botonTexto: '#ffffff', titulo: 'playfair-display-italic', forma: 'pill', estilo: 'relleno', fondoTipo: 'gradiente', si: 'corazones', no: 'corazon-roto' }),
  v('botanico', 'Botánico', 'elegantes', { fondo: 'linear-gradient(160deg,#e8efe0,#d3e0c4)', texto: '#3f5335', acento: '#6b8455', botonBg: '#6b8455', botonTexto: '#ffffff', titulo: 'cormorant-garamond', forma: 'pill', estilo: 'relleno', fondoTipo: 'gradiente', si: 'confeti', no: 'calido' }),
  v('dorado', 'Dorado clásico', 'elegantes', { fondo: 'linear-gradient(160deg,#faf6ec,#f0e4c8)', texto: '#7a5f24', acento: '#b8912f', botonBg: '#b8912f', botonTexto: '#ffffff', titulo: 'cinzel', forma: 'recto', estilo: 'relleno', fondoTipo: 'gradiente', si: 'champan', no: 'calido' }),
  // celebracion
  v('fiesta', 'Fiesta', 'celebracion', { fondo: 'linear-gradient(135deg,#6a2cf5,#c336d6 55%,#ff5e8a)', texto: '#ffffff', acento: '#ffe600', botonBg: '#ffe600', botonTexto: '#6a2cf5', titulo: 'bungee-inline', forma: 'pill', estilo: 'elevado', fondoTipo: 'animado', efecto: 'gradiente-vivo', si: 'emojis', no: 'matorral' }),
  v('xv', 'XV años', 'celebracion', { fondo: 'linear-gradient(160deg,#fdeef3,#f6cfe0 60%,#e9b6cf)', texto: '#9b4a72', acento: '#d98bb3', botonBg: '#d98bb3', botonTexto: '#ffffff', titulo: 'great-vibes', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'gradiente-vivo', si: 'corazones', no: 'corazon-roto' }),
  v('playa', 'Playa', 'celebracion', { fondo: 'linear-gradient(180deg,#7ec8e3,#b8e0d2 55%,#f4e4c1)', texto: '#0d5a6e', acento: '#e08a5b', botonBg: '#e08a5b', botonTexto: '#ffffff', titulo: 'pacifico', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'olas', si: 'confeti', no: 'lluvia' }),
  v('kids', 'Kids', 'celebracion', { fondo: 'linear-gradient(135deg,#ffd93d,#ff8fab 60%,#8ac6ff)', texto: '#3a2a5a', acento: '#3a2a5a', botonBg: '#3a2a5a', botonTexto: '#ffffff', titulo: 'baloo-2', forma: 'redondo', estilo: 'retro3d', fondoTipo: 'animado', efecto: 'confeti', si: 'globos', no: 'matorral' }),
  // retro
  v('70s', 'Setentas', 'retro', { fondo: 'linear-gradient(160deg,#e8a13c,#c65f2e 55%,#7a3b1e)', texto: '#fdf0d5', acento: '#fdf0d5', botonBg: '#fdf0d5', botonTexto: '#c65f2e', titulo: 'rowdies', forma: 'pill', estilo: 'retro3d', fondoTipo: 'animado', efecto: 'gradiente-vivo', si: 'confeti', no: 'matorral' }),
  v('80s', 'Ochentas', 'retro', { fondo: '#140a2e', texto: '#ffffff', acento: '#00e5ff', botonBg: '#00e5ff', botonTexto: '#140a2e', titulo: 'audiowide', forma: 'recto', estilo: 'neon', fondoTipo: 'animado', efecto: 'grid-synthwave', si: 'arcade', no: 'luces-off' }),
  v('90s', 'Noventas', 'retro', { fondo: '#14b5b0', texto: '#ffffff', acento: '#ffe600', botonBg: '#ff5ea3', botonTexto: '#ffffff', titulo: 'titan-one', forma: 'recto', estilo: 'retro3d', fondoTipo: 'animado', efecto: 'halftone', si: 'emojis', no: 'scratch' }),
  v('y2k', 'Y2K', 'retro', { fondo: 'linear-gradient(135deg,#c0c0ff,#e6b3ff 55%,#b3f0ff)', texto: '#5a2a8a', acento: '#7a3bd4', botonBg: '#7a3bd4', botonTexto: '#ffffff', titulo: 'orbitron', forma: 'pill', estilo: 'cromo', fondoTipo: 'animado', efecto: 'grid-synthwave', si: 'jackpot', no: 'luces-off' }),
  // musica
  v('rock', 'Rock and roll', 'musica', { fondo: '#0a0a0a', texto: '#ffffff', acento: '#e11d1d', botonBg: '#e11d1d', botonTexto: '#ffffff', titulo: 'anton', forma: 'recto', estilo: 'relleno', si: 'fuegos', no: 'scratch' }),
  v('disco', 'Disco', 'musica', { fondo: 'radial-gradient(circle at 50% 30%,#3a2a6a,#0a0620)', texto: '#f0d97a', acento: '#e0c04a', botonBg: 'linear-gradient(90deg,#ff2e97,#39ff88)', botonTexto: '#1a1030', titulo: 'monoton', forma: 'pill', estilo: 'degradado', fondoTipo: 'animado', efecto: 'bokeh', si: 'bola-disco', no: 'luces-off' }),
  v('electro', 'Electrónica', 'musica', { fondo: '#03060a', texto: '#39ff88', acento: '#2ee0ff', botonBg: '#39ff88', botonTexto: '#03060a', titulo: 'michroma', forma: 'recto', estilo: 'neon', fondoTipo: 'animado', efecto: 'bokeh', si: 'estrellas', no: 'luces-off' }),
  v('jazz', 'Jazz / lounge', 'musica', { fondo: 'linear-gradient(160deg,#1a1230,#3a1f2e)', texto: '#e8c98a', acento: '#c99a4a', botonBg: 'transparent', botonTexto: '#e8c98a', titulo: 'limelight', forma: 'pill', estilo: 'contorno', fondoTipo: 'animado', efecto: 'estrellas', si: 'champan', no: 'calido' }),
  // temporada
  v('verano', 'Verano', 'temporada', { fondo: 'linear-gradient(160deg,#ffd75e,#ff9a52 55%,#ff6f91)', texto: '#ffffff', acento: '#ff7a52', botonBg: '#ffffff', botonTexto: '#ff7a52', titulo: 'quicksand', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'gradiente-vivo', si: 'confeti', no: 'lluvia' }),
  v('primavera', 'Primavera', 'temporada', { fondo: 'linear-gradient(160deg,#fce4ef,#e8f3d4 60%,#d4ecdf)', texto: '#6a7a4a', acento: '#c76b9b', botonBg: '#e79ac0', botonTexto: '#ffffff', titulo: 'cormorant-garamond-italic', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'petalos', si: 'corazones', no: 'calido' }),
  v('otono', 'Otoño', 'temporada', { fondo: 'linear-gradient(160deg,#e0a24a,#b5532a 55%,#7a2f1e)', texto: '#fdeccd', acento: '#fdeccd', botonBg: '#fdeccd', botonTexto: '#b5532a', titulo: 'prata', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'hojas', si: 'confeti', no: 'calido' }),
  v('invierno', 'Invierno', 'temporada', { fondo: 'linear-gradient(160deg,#eaf3f8,#c7dced 55%,#9db9d4)', texto: '#2a4a6a', acento: '#5a7a9a', botonBg: '#2a4a6a', botonTexto: '#eaf3f8', titulo: 'bodoni-moda', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'estrellas', si: 'destellos', no: 'nevada' }),
]

export const VIBE_IDS = VIBES.map(x => x.id)

const BY_ID = new Map(VIBES.map(x => [x.id, x]))
export function getVibe(id: string): Vibe {
  return BY_ID.get(id) ?? BY_ID.get('anfiora-claro')!
}

export const VIBES_BY_CATEGORY = VIBES.reduce((acc, x) => {
  ;(acc[x.categoria] ??= []).push(x)
  return acc
}, {} as Record<VibeCategory, Vibe[]>)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/invite/vibes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/invite/vibes.ts lib/invite/vibes.test.ts
git commit -m "feat(invitacion): registro de 21 vibes con tokens de tema"
```

---

## Task 3: InviteDoc v2 + migración tolerante del theme

**Files:**
- Modify: `lib/invite/schema.ts` (InviteDocSchema)
- Modify: `lib/invite/doc.ts` (`defaultDoc`, `resolveDoc`)
- Test: `lib/invite/doc.test.ts` (existe — agregar casos)

**Interfaces:**
- Consumes: `ThemeSchema`, `DEFAULT_THEME` (Task 1).
- Produces: `InviteDoc` con `theme: Theme` y `v: 2`. `resolveDoc` sigue con la misma firma `(raw, makeId) => InviteDoc`.

- [ ] **Step 1: Write the failing test** (agregar al final de `lib/invite/doc.test.ts`)

```ts
import { resolveDoc, defaultDoc } from './doc'
import { DEFAULT_THEME } from './theme'

describe('resolveDoc theme migration', () => {
  let n = 0
  const makeId = () => `id-${n++}`

  it('defaultDoc includes the default theme and v2', () => {
    const d = defaultDoc(makeId)
    expect(d.v).toBe(2)
    expect(d.theme.vibeId).toBe('anfiora-claro')
  })

  it('a v1 doc without theme resolves to the default theme, keeping sections', () => {
    const v1 = { v: 1, meta: { publicada: true, fecha_limite: null }, sections: [
      { id: 'a', type: 'portada', content: { kicker: '', titulo: 'Ana', subtitulo: '' } },
    ] }
    const d = resolveDoc(v1, makeId)
    expect(d.theme.vibeId).toBe(DEFAULT_THEME.vibeId)
    expect(d.sections.find(s => s.type === 'portada')).toBeTruthy()
    expect(d.meta.publicada).toBe(true)
  })

  it('preserves a valid custom theme', () => {
    const doc = { v: 2, meta: { publicada: false, fecha_limite: null }, theme: { vibeId: 'fiesta', colores: { fondo: '#000000', texto: '#fff', acento: '#ffe600', botonBg: '#ffe600', botonTexto: '#000' }, boton: { forma: 'pill', estilo: 'elevado' } }, sections: [
      { id: 'a', type: 'portada', content: { kicker: '', titulo: 'X', subtitulo: '' } },
    ] }
    const d = resolveDoc(doc, makeId)
    expect(d.theme.vibeId).toBe('fiesta')
    expect(d.theme.colores.fondo).toBe('#000000')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/invite/doc.test.ts`
Expected: FAIL — `defaultDoc` no expone `theme`; `d.v` es 1.

- [ ] **Step 3a: Modify `lib/invite/schema.ts`**

Agregar el import y el campo `theme` al `InviteDocSchema`, y subir `v` a 2:

```ts
// arriba, junto a los otros imports
import { ThemeSchema } from './theme'

// reemplazar InviteDocSchema por:
export const InviteDocSchema = z.object({
  v: z.literal(2).default(2),
  meta: MetaSchema.default(() => MetaSchema.parse({})),
  theme: ThemeSchema.default(() => ThemeSchema.parse({})),
  sections: z.array(SectionSchema).default([]),
})
```

- [ ] **Step 3b: Modify `lib/invite/doc.ts`**

```ts
// nuevo import arriba
import { ThemeSchema, DEFAULT_THEME } from './theme'

// reemplazar defaultDoc:
export function defaultDoc(makeId: () => string): InviteDoc {
  return {
    v: 2,
    meta: MetaSchema.parse({}),
    theme: DEFAULT_THEME,
    sections: DEFAULT_ORDER.map(t => emptySection(t, makeId())),
  }
}

// dentro de resolveDoc, reemplazar el return final por:
  const themeParsed = ThemeSchema.safeParse((r as Record<string, unknown>).theme)
  const theme = themeParsed.success ? themeParsed.data : DEFAULT_THEME
  return { v: 2, meta, theme, sections }
```

Nota: `InviteMeta`/`Section` imports ya existen. `InviteDoc` type se re-infiere del schema, no requiere cambio en `types.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/invite/doc.test.ts`
Expected: PASS (casos previos + 3 nuevos).

- [ ] **Step 5: Commit**

```bash
git add lib/invite/schema.ts lib/invite/doc.ts lib/invite/doc.test.ts
git commit -m "feat(invitacion): InviteDoc v2 con theme y migracion tolerante"
```

---

## Task 4: Mapeo Theme → CSS variables + clase de botón

**Files:**
- Create: `lib/invite/theme-css.ts`
- Test: `lib/invite/theme-css.test.ts`

**Interfaces:**
- Consumes: `Theme` (Task 1), catálogo de fuentes (`fontFamilyStack` de Task 5 — para evitar dependencia circular, aquí solo mapear el **id** de fuente a una CSS var `--inv-font-titulo`; la familia real la resuelve `ThemeProvider` con `fonts.ts`).
- Produces:
  - `themeCssVars(theme: Theme): Record<string, string>` → `{ '--inv-fondo': ..., '--inv-texto': ..., '--inv-acento': ..., '--inv-boton-bg': ..., '--inv-boton-texto': ..., '--inv-boton-radius': ..., '--inv-font-titulo-id': ..., '--inv-font-cuerpo-id': ... }`
  - `botonClass(theme: Theme): string` → `'inv-btn inv-btn-<estilo>'`
  - `FORMA_RADIUS: Record<ButtonForma, string>`

- [ ] **Step 1: Write the failing test**

```ts
// lib/invite/theme-css.test.ts
import { describe, it, expect } from 'vitest'
import { themeCssVars, botonClass } from './theme-css'
import { DEFAULT_THEME } from './theme'

describe('theme-css', () => {
  it('maps colors and radius to CSS variables', () => {
    const vars = themeCssVars(DEFAULT_THEME)
    expect(vars['--inv-fondo']).toBe('#ffffff')
    expect(vars['--inv-acento']).toBe('#48C9B0')
    expect(vars['--inv-boton-radius']).toBe('10px') // redondo
  })

  it('uses pill radius for pill buttons', () => {
    const vars = themeCssVars({ ...DEFAULT_THEME, boton: { forma: 'pill', estilo: 'relleno' } })
    expect(vars['--inv-boton-radius']).toBe('999px')
  })

  it('botonClass includes the estilo modifier', () => {
    expect(botonClass(DEFAULT_THEME)).toBe('inv-btn inv-btn-elevado')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/invite/theme-css.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/invite/theme-css.ts
import type { Theme, ButtonForma } from './theme'

export const FORMA_RADIUS: Record<ButtonForma, string> = {
  pill: '999px',
  redondo: '10px',
  recto: '3px',
}

export function themeCssVars(theme: Theme): Record<string, string> {
  return {
    '--inv-fondo': theme.colores.fondo,
    '--inv-texto': theme.colores.texto,
    '--inv-acento': theme.colores.acento,
    '--inv-boton-bg': theme.colores.botonBg,
    '--inv-boton-texto': theme.colores.botonTexto,
    '--inv-boton-radius': FORMA_RADIUS[theme.boton.forma],
    '--inv-font-titulo-id': theme.fonts.titulo,
    '--inv-font-cuerpo-id': theme.fonts.cuerpo,
  }
}

export function botonClass(theme: Theme): string {
  return `inv-btn inv-btn-${theme.boton.estilo}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/invite/theme-css.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/invite/theme-css.ts lib/invite/theme-css.test.ts
git commit -m "feat(invitacion): mapeo de theme a CSS variables y clase de boton"
```

---

## Task 5: Catálogo de fuentes + URL de Google Fonts

**Files:**
- Create: `lib/invite/fonts.ts`
- Test: `lib/invite/fonts.test.ts`

**Interfaces:**
- Produces:
  - `type FontDef = { id: string; family: string; stack: string; googleName?: string; axes?: string; italic?: boolean }`
  - `FONTS: Record<string, FontDef>` (todos los ids usados en vibes + toolkit)
  - `fontStack(id: string): string` (familia CSS con fallback; default general-sans/josefin)
  - `googleFontsHref(ids: string[]): string | null` (una URL `https://fonts.googleapis.com/css2?...&display=swap`, o `null` si no hay fuentes de Google)

- [ ] **Step 1: Write the failing test**

```ts
// lib/invite/fonts.test.ts
import { describe, it, expect } from 'vitest'
import { fontStack, googleFontsHref, FONTS } from './fonts'

describe('fonts', () => {
  it('every vibe/toolkit font id is defined', () => {
    for (const id of ['josefin-sans', 'pacifico', 'bungee-inline', 'monoton', 'anton', 'abril-fatface', 'cormorant-garamond-italic']) {
      expect(FONTS[id]).toBeTruthy()
    }
  })

  it('fontStack falls back for unknown id', () => {
    expect(fontStack('no-existe')).toContain('sans-serif')
  })

  it('googleFontsHref builds one url with the requested families and display=swap', () => {
    const href = googleFontsHref(['pacifico', 'monoton'])
    expect(href).toContain('family=Pacifico')
    expect(href).toContain('family=Monoton')
    expect(href).toContain('display=swap')
  })

  it('googleFontsHref returns null when no google fonts requested', () => {
    expect(googleFontsHref(['general-sans'])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/invite/fonts.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/invite/fonts.ts
export type FontDef = { id: string; family: string; stack: string; googleName?: string; axes?: string }

const S = (family: string, kind: 'sans' | 'serif' | 'display') =>
  `'${family}', ${kind === 'serif' ? 'serif' : 'sans-serif'}`

// googleName incluye los axes/pesos tal cual van en la URL css2 (family=<googleName>)
export const FONTS: Record<string, FontDef> = {
  'general-sans': { id: 'general-sans', family: 'General Sans', stack: "'General Sans', system-ui, sans-serif" },
  'josefin-sans': { id: 'josefin-sans', family: 'Josefin Sans', stack: S('Josefin Sans', 'sans'), googleName: 'Josefin+Sans:wght@300;400;600' },
  'playfair-display-italic': { id: 'playfair-display-italic', family: 'Playfair Display', stack: S('Playfair Display', 'serif'), googleName: 'Playfair+Display:ital,wght@1,500' },
  'cormorant-garamond': { id: 'cormorant-garamond', family: 'Cormorant Garamond', stack: S('Cormorant Garamond', 'serif'), googleName: 'Cormorant+Garamond:wght@400;500' },
  'cormorant-garamond-italic': { id: 'cormorant-garamond-italic', family: 'Cormorant Garamond', stack: S('Cormorant Garamond', 'serif'), googleName: 'Cormorant+Garamond:ital,wght@1,500' },
  'cinzel': { id: 'cinzel', family: 'Cinzel', stack: S('Cinzel', 'serif'), googleName: 'Cinzel:wght@500' },
  'bungee-inline': { id: 'bungee-inline', family: 'Bungee Inline', stack: S('Bungee Inline', 'display'), googleName: 'Bungee+Inline' },
  'great-vibes': { id: 'great-vibes', family: 'Great Vibes', stack: S('Great Vibes', 'display'), googleName: 'Great+Vibes' },
  'pacifico': { id: 'pacifico', family: 'Pacifico', stack: S('Pacifico', 'display'), googleName: 'Pacifico' },
  'baloo-2': { id: 'baloo-2', family: 'Baloo 2', stack: S('Baloo 2', 'display'), googleName: 'Baloo+2:wght@700' },
  'rowdies': { id: 'rowdies', family: 'Rowdies', stack: S('Rowdies', 'display'), googleName: 'Rowdies:wght@700' },
  'audiowide': { id: 'audiowide', family: 'Audiowide', stack: S('Audiowide', 'display'), googleName: 'Audiowide' },
  'titan-one': { id: 'titan-one', family: 'Titan One', stack: S('Titan One', 'display'), googleName: 'Titan+One' },
  'orbitron': { id: 'orbitron', family: 'Orbitron', stack: S('Orbitron', 'display'), googleName: 'Orbitron:wght@700' },
  'anton': { id: 'anton', family: 'Anton', stack: S('Anton', 'display'), googleName: 'Anton' },
  'monoton': { id: 'monoton', family: 'Monoton', stack: S('Monoton', 'display'), googleName: 'Monoton' },
  'michroma': { id: 'michroma', family: 'Michroma', stack: S('Michroma', 'display'), googleName: 'Michroma' },
  'limelight': { id: 'limelight', family: 'Limelight', stack: S('Limelight', 'display'), googleName: 'Limelight' },
  'quicksand': { id: 'quicksand', family: 'Quicksand', stack: S('Quicksand', 'sans'), googleName: 'Quicksand:wght@400;500' },
  'prata': { id: 'prata', family: 'Prata', stack: S('Prata', 'serif'), googleName: 'Prata' },
  'bodoni-moda': { id: 'bodoni-moda', family: 'Bodoni Moda', stack: S('Bodoni Moda', 'serif'), googleName: 'Bodoni+Moda:wght@400;500' },
  // toolkit extra
  'abril-fatface': { id: 'abril-fatface', family: 'Abril Fatface', stack: S('Abril Fatface', 'display'), googleName: 'Abril+Fatface' },
  'caveat': { id: 'caveat', family: 'Caveat', stack: S('Caveat', 'display'), googleName: 'Caveat:wght@500;700' },
  'fraunces': { id: 'fraunces', family: 'Fraunces', stack: S('Fraunces', 'serif'), googleName: 'Fraunces:ital,opsz,wght@0,9..144,500' },
  'bricolage-grotesque': { id: 'bricolage-grotesque', family: 'Bricolage Grotesque', stack: S('Bricolage Grotesque', 'sans'), googleName: 'Bricolage+Grotesque:opsz,wght@12..96,800' },
  'rubik-wet-paint': { id: 'rubik-wet-paint', family: 'Rubik Wet Paint', stack: S('Rubik Wet Paint', 'display'), googleName: 'Rubik+Wet+Paint' },
  'bagel-fat-one': { id: 'bagel-fat-one', family: 'Bagel Fat One', stack: S('Bagel Fat One', 'display'), googleName: 'Bagel+Fat+One' },
  'bungee-spice': { id: 'bungee-spice', family: 'Bungee Spice', stack: S('Bungee Spice', 'display'), googleName: 'Bungee+Spice' },
}

const FALLBACK = "'General Sans', system-ui, sans-serif"

export function fontStack(id: string): string {
  return FONTS[id]?.stack ?? FALLBACK
}

export function googleFontsHref(ids: string[]): string | null {
  const families = Array.from(new Set(ids))
    .map(id => FONTS[id]?.googleName)
    .filter((x): x is string => Boolean(x))
  if (families.length === 0) return null
  const query = families.map(f => `family=${f}`).join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/invite/fonts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/invite/fonts.ts lib/invite/fonts.test.ts
git commit -m "feat(invitacion): catalogo de fuentes y builder de URL google fonts"
```

---

## Task 6: ThemeProvider + estilos de botón en globals.css

**Files:**
- Create: `app/components/invitacion/ThemeProvider.tsx`
- Modify: `app/globals.css` (agregar bloque `.inv-btn*` y fallback de vars)
- Verificación: manual en dev server (no Vitest — es UI/DOM).

**Interfaces:**
- Consumes: `Theme` (Task 1), `themeCssVars` (Task 4), `googleFontsHref` + `fontStack` (Task 5).
- Produces: `<ThemeProvider theme={Theme}>{children}</ThemeProvider>` — aplica CSS vars al contenedor, resuelve las familias de `--inv-font-titulo`/`--inv-font-cuerpo` a stacks reales, y monta un `<link rel="stylesheet">` con las fuentes de Google usadas (título + cuerpo). Export default.

- [ ] **Step 1: Write `app/components/invitacion/ThemeProvider.tsx`**

```tsx
'use client'
import type { ReactNode } from 'react'
import type { Theme } from '@/lib/invite/theme'
import { themeCssVars } from '@/lib/invite/theme-css'
import { googleFontsHref, fontStack } from '@/lib/invite/fonts'

export default function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  const vars = themeCssVars(theme)
  const href = googleFontsHref([theme.fonts.titulo, theme.fonts.cuerpo])
  const style = {
    ...vars,
    ['--inv-font-titulo' as string]: fontStack(theme.fonts.titulo),
    ['--inv-font-cuerpo' as string]: fontStack(theme.fonts.cuerpo),
  } as React.CSSProperties
  return (
    <div className="inv-theme" style={style}>
      {href && <link rel="stylesheet" href={href} />}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Add button + fallback CSS to `app/globals.css`** (agregar al final del archivo)

```css
/* ===== Invitacion: tema por CSS variables ===== */
.inv-theme {
  --inv-fondo: #ffffff;
  --inv-texto: #1D1E20;
  --inv-acento: #48C9B0;
  --inv-boton-bg: #48C9B0;
  --inv-boton-texto: #ffffff;
  --inv-boton-radius: 10px;
  --inv-font-titulo: 'Josefin Sans', sans-serif;
  --inv-font-cuerpo: 'General Sans', system-ui, sans-serif;
}
.inv-btn {
  background: var(--inv-boton-bg);
  color: var(--inv-boton-texto);
  border-radius: var(--inv-boton-radius);
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
}
.inv-btn:active { transform: scale(.97); }
.inv-btn-relleno {}
.inv-btn-degradado {}
.inv-btn-contorno {
  background: transparent;
  color: var(--inv-acento);
  border: 1px solid var(--inv-acento);
}
.inv-btn-elevado { box-shadow: 0 6px 16px color-mix(in srgb, var(--inv-boton-bg) 40%, transparent); }
.inv-btn-retro3d {
  border: 2px solid var(--inv-texto);
  box-shadow: 4px 4px 0 var(--inv-texto);
}
.inv-btn-neon {
  background: transparent;
  color: var(--inv-acento);
  border: 1.5px solid var(--inv-acento);
  box-shadow: 0 0 14px var(--inv-acento), inset 0 0 8px color-mix(in srgb, var(--inv-acento) 30%, transparent);
}
.inv-btn-cromo {
  background: linear-gradient(180deg, #ffffff, color-mix(in srgb, var(--inv-boton-bg) 35%, #c8c8e8));
  color: var(--inv-boton-texto);
  border: 1px solid #fff;
  box-shadow: 0 4px 10px rgba(0,0,0,.2), inset 0 1px 2px #fff;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/invitacion/ThemeProvider.tsx app/globals.css
git commit -m "feat(invitacion): ThemeProvider y estilos de boton por tema"
```

Nota: la verificación visual llega en Task 8 (cuando el render ya usa las vars).

---

## Task 7: Secciones consumen CSS variables

**Files:**
- Modify: `app/components/invitacion/SectionShell.tsx`
- Modify (11): `app/components/invitacion/sections/PortadaSection.tsx`, `SaludoSection.tsx`, `DetallesSection.tsx`, `DressCodeSection.tsx`, `ItinerarioSection.tsx`, `RsvpSection.tsx`, `EngancheSection.tsx`, `PlaylistSection.tsx`, `MesaSection.tsx`, `TextoSection.tsx`, `CierreSection.tsx`
- Verificación: manual (Task 8).

**Interfaces:**
- Consumes: CSS variables definidas por `ThemeProvider` (`--inv-fondo`, `--inv-texto`, `--inv-acento`, `--inv-boton-*`, `--inv-font-titulo`, `--inv-font-cuerpo`) y clase de botón `botonClass` (Task 4).
- Regla de reemplazo (aplicar en cada archivo):
  - Fondo de sección `bg-[#FBF7F0]` / `bg-white` → quitar y dejar que herede; el color de fondo global lo pone `SectionShell` (abajo).
  - Texto de título `text-[#1D1E20]` + `style={{ fontFamily: "'Josefin Sans', sans-serif" }}` → `style={{ color: 'var(--inv-texto)', fontFamily: 'var(--inv-font-titulo)' }}`.
  - Texto de cuerpo `text-[#666]` / `text-[#1D1E20]` → `style={{ color: 'var(--inv-texto)' }}` (con opacidad Tailwind `opacity-70` si era secundario).
  - Acentos `text-[#d4a853]`, `bg-[#d4a853]`, `text-[#48C9B0]` → `style={{ color: 'var(--inv-acento)' }}` / `style={{ background: 'var(--inv-acento)' }}`.
  - Botón CTA (solo en `RsvpSection`): `className={botonClass(...)}`.

- [ ] **Step 1: Modify `SectionShell.tsx`** — el fondo del tema aplica a todas las secciones. Cambiar el `<section>`:

```tsx
// reemplazar el return por:
  return (
    <section
      className={`w-full ${PAD[variant]} ${className}`}
      style={{ background: 'var(--inv-fondo)', color: 'var(--inv-texto)' }}
    >
      <div className={`mx-auto w-full ${INNER[variant]} ${innerClassName}`}>{children}</div>
    </section>
  )
```

- [ ] **Step 2: Modify `PortadaSection.tsx`** — quitar `bg-[#FBF7F0]` y aplicar vars:

```tsx
  return (
    <SectionShell variant="hero" className="text-center" innerClassName="flex flex-col items-center gap-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: 'var(--inv-acento)' }}>{kicker}</p>
      <h1
        className="w-full break-words px-2 text-4xl font-semibold leading-tight lg:text-5xl"
        style={{ color: 'var(--inv-texto)', fontFamily: 'var(--inv-font-titulo)' }}
      >
        {titulo}
      </h1>
      {content.subtitulo && (
        <p className="max-w-xs text-sm leading-relaxed opacity-70 lg:max-w-md lg:text-base" style={{ color: 'var(--inv-texto)' }}>{content.subtitulo}</p>
      )}
      <div className="mt-2 h-px w-12" style={{ background: 'var(--inv-acento)' }} />
      <div className="flex flex-col items-center gap-2 text-sm opacity-80 lg:text-base" style={{ color: 'var(--inv-texto)' }}>
        {fecha && (
          <span className="flex items-center gap-2">
            <Calendar size={15} style={{ color: 'var(--inv-acento)' }} />
            {fecha}
          </span>
        )}
        {ctx.event.venue && (
          <span className="flex items-center gap-2">
            <MapPin size={15} style={{ color: 'var(--inv-acento)' }} />
            {ctx.event.venue}
          </span>
        )}
      </div>
    </SectionShell>
  )
```

- [ ] **Step 3: Apply the same replacement rule to the other 9 content sections**

En cada archivo, buscar los literales de color y fuente y reemplazarlos según la Regla de reemplazo (arriba). Referencia por archivo (los tonos hardcodeados a reemplazar):
  - `SaludoSection.tsx`: `#FBF7F0` (fondo → quitar), títulos `#1D1E20`+Josefin → `--inv-texto`/`--inv-font-titulo`, chip acento `#d4a853`/`#48C9B0` → `--inv-acento`.
  - `DetallesSection.tsx`: acentos `#d4a853`, iconos, link mapa `#48C9B0` → `--inv-acento`; textos `#666`/`#1D1E20` → `--inv-texto` (+`opacity-70`).
  - `DressCodeSection.tsx`: título y labels; el bloque de colores del dress code (que viene de `ctx.dressCode`) **no se toca** (son colores del atuendo, no del tema).
  - `ItinerarioSection.tsx`: líneas de tiempo, hora en acento → `--inv-acento`; textos → `--inv-texto`.
  - `RsvpSection.tsx`: título → `--inv-texto`/`--inv-font-titulo`. **Botón "Confirmar asistencia"**: el estilo depende del vibe, así que la clase completa (`inv-btn inv-btn-<estilo>`) se calcula en el punto de wiring (Task 8) y llega por `ctx.botonClassName`. Reemplazar las clases de color/bg del botón por `className={\`${ctx.botonClassName ?? 'inv-btn inv-btn-elevado'} px-6 py-3\`}` (conservando el resto de layout: `w-full`, `text-sm`, estados disabled, etc.).
  - `EngancheSection.tsx`, `PlaylistSection.tsx`, `MesaSection.tsx`: botones/links secundarios usan `--inv-acento` para bordes/acento; textos `--inv-texto`.
  - `TextoSection.tsx`: eyebrow → `--inv-acento`, título → `--inv-font-titulo`/`--inv-texto`, cuerpo → `--inv-texto`.
  - `CierreSection.tsx`: firma y "Hecho con Anfiora"; título → `--inv-font-titulo`; el crédito "Hecho con Anfiora" se deja con su estilo tenue (`opacity-60`) sin acento del tema.

- [ ] **Step 4: Add `botonClassName` to `InviteCtx`**

En `app/components/invitacion/types.ts`, dentro de `InviteCtx`, agregar:

```ts
  botonClassName?: string
```

- [ ] **Step 5: Commit**

```bash
git add app/components/invitacion/SectionShell.tsx app/components/invitacion/sections app/components/invitacion/types.ts
git commit -m "feat(invitacion): secciones consumen CSS variables del tema"
```

---

## Task 8: Wire ThemeProvider en renderer, editor y público

**Files:**
- Modify: `app/components/invitacion/InvitacionRenderer.tsx`
- Modify: `app/events/[id]/invitacion/page.tsx` (construir `ctx.botonClassName`)
- Modify: `app/invitacion/[slug]/[token]/InvitacionClient.tsx` (construir `ctx.botonClassName`)
- Verificación: manual en dev server.

**Interfaces:**
- Consumes: `ThemeProvider` (Task 6), `botonClass` (Task 4), `doc.theme` (Task 3).

- [ ] **Step 1: Wrap renderer in ThemeProvider** — `InvitacionRenderer.tsx`:

```tsx
// nuevo import
import ThemeProvider from './ThemeProvider'
import { botonClass } from '@/lib/invite/theme-css'

// dentro del componente, envolver el <div> existente:
  return (
    <ThemeProvider theme={doc.theme}>
      <div className="flex flex-col">
        {/* ...map de secciones sin cambios... */}
      </div>
    </ThemeProvider>
  )
```

- [ ] **Step 2: Poblar `ctx.botonClassName`** en los dos consumidores. En `app/events/[id]/invitacion/page.tsx` y `app/invitacion/[slug]/[token]/InvitacionClient.tsx`, donde se arma el `InviteCtx`, agregar:

```ts
  botonClassName: botonClass(doc.theme),
```

(importar `botonClass` de `@/lib/invite/theme-css` en ambos archivos; `doc` ya está disponible en ambos scopes).

- [ ] **Step 3: Verify build + tests green**

Run: `npm test`
Expected: PASS (todos los suites de `lib/invite/*`).

Run: `npx tsc --noEmit`
Expected: sin errores de tipos.

- [ ] **Step 4: Manual verification en dev server**

Con el dev server en `localhost:3007`:
1. Abrir `/events/{id}/invitacion` de un evento existente → el editor debe verse **igual que antes** (Vibe default `anfiora-claro` = look actual: fondo blanco/crema, título Josefin, acento). Confirmar que NO se rompió.
2. En Supabase (solo lectura mental / no editar): confirmar que un `invite_config` viejo (v1) sigue renderizando (la migración lo lleva a v2 con theme default al leer).
3. Abrir una invitación pública `/invitacion/{slug}/{token}` publicada → misma apariencia que antes.
4. Editar temporalmente en el cliente (React devtools o un cambio de prueba) `doc.theme.colores.fondo` a `#1D1E20` y `texto` a `#f5f5f5` → toda la invitación cambia de fondo/textos (prueba de que las vars fluyen). Revertir.

Checklist de aceptación:
- [ ] Editor y público se ven idénticos al estado previo con el theme default.
- [ ] `npm test` verde, `tsc --noEmit` sin errores.
- [ ] Cambiar tokens del theme cambia colores/fuentes en todo el render.

- [ ] **Step 5: Commit**

```bash
git add app/components/invitacion/InvitacionRenderer.tsx "app/events/[id]/invitacion/page.tsx" "app/invitacion/[slug]/[token]/InvitacionClient.tsx"
git commit -m "feat(invitacion): aplica ThemeProvider en render, editor y pagina publica"
```

---

## Self-Review (cobertura vs spec)

- **Capa de tema (spec §3):** Tasks 1-3 (schema, vibes, migración). ✔
- **21 vibes (spec §3.1):** Task 2 (los 21, ids únicos, parsean). ✔
- **Toolkit de fuentes (spec §3.2):** Task 5 (FONTS incluye toolkit). ✔ (el picker UI es Fase 2).
- **Modelo de botón (spec §3.3):** Tasks 1 (enums), 4 (clase), 6 (CSS incl. elevado/retro3d/neon/cromo). ✔
- **Fondos/animaciones (spec §3.4-3.5):** solo se **almacenan** en el theme (Task 1); su render es Fase 4-5. Declarado fuera de alcance de Fase 1. ✔ (sin gap: es secuencial por diseño).
- **Render por CSS vars (spec §5):** Tasks 6-8. ✔
- **Retrocompat v1→v2 (constraint):** Task 3 + verificación manual Task 8. ✔
- **Fuentes solo usadas, display swap (constraint):** Task 5-6. ✔

**Notas de dependencia:** Task 4 depende de Task 1; Task 5 independiente; Task 6 depende de 4 y 5; Task 7 depende de 6; Task 8 depende de 6-7. Orden lineal 1→8.

**Fuera de alcance de Fase 1 (fases siguientes):** editor Vibes+Personalizar (F2), mobile WYSIWYG (F3), fondos animados render (F4), animaciones RSVP (F5), post-confirmación (F6), slug (F7).
```
