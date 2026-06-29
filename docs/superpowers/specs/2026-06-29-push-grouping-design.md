# Spec — Agrupacion de notificaciones push (Anfiora)

> Fecha: 2026-06-29. Estado: APROBADO por Diego (brainstorming). Capa 2 sobre la Fase 1 de push (ya en main, PR #1).
> Stack: Next.js 16 + Supabase (service role en el webhook) + Web Push.

## Objetivo

Evitar la saturacion cuando entran muchas respuestas de WhatsApp en poco tiempo (ej. un blast con 15 invitados respondiendo en 10 min). En vez de 15 notificaciones apiladas, el planner ve **una sola** notificacion por evento que se actualiza con un conteo.

## Decisiones tomadas (no re-litigar)

1. **Estrategia: colapsar al instante + conteo (Opcion A).** Sin demora, sin digest, sin infraestructura nueva. Descartado el digest con ventana de tiempo (Capa 3, futuro).
2. **Conteo por ventana movil (A1).** El numero = invitados distintos que respondieron en las ultimas 2h del evento. La ventana se vacia sola; sin concepto de "leido/no leido" (descartado A2). Sin almacenamiento nuevo.
3. **Copy: nombre del ultimo + conteo (C1).** "Ana y N mas respondieron." Descartado el desglose por tipo (C2).
4. **Re-aviso `renotify: true`.** Cada nueva respuesta re-avisa suave pero siempre se ve una sola tarjeta por evento.
5. **Alcance: solo el disparador de WhatsApp.** Los disparadores de Fase 2/3 seguiran el mismo patron cuando existan.

## Comportamiento

Cuando el webhook de WhatsApp procesa una respuesta de un invitado y dispara el push:

1. Cuenta invitados distintos con mensajes entrantes recientes del evento:
   - tabla `wa_messages`, `event_id = guest.event_id`, `direction = 'received'`, `created_at > now() - VENTANA`.
   - `VENTANA` = 2 horas (constante en codigo, facil de ajustar).
   - El conteo es de `guest_id` distintos (un invitado que manda 3 mensajes cuenta 1).
2. Arma el payload:
   - **Titulo:** nombre del evento (igual que hoy).
   - **Cuerpo:**
     - Conteo <= 1 -> detalle actual: "{guest} confirmo asistencia." / "{guest} no podra asistir." / "{guest} respondio por WhatsApp."
     - Conteo > 1 -> "{guest} y {conteo-1} mas respondieron." ({guest} = quien acaba de responder).
   - **url:** `/events/{eventId}/mensajes` (igual que hoy).
   - **tag:** `wa-event-{eventId}` (antes era `wa-{guestId}`). Colapsa por evento.
   - **renotify:** `true`.

## Modelo de datos

Ninguno. Sin tablas ni columnas nuevas. El conteo se deriva de `wa_messages` en cada envio.

## Componentes a tocar

### `app/api/webhook/whatsapp/route.ts`
Reemplazar el bloque actual del push (dentro del `try/catch` despues de `sendWhatsAppReply`). Antes de armar el payload:
- Consultar el conteo de invitados distintos en la ventana.
- Construir `body` segun conteo (1 vs >1), reusando el `statusLabel` existente para el caso de 1.
- Cambiar `tag` a `wa-event-${guest.event_id}` y agregar `renotify: true`.

### `lib/push.ts`
Agregar `renotify?: boolean` al tipo `PushPayload` para poder pasarlo en el payload.

### `public/sw.js`
En el handler `push`, pasar `renotify: data.renotify` a `showNotification` (1 linea). El resto del SW no cambia.

## Casos borde

- **Conteo = 2:** "Ana y 1 mas respondieron." (aceptable en espanol).
- **Sin nombre de invitado:** se usa el fallback existente "Invitado".
- **El conteo solo cuenta `received`:** las respuestas del agente (`sent`) no inflan el numero.
- **Eventos distintos en paralelo:** tags distintos -> notificaciones separadas (correcto, no se colapsan entre eventos).
- **Si el conteo falla:** el bloque del push ya esta en `try/catch`; un fallo de la consulta no rompe el webhook (responde 200 a Twilio igual).

## Fuera de alcance (YAGNI)

- Digest con ventana de tiempo (Capa 3).
- Desglose por tipo en el cuerpo (C2).
- Unread real "desde tu ultima visita" (A2).
- Agrupacion para disparadores que aun no existen (timeline, colaborador) — se haran al implementar esas fases con este mismo patron.

## Reglas del repo

Codigo completo, un paso a la vez, sin acentos/n en commits, UI/copy con acentos y sin emojis. El push es notificacion del sistema operativo, no in-app (no hay campanita/feed dentro de Anfiora).
