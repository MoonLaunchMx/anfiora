# Muro de un evento a la vez

**Fecha:** 19 de agosto de 2026
**Estado:** diseño aprobado, pendiente de plan de implementación

## Objetivo

Poner una sola pared en el producto: **una cuenta gratuita puede trabajar un evento a la vez**. Quien necesite llevar varios llena un formulario corto, la solicitud llega a Telegram, Diego lo contacta y le asigna plan a mano desde `/admin`.

No hay precios, ni checkout, ni página de planes. Esto no es el lanzamiento de la monetización: es la pared que hace que la conversación comercial exista.

## Qué NO entra

- Muro de invitados (free = 50). Queda escrito y apagado.
- Stripe, checkout, `/precios`, códigos de promoción, programa fundador.
- Cobro por evento del anfitrión (`events.plan_tier` no se usa hoy).
- Modo solo lectura fino botón por botón en las ~50 superficies del evento (ver "Solo lectura", más abajo).
- El RBAC de `viewer`, que comparte mecanismo pero es trabajo aparte.

## De dónde sale

Todo el modelo ya se decidió en junio y vive en el worktree `../anfiora-paywall` (rama `feature/paywall-monetization`, commit `dbd743a`). Este trabajo **reutiliza** esa decisión; no la vuelve a tomar. Se porta a la línea principal solo la parte de cuenta:

- `lib/pricing.ts` → catálogo de planes (datos, sin UI de precios).
- `lib/entitlements.ts` → `getActiveEventLimit`, `normalizePlan`, `isStaff`.
- `supabase/2026-06-04-paywall-enforcement.sql` → `get_account_capacity` (se conserva), `create_event` (se descarta, ver abajo).

## Modelo

### Planes y cupo

| Plan de cuenta (`users.plan`) | Eventos a la vez |
|---|---|
| `free` (y cualquier valor desconocido) | 1 |
| `solo` | 10 |
| `studio` | 25 |
| `agency` | 60 |

`normalizePlan` traduce el valor legacy `pro` a `studio`, para no capar a quien ya lo tiene. Los correos de `STAFF_EMAILS` no tienen límite.

Fuente única: `getActiveEventLimit(plan, email)` en `lib/entitlements.ts`. Ningún componente pregunta por el nombre del plan.

### Estatus del evento: de cuatro a dos

Hoy hay cuatro (`active`, `paused`, `cancelled`, `completed`) y uno de ellos, `completed`, ni siquiera se puede elegir en la interfaz: quedó huérfano. Además "Pasados" no es un estatus, es `active` con fecha vieja, y el layout del evento ya lo deriva a mano (`app/events/[id]/layout.tsx:374`).

Queda así:

| Estado | Es | Ocupa lugar | Se edita |
|---|---|---|---|
| **Activo** | `event_status = 'active'` con fecha de hoy en adelante | Sí | Sí |
| **Pasado** | `event_status = 'active'` con fecha ya cumplida | No | Sí |
| **Archivado** | `event_status = 'archived'` | No | No |

"Pasado" se deriva de la fecha, no se guarda. Al pasar la fecha el lugar se libera solo: nadie queda bloqueado de por vida por su boda del año pasado, y sigue pudiendo cerrar cuentas y subir fotos.

Archivar es la única acción manual que libera lugar, y cuesta: el evento deja de editarse. Eso es lo que impide el escape obvio (archivo la boda A, abro la boda B, y sigo trabajando las dos).

`event_end_date` manda sobre `event_date` cuando existe: un evento de varios días sigue vigente hasta su último día.

### Cuándo se cobra el cupo

Ocupan lugar los eventos **propios** (`events.user_id`) que están activos y cuya fecha es de hoy en adelante. Los eventos donde el usuario solo es colaborador **no** ocupan lugar de su cuenta: el cupo lo paga el dueño. Esa es la regla que ya trae `get_account_capacity` y se conserva tal cual.

El muro se evalúa en tres momentos, los tres son "el evento entra a contar":

1. Crear un evento nuevo.
2. Reactivar un evento archivado.
3. Mover la fecha de un evento pasado hacia el futuro.

Editar nunca se bloquea por cupo.

### Los usuarios de hoy

Hay ~15 usuarios y varios traen más de un evento vigente (Diego trae 8). **No pierden nada y no hay migración de cortesías**: el candado solo actúa cuando un evento *entra* a contar. Quien hoy tiene tres sigue con sus tres; lo que no puede es abrir un cuarto.

Esto también evita ensuciar `/admin`: no hay que subir a nadie a un plan de pago de mentiras, así que el MRR que reporta `lib/billing.ts` sigue diciendo la verdad.

## El candado

### Cupo: un trigger en `events`, no un RPC

El paquete de junio metía el gate dentro de un RPC `create_event(p_event jsonb, p_settings jsonb)` que enumera columna por columna. Ese RPC **ya envejeció**: le faltan `event_end_date`, `guest_cap`, `ticket_price` y, en `event_settings`, `enabled_features`, `access_mode` y `requires_approval` — todas nacidas después de junio. Conectarlo tal cual haría que crear un evento perdiera datos en silencio.

Se descarta. En su lugar va un **trigger `before insert or update` en `events`** que valida el cupo cuando el evento entra a contar. Ventajas:

- `NewEventModal` sigue haciendo su `insert` normal; agregar una columna mañana no rompe nada.
- Los tres momentos (crear, reactivar, mover fecha) se validan en un solo lugar, en la misma transacción.
- No se puede brincar desde la consola del navegador ni con `curl`.

El trigger levanta `EVENT_LIMIT_EXCEEDED:<activos>:<limite>`, que el cliente ya sabe leer (`lib/capacity.ts` trae el parser).

`get_account_capacity` se conserva y se sigue usando desde la interfaz para saber *antes* si cabe (y así abrir el muro en vez de dejar que la escritura falle). Su conteo por `event_status = 'active'` + fecha sigue siendo correcto con el modelo nuevo. Dos ajustes: deja de mirar la columna `locked` (que nunca se usó y no entra en este alcance, igual que `over_limit` y `plan_tier`), y lee el límite desde la misma tabla de planes.

El RPC `set_event_status` también se descarta: con el trigger en `events`, el `update` directo que ya hace el dashboard (`app/dashboard/page.tsx:286`) queda validado solo.

### Solo lectura: bloqueo en la base + banner

Un evento archivado no se edita. Hacerlo apagando botones uno por uno significa recorrer ~50 componentes: `canEdit` ya existe en `lib/event-access-context.tsx` pero solo lo respetan 5 archivos (invitación y el itinerario del timeline). Ese recorrido completo es el pendiente de *viewer solo lectura* y no cabe hoy.

Se resuelve en dos capas:

1. **La base rechaza.** Una función `evento_editable(event_id)` y un trigger genérico sobre las tablas hijas del evento: `guests`, `party_members`, `tables`, `table_seats`, `event_budgets`, `event_suppliers`, `supplier_payments`, `event_timeline_tasks`, `event_itinerary_moments`, `event_settings`, `song_recommendations`, `gift_registry_items`, `event_collaborators`. Si el evento está archivado, la escritura falla.

2. **La interfaz avisa.** Banner sticky en el layout del evento ("Este evento está archivado. Solo lectura." + botón Reactivar), `canEdit` en falso dentro del context cuando el evento está archivado, y botones apagados en las tres pantallas donde más se escribe: invitados, timeline y presupuesto. Los rincones que no se alcancen hoy no rompen: la base rechaza y sale el mismo aviso.

**El flujo que entra solo no se bloquea.** El trigger solo rechaza escrituras de un usuario logueado (`auth.uid()` presente). El RSVP que llega por WhatsApp o Telegram, el registro por link público y las reservas de mesa de regalos entran por el servidor y siguen funcionando: nunca se le tumba una confirmación a un invitado a media respuesta. Un evento archivado puede seguir recibiendo respuestas; lo que no se puede es trabajarlo sin reactivarlo.

**Decisión asociada:** con `archived` en la tabla, los recordatorios del timeline y las respuestas automáticas dejan de dispararse para ese evento — misma regla que hoy aplica a `cancelled`/`completed` (`lib/notifications/reminders.ts:57`, `app/api/webhook/whatsapp/route.ts:63`).

## Lo que ve el usuario

### El muro

Al intentar crear el segundo evento, en vez de crearlo:

> **Con tu cuenta puedes llevar un evento a la vez.**
> Si organizas varios, cuéntanos qué necesitas y te damos acceso.
> `[ Solicitar acceso ]` `[ Ahora no ]`

Sin precios, sin planes, sin comparativas.

### El formulario de solicitud

Ocho campos, en modal, siguiendo el patrón de los modales del producto:

| Campo | Tipo |
|---|---|
| Nombre (empresa o persona) | texto, obligatorio |
| Eventos aproximados al año | número, obligatorio |
| Tipo de eventos que gestiona | texto |
| Tamaño del equipo | número |
| Cómo prefiere que lo contactemos | selección: WhatsApp / correo / llamada |
| WhatsApp | `PhoneInput` (`lib/phone.ts`, E.164 — nunca un input suelto) |
| Correo | correo, precargado con el de la sesión |
| Ciudad / país | texto |

Al enviar: `POST /api/solicitud-acceso` → mensaje a Telegram por el canal de soporte que ya existe (`TELEGRAM_SUPPORT_BOT_TOKEN` / `TELEGRAM_SUPPORT_CHAT_ID`, ver `app/api/feedback/route.ts`). **Sin tabla nueva** — ya hay 29 y el destino real es la conversación con Diego. El mensaje incluye correo, plan actual y cuántos eventos vigentes tiene, para que Diego decida el plan sin preguntar.

Confirmación al usuario: "Listo, te escribimos hoy mismo."

### El dashboard

Tres pestañas en vez de cuatro: **Activos** / **Pasados** / **Archivados**. El menú por evento ofrece Archivar (o Reactivar). Cuando el cupo está lleno, el botón de evento nuevo no se esconde: abre el muro. Esconderlo deja al usuario sin saber que existe algo más.

### El evento archivado

Banner sticky arriba del contenido, botón Reactivar que pasa por el muro si no hay cupo.

### `/admin`

El selector de plan de `UsuariosTab` hoy ofrece `free` / `pro` / `agency`. Pasa a ofrecer `free` / `solo` / `studio` / `agency`, con el cupo de eventos visible junto a cada uno. `lib/billing.ts` (`PLAN_PRICES`) debe conocer los ids nuevos leyendo `lib/pricing.ts`, o las métricas de ingreso se van a cero al reasignar planes.

## Migración de datos

Un solo `update`, que Diego corre:

```sql
update events set event_status = 'archived'
 where event_status in ('paused', 'cancelled', 'completed');
```

Ningún evento pierde información: archivado conserva todo y se puede reactivar. `EventStatus` en `lib/types.ts` pasa a `'active' | 'archived'`.

## Lo que hay que tocar

| Archivo | Cambio |
|---|---|
| `lib/entitlements.ts` (nuevo, portado) | `getActiveEventLimit`, `normalizePlan`, `isStaff` |
| `lib/pricing.ts` (nuevo, portado) | catálogo de planes, sin UI |
| `lib/types.ts` | `EventStatus` a dos valores |
| `lib/capacity.ts` (nuevo, portado y recortado) | `fetchAccountCapacity`, parser de `EVENT_LIMIT_EXCEEDED` |
| `lib/event-access-context.tsx` | leer `event_status`, apagar `canEdit` si está archivado, exponer `isArchived` |
| `app/components/NewEventModal.tsx` | consultar cupo antes de crear; si no cabe, abrir el muro |
| `app/components/MuroEventosModal.tsx` (nuevo) | el muro + el formulario |
| `app/api/solicitud-acceso/route.ts` (nuevo) | envío a Telegram |
| `app/dashboard/page.tsx` | tres pestañas, archivar/reactivar, muro |
| `app/events/[id]/layout.tsx` | banner de archivado, estatus derivado a dos |
| `app/events/[id]/configuracion/page.tsx` | control de estatus a dos valores |
| `app/events/[id]/page.tsx`, `timeline/`, `presupuesto/` | botones apagados con `canEdit` |
| `lib/notifications/reminders.ts`, `app/api/webhook/whatsapp/route.ts`, `lib/telegram/routing.ts` | `archived` en lugar de `cancelled`/`completed` |
| `app/admin/UsuariosTab.tsx`, `lib/billing.ts`, `lib/admin/change-plan.ts` | planes nuevos |
| `supabase/2026-08-19-muro-eventos.sql` (nuevo) | trigger de cupo, `evento_editable`, triggers de solo lectura, migración |

## Pruebas

Vitest sobre lógica pura, que es donde vive el riesgo real:

- `getActiveEventLimit`: free → 1; `pro` legacy → 25; staff → sin límite; valor basura → 1.
- Derivación de estado mostrado: activo / pasado / archivado, con `event_end_date` mandando sobre `event_date`, y el evento que termina **hoy** contando como vigente (el error clásico de un día).
- `reminderSkipReason` con `archived`.
- Parser de `EVENT_LIMIT_EXCEEDED`.

Lo demás —modal, banner, trigger— se verifica a mano en el recorrido local → preview → main, que es como se prueba todo lo que toca I/O en este proyecto.

## Riesgos

- **El trigger de cupo bloquea a un usuario vivo por un caso no previsto.** Mitigación: el trigger solo actúa cuando el evento entra a contar, nunca al editar, y se prueba en preview con la cuenta de Diego (8 eventos) antes de main.
- **El trigger de solo lectura tumba una escritura legítima que llega por servidor.** Mitigación: la condición exige `auth.uid()` presente; el flujo público y los webhooks no la cumplen.
- **`supplier_payments` y `gift_reservations` no cuelgan directo de `event_id`** (van por `event_supplier_id` y por el artículo). Sus triggers necesitan un `join` para resolver el evento. Si no se resuelve limpio, quedan cubiertos por la interfaz y se anota como hueco conocido, no se finge que están cerrados.
- **Renombrar planes rompe métricas de `/admin`** si `PLAN_PRICES` se queda con los ids viejos. Va en el mismo cambio, no después.

## Verificación pendiente antes de implementar

La Fase 1 del paquete de junio se corrió en Supabase hace dos meses. Hay que confirmar qué sobrevive (consultas de solo lectura, ya entregadas a Diego):

1. ¿Existen las columnas `events.plan_tier`, `events.over_limit`, `events.locked`?
2. ¿Existen las funciones `get_account_capacity`, `create_event`, `set_event_status`, `can_write_event`?
3. Conteo de eventos por estatus (cuántos se van a archivar).
4. Conteo de usuarios por plan (a quién le cambia el mundo).

El resultado ajusta la migración, no el diseño.
