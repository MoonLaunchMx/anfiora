# RSVP en página — Invitación digital por invitado

**Fecha:** 2026-07-06
**Estado:** Diseño aprobado sección por sección, pendiente de review del spec escrito
**Rama sugerida:** `feat/rsvp-invitacion`

## 1. Objetivo

Darle a cada evento una **invitación digital** que el anfitrión comparte por WhatsApp. Cada invitado recibe **su propio link personalizado**: al abrirlo la página ya sabe quién es y con cuántos acompañantes está invitado, y confirma su asistencia (por él y sus acompañantes) en un toque, sin login. La página además muestra los detalles del evento (cuándo, dónde, mapa, itinerario, código de vestimenta) y engancha a las páginas públicas que ya existen (playlist y mesa de regalos).

Es **agnóstica al tipo de evento** (bodas, corporativos, cumpleaños, etc.): nada de "boda" hardcodeado.

Referencia de UX/tono: Partiful (simplicidad de RSVP), aterrizado a la estética y al sistema de datos que Anfiora ya tiene.

## 2. Modelo elegido (por qué)

Se eligió el modelo de **página personalizada por invitado (link único)** sobre el de página pública abierta tipo Partiful, porque Anfiora ya tiene una lista de invitados curada y estructurada (`guests` con `party_size`, `party_members` como acompañantes, `allergies`, `tags`, `side`). El anfitrión controla la lista; el link único aprovecha ese dato para dar cero fricción y máxima sensación premium, y escribe de vuelta a las mismas tablas.

## 3. Alcance

### Dentro de v1
- Página pública del invitado en ruta con token por invitado.
- Confirmar asistencia del invitado **y de sus acompañantes ya cargados** (escribe a `guests` y `party_members`).
- Alergias/restricciones (chips) y nota libre por invitado.
- Info del evento: cuándo, dónde + "cómo llegar" (mapa), hora.
- Itinerario del día y código de vestimenta: **se muestran si el dato existe** (lo produce otro agente); si no, la sección no aparece.
- Enganche a **playlist** (`event_settings.playlist_token` → `/playlist/[token]`) y a **mesa de regalos** (`event_settings.registry_token` → `/mesa/[token]`).
- Pantalla de configuración del anfitrión ("Invitación", nueva entrada de nav) con vista previa, contenido editable y reparto de links.
- Envío de links por **WhatsApp** (copiar + enviar, 1-a-1 o selección múltiple) reusando el sistema de plantillas del guest list.
- Tarjeta de preview (OpenGraph) para que el link, al pegarse en WhatsApp, muestre nombre del evento + fecha + portada.

### Fuera de v1 (futuro)
- Foto de portada personalizable (v1 usa una portada por defecto elegante según tipo de evento).
- Galería de fotos/video.
- Hoteles / hospedaje recomendado.
- Envío por correo.
- Agregar acompañantes por encima de los reservados por el anfitrión.

## 4. Las dos superficies

### 4.1 Página del invitado (pública, sin login)
Un scroll mobile-first, estética Anfiora (crema `#FBF7F0`, Josefin Sans display, General Sans body, CTA teal `#48C9B0`), siguiendo el patrón de `/playlist/[token]` y `/mesa/[token]`. Secciones, de arriba a abajo:

1. **Portada** — nombre(s) del evento resueltos de forma agnóstica, fecha y lugar. Portada por defecto en v1 (degradado/monograma), foto personalizable en el futuro.
2. **Saludo personalizado** — "Hola, {nombre}" + chip con lugares reservados ("reservamos lugar para ti + N acompañante(s)").
3. **Confirmar asistencia** — una fila por persona (invitado + cada acompañante reservado). Pills Asisto / No podré. El nombre del acompañante es editable. Chips de alergias/restricciones y nota libre. CTA "Confirmar asistencia" + fecha límite.
4. **Los detalles** — Cuándo (fecha + hora), Dónde (venue + address + "cómo llegar"), Código de vestimenta (si existe el dato).
5. **Itinerario del día** — timeline hora/título/subtítulo (si existe el dato).
6. **Sé parte de la fiesta** — tarjetas de enganche a playlist y mesa de regalos (solo las activadas y que tengan token).
7. **Cierre** — firma del/los anfitrión(es) + "Hecho con Anfiora".

Estados especiales: token inválido o invitación en borrador → página amable de "invitación no disponible"; fecha límite pasada → detalles visibles pero bloque de confirmar en modo lectura ("confirmaciones cerradas").

### 4.2 Pantalla de configuración del anfitrión (privada)
Nueva entrada de nav del evento: **"Invitación"** (`item`, no group). Una sola pantalla:

- **Estado:** Borrador / Publicada + botón "Publicar invitación" (al publicar se generan los `rsvp_token` que falten).
- **Vista previa** en vivo (teléfono) de lo que verá el invitado.
- **Contenido editable:** mensaje de bienvenida, fecha límite para confirmar, toggles de secciones (playlist, mesa de regalos). Itinerario y dress code se muestran solos si el dato existe; aquí solo se ve un aviso "se mostrará cuando lo configures en Timeline".
- **Reparto de links:** lista de invitados; por cada uno, link individual con **copiar** y **enviar por WhatsApp** (dropdown de plantillas, con plantilla nueva "Te comparto la invitación: {link}"), 1-a-1 o selección múltiple. Columna de estado de confirmación (quién ya respondió desde la página).

## 5. Modelo de datos

**Sin tablas nuevas** (respeta el límite de 17). Cambios aditivos:

### Campos nuevos (propios de esta feature)
- `guests.rsvp_token TEXT UNIQUE` — token corto e impredecible (~8-12 chars, alfabeto sin ambigüedades) por invitado. Alimenta el link. Se genera al publicar la invitación (o al crear un invitado si ya está publicada). No se usa el UUID del invitado (evita exponerlo y permite revocar/regenerar).
- `event_settings.invite_config JSONB` — toda la config de la pantalla del anfitrión en un solo campo:
  ```jsonc
  {
    "publicada": false,
    "mensaje_bienvenida": "Nos encantaría que nos acompañes...",
    "fecha_limite": "2026-02-28",      // ISO date o null
    "mostrar_playlist": true,
    "mostrar_mesa": true
  }
  ```

### Datos que se leen de otros agentes (render-if-present; dependencias externas)
- **Código de vestimenta / mood board:** otro agente lo construye como **mood board** (probablemente imágenes/paleta, no solo texto). Ubicación y forma a coordinar. La invitación renderiza esa sección de forma flexible según lo que ese agente guarde (texto o mood board de imágenes); si no hay dato, no aparece.
- **Itinerario del día:** producido y configurado desde el feature de **Timeline** por otro agente. Forma esperada a coordinar: array ordenado de `{ hora, titulo, subtitulo? }` (p. ej. `event_settings.day_itinerary JSONB`). La invitación solo lo lee.

### Datos existentes que se consumen (sin cambios)
- `events`: `name`, `event_date`, `event_time`, `event_type`, `venue`, `address`, `host_name`, `host_name_2`.
- `event_settings`: `playlist_token`, `registry_token`.
- `guests`: `name`, `party_size`, `rsvp_status`, `allergies`, `tags`, `notes`.
- `party_members`: `name`, `rsvp_status`, `allergies`, `tags`, `notes`.

### Escrituras al confirmar (POST)
- `guests`: `rsvp_status` (`confirmed` | `declined`), `allergies`, `notes`.
- `party_members`: upsert por acompañante — `name`, `rsvp_status`, `allergies`.
- `event_audit_log`: vía `logAction` (`guest.rsvp` desde canal web), silent-fail.

## 6. Rutas y API

### Página pública
- **`/invitacion/[slug]/[token]`** — server component con `generateMetadata` (patrón `app/[segment]`), que renderiza un `InvitacionClient.tsx` (`'use client'`).
  - `token` identifica y protege; `slug` es cosmético (derivado del nombre del evento, p. ej. `ana-y-mateo`) para que el link se lea como invitación. Si el slug no coincide, resuelve igual por token (opcional: redirect al slug canónico).
  - `generateMetadata` produce OpenGraph dinámico (título = nombre del evento, descripción con fecha/lugar, imagen = portada) para el preview de WhatsApp.

### API (service role, como `/api/mesa` y `/api/playlist`)
- **`GET /api/invitacion/[token]`** — devuelve solo lo público-seguro para ese token: datos del evento (campos de §5), el invitado (`name`, `party_size`, `rsvp_status`, `allergies`, `notes`), sus `party_members`, itinerario, dress code, y flags/tokens de playlist y mesa. **Nunca** otros invitados, teléfonos, ni notas internas.
- **`POST /api/invitacion/[token]`** — recibe la respuesta y ejecuta las escrituras de §5. Idempotente: reabrir el link muestra el estado actual y permite cambiarlo hasta la fecha límite.

## 7. Identidad y seguridad
- Token impredecible por invitado; sin login. La ruta `/invite/[token]` NO se reusa (ya es la de colaboradores) — por eso `/invitacion/...`.
- Toda lectura/escritura pública pasa por los API routes con service role, estrictamente acotada al invitado de ese token y a los campos públicos del evento.
- El API valida: token existe → invitación `publicada` → (para POST) fecha límite no vencida. Respuestas 404/410 amables, nunca stack traces.

## 8. Comportamiento agnóstico al tipo de evento
Función pura `resolveInviteHeading(event)`:
- Si `host_name` y `host_name_2` → "`host_name` & `host_name_2`".
- Si solo `host_name` → `host_name`.
- Si ninguno → `event.name`.
El kicker ("Nuestra boda" / "Te invitamos" / etc.) se deriva de `event_type` con un default neutral. Copy sin acentos solo en commits; en UI **con** acentos y ñ.

## 9. Convivencia con el agente omnicanal
WhatsApp/Telegram (agente IA) y esta página escriben a los mismos `rsvp_status`. La página es un canal más de confirmación; no rompe ni duplica el flujo omnicanal. El estado que muestra el link siempre refleja el `rsvp_status` actual, venga del canal que venga.

## 10. Lógica pura testeable (Vitest)
Extraída a `lib/invite.ts`, cubierta en `lib/invite.test.ts`:
- `generateRsvpToken()` — longitud, alfabeto sin ambigüedades, unicidad estadística.
- `slugifyEvent(event)` — nombre/anfitriones → slug URL-safe.
- `resolveInviteHeading(event)` — los tres casos de §8.
- `defaultInviteConfig()` y merge/validación de `invite_config`.
- `buildRsvpUpdate(payload)` — mapea la respuesta del invitado a los updates de `guests`/`party_members`, incluyendo el caso sin acompañantes y el de fecha límite vencida (rechaza).

## 11. Plan de verificación (local → preview → main)
La UI y los endpoints con I/O se verifican manual. **Nada toca Supabase hasta que el código esté pusheado** (regla de sincronía Supabase↔Vercel).
1. `npm test` verde (lógica pura).
2. Local (localhost:3000): crear evento con invitado + acompañantes → configurar y **publicar** la invitación → abrir `/invitacion/{slug}/{token}` → confirmar (variando: asiste/no, con/sin acompañantes, alergias, nota) → verificar en Supabase que `rsvp_status`/`allergies`/`notes` de `guests` y `party_members` quedaron correctos → probar token inválido, borrador y fecha límite vencida → probar copiar/enviar link por WhatsApp → verificar preview OG.
3. Aplicar SQL aditivo en Supabase (después del push): `guests.rsvp_token`, `event_settings.invite_config`.
4. Preview (Vercel) → main.

## 12. Dependencias externas (otros agentes trabajando en paralelo)
- **Código de vestimenta / mood board:** otro agente lo construye como mood board. Esta feature solo lo lee. Coordinar ubicación y forma del dato (texto vs imágenes/paleta).
- **Itinerario del día:** otro agente lo construye y lo configura dentro de **Timeline**. Esta feature solo lo lee. Coordinar ubicación y forma del dato (`{ hora, titulo, subtitulo? }[]`).

Mientras esos datos no existan, las secciones correspondientes simplemente no se renderizan.

**Riesgo de colisión de archivos:** los tres agentes tocan el mismo repo. Esta feature limita sus ediciones en archivos compartidos a lo mínimo: `app/events/[id]/layout.tsx` (una NavItem) y `lib/types.ts` (tipos aditivos). Todo lo demás vive en archivos propios (`app/invitacion/**`, `app/api/invitacion/**`, `app/events/[id]/invitacion/**`, `lib/invite.ts`).

## 13. Mapa de archivos afectados
```
app/
  invitacion/[slug]/[token]/
    page.tsx                 → server component + generateMetadata (OG dinámico)
    InvitacionClient.tsx     → 'use client', UI del invitado + confirmar
  api/invitacion/[token]/
    route.ts                 → GET (datos públicos) + POST (confirmar), service role
  events/[id]/
    layout.tsx               → nueva NavItem "Invitación"
    invitacion/page.tsx      → pantalla de configuración del anfitrión (preview + editar + reparto de links)
lib/
  invite.ts                  → lógica pura (token, slug, heading, config, rsvp update)
  invite.test.ts             → Vitest
  types.ts                   → InviteConfig, DayItinerary, rsvp_token en Guest, dress_code en Event
SQL (aditivo, aplicado por Diego tras push):
  ALTER guests ADD rsvp_token
  ALTER event_settings ADD invite_config
```

## 14. Fuera de alcance explícito
Portada con foto, galería, hoteles, correo, y agregar acompañantes extra. Dress code e itinerario los construyen otros agentes; aquí solo se leen.
