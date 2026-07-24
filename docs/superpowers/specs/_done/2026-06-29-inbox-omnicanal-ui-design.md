# Inbox omnicanal por evento — diseño

**Fecha:** 2026-06-29
**Estado:** aprobado en brainstorming, listo para plan de implementación
**Relacionado:** `2026-06-24-nucleo-omnicanal/`, `2026-06-28-telegram-adapter-design.md`

## Objetivo

Evolucionar el hub de mensajes por evento (`/events/[id]/mensajes`) de una bandeja
de un solo canal atada a `wa_messages` a una **bandeja omnicanal** que lee del modelo
canónico (`conversations` + `messages` + `channel_participants` + `channel_accounts`).

El éxito es **ver al agente de IA respondiendo conversaciones reales de Telegram dentro
de la app**, distinguir quién habló (invitado / IA / humano), y que el planner pueda
**tomar el control y responder él mismo** desde la bandeja — para Telegram y WhatsApp.

Canal de prueba designado: **Telegram** (sin muro de verificación de Meta, ya funciona
de punta a punta). WhatsApp viaja en el mismo diseño; si el tiempo aprieta, Telegram es
el piso demoable y WhatsApp se completa en la siguiente pasada.

## Contexto y restricciones

- Sin tablas nuevas en Supabase. Sin cambios de schema. Sin tocar Supabase directamente.
- Solo Tailwind, mobile-first, Lucide, CTAs en teal `#48C9B0`, sin emojis, español con acentos.
- El modelo canónico ya está en prod y verificado. El adaptador de salida de Telegram
  (`sendTelegramMessage`) ya existe a nivel librería; falta exponerlo y espejarlo.
- Modelo de handoff elegido: **A — control manual explícito** (interruptor "Agente activo /
  Yo respondo" por conversación). El agente y el humano conviven; el interruptor decide
  quién contesta automático. No hay pausa automática al escribir.

## Hallazgos previos al diseño (verificados en código)

1. **El webhook de Telegram NO consulta `ai_enabled`.** Hoy siempre responde si la
   interpretación es confiable (`app/api/webhook/telegram/route.ts`). Para que el
   interruptor de handoff no sea decorativo, hay que **cablear el gate**: tras guardar el
   inbound, leer `conversations.ai_enabled`; si está en `false`, el agente se queda callado
   (no interpreta, no responde, no actualiza RSVP). El mensaje entrante igual se guarda.

2. **Las cuentas de canal compartidas tienen `workspace_id = NULL`** (`store.ts`
   `ensureChannelAccount` no setea workspace). La policy RLS `ca_owner`
   (`workspace_id = auth.uid()`) las hace **ilegibles desde el navegador**, incluso para el
   dueño. El badge de canal (WhatsApp / Telegram) necesita ese dato. Por eso la lectura de
   la bandeja se hace desde un **endpoint de servidor** (service role) que arma los datos
   ya listos, en vez de leer canónico directo desde el cliente.

3. **`conversations` y `messages` SÍ son legibles por el dueño** desde el navegador
   (`workspace_id` NOT NULL = `auth.uid()`), pero por consistencia y para cubrir el badge
   de canal y a los colaboradores, toda la lectura de la bandeja pasa por el endpoint.

4. En la vista por evento (`tenant_id = eventId`) toda conversación llega ya ligada a un
   invitado (`contact_guest_id` no nulo): Telegram entra por deep-link `/start <guest_id>`
   y WhatsApp por mapeo de teléfono. El inbox general "sin clasificar" queda fuera de alcance.

## Arquitectura

### Lectura — `GET /api/omnichannel/inbox`

Endpoint de servidor (service role). **Verifica acceso** antes de devolver datos: toma el
access token del usuario (header `Authorization: Bearer <token>`), resuelve el `uid` con
`supabase.auth.getUser(token)`, y confirma que el usuario sea **dueño del evento**
(`events.user_id = uid`) o **colaborador activo** (`event_collaborators.status = 'active'`).
Si no, 403. Esto cierra el hueco de los endpoints viejos sin auth, en las superficies nuevas.

Parámetros: `eventId` (requerido), `conversationId` (opcional, para traer el hilo abierto).

Respuesta:

```ts
{
  conversations: Array<{
    id: string                       // conversations.id
    channel: string                  // 'whatsapp' | 'telegram'
    participantName: string | null   // channel_participants.display_name
    guestId: string | null           // contact_guest_id
    guestName: string | null
    rsvpStatus: string | null
    lastMessageText: string | null
    lastMessageAt: string | null     // conversations.last_message_at
    lastAuthorType: 'contact' | 'ai' | 'human' | null
    aiEnabled: boolean               // conversations.ai_enabled
  }>
  messages?: Array<{                 // solo si se pidió conversationId
    id: string
    direction: 'inbound' | 'outbound'
    authorType: 'contact' | 'ai' | 'human'
    contentText: string
    providerTimestamp: string        // ORDEN por aquí
  }>
}
```

Conversaciones filtradas por `tenant_id = eventId`, ordenadas por `last_message_at desc`.
Mensajes ordenados por `provider_timestamp asc`.

El **polling** del cliente llama a este endpoint cada ~4s mientras la bandeja está abierta
(lista siempre; mensajes cuando hay conversación seleccionada). Refresco simple y robusto
para demo en vivo. Realtime de Supabase queda como mejora posterior.

### Escritura — `POST /api/omnichannel/send`

Endpoint único de envío (service role), con la **misma verificación de acceso** que la
lectura. Entrada: `{ conversationId, text }`.

Flujo:
1. Cargar la conversación → `channel_account` (canal + external_account_id), `participant`
   (external_id), `workspace_id`, `tenant_id`, `contact_guest_id`.
2. Despachar por canal:
   - **telegram** → `sendTelegramMessage(participant.external_id, text)` (external_id = chat_id).
     `providerMessageId = ${chatId}:${messageId}` (mismo esquema que el inbound de Telegram).
   - **whatsapp** → enviar vía Twilio a `whatsapp:${external_id}` (external_id = E.164).
     Primero insertar en `wa_messages` (preserva el historial legacy + bump de RSVP), luego
     usar `providerMessageId = wa:${wa_messages.id}` para el espejo canónico (mismo esquema
     que el backfill, evita duplicados en re-corridas).
3. Espejar al modelo canónico con `ingestOutbound` (`store.ts`), `authorType: 'human'`.
4. NO toca `ai_enabled` (el interruptor es manual e independiente — modelo A).

Dedupe por identidad de fila en ambos canales (alineado con el principio de llaves por id).

### Webhook — gate de `ai_enabled` (Telegram)

En `app/api/webhook/telegram/route.ts`, dentro de `processTelegramUpdate`, tras
`ingestInbound` (que ya guarda el entrante y devuelve `conversationId`):

- Leer `conversations.ai_enabled` de ese `conversationId`.
- Si es `false`: marcar el webhook_event como procesado y **terminar** — el agente no
  interpreta, no responde ni cambia RSVP. El humano ve el mensaje en la bandeja (vía polling)
  y responde a mano.
- Si es `true` (default): comportamiento actual (interpretar → actualizar RSVP → responder →
  espejar `ai`).

El bloque de `/start` (bienvenida) no se gatea — es el saludo de binding inicial.

El mismo gate en el webhook de WhatsApp se anota como follow-up paralelo (la demo es
Telegram); se deja explícito para que no quede a medias.

## UI — `/events/[id]/mensajes` (tres paneles)

Se conserva el layout de tres columnas (lista / chat / detalle) y el comportamiento
responsive actual (mobile: una columna a la vez; desktop: paneles).

### Panel lista
- Fila: avatar (iniciales), nombre del invitado, preview del último mensaje, hora relativa,
  **badge de canal** (ícono WhatsApp / Telegram), badge RSVP si hay invitado ligado.
- **Filtros rápidos por canal** arriba: Todos · WhatsApp · Telegram (chips).
- Búsqueda por nombre.
- Estado de carga (skeletons) y estado vacío.

### Panel chat
- Header: avatar + nombre + badge de canal + badge RSVP + **interruptor "Agente activo /
  Yo respondo"** (escribe `conversations.ai_enabled`; el dueño puede por RLS `cv_owner`).
- Mensajes agrupados por día. **Tres estilos de burbuja por `author_type`:**
  - `contact` (entrante): burbuja blanca a la izquierda.
  - `ai`: burbuja teal a la derecha con chispa "IA".
  - `human`: burbuja oscura (`#1D1E20`) a la derecha, etiqueta "Tú".
- Cajón de texto siempre disponible (Enter envía, Shift+Enter nueva línea), conectado a
  `POST /api/omnichannel/send`. Tras enviar, refresca.

### Panel detalle
- Si hay invitado ligado: igual que hoy (RSVP, mesa, lado, tags, alergias) — lectura de
  `guests` + `table_seats` desde el navegador (RLS de dueño, patrón actual).
- Tarjeta de estado del agente que **refleja el interruptor en vivo** (activo / en pausa).

## Alcance

### Entra hoy (demoable de punta a punta)
1. `GET /api/omnichannel/inbox` con verificación de acceso (dueño/colaborador).
2. UI lee de ese endpoint; badges de canal + filtros WhatsApp/Telegram.
3. Tres estilos de burbuja (invitado / IA / tú).
4. Interruptor de handoff + **cableo de `ai_enabled` en el webhook de Telegram**.
5. `POST /api/omnichannel/send` (Telegram + WhatsApp), espejo canónico `author_type='human'`.
6. Cajón de respuesta conectado + refresco por polling (~4s).

### Se difiere (no estorba a la demo)
- Inbox general "sin clasificar" y vincular prospectos a invitados.
- Ventana de 24h de WhatsApp con plantillas aprobadas (Telegram no la tiene).
- Gate de `ai_enabled` en el webhook de WhatsApp (paralelo; la demo es Telegram).
- Realtime de Supabase (polling es suficiente para v1).
- Envío de media / adjuntos.

### Recorte de emergencia
Si el día aprieta: dejar la demo **solo Telegram** (omitir el despacho WhatsApp del endpoint
de envío y el filtro WhatsApp), y completar WhatsApp en la siguiente pasada. La plomería del
endpoint queda lista para sumarlo.

## Riesgos y notas
- Ambicioso para un día: toca lectura, escritura, endpoint nuevo y cambio en el webhook.
  Es factible porque la plomería canónica ya existe; lo nuevo es el UI + dos endpoints
  delgados + un gate.
- Seguridad: los endpoints nuevos SÍ validan acceso (mejora sobre `/api/whatsapp/send`, que
  no valida — deuda pre-existente que conviene endurecer después en las superficies viejas).
- Gotcha de deploy: `anfiora.com` hace 307 a `www` en POST; las pruebas de webhook van a
  `https://www.anfiora.com`.
- No regresar WhatsApp: el envío WhatsApp sigue escribiendo `wa_messages` + bump de RSVP
  para no romper comportamiento existente, y además espeja canónico con llave `wa:<id>`.
