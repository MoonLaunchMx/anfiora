# Invitación pública responsive (full-bleed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la invitación pública del invitado se adapte a móvil, tablet y desktop con layout full-bleed (portada/cierre a todo el ancho, cuerpo centrado en columna que crece), más un botón "Vista completa" en el editor que abre la invitación real a ancho completo en pestaña nueva.

**Architecture:** Se introduce una primitiva de layout `SectionShell` (única fuente de verdad de ancho + ritmo vertical, con variantes `hero` / `band` / `form`). Cada sección se envuelve en ella. Se elimina el cap `max-w-[480px]` de la página pública. Se agrega una ruta de preview del dueño chrome-free que reusa el renderer. Es puro layout/CSS: no cambia schema, lógica de negocio, RSVP funcional ni API.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase (browser client), Lucide icons.

## Global Constraints

- Solo Tailwind CSS para estilos; sin inline styles salvo el `fontFamily` de Josefin Sans ya existente (verbatim: `style={{ fontFamily: "'Josefin Sans', sans-serif" }}`).
- Full file replacement en cada archivo modificado (nunca edits parciales), excepto el toolbar del editor donde se muestra el bloque exacto a insertar.
- Texto de UI en español CON acentos/ñ. Copy limpio, sin comas de más.
- Sin comentarios salvo cuando el WHY es no-obvio.
- Commits convencionales SIN acentos ni ñ (`feat:`, `fix:`, `refactor:`).
- CTA en teal `#48C9B0`. No emojis en UI.
- No tocar el preview del editor con frame de teléfono (`app/events/[id]/invitacion/page.tsx:228`).
- No tocar schema, API, ni lógica de RSVP. Solo envoltura de layout.
- Verificación manual (local → preview Vercel); no hay lógica pura nueva para Vitest.

---

### Task 1: Primitiva `SectionShell`

**Files:**
- Create: `app/components/invitacion/SectionShell.tsx`

**Interfaces:**
- Produces: `export default function SectionShell(props: { variant: 'hero' | 'band' | 'form'; className?: string; innerClassName?: string; children: ReactNode })` — renderiza un `<section className="w-full {pad} {className}">` con un contenedor interno `<div className="mx-auto w-full {inner} {innerClassName}">`. Anchos internos: hero=`max-w-2xl lg:max-w-3xl`, band=`max-w-xl lg:max-w-2xl`, form=`max-w-lg`. Padding: hero=`px-6 py-16 sm:py-20 lg:py-28`, band/form=`px-6 py-8 sm:py-12 lg:py-16`.

- [ ] **Step 1: Crear el componente**

Crear `app/components/invitacion/SectionShell.tsx`:

```tsx
'use client'
import type { ReactNode } from 'react'

type Variant = 'hero' | 'band' | 'form'

const INNER: Record<Variant, string> = {
  hero: 'max-w-2xl lg:max-w-3xl',
  band: 'max-w-xl lg:max-w-2xl',
  form: 'max-w-lg',
}

const PAD: Record<Variant, string> = {
  hero: 'px-6 py-16 sm:py-20 lg:py-28',
  band: 'px-6 py-8 sm:py-12 lg:py-16',
  form: 'px-6 py-8 sm:py-12 lg:py-16',
}

export default function SectionShell({
  variant,
  className = '',
  innerClassName = '',
  children,
}: {
  variant: Variant
  className?: string
  innerClassName?: string
  children: ReactNode
}) {
  return (
    <section className={`w-full ${PAD[variant]} ${className}`}>
      <div className={`mx-auto w-full ${INNER[variant]} ${innerClassName}`}>{children}</div>
    </section>
  )
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build OK (el componente no está aún consumido, no debe romper nada).

- [ ] **Step 3: Commit**

```bash
git add app/components/invitacion/SectionShell.tsx
git commit -m "feat(invitacion): primitiva SectionShell de layout responsive"
```

---

### Task 2: Ruta de preview del dueño + botón "Vista completa"

Se hace temprano: es la superficie donde verificaremos el responsive en desktop sin necesitar un invitado publicado real. Renderiza las secciones aún-no-refactorizadas a ancho completo (se verá tosco hasta las tareas 3-5; es el laboratorio).

**Files:**
- Create: `app/invitacion/preview/[id]/page.tsx`
- Modify: `app/events/[id]/invitacion/page.tsx` (toolbar: importar `ExternalLink`, agregar anchor)

**Interfaces:**
- Consumes: `InvitacionRenderer` (`app/components/invitacion/InvitacionRenderer.tsx`), `PreviewBoundary`, `resolveDoc` (`@/lib/invite/doc`), `parseDressCode` (`@/lib/dresscode`), `InviteCtx` (`@/app/components/invitacion/types`), `supabase` (`@/lib/supabase`).
- Produces: ruta `/invitacion/preview/[id]` (owner-only, chrome-free) navegable desde el editor.

- [ ] **Step 1: Crear la ruta de preview**

Crear `app/invitacion/preview/[id]/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { resolveDoc } from '@/lib/invite/doc'
import { parseDressCode, type DressCode } from '@/lib/dresscode'
import type { InviteDoc } from '@/lib/invite/schema'
import type { InviteCtx } from '@/app/components/invitacion/types'
import InvitacionRenderer from '@/app/components/invitacion/InvitacionRenderer'
import PreviewBoundary from '@/app/components/invitacion/PreviewBoundary'

type EventInfo = InviteCtx['event']

async function safeSingle<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try {
    const { data, error } = await p
    return error ? null : data
  } catch {
    return null
  }
}

export default function InvitacionPreviewPage() {
  const { id } = useParams()
  const eventId = id as string

  const [doc, setDoc] = useState<InviteDoc | null>(null)
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [dressCode, setDressCode] = useState<DressCode | null>(null)
  const [playlistToken, setPlaylistToken] = useState<string | null>(null)
  const [registryToken, setRegistryToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        setDenied(true)
        setLoading(false)
        return
      }

      const [ev, inviteRow, dressRow] = await Promise.all([
        supabase
          .from('events')
          .select('name, event_type, event_date, event_time, venue, address, host_name, host_name_2')
          .eq('id', eventId)
          .single(),
        safeSingle<{ invite_config: unknown; playlist_token: string | null; registry_token: string | null }>(
          supabase.from('event_settings').select('invite_config, playlist_token, registry_token').eq('event_id', eventId).maybeSingle(),
        ),
        safeSingle<{ dress_code: unknown }>(
          supabase.from('event_settings').select('dress_code').eq('event_id', eventId).maybeSingle(),
        ),
      ])
      if (!ev.data) {
        setDenied(true)
        setLoading(false)
        return
      }
      setEvent(ev.data)
      setDressCode(parseDressCode(dressRow?.dress_code))
      setPlaylistToken(inviteRow?.playlist_token ?? null)
      setRegistryToken(inviteRow?.registry_token ?? null)
      setDoc(resolveDoc(inviteRow?.invite_config, () => crypto.randomUUID()))
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  if (denied || !doc || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF7F0] px-6 text-center">
        <Heart size={28} className="mb-3 text-[#d4a853]" />
        <h1 className="text-lg font-semibold text-[#1D1E20]">Vista previa no disponible</h1>
        <p className="mt-1 text-sm text-[#888]">Inicia sesión como organizador del evento.</p>
      </div>
    )
  }

  const ctx: InviteCtx = {
    event,
    guest: { name: 'Invitado de ejemplo', party_size: 3, rsvp_status: 'pending', allergies: [] },
    companions: [
      { name: 'Acompañante 1', rsvp_status: 'pending', allergies: [] },
      { name: 'Acompañante 2', rsvp_status: 'pending', allergies: [] },
    ],
    dressCode,
    itinerary: [],
    tokens: { playlist: playlistToken, registry: registryToken },
    mode: 'preview',
    onSubmit: undefined,
    deadlinePassed: false,
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0]">
      <PreviewBoundary>
        <InvitacionRenderer doc={doc} ctx={ctx} />
      </PreviewBoundary>
    </div>
  )
}
```

- [ ] **Step 2: Agregar el botón "Vista completa" en el toolbar del editor**

En `app/events/[id]/invitacion/page.tsx`, agregar `ExternalLink` al import de lucide-react (línea 5):

Reemplazar:
```tsx
import { Send, Check, LayoutGrid } from 'lucide-react'
```
por:
```tsx
import { Send, Check, LayoutGrid, ExternalLink } from 'lucide-react'
```

Luego, en el contenedor `<div className="flex items-center gap-2.5">` (línea ~191), insertar el anchor **antes** del `<button onClick={handlePublish}`:

```tsx
            <a
              href={`/invitacion/preview/${eventId}`}
              target="_blank"
              rel="noreferrer"
              className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm font-medium text-[#666] transition hover:bg-[#f5f5f5] sm:flex"
            >
              <ExternalLink size={14} /> Vista completa
            </a>
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Verificación manual**

1. `npm run dev`
2. Login. Ir a `/events/<un-evento-tuyo>/invitacion`.
3. Confirmar que aparece el botón "Vista completa" en el toolbar (desktop).
4. Click → abre pestaña nueva en `/invitacion/preview/<id>`, sin sidebar, con la invitación (todavía se verá angosta/tosca en desktop; se arregla en las siguientes tareas).
5. Confirmar routing: la URL `/invitacion/preview/<id>` NO cae en la ruta pública `[slug]/[token]` (no muestra "Invitación no disponible" por token). Si cayera, revisar prioridad de segmento estático.

- [ ] **Step 5: Commit**

```bash
git add "app/invitacion/preview/[id]/page.tsx" "app/events/[id]/invitacion/page.tsx"
git commit -m "feat(invitacion): ruta de vista completa del dueno + boton en editor"
```

---

### Task 3: Descajonar la página pública + secciones hero (Portada, Cierre)

**Files:**
- Modify: `app/invitacion/[slug]/[token]/InvitacionClient.tsx` (quitar `max-w-[480px]`)
- Modify: `app/components/invitacion/sections/PortadaSection.tsx`
- Modify: `app/components/invitacion/sections/CierreSection.tsx`

**Interfaces:**
- Consumes: `SectionShell` (Task 1).

- [ ] **Step 1: Quitar el cap de ancho en `InvitacionClient.tsx`**

Reemplazar el bloque `return (...)` final (líneas ~95-103) por:

```tsx
  return (
    <div className="min-h-screen bg-[#FBF7F0]">
      <PreviewBoundary>
        <InvitacionRenderer doc={data.doc} ctx={ctx} />
      </PreviewBoundary>
    </div>
  )
```

(Se elimina el wrapper `<div className="mx-auto max-w-[480px]">`.)

- [ ] **Step 2: Portada como hero**

Reemplazar `app/components/invitacion/sections/PortadaSection.tsx` completo:

```tsx
'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { resolveInviteHeading, resolveEventKicker } from '@/lib/invite'
import { formatFecha } from '../format'
import { Calendar, MapPin } from 'lucide-react'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'portada' }>['content']

export default function PortadaSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const titulo = content.titulo || resolveInviteHeading(ctx.event)
  const kicker = content.kicker || resolveEventKicker(ctx.event.event_type)
  const fecha = formatFecha(ctx.event.event_date)

  return (
    <SectionShell variant="hero" className="bg-[#FBF7F0] text-center" innerClassName="flex flex-col items-center gap-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#d4a853]">{kicker}</p>
      <h1
        className="w-full break-words px-2 text-4xl font-semibold leading-tight text-[#1D1E20] sm:text-5xl lg:text-6xl"
        style={{ fontFamily: "'Josefin Sans', sans-serif" }}
      >
        {titulo}
      </h1>
      {content.subtitulo && (
        <p className="max-w-xs text-sm leading-relaxed text-[#666] sm:max-w-md sm:text-base">{content.subtitulo}</p>
      )}
      <div className="mt-2 h-px w-12 bg-[#d4a853]" />
      <div className="flex flex-col items-center gap-2 text-sm text-[#666] sm:text-base">
        {fecha && (
          <span className="flex items-center gap-2">
            <Calendar size={15} className="text-[#d4a853]" />
            {fecha}
          </span>
        )}
        {ctx.event.venue && (
          <span className="flex items-center gap-2">
            <MapPin size={15} className="text-[#d4a853]" />
            {ctx.event.venue}
          </span>
        )}
      </div>
    </SectionShell>
  )
}
```

- [ ] **Step 3: Cierre como hero**

Reemplazar `app/components/invitacion/sections/CierreSection.tsx` completo:

```tsx
'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { resolveInviteHeading } from '@/lib/invite'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'cierre' }>['content']

export default function CierreSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const firma = resolveInviteHeading(ctx.event)

  return (
    <SectionShell variant="hero" className="bg-[#FBF7F0] text-center" innerClassName="flex flex-col items-center gap-4">
      <h2 className="px-2 text-2xl font-semibold text-[#1D1E20] sm:text-3xl" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>
      <div className="h-px w-10 bg-[#d4a853]" />
      <p className="px-2 text-sm font-semibold text-[#666] sm:text-base" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {firma}
      </p>
      <p className="mt-6 text-[11px] uppercase tracking-wider text-[#bbb]">Hecho con Anfiora</p>
    </SectionShell>
  )
}
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 5: Verificación manual (desktop)**

Abrir `/invitacion/preview/<id>` a ancho ~1280px: la portada y el cierre ocupan todo el ancho con fondo crema, título grande y centrado, con aire vertical generoso. Ya no es una tira angosta arriba/abajo.

- [ ] **Step 6: Commit**

```bash
git add "app/invitacion/[slug]/[token]/InvitacionClient.tsx" app/components/invitacion/sections/PortadaSection.tsx app/components/invitacion/sections/CierreSection.tsx
git commit -m "feat(invitacion): pagina full-bleed y secciones hero portada/cierre"
```

---

### Task 4: Secciones band (Saludo, Detalles, Dress code, Itinerario, Enganche, Texto)

**Files:**
- Modify: `app/components/invitacion/sections/SaludoSection.tsx`
- Modify: `app/components/invitacion/sections/DetallesSection.tsx`
- Modify: `app/components/invitacion/sections/DressCodeSection.tsx`
- Modify: `app/components/invitacion/sections/ItinerarioSection.tsx`
- Modify: `app/components/invitacion/sections/EngancheSection.tsx`
- Modify: `app/components/invitacion/sections/TextoSection.tsx`

**Interfaces:**
- Consumes: `SectionShell` (Task 1).

- [ ] **Step 1: Saludo**

Reemplazar `app/components/invitacion/sections/SaludoSection.tsx` completo:

```tsx
'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'saludo' }>['content']

export default function SaludoSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const n = ctx.companions.length
  const chip = n > 0
    ? `Reservamos lugar para ti + ${n} acompañante${n === 1 ? '' : 's'}`
    : 'Reservamos lugar para ti'

  return (
    <SectionShell variant="band" className="text-center">
      <h2 className="px-2 text-2xl font-semibold text-[#1D1E20] sm:text-3xl" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}, {ctx.guest.name}
      </h2>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#666] sm:text-base">{content.mensaje}</p>
      <span className="mt-6 inline-block rounded-full border border-[#f0e2bf] bg-[#fffbf0] px-4 py-2 text-xs font-medium text-[#8a6d2f]">
        {chip}
      </span>
    </SectionShell>
  )
}
```

- [ ] **Step 2: Detalles (2 columnas en desktop)**

Reemplazar `app/components/invitacion/sections/DetallesSection.tsx` completo:

```tsx
'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { formatFecha } from '../format'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'detalles' }>['content']

export default function DetallesSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const fecha = formatFecha(ctx.event.event_date)
  const { venue, address, event_time } = ctx.event
  const mapsUrl = content.mostrar_mapa && address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null

  if (!fecha && !event_time && !venue && !address) return null

  return (
    <SectionShell variant="band">
      <h2 className="px-2 text-center text-xl font-semibold text-[#1D1E20] sm:text-2xl" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(fecha || event_time) && (
          <div className="rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">
              <Calendar size={13} className="text-[#d4a853]" /> Cuándo
            </p>
            {fecha && <p className="mt-1.5 text-sm capitalize text-[#1D1E20]">{fecha}</p>}
            {event_time && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[#666]">
                <Clock size={13} /> {event_time}
              </p>
            )}
          </div>
        )}

        {(venue || address) && (
          <div className="rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#999]">
              <MapPin size={13} className="text-[#d4a853]" /> Dónde
            </p>
            {venue && <p className="mt-1.5 text-sm text-[#1D1E20]">{venue}</p>}
            {address && <p className="mt-1 text-sm text-[#666]">{address}</p>}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs font-medium text-[#48C9B0] underline underline-offset-2"
              >
                Ver en el mapa
              </a>
            )}
          </div>
        )}
      </div>
    </SectionShell>
  )
}
```

- [ ] **Step 3: Dress code**

Reemplazar `app/components/invitacion/sections/DressCodeSection.tsx` completo:

```tsx
'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { isDressCodeConfigured, resolveNivelLabel, resolveNivelDesc } from '@/lib/dresscode'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'dress_code' }>['content']

export default function DressCodeSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const dc = ctx.dressCode

  if (!dc || !isDressCodeConfigured(dc)) {
    if (ctx.mode !== 'preview') return null
    return (
      <SectionShell variant="band" className="text-center">
        <p className="rounded-xl border border-dashed border-[#e0e0e0] bg-white px-4 py-6 text-xs text-[#bbb]">
          Configúralo en Estilo → Dress code
        </p>
      </SectionShell>
    )
  }

  const label = resolveNivelLabel(dc)
  const desc = resolveNivelDesc(dc)

  return (
    <SectionShell variant="band" className="text-center">
      <h2 className="px-2 text-xl font-semibold text-[#1D1E20] sm:text-2xl" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>

      {label && <p className="mt-5 text-2xl font-semibold tracking-tight text-[#1D1E20]">{label}</p>}
      {desc && <p className="text-xs text-[#999]">{desc}</p>}

      {dc.colores_sugeridos.length > 0 && (
        <>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-[#999]">Colores sugeridos</p>
          <div className="mt-2 flex justify-center gap-2">
            {dc.colores_sugeridos.map((c, i) => (
              <span
                key={i}
                className="h-7 w-7 rounded-full border border-black/10"
                style={{ background: c.hex }}
                title={c.nombre}
              />
            ))}
          </div>
        </>
      )}

      {dc.colores_evitar.length > 0 && (
        <>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-[#999]">Evita</p>
          <div className="mt-2 flex justify-center gap-2">
            {dc.colores_evitar.map((c, i) => (
              <span
                key={i}
                className="h-7 w-7 rounded-full border border-[#e0e0e0]"
                style={{ background: c.hex }}
                title={c.nombre}
              />
            ))}
          </div>
        </>
      )}

      {dc.recomendaciones.length > 0 && (
        <p className="mx-auto mt-6 max-w-md rounded-xl border border-[#f0e2bf] bg-[#fffbf0] px-4 py-3 text-left text-xs leading-relaxed text-[#1D1E20]">
          {dc.recomendaciones.join('. ')}.
        </p>
      )}

      {dc.nota_libre.trim() && (
        <p className="mx-auto mt-3 max-w-md text-left text-xs leading-relaxed text-[#666]">{dc.nota_libre}</p>
      )}

      {(dc.guia_ellas?.trim() || dc.guia_ellos?.trim()) && (
        <div className="mx-auto mt-5 grid max-w-md gap-2 text-left sm:grid-cols-2">
          {dc.guia_ellas?.trim() && (
            <div className="rounded-xl bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Ellas</p>
              <p className="mt-0.5 text-xs text-[#666]">{dc.guia_ellas}</p>
            </div>
          )}
          {dc.guia_ellos?.trim() && (
            <div className="rounded-xl bg-white px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Ellos</p>
              <p className="mt-0.5 text-xs text-[#666]">{dc.guia_ellos}</p>
            </div>
          )}
        </div>
      )}

      {(dc.fotos_ellas.length > 0 || dc.fotos_ellos.length > 0) && (
        <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-4">
          {([['fotos_ellas', 'Ellas'], ['fotos_ellos', 'Ellos']] as const).map(([field, titulo]) =>
            dc[field].length > 0 ? (
              <div key={field}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#999]">{titulo}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {dc[field].map((url, i) => (
                    <img key={i} src={url} alt="" className="h-20 w-20 rounded-lg border border-[#e8e8e8] object-cover" />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </SectionShell>
  )
}
```

- [ ] **Step 4: Itinerario**

Reemplazar `app/components/invitacion/sections/ItinerarioSection.tsx` completo:

```tsx
'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { Clock, MapPin } from 'lucide-react'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'itinerario' }>['content']

export default function ItinerarioSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  if (ctx.itinerary.length === 0) {
    if (ctx.mode !== 'preview') return null
    return (
      <SectionShell variant="band" className="text-center">
        <p className="rounded-xl border border-dashed border-[#e0e0e0] bg-white px-4 py-6 text-xs text-[#bbb]">
          Se mostrará cuando configures el itinerario en Timeline
        </p>
      </SectionShell>
    )
  }

  return (
    <SectionShell variant="band">
      <h2 className="px-2 text-center text-xl font-semibold text-[#1D1E20] sm:text-2xl" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>

      <ol className="mx-auto mt-8 flex max-w-md flex-col gap-0">
        {ctx.itinerary.map((item, i) => (
          <li key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fffbf0] text-[#d4a853]">
                <Clock size={13} />
              </span>
              {i < ctx.itinerary.length - 1 && <span className="my-1 w-px flex-1 bg-[#e8e8e8]" />}
            </div>
            <div className="pb-6">
              <p className="text-xs font-semibold text-[#d4a853]">{item.start_time}</p>
              <p className="text-sm font-medium text-[#1D1E20]">{item.title}</p>
              {item.location && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[#666]">
                  <MapPin size={12} /> {item.location}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </SectionShell>
  )
}
```

- [ ] **Step 5: Enganche (2 columnas en desktop)**

Reemplazar `app/components/invitacion/sections/EngancheSection.tsx` completo:

```tsx
'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import { Music2, Gift, ChevronRight } from 'lucide-react'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'enganche' }>['content']

export default function EngancheSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const preview = ctx.mode === 'preview'
  const showPlaylist = content.mostrar_playlist && (preview || Boolean(ctx.tokens.playlist))
  const showMesa = content.mostrar_mesa && (preview || Boolean(ctx.tokens.registry))

  if (!showPlaylist && !showMesa) return null

  return (
    <SectionShell variant="band">
      <h2 className="px-2 text-center text-xl font-semibold text-[#1D1E20] sm:text-2xl" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {showPlaylist && (
          <a
            href={ctx.tokens.playlist ? `/playlist/${ctx.tokens.playlist}` : '#'}
            className="flex items-center gap-3 rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4 transition hover:border-[#48C9B0]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fffbf0] text-[#d4a853]">
              <Music2 size={17} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-[#1D1E20]">Arma la playlist</span>
              <span className="block text-xs text-[#666]">Sugiere las canciones que no pueden faltar</span>
            </span>
            <ChevronRight size={16} className="text-[#bbb]" />
          </a>
        )}

        {showMesa && (
          <a
            href={ctx.tokens.registry ? `/mesa/${ctx.tokens.registry}` : '#'}
            className="flex items-center gap-3 rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4 transition hover:border-[#48C9B0]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fffbf0] text-[#d4a853]">
              <Gift size={17} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-[#1D1E20]">Mesa de regalos</span>
              <span className="block text-xs text-[#666]">Consulta las opciones para tu regalo</span>
            </span>
            <ChevronRight size={16} className="text-[#bbb]" />
          </a>
        )}
      </div>
    </SectionShell>
  )
}
```

- [ ] **Step 6: Texto**

Reemplazar `app/components/invitacion/sections/TextoSection.tsx` completo:

```tsx
'use client'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'texto' }>['content']

export default function TextoSection({ content }: { content: Content; ctx: InviteCtx }) {
  if (!content.eyebrow.trim() && !content.titulo.trim() && !content.cuerpo.trim()) return null

  return (
    <SectionShell variant="band" className="text-center">
      {content.eyebrow.trim() && (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4a853]">{content.eyebrow}</p>
      )}
      {content.titulo.trim() && (
        <h2
          className="mt-2 px-2 text-xl font-semibold text-[#1D1E20] sm:text-2xl"
          style={{ fontFamily: "'Josefin Sans', sans-serif" }}
        >
          {content.titulo}
        </h2>
      )}
      {content.cuerpo.trim() && (
        <p className="mx-auto mt-4 max-w-md whitespace-pre-line text-sm leading-relaxed text-[#666] sm:text-base">
          {content.cuerpo}
        </p>
      )}
    </SectionShell>
  )
}
```

- [ ] **Step 7: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 8: Verificación manual (desktop + tablet)**

En `/invitacion/preview/<id>` a ~1280px y ~768px: cada sección se centra en columna cómoda; Detalles y Enganche muestran sus dos tarjetas lado a lado en desktop; nada se ve como tira angosta.

- [ ] **Step 9: Commit**

```bash
git add app/components/invitacion/sections/SaludoSection.tsx app/components/invitacion/sections/DetallesSection.tsx app/components/invitacion/sections/DressCodeSection.tsx app/components/invitacion/sections/ItinerarioSection.tsx app/components/invitacion/sections/EngancheSection.tsx app/components/invitacion/sections/TextoSection.tsx
git commit -m "feat(invitacion): secciones band responsive (saludo detalles dress itinerario enganche texto)"
```

---

### Task 5: Sección RSVP (variante form)

**Files:**
- Modify: `app/components/invitacion/sections/RsvpSection.tsx`

**Interfaces:**
- Consumes: `SectionShell` (Task 1).

- [ ] **Step 1: Envolver RSVP en shell form y soltar los `max-w-sm` internos**

Reemplazar `app/components/invitacion/sections/RsvpSection.tsx` completo:

```tsx
'use client'
import { useState } from 'react'
import type { Section } from '@/lib/invite/schema'
import type { InviteCtx } from '../types'
import type { RsvpSubmission } from '@/lib/invite'
import { Check, X } from 'lucide-react'
import SectionShell from '../SectionShell'

type Content = Extract<Section, { type: 'rsvp' }>['content']

type Row = {
  key: string
  id?: string
  name: string
  attends: boolean | null
  allergies: string[]
}

function buildRows(ctx: InviteCtx): Row[] {
  const guestRow: Row = {
    key: 'guest',
    name: ctx.guest.name,
    attends: ctx.guest.rsvp_status === 'confirmed' ? true : ctx.guest.rsvp_status === 'declined' ? false : null,
    allergies: ctx.guest.allergies,
  }
  const companionRows: Row[] = ctx.companions.map((c, i) => ({
    key: c.id || `companion-${i}`,
    id: c.id,
    name: c.name,
    attends: c.rsvp_status === 'confirmed' ? true : c.rsvp_status === 'declined' ? false : null,
    allergies: c.allergies,
  }))
  return [guestRow, ...companionRows]
}

function AllergyChips({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const v = draft.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setDraft('')
  }

  return (
    <div className="mt-3">
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((a, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-[#f2f2f2] px-2.5 py-1 text-[11px] text-[#666]">
              {a}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                  className="text-[#999] hover:text-[#cc3333]"
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!disabled && (
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commit()
            }
          }}
          onBlur={commit}
          placeholder="Alergia o restricción + Enter"
          className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"
        />
      )}
    </div>
  )
}

export default function RsvpSection({ content, ctx }: { content: Content; ctx: InviteCtx }) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(ctx))
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled = ctx.mode === 'preview' || Boolean(ctx.deadlinePassed)
  const note = ctx.mode === 'preview'
    ? 'Vista previa — así confirmará tu invitado'
    : ctx.deadlinePassed
    ? 'Confirmaciones cerradas'
    : null

  const allChosen = rows.every(r => r.attends !== null)

  const setAttends = (key: string, value: boolean) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, attends: value } : r)))
  }
  const setAllergies = (key: string, allergies: string[]) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, allergies } : r)))
  }

  const handleSubmit = async () => {
    if (!ctx.onSubmit || disabled || !allChosen || submitting) return
    const [guestRow, ...companionRows] = rows
    const payload: RsvpSubmission = {
      guestAttends: Boolean(guestRow.attends),
      guestAllergies: guestRow.allergies,
      companions: companionRows.map(r => ({
        id: r.id,
        name: r.name,
        attends: Boolean(r.attends),
        allergies: r.allergies,
      })),
    }
    setSubmitting(true)
    setError(null)
    try {
      await ctx.onSubmit(payload)
      setSubmitted(true)
    } catch {
      setError('No pudimos guardar tu confirmación. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SectionShell variant="form">
      <h2 className="px-2 text-center text-xl font-semibold text-[#1D1E20] sm:text-2xl" style={{ fontFamily: "'Josefin Sans', sans-serif" }}>
        {content.titulo}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-[#666]">{content.texto}</p>

      <div className="mt-8 flex flex-col gap-4">
        {rows.map(row => (
          <div key={row.key} className="rounded-2xl border border-[#e8e8e8] bg-white px-5 py-4">
            <p className="text-sm font-medium text-[#1D1E20]">{row.name}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setAttends(row.key, true)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  row.attends === true
                    ? 'border-[#48C9B0] bg-[#48C9B0]/10 text-[#2a7a50]'
                    : 'border-[#e8e8e8] text-[#666]'
                }`}
              >
                <Check size={14} /> Sí
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setAttends(row.key, false)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  row.attends === false
                    ? 'border-[#cc3333] bg-[#fff0f0] text-[#cc3333]'
                    : 'border-[#e8e8e8] text-[#666]'
                }`}
              >
                <X size={14} /> No
              </button>
            </div>

            <AllergyChips
              value={row.allergies}
              onChange={v => setAllergies(row.key, v)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      {note && <p className="mt-5 text-center text-xs text-[#999]">{note}</p>}
      {error && <p className="mt-3 text-center text-xs text-[#cc3333]">{error}</p>}

      {!submitted && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !allChosen || submitting}
          className="mt-6 block w-full rounded-full bg-[#48C9B0] py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Enviando…' : 'Confirmar asistencia'}
        </button>
      )}

      {submitted && (
        <p className="mt-6 text-center text-sm font-medium text-[#2a7a50]">¡Gracias por confirmar!</p>
      )}
    </SectionShell>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Verificación manual**

En `/invitacion/preview/<id>` a desktop: el bloque RSVP queda centrado y angosto (ancho de formulario `max-w-lg`), no estirado a todo el ancho. Los botones Sí/No y el input de alergias se ven bien.

- [ ] **Step 4: Commit**

```bash
git add app/components/invitacion/sections/RsvpSection.tsx
git commit -m "feat(invitacion): seccion rsvp como formulario centrado responsive"
```

---

### Task 6: Verificación final a tres anchos

**Files:** ninguno (solo verificación; commit de pulido si hace falta).

- [ ] **Step 1: Barrido visual**

Con `npm run dev`, abrir `/invitacion/preview/<id>` y revisar a tres anchos con las devtools:
- Móvil (~390px): idéntico o mejor que antes; todo en una columna, sin overflow horizontal.
- Tablet (~768px): columnas cómodas, Detalles/Enganche en 2 columnas, hero con aire.
- Desktop (~1280px): portada/cierre full-bleed, cuerpo centrado, RSVP angosto.

- [ ] **Step 2: RSVP funcional (ruta pública real)**

Si hay un evento con invitación publicada e invitado con `rsvp_token`, abrir la ruta pública real `/invitacion/<slug>/<token>` y confirmar que el flujo RSVP sigue funcionando (elegir Sí/No, agregar alergia, Confirmar asistencia → "¡Gracias por confirmar!"). Esto valida que envolver en `SectionShell` no rompió la interacción. Si no hay datos publicados a la mano, dejar anotado para verificar en preview de Vercel.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit de pulido (si aplica)**

Si el barrido reveló ajustes (espaciados, un `max-w` que no cuadra), aplicarlos y:

```bash
git add -A
git commit -m "fix(invitacion): pulido responsive tras barrido de tres anchos"
```

---

## Verificación de la spec (cobertura)

- Full-bleed hero portada/cierre → Task 3.
- Cuerpo centrado en columna que crece (band) → Task 4.
- RSVP como formulario centrado → Task 5.
- Quitar `max-w-[480px]` → Task 3, Step 1.
- Primitiva `SectionShell` única fuente de verdad → Task 1.
- Botón "Vista completa" + ruta preview chrome-free owner-only → Task 2.
- No tocar preview del editor con frame de teléfono → respetado (no se edita ese bloque).
- Verificación manual a tres anchos → Task 6.
- Fuera de scope (imagen de portada, epic de estilo, otras mejoras UI) → no incluido.
