# Reviews de proveedores: dos scores, cuatro momentos

**Fecha:** 6 de septiembre de 2026
**Estado:** aprobado por Diego (mockups aprobados sin cambios)
**Reemplaza:** el modelo de reseña única en `event_suppliers` (estrellas + mood + velocidad)

## Mockups aprobados

- Las tres reviews del planner: https://claude.ai/code/artifact/13dc8e43-d4a6-46b4-8af1-dc393d68d89b
- La opinión de los novios: https://claude.ai/code/artifact/d4e2a7c8-3ed6-469c-bf0d-9a08718aa78c

---

## 1. Principio de diseño

Existen **5 ejes** de calificación, siempre los mismos, siempre en este orden:

`precio_valor`, `calidad`, `comunicacion`, `servicio_trato`, `manejo_imprevistos`

No todos los ejes aplican a todos los momentos, porque no todos son observables
en todos los momentos:

| Eje | Al contratar | Al descartar | Post-evento (planner) | Post-evento (novios) |
|---|---|---|---|---|
| `precio_valor` | sí | sí | sí | sí |
| `calidad` | sí | sí | sí | sí |
| `comunicacion` | sí | sí | sí | sí |
| `servicio_trato` | no | no | sí | sí |
| `manejo_imprevistos` | no | no | sí | sí |

Esto genera **tres scores separados que nunca se promedian entre sí**:

- `score_propuesta` — de las reviews de contratación y descarte. Mide qué tan
  buena es su propuesta comercial. Existe aunque nunca lo hayas contratado.
- `score_desempeno` — de la review post-evento **del planner**. Mide cómo ejecuta.
- `score_clientes` — de las reviews post-evento **de los clientes finales**.
  Mide la cara que le da al cliente.

Un descarte por precio no debe bajar el `score_desempeno`. Un cliente encantado
no debe tapar que el proveedor le dio un infierno operativo al planner. Si la
implementación permite que eso pase, está mal.

**El valor de tener dos observadores no es un promedio mejor: es ver dónde no
coinciden.** Un proveedor con 3.4 tuyo y 4.8 de clientes da una cara excelente al
cliente y una pésima al planner. Ese dato es el producto.

---

## 2. Escala 1–5: anclas literales

La escala se renderiza como **5 botones numerados**, no como estrellas. Al
seleccionar un valor se muestra la etiqueta correspondiente al lado. Las
etiquetas son distintas por eje y por contexto.

### 2.1 Contexto `propuesta` (reviews al contratar y al descartar)

**`precio_valor`** — qué tan razonable fue lo que cotizó frente a lo que ofrecía

| Valor | Etiqueta |
|---|---|
| 1 | Fuera de toda proporción |
| 2 | Muy por encima del mercado |
| 3 | En precio de mercado |
| 4 | Caro, pero se justifica |
| 5 | Ofrece más de lo que cobra |

**`calidad`** — nivel del portafolio y de la propuesta presentada

| Valor | Etiqueta |
|---|---|
| 1 | Portafolio pobre o inconsistente |
| 2 | Cumple lo mínimo, nada memorable |
| 3 | Sólido, sin diferenciador |
| 4 | Trabajo notable, se nota el oficio |
| 5 | Referente en su categoría |

**`comunicacion`** — durante la cotización

| Valor | Etiqueta |
|---|---|
| 1 | Nunca respondió |
| 2 | Tuve que perseguirlo |
| 3 | Respondía lento o incompleto |
| 4 | Contestaba el mismo día |
| 5 | Proactivo, se adelantaba a mis dudas |

### 2.2 Contexto `desempeno` — voz del planner

**`precio_valor`**

| Valor | Etiqueta |
|---|---|
| 1 | Cobró de más y entregó de menos |
| 2 | No valió lo que cobró |
| 3 | Justo lo esperado por el precio |
| 4 | Valió lo que cobró |
| 5 | Entregó más de lo que cobró |

**`calidad`**

| Valor | Etiqueta |
|---|---|
| 1 | Muy por debajo de lo prometido |
| 2 | Entregó menos de lo prometido |
| 3 | Entregó lo prometido, sin más |
| 4 | Entregó mejor de lo prometido |
| 5 | Superó lo prometido de forma notoria |

**`comunicacion`**

| Valor | Etiqueta |
|---|---|
| 1 | Imposible localizarlo |
| 2 | Tuve que perseguirlo todo el proceso |
| 3 | Respondía, pero yo iniciaba siempre |
| 4 | Accesible y claro todo el proceso |
| 5 | Proactivo, avisaba antes de que preguntara |

**`servicio_trato`**

| Valor | Etiqueta |
|---|---|
| 1 | Trató mal al cliente o al equipo |
| 2 | Correcto pero frío |
| 3 | Profesional, sin más |
| 4 | Cálido, el cliente lo notó |
| 5 | El cliente lo mencionó sin que le preguntara |

**`manejo_imprevistos`**

| Valor | Etiqueta |
|---|---|
| 1 | Empeoró el problema o lo negó |
| 2 | Se paralizó, lo resolví yo |
| 3 | Resolvió a medias o con ayuda |
| 4 | Resolvió solo, sin alarmar a nadie |
| 5 | Resolvió antes de que nadie lo notara |

Este eje además tiene una opción `No aplicó` al lado de los 5 botones. Si se
elige, se guarda `null` y el eje se excluye del promedio. **No hubo imprevistos
no es lo mismo que los manejó regular.**

### 2.3 Contexto `desempeno_cliente` — voz de los novios (anclas espejo)

Mismo eje, mismo 1–5, misma posición. **Solo cambia el sujeto de la frase.**

`precio_valor` y `calidad` quedan **textualmente idénticas** a la versión del
planner: ya estaban escritas sin sujeto. No se duplican en código si el
constructor de anclas puede caer al texto de `desempeno` cuando no hay espejo.

**`comunicacion`**

| Valor | Etiqueta |
|---|---|
| 1 | Nunca pudimos localizarlo |
| 2 | Tuvimos que perseguirlo todo el proceso |
| 3 | Respondía, pero siempre empezábamos nosotros |
| 4 | Accesible y claro todo el proceso |
| 5 | Proactivo, nos avisaba antes de preguntar |

**`servicio_trato`**

| Valor | Etiqueta |
|---|---|
| 1 | Nos trató mal a nosotros o a nuestros invitados |
| 2 | Correcto pero frío |
| 3 | Profesional, sin más |
| 4 | Cálido, se notó |
| 5 | Lo comentamos entre nosotros sin que nadie preguntara |

**`manejo_imprevistos`**

| Valor | Etiqueta |
|---|---|
| 1 | Empeoró el problema o lo negó |
| 2 | Se paralizó, lo resolvieron otros |
| 3 | Resolvió a medias o con ayuda |
| 4 | Resolvió solo, sin alarmar a nadie |
| 5 | Lo resolvió sin que nos enteráramos |

El botón de `No aplicó` en este contexto dice **"No hubo imprevistos"**.

---

## 3. Las cuatro reviews

### 3.1 Review al contratar

Se dispara al mover un proveedor a estado `contratado` en un evento.

**Pregunta 1 — Califica la propuesta.** Ejes `precio_valor`, `calidad`,
`comunicacion`. Contexto `propuesta`. Obligatoria.

**Pregunta 2 — ¿Por qué elegimos a este proveedor?** Multi-select, **máximo 2**,
mínimo 1. Obligatoria.

| Valor | Etiqueta |
|---|---|
| `precio` | Mejor precio |
| `relacion_calidad_precio` | Mejor relación calidad/precio |
| `calidad` | Mejor calidad o portafolio |
| `disponibilidad` | Disponibilidad en la fecha |
| `comunicacion` | Mejor comunicación |
| `recomendacion` | Recomendación o relación previa |
| `estilo` | Encajaba con el estilo del evento |
| `decision_cliente` | Decisión del cliente |

Al llegar a 2 selecciones los chips restantes se deshabilitan visualmente
(**no desaparecen**) y se muestra el contador `2 de 2`. Para deseleccionar se
vuelve a tocar un chip activo.

**Pregunta 3 — Comentarios adicionales.** Textarea, opcional, máximo 500.
Placeholder: `Cualquier cosa que valga la pena recordar de este proveedor`

### 3.2 Review al descartar

Se dispara al mover un proveedor a estado `descartado`. Debe poder contestarse
en menos de 20 segundos.

**Pregunta 1 — ¿Por qué lo descartamos?** Single-select, obligatoria.

| Valor | Etiqueta |
|---|---|
| `precio` | Precio fuera de presupuesto |
| `disponibilidad` | No disponible en la fecha |
| `comunicacion` | Comunicación lenta o poco clara |
| `calidad` | Propuesta o calidad insuficiente |
| `estilo` | No encajaba con el estilo del evento |
| `cliente_eligio_otro` | El cliente eligió a otro |
| `no_respondio` | Se retiró o no respondió |

**Pregunta 2 — Califica la propuesta.** Ejes de `propuesta`. **Opcional**, con
un enlace visible `No tengo opinión` que apaga el bloque completo y guarda
`null` en los tres ejes.

Esto es crítico: si se obliga a calificar a quien se descartó por fecha, el
planner pone números al azar y **contamina el `score_propuesta`**.

**Pregunta 3 — Comentarios adicionales.** Opcional, máximo 500.
Placeholder: `Por qué no funcionó, o qué tendría que cambiar para considerarlo`

### 3.3 Review post-evento del planner

Se dispara **4 días después** de la fecha del evento, no al día siguiente.

**Pregunta 1 — Califica el desempeño.** Los 5 ejes, contexto `desempeno`.
Obligatoria salvo `manejo_imprevistos`, que acepta `No aplicó`.

Dentro del mismo bloque, debajo de los ejes, un flag binario en una fila con
fondo `warning`. **No cuenta como pregunta:**

> ¿Hubo cobros extra no acordados? → `Sí` / `No`

Si es `Sí`, se despliega un campo numérico opcional para el monto.

**Pregunta 2 — ¿Lo volverías a contratar?** Escala 1–5:

| Valor | Etiqueta |
|---|---|
| 1 | No, rotundamente |
| 2 | Solo si no hay otra opción |
| 3 | Sí, pero solo para cierto tipo de evento |
| 4 | Sí, sin reservas |
| 5 | Definitivamente sí, es mi primera opción |

Un `1` levanta la bandera `vetado` en el proveedor. **No es un score bajo, es una
exclusión:** deja de aparecer en sugerencias hasta que alguien lo revierta
manualmente.

**Pregunta 3 — Comentarios adicionales.** Opcional, máximo 500.
Placeholder: `Lo que le dirías a alguien de tu equipo que lo va a coordinar`

### 3.4 Review post-evento de los clientes finales

Es **el mismo cuestionario de 3.3**, repetido por proveedor, en una superficie
pública que el planner envía al terminar la boda. No es una versión recortada.

Diferencias con 3.3, y son las únicas:

1. Las anclas usan el contexto `desempeno_cliente` (§2.3).
2. La pregunta 2 se llama **"¿Lo recomendarían?"** y su ancla 5 es
   `Definitivamente sí, sería nuestra primera opción`.
3. El flag dice **"¿Les cobró algo extra que no estaba acordado?"**.
4. El placeholder de comentarios es `Opcional`.
5. **Un `1` en la recomendación NO veta al proveedor.** Levanta bandera para que
   el planner lo revise. El veto es una facultad del planner, no del cliente: un
   novio molesto por algo ajeno al proveedor borraría a alguien bueno del
   catálogo del despacho.

---

## 4. La superficie pública

### 4.1 El planner elige a quiénes califican

Antes de enviar, el planner ve la lista de proveedores **contratados** del
evento, todos palomeados por defecto, y desmarca a los que el cliente nunca vio
(rentas, planta de luz, seguro). El pie muestra cuántos van y el tiempo estimado.

El planner es el único que sabe con quién tuvieron cara. Un proveedor que los
novios no reconocen es donde se abandona la lista.

### 4.2 El formulario

Link público con token, sin login — mismo patrón que la invitación y la playlist
pública. **Diseñado para teléfono**, que es donde se abre.

**Un proveedor por pantalla**, con barra de avance arriba (`Proveedor 2 de 4`).
Nunca se ve la lista completa de golpe: eso es lo que espanta.

**Se guarda al pasar al siguiente.** Si cierran en el tercero, el planner tiene
tres reviews. No hay envío final que se pueda perder.

**Se puede corregir mientras el link siga vivo.** El `upsert` es por
(proveedor, evento, tipo, autor).

---

## 5. Modelo de datos

Una sola tabla. El score histórico debe ser un `avg()` con un `where`, no tres
queries y un `union`.

### 5.1 Adaptación a Anfiora

La spec original venía con `workspace_id` y `vendor_id`. **Anfiora no tiene
workspaces** — se descartaron a propósito — y el proveedor de un evento vive en
`event_suppliers`. Las llaves reales:

| Spec original | En Anfiora |
|---|---|
| `workspace_id` | `user_id` (dueño de la cuenta, = `events.user_id`) |
| `vendor_id` | `supplier_id` (catálogo global del planner) |
| `event_id` | `event_id` |
| — | `event_supplier_id` (la ficha del proveedor en ese evento) |

Se guardan `supplier_id` **y** `event_supplier_id`: el primero es el eje del
Rolodex (el score histórico cruza eventos), el segundo ancla la review a la
ficha concreta.

### 5.2 Esquema

```sql
create type review_type as enum ('contratacion', 'descarte', 'post_evento');
create type review_autor as enum ('planner', 'cliente');

create table supplier_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  event_supplier_id uuid not null references event_suppliers(id) on delete cascade,

  review_type review_type not null,
  autor review_autor not null default 'planner',

  precio_valor smallint check (precio_valor between 1 and 5),
  calidad smallint check (calidad between 1 and 5),
  comunicacion smallint check (comunicacion between 1 and 5),
  servicio_trato smallint check (servicio_trato between 1 and 5),
  manejo_imprevistos smallint check (manejo_imprevistos between 1 and 5),

  razones_seleccion text[],
  motivo_descarte text,
  recontratacion smallint check (recontratacion between 1 and 5),
  cobros_extra boolean,
  monto_cobros_extra numeric,

  comentarios text check (char_length(comentarios) <= 500),

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_supplier_id, review_type, autor)
);
```

Todos los ejes son nullable a propósito: cada tipo de review llena solo los suyos.

`created_by` es nullable porque la review del cliente no tiene sesión. La llave
única incluye `autor`, así que planner y cliente conviven sin pisarse.

**RLS con `user_id`**, igual que el resto de las tablas. La escritura del cliente
final entra por la ruta pública validando el token del evento, no por sesión.

### 5.3 Validación en la capa de aplicación

- `contratacion` → requiere los 3 ejes de propuesta y `razones_seleccion` con 1
  o 2 elementos. `motivo_descarte` y `recontratacion` null. `autor = 'planner'`.
- `descarte` → requiere `motivo_descarte`. Los ejes pueden ser null (los tres o
  ninguno, **nunca parcial**). `razones_seleccion` y `recontratacion` null.
  `autor = 'planner'`.
- `post_evento` → requiere los 5 ejes (salvo `manejo_imprevistos`, que puede ser
  null), `recontratacion` y `cobros_extra`. `motivo_descarte` y
  `razones_seleccion` null.

### 5.4 Los tres scores

```
score_propuesta  = avg de los 3 ejes  where review_type in ('contratacion','descarte')
score_desempeno  = avg de los 5 ejes  where review_type = 'post_evento' and autor = 'planner'
score_clientes   = avg de los 5 ejes  where review_type = 'post_evento' and autor = 'cliente'
```

Agrupados por `supplier_id` para el histórico del Rolodex, por
`event_supplier_id` para la ficha de un evento. `manejo_imprevistos` null sale
del promedio por definición de `avg()`.

### 5.5 Qué pasa con lo que ya existe

- `event_suppliers.discard_reason` y `win_reason` se crearon esta mañana y esta
  spec las absorbe. **Se borran**: nadie las lee todavía.
- `event_suppliers.rating`, `mood`, `response_speed`, `review_text` tienen datos
  en producción. **Medido el 6-sep:** 7 filas en total. 4 son de Diego y se
  descartan por instrucción suya. **3 son de una planner real**
  (`bodasplanner@hotmail.com`, Boda Fernanda & César, capturadas el 1 y 2 de
  septiembre) y **sí se migran**.

  **Estas 3 filas NO son reviews de desempeño.** El modal viejo se dispara al
  mover a estado final y su subtítulo dice *"Tu experiencia cotizando con X"*:
  lo que se calificó fue la propuesta. Los tres proveedores están en
  `contratado`. Migran como `review_type = 'contratacion'`, `autor = 'planner'`.

  Mapeo:

  | Columna vieja | Destino | Regla |
  |---|---|---|
  | `response_speed` | `comunicacion` | `lentisimo`→2, `normal`→3, `bueno`→4, `rapidos`→5. Las anclas de comunicación en contexto propuesta son literalmente velocidad de respuesta, así que el mapeo es 1 a 1. |
  | `rating` | `comentarios` | Como texto, no como eje: era una calificación global y meterla en un eje le inventa precisión. |
  | `mood` | `comentarios` | Igual. `love`→"trato excelente", `normal`→"trato normal", `no`→"mal trato". |
  | `review_text` | `comentarios` | Se antepone al texto derivado si existe. |
  | resto de ejes | `null` | No hay dato de origen. `avg()` los ignora. |

  `razones_seleccion` queda vacío: esa pregunta no existía al capturar. La
  validación de §5.3 aplica a capturas nuevas, no a filas históricas.

  Las 4 filas de Diego no se migran. Después de la migración se borran
  `rating`, `mood`, `response_speed` y `review_text` de `event_suppliers`.
- El disparo a 4 días se cuelga del cron de recordatorios que ya corre cada 15
  minutos. No hace falta motor nuevo.

---

## 6. Reglas de UI

- Las escalas son **5 botones numerados**, no estrellas. Las estrellas producen
  un mar de cincos.
- La etiqueta del valor seleccionado se muestra al lado de los botones, 12px,
  color secundario.
- Los cards comparten layout: header con proveedor + evento + badge de estado,
  las 3 preguntas separadas por hairline, guardar abajo a la derecha.
- Badge de estado por rol semántico: `success` contratado, `danger` descartado,
  `pro` evento completado.
- Sentence case en todo. Sin emoji.
- Guardado optimista: la review se cierra al guardar, sin toast de éxito.
- En el formulario público, los 5 botones ocupan el ancho completo en móvil.

---

## 7. Qué NO implementar

Descartado a propósito:

- **NPS 0–10** de "¿lo recomendarías a otro planner?" — mide lo mismo que
  `recontratacion`.
- **"¿Qué le faltó para ganar?"** en el descarte — es `motivo_descarte` con otro
  nombre.
- **Campos separados** de "qué hizo bien" y "qué hizo mal" — nadie llena tres
  textareas después de una boda. Uno solo.
- **Un score general** promediando propuesta, desempeño y clientes. Son tres
  números distintos y se muestran distintos.
- **`chosen_by`** ("¿lo propusiste tú o lo trajo el cliente?") — apartado, no
  muerto. Se suma según la demanda.

---

## 8. Fuera de alcance de esta spec

- El expediente del proveedor a nivel cuenta (`/rolodex/[id]`) y el directorio
  `/rolodex`. Los scores de aquí son su materia prima.
- La pieza del Rolodex en el dashboard.
- Recordatorio automático a los novios si no contestan.
