# Accesos por herramienta — diseño

**Fecha:** 4-sep-2026
**Estado:** diseño aprobado. Once decisiones cerradas en esta sesión.
**Mockups:** `2026-09-04-accesos-despacho-mockup.html` (el modelo y las pantallas) · `2026-09-04-accesos-invitar-y-heredar.html` (invitaciones y migración)
**Cierra:** `rbac-a-medias-mapa-real` · `workspace-dos-capas-asientos` · `rbac-viewer-readonly-pendiente` · `rbac-colaboradores-solo-vivia-en-ui`

---

## 1. Por qué

El 4-sep, al abrir Anfiora por primera vez con una sesión de colaborador de verdad, salieron tres huecos de producción:

1. **Finanzas es invisible para cualquiera que no sea el dueño.** `event_budgets`, `event_suppliers`, `supplier_payments` y `suppliers` conservan la política de junio (`events.user_id = auth.uid()`), escrita antes de que existieran los colaboradores. Devuelven cero filas **sin error**: la pantalla se ve igual que una boda sin datos.
2. **El Timeline lee pero no guarda.** `event_timeline_tasks` tiene policy de `SELECT` para colaboradores y de `ALL` solo para el dueño. La pantalla se ve normal y miente.
3. **El viewer ve botones de borrar.** Los aprieta, el cambio se pinta y desaparece al refrescar.

El patrón de fondo: **el RBAC se fue construyendo tabla por tabla y quedó a medias**, y hasta ahora solo el dueño había usado la app. Parcharlo tabla por tabla reproduce el mismo defecto. Este diseño lo reemplaza por un cimiento con una sola puerta.

Al mismo tiempo, el modelo de roles actual no alcanza para la operación real: `editor` y `viewer` son roles de boda completa, y el caso "la novia edita sus mesas pero solo mira el presupuesto" no cabe en ninguno de los dos.

---

## 2. El modelo

### 2.1 Dos capas

**Arriba, el despacho** — ¿quién existe en tu cuenta? Independiente de las bodas.

| Rol de cuenta | Puede |
|---|---|
| **Dueño** | Todo, incluida facturación, plan y borrar la cuenta. Puede haber varios; uno es el **principal**, no se puede eliminar y es el único con cobro |
| **Administrador** | Todo lo del dueño **menos facturación y destruir**. Da de alta gente, reparte accesos, entra a todas las bodas |
| **Colaborador** | Por sí solo no entra a nada. Solo llega a donde lo metan, boda por boda |
| **Cliente** | Una sola boda. **No es miembro del despacho** y no ocupa asiento |

La frontera Dueño↔Admin es **dinero y destrucción**, que es donde la trazan Slack, Notion, Figma y Google Workspace sin excepción.

**Abajo, cada boda** — ¿a qué entra, y puede tocar? Aquí **ya no hay roles**. Hay una lista de herramientas y, en cada una, un nivel.

### 2.2 Los cuatro estados por herramienta

| Nivel | Significa |
|---|---|
| **Sin acceso** | La herramienta no existe para esa persona. No aparece en el nav, y entrar por URL la manda a su lista de bodas |
| **Ver** | Lee. Filtros, búsqueda y exportar sí — explorar no es tocar. Ningún control de mutación se dibuja |
| **Editar** | Agrega y modifica. **No borra** |
| **Total** | Todo lo anterior, más borrar y configurar esa herramienta |

Es el modelo de Odoo traído a nuestro tamaño: `unlink` es un derecho separado de `write`. La razón es de operación, no de código: en un despacho el error caro no es "lo editó mal" — es "ya no está".

"Editor" y "Viewer" dejan de existir como cosa que se guarda. La pantalla los **calcula** para resumir: si todo lo tuyo está en Ver, eres solo lectura.

### 2.3 Los doce módulos

```
invitados · invitacion · mensajes · mesas · timeline
regalos · album · playlist · vestimenta
presupuesto · proveedores · pagos
```

Cualquier módulo puede quedar en "sin acceso", **invitados incluido**. La granularidad es total por decisión explícita.

**No confundir con `lib/features.ts`.** Son dos dimensiones distintas de la misma lista:
- `enabled_features` = *"esta boda usa Mesa de regalos"* — configuración de la boda, switches, vive en Configuración.
- `permisos` = *"Juan entra a Mesa de regalos"* — acceso de una persona, palomitas, vive en Equipo.

Un módulo apagado en la boda se muestra en gris en la pantalla de Equipo y no se puede otorgar. **Nunca comparten pantalla.**

---

## 3. Decisiones cerradas

1. **El permiso vive en la herramienta, no en la persona.** Nadie es "editor de la boda".
2. **Cada persona trae un kit habitual** en el despacho, que se aplica al meterla a una boda. Se corrige la excepción, no se arma todo desde cero.
3. **Finanzas son tres permisos** (presupuesto, proveedores, pagos), agrupados visualmente.
4. **El Rolodex es permiso propio del despacho**, no viene amarrado a ser admin.
5. **Activar y dar acceso nunca comparten pantalla.** Switches en Configuración, palomitas en Equipo. Distinta palabra: *activar* vs *dar acceso*.
6. **Borrar es su propio nivel.** No se hereda de editar.
7. **Una función en la app, una función en Postgres, un componente.** Ninguna pantalla decide permisos por su cuenta.
8. **Los borrados se registran desde la base**, con disparador, no desde la interfaz.
9. **El Administrador sí puede otorgar el nivel Total.** Un admin que no puede repartir las herramientas que su equipo necesita no está administrando nada. El control no está en amarrarle la mano — está en que cada borrado queda firmado.
10. **Solo Dueño y Admin invitan**, a quien sea: gente nueva al despacho, compañeros a una boda, y clientes. El colaborador no reparte accesos de ningún tipo. La fila de solicitudes estilo Slack se construye el día que estorbe de verdad, no antes.
11. **En la migración nadie pierde acceso, y borrar se suspende.** Detalle en §8.

---

## 4. Datos

> **Una sola palabra.** *Despacho* y *workspace* son **lo mismo**: despacho en la interfaz y al hablarlo, `workspace` en el código, porque todas las tablas de Anfiora están en inglés. Este documento no vuelve a usar los dos como si fueran cosas distintas.

### 4.1 Tablas nuevas: `workspaces` y `workspace_members`

Son las dos únicas tablas nuevas, y se justifican contra la regla de "no crecer el schema" porque **ni el despacho ni su membresía son por evento**: no caben en nada existente.

**Por qué el despacho lleva tabla propia y no se deriva de `users`.** La primera versión de este diseño decía que el despacho *era* la fila del dueño en `users`. Está mal, y se rompe en tres lugares que ya vienen en camino:

1. **La factura.** Cobrar en México significa RFC, razón social y domicilio fiscal. Eso no es "quién eres tú", es "quién es tu despacho". Sin tabla propia, `users` se vuelve un cajón donde el teléfono personal vive junto a los datos fiscales de la empresa.
2. **El plan.** Los $990 son de la cuenta, no de la persona. En cuanto exista alguien que pertenece a dos despachos, `users.plan` deja de tener una respuesta correcta.
3. **Transferir la propiedad.** Con el despacho pegado a un id de usuario, pasar el negocio a otro dueño obliga a reescribir el dueño en cada evento y en cada fila de miembros. Con tabla propia es un renglón.

Meterla hoy cuesta prácticamente nada — un renglón por dueño existente, generado en la misma migración. Meterla después de que Stripe ya cobre significa tocar todas las llaves.

```sql
workspaces (
  id                uuid pk,
  name              text not null,          -- "Moonlaunch Eventos"
  primary_owner_id  uuid not null references users(id),
  created_at        timestamptz default now()
)
-- Plan, datos fiscales y asientos aterrizan aquí cuando llegue el chat de precios.
-- Este spec NO los agrega: solo deja el lugar correcto.

workspace_members (
  id                 uuid pk,
  workspace_id       uuid not null references workspaces(id),
  user_id            uuid references users(id),   -- null hasta que acepta
  email              text not null,
  rol                text not null,   -- 'dueno' | 'admin' | 'colaborador'
  es_dueno_principal boolean not null default false,
  kit_habitual       jsonb,           -- mismo shape que event_collaborators.permisos
  permisos_cuenta    jsonb,           -- { "rolodex": "ver" | "editar" | "total" }
  status             text not null,   -- 'pending' | 'active' | 'revoked'
  invite_token       text unique,
  invited_by         uuid references users(id),
  invited_at         timestamptz default now(),
  accepted_at        timestamptz,
  unique (workspace_id, email)
)
```

Y una columna: **`events.workspace_id`**, para que una boda sepa de qué despacho es. `events.user_id` se conserva — no se toca en esta etapa.

Invariantes que hace cumplir la base, no la interfaz:

- Exactamente **una** fila con `es_dueno_principal = true` por `workspace_id` (índice único parcial), y su `user_id` coincide con `workspaces.primary_owner_id`.
- La fila del dueño principal **no se puede borrar ni revocar** (trigger).
- Una persona puede ser miembro de **varios despachos** — es normal y correcto (Slack funciona igual). Cada uno es independiente, y por eso el plan nunca puede colgar de `users`.

### 4.2 Cambios en `event_collaborators`

Esta tabla pasa a significar **"esta persona en esta boda"**, para equipo y para clientes.

```sql
alter table event_collaborators
  add column permisos jsonb,          -- { "invitados": "total", "mesas": "editar", ... }
  add column tipo text;               -- 'equipo' | 'cliente'
-- role queda deprecada: se lee durante la migración y despues se deja de escribir
```

**Por qué JSONB y no una tabla `event_permissions`:** la fila ya existe y ya carga el flujo de invitación; a esta escala (12 módulos × unas decenas de personas) indexar por módulo no compra nada; y `event_settings.enabled_features` ya estableció exactamente este patrón de catálogo en JSONB. Consistencia sobre generalidad.

Las claves ausentes se leen como **sin acceso**. Nunca se infiere un nivel por default.

### 4.3 Cambios en `event_audit_log`

```sql
alter table event_audit_log
  add column modulo   text,   -- de los doce; permite filtrar la pantalla de Actividad
  add column batch_id uuid;   -- agrupa un borrado en cascada para poder restaurarlo entero
```

`AuditAction` crece con los borrados que hoy no registra (`budget.*`, `supplier.*`, `payment.*`, `timeline_task.*`, `permission.granted`, `permission.revoked`, `member.*`). `AuditEntityType` crece igual.

### 4.4 Nota de higiene

`lib/types.ts` declara `CollaboratorStatus = 'pending' | 'accepted' | 'revoked'`, pero el código escribe y lee **`'active'`** (`app/api/invite/[token]/route.ts:99`, `lib/event-access-context.tsx:82`). El tipo está mal desde hace tiempo. Se corrige aquí porque estamos reescribiendo el modelo de esta tabla.

---

## 5. El cimiento

La regla vive en **un solo lugar de cada lado**. Todo lo demás la llama.

### 5.1 En la app — `lib/permisos/`

```
lib/permisos/
├── catalogo.ts    MODULOS, Nivel, etiquetas, a qué entrada del nav pertenece cada módulo
├── resolver.ts    lógica pura: nivelEn(), puede(), resumir(), aplicarKit()
├── contexto.tsx   extiende EventAccessProvider — una query, todos consumen
└── Puede.tsx      el componente
```

`resolver.ts` es **lógica pura y se prueba con Vitest**, que es donde vive la garantía real de este diseño: la tabla de verdad del permiso se verifica sin navegador.

```ts
export const MODULOS = [
  'invitados', 'invitacion', 'mensajes', 'mesas', 'timeline',
  'regalos', 'album', 'playlist', 'vestimenta',
  'presupuesto', 'proveedores', 'pagos',
] as const

export type Modulo = typeof MODULOS[number]
export type Nivel  = 'ninguno' | 'ver' | 'editar' | 'total'
```

Agregar una herramienta a Anfiora es **agregar un renglón aquí**. La pantalla de Equipo se dibuja sola a partir de esta lista.

### 5.2 La pregunta y el componente

```tsx
const { ver, editar, borrar, nivel } = usePermiso('mesas')

// esconder una acción
<Puede modulo="mesas" accion="borrar">
  <button onClick={eliminarMesa}>Eliminar mesa</button>
</Puede>

// proteger una página entera
<Puede modulo="pagos" accion="ver" siNo={<SinAcceso />}>
  <PaginaPagos />
</Puede>
```

**Ninguna pantalla escribe `if` de permisos.** Aplicar esto a los doce módulos se vuelve trabajo mecánico y no una decisión nueva cada vez.

Dos reglas duras de interfaz:

- **Si el nivel es de lectura, la mutación ni se dibuja.** No se dibuja deshabilitada.
- **Ninguna pantalla aplica un cambio optimista antes de que la base lo confirme.** De ahí viene el "se vio guardado y no se guardó".

### 5.3 En Postgres

Un botón escondido es cortesía, no seguridad.

```sql
create function nivel_en(evento uuid, modulo text) returns text
-- 'total' si es dueño o admin del despacho al que pertenece el evento
--          (events.workspace_id -> workspace_members, rol in ('dueno','admin'), status 'active')
-- si no:   event_collaborators.permisos ->> modulo para auth.uid(), o 'ninguno'

create function puede_ver   (evento uuid, modulo text) returns boolean
create function puede_editar(evento uuid, modulo text) returns boolean
create function puede_borrar(evento uuid, modulo text) returns boolean
```

Cada policy es un renglón que las llama:

```sql
create policy "borrar partidas" on event_budgets for delete
  using ( puede_borrar(event_id, 'presupuesto') );
```

`is_event_member` e `is_event_editor` (que hoy usan seis tablas) **se reimplementan encima de `nivel_en`** para que las policies existentes sigan sirviendo mientras se migran módulo por módulo. No se borran hasta que la última policy dejó de llamarlas.

`suppliers` es el caso aparte: se filtra por `user_id`, no por evento, porque es el catálogo de la cuenta (el Rolodex). Un colaborador ve **solo las fichas ligadas a eventos donde ya es miembro**, nunca el directorio completo. El seam para esto ya está escrito en `lib/rolodex/permisos.ts`, en la rama `feat/rolodex-cimiento` — hoy dice "¿eres el dueño?" y aquí se vuelve "¿tienes este permiso?". Si esa rama entra antes, se cambia esa función y ninguna pantalla se entera.

### 5.4 La bitácora del borrado

```sql
create function log_borrado() returns trigger  -- AFTER DELETE ... FOR EACH ROW
-- inserta en event_audit_log con old_value = to_jsonb(OLD), modulo y batch_id
```

Se cuelga de cada tabla con datos de la boda. **No se llama desde la interfaz**: hoy `logAction()` vive en el código de pantalla y está escrito para fallar en silencio — correcto para "cambió un nombre", inaceptable para "desapareció la lista". Si la fila se fue, la bitácora lo supo, venga de donde venga el borrado.

**Restaurar** es volver a insertar `old_value`. Los borrados en cascada (un invitado se lleva a sus acompañantes) comparten `batch_id` y se restauran en conjunto, padre primero.

---

## 6. Superficies

| Pantalla | Estado | Qué hace |
|---|---|---|
| `/cuenta/equipo` | **nueva** | Lista de quién existe en el despacho. Rol de cuenta, bodas, kit habitual. Invitar persona / invitar cliente |
| `/events/[id]/configuracion` → Equipo | **rehecha** | Por persona: la lista de módulos con su nivel. Kit habitual precargado. Dorado = puede borrar. Atajos "todo a ver" / "quitar todo" |
| `/events/[id]/actividad` | **nueva** | Qué pasó en esta boda, quién y cuándo. Restaurar en los borrados |
| `/perfil` → Actividad | **nueva pestaña** | Lo mismo, para las bodas del despacho completo |
| `app/events/[id]/layout.tsx` | **modificada** | El nav se construye de `features × permisos`. Ruta sin permiso redirige |
| Los 12 módulos | **modificados** | Envolver controles de mutación en `<Puede>` |

Sin ninguna herramienta otorgada, la persona **no entra a la boda** y no le aparece en su lista. El acceso *es* la suma de los permisos: no hay un botón separado de "quitar de la boda".

---

## 7. Qué queda fuera

- **Asientos y cobro.** El modelo de $290 por persona es chat propio. Este diseño no toca precios ni cuenta miembros para facturar. Deja el lugar exacto: `workspace_members` es lo que se contaría, y `workspaces` es donde viven el plan y los datos fiscales.
- **La fila de aprobación de invitaciones** (Opción 2 de Slack). Decisión 10.
- **Papelera con borrado suave.** La bitácora es la papelera; no se agrega `deleted_at` a 27 tablas.
- **Permisos a nivel fila** (ver solo *algunos* invitados). No lo pide nadie.
- **Rolodex más allá del seam.** `permisos_cuenta` queda declarado; conectarlo es del spec del Rolodex.

---

## 8. Migración

**Nadie se puede quedar sin lugar.** El día del cambio, cada persona que hoy trabaja tiene que amanecer en algún lado.

| Hoy | Mañana |
|---|---|
| Dueño del evento (`events.user_id`) | Se le crea **su despacho**: una fila en `workspaces` con su nombre, y él como dueño principal. Sus eventos quedan apuntados con `workspace_id`. Dos dueños distintos → **dos despachos separados**, no uno revuelto |
| `role = 'admin'` de una boda | Colaborador con **Total en los doce módulos**, solo en esa boda. **No sube a Admin del despacho** — amanecería con acceso a bodas donde nunca lo invitaron |
| `role = 'editor'` | **Editar en los doce módulos.** Pierde borrar, hasta que se lo den a mano |
| `role = 'viewer'` | **Ver en los doce módulos** |

El renglón del editor es el único cambio real de poder. Se hace a propósito: lo que existe hoy no es una decisión que alguien tomó, es un permiso que quedó abierto por default. Nadie pierde **acceso** — solo la capacidad de destruir, y es reversible en un clic.

Tres condiciones que no se negocian:

1. **El SQL no se corre hasta que el código esté en producción.** Regla de sincronía del proyecto; aquí al cuadrado, porque quien quede a medias no puede trabajar.
2. **Pantalla de previo antes de aplicar.** Nombre por nombre, boda por boda, quién amanece con qué. Se corre solo si Diego la aprueba.
3. **La migración es idempotente y reversible.** `role` se conserva durante todo el proceso.

---

## 9. Dependencia bloqueante

**No se puede escribir el SQL a ciegas.** `ESTADO_ACTUAL.md` deja constancia de que no hay fuente de verdad del schema, y de que no hay evidencia en el repo de las políticas de `guests`, `party_members`, `tables`, `table_seats`, `event_timeline_tasks` ni `event_budgets`.

Antes de la primera línea de SQL hacen falta dos lecturas de solo lectura, que corre Diego:

1. `select * from pg_policies where schemaname = 'public'`
2. `pg_dump --schema-only`

No frena el spec ni el trabajo de interfaz. Frena las policies.

---

## 10. Criterios de aceptación

1. Un colaborador con `presupuesto: 'ver'` **ve las partidas** de la boda y **no ve** ningún botón de agregar, editar ni borrar. Hoy ve la pantalla vacía.
2. Un colaborador con `timeline: 'editar'` crea una tarea y **al refrescar sigue ahí**. Hoy no.
3. Un colaborador con `mesas: 'editar'` **no encuentra en ninguna parte** cómo borrar una mesa; una petición cruda a la base también se rechaza.
4. La novia tiene `mesas: 'editar'` y `pagos: 'ver'` a la vez, y funciona.
5. Cambiar `pagos` de `ver` a `editar` para una persona toma **un clic** y no toca ningún otro permiso.
6. Un módulo apagado en la boda **no se puede otorgar** y se muestra en gris.
7. Cualquier borrado, hecho desde donde sea, aparece en Actividad con quién, cuándo y la fila completa; y se puede restaurar.
8. Un colaborador **no encuentra** cómo invitar a nadie.
9. Un admin del despacho **sí** puede otorgar Total, y hacerlo queda registrado.
10. Agregar un módulo nuevo al catálogo lo hace aparecer solo en la pantalla de Equipo, sin tocar esa pantalla.
11. `resolver.ts` tiene pruebas de Vitest que cubren la tabla de verdad completa: los cuatro niveles × las tres acciones × dueño / admin / colaborador / cliente / ajeno.

---

## 11. Orden de implementación

**No se construyen los doce módulos de un jalón.** El riesgo de este diseño no está en el trabajo repetitivo — está en que el modelo se sienta mal al usarlo. Así que se prueba con uno antes de repetirlo once veces.

### Tramo 1 — El cimiento (nada visible cambia)

Las dos tablas, la columna en `events`, las dos en `event_collaborators`. `lib/permisos/` completo con sus pruebas de Vitest. `nivel_en()` y sus helpers en Postgres, con `is_event_member` e `is_event_editor` reimplementadas encima para que las policies de hoy sigan funcionando. La función genérica del disparador de bitácora.

**El código sale a producción antes que el SQL**, y tolera que las tablas nuevas todavía no existan — exactamente como `resolveFeatures()` ya tolera hoy que `enabled_features` no esté. Es el patrón que la casa ya usa. Cuando el código está arriba, se corre la migración, y hasta ese momento el comportamiento cambia.

La migración trae su **pantalla de previo**: nombre por nombre, boda por boda, quién amanece con qué. No se aplica sin aprobación.

### Tramo 2 — Timeline, un solo módulo

La pantalla de Equipo de la boda, y el Timeline gateado de punta a punta: policies, nav, controles envueltos en `<Puede>`, y su disparador de borrado. Se escoge Timeline porque **hoy está roto de la manera más difícil de detectar** — se ve normal y no guarda — así que el arreglo se nota de inmediato.

**Aquí se para y se usa una semana** con una sesión de colaborador de verdad. Si el modelo se siente bien, lo demás es mecánico. Si algo no cuadra, se descubrió con un módulo hecho y no con doce.

### Tramo 3 — Los once módulos restantes

Trabajo repetitivo y rápido: policies sobre las mismas funciones, controles envueltos, disparador por tabla. Cierra los tres huecos del §1 por completo.

### Tramo 4 — Actividad

Las dos pantallas de lectura (por boda y por despacho) y restaurar.

### Tramo 5 — El despacho

`/cuenta/equipo`, el kit habitual, y el flujo de invitación nuevo para miembros y clientes.

**Cada tramo se planea por separado.** Este documento es el mapa; los planes vienen después, uno a la vez.
