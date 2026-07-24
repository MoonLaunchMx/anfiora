# Invitación — Editor de diseño · Fase 2 (Editor: Vibes + Personalizar + preview en vivo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Dar al organizador un editor visual dentro del tab "Diseño": una galería de **Vibes** (1 tap aplica un tema completo) y un panel **Personalizar** (colores, fuentes, botón) con **preview en vivo** — todo persistido por el autosave existente.

**Architecture:** La Fase 1 ya expone `doc.theme`, el `InvitacionRenderer` compartido lo aplica vía CSS variables, y el editor tiene autosave (`updateDoc(next)` → debounce 800ms → `event_settings.invite_config`). Esta fase añade helpers puros (`setTheme`, `applyVibe`) y componentes UI (`VibePicker`, `PersonalizarPanel`) montados en una sub-navegación "Estilo / Contenido" dentro del tab Diseño (Layout A: controles a la izquierda, preview a la derecha).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Vitest. Sin nuevas dependencias.

## Global Constraints

- Tests **Vitest** solo para lógica pura (`setTheme`, `applyVibe`). UI se verifica **manual** en `localhost:3007`.
- Cambiar el diseño usa el **autosave existente**: llamar `updateDoc(next)` (ya definido en `page.tsx`) — NO crear otro mecanismo de guardado.
- Retrocompat: aplicar un vibe/override nunca rompe `sections`, `meta` ni el resto de `doc`.
- Solo Tailwind; las CSS variables del tema son la excepción de inline-style ya justificada. Botón CTA teal `#48C9B0`. Negro `#1D1E20` solo para dropdowns de filtro (no aplica aquí). UI en español con acentos. Sin emojis en UI. Iconos Lucide.
- Mobile-first: en mobile el preview embebido se oculta (patrón actual); el WYSIWYG mobile es Fase 3 — NO implementarlo aquí. En esta fase el editor de estilo se ve en la columna izquierda (usable en mobile como formulario, preview vía botón "Vista previa" existente).
- Fondos animados y animaciones RSVP se **almacenan** al aplicar un vibe pero su UI dedicada y su render son Fases 4-5 — NO agregar controles de efecto/animación en Personalizar aquí. Personalizar en esta fase = **Colores + Fuentes + Botón**.
- Commits convencionales sin acentos ni ñ.

---

## File Structure

- `lib/invite/doc.ts` — **modificar.** Agregar `setTheme(doc, patch)` y `applyVibe(doc, vibeId)`.
- `lib/invite/doc.test.ts` — **modificar.** Tests de los dos helpers.
- `app/events/[id]/invitacion/VibePicker.tsx` — **crear.** Galería de 22 vibes por categoría; `onSelect(vibeId)`.
- `app/events/[id]/invitacion/PersonalizarPanel.tsx` — **crear.** Controles Colores + Fuentes + Botón; `onChange(themePatch)`.
- `app/events/[id]/invitacion/EstiloPanel.tsx` — **crear.** Compone VibePicker + PersonalizarPanel; recibe `doc` + `onChange(nextDoc)`.
- `app/events/[id]/invitacion/page.tsx` — **modificar.** Sub-tab "Estilo / Contenido" en la columna izquierda del tab Diseño.

---

## Task 1: Helpers puros `setTheme` y `applyVibe`

**Files:**
- Modify: `lib/invite/doc.ts`
- Test: `lib/invite/doc.test.ts` (append)

**Interfaces:**
- Consumes: `InviteDoc`, `Theme` (Fase 1), `getVibe` de `./vibes`, `ThemeSchema` de `./theme`.
- Produces:
  - `setTheme(doc: InviteDoc, patch: DeepPartial<Theme>): InviteDoc` — merge superficial-por-sección del theme (colores/fonts/boton/fondo/anim se mergean campo a campo), revalidado con `ThemeSchema`.
  - `applyVibe(doc: InviteDoc, vibeId: string): InviteDoc` — reemplaza `doc.theme` por el theme del vibe (deep copy), preservando `sections`/`meta`.

- [ ] **Step 1: Write the failing test** (append a `lib/invite/doc.test.ts`)

```ts
import { setTheme, applyVibe } from './doc'
import { getVibe } from './vibes'

describe('theme editing helpers', () => {
  let n = 0
  const makeId = () => `id-${n++}`

  it('applyVibe replaces the theme with the vibe theme, keeping sections and meta', () => {
    const base = defaultDoc(makeId)
    const next = applyVibe(base, 'fiesta')
    expect(next.theme.vibeId).toBe('fiesta')
    expect(next.theme.colores.fondo).toBe(getVibe('fiesta').theme.colores.fondo)
    expect(next.sections).toBe(base.sections) // sections untouched (same ref)
    expect(next.meta).toEqual(base.meta)
  })

  it('applyVibe with an unknown id falls back to the clasico theme', () => {
    const base = defaultDoc(makeId)
    const next = applyVibe(base, 'no-existe')
    expect(next.theme.vibeId).toBe('clasico')
  })

  it('setTheme merges a color override without dropping other tokens', () => {
    const base = applyVibe(defaultDoc(makeId), 'fiesta')
    const next = setTheme(base, { colores: { acento: '#123456' } })
    expect(next.theme.colores.acento).toBe('#123456')
    expect(next.theme.colores.fondo).toBe(base.theme.colores.fondo) // otros colores intactos
    expect(next.theme.fonts.titulo).toBe(base.theme.fonts.titulo)   // otras secciones intactas
    expect(next.theme.vibeId).toBe('fiesta')
  })

  it('setTheme merges a boton override', () => {
    const base = applyVibe(defaultDoc(makeId), 'clasico')
    const next = setTheme(base, { boton: { forma: 'recto' } })
    expect(next.theme.boton.forma).toBe('recto')
    expect(next.theme.boton.estilo).toBe(base.theme.boton.estilo)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:\Users\diego\Documents\anfiora\.claude\worktrees\invitacion-editor-diseno" && npm test -- lib/invite/doc.test.ts`
Expected: FAIL — `setTheme`/`applyVibe` not exported.

- [ ] **Step 3: Implement in `lib/invite/doc.ts`**

Agregar imports arriba (junto a los existentes):

```ts
import { ThemeSchema, type Theme } from './theme'
import { getVibe } from './vibes'
```

(Si `ThemeSchema`/`DEFAULT_THEME` ya están importados de la Fase 1, no dupliques el import — solo añade lo que falte, e importa `getVibe`.)

Agregar al final del archivo:

```ts
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export function applyVibe(doc: InviteDoc, vibeId: string): InviteDoc {
  const theme = ThemeSchema.parse(getVibe(vibeId).theme)
  return { ...doc, theme }
}

export function setTheme(doc: InviteDoc, patch: DeepPartial<Theme>): InviteDoc {
  const t = doc.theme
  const merged = {
    ...t,
    ...patch,
    colores: { ...t.colores, ...(patch.colores ?? {}) },
    fonts: { ...t.fonts, ...(patch.fonts ?? {}) },
    boton: { ...t.boton, ...(patch.boton ?? {}) },
    fondo: { ...t.fondo, ...(patch.fondo ?? {}) },
    anim: { ...t.anim, ...(patch.anim ?? {}) },
    copy: { ...t.copy, ...(patch.copy ?? {}) },
  }
  return { ...doc, theme: ThemeSchema.parse(merged) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/invite/doc.test.ts`
Expected: PASS (existentes + 4 nuevos).

- [ ] **Step 5: Commit**

```bash
git add lib/invite/doc.ts lib/invite/doc.test.ts
git commit -m "feat(invitacion): helpers setTheme y applyVibe para editar el tema"
```

---

## Task 2: VibePicker + sub-tab "Estilo" (el momento visible)

**Files:**
- Create: `app/events/[id]/invitacion/VibePicker.tsx`
- Create: `app/events/[id]/invitacion/EstiloPanel.tsx`
- Modify: `app/events/[id]/invitacion/page.tsx`
- Verificación: manual en `localhost:3007`.

**Interfaces:**
- Consumes: `VIBES_BY_CATEGORY`, `type VibeCategory` (`@/lib/invite/vibes`), `applyVibe` (Task 1), `updateDoc` (existente en page.tsx), `doc.theme.vibeId`.
- Produces:
  - `VibePicker({ activeVibeId, onSelect }: { activeVibeId: string; onSelect: (id: string) => void })`
  - `EstiloPanel({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void })` (en esta task solo renderiza VibePicker; PersonalizarPanel se añade en Task 3).

- [ ] **Step 1: Create `app/events/[id]/invitacion/VibePicker.tsx`**

```tsx
'use client'
import { VIBES_BY_CATEGORY, type VibeCategory } from '@/lib/invite/vibes'

const CAT_LABELS: Record<VibeCategory, string> = {
  elegantes: 'Elegantes y bodas',
  celebracion: 'Celebración',
  retro: 'Retro',
  musica: 'Por música',
  temporada: 'Por temporada',
}
const CAT_ORDER: VibeCategory[] = ['elegantes', 'celebracion', 'retro', 'musica', 'temporada']

export default function VibePicker({ activeVibeId, onSelect }: { activeVibeId: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {CAT_ORDER.map(cat => (
        <div key={cat}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">{CAT_LABELS[cat]}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {(VIBES_BY_CATEGORY[cat] ?? []).map(v => {
              const active = v.id === activeVibeId
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelect(v.id)}
                  className={`overflow-hidden rounded-xl border-2 text-left transition ${active ? 'border-[#48C9B0]' : 'border-transparent hover:border-[#e0e0e0]'}`}
                >
                  <div
                    className="flex h-16 items-center justify-center px-2 text-center text-sm font-semibold"
                    style={{ background: v.theme.colores.fondo, color: v.theme.colores.acento }}
                  >
                    Ana &amp; Luis
                  </div>
                  <div className="flex items-center justify-between bg-white px-2.5 py-1.5">
                    <span className="truncate text-xs font-medium text-[#1D1E20]">{v.nombre}</span>
                    {active && <span className="ml-1 shrink-0 text-[10px] font-semibold text-[#48C9B0]">Activo</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/events/[id]/invitacion/EstiloPanel.tsx`**

```tsx
'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import { applyVibe } from '@/lib/invite/doc'
import VibePicker from './VibePicker'

export default function EstiloPanel({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <VibePicker activeVibeId={doc.theme.vibeId} onSelect={id => onChange(applyVibe(doc, id))} />
    </div>
  )
}
```

- [ ] **Step 3: Wire the sub-tab into `page.tsx`**

En `app/events/[id]/invitacion/page.tsx`:

3a. Import + estado. Junto a los otros imports de la carpeta (`BlockEditor`, `RepartoLinks`):

```tsx
import EstiloPanel from './EstiloPanel'
```

Junto a los `useState` existentes (ej. tras `const [activeTab, setActiveTab] = useState<TabKey>('diseno')`):

```tsx
  const [disenoSub, setDisenoSub] = useState<'estilo' | 'contenido'>('estilo')
```

3b. Reemplazar el contenido de la columna izquierda del tab Diseño. Hoy es:

```tsx
            <BlockEditor doc={doc} onChange={updateDoc} makeId={() => crypto.randomUUID()} />
```

Reemplazarlo por (un toggle + el panel correspondiente):

```tsx
            <div className="min-w-0">
              <div className="mb-4 inline-flex overflow-hidden rounded-lg border border-[#e0e0e0]">
                <button
                  onClick={() => setDisenoSub('estilo')}
                  className={['px-4 py-1.5 text-xs font-medium transition', disenoSub === 'estilo' ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#f5f5f5]'].join(' ')}
                >
                  Estilo
                </button>
                <button
                  onClick={() => setDisenoSub('contenido')}
                  className={['border-l border-[#e0e0e0] px-4 py-1.5 text-xs font-medium transition', disenoSub === 'contenido' ? 'bg-[#1D1E20] text-white' : 'text-[#888] hover:bg-[#f5f5f5]'].join(' ')}
                >
                  Contenido
                </button>
              </div>
              {disenoSub === 'estilo' ? (
                <EstiloPanel doc={doc} onChange={updateDoc} />
              ) : (
                <BlockEditor doc={doc} onChange={updateDoc} makeId={() => crypto.randomUUID()} />
              )}
            </div>
```

(No cambiar la columna derecha del preview ni nada más.)

- [ ] **Step 4: Typecheck + build + tests**

Run: `cd "C:\Users\diego\Documents\anfiora\.claude\worktrees\invitacion-editor-diseno" && npx tsc --noEmit` → limpio.
Run: `npm test` → verde.
Run: `npm run build` → completa sin errores.

- [ ] **Step 5: Manual verification en `localhost:3007`**

1. `/events/{id}/invitacion` → tab Diseño → sub-tab **Estilo** activo por default: se ve la galería de 22 vibes por categoría.
2. Click en **Fiesta** → el preview del teléfono (derecha) cambia a fondo morado/rosa, título en la fuente del vibe (se carga de Google Fonts), botón amarillo. El chip "Activo" aparece en Fiesta.
3. Click en **Anfiora Noche** → fondo negro, acentos amarillo/teal. En **Clásico** → vuelve al look crema/dorado.
4. Recargar la página → el vibe elegido persiste (autosave). El sub-tab **Contenido** sigue mostrando el BlockEditor de siempre.

Checklist:
- [ ] Los 22 vibes aparecen agrupados en 5 categorías.
- [ ] Elegir un vibe transforma el preview en vivo y carga su fuente.
- [ ] Persiste al recargar; Contenido (bloques) intacto.
- [ ] `tsc`/`test`/`build` verdes.

- [ ] **Step 6: Commit**

```bash
git add "app/events/[id]/invitacion/VibePicker.tsx" "app/events/[id]/invitacion/EstiloPanel.tsx" "app/events/[id]/invitacion/page.tsx"
git commit -m "feat(invitacion): galeria de vibes en el editor con preview en vivo"
```

---

## Task 3: PersonalizarPanel (Colores + Fuentes + Botón)

**Files:**
- Create: `app/events/[id]/invitacion/PersonalizarPanel.tsx`
- Modify: `app/events/[id]/invitacion/EstiloPanel.tsx` (montar el panel bajo el VibePicker)
- Verificación: manual.

**Interfaces:**
- Consumes: `setTheme` (Task 1), `FONTS` (`@/lib/invite/fonts`), enums `BUTTON_FORMAS`/`BUTTON_ESTILOS` (`@/lib/invite/theme`), `doc.theme`.
- Produces: `PersonalizarPanel({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void })`.

- [ ] **Step 1: Create `app/events/[id]/invitacion/PersonalizarPanel.tsx`**

```tsx
'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import { setTheme } from '@/lib/invite/doc'
import { FONTS } from '@/lib/invite/fonts'
import { BUTTON_FORMAS, BUTTON_ESTILOS } from '@/lib/invite/theme'

const FONT_IDS = Object.keys(FONTS)
const FORMA_LABEL: Record<string, string> = { pill: 'Pastilla', redondo: 'Redondo', recto: 'Recto' }
const ESTILO_LABEL: Record<string, string> = {
  relleno: 'Relleno', contorno: 'Contorno', degradado: 'Degradado', elevado: 'Elevado', retro3d: 'Retro 3D', neon: 'Neón', cromo: 'Cromo',
}

function isHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // El color puede ser un gradiente (no editable por <input type=color>); mostramos el picker solo si es hex.
  const hex = isHex(value) ? value : '#ffffff'
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[#666]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-32 rounded-lg border border-[#e0e0e0] px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
        />
        <input
          type="color"
          value={hex}
          onChange={e => onChange(e.target.value)}
          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-[#e0e0e0] bg-white"
          aria-label={label}
        />
      </div>
    </div>
  )
}

export default function PersonalizarPanel({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  const t = doc.theme
  const set = (patch: Parameters<typeof setTheme>[1]) => onChange(setTheme(doc, patch))

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#999]">Personalizar</p>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-[#1D1E20]">Colores</p>
        <ColorRow label="Fondo" value={t.colores.fondo} onChange={v => set({ colores: { fondo: v } })} />
        <ColorRow label="Texto" value={t.colores.texto} onChange={v => set({ colores: { texto: v } })} />
        <ColorRow label="Acento" value={t.colores.acento} onChange={v => set({ colores: { acento: v } })} />
        <ColorRow label="Botón (fondo)" value={t.colores.botonBg} onChange={v => set({ colores: { botonBg: v } })} />
        <ColorRow label="Botón (texto)" value={t.colores.botonTexto} onChange={v => set({ colores: { botonTexto: v } })} />
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-[#1D1E20]">Tipografía</p>
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#666]">Títulos</span>
          <select
            value={t.fonts.titulo}
            onChange={e => set({ fonts: { titulo: e.target.value } })}
            className="w-40 rounded-lg border border-[#e0e0e0] bg-white px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
          >
            {FONT_IDS.map(id => <option key={id} value={id}>{FONTS[id].family}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#666]">Cuerpo</span>
          <select
            value={t.fonts.cuerpo}
            onChange={e => set({ fonts: { cuerpo: e.target.value } })}
            className="w-40 rounded-lg border border-[#e0e0e0] bg-white px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
          >
            {FONT_IDS.map(id => <option key={id} value={id}>{FONTS[id].family}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-[#1D1E20]">Botón</p>
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#666]">Forma</span>
          <select
            value={t.boton.forma}
            onChange={e => set({ boton: { forma: e.target.value as typeof t.boton.forma } })}
            className="w-40 rounded-lg border border-[#e0e0e0] bg-white px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
          >
            {BUTTON_FORMAS.map(f => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#666]">Estilo</span>
          <select
            value={t.boton.estilo}
            onChange={e => set({ boton: { estilo: e.target.value as typeof t.boton.estilo } })}
            className="w-40 rounded-lg border border-[#e0e0e0] bg-white px-2 py-1 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
          >
            {BUTTON_ESTILOS.map(s => <option key={s} value={s}>{ESTILO_LABEL[s]}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount it in `EstiloPanel.tsx`**

Reemplazar el cuerpo de `EstiloPanel` para incluir el panel bajo el picker:

```tsx
'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import { applyVibe } from '@/lib/invite/doc'
import VibePicker from './VibePicker'
import PersonalizarPanel from './PersonalizarPanel'

export default function EstiloPanel({ doc, onChange }: { doc: InviteDoc; onChange: (next: InviteDoc) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <VibePicker activeVibeId={doc.theme.vibeId} onSelect={id => onChange(applyVibe(doc, id))} />
      <PersonalizarPanel doc={doc} onChange={onChange} />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + build + tests**

Run: `npx tsc --noEmit` → limpio.
Run: `npm test` → verde.
Run: `npm run build` → completa.

- [ ] **Step 4: Manual verification en `localhost:3007`**

1. Tab Diseño → Estilo → bajo la galería aparece **Personalizar** con Colores, Tipografía, Botón.
2. Elegir vibe **Clásico**, luego en Personalizar cambiar **Acento** a `#ff0000` (texto o color picker) → los acentos del preview (kicker, íconos, badges) se ponen rojos en vivo.
3. Cambiar **Títulos** a `Pacifico` → el título del preview cambia de fuente (carga Google Fonts).
4. Cambiar **Botón › Estilo** a `Neón` y **Forma** a `Recto` → el botón "Confirmar" del preview cambia a contorno con glow, esquinas rectas.
5. Recargar → los overrides persisten. Elegir otro vibe **reemplaza** todo (comportamiento esperado: el vibe pisa los overrides).

Checklist:
- [ ] Los 3 grupos de controles editan el preview en vivo.
- [ ] Colores aceptan hex (texto) y color picker; un valor gradiente se conserva si no se toca.
- [ ] Fuentes cargan y aplican; Botón forma+estilo aplican.
- [ ] Persisten al recargar.
- [ ] `tsc`/`test`/`build` verdes.

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/invitacion/PersonalizarPanel.tsx" "app/events/[id]/invitacion/EstiloPanel.tsx"
git commit -m "feat(invitacion): panel Personalizar (colores, fuentes, boton) con preview en vivo"
```

---

## Self-Review (cobertura vs spec §4)

- **Vibes como puerta de entrada (spec §4.2.1):** Task 2 (galería categorizada, 1 tap aplica). ✔
- **Personalizar progresivo — colores/fuentes/botón (spec §4.2.2):** Task 3. ✔ (fondo-efecto y animación RSVP se difieren a sus fases, declarado en constraints).
- **Preview en vivo (spec §4.2.3):** el preview existente renderiza `doc.theme`; `updateDoc` lo actualiza. ✔
- **Desktop Layout A (spec §4):** controles izquierda (sub-tab Estilo), preview derecha. ✔
- **Persistencia:** vía `updateDoc` existente (autosave 800ms). ✔
- **Mobile WYSIWYG:** fuera de alcance (Fase 3). ✔

**Dependencias:** Task 1 → Task 2 (usa applyVibe) → Task 3 (usa setTheme). Orden lineal.

**Fuera de alcance (fases siguientes):** WYSIWYG mobile (F3), fondos animados + su control (F4), animaciones RSVP + su control (F5), post-confirmación (F6), slug (F7).
```
