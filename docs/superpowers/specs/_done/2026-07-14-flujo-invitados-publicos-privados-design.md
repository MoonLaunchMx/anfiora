# Flujo de invitados: públicos y privados, con pago

**Fecha:** 2026-07-14
**Estado:** aprobado en brainstorm, pendiente de plan de implementación

## El problema

Anfiora sabe manejar invitados **privados**: el planner arma la lista y cada quien recibe su link. No sabe manejar invitados **públicos**: compartir un link donde la gente se apunta sola, con la opción de cobrarles y de aprobarlos.

En `main` ya existen `event_settings.access_mode`, `events.guest_cap` y `events.ticket_price`, pero **nadie los lee** y ni siquiera se pueden editar después de crear el evento. La puerta existe en la base de datos y no existe como producto.

Además, `access_mode` se shipeó con 3 valores (`privada` / `aprobacion` / `abierta`) y el modelo está mal: `abierta` y `aprobacion` son **la misma mecánica con un candado**, no modos hermanos.

## La visión (palabras de Diego)

> "Es la lógica de Ticketmaster, pero de Anfiora."

Anfiora es un ERP de eventos y tiene que soportar que le paguen al anfitrión. **Pero Anfiora no cobra, no toca el dinero y no quiere comisión.** El invitado deposita por fuera; Anfiora lleva el **estado** del pago y construye el flujo.

Llevar el estado del pago **no es** procesar pagos. Es parte del ciclo de vida del invitado, igual que `rsvp_status` ya existe sin que Anfiora llame a nadie por teléfono.

## El embudo

```
se registra  ->  paga  ->  se aprueba  ->  está en la lista
                (candado 1)  (candado 2)
                 opcional     opcional
```

**La regla completa:** estás dentro cuando pasaste **todos los candados que estén prendidos**. Ni uno más.

| Evento | Recorrido |
|---|---|
| Boda privada | El planner lo agrega → dentro. *Es lo que ya funciona hoy; no cambia nada.* |
| Público y gratis | Se registra → dentro |
| Con aprobación | Se registra → el planner aprueba → dentro |
| Con precio, sin aprobación | Se registra → el planner confirma el pago → dentro |
| Con precio y aprobación | Se registra → **un solo gesto**: confirma el pago y aprueba → dentro |

Cuando los dos candados están prendidos, confirmar el pago y aprobar son **un botón**, no dos. Textual de Diego: *"checo que me haya mandado a través de WhatsApp el comprobante y yo lo apruebo"*.

**El día que existan pagos en línea, la tubería no cambia:** hoy el planner escribe "ya pagó" con el comprobante en la mano; mañana lo escribe Mercado Pago. El campo es el mismo, cambia quién lo llena.

## Decisión central: dos carriles

`rsvp_status` responde *¿viene?*. El embudo responde *¿puede entrar?*. **Son dos preguntas y van en dos carriles.**

| Carril | Pregunta | Dónde vive |
|---|---|---|
| RSVP | ¿viene? | `guests.rsvp_status` — **intacto**, sus 6 valores |
| Acceso | ¿puede entrar? | `guests.access_status` — nuevo |

**Por qué:** un 7º valor en `RsvpStatus` toca 35 archivos más el CHECK constraint, y `CLAUDE.md` lo marca como CRÍTICO. Además `pending` significa *"el planner lo agregó y no ha contestado"* — la dirección **contraria** a una solicitud. No caben en la misma columna.

En un evento público, **registrarse es confirmar**: el invitado queda `rsvp_status = 'confirmed'` desde que se apunta, y el embudo corre por su carril.

## Modelo de datos

### `guests` — 4 columnas nuevas

| Columna | Tipo | Valores | Vacío significa |
|---|---|---|---|
| `access_status` | text | `pendiente` \| `en_espera` \| `dentro` \| `rechazado` | **dentro** |
| `amount_due` | numeric | lo que debe, congelado al registrarse | no debe nada |
| `paid_at` | timestamptz | cuándo pagó | no ha pagado |
| `hold_expires_at` | timestamptz | cuándo se libera su apartado | sin apartado |

**`access_status` vacío = `dentro`.** Con eso los 1,570 invitados que ya existen y todos los eventos privados siguen funcionando **sin tocarles un dato**. Mismo patrón que `LEGACY_FEATURES`.

**Por qué columnas en `guests` y no una tabla nueva:** `guests` **ya es** la tabla que une persona con evento (tiene `event_id`; la misma persona en 3 eventos son 3 filas). El embudo es una propiedad de esa relación, igual que `rsvp_status` y `checked_in`, que ya viven ahí. Una tabla 1-a-1 obligaría a un JOIN en la pantalla más cargada sin ganar nada.

**Por qué no JSONB:** todos los JSONB de Anfiora (`invite_config`, `dress_code`, `payment_info`, `agent_config`) son **configuración**: se editan y se pintan completos, nadie los filtra. El embudo es **estado**: se filtra en cada pestaña y se **suma** en cada carga (el cupo). La regla: **JSONB para lo que pintas completo, columnas para lo que filtras y cuentas.**

**Por qué `paid_at` y no `payment_status`:** una fecha da gratis el *cuándo*, que el planner va a querer, y colapsa el estado en un solo dato.

**Por qué `amount_due` se congela:** si mañana subes el boleto de $500 a $700, la deuda de quien ya se registró **cambiaría sola hacia atrás** y el comprobante de $1,500 dejaría de cuadrar. El dinero no se reescribe solo. Mismo criterio para `hold_expires_at`: se calcula al registrarse y se guarda, para poder extenderle el plazo a una persona sin mover a las demás.

### `event_settings` — la puerta

| Columna | Tipo | Para qué |
|---|---|---|
| `requires_approval` | bool | El candado de la aprobación |
| `shared_token` | text | El link público |
| `waitlist_enabled` | bool | Ofrecer lista de espera al llenarse |
| `waitlist_auto` | bool | Si al liberarse un lugar entra el siguiente solo |
| `max_companions` | int | Máximo de acompañantes por registro |

`access_mode` se corrige a **`privada` | `publica`** en `lib/features.ts`. `guest_cap` y `ticket_price` se quedan en `events` y por fin se hacen valer.

**La regla dura sobrevive y se extiende:** en `privada`, `guest_cap`, `ticket_price` y **todos los campos nuevos** van a NULL/false siempre, aunque el usuario los haya escrito antes de cambiar de modo. Vive en `normalizeAccessFields`, que ya hace short-circuit antes de mirar los inputs.

### Métodos de pago: se capturan una vez

`event_settings.registry_payment_info` **se renombra a `payment_info`**. Ya vive a nivel evento y ya soporta `transfer | card | mercado_pago | paypal | zelle | other` con banco, titular y CLABE — o sea, **los pagos en línea ya están modelados**. La mesa de regalos y la puerta usan los mismos datos: es la misma cuenta del anfitrión.

Se reusan los dos componentes que ya existen: `PaymentMethodModal.tsx` (captura) y el render de `app/mesa/[token]/page.tsx` (invitado, con copiar al portapapeles).

## Reglas de negocio

### El cupo es aforo real

**Ocupan lugar: los que están `dentro`, más los que tienen un apartado vivo.** Los `pendiente` sin dinero de por medio **no ocupan** — están pidiendo, no comprando. Cupo 100 con 60 dentro y 50 esperando aprobación = van 60, quedan 40, y tú eliges a los 40 mejores de esos 50.

### El apartado y su reloj

En eventos **con precio**, registrarse aparta el lugar **24 horas** (fijo). Resuelve el caso real: Ana ve que hay lugar, va al banco, y mientras tanto el evento se llena — su dinero llegaría a una fiesta sin lugar para ella. Con pagos en línea sería peor, porque nadie estaría ahí para frenarlo.

**El reloj no necesita ningún proceso corriendo detrás.** Un apartado vencido simplemente deja de contar cuando alguien lee la lista: es comparar `hold_expires_at` contra `now()`. Cero cron, cero infraestructura.

Un apartado vencido **no borra al invitado ni le quita el derecho a pagar tarde** — solo deja de congelar el lugar. Si paga después y hay espacio, entra.

### Acompañantes

**El invitado escribe un número; Anfiora crea las filas.** La puerta pregunta *"¿cuántos vienen contigo?"* y al registrarse se insertan **N filas en `party_members` con el nombre vacío**, más `party_size = 1 + N`.

**Esto no es opcional, es una corrección verificada contra el código.** La verdad sobre los acompañantes en toda la app son las **filas de `party_members`**, no la columna:

- `app/events/[id]/page.tsx:451` pinta `+{guest.party_members.length}`
- `app/events/[id]/mesas/page.tsx:1303` hace `party_size: 1 + members.length`, **ignorando la columna**
- `app/events/[id]/page.tsx:941` ajusta `party_size` a mano al borrar un miembro

`party_size` es un **espejo denormalizado** (invitado + acompañantes), no la fuente. Si la puerta guardara solo `party_size = 3` sin filas, la lista mostraría `+0`, mesas contaría 1 persona y el día del evento no habría a quién darle check-in.

Un acompañante sin nombre es una forma que el modelo **ya soporta**: `party_members.name` tiene default `''`. De regalo, cada acompañante tiene su propio `checked_in` — justo lo que se quiere cuando se cobraron 3 boletos. Y si algún día se quiere el toggle de nombres de Partiful, las filas ya están.

El máximo lo pone el anfitrión y el default sale del **tipo de evento** (`EVENT_TYPES.defaultMaxCompanions`), mismo patrón que `defaultFeatures` y `defaultAccessMode`: boda arranca en 1, conferencia en 0. **Si el máximo es 0, el campo no aparece** — nada de un contador clavado en cero que invita a intentarlo.

Confirmado contra Partiful: el +1 es un conteo (0 a 9, default 1) y pedir nombres es un toggle aparte. Ese toggle **no entra** en esta pasada.

### El precio es por persona

Boleto $500 + 2 acompañantes = **$1,500**. `amount_due = ticket_price × party_size`, donde **`party_size` incluye al que se registra** (1 + acompañantes). Cupo y dinero cuentan igual: por cabeza.

### La lista de espera

Al llenarse, se le **ofrece** entrar a la lista y **él decide** — nadie lo mete solo. Los de la lista **no han pagado nada**. Cuando se libera un lugar: si `waitlist_auto` está prendido entra el siguiente, si no, el planner jala a quien quiera.

**El orden de la fila es `created_at`** — el que llegó primero. Sin columna de posición: la fila ya está ordenada por cuándo se apuntó cada quien, igual que hace Partiful.

**Cuándo se re-evalúa la fila:** al leer la lista (planner) o al abrir el link (invitado). Sin cron, igual que el apartado. Si `waitlist_auto` está prendido y hay lugar, el primero de la fila pasa a `pendiente` (o a `dentro` si el evento es gratis) en ese momento.

**Lista de espera ≠ apartado.** El apartado ya tiene lugar y debe dinero; el de la lista no alcanzó lugar y no debe nada. Son estados distintos y no comparten pestaña.

## La puerta pública

**No es una página nueva.** Es `/invitacion/[slug]/[token]` con el `shared_token` de `event_settings` en vez del `rsvp_token` del invitado.

Hoy `/api/invitacion/[token]/route.ts` resuelve así: token → `guests.rsvp_token` → invitado → `event_id`; si no hay invitado, 404. El cambio es un desvío en la resolución: si el token no es de ningún invitado, se busca en `event_settings.shared_token` y se responde en **modo compartido** — sin invitado. El tema, el dress code, el itinerario y la portada ya cuelgan del `event_id`, así que se pintan igual.

Al registrarse se crea el invitado (**dedupe por teléfono**) y desde ahí esa persona ya tiene **su propio `rsvp_token`**: su link personal, idéntico al de un invitado de boda. **Un evento público se ve tan bonito como una boda, gratis.**

**Seguridad:** `guests` no tiene ninguna política de RLS para `anon` — la llave del navegador no puede insertar invitados ni de chiste. La puerta va por ruta de API con service role, que es **exactamente** lo que ya hace `/api/invitacion/[token]`. **La puerta no abre ninguna superficie anónima nueva.**

**Código donante:** `feat/forms` (HEAD `4ab6f88`, congelada) trae el dedupe por teléfono, el alta de invitado y la página pública con tema heredado. Se canibaliza; la rama no se mergea.

### Lo que ve el invitado

1. **Se registra** — nombre, WhatsApp, cuántos vienen (si el anfitrión lo permite) y el total calculándose al vuelo. El botón dice *"Apartar mi lugar"* cuando hay precio.
2. **Apartado** — su reloj, los datos bancarios con copiar, *"Pagar con tarjeta · Próximamente"* y el botón para mandar el comprobante por WhatsApp.
3. **Dentro** — y debajo se abre la invitación completa: itinerario, dress code, playlist, mesa de regalos.
4. **Lleno** — se le ofrece la lista de espera.

Su link personal **siempre le dice en qué va**: esperando aprobación, falta tu pago, ya estás dentro.

### Lo que ve el planner

La **lista de invitados de siempre**. Sin pantalla nueva: filtros, un KPI y una columna.

Las pestañas se cortan por **de quién es la pelota**:

| Pestaña | Quién |
|---|---|
| **Te toca a ti** | Ya depositaron, falta que valides |
| **Le toca a él** | Apartados con su reloj corriendo, aún deben |
| **Dentro** | Ya pasaron todos los candados |
| **Lista de espera** | No alcanzaron lugar |

Acciones **en lote**, con el patrón de bulk que ya existe. El botón dice **"Confirmar pago y aprobar"**.

Las stats dicen la verdad del modelo: el aforo con la barra partida en dentro (teal) y apartados (dorado), y los que esperan aprobación **aparte y con la leyenda de que no ocupan lugar**.

**Diseño:** tokens de Anfiora (`#48C9B0` CTA, `#d4a853` dorado, `#1D1E20` solo para dropdowns de filtro), cero emojis, íconos Lucide, tabla en desktop y cards en mobile.

### Cómo se entera el invitado

Su link propio muestra el estado, y al aprobar **el planner le avisa con un clic** — el botón de WhatsApp con plantillas que ya existe queda cargado con el mensaje.

**Por qué no automático:** el WhatsApp multi-tenant sigue trabado por Meta. Telegram y push funcionan solos, pero la mayoría llega por WhatsApp y ahí no hay automático: quedaría mudo para casi todos. Prometer un aviso que no sale es peor que no prometerlo.

## Fases

Cada fase se para sola y se puede shipear.

1. **Corregir el modelo y poder editarlo.** `AccessMode` a 2 valores, nace `requires_approval`, y el acceso se edita en `/configuracion`. Nada visible todavía — pero **no se puede shipear una puerta que el anfitrión no puede cerrar**. Bloqueante de todo lo demás.
2. **La puerta pública, gratis.** `shared_token`, modo compartido en la invitación, registro, alta con dedupe (invitado + filas de `party_members`), `max_companions`, y **el cupo se hace valer**: al llenarse, la puerta dice "agotado" y no deja registrar. Sin lista de espera todavía. Aquí se canibaliza `feat/forms`. Se puede shipear solo: un evento público que se ve como una boda.
3. **El candado de la aprobación.** `access_status`, filtros, bulk, "te toca a ti".
4. **El dinero.** `ticket_price` por persona, `amount_due`, `paid_at`, el apartado con `hold_expires_at`, `payment_info` compartido, confirmar pago.
5. **La lista de espera** y su automático.

## Fuera de alcance

- **Cobro real / Stripe / Mercado Pago.** El type ya los contempla; se encienden después. Anfiora no toca el dinero.
- **Nombres de acompañantes en la puerta pública.** El toggle de Partiful no entra.
- **Aviso automático al aprobar.** Trabado por Meta.
- **Pagos parciales.** Diego lo planteó binario ("si me pago o no me pago"). Si aparecen, `supplier_payments` es el molde y `paid_at` pasa a derivarse.
- **PRO / paywall.** Diego asocia cupos y pago a PRO, pero PRO sigue trabado por precios. Se construye sin gatear.

## Deuda apartada (no es de este spec)

Se descubrió al inspeccionar la base y **va a su propio momento**:

- **`forms` y `form_responses` no tienen ninguna política de RLS** y ya no tienen código que las use. El anónimo lee sus filas.
- **`events` es legible por `anon`** para los 36 eventos con playlist, vía `event_has_playlist_token(id)`: la política corta **por feature, no por token** — tener playlist hace pública la dirección del evento. Igual `song_recommendations`. No nos pega porque la puerta va por API con service role.
- **`user_last_seen`** expone el último acceso de los 18 usuarios al anónimo.
- **`rls-audit.mjs` da "TODO CERRADO" pero solo prueba 3 tablas** — nunca mira `events`.
- **`guests` trae 5 columnas muertas** (`wa_opt_out`, `wa_opt_out_at`, `wa_needs_human`, `wa_needs_human_reason`, `table_label`): cero filas y cero archivos que las mencionen.
- **Deriva entre tipos y base:** 8 tareas con `priority = 'media'` (valor que no existe en `TimelinePriority`); defaults que apuntan a valores inexistentes (`guests.rsvp_status` → `not_contacted`, `event_suppliers.status` → `contactado`); la tabla se llama `event_timeline_tasks`, no `timeline_tasks`.
- **3 de los 6 `RsvpStatus` tienen cero filas** en 1,570 invitados (`mensaje_enviado`, `respondio`, `accion_necesaria`), y `CLAUDE.md` obliga a mantenerlos en cada `STATUS_LABEL`.
- **`CLAUDE.md` dice 17 tablas; hay 29.**

## Notas de construcción

- **Worktree propio.** No trabajar en la carpeta principal. Ojo al borrar el worktree: `git worktree remove` sigue el junction de `node_modules` y vacía el de la carpeta principal — quitar el junction a mano ANTES de borrar.
- **El cliente de Supabase no está tipado** (`createClient` sin genérico `Database`), así que `tsc` **no valida nombres de columna** en los inserts. Verificarlos a mano contra la base.
- **El orden de migración va al revés de la "Regla crítica" de `CLAUDE.md`**: para columnas nuevas, la migración va **antes** que el código.
- Tests con Vitest para lógica pura: `normalizeAccessFields`, el cálculo de `amount_due`, la regla del cupo y el vencimiento del apartado son funciones puras y ahí va la red.
