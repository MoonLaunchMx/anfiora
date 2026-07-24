# Telegram como segundo canal del nucleo omnicanal — Diseno (v2)

**Fecha:** 2026-06-28
**Estado:** spec aprobada en brainstorming, lista para plan de implementacion
**Depende de:** `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/design.md` (v1 lado-escritura,
ya en produccion y verificado: 5 tablas canonicas, WhatsApp espejando via `lib/whatsapp/canonical-mirror.ts`).

> **Por que Telegram.** Es el primer canal nuevo de verdad. No requiere verificacion de
> Meta (a diferencia de IG/FB/WhatsApp, hoy bloqueados). Si un canal totalmente distinto
> entra al nucleo **sin tocar el core ni WhatsApp**, la abstraccion de adaptadores quedo bien.
> Ese es el objetivo real de v2: validar la arquitectura de punta a punta.

---

## 1. Objetivo y criterio de exito

**Objetivo:** agregar Telegram como adaptador IN/OUT que escribe al MISMO modelo canonico
(`channel_accounts`, `channel_participants`, `conversations`, `messages`, `webhook_events`),
reutilizando el cerebro IA existente, sin tocar el flujo de WhatsApp.

**Criterio de exito (probado por Diego):**
1. Diego abre `https://t.me/<bot>?start=<guest_id>` en su celular.
2. El bot lo reconoce como invitado de un evento (sin pedir telefono).
3. Diego escribe "si voy" / "no voy"; el RSVP se actualiza en `guests`.
4. El bot responde por Telegram.
5. La conversacion y los mensajes quedan en el modelo canonico (mismas tablas que WhatsApp).
6. Lo repite en la laptop (Telegram Web/Desktop) sin friccion.

**Fuera de alcance de v2** (diferido a proposito):
- UI para generar/repartir deep-links de Telegram a invitados reales (entra cuando se abra Mensajes al publico).
- Cron sweeper de `webhook_events` (red de seguridad; trivial de anadir despues — tabla e indice ya existen).
- Telegram proactivo (el bot inicia conversaciones). v2 es solo reactivo.
- Mover el disparador de push al normalizador (siguiente movimiento, su propia tarea).
- Debounce antes del cerebro (1 solo tester; innecesario en v2).
- Migrar WhatsApp al normalizador generico (se queda en su mirror verificado).
- Adjuntos / media (solo texto en v2).

---

## 2. Decisiones cerradas (brainstorming 2026-06-28, no re-litigar)

1. **Alcance:** loop completo en backend, sin UI nueva. Se prueba a mano con un deep-link.
2. **Construccion:** se extrae por fin el **Normalizador/Store generico** (pieza #2 del plano) y
   Telegram se monta encima. **WhatsApp NO se toca** — sigue en `lib/whatsapp/canonical-mirror.ts`.
   Temporalmente conviven dos caminos de escritura (WA viejo, TG nuevo); es deliberado, no deuda accidental.
   Migrar WA al normalizador es un refactor limpio posterior (y es cuando se mueve el disparador de push).
3. **Identidad/ruteo:** deep-link `t.me/<bot>?start=<guest_id>`. El payload es el `guest_id` (UUID).
   De ahi se deriva todo igual que hoy: `guest -> event_id -> owner (workspace)`. **Cero cambios de
   schema de dominio**; el binding `chat_id <-> invitado` vive en las tablas canonicas, no en `guests`.
4. **Transporte:** webhook (no long-polling), seguro via `secret_token` de Telegram. Bot **compartido**
   de Anfiora (un token en env). Aislamiento por planner ya garantizado por la llave unica de `channel_participants`.
5. **Dedupe:** se aterriza el update crudo en `webhook_events` con `provider_event_id = update_id`
   (`ON CONFLICT DO NOTHING`); el `UNIQUE(channel_account_id, provider_message_id)` de `messages` es la
   segunda red. **Cron sweeper diferido.**

---

## 3. El nudo de Telegram: identidad sin telefono

WhatsApp rutea por telefono: `From` matchea `guests.phone` y de ahi salen evento, invitado y workspace.
Telegram **no expone telefono**; un update trae `chat.id` (numerico) y a veces `username`. Nada matchea `guests`.

**Solucion: la identidad viaja en el link.**

- El invitado abre `t.me/<bot>?start=<guest_id>`. El primer mensaje que Telegram entrega al bot es
  `/start <guest_id>`.
- El adaptador lee el `guest_id` del payload, busca el invitado, deriva `event_id` y el dueno (workspace),
  y crea/asegura: `channel_participants` (con `external_id = chat_id`), `conversations`
  (`contact_guest_id = guest`, `tenant_id = event`).
- A partir de ahi, **los mensajes siguientes de ese `chat_id` rutean solos**: encuentran su conversacion
  existente por `(channel_account_id, participant_id)`, que ya tiene el invitado y el evento atados.

**Casos borde (v2 los maneja simple):**
- Mensaje de un `chat_id` sin binding y sin `/start` valido -> cae **sin clasificar**, sin auto-respuesta
  (mismo criterio que hoy: "numero no registrado" se ignora).
- `/start` con un `guest_id` que no existe -> se ignora (log silencioso).
- `/start` repetido del mismo chat -> idempotente (reusa participante y conversacion existentes).

**Nota de seguridad (no bloquea v2):** quien tenga el link puede hacerse pasar por ese invitado, igual
que en WhatsApp cualquiera que escriba desde ese telefono. Para la prueba personal es irrelevante; un
token rotatorio (en vez de `guest_id` directo) se puede anadir cuando exista la UI de reparto.

---

## 4. Arquitectura: las piezas y la frontera

```
Telegram (Bot API) ──> [ADAPTADOR IN telegram] ──┐
                                                  ├──> [NORMALIZADOR/STORE generico] ──> tablas canonicas
WhatsApp (Twilio) ───> [mirror WA existente] ─────┘        (no sabe de canal)
                                                  
[NORMALIZADOR] ──> [CEREBRO IA (dominio, ya existe)] ──> [ADAPTADOR OUT telegram] ──> Telegram
```

### Frontera nucleo <-> dominio (sin cambios respecto al plano)

- **Nucleo / agnostico:** el normalizador generico y el contrato canonico. No saben de eventos ni invitados.
- **Dominio Anfiora:** el ruteo (de `guest_id` a evento/workspace) y el cerebro
  (`interpretRSVPMessage` / `generateAgentReply` de `lib/ai-rsvp.ts`, ya agnosticos de canal).
- **Adaptadores Telegram:** traducen entre el payload nativo de Telegram y el contrato canonico.

### El Normalizador/Store generico (pieza nueva, reutilizable)

Recibe un mensaje en "idioma comun" y hace el upsert en cascada (cuenta -> participante -> conversacion ->
mensaje) **sin saber de que canal viene**. Es la generalizacion de lo que hoy hace el mirror de WhatsApp,
pero sin ninguna palabra de WhatsApp. Esta es la pieza que manana sirve para IG/FB/TikTok sin reescribirse.

Mantiene el mismo comportamiento probado del mirror: **fallo silencioso** (nunca lanza, nunca rompe el
webhook), dedupe por `provider_message_id`, y actualizacion de `last_message_at` / `last_inbound_at`.

---

## 5. Contratos canonicos

### InboundMessage (lo que produce todo adaptador IN)

```ts
type InboundMessage = {
  channel: string                  // 'telegram'
  externalAccountId: string        // id del bot -> a que channel_account
  participantExternalId: string    // chat_id (string)
  displayName: string | null       // nombre/username de Telegram
  providerMessageId: string        // message_id de Telegram (por chat)
  providerTimestamp: string        // message.date (ISO)
  contentText: string
  payload?: Record<string, unknown>
  // Vinculo de dominio resuelto por el ruteo (dominio Anfiora):
  workspaceId: string
  tenantId: string | null          // event_id
  contactGuestId: string | null    // guest_id
}
```

### OutboundMessage (lo que consume todo adaptador OUT)

```ts
type OutboundMessage = {
  channel: string                  // 'telegram'
  externalAccountId: string        // bot
  participantExternalId: string    // chat_id destino
  contentText: string
  authorType: 'ai' | 'human'
  // tras enviar, el adaptador llama al store con el resultado para espejar:
  providerMessageId: string
  providerTimestamp: string
  status: string                   // 'sent' | 'failed'
  workspaceId: string
  tenantId: string | null
  contactGuestId: string | null
}
```

### Mapa Telegram -> canonico (contrato por canal, del plano seccion 4)

| Concepto canonico | Telegram (Bot API) |
|---|---|
| `provider_event_id` (dedupe webhook) | `update_id` (unico y monotonico por bot) |
| `provider_message_id` (dedupe mensaje) | `message.message_id` (por chat) |
| `provider_timestamp` (orden) | `message.date` (segundos; desempate por `update_id`) |
| `participant_external_id` | `message.chat.id` |
| `display_name` | `from.first_name` + `from.username` |
| status de entrega | N/A (Telegram no empuja recibos) |

---

## 6. Flujo de un mensaje (paso a paso)

**Entrada:**
1. Telegram hace `POST /api/webhook/telegram` con un update.
2. El handler valida el header `X-Telegram-Bot-Api-Secret-Token`. Si no cuadra -> 403.
3. Inserta el update crudo en `webhook_events` (`provider='telegram'`,
   `provider_event_id=update_id`, `ON CONFLICT DO NOTHING`).
4. Responde **200** de inmediato.
5. Con `after()` procesa:
   a. Si es `/start <guest_id>`: resuelve invitado/evento/workspace y asegura participante + conversacion.
   b. Si es texto normal: busca la conversacion existente por `chat_id`; si no hay binding -> sin clasificar, fin.
   c. Construye el `InboundMessage` y lo pasa al normalizador (guarda el mensaje canonico).

**Cerebro + salida:**
6. Llama a `interpretRSVPMessage` (mismo cerebro que WhatsApp).
7. Si la intencion es clara: actualiza `guests.rsvp_status`, genera la respuesta con `generateAgentReply`.
8. El adaptador OUT envia por Telegram (`sendMessage`) y espeja el `OutboundMessage` al normalizador.

**Coexistencia:** WhatsApp sigue exactamente igual. Telegram es un camino paralelo nuevo.

---

## 7. Conexion del bot (setup que hace Diego, una sola vez)

Credenciales y config de Diego; no las toca Claude.

1. **Crear el bot** en BotFather -> obtener `TELEGRAM_BOT_TOKEN`.
2. **Definir** `TELEGRAM_WEBHOOK_SECRET` (cadena aleatoria propia).
3. **Poner ambas** en `.env.local` y en Vercel (Production).
4. **Registrar el webhook** (una vez), apuntando a `www` por el 307 del apex:
   ```
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -d "url=https://www.anfiora.com/api/webhook/telegram" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
5. **Sembrar el `channel_account`** del bot (un row en `channel_accounts` con
   `channel='telegram'`, `external_account_id=<bot id>`). El adaptador lo asegura solo en el primer
   update (mismo patron `ensure...` del mirror de WA), asi que no requiere paso manual.

---

## 8. Estructura de archivos propuesta

| Archivo | Accion | Responsabilidad |
|---|---|---|
| `lib/omnichannel/store.ts` | Create | Normalizador generico: `ingestInbound(InboundMessage)` + `ingestOutbound(OutboundMessage)`. Agnostico de canal, fallo silencioso, dedupe por `provider_message_id`. |
| `lib/omnichannel/types.ts` | Create | `InboundMessage` / `OutboundMessage` (contrato canonico). |
| `lib/telegram/adapter.ts` | Create | Traduce update de Telegram <-> contrato canonico; envia via `sendMessage`. |
| `lib/telegram/routing.ts` | Create | Ruteo de dominio: `/start <guest_id>` y continuidad por `chat_id` -> evento/workspace. |
| `app/api/webhook/telegram/route.ts` | Create | Webhook: valida secret, aterriza crudo, 200, procesa con `after()`, cerebro, responde. |

Sin cambios en `lib/types.ts`, sin tablas nuevas, sin tocar `app/api/webhook/whatsapp/route.ts`
ni `lib/whatsapp/canonical-mirror.ts`.

---

## 9. Verificacion (sin suite de tests; manual + build)

1. `npm run build` limpio.
2. Diego completa el setup (seccion 7) y crea un invitado de prueba en un evento suyo.
3. Abre `t.me/<bot>?start=<guest_id>` en el celular -> el bot saluda/reconoce.
4. Escribe "si voy" -> `guests.rsvp_status` pasa a `confirmed`, el bot responde.
5. En Supabase: 1 `conversation` de canal `telegram` con sus `messages` inbound/outbound,
   `provider_message_id` = message_id de Telegram, vinculo `tenant_id` + `contact_guest_id` correcto.
6. Repite en laptop (mismo `chat_id` -> misma conversacion, no se duplica).
7. Reenvio forzado de un update (mismo `update_id`) -> no se doble-procesa (dedupe).
8. WhatsApp sigue intacto: una prueba WA continua espejando como antes.

---

## 10. Riesgos y mitigaciones

- **Reintentos de Telegram** (si tardas en responder 200) -> dedupe por `update_id` en `webhook_events`.
- **`after()` falla** -> se pierde ese mensaje (sin sweeper en v2). Aceptado para prueba personal;
  el sweeper es la deuda anotada nro 1.
- **Diseno prematuro del generico** -> mitigado: el contrato se disena contra DOS referencias
  (el mirror WA existente + Telegram), no contra una sola.
- **Romper WhatsApp** -> imposible por construccion: no se toca su codigo; caminos separados.
```
