# El workspace — Tramo 5 de accesos por herramienta

**Fecha:** 7-sep-2026
**Estado:** diseño aprobado. Seis decisiones cerradas con mockup.
**Mockup:** https://claude.ai/code/artifact/56e4c7a5-358e-4184-8287-ffb7ec080d6d
**Spec madre:** `2026-09-04-accesos-por-herramienta-design.md` (§2 modelo, §4.1 tablas, §11 orden). Este documento no reabre nada de ahí.
**Cierra:** la nota de memoria `workspace-dos-capas-asientos` (su "doble vida" del colaborador) y el hueco de asientos de `planes-tres-por-asiento`.

---

## 1. Qué es este tramo

Los Tramos 1 a 4 están en producción. El workspace ya existe como fila propia (`workspaces`, `workspace_members`, `events.workspace_id`) desde el Tramo 1, con 16 workspaces y su dueño principal cada uno. `nivel_en()` ya da Total al dueño y al admin del workspace. Lo que el cimiento dejó fuera a propósito es **todo lo que hace útil esa fila**: el plan, los datos de facturación, la escritura de miembros y una pantalla.

Este tramo termina la tabla y le pone pantalla. No crea tablas nuevas.

**Vocabulario.** En la interfaz se dice **workspace** (Diego, 7-sep: "despacho suena a abogados"). En el código ya era `workspace`. Este documento usa la misma palabra en los dos lados. Las notas y specs anteriores que dicen "despacho" hablan de esto mismo.

---

## 2. Las seis decisiones cerradas el 7-sep

| # | Decisión | Detalle |
|---|---|---|
| 1 | **Equipo es miembro del workspace, siempre. El asiento se ocupa al invitar.** | Invitar a un compañero desde donde sea (la pantalla del workspace o la pestaña Equipo de una boda) crea su fila en `workspace_members`. No existe "colaborador de boda" fuera del workspace. Como Notion, Figma y Linear: la invitación pendiente ya ocupa el asiento. Así nadie estaciona diez invitaciones sin pagar |
| 2 | **Sin selector de workspace.** | El dashboard sigue siendo una sola lista con todas las bodas a las que la persona tiene acceso. Si pertenece a más de un workspace, la lista se agrupa con un encabezado por workspace. Al crear una boda aparece un campo "Workspace" **solo** si es dueño o admin de más de uno. El selector estilo Slack queda habilitado por el modelo y se construye cuando estorbe la lista |
| 3 | **Tres planes. Pro incluye 1 asiento, Agency incluye 3. Asiento extra $290 en los dos.** | Free es solo el dueño. Studio muere: existía para vender más eventos, y ya no hay candado por eventos. Lo que vende Agency es la marca propia y la actividad sin límite, no asientos |
| 4 | **Transferir la propiedad se difiere a soporte manual.** | La base ya lo permite (el dueño principal es una fila, no un usuario). El día que un cliente lo pida, Diego cambia dos filas. Sin pantalla, sin deuda |
| 5 | **Nace `/cuenta` con tres pestañas: Equipo, Actividad, Plan y facturación.** | `/perfil` se queda como está (lo personal). En el menú de usuario aparece "Mi workspace" solo si eres dueño o admin de alguno. El colaborador no lo ve ni entra por URL |
| 6 | **Cinco datos de facturación, solo el dueño.** | Correo de facturación, razón social, RFC, régimen fiscal y código postal. Es lo que el CFDI 4.0 exige y Stripe no sabe. Sin domicilio completo ni uso de CFDI hasta que exista el cobro |

Y lo que se heredó cerrado del spec madre y de las notas: dueño / admin / colaborador más cliente; cliente no es miembro y no ocupa asiento; solo dueño y admin invitan; Configuración, Equipo y Actividad son de dueños y admins; el alta es persona → bodas → permisos en tres pasos con el kit precargado de sus otras bodas; la ventana de Actividad es Free 7 / Pro 30 / Agency ilimitado y se corta la lectura, nunca las filas.

---

## 3. Datos

### 3.1 `workspaces` gana seis columnas

```sql
alter table workspaces
  add column plan           text not null default 'free'
                            check (plan in ('free','pro','agency')),
  add column billing_email  text,
  add column legal_name     text,
  add column rfc            text,
  add column tax_regime     text,   -- clave SAT de 3 dígitos, ej. '601'
  add column postal_code    text;
```

Nada más. Los asientos **no se guardan**: se cuentan. Los incluidos por plan viven en el catálogo de la app (§4.1), no en una columna, porque cambian con el precio y no con el cliente.

### 3.2 `users.plan` se deja de leer

Se conserva la columna (misma regla que `event_collaborators.role`: se deja de escribir, no se borra). Todo lo que hoy lee `users.plan` pasa a leer el plan del workspace donde esa persona es dueño principal:

| Hoy lee `users.plan` | Mañana |
|---|---|
| `app/perfil/page.tsx` sección "Plan actual" | Se quita de Perfil; vive en `/cuenta/plan` |
| `app/api/admin/update-plan/route.ts` | Escribe `workspaces.plan` del workspace de esa persona (lo crea si no existe, §3.5) |
| `app/admin/*` (métricas, filtros, pastillas) | El endpoint de usuarios trae el plan con join a `workspaces` |
| `lib/billing.ts` (`PLAN_PRICES`) | Lee del catálogo nuevo `lib/workspace/planes.ts` |
| `app/api/feedback/route.ts` | Plan del workspace, o `'free'` si no tiene |
| `app/invite/[token]/page.tsx` registra `plan: 'free'` | Se deja: es el default y no estorba |

### 3.3 `workspace_members`: sin columnas nuevas

Ya tiene todo: `rol`, `es_dueno_principal`, `kit_habitual`, `permisos_cuenta`, `status`, `invite_token`, `invited_by`, `accepted_at`. Lo que faltaba era quién escribe (§5).

**Quién cuenta como asiento:** las filas del workspace con `status in ('pending','active')`. El dueño principal cuenta como uno; es el asiento incluido de Pro. Revocado no cuenta.

### 3.4 `event_collaborators`: el cliente por fin existe

`tipo = 'cliente'` deja de ser una columna que nadie escribe. Un cliente es una fila aquí **sin** fila en `workspace_members`. Un compañero de equipo es una fila aquí **con** fila en `workspace_members`. Esa es toda la diferencia.

Regla del cliente: **un correo de cliente tiene una sola boda por workspace.** Se valida en la app al invitar (§5.3); no lleva restricción en la base porque el fraude que evita (registrar empleados como novias) no se detecta con un índice, se detecta viendo la lista de clientes en la pantalla del workspace.

### 3.5 Dos disparadores que cambian

- **`guard_events_workspace`** hoy deja que cualquier miembro activo cree eventos en el workspace. Pasa a exigir rol `dueno` o `admin`: crear una boda es un acto de administración, y el colaborador "por sí solo no entra a nada".
- **`set_event_workspace`** se parte en dos: la creación perezosa del workspace sale a una función `asegurar_workspace(uid uuid) returns uuid`, que el disparador llama y que también llama el endpoint de `/admin` cuando cambia el plan de alguien que nunca creó una boda. El disparador sigue eligiendo el workspace propio por `primary_owner_id` cuando la app no manda `workspace_id`; cuando la app lo manda (campo "Workspace" de la decisión 2), el guard verifica que sea dueño o admin ahí.

El índice único `workspaces_un_dueno` **se conserva**: transferir se difirió, así que sigue siendo cierto que cada persona es dueño principal de a lo más un workspace.

### 3.6 Un disparador nuevo: `guard_workspace_members`

Invariantes que la base hace cumplir sin importar quién escribe:

- La fila con `es_dueno_principal = true` no se borra, no se revoca y no cambia de rol.
- `es_dueno_principal` no se enciende ni apaga desde fuera (transferir es manual y lo hace el service role con el disparador desactivado a propósito, documentado en el SQL).
- `user_id` solo se escribe una vez (al aceptar) y tiene que coincidir con el correo de la fila.

### 3.7 Policies que ganan la rama del workspace

Hoy solo `nivel_en()` sabe que el admin del workspace existe. Estas policies no, y sin ellas el admin no ve la boda en el dashboard aunque tenga Total adentro:

| Tabla | Qué gana |
|---|---|
| `events` SELECT | `or es_admin_de(workspace_id)` |
| `event_settings` SELECT/UPDATE | igual, vía `is_event_member` / `is_event_editor` reimplementadas encima de `nivel_en` (pendiente desde el Tramo 1, aquí se cobra) |
| `event_collaborators` SELECT/INSERT/UPDATE | el admin del workspace administra el equipo de sus bodas |
| `event_audit_log` `actividad_ver` | `or es_admin_de((select workspace_id from events where id = event_id))`. Hoy solo entra el dueño del evento y el `role='admin'` legado |

`es_admin_de(ws uuid)` es una función nueva hermana de `es_miembro_de`: miembro activo con rol `dueno` o `admin`. **El texto exacto de cada policy se escribe después de leer `pg_policies`** de esas cuatro tablas (consulta 5 del brainstorm). No se escribe a ciegas.

### 3.8 Lo que queda habilitado, no construido

- **Ventana de Actividad por plan.** Función `plan_del_evento(evento uuid) returns text` que lee `workspaces.plan` vía `events.workspace_id`. El corte en `actividad_ver` es una línea más el día que se cobre. La pantalla ya muestra "Últimos 30 días · tu plan Pro guarda 30" como texto, pero la lectura no se recorta todavía.
- **Stripe y asientos.** `workspaces.plan` es la única columna que Stripe tiene que escribir. El catálogo de la app (`lib/workspace/planes.ts`) es donde se pone el `price_id`. Contar asientos ya es una consulta.
- **Transferir.** Dos filas: `workspaces.primary_owner_id` y el par de `es_dueno_principal`. Documentado en el SQL como operación de soporte.
- **Selector de workspace.** El modelo lo permite; la pantalla espera.

---

## 4. El cimiento en la app: `lib/workspace/`

```
lib/workspace/
├── planes.ts        PLANES: id, nombre, precio, asientosIncluidos, precioAsientoExtra,
│                    ventanaActividadDias, whitelabel. Etiquetas. Función planDe().
├── asientos.ts      lógica pura: contarAsientos(miembros), costoExtra(plan, ocupados),
│                    puedeInvitar(plan, ocupados) → { ok, motivo }
├── invitacion.ts    lógica pura: filasDeAlta(persona, bodas, permisosPorBoda) →
│                    { miembro, colaboradores[] }; aceptar(token) → qué filas activar
└── contexto.tsx     useWorkspace(): los workspaces donde soy dueño o admin, el activo
                     de la ruta /cuenta, miembros, asientos. Una query, todos consumen.
```

`planes.ts`, `asientos.ts` e `invitacion.ts` son puros y se prueban con Vitest. Ninguno importa `lib/supabase.ts` (regla del repo: lo que se prueba no cuelga de un módulo que importe el cliente).

### 4.1 El catálogo

```ts
export const PLANES = [
  { id: 'free',   nombre: 'Free',   precio: 0,    asientosIncluidos: 1, ventanaActividadDias: 7,    whitelabel: false },
  { id: 'pro',    nombre: 'Pro',    precio: 990,  asientosIncluidos: 1, ventanaActividadDias: 30,   whitelabel: false },
  { id: 'agency', nombre: 'Agency', precio: 1990, asientosIncluidos: 3, ventanaActividadDias: null, whitelabel: true  },
] as const
export const PRECIO_ASIENTO_EXTRA = 290
```

`asientosIncluidos: 1` en Free significa **solo el dueño**: `puedeInvitar('free', 1)` devuelve `{ ok: false, motivo: 'plan' }`.

### 4.2 Free no invita equipo

Es la primera regla de plan que se aplica de verdad en Anfiora, y se aplica **sin Stripe**: hoy todos los workspaces son Free y el plan se sube a mano en `/admin`. En Free, "Agregar persona" abre un aviso ("Para trabajar en equipo necesitas Pro") con el contacto de Diego; no hay formulario. **Invitar cliente sí funciona en Free**, porque no es asiento.

En Pro y Agency se invita libre. Por encima de los incluidos, el paso 1 del alta muestra el costo ("+$290 / mes") pero **no bloquea**: no hay a quién cobrarle todavía. El tope llega con Stripe.

> Esto afecta a la planner real: bodasplanner@hotmail.com es Free y hoy no tiene equipo. Si el día del cambio quiere una asistente, Diego le sube el plan a mano. Es la misma operación que ya hace hoy para cualquier plan.

### 4.3 `rolCuenta` deja de ser un atajo

`lib/event-access-context.tsx` hoy pone `rolCuenta = 'dueno'` a cualquiera que sea dueño del evento, sin mirar `workspace_members` (el comentario del Tramo 1 lo advierte). Aquí se resuelve siempre contra `workspace_members`, en los dos caminos. El dueño del evento sigue teniendo Total por `esDuenoDelEvento`; lo que cambia es que `rolCuenta` ya no miente.

---

## 5. Quién escribe, y por dónde

Toda escritura en `workspaces` y `workspace_members` pasa por **rutas de API con service role y un solo candado**, el patrón que `/api/actividad/restaurar` dejó en el Tramo 4. No se abren policies de escritura del lado del cliente: insertar un miembro pendiente, generar su token y escribir N filas de colaborador en una sola transacción es más seguro en un lugar que en cuatro policies. Los invariantes los cuida el disparador (§3.6) por si alguien entra por otra puerta.

| Ruta | Método | Candado | Hace |
|---|---|---|---|
| `/api/workspace` | PATCH | dueño principal | nombre, correo de facturación, razón social, RFC, régimen, CP |
| `/api/workspace/miembros` | POST | dueño o admin; plan permite (§4.2) | el alta de 3 pasos: fila de miembro pendiente con `kit_habitual` + una fila en `event_collaborators` por boda elegida |
| `/api/workspace/miembros/[id]` | PATCH | dueño o admin | cambiar rol (nunca al principal), cambiar bodas y permisos |
| `/api/workspace/miembros/[id]` | DELETE | dueño o admin | revocar: `status='revoked'` en el miembro **y** en todas sus filas de colaborador del workspace |
| `/api/workspace/clientes` | POST | dueño o admin | fila en `event_collaborators` con `tipo='cliente'`, sin miembro |
| `/api/invite/[token]` | POST | el token | ya existe para bodas; aprende el token de miembro |

El admin no puede tocar la ruta de `/api/workspace` (facturación) ni cambiar el rol del dueño principal. Es la frontera del spec madre: dinero y destrucción.

### 5.1 El alta de tres pasos

**Paso 1, persona.** Correo y rol (Admin / Colaborador). Si el correo ya es miembro, se ofrece editar. Si el plan no permite, aviso y fin (§4.2). Si excede los incluidos, línea de costo.

**Paso 2, bodas.** Lista de bodas activas del workspace con palomita. Admin: se salta este paso, entra a todas. Colaborador: elige.

**Paso 3, permisos.** Por boda elegida, la lista de 12 módulos con `PermisosEditor` (el del Tramo 2, sin cambios). Precargado con el kit: si la persona ya existe en otras bodas, lo que tiene ahí; si es nueva, "Puede editar" en los módulos prendidos de esa boda.

**Al guardar:** un POST escribe todo. La respuesta trae el enlace `/invite/<token de miembro>`. Sin correo: el enlace se copia, como hoy.

### 5.2 Aceptar

`/invite/[token]` busca primero en `event_collaborators` (lo de hoy) y si no, en `workspace_members`. Para un token de miembro, al entrar o registrarse: `user_id`, `status='active'`, `accepted_at` en el miembro, y **se activan todas las filas pendientes de `event_collaborators` con ese correo en bodas de ese workspace**. Una sola aceptación, N bodas. Después manda a la primera boda que tenga.

Ojo heredado del Tramo 1: `testviewer@gmail.com` y `diego.garza17@gmail.com` son la misma cuenta. El correo de la invitación puede no ser el de quien acepta. Regla: **el que acepta gana** (`user_id` del que entró), y se registra el correo real en `workspace_members.email` para que la lista muestre a quien de verdad está.

### 5.3 Invitar cliente

Desde `/cuenta/equipo` (elige boda) o desde la pestaña Equipo de la boda (boda fija). Correo, boda, punto de partida (Solo lectura / Puede editar). Escribe `event_collaborators` con `tipo='cliente'` y los permisos. Si ese correo ya es cliente en otra boda del workspace, se rechaza con el motivo. Si es miembro del equipo, se rechaza: "ya es de tu equipo, dale acceso desde su ficha".

### 5.4 Desde la pestaña Equipo de la boda

Hoy inserta directo en `event_collaborators` con `tipo='equipo'`. Eso desaparece. Sus dos botones pasan a ser: **Agregar persona** (abre el alta de 3 pasos con esa boda ya palomeada) e **Invitar cliente** (boda fija). La lista y el editor de permisos por persona no cambian. Quitar a alguien de esa boda sigue siendo quitarle todos los módulos (el acceso es la suma de permisos); revocarlo del workspace es en `/cuenta/equipo`.

---

## 6. Superficies

| Pantalla | Estado | Qué hace |
|---|---|---|
| `/cuenta` | **nueva**, layout con pestañas | Solo dueños y admins. Ruta cerrada con `<SinAcceso volverA="/dashboard">`. Si la persona es dueño o admin de más de uno, el encabezado muestra cuál y un enlace para cambiar |
| `/cuenta/equipo` | **nueva** | Contador de asientos (ocupados / incluidos / extra con costo), lista de miembros con rol, estado y bodas, sección Clientes abajo. Botones: Invitar cliente, Agregar persona. Editar abre la ficha: rol, bodas, permisos por boda, revocar |
| `/cuenta/actividad` | **nueva** | El `ActividadTab` del Tramo 4 sin `eventId`: consulta todas las bodas del workspace, gana columna de boda y filtro de boda (dropdown negro). Restaurar igual que hoy; el candado del endpoint ya acepta dueño o admin |
| `/cuenta/plan` | **nueva**, solo dueño principal | Los tres planes con el activo marcado, la factura estimada (plan + asientos extra), y el formulario de facturación. Cambiar de plan: enlace a contacto hasta que exista Stripe. El admin que entre por URL ve `<SinAcceso>` |
| Menú de usuario (dashboard y layout de boda) | **modificado** | Entrada "Mi workspace" con pastilla del plan, visible si eres dueño o admin de alguno |
| `/perfil` | **modificado** | Se quita la sección "Plan actual"; queda un enlace a `/cuenta/plan` |
| `/dashboard` | **modificado** | Lista también las bodas de los workspaces donde soy admin. Encabezado por workspace solo si hay más de uno |
| `/events/new` | **modificado** | Campo "Workspace" solo si soy dueño o admin de más de uno |
| `/events/[id]/configuracion` → Equipo | **modificado** | Botones nuevos (§5.4). `role` de invitación desaparece del todo |
| `/admin` | **modificado** | Plan leído y escrito en el workspace |

Diseño: el mismo de la pestaña Equipo de la boda (dos columnas en escritorio, apilado en móvil), pastillas del catálogo de colores existente, dropdowns de filtro en `#1D1E20`, CTA en teal. Sin emojis. Las pantallas se iteran en el artifact antes de codear (regla `ui-iterar-en-artifact-no-en-preview`); el mockup del 7-sep es el punto de partida, no el final.

---

## 7. Migración

Corre **después** de que el código esté en producción, en archivos bajo `docs/superpowers/plans/sql/` con la fecha del día en que se escriban (uno por tanda del §10), cada uno con bloque de previo (solo lectura) y bloque de aplicar. Se corre solo si Diego aprueba el previo.

1. **Plan.** `workspaces.plan` = `users.plan` del dueño principal cuando sea `free | pro | agency`; cualquier otro valor cae a `free` y sale en el previo. Quien no tiene workspace no tiene plan que migrar.
2. **Equipo sin asiento.** Cada fila de `event_collaborators` no revocada con `tipo='equipo'` (o `tipo is null`) cuyo correo no tiene fila en `workspace_members` del workspace de esa boda recibe una: `rol='colaborador'`, `status` = `active` si ya tiene `user_id`, si no `pending`, `invited_by` = el de la fila. La consulta 3 del brainstorm dice cuántas son; la nota del 4-sep dice que son 7 en toda la base y ninguna de bodasplanner@hotmail.com. **Ojo:** si alguna de esas 7 es en realidad un cliente (una novia), se marca `tipo='cliente'` a mano en el previo antes de aplicar, y no recibe asiento.
3. **Nada más se toca.** `users.plan` queda. `role` queda. Ninguna fila se borra.

Reversible: el bloque de deshacer borra las filas de miembro que este script creó (llevan `invited_by` y un `invited_at` igual al de la corrida) y pone `workspaces.plan` de vuelta en `free`.

---

## 8. Qué queda fuera

- **Stripe.** Cobrar, `price_id`, portal. El catálogo deja el lugar.
- **Tope de asientos.** Se cuenta y se avisa; no se bloquea por encima de los incluidos.
- **El medidor de Free: 1 boda al mes.** Es del paywall, no de aquí; `workspaces.plan` es lo que lo hace posible. Decidido el 7-sep: se cuenta **por mes de creación** ("puedes crear una boda al mes"), no por la fecha en que ocurre. Free no esconde módulos: sus tres palancas son bodas (1 al mes), equipo (solo el dueño) e historial (7 días). Cerrar herramientas por plan metería un segundo sistema de acceso encima del de permisos por persona.
- **Transferir la propiedad.** Soporte manual (decisión 4).
- **Selector de workspace activo.** Decisión 2.
- **Ventana de Actividad por plan.** Función lista, corte después.
- **Whitelabel de Agency.** Epic propio; aquí solo `whitelabel: true` en el catálogo.
- **Bitácora de acciones del workspace** (dar de alta, revocar, cambiar rol). `event_audit_log` es por evento. Las acciones que tocan una boda (dar o quitar acceso) sí se registran ahí con `modulo='equipo'` como hoy; las puras del workspace esperan a que exista dónde guardarlas.
- **`permisos_cuenta.rolodex`.** Declarado desde el Tramo 1; conectarlo es del spec del Rolodex.
- **`conversations.workspace_id`** del omnicanal guarda `events.user_id`, no `workspaces.id`. Choque de nombre; se renombra en su propio chat.

---

## 9. Criterios de aceptación

1. Diego (Pro) agrega a Regina como colaboradora en dos bodas con permisos distintos en cada una, copia el enlace, Regina entra con una cuenta nueva y **aterriza en la primera boda con exactamente esos permisos**. Un solo enlace.
2. `/cuenta/equipo` muestra "3 asientos · 1 incluido · 2 extra $580/mes" con Regina todavía pendiente: **la invitación ya ocupa el asiento**.
3. Una cuenta Free ve "Agregar persona", le pica y recibe el aviso de plan, no un formulario. **Invitar cliente sí le funciona.**
4. Daniela (admin del workspace) **ve en su dashboard las 43 bodas de Diego** sin ser colaboradora de ninguna, y entra a cualquiera con Total.
5. Daniela entra a `/cuenta/plan` por URL y ve `<SinAcceso>`. Un colaborador entra a `/cuenta` por URL y ve `<SinAcceso>`.
6. Revocar a Regina desde `/cuenta/equipo` la saca de sus dos bodas de un golpe; su fila en Actividad dice quién y cuándo.
7. Un correo ya cliente en una boda no se puede invitar como cliente a otra del mismo workspace; el motivo se lee en pantalla.
8. `/admin` cambia el plan de bodasplanner@hotmail.com a Pro y `/cuenta/plan` de ella lo refleja; `users.plan` no cambia.
9. `/cuenta/actividad` lista movimientos de varias bodas con su columna, filtra por boda y restaura.
10. Una petición cruda a la base que intente revocar o borrar al dueño principal se rechaza.
11. `asientos.ts`, `planes.ts` e `invitacion.ts` tienen pruebas de Vitest que cubren: contar con pendientes y revocados, costo extra por plan, Free no invita, admin se salta el paso de bodas, kit precargado de otras bodas, y qué filas activa aceptar.

---

## 10. Orden de implementación

Cinco tandas, cada una entregable sola. El SQL de cada tanda que lo lleve corre después de su deploy.

1. **Cimiento y catálogo.** `lib/workspace/` con pruebas. Columnas nuevas, `es_admin_de`, `asegurar_workspace`, `guard_workspace_members`, el guard de eventos endurecido. Migración del plan. `rolCuenta` desde `workspace_members`. `/admin` lee y escribe el workspace. Nada visible cambia para el usuario.
2. **`/cuenta` con Equipo.** Layout, menú, lista de miembros, asientos, alta de tres pasos, invitar cliente, aceptar token de miembro, revocar. La pestaña Equipo de la boda cambia sus botones. Migración de equipo sin asiento. **Aquí se para y se prueba con una sesión de colaboradora real.**
3. **Dashboard del admin.** Policies de la §3.7, dashboard agrupado, campo Workspace al crear boda.
4. **Actividad del workspace.** `/cuenta/actividad`, `actividad_ver` con la rama del workspace, `plan_del_evento`.
5. **Plan y facturación.** `/cuenta/plan`, `/api/workspace` PATCH, Perfil sin plan.

Cada tanda se planea por separado con `writing-plans`. Este documento es el mapa.
