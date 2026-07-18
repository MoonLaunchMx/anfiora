# Fase 4 v1 — Cobro por transferencia manual

**Fecha:** 2026-07-17
**Estado:** aprobado en brainstorm (mockup validado por Diego), pendiente de plan de implementación
**Padre:** `docs/superpowers/specs/2026-07-14-flujo-invitados-publicos-privados-design.md`

## Por qué existe esta v1

Una clienta real (hoy en Wix, página bonita sin backend) necesita **cobrar por su página** esta semana. Anfiora gana por el combo que Wix no tiene: el ERP debajo (lista, cupos, quién pagó) + la invitación como página web. La monetización de Anfiora sigue siendo el software ($1,000/mes); **Anfiora no toca el dinero ni cobra comisión** — el invitado deposita por fuera, el planner confirma.

Esta v1 aterriza **solo el candado del dinero, en su versión manual (transferencia)**. Es la Fase 4 del spec padre, pero re-cortada porque la Fase 3 (aprobación) fue descartada y ya no existe la maquinaria en la que la Fase 4 original se apoyaba.

## Qué cambia respecto al spec padre (los cortes)

El spec padre ordenó Fase 3 (aprobación) → Fase 4 (dinero). **La Fase 3 se descartó**, así que la Fase 4 se para sola y se le quita peso:

| Pieza del spec padre | Decisión en esta v1 | Por qué |
|---|---|---|
| Columna `access_status` | **Fuera.** El estado se deriva de `paid_at`. | Sin aprobación, "dentro" es simplemente "gratis o pagó". No hace falta una columna de estado. |
| Apartado con `hold_expires_at` (reloj 24h) | **Fuera.** | Para transferencia manual y volumen bajo con el planner mirando, el reloj es maquinaria cara para un riesgo casi nulo. Se agrega después si el sobrecupo se vuelve real. |
| Aprobación (`requires_approval`, 4 pestañas, bulk) | **Fuera.** | La clienta quiere cobrar, no aprobar. |
| Lista de espera | **Fuera.** | No la pidió nadie. |
| Rename `registry_payment_info → payment_info` | **Fuera.** Se reusa `registry_payment_info` tal cual. | El rename es cosmético y tocaría mesa de regalos. La misma cuenta del anfitrión sirve para ambos. |
| 4 pestañas del planner ("te toca a ti"…) | **Fuera.** La lista de siempre se adapta. | Ver "Lado planner". |

## Modelo de datos

### `guests` — 2 columnas nuevas

| Columna | Tipo | Vacío significa |
|---|---|---|
| `amount_due` | numeric | no debe nada (evento gratis) |
| `paid_at` | timestamptz | no ha pagado |

`ticket_price` y `guest_cap` ya existen en `events`. No se agrega nada en `event_settings`.

### Estado derivado (sin columna)

- **`dentro`** = evento gratis (`amount_due` nulo/0) **o** (`amount_due > 0` y `paid_at` puesto).
- **`pendiente_pago`** = `amount_due > 0` y `paid_at` nulo.

### Reglas de dinero

- **`amount_due` se congela al registrarse:** `ticket_price × party_size` (party_size incluye al que se registra: 1 + acompañantes). Si mañana sube el boleto, la deuda de quien ya se registró no cambia hacia atrás.
- **El cupo cuenta solo a los `dentro`.** Un `pendiente_pago` no ocupa lugar. Riesgo aceptado: si muchos pagan a la vez con el cupo casi lleno, podría sobrevenderse — improbable a volumen bajo. Sin apartado que lo prevenga (decisión explícita).
- **La puerta pública dice "agotado"** cuando los `dentro` llegan a `guest_cap`, y deja de aceptar registros. Reusa la lógica de cupo de la Fase 2, cambiando "ocupa" de "todas las filas" a "solo las dentro" cuando hay precio.

## Lado del invitado — la puerta con precio

Reusa `/invitacion/[slug]/[token]` en modo compartido. El slot del bloque RSVP gana dos estados cuando el evento tiene precio (mockup validado):

1. **Registro** — nombre, WhatsApp, cuántos vienen, y el total calculándose al vuelo (`precio × personas`). El botón dice **"Apartar mi lugar"** (en vez de "Registrarme"/"Confirmar").
2. **Pendiente de pago** — tarjeta con: cuánto debe, los datos bancarios con **Copiar** (render de `mesa/[token]` tal cual), botón **"Ya pagué — enviar comprobante"** que abre WhatsApp hacia el planner, y "Pagar con tarjeta · Próximamente" como texto muerto.
3. **Dentro** — la tarjeta verde de siempre + la invitación completa abierta.

El endpoint `app/api/invitacion/[token]/registro/route.ts` calcula y guarda `amount_due` al crear al invitado (solo si el evento tiene `ticket_price`). Sigue sin devolver el token al navegador anónimo.

**La liga pública converge con el flujo directo:** una sola liga (`shared_token`). En cuanto alguien se registra por ella, nace su fila con su propio `rsvp_token` (dedupe por teléfono). De ahí en adelante se rastrea idéntico a un invitado de boda — no hay "tracking de público" aparte.

## Lado del planner — la lista de siempre, adaptada

En `app/events/[id]/page.tsx`. **La lista se adapta sola: las columnas de cobro aparecen solo si el evento tiene `ticket_price`.** Sin precio, la lista se ve exactamente como hoy (cero cambio para el 90% que no cobra). No hay picker de columnas en v1 (eso es fast-follow).

Cuando hay precio:
- **Chip por fila:** "Debe $X" (dorado `#d4a853`) en pendientes, "Pagado" (teal `#48C9B0`) en los que ya.
- **Filtro "Por cobrar"** en la barra de filtros existente, para trabajar la fila de comprobantes.
- **Acción "Confirmar pago"** por fila → pone `paid_at = now()`, voltea el chip, suma al cupo. Reversible ("deshacer").
- **KPI "Cobrado / Por cobrar / Cupo"** en las stats colapsables (`StatsCollapse`) que ya existen.

Sin pestañas nuevas, sin `access_status`, sin bulk nuevo.

**Captura de la cuenta:** en `AccesoPanel`, bajo "Precio por persona", un bloque **"¿A qué cuenta te pagan?"** que abre el `PaymentMethodModal` existente y escribe al mismo `event_settings.registry_payment_info`. Un solo lugar de datos bancarios, dos entradas (mesa de regalos + puerta).

## Lógica pura (Vitest)

- `montoAPagar(ticketPrice, partySize)` → congela `amount_due`.
- `estadoAcceso(guest, ticketPrice)` → `'dentro' | 'pendiente_pago'`.
- `ocupaLugar(guest, tienePrecio)` → para el cálculo del cupo (solo `dentro` cuando hay precio; todas las filas cuando es gratis, como la Fase 2).

## El flag

Hoy `CANDADOS_PUERTA_LISTOS = false` (en `lib/features.ts`) oculta precio **y** aprobación juntos. Se parte en dos:
- `CANDADO_PRECIO_LISTO = true` — prende el campo "Precio por persona" y la captura de cuenta en `AccesoPanel`.
- `CANDADO_APROBACION_LISTO = false` — la aprobación sigue oculta hasta que exista o se descarte formalmente.

`normalizeAccessFields` deja de forzar `ticket_price` a null; sigue forzando `requires_approval` a false mientras `CANDADO_APROBACION_LISTO` sea false, y en modo `privada` todo va a null como hoy.

## Las tasks (4)

Cada una se para sola y se verifica local → preview → main.

1. **Migración + tipos + lógica pura.** 2 columnas en `guests`, `lib/types.ts`, las 3 funciones puras + tests. (Migración antes del código, como manda la regla de columnas nuevas.)
2. **Puerta con precio (invitado).** Split del flag, "Apartar mi lugar", tarjeta pendiente-de-pago con CLABE + botón WhatsApp, `amount_due` en el endpoint de registro, cupo que cuenta solo dentro.
3. **Lista del planner adaptada.** Chip, filtro "Por cobrar", "Confirmar pago" (+ deshacer), KPIs. Todo condicionado a que el evento tenga precio.
4. **Captura de cuenta en AccesoPanel.** Reusar `PaymentMethodModal` contra `registry_payment_info`.

## Fuera de alcance (v1)

Apartado/reloj de 24h, aprobación de solicitudes, lista de espera, pago con tarjeta en línea (Stripe/MP), subir comprobante en la página, rename de la columna, aviso automático al confirmar, picker de columnas de la lista.

## Notas de construcción

- **Worktree propio.** Ojo al junction de `node_modules` al borrar el worktree (`git worktree remove` vacía el principal — quitar el junction ANTES).
- El cliente de Supabase no está tipado: `tsc` no valida nombres de columna en inserts. Verificarlos a mano contra la base.
- Orden de migración al revés de la "Regla crítica" de CLAUDE.md: para columnas nuevas, la migración va **antes** que el código.
- Reusar `normalizePaymentMethods`, `RegistryPaymentMethod`, `PaymentMethodModal` y el render con copiar de `mesa/[token]` — ya existen y funcionan.
