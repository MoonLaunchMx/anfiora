# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server on http://localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
npm test         # Vitest (tests de logica pura)
```

**Testing:** Vitest para logica pura, extraida a funciones testeables (Claude las corre con `npm test`). La UI y los endpoints con I/O (Twilio/Telegram/Supabase) se verifican manualmente por el flujo **local (localhost:3000) -> preview (Vercel) -> main (produccion)**. Anfiora esta en produccion, ya no es un MVP.

## Architecture Overview

**Anfiora.com** is a Next.js 16 (App Router) + React 19 + TypeScript event management platform. It helps organizers manage guest lists, collect RSVPs via WhatsApp (with Claude AI interpretation), run collaborative photo albums and playlists, handle seating charts, food planning, event timelines, budgets, and suppliers.

## Stack (no cambiar)

- **Frontend:** Next.js 16 App Router + TypeScript + Tailwind CSS v4
- **Backend/DB:** Supabase (auth + postgres, free tier, región Oregon)
- **Deploy:** Vercel (auto-deploy desde `main`)
- **WhatsApp:** Twilio (WhatsApp Business API) — activo en webhook y envío de mensajes
- **AI:** Claude Haiku (`claude-haiku-4-5-20251001`) — activo en `lib/ai-rsvp.ts`
- **Analytics:** PostHog (`app/components/PostHogProvider.tsx`)
- **Feedback:** Tally.so — widget flotante (`app/components/FeedbackWidget.tsx`)
- **Animaciones:** Framer Motion
- **Drag and drop:** @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities
- **Spotify:** Spotify Web API (Client Credentials) — búsqueda y preview de canciones
- **Excel export/import:** `xlsx` (SheetJS) — usado en presupuesto y pagos
- **PDF export:** `jspdf` + `jspdf-autotable` — usado en presupuesto y pagos
- **Date picker:** `react-day-picker` v9 + locale `es` — usado en timeline y otros formularios
- **Iconos extra:** `react-icons` (FaWhatsapp, FiInstagram, FiGlobe, FiMail) — complementa Lucide

## Routing Structure

Uses **Next.js App Router** exclusively. Most page components are `'use client'`. Key routes:

- `/` — landing general pública bilingüe es/en (antes vivía en `/landing`, ya no existe)
- `/bodas` — landing específica para bodas (via `[segment]`)
- `/[segment]` — página dinámica de nicho (bodas, eventos-corporativos, etc.)
- `/privacidad` — public privacy policy page
- `/dashboard` — authenticated user dashboard
- `/perfil` — user profile (edit name, phone, change password)
- `/auth/reset` — password recovery flow
- `/invite/[token]` — collaborative event invite acceptance (login or register inline)
- `/events/[id]/` — guest list
- `/events/[id]/mensajes` — WhatsApp hub per event (PRO, three-panel layout)
- `/events/[id]/mesas` — seating chart
- `/events/[id]/comida` — food/shopping planner
- `/events/[id]/timeline` — tasks and reminders (rediseñado: asignación, bloqueante, vínculo a proveedor)
- `/events/[id]/presupuesto` — budget management (partidas por categoría, import/export Excel/PDF)
- `/events/[id]/proveedores` — supplier management (status pipeline, reviews)
- `/events/[id]/pagos` — historial de pagos por evento (PRO, export Excel/PDF, alta de pagos)
- `/events/[id]/album` — collaborative photo album (QR-based)
- `/events/[id]/playlist` — collaborative playlist
- `/events/[id]/configuracion` — event settings + collaborator management
- `/admin` — admin panel
- `/api/webhook/whatsapp` — POST endpoint for Twilio WhatsApp incoming messages
- `/api/whatsapp/send` — POST send WhatsApp message via Twilio
- `/api/spotify/search` — GET Spotify song search (Client Credentials)
- `/api/webhook/test` — POST simulate WhatsApp messages (dev only)
- `/api/debug` — GET check env vars (dev only)
- `/api/admin/users` — GET admin metrics for all users
- `/api/admin/delete-user` — DELETE user (admin only)

## Nav items — sidebar desktop + bottom nav mobile

El nav usa un sistema de **NavEntry** con dos tipos: `item` simple y `group` con sub-items.

| Entrada | Tipo | Sub-items |
|---|---|---|
| Invitados | item | — |
| Mensajes | item (PRO badge) | — |
| Mesas | item | — |
| Timeline | item | — |
| Finanzas | group | Presupuesto, Proveedores (PRO badge), Pagos (PRO badge) |
| Recuerdos | group | Album, Playlist |
| Configuración | item (adminOnly) | — |

- **Sidebar desktop expandido:** grupos muestran header de texto + sub-items indentados
- **Sidebar desktop colapsado:** grupos colapsan en un ícono → navega a `defaultPath`
- **Bottom nav mobile:** grupos colapsan igual, navega a `defaultPath`
- `Comida` está **retirada del catálogo** (`HIDDEN_FEATURES` en `lib/features.ts`): no se ofrece al crear evento ni en Configuración, `resolveFeatures` la fuerza apagada aunque la DB la tenga en true, y la ruta `/comida` sigue viva pero sin botón de activar. Se conserva para el futuro feature de banquete — no borrar página ni datos.

## Data Layer

**Supabase** (PostgreSQL) for all persistence and auth. Two clients:
- `lib/supabase.ts` — browser client using `NEXT_PUBLIC_SUPABASE_*` keys
- API routes use `SUPABASE_SERVICE_ROLE_KEY` for privileged operations

All TypeScript types are defined in `lib/types.ts`. Check there first before querying Supabase.

Role-based access control via `lib/event-access-context.tsx` — exposes `useEventAccess()` hook.

## Schema Supabase (17 tablas)

```sql
-- users: perfiles de planners
users (id, email, full_name, phone, plan)
-- plan: 'free' | 'pro' | 'agency'

-- events: eventos/bodas
events (
  id, user_id, name, event_date, event_end_date, event_time,
  venue, address, event_type, total_guests,
  guest_tags ARRAY,
  event_status TEXT,   -- 'active' | 'paused' | 'cancelled' | 'completed'
  currency TEXT        -- 'MXN' | 'USD' | 'EUR' | 'GBP' | 'COP' | 'ARS' | 'BRL' | 'CLP' | 'PEN'
)

-- event_settings: configuración separada del evento (1-a-1 con events)
event_settings (
  id, event_id,
  message_templates JSONB,
  template_names JSONB,
  album_url TEXT,
  playlist_token TEXT,
  playlist_categories JSONB   -- "etapas" en UI
)

-- guests: invitados
guests (
  id, event_id, name, phone, email, party_size, notes,
  rsvp_status TEXT,
  tags JSONB,
  side TEXT,
  allergies JSONB,
  checked_in BOOLEAN
)

-- party_members: acompañantes de cada invitado
party_members (
  id, guest_id, event_id, name, phone,
  rsvp_status TEXT,
  checked_in BOOLEAN,
  created_at
)

-- wa_messages: historial WhatsApp
wa_messages (id, guest_id, event_id, direction, content, created_at)

-- song_recommendations: playlist feature
song_recommendations (
  id, event_id, guest_id, guest_name, song_title, artist,
  spotify_url, category, position, notes, created_at,
  thumbnail TEXT,
  preview_url TEXT,
  duration_ms INTEGER
)

-- tables: mesas del evento
tables (id, event_id, number, name, capacity, shape TEXT, position_x, position_y, created_at)

-- table_seats: asignación invitado ↔ mesa
table_seats (id, table_id, event_id, seat_number, guest_id, party_size, created_at)

-- event_timeline_tasks: tareas y recordatorios del evento
event_timeline_tasks (
  id, event_id, title, emoji, category,
  task_date, task_time, notes,
  is_highlighted, is_completed,
  reminder_date, created_at,
  -- campos nuevos (rediseño timeline)
  assigned_to_user_id UUID,    -- colaborador asignado (FK users)
  assigned_to_name TEXT,        -- nombre libre si no es colaborador
  event_supplier_id UUID,       -- FK event_suppliers (vinculo a proveedor)
  priority TEXT                 -- 'bloqueante' | 'no_bloqueante'
)

-- event_budgets: partidas del presupuesto del evento
event_budgets (
  id, event_id,
  category TEXT,        -- BudgetCategory (14 valores)
  subcategory TEXT,     -- nombre libre de la partida
  budget_amount NUMERIC,
  event_supplier_id UUID,  -- FK a event_suppliers (nullable)
  notes TEXT,
  created_at
)

-- suppliers: catálogo global de proveedores (por user)
suppliers (
  id, user_id,
  name TEXT,
  contact_name TEXT,
  category TEXT,        -- BudgetCategory
  subcategory TEXT,
  phone TEXT,
  phone_country_code TEXT,
  instagram TEXT,
  facebook TEXT,
  website TEXT,
  email TEXT,
  country TEXT,
  city TEXT,
  state_region TEXT,
  service_radius_km INTEGER,
  general_notes TEXT,
  created_at
)

-- event_suppliers: proveedor vinculado a un evento específico
event_suppliers (
  id, event_id, supplier_id,
  status TEXT,               -- SupplierStatus (4 valores)
  quoted_amount NUMERIC,
  contract_amount NUMERIC,
  event_notes TEXT,
  event_budget_id UUID,      -- FK a event_budgets (nullable)
  rating INTEGER,            -- 1-5
  review_text TEXT,
  mood TEXT,                 -- 'no' | 'normal' | 'love'
  response_speed TEXT,       -- 'lentisimo' | 'normal' | 'bueno' | 'rapidos'
  quote_files JSONB,         -- ArchivoAdjunto[] — cotizaciones en el bucket privado event-docs
  created_at
)

-- supplier_payments: pagos registrados a un proveedor del evento
supplier_payments (
  id, event_supplier_id,
  amount NUMERIC,
  payment_date DATE,
  payment_method TEXT,   -- PaymentMethod
  paid_by TEXT,          -- PaidBy
  reference TEXT,
  receipt_files JSONB,   -- ArchivoAdjunto[] — comprobantes en el bucket privado event-docs
  created_at
)

-- event_collaborators: equipo con acceso al evento
event_collaborators (
  id, event_id, user_id,
  email TEXT,
  role TEXT,             -- CollaboratorRole (4 valores)
  status TEXT,
  invite_token TEXT,
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP
)

-- waitlist_whatsapp: lista de espera para features PRO de mensajes
waitlist_whatsapp (
  id, email TEXT, created_at
)

-- event_audit_log: bitácora de acciones sobre el evento (lectura en /admin)
event_audit_log (
  id, event_id, user_id, user_email, user_name,
  action TEXT,            -- AuditAction: '<entidad>.<accion>' (ver lib/audit.ts)
  entity_type TEXT,       -- 'guest' | 'party_member' | 'table' | 'event' | 'settings' | 'collaborator'
  entity_id UUID,
  entity_label TEXT,      -- label legible: "Juan García", "Mesa 5", etc.
  old_value JSONB,
  new_value JSONB,
  created_at
)
```

### RsvpStatus (6 valores — todos deben estar en STATUS_LABEL/STATUS_COLORS)

```ts
'pending' | 'confirmed' | 'declined' | 'mensaje_enviado' | 'respondio' | 'accion_necesaria'
```

**CRÍTICO:** Cada página que renderiza `rsvp_status` debe tener los 6 valores en su objeto de estilos.

### EventStatus (4 valores)

```ts
'active' | 'paused' | 'cancelled' | 'completed'
```

### SupplierStatus (4 valores)

```ts
'nuevo' | 'cotizado' | 'contratado' | 'descartado'
```

### CollaboratorRole (4 valores)

```ts
'owner' | 'admin' | 'editor' | 'viewer'
```

`owner` es implícito (el creador del evento). Los demás se asignan en la tabla `event_collaborators`. Acceso controlado vía `useEventAccess()` de `lib/event-access-context.tsx`.

### BudgetCategory (14 valores)

```ts
'Planeacion' | 'Venue' | 'Banquete' | 'Bebidas' | 'Audio y Video' | 'Imagen' |
'Decoracion' | 'Ceremonia' | 'Entretenimiento' | 'Papeleria' | 'Logistica' |
'Recuerdos' | 'Digital' | 'Otro'
```

### Currency (9 valores)

```ts
'MXN' | 'USD' | 'EUR' | 'GBP' | 'COP' | 'ARS' | 'BRL' | 'CLP' | 'PEN'
```

### FoodCategory / FoodItem (tipos para comida)

```ts
FoodCategory { id, name, emoji, items: FoodItem[] }
FoodItem { name, amountPerPerson, unit: 'g'|'kg'|'pz'|'L'|'ml' }
```

### TimelineCategory (8 valores) + TimelinePriority (2 valores)

```ts
TimelineCategory: 'evento' | 'tarea' | 'recordatorio' | 'reunion' | 'entrega' | 'pago' | 'comunicacion' | 'otro'
TimelinePriority: 'bloqueante' | 'no_bloqueante'
```

### PaymentMethod (6 valores) + PaidBy (7 valores)

```ts
PaymentMethod: 'transferencia' | 'efectivo' | 'tarjeta_credito' | 'tarjeta_debito' | 'cheque' | 'otro'
PaidBy:        'novia' | 'novio' | 'pareja' | 'papas_novia' | 'papas_novio' | 'familiar' | 'otro'
```

Estos valores son **enums TEXT** en `supplier_payments`. Los selects en `/events/[id]/pagos` y en el modal de proveedor deben usar exactamente estas strings.

## Funciones RPC en Supabase

```sql
increment_guests(event_id_input UUID)
decrement_guests(event_id_input UUID)
increment_guests_by(event_id_input UUID, amount INT)
```

## Estructura de archivos actual

```
app/
├── page.tsx                            → landing general publica bilingue es/en
├── layout.tsx                          → metadataBase + canonical
├── globals.css                         → design tokens + @font-face
├── manifest.ts
├── sitemap.ts                          → genera /sitemap.xml con rutas publicas
├── robots.ts                           → genera /robots.txt bloqueando rutas privadas
├── [segment]/
│   ├── page.tsx                        → server component, maneja generateMetadata por segmento
│   ├── SegmentClient.tsx               → client component con toda la UI del segmento
│   └── config.ts                       → configuracion de contenido por nicho (badge, title, meta)
├── privacidad/page.tsx                 → aviso de privacidad publico
├── dashboard/page.tsx
├── mensajes/page.tsx                   → legacy WhatsApp hub global
├── perfil/page.tsx                     → perfil de usuario (nombre, telefono, password)
├── auth/reset/page.tsx                 → flujo de recuperacion de password
├── invite/[token]/page.tsx             → aceptar invitacion colaborativa (login/register inline)
├── admin/page.tsx
├── playlist/[token]/page.tsx           → pagina publica para invitados (sin login)
├── api/
│   ├── webhook/whatsapp/route.ts       → Twilio incoming messages → Claude Haiku → Supabase
│   ├── webhook/test/route.ts           → simula mensajes WhatsApp (solo dev)
│   ├── debug/route.ts                  → verifica env vars (solo dev)
│   ├── spotify/search/route.ts
│   ├── whatsapp/send/route.ts          → envia mensaje WhatsApp via Twilio
│   └── admin/
│       ├── users/route.ts              → metricas de todos los usuarios
│       └── delete-user/route.ts        → eliminar usuario (admin only)
├── events/
│   ├── new/page.tsx
│   └── [id]/
│       ├── layout.tsx                  → nav grupal (NavItem | NavGroup), sidebar colapsable
│       ├── page.tsx                    → guest list
│       ├── mensajes/page.tsx           → WhatsApp hub por evento (PRO, three-panel)
│       ├── album/page.tsx
│       ├── comida/page.tsx             → planificador de comida/compras
│       ├── mesas/page.tsx
│       ├── timeline/
│       │   ├── page.tsx                → timeline rediseñado, agrupado por mes
│       │   ├── TaskCard.tsx            → tarjeta de tarea + urgencia + iconos categoria
│       │   └── TaskModal.tsx           → modal: asignar, vincular proveedor, recordatorio, bloqueante
│       ├── configuracion/page.tsx      → config evento + gestion de colaboradores
│       ├── playlist/page.tsx
│       ├── presupuesto/
│       │   ├── page.tsx                → presupuesto por categorias, import/export Excel/PDF, seed automatico
│       │   ├── BudgetCategoryRow.tsx   → fila colapsable por categoria con HealthBar
│       │   ├── BudgetItemModal.tsx     → modal nueva partida
│       │   ├── BudgetItemRow.tsx       → fila editable con picker de proveedor inline
│       │   └── lib/
│       │       ├── exports.ts          → exportToExcel + exportToPDF + plantilla descargable
│       │       └── seed.ts             → partidas iniciales para bodas MX
│       ├── proveedores/
│       │   ├── page.tsx                → lista/grid de proveedores con filtros
│       │   ├── SupplierCard.tsx        → card con links WA/IG y status badge + indicador verde/rojo vs presupuesto
│       │   ├── SupplierDetailModal.tsx → modal completo: estado, contacto, comercial, pagos, review
│       │   ├── SupplierModal.tsx       → modal nuevo proveedor (datos esenciales)
│       │   ├── SupplierReviewModal.tsx → modal de review tras contratar/descartar
│       │   ├── SupplierKanbanView.tsx  → vista kanban (WIP)
│       │   └── SupplierListView.tsx    → vista lista (WIP)
│       └── pagos/
│           ├── page.tsx                → historial de pagos del evento (filtros, sort, alta inline)
│           └── lib/
│               └── exports.ts          → exportPagosToExcel + exportPagosToPDF
└── components/
    ├── WhatsAppFAB.tsx
    ├── FeedbackWidget.tsx              → Tally.so floating feedback button (usuarios autenticados)
    ├── PostHogProvider.tsx             → analytics
    ├── WhatsNewModal.tsx               → modal "What's New" (lee lib/changelog.ts, persiste version vista en localStorage)
    ├── auth/AuthModal.tsx
    └── ui/
        ├── BudgetMetricsCards.tsx      → 4 tarjetas: estimado/contratado/pagado/balance
        ├── HealthBar.tsx               → barra de progreso presupuesto (verde/amarillo/rojo)
        ├── StatsCollapse.tsx           → wrapper colapsable de stats por pagina (persiste en localStorage)
        ├── DatePicker.tsx              → DayPicker (react-day-picker, locale es)
        └── TimePicker.tsx              → selector de hora

lib/
├── supabase.ts
├── ai-rsvp.ts
├── event-access-context.tsx           → useEventAccess() hook, CollaboratorRole RBAC
├── audit.ts                            → logAction + AUDIT_ACTION_LABEL (escribe a event_audit_log, silent fail)
├── changelog.ts                        → CURRENT_VERSION + releases para WhatsNewModal
└── types.ts

proxy.ts                                → middleware Next.js 16 (antes middleware.ts) — passthrough

public/
├── fonts/                              → Josefin Sans, Satoshi Variable, General Sans Variable
├── images/                             → logo, isotipo, wa-demo-1/2/3.png (carrusel mensajes hub)
└── icons/                              → icon-192/512, apple-touch-icon, *-maskable (PWA)
```

## Styling

**Tailwind CSS v4** (via `@tailwindcss/postcss`). Design tokens en `app/globals.css`:

```css
--bg:           #ffffff;
--surface:      #f8f8f8;
--surface-alt:  #f2f2f2;
--hover:        #eeeeee;
--border:       #e8e8e8;
--border-strong:#e0e0e0;
--text:         #0a0a0a;
--text-sec:     #666666;
--text-muted:   #999999;
--text-dim:     #bbbbbb;
--accent:       #d4a853;   /* gold */
--accent-dim:   #c49a3a;
--accent-bg:    #fffbf0;
--nav-active:   #f0f0f0;
--error-bg:     #fff0f0;
--error-border: #ffc0c0;
--error-text:   #cc3333;
--success-bg:   #f0fff6;
--success-border:#a0e0c0;
--success-text: #2a7a50;
```

**Nota:** `--teal` (#48C9B0) se usa en UI como color de botones CTA pero no está declarado como var CSS — usar `#48C9B0` directamente o clase Tailwind cuando aplique.

**Fuentes:**
- `General Sans` (variable 200-700) — fuente principal del sistema
- `Satoshi` (variable 300-900) — fuente display
- `Josefin Sans` (600/700) — hero de playlist pública y branding Anfiora
- Usar con `style={{ fontFamily: "'Josefin Sans', sans-serif" }}` — no disponible como clase Tailwind

## AI Integration

`lib/ai-rsvp.ts` calls **Claude** (`claude-haiku-4-5-20251001`) to interpret incoming WhatsApp messages and infer guest RSVP intent. The webhook at `/api/webhook/whatsapp` orchestrates: receive message → Twilio validation → AI interpretation → update `guests` table.

## Auth Pattern

Supabase email/password auth via `AuthModal` component. Session stored client-side (localStorage, NOT cookies). Middleware (`proxy.ts` — renombrado en Next.js 16, antes `middleware.ts`) passes all requests through — auth checks happen inside page components via `supabase.auth.getUser()`.

Password recovery handled at `/auth/reset` using Supabase `PASSWORD_RECOVERY` auth state.

## SEO

- `metadataBase` apunta a `https://anfiora.com` (sin www) en `app/layout.tsx`
- URL canónica declarada en `app/layout.tsx`
- Sitemap registrado en Google Search Console
- Cada segmento tiene su propio `generateMetadata` con `title`, `description`, `canonical` y OpenGraph
- `app/landing/` fue eliminada — ya no existe

## Key Third-Party Services

| Service | Purpose | Env var prefix |
|---|---|---|
| Supabase | DB + Auth | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` |
| Anthropic | RSVP AI | `ANTHROPIC_API_KEY` |
| Twilio | WhatsApp Business API | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WEBHOOK_URL` |
| PostHog | Analytics | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` |
| Spotify | Song search + preview | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |

## Contexto técnico importante

- **event_settings vs events:** `message_templates`, `template_names`, `playlist_token`, `playlist_categories`, `album_url` viven en `event_settings`, NO en `events`.
- **currency en events:** campo `currency` (TEXT) en tabla `events`. Default `'MXN'`. Usar `formatCurrency(amount, currency)` de `lib/types.ts` para mostrar montos.
- **Presupuesto seed:** al cargar `presupuesto` por primera vez (0 partidas), se auto-insertan 10 partidas base para bodas MX (`lib/seed.ts`). Es intencional.
- **Presupuesto ↔ Proveedores:** la conexión es bidireccional. `event_budgets.event_supplier_id` apunta al proveedor vinculado; `event_suppliers.event_budget_id` apunta a la partida. La actualización es manual (el usuario vincula desde ambos lados).
- **Montos derivados:** `contractedByItem` y `paidByItem` en `presupuesto/page.tsx` son calculados en el cliente a partir de `event_suppliers.contract_amount` y suma de `supplier_payments`. No se guardan en `event_budgets`.
- **SupplierDetailModal estilos:** usa `<style jsx global>` con clases `.input-base` y `.country-code-select` — no Tailwind — para los inputs del modal de proveedor.
- **Dos clientes Supabase:** `lib/supabase.ts` (browser) y `SUPABASE_SERVICE_ROLE_KEY` solo en API routes.
- **Twilio WhatsApp:** el webhook valida requests con `validateRequest` de `twilio`. Envío via `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`. El número `TWILIO_WHATSAPP_FROM` tiene prefijo `whatsapp:`.
- **Spotify API:** Client Credentials (sin OAuth). Preview de audio bloqueado por CORS en localhost — funciona solo en producción con HTTPS.
- **CSV encoding:** leer con UTF-8 primero; si hay `?`, releer con `windows-1252`. Excel en México guarda en Windows-1252.
- **Batch insert:** `supabase.from('guests').insert(arrayCompleto)` — nunca loop de inserts individuales.
- **Playlist límite 3 canciones:** localStorage (UX) + conteo por `guest_name` en DB (validación real).
- **Drag and drop playlist:** @dnd-kit con `PointerSensor` (distance: 5) y `TouchSensor` (delay: 200).
- **`import { QRCodeCanvas } from 'qrcode.react'`** — named import, no default.
- **Mensajes hub (/events/[id]/mensajes):** feature PRO. Muestra `ModalProximamente` para broadcast campaigns con signup a `waitlist_whatsapp`. Mensajes manuales sí están activos via `/api/whatsapp/send`.
- **Colaboradores:** invitación por token. El owner crea el invite en `configuracion`, el invitado accede via `/invite/[token]` (login o registro en la misma página). RBAC en `lib/event-access-context.tsx`.
- **Pagos (/events/[id]/pagos):** la página consulta `supplier_payments` con join a `event_suppliers → suppliers` para mostrar nombre/categoría. Permite filtros por método/responsable/proveedor, sort por columna, alta inline (modal nuevo pago) y export Excel/PDF. Los valores de `payment_method` y `paid_by` son enums TEXT en la DB — usar exactamente los valores de `PAYMENT_METHODS` y `PAID_BY_OPTIONS` de `lib/types.ts`.
- **Timeline rediseñado:** las tareas se agrupan por mes. `TaskCard.tsx` calcula urgencia y muestra avatar de asignado + chip de proveedor. `TaskModal.tsx` permite asignar a colaborador (`assigned_to_user_id`) o nombre libre (`assigned_to_name`), vincular a `event_supplier_id`, marcar `priority='bloqueante'` y configurar `reminder_date` con presets estilo Google Calendar (15min, 30min, 1h, 2h, 1d, 2d).
- **Audit log:** `lib/audit.ts` expone `logAction({ eventId, action, entityType, entityId, entityLabel, oldValue, newValue })`. Falla en silencio si no hay sesión o si la inserción peta — nunca debe romper el flujo principal. Las acciones siguen el formato `<entidad>.<accion>` (ver tipo `AuditAction`). El log se lee en `/admin`.
- **Changelog / WhatsNewModal:** `lib/changelog.ts` exporta `CURRENT_VERSION` y un array `changelog`. `WhatsNewModal` se muestra cuando `localStorage.anfiora_seen_version` difiere de `CURRENT_VERSION`. Al agregar un release, actualizar ambos. Iconos vienen de Lucide (`ICON_MAP` en el modal).
- **StatsCollapse:** hook `useStatsToggle(eventId, storageKey)` + componente `<StatsCollapse>` y botón `<StatsToggleButton>`. Persiste preferencia en `localStorage` como `anfiora_stats_<eventId>_<storageKey>`.
- **react-day-picker:** se importa el CSS con `import 'react-day-picker/style.css'` y el locale con `import { es } from 'react-day-picker/locale'`. Componente envuelto en `app/components/ui/DatePicker.tsx`.
- **Middleware → proxy:** Next.js 16 renombró la convención. El archivo en raíz es `proxy.ts` con `export async function proxy(req)` — no `middleware`. Pasa todo through, los checks de auth siguen siendo client-side.
- **generateMetadata + client components:** las pages con `generateMetadata` deben ser server components — el client component se extrae a `SegmentClient.tsx` (patrón usado en `app/[segment]/`).
- **Agregar un nuevo nicho:** solo agregar un objeto a `SEGMENTS` en `app/[segment]/config.ts` y una entrada en `app/sitemap.ts`.
- **Terminal:** Diego usa VS Code con PowerShell en Windows. Evitar caracteres especiales en git commits.
- **Commits:** convencionales — `feat:`, `fix:`, `refactor:` — sin acentos ni ñ.

## i18n

Spanish (`es`) and English (`en`) supported on landing page and auth modal via local state toggle. No external i18n library.

## Diseño y UI/UX

**Actúa siempre como product owner y diseñador UI/UX con 20+ años de experiencia en aplicaciones web responsivas, priorizando simplicidad y efectividad.**

- **Estilo:** flat, limpio, inspirado en Airtable/Notion
- **Solo Tailwind CSS** — no inline styles salvo excepciones justificadas
- **Mobile first** — cards en mobile, tabla en desktop
- **Framer Motion** para animaciones
- **Botones CTA:** siempre en teal `#48C9B0`
- **Negro `#1D1E20`** exclusivamente para dropdowns de filtro
- **Lucide React** para íconos — no SVGs manuales (excepción: play/pause en playlist, iconos WA/IG en proveedores usan `react-icons`)
- **Idioma UI:** español

## Reglas de código

1. **Código completo** — nunca fragmentos, siempre el archivo entero listo para pegar
2. **Un paso a la vez** — terminar y confirmar antes de proponer el siguiente
3. **Full file replacement** — nunca edits parciales
4. **Sin tablas nuevas** en Supabase salvo necesidad real (ya hay 17; evitar crecer más)
5. **Tests con Vitest** para lógica pura; UI y endpoints con I/O se verifican manual (local → preview → main)
6. **Sin comentarios** salvo cuando el WHY es no-obvio

## Reglas para Claude Code (terminal)

**Claude Code debe SIEMPRE:**
1. Preguntar antes de ejecutar cualquier comando que modifique archivos, instale paquetes, o cambie configuración
2. Mostrar el plan completo antes de empezar
3. Esperar confirmación explícita antes de proceder
4. Un cambio a la vez
5. Nunca modificar la DB de Supabase directamente

**Claude Code NUNCA debe:**
- Ejecutar `git push` sin permiso explícito
- Instalar paquetes sin preguntar
- Modificar `lib/types.ts` sin confirmar compatibilidad con todas las páginas que usan ese tipo
- Hacer cambios en Supabase (schema, datos, RLS) sin instrucción directa

## Regla crítica: sincronía Supabase ↔ Vercel

Supabase (DB + datos) se actualiza en vivo. Vercel (código) solo se actualiza con `git push origin main`.

**Nunca modificar datos o schema en Supabase sin tener el código correspondiente ya pusheado.**

Checklist antes de cualquier cambio en Supabase:
1. ¿El código ya está en `origin/main`? Si no → pushear primero
2. ¿Todos los `STATUS_LABEL` / `STATUS_COLORS` tienen el nuevo valor? Si no → actualizar primero
3. ¿`lib/types.ts` está actualizado y no rompe nada?

## Features completados

- **Auth:** email/password Supabase. Auth por página con `supabase.auth.getUser()`. Recuperación de password via `/auth/reset`.
- **Perfil:** editar nombre y teléfono, cambiar password (verificando el actual), ver plan activo.
- **Dashboard:** métricas globales, tarjeta próximo evento, lista eventos con progress bar.
- **Guest List:** tabla desktop / cards mobile. Bulk actions. Modal agregar/editar. CSV import/export. Dropdown WA con plantillas. Tags. Side. Alergias. Acompañantes (party_members).
- **Party members:** filas satélite con línea conectora y color de grupo. RSVP individual. Hasta 15 por invitado.
- **Mesas:** crear/editar/eliminar. Bulk create. Asignar/mover invitados. Check-in. Vista cards y lista. Imprimir lista en PDF.
- **Comida:** planificador de compras por categoría. Soporte multi-día. 4 niveles de intensidad. Tabs desayuno/comida/cena. Compartir por WhatsApp. Split view desktop.
- **Timeline (rediseñado):** tareas agrupadas por mes. 8 categorías con icono. Asignación a colaborador o nombre libre. Vínculo opcional a proveedor. Marcado bloqueante. Recordatorios con presets (15min, 30min, 1h, 2h, 1d, 2d antes). Vista de urgencia (vencidas, hoy, próximas).
- **Album:** instrucciones + QR con `qrcode.react`.
- **Playlist (planner):** lista global con drag and drop. Etapas como badges. Filtro por etapa. Preview audio 30 seg. Notas inline. Botón Spotify. Copiar link.
- **Playlist (pública):** hero negro sticky con Josefin Sans. Búsqueda Spotify. Preview 30 seg. Límite 3 canciones (localStorage + DB). Lista con thumbnails.
- **Mensajes (WhatsApp Hub):** layout three-panel (lista, chat, detalle del invitado). Envío manual de mensajes via Twilio. Broadcast campaigns en waitlist (próximamente). Badge IA en mensajes del agente. Filtro/búsqueda de conversaciones.
- **Webhook WhatsApp:** Twilio → validación de firma → Claude Haiku → Supabase.
- **Colaboradores:** invitar equipo al evento con roles (admin/editor/viewer). Token de invitación via `/invite/[token]` con flow login/register embebido.
- **Landing page:** pública, responsive, bilingüe es/en.
- **PWA:** manifest + iconos. Instalable en mobile.
- **Admin:** métricas de todos los usuarios, gestión de planes, delete user.
- **CSV import:** batch insert, encoding UTF-8/Windows-1252, detección duplicados.
- **CSV export:** incluye acompañantes separados por `|`.
- **Analytics:** PostHog integrado via `PostHogProvider`.
- **Feedback:** widget flotante Tally.so para usuarios autenticados.
- **Presupuesto:** partidas por 14 categorías. Seed automático en primer acceso. Vinculación a proveedor inline (picker). Montos derivados de proveedores (contratado/pagado). HealthBar por categoría y global. Indicador ámbar cuando se supera lo estimado. Import desde Excel con detección de duplicados + plantilla descargable. Export a Excel (xlsx) y PDF (jspdf). Multi-moneda. Toolbar y stats sticky.
- **Proveedores:** pipeline de 4 estados (nuevo/cotizado/contratado/descartado). Cards con links WA/IG e indicador verde/rojo según meta presupuesto. Modal de detalle completo: identidad, contacto, comercial, pagos, notas, archivos (PRO futuro), review. Registro de pagos con método/responsable/referencia. Review post-contratación (estrellas, mood, velocidad) — se omite el modal si el proveedor ya tiene review. Vinculación bidireccional con presupuesto.
- **Pagos:** historial global de pagos del evento. Filtros (método/responsable/proveedor), sort por columna, búsqueda, alta inline via modal nuevo pago, eliminación. Stats colapsables (StatsCollapse). Export Excel y PDF. Vista tabla desktop / cards mobile.
- **Audit log:** cada mutación importante (guests, party_members, tables, event, settings, collaborators) llama a `logAction()` que inserta en `event_audit_log`. Lectura desde `/admin` para auditar quién hizo qué en cada evento.
- **WhatsNewModal:** se muestra una vez por versión nueva. Hoy: rediseño de timeline. Configurado en `lib/changelog.ts`.
- **Privacidad:** página pública `/privacidad` con aviso de privacidad (requisito legal LFPDPPP MX).

## Planes (MXN)

| Plan | Precio | WhatsApp | IA |
|---|---|---|---|
| Free | $0 | wa.me manual | — |
| Pro | $1,990/mes | Número compartido Anfiora | RSVP AI |
| Agency | $3,990–$4,990/mes | Número dedicado | RSVP AI |

Columna `plan` en `users`. Cambio manual en Supabase hasta tener Stripe. Sin modularidad hasta tener clientes pagando.
