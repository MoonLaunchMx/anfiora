# Rediseño del Superadmin: Dashboard + Pagos

**Fecha:** 2026-05-28
**Rama:** feature/ANF-047-event-config-redesign (o rama nueva dedicada)
**Autor:** Diego Garza

## Resumen

Convertir el panel `/admin` actual (2 tabs: Usuarios, Actividad) en un **superadmin tipo consola de SaaS establecido** con 4 secciones: **Resumen, Usuarios, Pagos, Actividad**. Añade una pantalla de inicio con KPIs de negocio + listas accionables, una pestaña nueva de Pagos (ingresos derivados del plan, arquitectura lista para Stripe), y trae los últimos logins reales de Supabase Auth.

## Restricciones duras (no negociables)

- **CERO cambios en Supabase**: ni tablas, ni columnas, ni migraciones, ni RLS, ni datos. Hay usuarios en producción. Todo el panel es **solo lectura**.
- Sin Stripe todavía (entra pronto) — el código debe quedar **Stripe-ready** vía una capa de abstracción.
- Sin tablas nuevas (regla MVP de CLAUDE.md).
- Solo Tailwind, español, estilo flat Airtable/Notion, CTA teal `#48C9B0`, negro `#1D1E20` para dropdowns de filtro, iconos Lucide.
- Acceso restringido al `ADMIN_EMAIL` existente (`diego.garza@moonlaunch.mx`), mismo patrón actual.

## Fuentes de datos (todas existentes)

| Dato | Origen | Nuevo? |
|---|---|---|
| Usuarios (id, email, full_name, plan, created_at) | `users` | ya se trae |
| Eventos (id, user_id, name, created_at) | `events` | ya se trae |
| Invitados (rsvp_status, event_id) | `guests` | ya se trae |
| Acompañantes (event_id) | `party_members` | ya se trae |
| **Último login** (`last_sign_in_at`) | `auth.users` vía `supabaseAdmin.auth.admin.listUsers()` | **nuevo en la API** |
| **Banned real** (`banned_until`) | mismo `listUsers()` | **nuevo** (hoy está hardcodeado a false) |
| Actividad | `event_audit_log` | ya se trae |

`listUsers()` pagina de a 50 por defecto; la API debe iterar páginas (`perPage: 1000`) y hacer merge por `id` con la tabla `users`.

## Arquitectura

### Información (4 tabs)

```
Anfiora Superadmin
├── Resumen   (NUEVO — pantalla de inicio, tab por defecto)
├── Usuarios  (existente, + columna Último login + Estado real)
├── Pagos     (NUEVO)
└── Actividad (existente, sin cambios)
```

### Capa de abstracción de billing — `lib/billing.ts` (NUEVO archivo, sin DB)

Pieza central para que Pagos quede "lista para conectar". Aísla el origen de los datos de cobro detrás de una sola función. Hoy deriva del plan; el día de Stripe se cambia **solo el cuerpo** de la función, la UI no se toca.

```ts
export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 1990,
  agency: 3990,
}

export interface BillingRow {
  userId: string
  email: string
  fullName: string | null
  plan: string
  amountMonthly: number          // real hoy = precio del plan
  status: 'active' | 'past_due' | 'canceled'  // hoy: 'active' para todo plan pagado
  registeredAt: string           // real = users.created_at
  startedAt: string | null       // null hoy → Stripe lo llena ("Cliente desde")
  currentPeriodEnd: string | null // null hoy → Stripe ("Próximo cobro")
  mrrContributed: number         // real = amountMonthly
}

// Hoy: deriva de plan + created_at. Mañana: leer de Stripe (mismo shape).
export function getBillingRows(users: AdminUser[]): BillingRow[]
export function getBillingSummary(rows: BillingRow[]): BillingSummary
```

`BillingSummary`: `{ mrr, arr, payingCustomers, avgTicket, byPlan }` — todos derivables hoy.

**Regla de oro:** nunca pintar un número inventado. Lo desconocible hoy (próximo cobro, past_due real) se renderiza como `—` con tooltip "disponible con Stripe", con la columna ya presente.

## Componentes / Pantallas

### 1. Resumen (tab por defecto)

Tres grupos de tiles compactos (6 por fila, números grandes ~21-25px, mini-gráficas SVG inline — sin librería de charts) + listas accionables.

**El dinero:** MRR (+ % vs mes pasado, sparkline), ARR proyectado, Clientes de pago (+nuevos mes, barras), Churn/downgrades, Conversión free→pago, Distribución de planes (barra proporcional).

**Crecimiento y salud:** Usuarios nuevos (semana, barras), Eventos nuevos (línea), Activos 7d, Activos 30d (línea), Cuentas fantasma (registrados sin evento), Última actividad global.

**Listas accionables (3 paneles):**
- 🔥 **Power users** — top por nº eventos / invitados.
- ⚠️ **En riesgo de churn** — plan de pago + sin login en >30 días (`last_sign_in_at`). Acción: mailto.
- 👋 **Nuevos registros** — últimos altas, marca si ya crearon evento.

**Cálculos** (todos en cliente, sobre datos ya cargados):
- MRR = Σ `PLAN_PRICES[plan]` de usuarios pagados.
- "% vs mes pasado": comparar contra usuarios pagados con `created_at` del mes anterior (aproximación honesta, etiquetada como tendencia de altas, no de cobros).
- Conversión = pagados / total.
- Activos 7d/30d = usuarios con `last_sign_in_at` dentro del rango.
- Fantasma = usuarios con `event_count === 0`.
- En riesgo = plan ≠ free && `last_sign_in_at` > 30d.

### 2. Usuarios (mejora del existente)

Se mantiene tabla/cards + filtros + acciones (plan, ban, delete, mailto, expandible con eventos). Cambios:
- Nueva columna **Último login** (`last_sign_in_at`, con `timeAgo`).
- **Estado real** (banned) desde `listUsers()` en vez de hardcode false.
- Orden adicional: "Último login".

### 3. Pagos (NUEVO)

**Banda informativa** (morada suave): "Datos derivados del plan. Cuando conectes Stripe, esta vista mostrará cobros e invoices reales."

**Tiles de ingresos (reales hoy):** MRR, Clientes activos, Ticket promedio, Distribución por plan. (Se omiten "Cobrado este mes / Pendiente" — requieren Stripe.)

**Tabla por cliente de pago:**

| Columna | Hoy | Con Stripe |
|---|---|---|
| Cliente / email | real | igual |
| Plan | real | igual |
| Monto / mes | real (precio plan) | invoice real |
| Registrado | real (`created_at`) | + "Cliente desde" real |
| Estado | "Activo" derivado | Activo / Past due / Cancelado |
| Próximo cobro | `—` (tooltip) | fecha real |
| MRR aportado | real (= monto/mes) | LTV con historial |

Filtros: Todos / Pro / Agency. Sin acciones de escritura.
A futuro: fila expandible con historial de invoices (placeholder hoy).

### 4. Actividad

Sin cambios funcionales.

## Cambios en archivos

| Archivo | Acción |
|---|---|
| `app/api/admin/users/route.ts` | Añadir `auth.admin.listUsers()` paginado; devolver `last_sign_in_at` y `banned` por usuario (merge por id). Solo lectura. |
| `lib/billing.ts` | **NUEVO** — `PLAN_PRICES`, `getBillingRows`, `getBillingSummary`, tipos. Sin DB. |
| `app/admin/page.tsx` | Refactor: 4 tabs. Nueva pantalla Resumen, nueva pestaña Pagos, columna Último login + estado real en Usuarios. Mini-gráficas SVG inline. |
| (opcional) `app/admin/` componentes | Si `page.tsx` crece demasiado, extraer `ResumenTab.tsx`, `PagosTab.tsx`, `UsuariosTab.tsx` para mantener archivos enfocados. |

## Decisiones de diseño

- **Mini-gráficas con SVG inline**, sin librería nueva (no Recharts) — son sparklines simples; añadir una dependencia no se justifica.
- **Sin caché**: el panel recarga datos on-demand (botón Actualizar), igual que hoy.
- **Stripe-ready por abstracción, no por datos falsos**: un `—` honesto nunca miente; la columna ya existe para el día de Stripe. Costo de hacerlo honesto hoy = cero.
- **% / tendencias** se etiquetan como tendencia de altas (lo que sí sabemos), no como cobros reales.

## Fuera de alcance (YAGNI)

- Integración real con Stripe (entra después; este diseño la habilita).
- Tablas/columnas nuevas en Supabase.
- Multi-admin / roles de superadmin (sigue siendo un solo `ADMIN_EMAIL`).
- Export de métricas, gráficas históricas con rango de fechas, cohortes.
- Impersonar usuario.

## Criterios de éxito

1. `/admin` abre en **Resumen** con KPIs reales calculados de los datos existentes.
2. Pestaña **Pagos** muestra MRR/ARR/clientes y tabla por cliente, todo derivado del plan, con columnas Stripe-ready en `—`.
3. **Usuarios** muestra último login real y estado banned real.
4. **Cero** operaciones de escritura nuevas a Supabase; cero cambios de schema.
5. El día de Stripe, conectar = reescribir el cuerpo de `getBillingRows` (+ llenar 2 columnas), sin tocar la UI.
