# Dashboard v2 — banner único y tablero acomodable (addendum)

**Fecha:** 2 de agosto de 2026
**Modifica:** `2026-08-01-dashboard-v2-design.md`, sección de anatomía del contexto evento
**Estado:** diseño cerrado, pendiente de plan

Este addendum reemplaza **una sola sección** del spec original: la anatomía de la pantalla de evento. Las seis decisiones del spec del 1-ago siguen vigentes tal cual — el selector maestro, la cartera como fila de la lista, el hero claro, el orden de tarjetas por `users.role`, cero cambios de ruta y nada de fechas comprometidas de pago.

## Por qué cambia

El spec original fijaba la pantalla del evento en una anatomía rígida: hero, cuatro tarjetas de KPI sueltas, feed, dos columnas. En la práctica eso son cinco piezas compitiendo por la parte de arriba, y obliga a todos los planners a vigilar lo mismo en el mismo orden. Cada evento tiene su propia organización: el que trae la boda con presupuesto apretado quiere el dinero grande, el que trae el congreso de 600 personas quiere los invitados.

## Las ocho decisiones

**1. El tablero vive en el contexto evento del dashboard.** No es una portada nueva dentro del evento. `/events/[id]` y su nav no se tocan.

**2. El acomodo es del evento, no del planner. Lo define el owner; el equipo lo ve.** Se guarda con el evento, así que el asistente con rol editor abre la boda de Ana y Rodrigo y ve el acomodo que dejó el owner — pero no puede cambiarlo.

Esto no es una preferencia de producto, es lo que la base permite: las políticas de `INSERT` y `UPDATE` de `event_settings` son `is_event_owner(event_id)`. Un colaborador solo tiene `SELECT` vía `is_event_member`. Si dejáramos el botón "Personalizar" visible para un editor, el guardado **fallaría en silencio** — un `UPDATE` filtrado por RLS no devuelve error, simplemente no escribe filas. Por eso el botón se esconde para quien no es owner. Verificado contra el schema el 2-ago-2026.

**3. El hero es un solo banner.** No cuatro tarjetas flotando: una sola pieza, con la fecha y la cuenta regresiva arriba y cuatro cifras adentro divididas por líneas verticales.

```
┌────────────────────────────────────────────────────────┐
│ ● Ana & Rodrigo                    14 nov · en 104 días│
│   Hacienda San Gabriel                    [Abrir] [···]│
├──────────────┬──────────────┬──────────────┬───────────┤
│ INVITADOS    │ PRESUPUESTO  │ PROVEEDORES  │ TAREAS    │
│ 148 de 240   │ $1.2M        │ 8 de 11      │ 3         │
│ 62% confirm. │ pagado $845k │ contratados  │ vencidas  │
│ ████████░░░░ │ ██████░░░░░░ │ ██████░░░░░░ │ ███░░░░░░ │
│ 148 · 74 · 18│ de $1.4M est.│ 2 cotizados  │ 5 esta sem│
└──────────────┴──────────────┴──────────────┴───────────┘
```

Las cuatro cifras son **invitados por estatus** (confirmados · pendientes · declinados), **presupuesto contra pagado**, **proveedores contratados** y **tareas**. El banner es fijo: no se acomoda ni se oculta.

**4. Debajo del banner, un tablero de cajas acomodables.** Pendientes, Requiere tu atención, Actividad reciente, Playlist, Mesa de regalos, Mesas, Equipo y las demás features dejan de estar en posiciones fijas.

**5. El tamaño cae en cuadrícula.** Se arrastra la esquina y la caja encaja en la casilla más cercana. Nada de ajuste al pixel.

**6. El acomodo inicial se arma solo con las features activas del evento.** Sin playlist encendida, no aparece la caja de playlist. El planner recibe un tablero usable de entrada, no un lienzo en blanco.

**7. Se acomoda en un modo aparte.** Un botón "Personalizar" entra al modo; fuera de él las cajas no se mueven ni se redimensionan, y un clic sobre una tarea la abre en vez de correr el tablero. En ese modo cada caja trae una X para quitarla, y un menú "Agregar caja" lista las que se hayan quitado para devolverlas.

**8. En el teléfono no se acomoda.** La cuadrícula de cuatro columnas no existe en 390px: las cajas se apilan una debajo de otra respetando el orden que quedó en escritorio. Personalizar solo aparece en escritorio.

## Qué sobrevive del código ya escrito

`lib/dashboard/` queda **intacto**: `types.ts`, `metrics.ts`, `salud.ts`, `urgencias.ts` y `load.ts`, con sus 40 tests. El banner y las cajas consumen exactamente los mismos números que consumían el hero y las tarjetas. También sobreviven `EventSelector.tsx`, `ContextoCartera.tsx` y `FeedAtencion.tsx` — este último pasa de sección fija a contenido de una caja.

Lo que se rehace es `ContextoEvento.tsx`: su hero se vuelve el banner, y sus tarjetas, feed y dos columnas se vuelven cajas sobre la cuadrícula.

## Persistencia

Schema verificado el 2-ago-2026. `event_settings` no tiene ninguna columna donde quepa el acomodo, así que se agrega una:

```sql
alter table public.event_settings
  add column dashboard_layout jsonb;
```

Nullable y sin default, a propósito: **`NULL` significa "nunca lo personalizaron"** y la app deriva el acomodo inicial al vuelo. Así no hay que migrar las 51 filas existentes ni inventarle un tablero a eventos que quizá nunca lo abran.

La forma del JSON:

```json
{
  "v": 1,
  "cajas": [
    { "id": "atencion", "x": 0, "y": 0, "w": 2, "h": 2 },
    { "id": "tareas",   "x": 2, "y": 0, "w": 2, "h": 2 },
    { "id": "playlist", "x": 0, "y": 2, "w": 1, "h": 1 }
  ],
  "ocultas": ["regalos"]
}
```

Cuatro columnas de rejilla; `x`, `y`, `w` y `h` van en casillas, nunca en pixeles. El `v` permite cambiar la forma más adelante sin romper lo ya guardado.

`ocultas` es explícito a propósito: una caja que no aparece **ni** en `cajas` **ni** en `ocultas` es nueva desde la última vez que se guardó, y se agrega sola. Sin esa distinción, cada feature que lancemos después nacería invisible para todo el que ya hubiera acomodado su tablero.

Se escribe con el mismo `upsert` que ya usa la app (`onConflict: 'event_id'`), que funciona porque la tabla tiene `UNIQUE (event_id)`.

**Las herramientas reales** son siete: `album`, `comida`, `invitacion`, `mesas`, `playlist`, `regalos`, `vestimenta`. Solo 16 de 51 filas tienen `enabled_features`, y los objetos guardados vienen incompletos — **llave ausente no significa apagada**. El acomodo inicial tiene que pasar por `resolveFeatures(event_type, enabled_features)` de `lib/event-access-context.tsx`, nunca leer el JSON crudo.

## Abierto antes de escribir el plan

- **La librería de la cuadrícula.** Si se resuelve con CSS grid y arrastre propio o con una dependencia. Instalar paquete requiere autorización.
