# Post-confirmacion de la invitacion

**Fecha:** 2026-08-08
**Estado:** disenado, pendiente de plan
**Contexto previo:** [[invitacion-pendientes-ux-ui]] — ultimo pendiente vivo de la tanda triada el 7-ago.

## El problema

Cuando un invitado termina de responder, la invitacion no cierra el ciclo.

Auditoria de los cuatro finales que existen hoy en `app/components/invitacion/sections/RsvpSection.tsx`:

| Camino | Que ve el invitado al terminar | Hueco |
|---|---|---|
| Con precio, aun debe | `PagoPendiente`: cuenta de cobro, desglose, plazo y WhatsApp | ninguno |
| Con precio, ya pago | `PuertaExito`: "Ya estas dentro" | sin contacto |
| Puerta publica, gratis | `PuertaExito`: "Ya estas dentro" | sin contacto |
| Link personal, gratis | "Gracias por confirmar" y el formulario sigue vivo | el mas grave |

El ultimo es el que se nota. Tras enviar, los botones Si/No y el campo de alergias siguen habilitados —`disabled` solo depende de la fecha limite—, asi que el invitado puede seguir editando para siempre. Y como `submitted` es estado local, al recargar reaparece el formulario como si nunca hubiera confirmado.

Ese campo de alergias que nunca cierra es el "agregar mas" de la nota original.

## Decisiones

Las seis cerradas en este chat. No re-abrir sin motivo nuevo.

1. **Al volver, resumen cerrado con salida.** El invitado que ya respondio ve su respuesta como resumen —quien va, quien no, sus alergias— mas un boton "Cambiar mi respuesta" que reabre el formulario. Se descarto dejarlo siempre editable (deja el campo abierto por accidente) y tambien cerrarlo sin salida (le carga al planner cada correccion).

2. **El contacto es un dato del evento, no de la cuenta.** Seccion nueva "Datos del planner" en Configuracion: nombre, numero de atencion y correo. Se descarto reusar `users.phone` tal cual porque es el celular personal con el que el planner abrio su cuenta, no un contacto pensado para invitados.

3. **Vive en Configuracion, no en el panel de Acceso.** El panel de Acceso ya guarda a dos velocidades en la misma pantalla (privada/publica en vivo, cupo y precio en el borrador). Configuracion escribe en vivo y sin ambiguedad.

4. **Una sola fuente de verdad para el contacto, con respaldo.** El numero de atencion reemplaza a `users.phone` en toda la invitacion, incluido el boton "Ya pague" de eventos con precio. Si esta vacio: en eventos con precio cae al telefono de la cuenta (no romper lo que hoy funciona); en eventos gratis no se muestra la tarjeta.

5. **El resumen aparece solo cuando todos respondieron.** Si el planner agrega un acompanante despues, el formulario se reabre solo, con los ya respondidos marcados. Se descarto dejar el resumen fijo: el pendiente pasaria desapercibido.

6. **`/perfil` deja de pisar el nombre.** Solo rellena los eventos que lo tengan vacio.

## Alcance

### Datos del planner (Configuracion)

Seccion nueva en `app/events/[id]/configuracion/page.tsx`, despues de "Datos generales". Tres campos, los tres opcionales:

- **Nombre** — `events.planner_name`, columna que ya existe. Hoy solo se llena desde `/perfil` y alimenta la variable `{planner}` de las plantillas de WhatsApp (`app/events/[id]/page.tsx:1157`), o sea que ya es el nombre con el que los invitados conocen al planner. Aqui se vuelve editable por evento.
- **Numero de atencion** — `events.planner_phone`, columna nueva. Captura con `app/components/ui/PhoneInput.tsx`, guardado en E.164 via `lib/phone.ts`. Nunca un campo de texto libre: es la leccion de [[bug-puerta-telefono-solo-mexico]].
- **Correo de atencion** — `events.planner_email`, columna nueva.

Los tres son configuracion del evento, asi que entran al trigger `guard_event_config` (ver Base de datos). Un colaborador editor no los cambia.

### La regla de estado

Vive en `lib/` como funcion pura y decide entre tres salidas. Entra: el estado del invitado y de cada acompanante; sale: `formulario`, `resumen` o `resumen_cerrado`.

Un integrante cuenta como respondido solo si su `rsvp_status` es `confirmed` o `declined`. Los otros cuatro valores de `RsvpStatus` (`pending`, `mensaje_enviado`, `respondio`, `accion_necesaria`) cuentan como pendiente: son estados del seguimiento del planner, no una respuesta del invitado.

| Situacion | Salida |
|---|---|
| Alguien sin responder | `formulario` — los ya respondidos se ven marcados |
| Todos respondieron | `resumen` — con "Cambiar mi respuesta" |
| Todos respondieron y ya paso la fecha limite | `resumen_cerrado` — sin boton de cambiar |

El estado ya es durable: `guests.rsvp_status` y el de cada `party_member` los devuelve `app/api/invitacion/[token]/route.ts` y `buildRows` ya los lee. No hace falta guardar nada nuevo para saber si confirmo.

Eventos con precio no pasan por esta regla: ahi pagar es confirmar, y `PagoPendiente` / `PuertaExito` siguen intactos.

### La tarjeta de contacto

Una sola pieza reutilizada en los cuatro finales: resumen, "ya estas dentro" del link personal, "ya estas dentro" de la puerta publica, y dentro de `PagoPendiente`.

Que muestra: el nombre para que el boton no sea anonimo ("Escribele a Ana"), WhatsApp si hay numero, correo si hay correo. Si no hay ninguno de los dos, la tarjeta no se pinta.

La resolucion del contacto —cual numero gana, cuando hay respaldo, cuando no se muestra nada— es logica pura y vive junto a la regla de estado.

### Estructura

`RsvpSection.tsx` son 355 lineas con cinco caminos adentro. Meterle el resumen y la tarjeta inline lo empeora, asi que se extraen dos piezas siguiendo el mismo patron que ya siguio `PagoPendiente.tsx`:

- `app/components/invitacion/ResumenConfirmado.tsx` — el resumen y el boton de cambiar
- `app/components/invitacion/ContactoPlanner.tsx` — la tarjeta de contacto

`RsvpSection` solo decide cual mostrar. No se refactoran los caminos de pago.

## Base de datos

**Verificar antes de proponer el ALTER** (solo lectura):

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'events'
  and column_name in ('planner_name', 'planner_phone', 'planner_email');
```

Dos columnas nuevas en `events`, junto a `planner_name`: `planner_phone` y `planner_email`, ambas `text null`.

Despues del ALTER hay que **recrear el trigger `guard_events_config` agregando los dos nombres nuevos a su lista de argumentos**. La definicion vigente esta en `docs/superpowers/plans/sql/2026-08-04-rls-colaborador-editor.sql`. Sin eso, un colaborador editor podria cambiar el contacto del evento.

Orden obligatorio, por la regla de sincronia Supabase-Vercel: el codigo que lee las columnas se pushea primero, el ALTER va despues.

## Riesgos

- **El UPDATE mudo.** Guardar los datos del planner es un UPDATE sobre `events` filtrado por RLS. Si el usuario no pasa la policy, Supabase devuelve cero filas **sin error** y la pantalla dice que guardo. Hay que contar filas con `.select()`, como en `lib/invite/persistencia.ts`. El trigger si lanza excepcion 42501 para un editor, pero la policy no: son dos fallos distintos y hay que cubrir los dos.
- **`/perfil` pisando el nombre.** Hoy `app/perfil/page.tsx:214` hace un update incondicional a todos los eventos del usuario. Al filtrarlo a los vacios, el filtro tiene que cubrir `null` **y** cadena vacia, no solo `null`.
- **Exposicion del contacto.** En la puerta publica la invitacion la ve cualquiera con el link. Por eso el contacto es opt-in: si el planner no llena el campo, en eventos gratis no se muestra nada.

## Que se prueba

Vitest sobre la logica pura: la regla de estado (incluido el acompanante agregado despues, y cada uno de los seis valores de `RsvpStatus`) y la resolucion del contacto (con numero, sin numero y con precio, sin numero y gratis).

Lo visual y el guardado se verifican a mano en local, luego preview, luego main.

## Fuera de alcance

Moneda hardcodeada en el panel de Acceso, aprobacion de solicitudes (`CANDADO_APROBACION_LISTO`), y el epic de edicion completa de la invitacion. Los tres tienen chat propio.
