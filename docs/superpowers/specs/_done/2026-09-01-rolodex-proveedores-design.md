# Rolodex de proveedores — diseño

**Fecha:** 1-sep-2026
**Estado:** diseño aprobado. §2 reescrito el 3-sep-2026 tras leer las políticas de RLS y decidir que el Rolodex **no espera al modelo de despacho** — arranca cerrado al dueño de la cuenta. El resto del spec no cambió.
**Mockup visual:** `docs/superpowers/specs/2026-09-01-rolodex-mockup.html` (7 secciones, abrir en navegador)

---

## 1. Por qué

Anfiora ya guarda proveedores, pero no tiene un rolodex. La tabla `suppliers` es por `user_id` desde siempre, y sin embargo **nunca se lee el catálogo**: los dos únicos accesos son crear (`proveedores/page.tsx:79`) y editar (`SupplierDetailModal.tsx:150`), ambos desde dentro de un evento.

Consecuencias:

- Dar de alta al mismo fotógrafo en tres bodas crea **tres filas distintas**.
- Las reseñas (`rating`, `mood`, `response_speed`, `review_text`) viven en `event_suppliers` — correcto — pero como el proveedor se duplica, nunca se puede ver "este DJ me falló 2 de 3 veces".
- Campos que ya existen y nadie llena por falta de pantalla: `contact_name`, `email`, `website`, `city`, `state_region`, `service_radius_km`, `general_notes`.

**Estado de los datos hoy (verificado 1-sep):** 0 fichas con dueño distinto al del evento, 0 duplicados. Se construye sobre limpio: **no hay migración de datos**.

---

## 2. Cimiento: de quién es el Rolodex

> **Reescrito el 3-sep-2026.** El 2-sep se decidió el **modelo de despacho** (asientos de $290, `admin` que sube del evento al workspace, permisos por herramienta y por persona, el cliente que nunca cuesta). Está en la nota `workspace-dos-capas-asientos` con sus tres preguntas abiertas. Ese modelo **obsoleta lo que decía esta sección**: el rol `admin` de evento, del que colgaba el permiso original, desaparece.
>
> El despacho es una pieza mucho más grande que el Rolodex — mueve el eje del cobro y toca toda la app. **Decisión del 3-sep: el Rolodex no lo espera.**

### Quién lo ve

**Solo el dueño de la cuenta.** Ni admin, ni editor, ni viewer.

No es una restricción nueva. Es exactamente lo que la base **ya hace hoy**: las doce políticas de RLS de `suppliers`, `event_suppliers` y `supplier_payments` (leídas el 3-sep) son todas del dueño y **ninguna menciona colaboradores**.

| Tabla | Regla actual |
|---|---|
| `suppliers` | `auth.uid() = user_id` |
| `event_suppliers` | el dueño del evento |
| `supplier_payments` | el dueño, vía el join a través del proveedor |

### Lo que esto rompe hoy, en producción

Las políticas son correctas; lo que está mal es que **la interfaz no las respeta**, y el resultado es un fallo mudo — el mismo patrón de `bug-invitacion-editor-no-guardaba`, pero de lectura.

1. **Un colaborador abre Proveedores o Pagos y los ve vacíos.** La base devuelve cero filas, no un error. La pantalla se ve igual que una boda sin proveedores. Aplica a **todos** los roles, admin incluido.
2. **La captura truena a medias.** El alta escribe primero la ficha en `suppliers` (que sí pasa, porque la política solo pide que el `user_id` sea el de quien teclea) y luego el enlace en `event_suppliers` (que la base rechaza). Queda una ficha huérfana en el catálogo del colaborador y la boda sin proveedor.
3. **El nav no tiene cómo poner el candado.** `adminOnly` solo se evalúa en entradas sueltas (`layout.tsx:319`); Presupuesto, Proveedores y Pagos son sub-ítems del grupo Finanzas y **nunca se filtran**. Ninguna de las tres páginas llama a `useEventAccess()`.

### Propiedad al escribir — corrige un bug vivo

**Hoy:** al crear un proveedor se guarda `user_id: user.id`, el de **quien hace clic** (`proveedores/page.tsx:78`).

**Regla nueva:** `suppliers.user_id = events.user_id` del evento donde se capturó. La ficha pertenece **al dueño del evento**, no a quien la teclea. Hoy, con el Rolodex cerrado al dueño, las dos cosas coinciden — pero escribirlo bien ahora es lo que hace que el día del despacho no haya que migrar fichas.

### El seam (obligatorio)

El despacho llega algún día y no debe dejar piedras que picar:

1. **Una sola puerta.** La regla "¿este catálogo es mío?" vive en **una función** en Postgres y **un módulo** en TS. Hoy las dos dicen *"soy el dueño"*. El día que se venda el primer asiento se cambia esa función, no veinte archivos. Las políticas de RLS **invocan la función** en vez de repetir la condición.
2. **Las reseñas nacen firmadas** (autor). Es una columna barata hoy e imposible de rellenar después.
3. **Nada asume "un solo dueño humano"** — ni en consultas ni en textos de UI.

### Fuera del alcance de este spec

- **Abrirle Finanzas a los colaboradores.** El 4-sep leímos las políticas de las catorce tablas y encontramos algo más grande que el Rolodex: el permiso de colaboradores se construyó tabla por tabla y quedó a medias. Las cuatro de dinero no lo recibieron nunca, y el Timeline lo recibió sólo para leer. Eso es el **epic de accesos por feature**, no este spec.

  Lo único que sí se hizo aquí, y por consistencia: **Presupuesto se cierra al dueño igual que Proveedores y Pagos.** No le quita nada a nadie — con `event_budgets` siendo del dueño, el colaborador ya veía la pantalla vacía. Ahora la app deja de mentirle y el grupo Finanzas entero desaparece para él. El día del epic se abre completo y de verdad. Detalle en la nota `rbac-a-medias-mapa-real`.
- **El aviso en la invitación de colaborador** ("admin también ve tus proveedores"). Deja de aplicar: con el Rolodex cerrado al dueño, no hay nada que advertir. Vuelve cuando llegue el despacho.

---

## 3. Nombre y superficies

- Se llama **Rolodex** (no "Mi directorio", no "Directorio").
- **Debe asomarse en el dashboard.** El dashboard v2 no está en producción (rama parada, `be336b4`, móvil sin rehacer). Por eso el Rolodex expone **una pieza chica y autocontenida** — proveedores más usados / los que traes cotizando — que cualquier dashboard puede colocar. No se amarra a esa rama.

---

## 4. Las cinco vistas

### Vista 1 — Rolodex (nivel cuenta)

Vive fuera de las bodas, en el menú principal. Tabla en escritorio, tarjetas en móvil.

- Búsqueda por nombre, ciudad o etiqueta. Filtros: categoría, ciudad, etiqueta.
- Columnas: proveedor · categoría · dónde · **gana / pierde** · por qué gana · por qué pierde · **quién lo trae** · rango de precio · **% que negocias** · tu calificación · última vez.
- Permite dar de alta un proveedor **sin tener boda** (el caso "lo conocí en una expo").

> El acomodo exacto de columnas se irá ajustando con planners reales. La lista de arriba es el inventario de lo que hay que poder mostrar, no el diseño final.

### Vista 2 — Expediente del proveedor

**El único lugar donde se edita la ficha global.** Por eso ninguna boda puede escribirle encima al catálogo.

- Zona "Este proveedor": contacto, cobertura, etiquetas, notas generales.
- Zona "Tu historia con él": una fila por boda — estatus, cotizó, contrató, reseña, quién lo eligió.
- Acciones: archivar, agregar a una boda.

### Vista 3 — Agregar proveedor a esta boda

Reemplaza el alta de hoy. Ver §7.

### Vista 4 — Proveedores de esta boda

Las tres vistas actuales (tarjetas, lista, kanban) se quedan. Dos cambios:

1. Chip **"de tu Rolodex · 3ª vez"** en la tarjeta.
2. El botón abre la Vista 3, no el formulario de hoy.

### Vista 5 — El proveedor dentro de la boda

Rediseño del `SupplierDetailModal`. Ver §8.

---

## 5. Campos de la ficha

**Obligatorios (3):** nombre · categoría · **un** contacto (WhatsApp **o** Instagram **o** correo).

**Derivados — nadie los teclea:** bodas donde se usó · gana/pierde · motivos · quién lo trae · rango de precio · % que se negocia · calificación promedio · última vez y en qué acabó.

**Opcionales, se completan en el expediente:** persona de contacto · teléfono adicional · correo · sitio web · Facebook · ciudad y estado · radio de servicio · **etiquetas libres** (nuevo) · notas generales.

Todos los opcionales salvo las etiquetas **ya existen en `suppliers`**. Solo les falta pantalla.

---

## 6. La cotización: solo el total

**Decisión:** un monto total. **Sin desglose por líneas, sin unidad de cobro.**

Razón: el desglose ya existe en el PDF que mandó el proveedor. Volverlo a teclear es trabajo que el planner no hacía antes de Anfiora. Anfiora vende **memoria**, no un cotizador.

**Los tres montos se muestran juntos y en este orden** — los tres ya existen en la base:

| Concepto | Dónde vive hoy |
|---|---|
| Presupuestado | `event_budgets.budget_amount` |
| Cotizado | `event_suppliers.quoted_amount` |
| Contratado | `event_suppliers.contract_amount` |

**Derivado gratis:** cotizado − contratado = cuánto se negoció. En el Rolodex: *"con este proveedor bajas 8% en promedio"* vs *"con este nunca baja"*.

---

## 7. Anti-duplicado (estilo Odoo)

**El campo de crear ES el campo de buscar.** No hay botón separado de "nuevo": escribes, ves coincidencias de tu Rolodex, y la última opción siempre es *"Crear «lo que escribiste»"*.

| Señal | Comportamiento |
|---|---|
| Nombre parecido | Aviso **suave**, no bloquea — dos floristas reales pueden llamarse igual |
| Teléfono o correo repetido | Aviso **fuerte**, con "usar la que ya tengo" preseleccionado |
| Fusionar duplicados | **No se construye.** Hay 0 duplicados y lo de arriba evita que nazcan |

**Nunca bloquear. Nunca fusionar automáticamente.**

El match por teléfono compara **normalizado E.164** con `lib/phone.ts` — "442 118 4420" y "+524421184420" son el mismo número.

### Paso 2, según lo elegido

- **Si es nuevo:** solo lo mínimo del proveedor (§5). Ciudad, correo, sitio y notas se completan después.
- **Siempre:** concepto del presupuesto (opcional) y cotización (opcional, si ya la trae). Entra como `nuevo`.

**Lo que cambia respecto a hoy:** el concepto del presupuesto deja de ser una decisión obligatoria al capturar, y sí se puede meter la cotización de una vez.

---

## 8. El modal por estado — que no abrume

**Principio:** el modal muestra lo que toca **ahora**. Lo que no aplica **no existe** — no está en gris ni bloqueado.

**Franja fija arriba (todos los estados):** nombre, categoría, ciudad, historia resumida ("la usaste 3 veces · 4.0 de 5"), botones de WhatsApp/Instagram y **"ver expediente"**. **Solo lectura** — corregir datos del proveedor se hace en el expediente.

**Pipeline con dos finales visibles:**

```
Nuevo → Cotizado → [ Contratado | Descartado ]
```

Descartado deja de ser un botón escondido: es un final del camino, al mismo nivel que Contratado. Se puede **regresar** de Descartado (pasa seguido: el proveedor baja el precio).

| Estado | Qué se muestra |
|---|---|
| **Nuevo** | Concepto del presupuesto · nota · botón "Ya me cotizó". Nada más |
| **Cotizado** | Tira de los tres montos con la diferencia marcada · cotización adjunta · nota. Pagos y reseña **no aparecen** |
| **Contratado** | Tira de montos · archivos · pagos con comprobante · nota |
| **Descartado** | Motivo · nota. Colapsado |

**Móvil:** la tira de montos se apila y el botón que avanza el trato queda al alcance del pulgar. Se dibuja y se aprueba el móvil **antes** de construir — el dashboard v2 se atoró exactamente ahí.

---

## 9. Reseñas: cada momento pregunta lo que sabe (Modelo B)

### El problema de hoy

`SupplierReviewModal` es **idéntico** al contratar y al descartar: estrellas, caritas, velocidad y comentario. Dos problemas:

1. **Estrellas y caritas (`mood`) son la misma pregunta.** `mood` sobra: no se puede promediar "Love" a través de seis bodas.
2. **Se dispara al firmar, no después de la boda.** El subtítulo lo confiesa: *"tu experiencia cotizando"*. **Cómo cumplió el día del evento no se pregunta nunca** — y es la única reseña que de verdad importa.

### El modelo nuevo

| Momento | Qué se pregunta | Qué NO |
|---|---|---|
| **Al descartar** | **Motivo:** precio · disponibilidad · al cliente no le gustó · nunca contestó · elegimos a otro · otro. + nota opcional | Sin estrellas — nunca trabajaste con él |
| **Al contratar** | **¿Quién lo eligió?** yo lo propuse · el cliente lo trajo · el venue lo pidió · me lo recomendaron<br>**¿Por qué se quedó?** precio · disponibilidad · al cliente le encantó · ya lo conocía · otro<br>+ nota opcional | Sin estrellas ni velocidad — todavía no las puedes contestar |
| **Después de la boda** | **Estrellas** · velocidad de respuesta · nota | — |

**Disparador de la tercera, sin cron ni correo:** al entrar a una boda cuya fecha ya pasó con proveedores contratados sin calificar, aparece un aviso ligero — *"esta boda ya pasó, ¿cómo te fue con tus 4 proveedores?"* — con estrellas de un toque, todos en una sola pantalla.

**Todo es saltable**, como hoy. Nunca se bloquea por pedir datos.

**`mood` se deja de escribir y se oculta.** No se borra la columna todavía.

### Por qué "¿quién lo eligió?" es la mejor pregunta del modelo

1. **Protege al planner.** El DJ que trajo la novia llegó tarde: queda escrito, y se escribió el día de la firma, no cuando ya hubo pleito.
2. **Da una métrica que nadie más tiene:** *"de los 40 proveedores que propuse, 32 se contrataron"*. Orgullo profesional y material de venta.
3. **Explica los datos raros:** un proveedor con 4 de 4 puede ser el que el venue siempre impone. Sin este campo parece un acierto propio.
4. **Es irrecuperable después.** La lentitud se recuerda; quién lo trajo, no.

---

## 10. Datos y seguridad

### Columnas nuevas (sin tablas nuevas)

`event_suppliers`:
- `discard_reason TEXT` — motivo del descarte
- `win_reason TEXT` — por qué se quedó
- `chosen_by TEXT` — quién lo eligió
- `reviewed_by UUID` — autor de la reseña
- `quote_file_path TEXT` — cotización aceptada

`suppliers`:
- `tags JSONB` — etiquetas libres
- `archived_at TIMESTAMPTZ` — archivar, nunca borrar con historia

`supplier_payments`:
- `receipt_file_path TEXT` — comprobante

Todos los valores de enum se declaran en `lib/types.ts` con su `_LABEL` correspondiente, siguiendo el patrón de `SUPPLIER_STATUS_LABELS`.

### Archivos: bucket privado, no el que hay

**Hallazgo:** ya existe el bucket `event-media` y el patrón de subida (`SectionForm.tsx`, `DressCodeEditor.tsx`), pero usan **`getPublicUrl`** — el bucket es **público, sin sesión, para siempre**. Perfecto para una foto de boda; inaceptable para un contrato con precios y datos del cliente.

**Decisión:** bucket **privado** nuevo + **signed URLs que caducan**. Se construye **una sola vez** y sirve para los dos casos: cotización aceptada (por `event_supplier`) y comprobante de pago (por `supplier_payment`). Con esto el chat pendiente de "comprobantes de pago" se cierra solo.

### RLS — verificado 3-sep-2026

Las doce políticas de las tres tablas son **del dueño y solo del dueño**; ninguna menciona colaboradores. El detalle y lo que eso rompe hoy en producción está en §2.

Consecuencia para el plan: **no hay que abrirle la puerta a nadie.** Lo que se hace es mover la condición que ya existe a una función, para que el día del despacho se cambie en un solo lugar:

```sql
-- suppliers
using ( public.can_access_catalog(user_id) )

-- event_suppliers y supplier_payments
using ( public.can_access_event_finance(event_id) )
```
Hoy las dos funciones devuelven lo mismo que la condición inline que reemplazan, así que el cambio es **de comportamiento cero**. Eso es justo lo que lo hace seguro de correr en producción.

---

## 11. Fuera de alcance (nombrado, no se construye)

- **Capa de personas** (varios contactos por proveedor: el que cotiza vs el capitán del día). Es el tercer objeto del modelo estándar y nos falta. Un contacto alcanza para el 90%; agregarlo después es aditivo.
- **Desglose por líneas** tipo factura (lo que hace Odoo).
- **IA que lee la cotización.** Factible hoy (ya hay llave de Anthropic y Haiku corriendo), pero el valor no está en extraer las líneas — está en **las condiciones de pago** ("50% de anticipo, resto 15 días antes"), que conecta con pagos programados. Riesgo: el día que la IA lee mal un monto y nadie revisa, se rompe el presupuesto y la culpa es de Anfiora. Requiere confirmación humana siempre.
- **Pagos programados** (hoy solo se registran pagos hechos). **Mejor candidato para el siguiente chat.**
- **Comparativa / terna formal** para mandar al cliente.
- **Fusionar duplicados.**
- **Workspaces, asientos y cobro por usuario extra.**

---

## 12. Apartado para otros chats (hallazgos, no alcance de este spec)

1. **La liga presupuesto ↔ proveedor solo escribe un lado.** Son dos columnas (`event_budgets.event_supplier_id` y `event_suppliers.event_budget_id`) y cada pantalla escribe la suya. Si se liga desde Proveedores, el Presupuesto no ve nada contratado ni pagado (`presupuesto/page.tsx:155`); si se liga desde Presupuesto, la tarjeta del proveedor se queda sin partida ni semáforo (`SupplierCard.tsx:40`).
2. **Nada impide ligas duplicadas** — dos partidas al mismo proveedor contarían el mismo contrato dos veces.
3. **Bug del import de presupuesto** (chat propio, ya diagnosticado).

---

## 13. Decisiones de precio que este spec NO toma

El modelo de $990 por workspace + $290 por usuario extra cambia el **eje** del medidor del paywall, que hoy cobra por eventos (free=1 · solo=10 · studio=25 · agency=60). Esa es la decisión de precios completa y tiene su propio chat, con un benchmark ya preparado. Este spec solo se asegura de **no cerrarle la puerta**.
