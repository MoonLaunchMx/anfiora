# Rolodex — cimiento de datos

**Fecha:** 4-sep-2026
**Estado:** diseño en revisión de Diego.
**Reemplaza:** el §2 del spec del 1-sep (`2026-09-01-rolodex-proveedores-design.md`), que trataba el cimiento como un problema de permisos. Lo era de esquema.
**Mockup del producto:** https://claude.ai/code/artifact/a500d43d-4ae4-4cb3-9c38-af8ba9bca1d0

---

## 1. Por qué este spec existe

El 3-sep escribimos un "cimiento" que resultó ser control de acceso: candados de nav, guardias de página, funciones de RLS. Diego lo cortó con razón — **el Rolodex es historial de proveedores, no permisos.** Ese trabajo queda parado sin mergear y su tema vive en el epic de accesos.

El cimiento de verdad es el esquema. Hoy la tabla `suppliers` no aguanta un directorio: tiene un techo de catorce categorías que el planner no puede mover, no tiene etiquetas, no se puede archivar, y su relación con el presupuesto está escrita en dos columnas que ya se desincronizaron.

**Nada de lo que sigue es opcional para el Rolodex.** Cada punto es algo que, sin arreglarlo, hace que el directorio nazca mal.

---

## 2. Estado verificado de los datos (4-sep, producción)

| Comprobación | Resultado |
|---|---|
| Proveedores duplicados por `(user_id, nombre)` | **0 filas** |
| Mismo proveedor dos veces en un evento | **0 filas** |
| Ligas presupuesto ↔ proveedor desincronizadas | **6 filas** |

Los `UNIQUE` entran sin limpieza previa. Las 6 ligas rotas son el único dato que necesita decisión, y se resuelve en §3.5.

---

## 3. Los siete cambios

### 3.1 El default de `status` no pasa su propio CHECK

`event_suppliers.status` tiene default `'contactado'`, y su `CHECK` solo acepta `nuevo | cotizado | contratado | descartado`. Cualquier `INSERT` que no mande `status` explícito revienta con `23514`.

Hoy no explota porque el código siempre lo manda. Es una mina para el import, para un seed y para el alta nueva del Rolodex.

**Cambio:** el default pasa a `'nuevo'`, que es el primer estado real del pipeline.

### 3.2 `UNIQUE (event_id, supplier_id)` en `event_suppliers`

No existe, aunque la documentación lo daba por hecho. Sin él, el mismo proveedor puede entrar dos veces a la misma boda y el conteo del expediente ("6ª vez") deja de ser verdad.

**Cambio:** se agrega. Cero filas que limpiar.

### 3.3 En `suppliers` va un índice, NO un `UNIQUE` de nombre

Se propuso `UNIQUE (user_id, name)`. **Se rechaza**, porque contradice una decisión ya tomada en el §7 del spec del 1-sep:

> *Nombre parecido → aviso **suave**, no bloquea — dos floristas reales pueden llamarse igual.*

Un `UNIQUE` vuelve ese aviso un bloqueo duro. El día que existan dos "Flores Bella" de verdad, la app le dice al planner que se equivocó cuando no, y no le deja salida.

**Cambio:** índice no único sobre `(user_id, lower(name))`, para que la búsqueda del anti-duplicado sea instantánea. El juicio de "¿es el mismo o son dos?" se queda donde debe estar: en la persona, con el aviso enfrente.

### 3.4 Las categorías suben al eje del usuario

**Este es el cambio de fondo.** Los demás son de una línea; este mueve un eje.

`suppliers.category` tiene un `CHECK` con catorce categorías fijas. Las categorías personalizadas viven en `event_settings.budget_categories`, que es **por evento**. El Rolodex es **global del usuario**. Los dos ejes no se cruzan.

Traducido al reclamo real: si Dani crea "Ambulancia y paramédicos" en la boda de Olivia, no la puede usar en su Rolodex — el `CHECK` la rechaza — y aunque pudiera, la categoría no existiría en su siguiente boda.

El techo está **triplicado**, y por eso hay que tocar tres lugares:

1. **La base.** Se cae el `CHECK` de `suppliers.category`.
2. **El tipo.** `Supplier.category` deja de ser `BudgetCategory` y pasa a `string` en `lib/types.ts:545`. Esto es seguro de hacer: `categoryLabel()` ya devuelve el nombre tal cual cuando no lo reconoce, así que las pantallas ya saben pintar una categoría inventada.
3. **El vocabulario.** Nace `users.categories JSONB` — la lista de categorías del planner. **Sin tabla nueva.**

**Una sola lista, decidido por Diego.** El vocabulario sirve al Rolodex y a los presupuestos. Lo que Dani teclea en el presupuesto de una boda entra a su vocabulario y le aparece en el Rolodex para siempre.

**Lo que NO cambia:** `event_settings.budget_categories` se queda. Sigue siendo *cuáles de mis categorías muestra esta boda* — una boda y un corporativo no tienen los mismos cajones, y esa era la razón original de que fueran por evento. El vocabulario es el idioma; la lista del evento es lo que se dice en esa boda.

**Siembra:** al migrar, `users.categories` se llena con la unión de las `budget_categories` de todos los eventos del usuario más las catorce base. Nadie pierde una categoría que ya había creado.

**A verificar antes de construir:** que las políticas de `users` dejen al planner leer y escribir su propia fila. `/perfil` ya edita nombre y teléfono, así que debería estar — pero se confirma leyendo las políticas, no suponiendo. Si no está, el vocabulario se guarda y no se puede leer: el mismo fallo mudo de siempre.

**Escritura desde el presupuesto:** cuando alguien agrega una categoría nueva a un evento, la app la escribe en los dos lados — en el evento y en el vocabulario. Es una línea en el guardado que ya existe.

### 3.5 Una sola dirección en el vínculo con el presupuesto

Hoy la relación está escrita dos veces: `event_suppliers.event_budget_id` apunta a la partida, y `event_budgets.event_supplier_id` apunta de regreso. Nada obliga a que coincidan, y **ya no coinciden en 6 filas**.

**Cambio:** `event_suppliers.event_budget_id` es la única verdad — el proveedor se asigna a una partida, no al revés. `event_budgets.event_supplier_id` deja de escribirse y el Presupuesto lo obtiene por unión.

**La columna vieja se borra.** Dejarla ahí sin escribirse es el parche: en tres meses nadie recuerda cuál de las dos manda y alguien la vuelve a leer. Se arreglan las 6 filas, se mueven las dos pantallas que la leen, y `event_budgets.event_supplier_id` deja de existir. Una relación, una columna.

**Las 6 filas rotas — ya se leyeron (4-sep) y la reparación es automática.**

Cinco son *sin regreso*: la partida nunca recibió el apuntador. Al volverse derivada se corrigen solas y nada cambia en pantalla.

Una es un conflicto real: en la boda demo **Olivia & Pedro**, la partida "Wedding planner" apunta a *Daniela Wedding planner* mientras la tarjeta reclama *Avianta Wedding Agency*. Con la regla nueva gana el proveedor — Avianta — y esa partida cambia de nombre una vez.

**Las seis son datos de demo**; no hay planners reales en el sistema al 4-sep-2026. No hace falta revisión fila por fila ni preservar nada: se aplica la regla y listo.

La lectura, por si hay que repetirla antes de correr la migración:

```sql
select
  count(*) filter (where b.event_supplier_id is null)                as sin_regreso,
  count(*) filter (where b.event_supplier_id is not null
                     and b.event_supplier_id <> es.id)               as apuntan_a_otro
from event_suppliers es
join event_budgets b on b.id = es.event_budget_id
where b.event_supplier_id is distinct from es.id;
```

- **`sin_regreso`** — la partida nunca recibió el apuntador. Al volverse derivada no cambia nada en pantalla; se corrigen solas.
- **`apuntan_a_otro`** — la partida apunta a un proveedor distinto del que la reclama. Hoy el Presupuesto muestra **un proveedor y la tarjeta muestra otro**. Al elegir dirección, esas partidas cambian de proveedor en pantalla. **Hay que listarlas y enseñárselas a Diego antes de correr nada**, evento por evento, porque son datos reales de bodas suyas.

### 3.6 Etiquetas y archivado

Ya venían en el §10 del spec del 1-sep y siguen igual:

- `suppliers.tags JSONB` — etiquetas libres. Toda la app usa arrays de etiquetas menos esta tabla, y en un directorio de 200 proveedores la gente filtra por "económico" o "no contestan" mucho más que por categoría.
- `suppliers.archived_at TIMESTAMPTZ` — sacar de la vista sin borrar. Borrar se lleva el historial, que es justo lo que el Rolodex vende.

### 3.7 La bitácora de la ficha global

`event_audit_log.event_id` es `NOT NULL`, así que editar la ficha global de un proveedor no tiene dónde registrarse. Las notas de actualización solo funcionan dentro de un evento.

**Cambio:** `event_id` se vuelve nullable.

**Ojo, y esto es lo que puede salir mal:** las políticas de RLS de esa tabla filtran por evento. Una fila con `event_id` nulo necesita su propia regla, por usuario — si no, se registra y **nadie la puede leer nunca**. Es exactamente el fallo mudo que ya nos mordió dos veces. La regla nueva se escribe en la misma migración, no después.

---

## 4. Lo que ya tienes y no se había visto

`conversations.contact_supplier_id` ya apunta a `suppliers`. El núcleo omnicanal ya sabe que una conversación puede ser con un proveedor y no solo con un invitado.

**Matiz verificado:** la columna existe en la base, pero **el código no la usa en ningún lado** — cero referencias en `lib/` y en `app/`. No es una función gratis; es cimiento gratis. Alguien tiene que escribir la lectura.

Lo que habilita: el expediente del proveedor puede mostrar también todo el WhatsApp que has tenido con él, junto a sus bodas y sus reseñas. Es la ficha que ninguna competencia tiene, y no requiere ni una columna nueva.

**No entra en esta tanda.** Se nombra para que el expediente se diseñe con ese lugar reservado.

---

## 5. Lo que NO entra

- **Permisos, RBAC, quién ve qué.** Es su propio epic (`rbac-a-medias-mapa-real`, `workspace-dos-capas-asientos`). El Rolodex no lo espera y no lo decide.
- **Leer las conversaciones del proveedor.** §4, cimiento reservado.
- **Fusionar duplicados.** No hay ninguno y el aviso suave evita que nazcan.

---

## 6. Orden de ejecución

El código y la base tienen que moverse en el orden correcto, porque dos de estos cambios **sí** son visibles:

1. **Primero lo que no rompe nada** (default de `status`, `UNIQUE` de `event_suppliers`, índice de nombre, `tags`, `archived_at`). Se puede correr con el código actual desplegado.
2. **Después las categorías**, y en este orden: sembrar `users.categories` → desplegar el código que la lee y la escribe → quitar el `CHECK`. Al revés, el código viejo escribe una categoría que la base ya acepta pero el tipo rechaza.
3. **Al final el vínculo:** reparar las 6 filas → mover las dos pantallas que lo leen → borrar la columna.
4. **La bitácora**, con su política nueva en la misma transacción.

Nada de esto queda a medias ni "para después". Cuando termina, la base dice una sola verdad por cada cosa.

---

## 7. Riesgo mayor de esta tanda

Quitar el `CHECK` de `suppliers.category` y ensanchar el tipo a `string` toca **todas las pantallas que pintan una categoría de proveedor**. La mitigación ya existe y por eso es seguro: `categoryLabel()` cae al nombre crudo cuando no conoce la categoría, así que una categoría inventada se ve bien sin tocar una sola pantalla. Aun así, es el punto donde hay que revisar a mano antes de mergear.
