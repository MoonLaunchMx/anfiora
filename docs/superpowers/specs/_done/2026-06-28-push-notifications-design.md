# Spec — Notificaciones Push cross-platform (Anfiora)

> Fecha: 2026-06-28. Estado: APROBADO por Diego (brainstorming). Pendiente de implementacion en chat nuevo.
> Stack: Next.js 16 (App Router) + React 19 + TypeScript + Supabase + Vercel + Twilio.

## Objetivo

Notificar al planner (y su equipo) en su celular/desktop cuando pasan cosas relevantes en sus eventos, en cualquier sistema operativo, sin app nativa. Se logra con **Web Push estandar (VAPID)** sobre la PWA ya instalable.

Cobertura: Android (Chrome/Edge/Samsung/Firefox), iOS/iPadOS 16.4+ **solo con la PWA instalada**, y desktop. iOS en Safari normal (sin instalar) no recibe push: limite de Apple, no del diseno. La PWA instalable (prerrequisito) ya esta en prod (manifest + sw.js + iconos + banner InstallPrompt, commits d9e89c1/9c18ce2/518caf8/69eb6d3).

## Decisiones tomadas (no re-litigar)

1. **Disparadores:** los 4 — WhatsApp respuesta, recordatorio de timeline, pago por vencer, actividad de colaborador.
2. **Pago por vencer = tarea de timeline categoria `pago` con reminder_date.** No hay fecha de vencimiento de pagos en la DB y no se agrega. Se reusa el cron de recordatorios.
3. **Storage:** tabla nueva `push_subscriptions` (una fila por dispositivo). Aprobado romper la regla "no tablas nuevas" porque push es capacidad nueva legitima.
4. **Destinatarios:** owner del evento + colaboradores con rol admin/editor que tengan push activado, **excluyendo al actor** (no te notificas a ti mismo).
5. **Activacion:** toggle en `/perfil`, seccion "Notificaciones", switch "Activar en este dispositivo". Nada de pedir permiso en frio al cargar.

## Arquitectura

```
[Navegador] --suscribe--> [/api/push/subscribe] --> tabla push_subscriptions
                                                          |
[Disparador] --> [lib/push.ts: sendPushToUsers()] --web-push--> [Push Service] --> [sw.js 'push'] --> notificacion
                                                          |
                                          (borra suscripciones muertas 404/410)
```

Un solo nucleo de envio (`lib/push.ts`) reusado por todos los disparadores. La diferencia entre disparadores es solo de donde se llama y como se resuelven los destinatarios.

## Modelo de datos (2 cambios de schema)

### Tabla nueva `push_subscriptions`
```sql
push_subscriptions (
  id UUID PK default gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
-- indice por user_id para resolver destinatarios rapido
-- RLS: el usuario solo ve/gestiona sus propias suscripciones; el envio usa service role
```

### Columna nueva `event_timeline_tasks.reminder_sent_at`
```sql
ALTER TABLE event_timeline_tasks ADD COLUMN reminder_sent_at TIMESTAMPTZ;
-- el cron solo envia donde reminder_date <= now() AND reminder_sent_at IS NULL AND is_completed = false
```

## Componentes

### `lib/push.ts` (nucleo)
- Configura `web-push` con `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
- `sendPushToUsers(userIds: string[], payload: { title, body, url, tag? })`:
  - Query a `push_subscriptions` con service role para esos user_ids.
  - `web-push.sendNotification` por cada suscripcion.
  - Si responde 404 o 410 (Gone), borra esa fila (suscripcion muerta).
- `resolveEventRecipients(eventId, actorUserId?)`: owner (`events.user_id`) + colaboradores admin/editor aceptados (`event_collaborators`), menos `actorUserId`. Devuelve user_ids unicos.

### `public/sw.js` (agregar handlers, sin tocar el passthrough actual)
```js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Anfiora', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: data.url || '/dashboard' },
      tag: data.tag,
    })
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const hit = wins.find((w) => w.url.includes(url));
      if (hit) return hit.focus();
      return clients.openWindow(url);
    })
  );
});
```

### `/api/push/subscribe` (session-auth)
- POST: recibe la suscripcion del navegador, hace upsert en `push_subscriptions` (por endpoint) con el user_id de la sesion + user_agent.
- DELETE: borra por endpoint (al apagar el toggle).

### Toggle en `/perfil`
- Seccion "Notificaciones" con switch "Activar en este dispositivo".
- Al prender: `Notification.requestPermission()` -> `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(NEXT_PUBLIC_VAPID_PUBLIC_KEY) })` -> POST `/api/push/subscribe`.
- Al apagar: `subscription.unsubscribe()` + DELETE `/api/push/subscribe`.
- Estados a manejar: `Notification.permission === 'denied'` -> mostrar instrucciones para desbloquear, no colgarse. Navegador sin soporte -> ocultar/disable con nota.

## Disparadores

### WhatsApp respuesta (event-driven, Fase 1)
- En `/api/webhook/whatsapp/route.ts`, despues de interpretar la respuesta del invitado y actualizar `guests`, llamar `sendPushToUsers(resolveEventRecipients(eventId), { title, body, url: /events/[eventId]/mensajes })`.
- El actor es el invitado (no un user), no hay exclusion. Ya es server con service role: llama `lib/push` directo.

### Recordatorio de timeline + pago (time-driven, Fase 2)
- **Vercel Cron** cada 15 min -> `/api/cron/reminders` (protegido con header `CRON_SECRET`).
- Query: tareas con `reminder_date <= now()`, `reminder_sent_at IS NULL`, `is_completed = false`.
- Por cada tarea: `sendPushToUsers(resolveEventRecipients(task.event_id), { title, body, url: /events/[event_id]/timeline })` y marcar `reminder_sent_at = now()`.
- Cubre categoria `recordatorio` y `pago` igual (mismo mecanismo).

### Actividad de colaborador (event-driven, Fase 3)
- `logAction()` corre en el cliente, asi que se agrega `/api/push/event-activity` (session-auth):
  - Verifica que el user de la sesion tiene acceso al `eventId`.
  - `resolveEventRecipients(eventId, actorUserId = session.user.id)` (excluye al actor).
  - `sendPushToUsers(..., { title, body, url })`.
- Enganche: tras un `logAction()` de mutacion importante, el cliente hace fire-and-forget POST a este endpoint. Falla en silencio (como el audit).

## Fases de implementacion (un solo spec, 3 fases con checkpoint)

- **Fase 1 — Base + WhatsApp:** tabla `push_subscriptions`, env VAPID, dep `web-push`, `lib/push.ts`, handlers en `sw.js`, `/api/push/subscribe`, toggle en `/perfil`, enganche en webhook. Prueba el pipeline end-to-end en un dispositivo real.
- **Fase 2 — Cron de recordatorios:** columna `reminder_sent_at`, `/api/cron/reminders`, config Vercel Cron.
- **Fase 3 — Actividad de colaborador:** `/api/push/event-activity` + enganche en el flujo de audit.

Cada fase es desplegable y verificable sola.

## Cambios externos (checklist prod-safety de Diego)

- **npm:** instalar `web-push` (pedir permiso antes).
- **Env vars** (Vercel + `.env.local`): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (formato `mailto:diego@...`), `CRON_SECRET`. Generar VAPID con `npx web-push generate-vapid-keys`.
- **Supabase:** aplicar SQL (1 tabla + 1 columna + RLS) **despues** de pushear el codigo correspondiente. Nunca tocar Supabase antes que el codigo este en origin.
- **Vercel Cron:** entrada nueva (`vercel.json` o `vercel.ts`) apuntando a `/api/cron/reminders` con schedule `*/15 * * * *`.

## Fuera de alcance (YAGNI)

- Preferencias granulares por tipo de notificacion (v1 es todo on/off por dispositivo).
- Nudge post-instalacion (solo toggle en /perfil).
- Fecha de vencimiento real de pagos (se usa tarea de timeline).
- Digest/agrupacion de notificaciones.

## Riesgos / notas

- iOS: solo PWA instalada + iOS 16.4+. Documentar en la UI del toggle si se detecta iOS sin standalone.
- Permiso `denied`: el toggle debe mostrar instrucciones, no romperse.
- Suscripciones muertas: limpiar en cada envio al recibir 404/410.
- El `sw.js` no debe cachear (ya es passthrough); los handlers push se suman sin alterar eso.
- Reglas del repo: codigo completo (no fragmentos), un paso a la vez, sin acentos/n en commits, UI con acentos y sin emojis, CTA teal #48C9B0.
