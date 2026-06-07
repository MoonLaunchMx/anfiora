# Spec — Sub-proyecto 1: Agente IA de WhatsApp (cerebro + UI)

Fecha: 2026-06-07
Branch: `feature/whatsapp-ia` (worktree `../anfiora-whatsapp`, desde `main`)
Estado: diseño aprobado en brainstorm, pendiente revisión de Diego.

## 1. Contexto y estado actual

El auto-responder con IA **ya existe y está vivo** en `app/api/webhook/whatsapp/route.ts`:
recibe el mensaje de Twilio, valida firma, interpreta intent (`interpretRSVPMessage`),
genera respuesta (`generateAgentReply`) y la envía. Toda la conversación vive en `wa_messages`.

Lo que **falta** y construye este sub-proyecto es robustez y control sobre ese agente:
mundo cerrado anti-alucinación, on/off + calibración por evento, base de conocimiento
(FAQ), handoff a humano, manejo de la ventana de 24h y opt-out, y la UI para todo eso.

Los **masivos** (envío a muchos invitados con plantillas aprobadas por Meta) son el
**Sub-proyecto 2** — explícitamente fuera de este spec (ver §11).

## 2. Objetivos

1. El agente responde **solo con datos del evento**; nunca inventa ("no delira").
2. El organizador puede **prender/apagar** el agente y **calibrarlo** por evento.
3. Cuando el agente no sabe o el tema es sensible, **no improvisa**: escala a humano
   con un mensaje de espera ("holding") y un aviso visible.
4. Base de conocimiento **auto + manual + bucle de mejora** (estándar Intercom/Zendesk).
5. **Cero infra nueva** y **cero tablas nuevas**: solo columnas y un JSONB de config.
   La plomería de confiabilidad queda detrás de interfaces swap-ables a Redis a futuro.

## 3. No-objetivos (para que nadie se desvíe)

- ❌ "Mini ChatGPT abierto" (recomendar hoteles, regalos, temas fuera del evento).
- ❌ RAG vectorial / embeddings / vector DB. El conocimiento de un evento cabe en el prompt.
- ❌ Redis / colas externas en esta entrega (se diseñan interfaces para meterlo después sin rewrite).
- ❌ Masivos / plantillas Meta (Sub-proyecto 2).
- ❌ Notificación por correo del handoff (futuro; v1 usa badge en el hub).

## 4. Arquitectura del cerebro

### 4.1 Context Pack (única fuente de verdad)

Función `buildContextPack(guestId)` que ensambla, en runtime, todo lo que el agente puede saber:

```
events     → nombre, tipo, fecha, hora, venue, dirección, host_name(s)
guests     → este invitado: nombre, rsvp_status, side, party_size, allergies
table_seats→ su mesa asignada (si existe)
event_settings.agent_config → FAQ (Q&A), persona/tono, firma
```

Es pequeño (~1.5–3k tokens), se inyecta entero en el system prompt con
`cache_control: ephemeral` (ya se usa). No hay retrieval: **grounding completo > RAG** a esta escala.

### 4.2 Pipeline anti-delirio (5 candados)

Por cada mensaje entrante, en orden:

1. **Tema sensible → escala siempre.** Alergias/restricciones, quejas, dinero, cambios de
   número de invitados. Detectado por el clasificador (`accion_necesaria` ya cubre alergias/quejas)
   más una lista configurable. No se responde con IA; se guarda el dato (ej. alergia) y se hace handoff.
2. **Context Pack.** Se arma el pack (§4.1). Es lo único que el modelo puede citar.
3. **Generación aterrizada (mundo cerrado).** El prompt obliga: responde **solo** con el pack,
   o devuelve el sentinel `NO_SE`. Si es `NO_SE` → handoff.
4. **Self-check (verificación).** Segunda llamada barata a Haiku:
   *"¿cada afirmación de esta respuesta se apoya 100% en el contexto? sí/no"*.
   Si **no** → se descarta la respuesta y se usa el holding + handoff. Esta es la red que
   atrapa la alucinación aunque el candado #3 se resbale.
5. **Compuerta de confianza + handoff.** Confianza alta y respuesta verificada → se envía.
   Baja / `NO_SE` / sensible → se envía un **holding** ("déjame confirmarlo y te aviso") y se
   marca la conversación como *necesita humano*.

Cada Q&A (incluidas las `NO_SE`) se registra; las no respondidas alimentan la lista de gaps (§7).

### 4.3 Interfaces swap-ables (el seguro anti-mudanza)

Toda la plomería de confiabilidad vive detrás de 3 funciones. El webhook y el cerebro
**solo las llaman**, nunca tocan su implementación. Hoy corren con Postgres; a futuro su
interior puede pasar a Redis sin tocar el resto.

```ts
isDuplicate(twilioSid): Promise<boolean>          // idempotencia (Twilio reintenta)
claimInboundForReply(guestId): Promise<boolean>   // debounce esperar-y-verificar
enqueueOutbound(payload): Promise<void>           // hoy: envía directo; mañana: cola
```

**Debounce "esperar-y-verificar"** (sin tabla, sin Redis): al entrar un mensaje se guarda,
se espera ~10s (las funciones de Vercel viven hasta 300s), y se verifica si llegó uno más
nuevo para ese invitado. Si sí, esta ejecución se calla; si no, se lee **toda la ráfaga junta**
y se genera **una** respuesta coherente. Resuelve el caso
`hola… bien y tú… no podré… perdón, sí voy` con una sola respuesta al estado final.

## 5. Comportamiento y calibración

- **Master on/off** por evento. Apagado = el webhook solo registra y actualiza RSVP, no responde.
- **Modo:**
  - `autonomo` (default): aplica el pipeline §4.2; responde solo cuando pasa los candados.
  - `copiloto`: genera un **borrador** pero NO lo envía; queda pendiente de aprobación del
    organizador (un clic envía). El borrador se guarda como fila en `wa_messages` con `status='draft'`.
- **Temas que siempre escalan** (toggles): alergias/restricciones, quejas, cambios de # de
  invitados, "lo que no esté en mi info". Configurable.
- **Tono** (`calido` | `formal`) y **firma** (ej. "Los novios").
- **Default seguro:** un evento sin `agent_config` arranca **apagado** (no responde sin querer).
  Cuando el organizador entra al tab y lo enciende, el **preset recomendado** es modo `autonomo`
  con los 4 temas sensibles activos. Es decir: off de fábrica, autónomo al activarlo.

## 6. Datos / cambios de schema (cero tablas nuevas)

Diego corre el SQL. El código se pushea **antes** de aplicar SQL (regla sincronía Supabase↔Vercel).

**`event_settings`** — nueva columna:
- `agent_config JSONB` — toda la config del agente:
  ```jsonc
  {
    "enabled": true,
    "mode": "autonomo",            // "autonomo" | "copiloto"
    "tone": "calido",              // "calido" | "formal"
    "signature": "Los novios",
    "escalate": { "alergias": true, "quejas": true, "cambios_invitados": true, "fuera_de_info": true },
    "faq": [ { "q": "¿Hay estacionamiento?", "a": "Valet sin costo en el venue." } ]
  }
  ```

**`guests`** — nuevas columnas:
- `wa_opt_out BOOLEAN DEFAULT false`
- `wa_opt_out_at TIMESTAMPTZ`
- `wa_needs_human BOOLEAN DEFAULT false`   — bandera de handoff (conversación = invitado)
- `wa_needs_human_reason TEXT`             — ej. "no_se", "alergia", "queja"

**`wa_messages`** — nuevas columnas:
- `twilio_sid TEXT` (índice UNIQUE parcial) — idempotencia
- `status TEXT` — estado de entrega Twilio ("queued"|"sent"|"delivered"|"read"|"failed"|"draft")
- `author TEXT` — para mensajes salientes: `"ia"` | `"human"` (los entrantes quedan null)

Tipos en `lib/types.ts`: extender `EventSettings`, `Guest`, `WaMessage` (verificar que no
rompa páginas que los consumen — regla CLAUDE.md).

## 7. UI — tab "Agente" en `/events/[id]/mensajes`

Co-locado con las conversaciones (un solo lugar mental). Contenido:

- **Master switch** Agente IA [on/off].
- **Modo** (autónomo / copiloto), **temas sensibles** (toggles), **tono** y **firma**.
- **Base de conocimiento (FAQ):** lista editable de Q&A. Arriba, un bloque de solo-lectura
  "lo que ya sé de tu evento" (auto: fecha, venue, mesa…) para que el organizador vea que
  no tiene que reescribirlo.
- **Sandbox "prueba tu agente":** chat de prueba que corre el mismo pipeline sin enviar a
  WhatsApp, para validar respuestas antes de soltarlo.
- **Gaps "preguntas que no supe responder":** lista alimentada por las `NO_SE`, con botón
  "agregar a FAQ" (bucle de mejora).
- En el **hub de mensajes:** las conversaciones con `wa_needs_human=true` se resaltan con un
  **badge** ("necesita tu atención"); en modo copiloto, los borradores muestran botón
  "Aprobar y enviar".

Estilo: Tailwind, flat, acentos en español, sin emojis, CTA teal `#48C9B0`, negro `#1D1E20`
solo en filtros. Reusa patrones del hub actual.

## 8. Compliance WhatsApp

- **Opt-out:** detectar `STOP`/`BAJA`/`CANCELAR`/`NO MOLESTAR` (es/en) en mensajes entrantes →
  `wa_opt_out=true`, confirmar la baja una vez, y **bloquear todo envío** a ese invitado en
  `enqueueOutbound`. Requisito legal y de calidad del número.
- **Ventana de 24h:** helper `isWithinSession(guestId)` derivado del último entrante en
  `wa_messages`. Dentro de 24h → texto libre permitido (el agente). Fuera de 24h → solo
  plantilla aprobada (eso es Sub-proyecto 2; en v1, fuera de ventana **no** se envía texto libre).
- **Calidad del número compartido:** opt-out impecable + no responder fuera de ventana protegen
  el rating del número compartido de Anfiora (un evento no puede quemar el canal de todos).

## 9. Flujo del webhook (secuencia objetivo)

```
POST /api/webhook/whatsapp
  1. valida firma Twilio
  2. isDuplicate(twilio_sid)? → sí: 200 y salir
  3. busca guest por phone → no existe: 200 y salir
  4. ¿es STOP/BAJA? → marca opt-out, confirma, 200 y salir
  5. guarda entrante en wa_messages (con twilio_sid)
  6. agente apagado (agent_config.enabled=false)? → solo actualiza RSVP, 200 y salir
  7. claimInboundForReply(guest) (debounce ~10s) → no soy el último: 200 y salir
  8. interpreta intent → si sensible: guarda dato + handoff + holding, 200
  9. buildContextPack → genera respuesta grounded (o NO_SE)
 10. self-check → si no pasa: holding + handoff
 11. modo copiloto? → guarda draft (no envía) + handoff; autónomo → enqueueOutbound
 12. registra saliente (author='ia') + estado, 200
```

## 10. Manejo de errores

- Cualquier excepción en el webhook → responde TwiML vacío 200 (no reintentos de Twilio que
  dupliquen). Ya es el patrón actual; se conserva.
- Falla de Twilio al enviar → se loguea, el saliente queda `status='failed'`, no se rompe el flujo.
- `agent_config` ausente → defaults seguros (tratar como `enabled=false` hasta que el organizador
  lo configure, para no responder sin querer).
- Self-check que falla por error de API → se trata como "no pasó" (conservador: holding + handoff).

## 11. Sub-proyecto 2 (fuera de alcance, referencia)

Masivos: librería de plantillas aprobadas por Meta, selector de destinatarios, envío por lotes
(aquí `enqueueOutbound` respalda en una cola real — posible tabla `wa_outbound` o Redis),
rate-limiting por tier de Meta, tracking de campaña. Depende de tiempos de aprobación de Meta,
por eso va después: el agente (Sub-proyecto 1) se construye y prueba sin esperar a Meta.

## 12. Verificación y entrega

- **Local primero:** `npm run build` / `tsc` limpio; probar en `localhost:3000` (NO 3001).
  Sandbox del agente para validar el anti-delirio con los mini-casos (§4.2).
- **Preview:** push a `feature/whatsapp-ia` → preview de Vercel → probar webhook real de Twilio.
- **Merge:** solo con OK explícito de Diego. SQL en Supabase se aplica con el código ya pusheado.
- No hay test suite (CLAUDE.md); la verificación es build + prueba manual.

## 13. Riesgos

- **Latencia del debounce** (~10s antes de responder): aceptable para chat; configurable.
- **Costo de la 2ª llamada (self-check):** Haiku es barato y con cache; se mide en preview.
- **`lib/types.ts`:** cambiar tipos compartidos puede romper páginas; revisar consumidores antes.
- **Defaults seguros:** si el agente queda `enabled` sin FAQ, responderá muchas `NO_SE`; por eso
  el default real es pedir configuración mínima antes de encender en producción.
