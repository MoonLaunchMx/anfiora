# Invitación RSVP — Motor de bloques editables

**Fecha:** 2026-07-07
**Estado:** Diseño aprobado, pendiente de review del spec escrito
**Rama:** `feat/rsvp-invitacion`
**Supersede:** las secciones §4 (superficies) y §5 (config del anfitrión como campos fijos) del spec `2026-07-06-rsvp-pagina-invitacion-design.md`. Todo lo demás de aquel spec (objetivo, modelo de link único por invitado, rutas, seguridad, agnóstico al tipo de evento, convivencia omnicanal) sigue vigente.

## 1. Qué cambia respecto al spec del 6-jul

La invitación deja de ser un conjunto de **secciones fijas** y pasa a ser un **documento de bloques editables**: el anfitrión agrega, quita, reordena y edita cada bloque libremente. El mismo documento se pinta con un **renderer único** tanto en el preview del editor (teléfono) como en la página pública del invitado.

Decisiones tomadas en el brainstorming del 7-jul:
- **Motor de bloques** con el patrón "datos tontos / validación muro / render mapa".
- **Zod acotado** solo al motor nuevo (`lib/invite/`). Cero cambios a parsers existentes.
- **Sin IA.** La estructuración es 100% manual (el usuario arma su invitación).
- **Confirmación abajo** por defecto: el invitado lee primero, confirma después.

## 2. Modelo de datos — el documento

La invitación es un documento guardado en `event_settings.invite_config` (JSONB, aditivo, sin tabla nueva):

```ts
InviteDoc = {
  v: 1,
  meta: {
    publicada: boolean,        // borrador vs publicada
    fecha_limite: string | null // ISO date; null = sin límite
  },
  sections: Section[]
}

Section = { id: string, type: SectionType, content: object }
```

- `id` — UUID por sección. Reordenar/editar/borrar = operaciones sobre el array por `id`.
- `type` — enum cerrado (discriminante).
- `content` — shape distinto por `type`, **con `.default()` en cada campo** (string `''`, number `0`, array `[]`, boolean por campo). Una sección vacía o parcial nunca rompe el render.

Los datos son tontos: cero lógica de layout dentro de `content`. La presentación vive en los componentes.

## 3. Tipos de sección (v1)

Un tipo = un shape. Agregar un tipo nuevo = un case + un componente, sin tocar los demás.

| type | content | Notas |
|---|---|---|
| `portada` | `{ kicker, titulo, subtitulo }` | `titulo` vacío → se resuelve con `resolveInviteHeading(event)`. Fecha y lugar se leen del evento, no se duplican. |
| `saludo` | `{ titulo, mensaje }` | "Hola, {nombre}" lo inyecta el render desde el token. `mensaje` = bienvenida editable. |
| `detalles` | `{ titulo, mostrar_mapa }` | Cuándo/dónde/dirección salen del evento (`event_date`, `event_time`, `venue`, `address`). `mostrar_mapa` togglea el enlace de mapa. |
| `dress_code` | `{ titulo }` | **Referencia render-if-present** a `event_settings.dress_code`. Si no hay dress code configurado, no pinta nada (en el editor muestra aviso "configúralo en Estilo → Dress code"). Vista completa: nivel, colores, recomendaciones, nota, guía ellas/ellos, fotos por género. |
| `itinerario` | `{ titulo }` | **Referencia render-if-present** a `event_itinerary_moments` (tarea #3, aún sin construir). Invisible hasta que exista el dato. |
| `rsvp` | `{ titulo, texto }` | **Bloque interactivo**: confirma asistencia del invitado + acompañantes reservados. Escribe a DB solo en la página pública. `content` = copy; el comportamiento vive en el componente. |
| `enganche` | `{ titulo, mostrar_playlist, mostrar_mesa }` | Tarjetas a playlist (`playlist_token`) y mesa de regalos (`registry_token`). Cada tarjeta solo aparece si su toggle está ON **y** existe el token. |
| `texto` | `{ eyebrow, titulo, cuerpo }` | Bloque libre para lo que el usuario quiera (estacionamiento, hospedaje, notas). |
| `cierre` | `{ titulo, firma }` | Despedida + firma del/los anfitrión(es) + "Hecho con Anfiora". |

**Fuera de v1** (tipos futuros, no se implementan ahora): `galeria`, `portada_foto`.

## 4. Zod — la columna vertebral (acotado)

Se agrega `zod` como dependencia, usada **exclusivamente** en `lib/invite/` (archivos nuevos). Ningún parser existente (`parseDressCode`, `mergeInviteConfig`, etc.) se toca ni se migra.

```ts
// lib/invite/schema.ts
const PortadaContent = z.object({
  kicker:    z.string().default(''),
  titulo:    z.string().default(''),
  subtitulo: z.string().default(''),
})
// ...un *Content por tipo, cada campo con .default()

const Section = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('portada'),    content: PortadaContent }),
  z.object({ id: z.string(), type: z.literal('saludo'),     content: SaludoContent }),
  // ...un objeto por tipo
])

export type Section     = z.infer<typeof Section>
export type SectionType = Section['type']
export type InviteDoc   = z.infer<typeof InviteDoc>
```

- **Tipos derivados del validador** (`z.infer`): validador y tipo TS nunca se desincronizan.
- `CONTENT_BY_TYPE[type].parse({})` produce un `content` con puros defaults.

### Fábrica
```ts
emptySection(type: SectionType, id: string): Section
// = { id, type, content: CONTENT_BY_TYPE[type].parse({}) }
```
"Agregar sección" = `push(emptySection(type, uuid()))`.

### Resolver tolerante
```ts
resolveDoc(raw: unknown): InviteDoc
```
- Parsea `meta` con defaults.
- Itera `raw.sections`; cada una `Section.safeParse(s)` → las válidas se conservan, **las inválidas se descartan en silencio** (nunca lanza). Garantiza IDs únicos.
- Si `sections` viene vacío/ausente → devuelve el **documento por defecto** (§5). El render jamás rompe por datos malos.

## 5. Documento por defecto (seed en memoria)

Cuando un evento no tiene `invite_config` (o está corrupto), `resolveDoc` devuelve este documento inicial, en este orden (confirmación abajo, tras la lectura):

1. `portada` · 2. `saludo` · 3. `detalles` · 4. `itinerario` · 5. `dress_code` · 6. `rsvp` · 7. `enganche` · 8. `cierre`

`itinerario` y `dress_code` son render-if-present: aparecen en la lista del editor pero solo pintan en la invitación si existe su dato. El usuario reordena/quita a gusto. No hay seed en Supabase; es puramente en memoria vía `resolveDoc` (igual que el patrón de defaults del repo).

## 6. Renderer único — preview == público

Un solo componente `InvitacionRenderer({ doc, ctx })` con `switch(section.type)` → componente por tipo. `default:` → placeholder discreto (no crashea) para tipos desconocidos.

```ts
ctx = {
  event, guest, party, dressCode, itinerary,
  tokens: { playlist, registry },
  mode: 'preview' | 'public',
  onSubmit?: (payload) => Promise<void>   // solo en 'public'
}
```

- **Editor (config del anfitrión):** `mode='preview'`, `guest` = "invitado de ejemplo", `onSubmit` inerte (el bloque `rsvp` se ve pero no escribe). Se pinta dentro de un marco de teléfono a la derecha.
- **Página pública:** `mode='public'`, `guest` real resuelto del token, `onSubmit` ejecuta el POST.

Toda la presentación vive en los componentes de sección; **nada de layout vive en los datos**. La personalización ("Hola {nombre}", lugares reservados, estado de confirmación) se inyecta en el render desde `ctx.guest` — no se guarda en el doc (el doc es la plantilla; el invitado es la capa de encima).

## 7. Las dos superficies

### 7.1 Página pública `/invitacion/[slug]/[token]` (sin login)
Server component con `generateMetadata` (OpenGraph dinámico para el preview de WhatsApp) → `InvitacionClient` (`'use client'`) → `InvitacionRenderer` con `mode='public'`. Estética Anfiora (crema, Josefin display, General Sans body, CTA teal).

Estados: token inválido o `meta.publicada=false` → "invitación no disponible"; `fecha_limite` vencida → doc visible pero el bloque `rsvp` en solo lectura ("confirmaciones cerradas").

### 7.2 Config del anfitrión `app/events/[id]/invitacion/page.tsx` (privada)
Patrón editor-izquierda / preview-teléfono-derecha (el mismo que Dress code):

- **Barra superior:** estado Borrador/Publicada + botón **Publicar** (genera los `rsvp_token` que falten) + fecha límite.
- **Editor de bloques (izquierda):** lista de secciones con handle de arrastre (reordenar, `@dnd-kit`), botón quitar, y cada sección expandible para editar sus campos de `content`. Botón "+ Agregar sección" con menú de tipos disponibles. **Autoguardado** del doc a `invite_config` (debounce, patrón de Dress code).
- **Preview (derecha):** `InvitacionRenderer` en vivo con invitado de ejemplo, dentro de marco de teléfono.
- **Reparto de links:** lista de invitados; por cada uno link individual con **copiar** y **enviar por WhatsApp** (reusa plantillas del guest list, 1-a-1 o selección múltiple) + columna de estado de confirmación. (Puede ser una pestaña "Enviar" separada de "Diseño".)

## 8. Rutas y API

- `GET /api/invitacion/[token]` (ya existe; se extiende): devuelve evento (campos públicos), invitado (`name`, `party_size`, `rsvp_status`, `allergies`), sus `party_members`, el `invite_config` resuelto (`resolveDoc`), `dress_code`, itinerario visible (query defensiva; si la tabla no existe → `[]`), y tokens de playlist/mesa. **Nunca** otros invitados, teléfonos ni notas internas.
- `POST /api/invitacion/[token]` (nuevo): recibe la respuesta → `buildRsvpUpdate` (ya construido/testeado) → escribe `guests` (`rsvp_status`, `allergies`) + upsert `party_members` + `logAction('guest.rsvp')` (silent-fail). Idempotente; valida token → publicada → fecha límite no vencida. Sin nota libre del invitado (removida en refactor v1 para no chocar con `guests.notes` interno).

Ambos con service role, acotados al invitado del token (patrón `/api/mesa`, `/api/playlist`).

## 9. Feature toggle

Se agrega la key `invitacion` a `FEATURES` (`lib/features.ts`), **ON por defecto en tipos sociales** (igual que `vestimenta`), y se gatea el NavItem "Invitación" en `layout.tsx` vía `FEATURE_BY_PATH`. Eventos legacy (columna null) la ven (`LEGACY_FEATURES`).

## 10. Modelo de datos y SQL (aditivo, solo tras push)

```sql
alter table guests add column if not exists rsvp_token text unique;
alter table event_settings add column if not exists invite_config jsonb;
```

- `invite_config` ahora guarda el `InviteDoc` completo `{v, meta, sections}`.
- Sin migración: en prod la columna aún no existe; `resolveDoc(null)` produce el doc por defecto.
- `guests.rsvp_token` (~10 chars, alfabeto sin ambigüedades) se genera al publicar. Nunca se expone el UUID del invitado.
- Regla de sincronía Supabase↔Vercel: el SQL se aplica **después** de pushear el código.

## 11. Lógica pura testeable (Vitest)

Se conservan en `lib/invite.ts`: `randomToken`, `slugifyEvent`, `resolveInviteHeading`, `resolveEventKicker`, `buildRsvpUpdate`, e `isInviteOpen` (opera sobre `meta`, que tiene `publicada` + `fecha_limite`).

**Se reemplazan** por el motor de bloques: `InviteConfig` / `defaultInviteConfig` / `mergeInviteConfig` (config plana vieja). Sus campos se redistribuyen: `publicada`/`fecha_limite` → `meta`; `mensaje_bienvenida` → bloque `saludo`; `mostrar_playlist`/`mostrar_mesa` → bloque `enganche`. El re-export en `lib/types.ts` se actualiza de `InviteConfig` a `InviteDoc`.

Nuevo en `lib/invite/` (Zod), cubierto por tests:
- `emptySection(type, id)` — devuelve bloque con puros defaults, válido.
- `resolveDoc(raw)` — meta con defaults; descarta secciones inválidas sin lanzar; doc por defecto cuando viene vacío; IDs únicos.
- Operaciones de array puras: `addSection`, `removeSection(id)`, `moveSection(id, dir|index)`, `updateSectionContent(id, patch)` — todas devuelven un doc nuevo, sin mutar.

## 12. Mapa de archivos

```
lib/
  invite.ts                    → helpers puros (ya existe, intacto)
  invite/
    schema.ts                  → Zod: *Content, Section, InviteDoc, CONTENT_BY_TYPE, tipos z.infer
    doc.ts                     → emptySection, resolveDoc, defaultDoc, ops de array
    doc.test.ts                → Vitest
app/
  invitacion/[slug]/[token]/
    page.tsx                   → server + generateMetadata (OG)
    InvitacionClient.tsx       → 'use client', mode='public'
  api/invitacion/[token]/route.ts → GET (extender) + POST (nuevo)
  events/[id]/
    layout.tsx                 → gating NavItem "Invitación" (FEATURE_BY_PATH)
    invitacion/
      page.tsx                 → config: editor de bloques + preview teléfono + reparto
      (componentes de sección + editor de bloque)
  components/invitacion/
    InvitacionRenderer.tsx     → switch(type) → componente; compartido preview/público
    sections/*.tsx             → un componente por tipo
lib/features.ts, lib/event-types.ts → key 'invitacion' (feature toggle)
lib/types.ts                   → ya trae rsvp_token e InviteConfig (se evolucionará a InviteDoc)
SQL (tras push): guests.rsvp_token, event_settings.invite_config
```

## 13. Fuera de alcance (v1)

Sin IA. Sin foto de portada/galería. Sin edición inline sobre el teléfono (se edita en el panel; el teléfono es preview). Sin correo. Sin acompañantes extra. Sin export PDF. Itinerario se lee cuando exista (tarea #3). No es editor libre tipo Canva: se edita contenido + orden + qué bloques, dentro de la estética Anfiora.

## 14. Reglas de oro (guía de implementación)

- **Datos tontos:** `{id, type, content}` con defaults. Cero lógica en los datos.
- **Validación muro:** Zod + `resolveDoc` que descarta lo inválido en vez de romper.
- **Render mapa:** `type → componente`. Agregar un tipo = un case + un componente.
- **Editar/mover/borrar** = operaciones sobre el array por `id`.
- **El doc es plantilla; el invitado es capa de render** (personalización nunca se guarda en el doc).
- **Preview == público:** un solo renderer, sin ramas de layout duplicadas.
