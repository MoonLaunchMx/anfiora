# Planes de planner, muros de la cuenta gratis y sello de partner

**Fecha:** 19 de septiembre de 2026
**Entrega:** 26 de septiembre de 2026
**Estado:** borrador, pendiente de revisión de Diego
**Sustituye a:** `2026-08-19-muro-un-evento-a-la-vez-design.md` (agosto), del que se conserva casi todo el mecanismo y se reemplaza el catálogo de planes

## Objetivo

Dejar el producto listo para cobrar sin cobrar todavía. Tres cosas:

1. **Saber quién es quién.** Cada cuenta tiene un plan y, si aplica, un sello de partner fundador. Se ve en su propia cuenta y en `/admin`.
2. **Poner las dos paredes de la cuenta gratis:** un evento activo a la vez y cincuenta invitados.
3. **Dejar los tres planes en el código** con sus precios, para que la página de precios y Stripe se conecten después sin rediseñar nada.

No entra el cobro. Nadie paga el 26 de septiembre: quien topa con una pared pide acceso, la solicitud llega a Telegram y Diego asigna el plan a mano.

## Qué no entra

- Stripe, checkout, cupones y el programa fundador como código de promoción.
- La escalera de precios del anfitrión (Esencial, Pro, Gran Anfitrión, Sin Límites). Queda decidida y guardada; se conecta cuando entre Stripe.
- El marketplace de proveedores.
- El modo solo lectura botón por botón en las ~50 superficies del evento.
- **La página pública de precios.** Verificado el 19 de septiembre: no existe en `main`, solo en la rama vieja del paywall. No hay nada que recortar a planners hoy; cuando se construya, nace solo con los planes de planner. Para el 26 los tres precios se ven dentro del aviso.

## Los dos caminos del producto

El registro ya pregunta si la persona es **planner** o **anfitrión** y lo guarda en `users.role`.

- **Planner:** vive de organizar eventos. Paga suscripción mensual. Es el cliente que queremos.
- **Anfitrión:** organiza su propio evento, una vez en su vida. Va a pagar un solo pago por evento, medido por cuánta gente invita. **Ese cobro no existe todavía.**

Hasta que exista, los dos ven la misma cuenta gratis y la misma pared. La diferencia es qué le ofrecemos a cada uno cuando la topa, y eso hoy es una conversación, no un botón de pago.

## Los tres planes de planner

| Plan | Precio | Asientos | Eventos | Invitados | Marca propia |
|---|---|---|---|---|---|
| **Free** | $0 | 1 (solo él) | 1 activo a la vez | 50 por evento | No |
| **Pro** | $490/mes | 1 (solo él) | Sin límite | Sin límite | No |
| **Studio** | $990/mes | 3 | Sin límite | Sin límite | No |
| **Agency** | $1,990/mes | 3 + extras | Sin límite | Sin límite | Sí, cuando exista |

Precios en pesos mexicanos. Asiento extra: $290 al mes.

**Pro es Studio sin equipo.** Tiene todo, Rolodex incluido; lo único que no tiene es a quién sentar junto a él. Esa es la única diferencia entre los dos, y es la que se explica en una línea al vender.

**El renombre cambia el significado de un valor que ya existe en la base.** Hasta hoy `pro` quería decir $990 con tres asientos; de aquí en adelante quiere decir $490 con uno. Antes de correr el SQL hay que ver quién está en `pro`: la cuenta que tenga equipo pasa a `studio`, o se queda sin asientos de un día para otro. `studio` deja de ser un alias de `pro` y pasa a ser un plan de verdad.

**Agency entra al catálogo aunque su marca propia no exista todavía.** El plan se puede asignar y cobrar; la personalización llega después. Se dice tal cual en `/admin` para que Diego no venda algo que no está.

### Partner fundador

No es un plan: es un acuerdo. La cuenta conserva su plan y además lleva el sello.

- Lo da Diego a mano desde `/admin`, después de acompañar a alguien en su arranque.
- **25 lugares.** Cuando se acaban, se acaba.
- Mientras no cobremos: todo abierto, sin límite de eventos ni de invitados.
- Cuando cobremos: **40% de descuento el primer año**, con cupón de Stripe. Nunca gratis de por vida.
- La persona ve su sello en su propia cuenta. Es la mitad del valor del trato.

## Las dos paredes de la cuenta gratis

### Un evento activo a la vez

Se conserva completo el modelo de agosto, que ya está construido:

| Estado | Es | Ocupa lugar | Se edita |
|---|---|---|---|
| **Activo** | `event_status = 'active'` con fecha de hoy en adelante | Sí | Sí |
| **Pasado** | `event_status = 'active'` con fecha ya cumplida | No | Sí |
| **Archivado** | `event_status = 'archived'` | No | No |

"Pasado" se deriva de la fecha, no se guarda: al pasar la boda el lugar se libera solo. Archivar es la única acción manual que libera lugar, y cuesta, porque el evento deja de editarse. Eso cierra el escape de archivar la boda A para trabajar la B.

La pared se evalúa en los tres momentos en que un evento entra a contar: crearlo, reactivarlo, o mover su fecha hacia el futuro. Editar nunca se bloquea.

### Cincuenta invitados

Esta es la pared nueva. En agosto quedó escrita y apagada; ahora entra.

**Qué cuenta:** las personas que van a estar en el evento. Un invitado cuenta como uno, y **cada acompañante cuenta como uno**. Sin eso, cincuenta invitados con tres acompañantes cada uno son doscientas personas en la fiesta y la pared no sirve.

**Las tres piezas, que es como lo hace cualquier SaaS de eventos serio:**

1. **El contador se ve desde el primer día.** "32 de 50 invitados" arriba de la lista, siempre, no solo cuando ya no cabe. Enterarse del tope hasta el final es lo que hace que la gente se sienta engañada.
2. **La pared aparece al pasarse, venga por donde venga:** agregar a mano, importar un archivo, o que alguien se registre por el link público.
3. **Nunca se esconde ni se borra lo que ya está.** Quien hoy tiene ochenta invitados los sigue viendo y usando; lo que no puede es agregar más. El candado actúa sobre lo que entra, no sobre lo que ya entró.

**Al importar un archivo grande no se rechaza el archivo.** Entran los que caben y se dice con claridad cuántos se quedaron fuera y qué hacer. Rechazar las 200 filas completas es la forma más rápida de perder al cliente.

**Lo que llega solo nunca se rechaza a media conversación.** Si un invitado responde por WhatsApp o Telegram, o confirma por el link público, esa respuesta entra aunque la cuenta esté en el tope: no se le tumba una confirmación a un invitado por un asunto comercial del organizador. Lo que sí pasa es que el planner ve el aviso de que su lista se pasó y qué hacer.

## Un cliente por evento

Regla global, en todos los planes, incluido Free: **un evento tiene como máximo un cliente invitado, y su acceso llega hasta "editar", nunca "total".**

El cliente es el novio, la novia o quien sea el dueño de la fiesta del lado del planner. No ocupa asiento, y por eso hoy se puede repartir sin límite: así se puede sentar a un equipo entero como clientes y saltarse el cobro por asiento.

Se cierra en los tres lugares por los que hoy se puede entrar, porque cerrar solo uno no cierra nada:

1. La ruta que da de alta al cliente.
2. La pantalla de permisos del evento, que hoy actualiza permisos desde el navegador sin preguntar de qué tipo es la persona.
3. La base de datos, que hoy deja a cualquier administrador del evento insertar o editar esas filas directamente.

## Dónde se ve el plan

| Superficie | Qué muestra |
|---|---|
| Su workspace | Chip junto al nombre: Free, Pro, Studio, Agency o Partner fundador |
| Su perfil | Lo mismo, con el trato completo escrito cuando es partner |
| `/admin` | Columna con el plan de cada cuenta y el sello, para ver de dónde viene el dinero |

El sello de partner gana al plan cuando existe: el chip dice "Partner fundador", no "Free".

## Lo que ve quien topa con una pared

Un solo mensaje, porque hoy nadie puede pagar todavía:

> **Llegaste al tope de la cuenta gratis.**
> Con tu cuenta puedes llevar un evento a la vez, con hasta 50 invitados.
> Cuéntanos qué necesitas y te damos acceso.
> `[ Solicitar acceso ]` `[ Ahora no ]`

Debajo, los tres planes con su precio, para que la conversación empiece con el número enfrente. Sin botón de pago.

El formulario de solicitud es el que ya está diseñado en el spec de agosto (nombre, eventos al año, tipo de eventos, tamaño del equipo, cómo contactarlo, WhatsApp con `PhoneInput`, correo, ciudad). Al enviarlo llega a Telegram con el correo, el plan actual, si es planner o anfitrión, y cuántos eventos e invitados tiene. Sin tabla nueva.

## Los proveedores que se capturan

Lo que planners y anfitriones capturan en Proveedores vive ya en Supabase y ahí se queda: no se crea ningún directorio nuevo ni se cambia nada del producto.

Lo que sí hay que hacer es **que los Términos y el Aviso de Privacidad contemplen ese uso**, porque el destino de esa información es un marketplace de proveedores y planners. Eso se trabaja en el centro legal, que hoy está en pausa, y se anota aquí para que no se pierda.

El anfitrión que paga su evento tendrá Presupuesto, Proveedores y Pagos de su evento, pero **no el Rolodex**: el Rolodex cruza eventos y es justamente lo que hace que un planner se suscriba en lugar de comprar eventos sueltos.

## Cómo se aplica cada pared

Verificado contra el código de `main` el 19 de septiembre.

### La pared de eventos

Hay **un solo camino** para crear un evento: `app/components/NewEventModal.tsx`, con un `insert` desde el navegador. No hay ruta API ni RPC. Se conserva el diseño de agosto:

- **La base manda:** un trigger `before insert or update` en `events` valida el cupo cuando el evento entra a contar, y levanta `EVENT_LIMIT_EXCEEDED:<activos>:<limite>`. No se brinca desde la consola del navegador.
- **La interfaz se adelanta:** antes de crear, el modal consulta el cupo y abre el aviso en vez de dejar que la escritura falle.

### La pared de invitados

Aquí hay más puertas, y todas cuentan:

| Por dónde entra | Archivo | Quién escribe |
|---|---|---|
| Alta de invitado a mano | `app/events/[id]/page.tsx` | Navegador |
| Importar CSV | `app/events/[id]/page.tsx` | Navegador, en lote |
| Acompañantes al editar | `app/events/[id]/page.tsx` | Navegador |
| Acompañantes en lote | `app/events/[id]/page.tsx` | Navegador, en tandas de 500 |
| Acompañantes desde Mesas | `app/events/[id]/mesas/page.tsx` | Navegador |
| Registro por link público | `app/api/invitacion/[token]/registro/route.ts` | Servidor, visitante anónimo |

**Cómo se cuenta.** Personas de verdad: filas de `guests` más filas de `party_members` del evento. **No se usa `events.total_guests`**, que hoy cuenta filas de invitados sin acompañantes y que ninguna pantalla muestra: el dashboard ya calcula el total sumando las dos tablas. El contador viejo se queda como está, sin tocarlo, para no romper nada que dependa de él.

**Dónde se aplica.** Igual que la de eventos, en dos capas:

1. **La base rechaza** en `guests` y `party_members` cuando la cuenta se pasa del tope, **solo si la escritura viene de un usuario con sesión** (`auth.uid()` presente). Así el registro por link público y las respuestas de WhatsApp o Telegram nunca se rechazan: entran por servidor y no cumplen la condición.
2. **La interfaz avisa antes:** contador visible en la lista de invitados, aviso al intentar pasarse, y en la importación se cortan las filas que no caben con un mensaje claro de cuántas quedaron fuera.

**El plan que manda es el del dueño del evento**, no el de quien está escribiendo: un colaborador invitado no arrastra su propio plan al evento ajeno. En la base ya existe una función que resuelve el plan de un evento; se reutiliza en lugar de escribir otra.

### El sello de partner

Vive junto al plan, en el workspace, con dos datos: el sello y desde cuándo. Se asigna solo desde `/admin` con service role, igual que el plan, y la base impide que alguien se lo ponga solo — el mismo candado que ya protege al plan desde el 17 de septiembre.

Cuando una cuenta trae el sello, no tiene tope de eventos ni de invitados, sin importar qué diga su plan.

## Lo que hay que tocar

| Archivo | Cambio |
|---|---|
| `lib/workspace/planes.ts` | Entra `studio` como plan real. Precios nuevos: Pro $490, Studio $990, Agency $1,990. `pro` cambia de significado. Campo nuevo de invitados por evento (50 en Free, sin límite en los de paga) |
| `lib/workspace/asientos.ts` | `Pro` no puede invitar equipo, igual que Free, pero por otra razón: su plan es de una persona |
| `lib/billing.ts` | Conocer `studio` y el precio nuevo de `pro`, o el ingreso reportado en `/admin` se va a cero al reasignar planes |
| `lib/admin/change-plan.ts`, `app/admin/UsuariosTab.tsx` | Selector con los cuatro valores (free, pro, studio, agency) y el sello de partner |
| `app/api/admin/update-plan/route.ts` | Escribir también el sello |
| `lib/types.ts` | `EventStatus` a dos valores |
| `lib/capacity.ts`, `lib/entitlements.ts` | Portados de la rama de agosto, reescritos sobre `planes.ts` |
| `lib/invitados/cupo.ts` (nuevo) | Contar personas, decidir cuántas caben, leer el error de la base |
| `app/components/NewEventModal.tsx` | Consultar cupo antes de crear; si no cabe, abrir el aviso |
| `app/components/MuroModal.tsx` (nuevo) | El aviso, los tres planes y el formulario de solicitud |
| `app/api/solicitud-acceso/route.ts` (nuevo) | Enviar la solicitud a Telegram |
| `app/events/[id]/page.tsx` | Contador visible, aviso al pasarse, corte en la importación |
| `app/events/[id]/mesas/page.tsx` | Mismo aviso al agregar acompañantes |
| `app/dashboard/page.tsx` | Tres pestañas, archivar y reactivar, aviso |
| `app/events/[id]/layout.tsx` | Banner de archivado |
| `app/configuracion/` | Chip de plan y sello de partner |
| `app/api/workspace/clientes/route.ts`, `app/events/[id]/configuracion/page.tsx` | Un cliente por evento, tope de "editar" |
| `lib/notifications/reminders.ts`, webhooks | `archived` en lugar de `cancelled` y `completed` |

## El SQL

Un solo archivo, que Diego corre **después** de que el código esté en producción, porque varias piezas rompen sin él:

1. Columnas del sello de partner en `workspaces`, y candado para que solo se asigne con service role.
2. Trigger de cupo de eventos.
3. Trigger de invitados y acompañantes, con la condición de sesión presente.
4. Triggers de solo lectura para el evento archivado.
5. Migración de estatus: lo que hoy está pausado, cancelado o completado pasa a archivado.

Ninguna de las cinco piezas borra datos. El archivo trae su verificación y su bloque para revertir, como los últimos.

## Qué pasa con quien ya está adentro

- **Nadie pierde nada.** Los candados actúan sobre lo que entra, no sobre lo que ya entró. Quien hoy tiene tres eventos vigentes sigue con sus tres, y quien tiene ochenta invitados los sigue viendo y usando.
- **Patty pasa a Pro** antes del deploy, desde `/admin`, para que no vea ninguna pared.
- **Diego queda sin tope** por el sello de partner o por la lista de correos del equipo, para poder seguir probando con sus ocho eventos.

## Pruebas

Con Vitest, sobre lógica pura, que es donde vive el riesgo:

- Cuántos eventos caben según el plan: Free uno, los de paga sin límite, un valor desconocido cae a Free, partner sin tope.
- Contar personas: invitados más acompañantes, y que borrar a uno libere lugar.
- Cuántas filas de un archivo caben cuando faltan pocos lugares, incluidos los casos de cero y de justo el último.
- Derivar el estado mostrado: activo, pasado y archivado, con la fecha de fin mandando sobre la de inicio y el evento que termina hoy contando como vigente.
- Leer los dos errores de la base.

Lo que toca base de datos y pantallas se prueba a mano en el recorrido de siempre: local, preview y producción.

## Riesgos

- **La pared de invitados es nueva y toca la pantalla más usada del producto.** Es lo que más puede salir mal del paquete. Se prueba en preview con datos reales antes de ir a producción.
- **Un trigger mal puesto bloquea a alguien vivo.** Los dos triggers solo actúan sobre lo que entra y exigen sesión presente, así que ningún flujo automático se cae. Se verifica en preview con la cuenta de Diego, que es la más cargada.
- **Agregar `studio` y cambiarle el precio a `pro` rompe el ingreso de `/admin`** si el catálogo de precios se queda con los ids viejos. Va en el mismo cambio, no después.
- **La fecha.** Son ocho días y el paquete trae dos paredes, el sello, los planes y la regla del cliente. Si algo tiene que caerse para llegar al 26, lo primero que se cae es el chip de plan en las pantallas de configuración: es lo único que no cambia comportamiento.
