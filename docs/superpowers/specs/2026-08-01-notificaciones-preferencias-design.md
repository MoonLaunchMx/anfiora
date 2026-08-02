# Notificaciones: preferencias por tipo + cron de recordatorios

**Fecha:** 2026-08-01
**Estado:** diseño aprobado, pendiente de plan de implementación
**Rama:** `feat/notificaciones-preferencias`

## Problema

Anfiora tiene el motor de push completo y conectado (Service Worker, VAPID, `lib/push.ts`, alta/baja de dispositivo, toggle en `/perfil`), pero de los cuatro disparadores que se diseñaron solo vive uno: las respuestas de invitados por Telegram. WhatsApp está cableado pero el canal no está conectado en producción.

De ahí salen los dos huecos que este proyecto cierra:

1. **El planner programa recordatorios que nadie envía.** `TaskModal.tsx` ofrece presets de 15 min, 30 min, 1 h, 2 h, 1 día y 2 días antes, y guarda `reminder_date`. No existe `app/api/cron/`, no existe `vercel.json` ni `vercel.ts`, y la columna anti-duplicado `event_timeline_tasks.reminder_sent_at` nunca se creó. Es una promesa visible en la UI que el producto no cumple.

2. **El control es todo-o-nada.** El toggle de `/perfil` enciende o apaga el dispositivo entero. Quien no quiera un tipo de aviso tiene que renunciar a todos, incluidos los que sí le importan.

Hay un tercer defecto, en la capa de transporte, que se descubrió al diseñar esto y se corrige aquí: **`lib/push.ts` envía sin cabecera `TTL`**, así que la librería aplica su default de cuatro semanas (`DEFAULT_TTL = 2419200` en `node_modules/web-push/src/web-push-lib.js`). Un aviso de "tu tarea es en 15 minutos" puede entregarse días después, cuando el dispositivo vuelve a conectarse.

## Alcance

**Dentro:**

- Preferencias por tipo de notificación, por cuenta, en `/perfil`.
- Cron de recordatorios de timeline, que cubre también los pagos por vencer.
- Cabeceras estándar `TTL`, `Topic` y `Urgency` en todos los envíos.
- Corrección del botón "Enviar notificación de prueba".

**Fuera (backlog, no se construye aquí):**

- Actividad de colaborador como disparador (la Fase 3 del diseño original).
- Canales alternos: correo, WhatsApp, SMS.
- Horario de silencio, no molestar, resúmenes diarios.
- Silenciar un evento concreto.
- Campana o feed de notificaciones dentro de la app.

## Decisiones cerradas

No re-litigar sin motivo nuevo.

| Decisión | Elección | Por qué |
|---|---|---|
| Qué controla el usuario | Solo **qué** recibe (por tipo) | Canales y horarios multiplican el costo sin resolver la queja actual. |
| Tipos que existirán | Respuestas de invitados, recordatorios de tareas, pagos por vencer | Los tres tienen disparador real al terminar. Una preferencia sin disparador es una promesa falsa. |
| Estado inicial de los tipos | Los tres encendidos | El usuario ya dio permiso explícito al activar el dispositivo. |
| Ámbito de la preferencia | Por cuenta, no por dispositivo | Es lo que hacen Slack, Linear y Asana; el usuario no espera reconfigurar cada aparato. |
| Dónde se guardan | `users.settings` (JSONB, ya existe y nadie la usa) | Cero tablas nuevas, cero migración. |
| Dónde se hacen cumplir | Dentro de `sendPushToUsers` | Un solo punto de control: cualquier disparador futuro respeta las preferencias por construcción. |
| Programador del cron | GitHub Actions cada 15 min | No depende del plan de Vercel (Hobby permite un disparo diario, insuficiente para presets de 15 min), queda versionado, y el interruptor de emergencia vive fuera del producto. |
| Destinatario del recordatorio | Solo el asignado; sin asignado, el owner | Evita la fatiga que hace que la gente apague todo. |
| Caducidad | `TTL` derivado del dato: hasta el momento de la tarea | Es el estándar (RFC 8030 y equivalentes en FCM y APNs) y evita constantes inventadas. |
| Entrega | A lo más una vez, nunca dos | Se marca antes de enviar. Perder un codazo es preferible a despertar tres veces; la tarea sigue visible en el timeline. |
| Estados del evento | **No se toca nada** | Diego va a mejorar los estados en otro frente. El cron replica la guarda existente sin inventar semántica nueva. |

## Diseño 1: preferencias

### Modelo

En `users.settings`:

```json
{
  "notifications": {
    "guest_replies":  true,
    "task_reminders": true,
    "payment_due":    true
  }
}
```

Tipo en `lib/types.ts`:

```ts
export type PushType = 'guest_replies' | 'task_reminders' | 'payment_due'
```

**Ausencia significa activado.** Un usuario sin la llave `notifications`, o sin una de las tres, recibe ese tipo. Así los usuarios que hoy ya tienen push activo no se quedan mudos al desplegar, y no hace falta backfill.

### Cómo se hace cumplir

`sendPushToUsers` recibe el tipo como **parámetro obligatorio**:

```ts
sendPushToUsers(userIds: string[], payload: PushPayload, type: PushType): Promise<void>
```

Obligatorio a propósito: un disparador nuevo que olvide declarar su tipo no compila. La función lee `users.settings` de los destinatarios y descarta a quien tenga ese tipo en `false` **antes** de consultar `push_subscriptions`.

### Interfaz en `/perfil`

La sección Notificaciones que ya existe se extiende:

```
Notificaciones

  Este dispositivo                          [ON]
  Recibe las notificaciones de Anfiora
  [ Enviar notificacion de prueba ]

  Que quieres recibir
  [x] Respuestas de invitados
      Cuando alguien contesta tu invitacion
  [x] Recordatorios de tareas
      A la hora que programaste en el timeline
  [x] Pagos por vencer
      Recordatorios de tareas de tipo pago
```

- Con el dispositivo apagado, el bloque "Qué quieres recibir" se muestra deshabilitado y en gris. Elegir qué recibir cuando no se recibe nada solo genera la queja de "lo tenía prendido y no me llegaba".
- Cada interruptor guarda al momento con `users.settings` mediante merge, sin botón de guardar, siguiendo el patrón de la misma pantalla.
- Estilo: interruptores como el que ya existe ahí (teal `#48C9B0` encendido, `#d8d8d8` apagado), Lucide para iconos, sin emojis.

## Diseño 2: el motor de recordatorios

### Disparo

`.github/workflows/reminders.yml`, cada 15 minutos, llama por POST a `/api/cron/reminders` con `Authorization: Bearer ${{ secrets.CRON_SECRET }}`.

El workflow nace **deshabilitado** y se enciende como último paso del despliegue.

GitHub puede retrasar los disparos programados en horas pico, así que la precisión real es de unos 15 a 20 minutos. Es aceptable para el preset más corto (15 min antes) y se documenta como límite conocido.

**Costo: cero, y está verificado.** El repositorio es público, y GitHub Actions no cobra minutos en repositorios públicos. El dato importa porque en un repositorio privado este mismo cron consumiría unos 2,880 minutos al mes —cada ejecución se redondea al minuto— contra los 2,000 gratuitos del plan Free. Si Anfiora se vuelve privado algún día, hay que revisar esta decisión: las salidas serían bajar la frecuencia a 30 minutos, mover el disparo a un programador externo, o pasar a Vercel Pro.

### La ruta `/api/cron/reminders`

Runtime Node.js (el default). Compara el secreto en tiempo constante: se aplica un digest SHA-256 a ambos lados y se comparan con `timingSafeEqual`, que exige búferes de igual longitud y lanza si no lo son. Responde 401 si no coincide.

**Paso 1 — reclamar.** Marcar y devolver en una sola operación, no leer y luego marcar. Es lo que hace segura la ruta si dos ejecuciones se traslapan: la segunda no encuentra filas. Sin esto, un retraso de GitHub que encadene dos disparos produce notificaciones duplicadas.

El reclamo va en una **función RPC**, no en el cliente. Razón concreta: `supabase.from(...).update()` no admite un límite de filas, y el tope por corrida es necesario para acotar el tiempo de ejecución. El proyecto ya usa este patrón (`increment_guests`, `decrement_guests`, `increment_guests_by`), así que no introduce nada ajeno. No es una tabla nueva.

```sql
CREATE OR REPLACE FUNCTION claim_due_reminders(max_rows INT DEFAULT 200)
RETURNS SETOF event_timeline_tasks
LANGUAGE sql AS $$
  UPDATE event_timeline_tasks
     SET reminder_sent_at = now()
   WHERE id IN (
     SELECT id FROM event_timeline_tasks
      WHERE reminder_sent_at IS NULL
        AND reminder_date IS NOT NULL
        AND reminder_date <= now()
        AND is_completed = false
      ORDER BY reminder_date
      LIMIT max_rows
      FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
$$;
```

`FOR UPDATE SKIP LOCKED` es lo que permite que dos corridas simultáneas no se bloqueen ni se pisen: cada una toma filas distintas.

El tope es de **200 tareas por corrida**. Si se alcanza, se registra en el log cuántas quedaron; la siguiente corrida las toma. No hay truncamiento silencioso.

**Paso 2 — decidir por cada tarea.** En este orden:

1. Cargar el evento. Si `event_status` es `'cancelled'` o `'completed'`, no se envía. **Es exactamente la misma guarda que ya aplican los webhooks de WhatsApp y Telegram**; los pausados siguen avisando, igual que hoy. No se introduce comportamiento nuevo.
2. Calcular el momento de la tarea. Si ya pasó, no se envía.
3. Resolver al destinatario (abajo). Si no hay, no se envía.
4. Elegir el tipo: `payment_due` si `category === 'pago'`, si no `task_reminders`.
5. Enviar con `sendPushToUsers`, que aplica las preferencias.

La fila ya quedó marcada en el paso 1, se termine enviando o no. Sin eso, cada corrida reintentaría lo mismo para siempre.

**Paso 3 — responder.** JSON con cuántas se reclamaron, cuántas se enviaron y cuántas se descartaron por cada motivo. Es lo que permite diagnosticar sin adivinar.

### El destinatario

Función pura `resolveReminderRecipient(task, event, collaborators)`:

- Si `assigned_to_user_id` existe **y** ese usuario es el owner o un colaborador con `status = 'active'`, es el destinatario.
- Si no hay asignado, el asignado se capturó como texto libre (`assigned_to_name`), o el asignado perdió el acceso al evento, el destinatario es el owner (`events.user_id`).

Se acepta cualquier rol de colaborador activo, no solo admin y editor: si a alguien se le asignó explícitamente una tarea, debe enterarse.

Devuelve un solo `user_id`, no una lista. Es deliberado: es lo que mantiene bajo el ruido.

### El momento de la tarea

Función pura `taskMoment(task)`:

- Con `task_time`: la combinación de `task_date` y `task_time`.
- Sin `task_time`: el final de `task_date` (23:59:59).

**Limitación conocida y asumida.** `task_date` es `date` y `task_time` es `time without time zone`; no guardan zona horaria. El cálculo servidor asume `America/Mexico_City`, coherente con el mercado y con el default `MXN`. Un planner en otro huso vería la caducidad desplazada algunas horas.

El impacto es acotado: **el momento del envío no depende de esto**, porque lo gobierna `reminder_date`, que sí es `timestamptz`. La suposición solo afecta la frontera de caducidad y el descarte de tareas ya pasadas.

## Diseño 3: transporte estándar

`lib/push.ts` pasa a enviar las tres cabeceras de RFC 8030, ya soportadas por la librería instalada:

| Tipo | `TTL` | `Urgency` | `Topic` |
|---|---|---|---|
| `task_reminders` | segundos hasta el momento de la tarea | `high` | id de la tarea sin guiones |
| `payment_due` | segundos hasta el momento de la tarea | `high` | id de la tarea sin guiones |
| `guest_replies` | 3 días | `normal` | id del evento sin guiones |

`Topic` colapsa **en tránsito**, mientras el dispositivo está desconectado, sustituyendo un aviso no entregado por el más nuevo del mismo tema. Es distinto del `tag` que ya usamos, que solo colapsa al pintar.

**El formato de `Topic` no es libre.** RFC 8030 lo limita a 32 caracteres del alfabeto base64url. Los prefijos descriptivos que parecerían naturales (`task-<uuid>`, `event-<uuid>`) miden 41 y 42 caracteres y serían rechazados. Un UUID sin guiones mide exactamente 32 caracteres hexadecimales, que caben en ese alfabeto: es el único identificador que ya tenemos y que encaja sin recortar. Por eso el `Topic` es el id pelado y el prefijo descriptivo se queda solo en el `tag`, que no tiene ese límite.

Los 3 días de `guest_replies` son un número elegido, no derivado: la conversación ya vive en el inbox de la app, así que el push es solo el codazo. Un aviso de hace una semana estorba más de lo que ayuda.

`TTL` nunca es negativo; si el cálculo da menos de cero, la tarea ya pasó y no se envía.

## Cambios en la base

**Ninguna tabla nueva.** Una columna, un índice y una función:

```sql
ALTER TABLE event_timeline_tasks ADD COLUMN reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS event_timeline_tasks_reminder_pending_idx
  ON event_timeline_tasks (reminder_date)
  WHERE reminder_sent_at IS NULL AND is_completed = false;
```

Más la función `claim_due_reminders` de la sección anterior. El índice parcial es el que mantiene barata la consulta del cron: solo indexa las filas que el cron puede llegar a tocar, que son una fracción mínima de la tabla.

Se aplica **después** de que el código esté en `origin/main`, según la regla de sincronía Supabase ↔ Vercel.

No hace falta backfill ni limpieza previa: solo hay 3 tareas con recordatorio activo en producción, y la regla de caducidad descarta sola las que ya pasaron.

## Errores y fallos

- **Fallo del cron:** la ruta nunca lanza hacia afuera. Registra y responde 200 con el conteo, para que GitHub Actions no marque rojo por un fallo parcial de una sola tarea.
- **Fallo de un envío:** ya se registró en el log de `sendPushToUsers`. La fila queda marcada; ese recordatorio se pierde. Es la consecuencia aceptada de "a lo más una vez".
- **Suscripción muerta:** se sigue limpiando con la lógica de 404 y 410 que ya existe.
- **Consulta que falla:** se registra con `console.error`. No se entierra el error con `|| []` — es exactamente lo que mantuvo invisible el bug de la campana del dashboard durante tres meses.

## Verificación

**Automática (Vitest, lógica pura extraída de la ruta):**

- `resolveReminderRecipient` — asignado válido, asignado sin cuenta, asignado sin acceso vigente, sin asignado.
- `taskMoment` — con hora y sin hora.
- `shouldSendReminder` — vencido, ya enviado, tarea completada, momento ya pasado.
- `ttlSeconds` — positivo, cero, y el caso de momento pasado.
- El filtro de preferencias — tipo apagado, tipo encendido, usuario sin preferencias guardadas.

**Manual (local → preview → producción):**

- Los tres interruptores de `/perfil` guardan y sobreviven a recargar.
- Con un tipo apagado, ese aviso deja de llegar y los otros siguen.
- El botón de prueba llega dos veces seguidas sin pisarse.
- Una tarea con recordatorio a 15 minutos llega dentro de la ventana esperada.
- Una tarea asignada a un colaborador le llega a él y no al owner.
- **Confirmar que las llaves VAPID estén en el scope Production de Vercel.** Quedó pendiente desde la Fase 1 y nunca se cerró. Si faltan, el push funciona en preview y muere en producción.

## Despliegue y marcha atrás

Orden obligado por la regla de sincronía:

1. Mergear el [PR #31](https://github.com/MoonLaunchMx/anfiora/pull/31) (campana de recordatorios del dashboard). Es un bug de producción vivo y toca el mismo archivo.
2. Subir el código con el workflow de GitHub Actions deshabilitado.
3. Aplicar el `ALTER TABLE` en Supabase.
4. Cargar `CRON_SECRET` en Vercel y en los secretos del repositorio.
5. Habilitar el workflow.

**Marcha atrás:** deshabilitar el workflow en GitHub. Un clic, sin despliegue y sin tocar la base. Es la ventaja principal del programador externo frente al cron de Vercel.

## Riesgos conocidos

- **WhatsApp sigue desconectado en producción**, así que `guest_replies` solo se verifica de punta a punta por Telegram.
- **Precisión del programador:** GitHub Actions puede retrasar disparos; el preset de 15 minutos puede llegar con hasta unos 20 minutos de desfase.
- **Zona horaria:** ver la limitación asumida en el cálculo del momento de la tarea.
- **Fatiga de notificaciones:** el diseño la mitiga con un solo destinatario y con las preferencias, pero solo el uso real lo confirma. Si aparece, la palanca siguiente es el resumen diario, no más interruptores.
