# ANF-052 — Playlist v2

Fecha: 2026-06-12. Rama: `feature/ANF-052-playlist-v2` (desde `main`). Todo local hasta OK de Diego.

## Contexto

El playlist funciona pero quedó atrás del resto del producto: la página del planner usa un split view propio en lugar del patrón de tabs de mesa de regalos, la página pública tiene un hero negro que ya no va con la identidad visual (crema + teal de la mesa pública), el límite de 3 canciones está hardcodeado en ~6 lugares, no hay espacio para canciones de los novios, y no hay export para el DJ.

Pre-trabajo ya hecho (no es parte de esta rama): fix de recursión RLS que rompía el link público — corrido en Supabase el 2026-06-12, registrado en `docs/superpowers/plans/anf-052-fix-rls-playlist.sql`.

## Datos (SQL que corre Diego, inerte para prod)

Sin tablas nuevas. Dos columnas y un grant:

```sql
ALTER TABLE event_settings ADD COLUMN IF NOT EXISTS playlist_max_songs INTEGER;
ALTER TABLE song_recommendations ADD COLUMN IF NOT EXISTS is_host_pick BOOLEAN DEFAULT false;

-- ANF-049 dejó el SELECT de anon en event_settings con grant por columna;
-- la página pública necesita leer la nueva columna:
GRANT SELECT (playlist_max_songs) ON event_settings TO anon;
```

Semántica de `playlist_max_songs`:
- `NULL` → se lee como **3** (eventos existentes no cambian de comportamiento)
- `0` → **sin límite**
- `1..10` → límite literal

`is_host_pick = true` marca canciones agregadas por los novios desde el tab "Nuestras canciones". Para esas filas `guest_name` se llena con los nombres de los novios (`host_name & host_name_2`) o `'Los novios'` si no hay nombres.

Las columnas son inertes para el código en prod (`select *` las ignora, nadie las escribe), así que se pueden correr antes del push para probar en local — mismo criterio que ANF-050.

## Página del planner (`/events/[id]/playlist`)

Rediseño con el patrón de mesa de regalos: zona fija (header + stats + `TabToggle` de `app/components/ui/TabToggle.tsx`) y zona scrolleable por tab. Reemplaza el split view actual y el toggle móvil `playlist | config`.

**Tab Playlist** — la lista actual de sugerencias de invitados (`is_host_pick = false`): drag and drop, filtro por etapa, búsqueda, notas inline, preview 30s. Aquí vive el botón **Descargar para DJ** (dropdown: Excel / PDF / M3U). Stats: total canciones, duración total, top repetidas.

**Tab Nuestras canciones** — espacio de los novios: el mismo buscador de Spotify de la página pública (vía `/api/spotify/search`), lista de sus canciones con eliminar y reordenar. Inserta en `song_recommendations` con `is_host_pick = true`. Sin límite de cantidad.

**Tab Configuración** — lo que hoy vive en el panel de config: generar/copiar link, QR del link (nuevo, con `QRCodeCanvas` de `qrcode.react` como en album), etapas (playlist_categories), y el nuevo selector **Canciones por invitado**: pills `1 · 3 · 5 · 10 · Sin límite` (default 3). Guarda `playlist_max_songs` (`0` = sin límite) en `event_settings`.

## Página pública (`/playlist/[token]`)

Restyle completo al lenguaje de la mesa pública (`app/mesa/[token]/page.tsx`), adiós hero negro:

- Fondo `#FBF7F0`, cards blancas `rounded-2xl` borde `#eee4d6`, footer `#F5EFE3` con marca Anfiora.
- Hero centrado: label uppercase "Playlist del evento" (Josefin Sans, tracking ancho), título con nombres de los novios (`host_name & host_name_2`, fallback al nombre del evento), fecha y venue.
- CTAs y acentos en teal `#48C9B0` / `#1a9e88` (reemplaza los botones negros `#111`).
- Sección **"Las canciones de los novios"** arriba de la lista general: cards de las canciones `is_host_pick = true`, con estilo destacado (mismo card pero con acento teal). Solo aparece si hay canciones de novios.
- Lista general de sugerencias debajo, igual que hoy (play preview, etapa, quién la pidió).
- Límite dinámico: la primera query trae `playlist_max_songs`; todos los textos ("Hasta N por persona", contador "x/N", botón "Agregar canción (x de N)") y las validaciones (localStorage + conteo en DB) usan el valor resuelto. Con `0` se ocultan contador y tope.
- Las queries siguen siendo directas con el cliente anon (el fix RLS ya las habilitó); el conteo para el límite excluye `is_host_pick = true`.

## Export DJ (`app/events/[id]/playlist/lib/exports.ts`)

Tres formatos, mismo stack que presupuesto/pagos. Orden: canciones de los novios primero, luego la lista en su orden (position).

- **Excel** (`xlsx`): columnas Orden, Canción, Artista, Etapa, De los novios (Sí/No), Veces pedida, Pedida por, Duración, Link Spotify, Notas. Header con nombre del evento y fecha.
- **PDF** (`jspdf` + `jspdf-autotable`): misma tabla, formato imprimible.
- **M3U** (`.m3u8`, texto plano): `#EXTM3U` + por canción `#EXTINF:<segundos>,<artista> - <título>` y el link de Spotify. Expectativa clara: software de DJ (rekordbox/Serato) no reproduce links de Spotify — sirve como setlist importable y referencia, no como playlist reproducible.

Nombres de archivo: `playlist-dj-<evento>.<ext>`.

## Fuera de alcance (pendiente aparte)

- Hardening de `event_collaborators`: mover la consulta de `/invite/[token]` a un API route con service role y activar RLS en la tabla. Hoy anon puede leer emails e invite_tokens (la escritura ya quedó revocada). Urgente pero independiente de esta rama.
- ANF-050 (toggles) sigue su curso en su propia rama.

## Verificación

1. `npm run dev` local; evento existente sin correr SQL nuevo → playlist se comporta igual que hoy (límite 3, sin sección de novios).
2. Con SQL corrido: configurar límite 5 → página pública en incógnito muestra "Hasta 5", valida al 5°.
3. Agregar canciones en "Nuestras canciones" → aparecen destacadas arriba en la pública y primero en los 3 exports.
4. Sin límite (`0`) → la pública no muestra contador ni bloquea.
5. Exports abren bien: Excel en Excel, PDF en visor, M3U en editor de texto (UTF-8).
