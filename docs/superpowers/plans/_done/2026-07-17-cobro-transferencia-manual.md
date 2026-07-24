# Cobro por Transferencia Manual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un evento público con precio pueda cobrar por transferencia: el invitado aparta su lugar y ve la CLABE, el planner confirma el pago desde la lista de siempre. Anfiora no toca el dinero.

**Architecture:** Dos columnas nuevas en `guests` (`amount_due`, `paid_at`); el estado "dentro/pendiente de pago" se **deriva** de ellas (sin `access_status`). La lógica pura vive en `lib/puerta.ts`. El invitado ve los estados en `/invitacion/[slug]/[token]` (registro por liga pública + link personal durable). El planner los ve en la lista de invitados existente, que **se adapta sola** cuando el evento tiene precio. Se reusan `PaymentMethodModal` y `event_settings.registry_payment_info` de mesa de regalos.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (service role en API routes), Vitest (lógica pura), Tailwind v4.

## Global Constraints

- **Migración ANTES del código.** El cliente de Supabase no está tipado; `tsc` no valida nombres de columna en inserts, el fallo saldría en runtime. Correr el `.sql` en Supabase antes de desplegar.
- **UI en español CON acentos.** Commits `feat:`/`fix:` SIN acentos ni ñ.
- **Colores Anfiora:** CTA teal `#48C9B0`, dorado `#d4a853`, negro `#1D1E20` solo en dropdowns de filtro. Cero emojis. Iconos Lucide.
- **Sin tablas nuevas.** Solo 2 columnas en `guests`.
- **Reusar, no reinventar:** `PaymentMethodModal`, `normalizePaymentMethods`, `RegistryPaymentMethod`, el render con copiar de `app/mesa/[token]/page.tsx`, y `event_settings.registry_payment_info`.
- **El estado durable del invitado vive en su `rsvp_token` (link personal), no en la liga pública anónima.** La liga solo muestra el estado en la sesión del registro.
- **No commitear a main ni pushear sin permiso explícito de Diego. No tocar Supabase (schema/datos) sin instrucción directa** — la migración la corre Diego.

---

### Task 1: Migración SQL + tipos

**Files:**
- Create: `docs/superpowers/plans/sql/2026-07-17-cobro-transferencia.sql`
- Modify: `lib/types.ts:337-354` (type `Guest`)

**Interfaces:**
- Produces: `guests.amount_due` (numeric, nullable), `guests.paid_at` (timestamptz, nullable). Type `Guest` gana `amount_due?: number | null` y `paid_at?: string | null`.

- [ ] **Step 1: Escribir la migración**

Create `docs/superpowers/plans/sql/2026-07-17-cobro-transferencia.sql`:

```sql
-- Fase 4 v1: cobro por transferencia. Dos columnas de ESTADO en guests.
-- Correr ANTES de desplegar el codigo: el cliente de Supabase no esta tipado,
-- asi que tsc no valida nombres de columna y el fallo saldria en runtime.

alter table guests add column if not exists amount_due numeric;
alter table guests add column if not exists paid_at timestamptz;

-- Verificacion:
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_name = 'guests'
--   and column_name in ('amount_due', 'paid_at');
-- Esperado: 2 filas, ambas is_nullable = YES.
```

- [ ] **Step 2: Agregar los campos al type `Guest`**

En `lib/types.ts`, dentro de `export type Guest = {` (línea 337), agregar antes del cierre `}`:

```typescript
  amount_due?: number | null
  paid_at?: string | null
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos (comparar contra `git stash` si hay preexistentes).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/sql/2026-07-17-cobro-transferencia.sql lib/types.ts
git commit -m "feat(cobro): columnas amount_due y paid_at en guests"
```

> **Nota para el ejecutor:** avisar a Diego que corra el `.sql` en Supabase antes de que este código llegue a preview/main. No correrlo tú.

---

### Task 2: Lógica pura del cobro (TDD)

**Files:**
- Modify: `lib/puerta.ts` (agregar 3 funciones al final)
- Test: `lib/puerta.test.ts` (crear si no existe, o extender)

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `montoAPagar(ticketPrice: number | null | undefined, partySize: number): number`
  - `estadoAcceso(guest: { amount_due?: number | null; paid_at?: string | null }): 'dentro' | 'pendiente_pago'`
  - `ocupaLugar(guest: { amount_due?: number | null; paid_at?: string | null }, tienePrecio: boolean): boolean`

- [ ] **Step 1: Escribir los tests que fallan**

En `lib/puerta.test.ts` (crear el archivo si no existe con el encabezado de imports), agregar:

```typescript
import { describe, it, expect } from 'vitest'
import { montoAPagar, estadoAcceso, ocupaLugar } from './puerta'

describe('montoAPagar', () => {
  it('congela precio por cabeza: 500 x 3 personas = 1500', () => {
    expect(montoAPagar(500, 3)).toBe(1500)
  })
  it('sin precio (null) no se debe nada', () => {
    expect(montoAPagar(null, 3)).toBe(0)
    expect(montoAPagar(undefined, 3)).toBe(0)
  })
  it('precio 0 no debe nada', () => {
    expect(montoAPagar(0, 4)).toBe(0)
  })
})

describe('estadoAcceso', () => {
  it('sin deuda esta dentro', () => {
    expect(estadoAcceso({ amount_due: null, paid_at: null })).toBe('dentro')
    expect(estadoAcceso({ amount_due: 0, paid_at: null })).toBe('dentro')
  })
  it('con deuda y sin pagar esta pendiente', () => {
    expect(estadoAcceso({ amount_due: 1500, paid_at: null })).toBe('pendiente_pago')
  })
  it('con deuda y pagado esta dentro', () => {
    expect(estadoAcceso({ amount_due: 1500, paid_at: '2026-07-17T10:00:00Z' })).toBe('dentro')
  })
})

describe('ocupaLugar', () => {
  it('evento gratis: todos ocupan (como fase 2)', () => {
    expect(ocupaLugar({ amount_due: null, paid_at: null }, false)).toBe(true)
  })
  it('evento con precio: solo los dentro ocupan', () => {
    expect(ocupaLugar({ amount_due: 1500, paid_at: null }, true)).toBe(false)
    expect(ocupaLugar({ amount_due: 1500, paid_at: '2026-07-17T10:00:00Z' }, true)).toBe(true)
  })
})
```

- [ ] **Step 2: Correr los tests para verlos fallar**

Run: `npx vitest run lib/puerta.test.ts`
Expected: FAIL — "montoAPagar is not a function" (o similar).

- [ ] **Step 3: Implementar las 3 funciones**

Al final de `lib/puerta.ts`:

```typescript
// El precio se congela al registrarse: ticket_price x party_size (cabezas).
// Si manana sube el boleto, la deuda de quien ya se registro no cambia hacia atras.
export function montoAPagar(ticketPrice: number | null | undefined, partySize: number): number {
  if (!ticketPrice || ticketPrice <= 0) return 0
  return ticketPrice * partySize
}

// El estado se DERIVA, no hay columna access_status. "dentro" = no debe nada o
// ya pago; "pendiente_pago" = debe y no ha pagado.
export function estadoAcceso(guest: { amount_due?: number | null; paid_at?: string | null }): 'dentro' | 'pendiente_pago' {
  const debe = Number(guest.amount_due) > 0
  if (!debe) return 'dentro'
  return guest.paid_at ? 'dentro' : 'pendiente_pago'
}

// El cupo cuenta cabezas de los que estan dentro. En evento gratis cuenta a
// todos (como fase 2); con precio, solo a los dentro (los pendientes no ocupan).
export function ocupaLugar(guest: { amount_due?: number | null; paid_at?: string | null }, tienePrecio: boolean): boolean {
  if (!tienePrecio) return true
  return estadoAcceso(guest) === 'dentro'
}
```

- [ ] **Step 4: Correr los tests para verlos pasar**

Run: `npx vitest run lib/puerta.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/puerta.ts lib/puerta.test.ts
git commit -m "feat(cobro): logica pura de monto, estado de acceso y ocupacion"
```

---

### Task 3: Prender el precio + captura de cuenta en AccesoPanel

**Files:**
- Modify: `lib/features.ts:15` (split del flag) y `lib/features.ts:150-164` (`normalizeAccessFields`)
- Modify: `app/events/[id]/invitacion/AccesoPanel.tsx`

**Interfaces:**
- Consumes: `PaymentMethodModal` (default export, props `{ isOpen, onClose, onSave: (m: RegistryPaymentMethod) => Promise<void>, initial?: RegistryPaymentMethod | null }`), `normalizePaymentMethods` de `lib/types.ts`.
- Produces: `CANDADO_PRECIO_LISTO = true`, `CANDADO_APROBACION_LISTO = false` exportados de `lib/features.ts`. El campo "Precio por persona" y el bloque "¿A qué cuenta te pagan?" visibles en el panel cuando el modo es `publica`.

- [ ] **Step 1: Partir el flag en `lib/features.ts`**

Reemplazar la línea 15 (`export const CANDADOS_PUERTA_LISTOS = false`) por:

```typescript
// El candado del precio (fase 4) ya existe: se prende. La aprobacion sigue
// oculta hasta que exista o se descarte formalmente.
export const CANDADO_PRECIO_LISTO = true
export const CANDADO_APROBACION_LISTO = false
```

- [ ] **Step 2: Ajustar `normalizeAccessFields` para no forzar el precio a null**

En `lib/features.ts`, la función `normalizeAccessFields` (líneas 150-164) ya deja pasar `ticket_price` cuando el modo es `publica` — no requiere cambio en su cuerpo. Verificar que sigue forzando todo a null en `privada`. (Sin cambios de código en este step; solo confirmación visual de que el `else` devuelve `parsePrice(input.ticketPrice)`.)

- [ ] **Step 3: Actualizar los imports y gates en `AccesoPanel.tsx`**

Cambiar el import de `lib/features` para traer los dos flags nuevos en vez de `CANDADOS_PUERTA_LISTOS`:

```typescript
import {
  ACCESS_MODES, resolveAccessMode, resolveRequiresApproval, normalizeAccessFields,
  resolveMaxCompanions, CANDADO_PRECIO_LISTO, CANDADO_APROBACION_LISTO, type AccessMode,
} from '@/lib/features'
```

En el bloque `persist` (línea ~67), cambiar los gates:

```typescript
const access = normalizeAccessFields({
  ...next,
  ticketPrice: CANDADO_PRECIO_LISTO ? next.ticketPrice : '',
  requiresApproval: CANDADO_APROBACION_LISTO ? next.requiresApproval : false,
})
```

En el JSX: el toggle "Aprobar cada solicitud" queda envuelto en `{CANDADO_APROBACION_LISTO && (...)}` (antes `CANDADOS_PUERTA_LISTOS`); el campo "Precio por persona" y su nota quedan en `{CANDADO_PRECIO_LISTO && (...)}`.

- [ ] **Step 4: Agregar el bloque "¿A qué cuenta te pagan?" bajo el precio**

En `AccesoPanel.tsx`, agregar estado y carga de métodos de pago (reusando el patrón de `mesa-regalos/page.tsx:107-112`): un `useState<RegistryPaymentMethod[]>([])` cargado de `event_settings.registry_payment_info` vía `normalizePaymentMethods`, y `showPayModal`/`editingMethod`. Bajo el bloque de precio (dentro de `{CANDADO_PRECIO_LISTO && ...}`), renderizar una lista compacta de métodos + botón "Agregar cuenta" que abre `PaymentMethodModal`. Al `onSave`, hacer `supabase.from('event_settings').update({ registry_payment_info: { methods } }).eq('event_id', eventId)` (mismo shape que `mesa-regalos/page.tsx:128-133`).

Copy del bloque: título "¿A qué cuenta te pagan?", subtítulo "El invitado verá estos datos para transferirte. Anfiora no procesa el pago."

- [ ] **Step 5: Verificar a mano (local)**

Run: `npm run dev` → abrir un evento público, pestaña Enviar. Expected: el campo "Precio por persona" aparece; agregar una cuenta la persiste y sobrevive recarga; la misma cuenta se ve en mesa de regalos.

- [ ] **Step 6: Commit**

```bash
git add lib/features.ts app/events/[id]/invitacion/AccesoPanel.tsx
git commit -m "feat(cobro): prende precio por persona y captura de cuenta en acceso"
```

---

### Task 4: La puerta con precio (lado invitado)

**Files:**
- Modify: `app/api/invitacion/[token]/registro/route.ts` (congelar `amount_due` al registrar; cupo cuenta solo dentro)
- Modify: `app/api/invitacion/[token]/route.ts` (exponer `ticketPrice`, métodos de pago, y estado de pago del invitado)
- Modify: `app/invitacion/[slug]/[token]/RegistroForm.tsx` (total al vuelo + "Apartar mi lugar")
- Create: `app/invitacion/[slug]/[token]/PagoPendiente.tsx` (tarjeta pendiente de pago con CLABE + WhatsApp)
- Modify: `app/invitacion/[slug]/[token]/InvitacionClient.tsx` (montar el estado pendiente de pago tras registro y en link personal)

**Interfaces:**
- Consumes: `montoAPagar`, `estadoAcceso`, `ocupaLugar` (Task 2); `occupiedSeats`, `seatsLeft` (existentes).
- Produces: el endpoint de registro guarda `amount_due`; la API devuelve `ticketPrice`, `paymentMethods` y (para link personal) `amountDue`/`paidAt`; el invitado ve la tarjeta de pago cuando debe.

- [ ] **Step 1: Congelar `amount_due` en el registro y ajustar el cupo**

En `app/api/invitacion/[token]/registro/route.ts`:

1. Ampliar el select del evento a incluir `ticket_price`:
```typescript
const { data: event } = await db
  .from('events')
  .select('event_type, guest_cap, ticket_price')
  .eq('id', settings.event_id)
  .maybeSingle()
```
2. Importar `montoAPagar` y `ocupaLugar` de `@/lib/puerta`.
3. Cambiar el cálculo de `libres` para contar solo a los que ocupan cuando hay precio. Traer también `amount_due, paid_at`:
```typescript
const tienePrecio = Number(event.ticket_price) > 0
const { data: all } = await db
  .from('guests')
  .select('party_size, amount_due, paid_at')
  .eq('event_id', settings.event_id)
const ocupantes = (all || []).filter(g => ocupaLugar(g, tienePrecio))
const libres = seatsLeft(event.guest_cap ?? null, occupiedSeats(ocupantes))
// Con precio, la puerta bloquea solo cuando ya no quedan lugares (agotado):
// los pendientes no ocupan, asi que no se bloquea por party_size.
if (libres !== null && (tienePrecio ? libres <= 0 : reg.partySize > libres)) {
  return NextResponse.json({ error: 'sin_lugar', quedan: libres }, { status: 409 })
}
```
4. En el `insert` de `guests`, agregar `amount_due`:
```typescript
amount_due: montoAPagar(event.ticket_price, reg.partySize),
```

- [ ] **Step 2: Verificar el cupo con precio a mano**

Run: script `.mjs` con service role desde la raíz (patrón de fase 2) o `npm run dev` + registrar. Expected: en evento con precio, un registro nuevo queda con `amount_due = precio × party_size` y NO ocupa lugar hasta que `paid_at` se llene.

- [ ] **Step 3: Exponer precio, métodos de pago y estado en la API de lectura**

En `app/api/invitacion/[token]/route.ts`: agregar al payload (modo compartido y personal) `ticketPrice` (de `events.ticket_price`) y `paymentMethods` (de `event_settings.registry_payment_info` vía `normalizePaymentMethods`). Para el **token personal** (cuando hay `guest`), incluir también `amountDue` (`guest.amount_due`) y `paidAt` (`guest.paid_at`), para que el link personal pinte el estado durable. Seguir SIN devolver el token al navegador anónimo.

- [ ] **Step 4: Crear la tarjeta `PagoPendiente.tsx`**

Create `app/invitacion/[slug]/[token]/PagoPendiente.tsx`: componente que recibe `{ amount: number; methods: RegistryPaymentMethod[]; waHref: string }` y pinta: cuánto debe, los métodos con botón Copiar (reusar el patrón de `app/mesa/[token]/page.tsx:357-468`, `RegistryPaymentMethod` + `payTypeMeta`), el botón verde "Ya pagué — enviar comprobante" (abre `waHref`), y el texto muerto "Pagar con tarjeta · Próximamente". Estilos Tailwind con tokens Anfiora.

- [ ] **Step 5: Total al vuelo + copy del botón en `RegistroForm.tsx`**

En `RegistroForm.tsx`: recibir `ticketPrice?: number | null` por props. Si hay precio, mostrar la fila "Total (N personas × $precio) = $monto" recalculada con el selector de acompañantes, y cambiar el label del botón a "Apartar mi lugar" (sin precio queda "Registrarme"/el copy actual). `InvitacionClient.tsx` le pasa `ticketPrice` desde `data`.

- [ ] **Step 6: Montar el estado pendiente en `InvitacionClient.tsx`**

En `InvitacionClient.tsx`:
- **Registro por liga (compartida):** tras registrar en evento con precio, en vez de la tarjeta verde "ya estás dentro", mostrar `<PagoPendiente>` (en sesión). `handleRegistrado`/`RegistroForm` deben saber el monto que quedó (calcularlo cliente con `montoAPagar(ticketPrice, partySize)`).
- **Link personal:** cuando `data.guest` existe y `estadoAcceso({ amount_due: data.amountDue, paid_at: data.paidAt }) === 'pendiente_pago'`, pintar `<PagoPendiente>` en el slot RSVP en vez de la caja RSVP Sí/No. Si `=== 'dentro'` y hay precio, pintar la tarjeta verde.
- `waHref`: `https://wa.me/<telefono_planner>?text=...` con el nombre del evento (reusar si ya hay helper; si no, armar el string).

- [ ] **Step 7: Verificar el flujo del invitado a mano (local)**

Run: `npm run dev`. Expected: liga pública de evento con precio → registro → tarjeta con CLABE + copiar + botón WhatsApp; abrir el link personal de esa persona → misma tarjeta (durable); tras marcar `paid_at` a mano en la base → el link personal muestra "ya estás dentro".

- [ ] **Step 8: Commit**

```bash
git add app/api/invitacion app/invitacion/[slug]/[token]
git commit -m "feat(cobro): puerta con precio - apartar lugar, pendiente de pago con CLABE"
```

---

### Task 5: La lista del planner, adaptada

**Files:**
- Modify: `app/events/[id]/page.tsx` (chip, filtro "Por cobrar", acción "Confirmar pago", KPIs — todo condicionado a que el evento tenga precio)

**Interfaces:**
- Consumes: `estadoAcceso` (Task 2); `guest.amount_due`, `guest.paid_at` (Task 1); `events.ticket_price`.
- Produces: la lista muestra columnas de cobro solo si `Number(ticketPrice) > 0`.

- [ ] **Step 1: Cargar `ticket_price` y las columnas nuevas**

En `app/events/[id]/page.tsx`: incluir `ticket_price` en el select del evento y `amount_due, paid_at` en el select de `guests`. Derivar `const tienePrecio = Number(event?.ticket_price) > 0`.

- [ ] **Step 2: Chip de estado por fila (solo si `tienePrecio`)**

Donde se renderiza cada invitado (tabla desktop y cards mobile), cuando `tienePrecio`, agregar un chip: `estadoAcceso(guest) === 'pendiente_pago'` → "Debe {formatCurrency(guest.amount_due, currency)}" en dorado (`#d4a853` sobre `#fdf7ea`); `=== 'dentro'` con `amount_due>0` → "Pagado" en teal. Usar `formatCurrency` de `lib/types.ts`.

- [ ] **Step 3: Filtro "Por cobrar"**

En la barra de filtros existente, agregar (solo si `tienePrecio`) un filtro "Por cobrar" que muestra las filas con `estadoAcceso === 'pendiente_pago'`. Seguir el patrón del dropdown/chip de filtros que ya vive en la página (negro `#1D1E20` si es dropdown).

- [ ] **Step 4: Acción "Confirmar pago" (+ deshacer)**

Por fila pendiente, botón "Confirmar pago" que hace `supabase.from('guests').update({ paid_at: new Date().toISOString() }).eq('id', guest.id)` y refresca. En filas ya pagadas, mostrar "Confirmado · deshacer" (deshacer pone `paid_at: null`). Registrar en audit con `logAction` (`entityType: 'guest'`, acción de pago) siguiendo el patrón de la página.

- [ ] **Step 5: KPIs de cobro (solo si `tienePrecio`)**

En las stats colapsables (`StatsCollapse` / `useStatsToggle`), agregar tres cifras cuando `tienePrecio`: Cobrado (suma `amount_due` de los pagados), Por cobrar (suma `amount_due` de los pendientes), Cupo (cabezas de los `dentro` / `guest_cap`). Usar `formatCurrency`.

- [ ] **Step 6: Verificar a mano (local)**

Run: `npm run dev`. Expected: evento sin precio → lista idéntica a hoy (cero chip/filtro/KPI de cobro); evento con precio → chips Debe/Pagado, filtro "Por cobrar", "Confirmar pago" voltea el chip y sube el KPI, deshacer lo revierte.

- [ ] **Step 7: Commit**

```bash
git add app/events/[id]/page.tsx
git commit -m "feat(cobro): la lista muestra deuda, cobro y confirmar pago cuando hay precio"
```

---

## Self-Review

**Spec coverage:**
- Modelo de datos (2 columnas, estado derivado) → Task 1 + Task 2. ✓
- Reglas de dinero (congela `amount_due`, cupo cuenta solo dentro, agotado) → Task 2 (puro) + Task 4 (endpoint). ✓
- Lado invitado (3 estados, liga converge, link personal durable) → Task 4. ✓
- Lado planner (lista adaptada, chip, filtro, confirmar, KPIs) → Task 5. ✓
- Captura de cuenta reusando PaymentMethodModal → Task 3. ✓
- Flag split → Task 3. ✓
- Lógica pura testeable → Task 2. ✓
- Fuera de alcance (apartado, aprobación, lista espera, rename, tarjeta) → no aparece en ninguna task. ✓

**Type consistency:** `montoAPagar`/`estadoAcceso`/`ocupaLugar` con las mismas firmas en Task 2 (definición), Task 4 y Task 5 (consumo). `amount_due`/`paid_at` como `number|null`/`string|null` en Task 1 y consumidos igual después. ✓

**Placeholders:** los steps de UI sobre archivos grandes (`page.tsx`, `InvitacionClient.tsx`) describen el cambio con anclas exactas y código completo para las unidades nuevas (funciones puras, `PagoPendiente`, bloque de cuenta, snippets de endpoint); la integración sigue patrones citados por archivo:línea. Sin "TBD"/"add error handling"/"similar a Task N".

## Riesgo abierto (anotado, no bloquea)

Sobrecupo posible en evento con precio: los pendientes no ocupan, así que si muchos pagan a la vez con el cupo casi lleno podría pasarse — riesgo aceptado por Diego (sin apartado en v1). Si aparece, el apartado con `hold_expires_at` es el remedio y ya está diseñado en el spec padre.

---

# Enmienda al plan (17-jul, tarde) — Reconciliación + config por publicar + cuenta propia

Las Tasks 1-5 quedaron **completas y revisadas** (commits `723e551..43a0c8c`). Esta enmienda agrega la reconciliación con la reestructura TabToggle y las tasks del enhancement de la enmienda del spec. **Van en esta misma rama, antes del merge.** Ver spec: sección "Enmienda (17-jul, tarde)".

**Constraint nueva:** la rama de cobro debe **absorber la reestructura primero** (Task R) — hasta entonces el `AccesoPanel` que las Tasks 7-8 tocan **no existe en su forma final** en este árbol. Por eso las tasks del enhancement se describen a nivel archivos + interfaces + enfoque; el código exacto se afina al implementar, contra el `AccesoPanel` ya reconciliado.

### Task R: Reconciliar la reestructura TabToggle

**No es TDD — es git + verificación.** Objetivo: la rama de cobro construye sobre la invitación NUEVA (3 pestañas, AccesoPanel en Configuración).

- [ ] Traer `origin/feat/puerta-publica-invitados` a la rama de cobro (merge). Handoff: `docs/HANDOFF-invitacion-tabtoggle.md`.
- [ ] Resolver el conflicto de `app/events/[id]/invitacion/page.tsx`: **conservar las 3 pestañas** (`Diseño · Enviar · Configuración` vía `TabToggle`), con `AccesoPanel` bajo **Configuración** y el contenido de precio/CLABE del cobro adentro. En "Enviar" solo `RepartoLinks`. **No** reintroducir el switcher negro ni el acceso en "Enviar".
- [ ] Correr `npx tsc --noEmit`, `npx vitest run` (verde), y verificar a mano que la Fase 4 sigue funcionando sobre la estructura nueva (el precio/CLABE ahora se ven en la pestaña Configuración).
- [ ] Commit del merge/reconciliación.

### Task 6: Plomería del doc — `meta.access` + publicar + dirty

**Files:** `lib/invite/schema.ts` (o donde vive `InviteDoc`), `lib/invite/publicacion.ts` (+ su test), `app/events/[id]/invitacion/page.tsx` (`handlePublish`).
**Interfaces — Produces:** `doc.meta.access = { guest_cap: number|null; ticket_price: number|null; max_companions: number|null; cobro_payment_methods: RegistryPaymentMethod[] }` en el schema; `hayCambiosSinPublicar` incluye `meta.access`; `handlePublish` aplica `meta.access.{guest_cap,ticket_price,max_companions}` a las columnas (`events`, `event_settings`).

- [ ] **TDD:** extender `lib/invite/publicacion.ts` test — un cambio en `meta.access` marca `hayCambiosSinPublicar = true`; reordenar llaves NO lo marca (usa `stable`). Ver el patrón de `contenido()` que ya hashea `{v, theme, sections, fecha_limite}` → agregar `access`.
- [ ] Agregar `access` al schema/tipo del doc (`meta.access`), con `resolveDoc` rellenando defaults (todo null / array vacío) para docs viejos.
- [ ] Extender `contenido()` en `publicacion.ts` para incluir `meta.access` en el hash. Correr el test → verde.
- [ ] En `handlePublish` (`invitacion/page.tsx`): además de copiar `invite_draft→invite_config`, escribir `doc.meta.access.guest_cap`/`ticket_price` a `events` y `max_companions` a `event_settings`. `cobro_payment_methods` ya viaja dentro del doc publicado (no necesita columna). Commit.

### Task 7: `AccesoPanel` edita el borrador (no en vivo), cuenta de cobro propia

**Files:** `app/events/[id]/invitacion/AccesoPanel.tsx` (ya reconciliado en Task R), `app/events/[id]/invitacion/page.tsx` (pasar `doc`/`updateDoc` al panel).
**Interfaces — Consumes:** `doc.meta.access` (Task 6), `updateDoc` del page. **Produces:** el panel edita cupo/acompañantes/precio/cuenta en el borrador; el modo sigue en vivo.

- [ ] `page.tsx` pasa a `AccesoPanel` el `doc` (borrador) y un handler para actualizar `meta.access` (que llame `updateDoc`, que ya autoguarda al borrador y dispara el dirty/aviso).
- [ ] `AccesoPanel`: **cupo, acompañantes, precio** dejan de escribir a columnas; ahora leen/escriben `doc.meta.access` vía el handler. Quitar el autosave propio de esos campos.
- [ ] **Cuenta de cobro:** el bloque "¿A qué cuenta te pagan?" escribe a `doc.meta.access.cobro_payment_methods` (NO a `registry_payment_info`). Reusa `PaymentMethodModal`. Copy: deja claro que es la cuenta del cobro de esta invitación.
- [ ] **Modo privada/pública:** se queda escribiendo en vivo a `event_settings.access_mode` (sin cambio).
- [ ] Verificar a mano: editar cupo/precio/cuenta marca "cambios sin publicar"; salir dispara el aviso; publicar los aplica; cambiar el modo NO requiere publicar. Commit.

### Task 8: Lado invitado lee la cuenta del doc publicado

**Files:** `app/api/invitacion/[token]/route.ts`, `app/components/invitacion/PagoPendiente.tsx`.
**Interfaces — Consumes:** `invite_config.meta.access.cobro_payment_methods`.

- [ ] El endpoint de lectura deja de exponer los métodos desde `registry_payment_info`; ahora los toma de `invite_config.meta.access.cobro_payment_methods` (el doc que ya resuelve). `PagoPendiente` los renderiza igual (copiar, etc.).
- [ ] Confirmar que `registry_payment_info` ya **no** se toca para el cobro (Mesa de Regalos intacta).
- [ ] `npx tsc --noEmit` + verificación manual del flujo del invitado (la CLABE que ve viene de la cuenta de cobro, no de mesa de regalos). Commit.

### Nota de migración

Esta enmienda **no agrega columnas** (`meta.access` vive en el doc JSONB existente). Sí requiere, al publicar por primera vez tras el deploy, que `handlePublish` siembre las columnas desde `meta.access`. Para eventos que ya tenían precio/cupo en columnas (de la v1), la carga inicial del editor debe **sembrar `meta.access` desde las columnas actuales** para no borrarlas al publicar. Cubrir eso en Task 6 (defaults de `resolveDoc` / carga del editor).
