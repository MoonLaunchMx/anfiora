# Recordatorios del timeline: zona horaria y selector

Fecha: 2026-08-03
Estado: aprobado en sesión
Rama: `fix/recordatorios-zona-horaria`

## El problema

El 3 de agosto se encendió por primera vez el cron de recordatorios (`/api/cron/reminders`) y
se verificó el circuito completo en producción: reclamo, clasificación, push y entrega al
dispositivo. Al probarlo aparecieron tres defectos en la captura del recordatorio, todos con la
misma raíz.

### Evidencia

Una tarea creada a las 11:04 hora de México, con recordatorio pedido para las 11:06, quedó
guardada así:

```json
{ "reminder_date": "2026-08-03T11:06:00+00:00" }
```

`11:06 UTC` son las `05:06` en México: seis horas en el pasado. Debió guardarse `17:06+00:00`.

### Causa raíz

`computeReminderDate` (en `app/events/[id]/timeline/TaskModal.tsx`) construye un `Date` en la
zona del navegador y luego lo pasa a texto a mano con `getFullYear()` / `getHours()`,
produciendo `"2026-08-03T11:06:00"` — **sin zona**. La columna `reminder_date` es `timestamptz`,
así que Postgres interpreta ese texto como UTC.

De ahí salen los tres síntomas:

1. **Todo recordatorio se dispara antes de tiempo.** Con `-06:00`, seis horas antes.
2. **Al reabrir una tarea, el selector siempre muestra "Fecha personalizada".**
   `detectReminderKey` compara la hora local de la tarea contra el `reminder_date` que vuelve de
   la base en UTC; la resta nunca coincide con un preset.
3. **La pantalla dice la verdad y la base guarda otra cosa.** La línea "Aviso el 3 de agosto a
   las 15:45" calcula bien. Es la escritura la que miente, y por eso el defecto sobrevivió: la
   única superficie que lo delataba era la propia base.

Este defecto es anterior al cron. Vivía latente porque **nada leía `reminder_date` para enviar
nada**. El cron no lo causó: lo destapó.

## Alcance

Dentro:

- Arreglar la serialización con zona en `computeReminderDate` y su lectura en
  `detectReminderKey`.
- Rehacer el selector de recordatorio siguiendo el estándar de Google Calendar.

Fuera (cada uno con su propio diseño):

- Avisos que Anfiora genere sola a partir del estado del evento.
- La adopción del canal de notificaciones (hoy 1 suscripción push en toda la app).
- Varios recordatorios por tarea: exigiría tabla nueva y no lo ha pedido nadie.
- Encender el `schedule` del workflow: sigue siendo el último paso, cuando esto esté verde.
- El `EVENT_UTC_OFFSET` fijo en `-06:00` de `lib/notifications/reminders.ts`. Es una decisión
  consciente documentada (México no aplica horario de verano desde 2022) y solo gobierna la
  caducidad, no el momento del envío. Queda anotado para el día que Anfiora venda fuera de
  México.

## Diseño

### 1. Serialización con zona

`computeReminderDate` y `detectReminderKey` trabajan con instantes, no con texto: se construye
el `Date` en la zona del navegador y se serializa con su offset real (`toISOString()`). La hora
que el usuario ve en pantalla pasa a ser exactamente la que se guarda.

`detectReminderKey` compara dos instantes, así que la diferencia vuelve a coincidir con los
presets y una tarea guardada se reconoce a sí misma al reabrirla.

**No hay migración.** Los seis recordatorios guardados mal son pruebas de abril y mayo y el cron
ya consumió cuatro. No hay dato real que rescatar.

**Zona de referencia: la del navegador del planner.** Es lo que hace Google Calendar por
defecto y lo correcto para un producto México-primero. Un planner que capture desde otra zona
guardará según la suya; se acepta.

### 2. El selector

Tres cambios dentro del mismo control:

**"A la hora de la tarea".** Aparece solo cuando la tarea tiene hora, porque sin hora no
significa nada.

**El menú cambia cuando la tarea no tiene hora.** Hoy el código usa las 09:00 en silencio: se
elige "15 minutos antes" y el aviso sale a las 08:45 sin decírselo a nadie. El estándar para
eventos de día completo es decir la hora en la propia etiqueta.

| Tarea con hora (3 ago, 16:00) | Tarea sin hora (3 ago)      |
| ----------------------------- | --------------------------- |
| A la hora de la tarea         | El mismo día a las 9:00     |
| 15 minutos antes              | 1 día antes a las 9:00      |
| 30 minutos antes              | 2 días antes a las 9:00     |
| 1 hora antes                  | 1 semana antes a las 9:00   |
| 2 horas antes                 | Personalizado…              |
| 1 día antes                   |                             |
| 2 días antes                  |                             |
| 1 semana antes                |                             |
| Personalizado…                |                             |

Las 9:00 como hora del aviso para tareas sin horario, igual que Google Calendar.

Cuando la tarea no tiene hora **desaparecen los presets por minutos y horas** (15 min, 30 min,
1 h, 2 h) y también "A la hora de la tarea": ninguno tiene significado sin un horario de
referencia. Quedan solo los que se cuentan por días, con la hora dicha en la etiqueta. Al
escribirle una hora a la tarea, el menú vuelve a la columna izquierda y el recordatorio elegido
se recalcula sobre la hora nueva.

**Mover la tarea recalcula el aviso en vez de borrarlo.** Hoy los `onChange` de fecha y hora
hacen `reminder_key: ''`: si se elige "1 hora antes" y después se ajusta el horario, el
recordatorio desaparece en silencio y nadie se entera hasta que no suena.

### Modelo de datos

Sin cambios. Se mantiene una sola columna `reminder_date` y un único recordatorio por tarea.

## Pruebas

`computeReminderDate` y `detectReminderKey` son lógica pura y van a Vitest, con la zona fijada
en `America/Mexico_City` para que el resultado no dependa de dónde corra la suite:

- **Ida y vuelta:** un recordatorio serializado vuelve a reconocerse como el mismo preset. Solo
  pasa si el defecto está muerto de los dos lados.
- El caso reportado: 11:06 de México se guarda como `17:06Z`.
- Tarea con hora, tarea sin hora, "a la hora de la tarea" y modo personalizado.
- Recálculo al mover la tarea de hora.

Verificación manual, por el flujo local → preview → main: crear una tarea, confirmar en la base
que el timestamp coincide con lo que muestra la pantalla, y disparar el cron a mano.

## Riesgos

- **Un planner en otra zona horaria** guarda según su navegador. Aceptado para el mercado
  actual.
- **El cron entrega a lo más una vez y marca antes de enviar.** Cada corrida quema los
  recordatorios que toca. Por eso el `schedule` se enciende sólo después de verificar esto.
