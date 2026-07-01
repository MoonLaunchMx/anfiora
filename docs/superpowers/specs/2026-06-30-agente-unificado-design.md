# Agente unificado — un solo cerebro sobre la bandeja omnicanal

Fecha: 2026-06-30
Estado: spec en revisión
**Reemplaza:** la spec y el plan de "sub-proyecto B" (`2026-06-30-agente-robusto-B-*`) — esos describían un tercer cerebro en paralelo y quedan obsoletos.
Absorbe: el "sub-proyecto C" (blindaje anti-alucinación) que vivía como pendiente.
Construye sobre: A (PR #6, `feat/agente-robusto-A`).
Relacionado: [[whatsapp-ia-feature]], [[nucleo-omnicanal-spec]], [[agente-omnicanal-no-duplicar]], `feature/whatsapp-ia`.

## Por qué esta spec existe

Aparecieron **tres cerebros de agente para un solo objetivo** (responder a los invitados en la bandeja omnicanal): uno simple en `main`, uno inteligente casi completo en `feature/whatsapp-ia` (sobre rieles viejos, la tabla `wa_messages`), y uno nuevo a medio planear (`lib/agent/*`). Esta spec consolida todo en **un solo cerebro**, montado sobre los rieles de la bandeja omnicanal (tablas canónicas `conversations`/`messages`), reutilizando lo ya hecho y eliminando duplicados. Auditoría que la respalda: revisión de `feature/whatsapp-ia` (30-jun).

## Qué se reutiliza tal cual (≈70% del cerebro inteligente, sin rieles viejos)

Estas piezas de `feature/whatsapp-ia` no dependen de `wa_messages` y se mueven a su nuevo hogar sin cambios de lógica:

- **El pipeline de 5 candados** (`runPipelineOnPack`): puro, recibe un `ContextPack` + el historial como arreglo. Tema sensible → escala / generación grounded / `NO_SE` / self-check con 2ª llamada / compuerta de confianza.
- **`buildContextPack`**: arma el contexto del invitado leyendo `guests`, `events`, `party_members`, `table_seats`, `event_settings`. Cero `wa_messages`.
- **Las 3 funciones LLM** (`generateGroundedReply`, `selfCheckReply`, `distillGuestMemory`): llamadas puras a Haiku, sin tocar la base.
- **Configuración del agente** (`AgentConfig` en `event_settings.agent_config`): tono, firma, modo autónomo/copiloto, FAQ, mensajes de holding/deflect, escalamientos por categoría.
- **Memoria episódica por invitado** (`guests.agent_memory`): ficha blanda destilada tras cada intercambio; blindada (no entra al self-check).
- **El sandbox "prueba tu agente"** (endpoint preview): corre el pipeline sin enviar nada.

## Qué se re-conecta (cirugía localizada, la lógica no cambia)

- **Historial de conversación:** hoy el cerebro lo lee de `wa_messages`; pasa a leerlo de la tabla canónica `messages` (por `conversation_id`). Es **una sola consulta**.
- **Guardas de fiabilidad** (`reliability.ts`): anti-duplicado, "no contestes dos veces" (debounce 17s), ventana de sesión → se re-apuntan a las tablas canónicas (`messages`/`conversations`) en vez de `wa_messages`. La idempotencia ya la da el modelo canónico.
- **Envío saliente:** escribe primero al modelo canónico (la llamada a Twilio/Telegram no cambia).
- **Borradores (modo copiloto):** el concepto "borrador para aprobar" se mueve a `messages` (status draft).

## Qué es nuevo de verdad (no es duplicado)

- **Confirmar acompañantes y capturar alergias estructuradas.** El cerebro hoy **lee** acompañantes y alergias para responder, pero **nunca los escribe**. Esto se agrega como **un paso dentro del único cerebro**: una lectura estructurada (tool-use) + un aplicador determinista y testeable que valida contra los `party_members` reales y aplica las reglas de "no adivinar" (filosofía híbrida c: confirma lo inequívoco, escala lo ambiguo). Toda la lógica de extracción/aplicación de la spec de B se conserva, pero vive **dentro** del cerebro unificado, no como módulo aparte.

## Duplicados que se jubilan (un hogar por concepto)

La auditoría destapó el mismo concepto repetido. Se unifica:

| Concepto | Hogar único (se queda) | Se jubila |
|---|---|---|
| "Algo necesita atención" | `guests.needs_attention` + `attention_reason` (de A, nombre agnóstico de canal) | `guests.wa_needs_human` + `wa_needs_human_reason` (de whatsapp-ia, nombre pegado a WA) |
| "Prender/apagar la IA" (handoff) | `conversations.ai_enabled` (de la bandeja, por conversación, ya vivo) | el handoff por-invitado de whatsapp-ia se pliega a este |
| Idempotencia de mensajes | constraint del modelo canónico (`provider_message_id`) | índice único en `wa_messages.twilio_sid` |
| Asistencia del titular | `guests.rsvp_status` 3 valores (de A) | el `rsvp` de un solo string del pipeline viejo |

## Hogar del código

Un solo lugar para el cerebro: `lib/agent/*` (se consolida ahí lo que hoy está disperso en `lib/whatsapp/{agent,context-pack,config,reliability}.ts` y las funciones de `lib/ai-rsvp.ts`). El módulo `lib/agent/apply.ts` (aplicador de acompañantes/alergias) y la lectura estructurada conviven con el pipeline en ese hogar. Ambos webhooks (Telegram y WhatsApp) llaman al mismo cerebro.

## Estado de SQL (confirmar antes de tocar nada — Claude no toca Supabase)

- **Probablemente ya existen** en la Supabase compartida (corridos en jun por Diego para whatsapp-ia): `event_settings.agent_config`, `guests.agent_memory`, `guests.wa_opt_out/wa_opt_out_at/wa_needs_human/wa_needs_human_reason`, y metadatos en `wa_messages`.
- **Ya existen por A:** `guests.needs_attention/attention_reason`, `party_members.allergies/tags/notes`.
- **Acción:** antes de cualquier fase, Diego confirma qué columnas existen; el plan listará lo que falte (probablemente nada nuevo). Las columnas `wa_needs_human*` se dejan de usar (jubiladas), no se borran.

## Canales: Telegram primero

Telegram **no requiere verificación de Meta** y es el canal de prueba designado. El cerebro unificado se prueba en vivo en Telegram. WhatsApp reutiliza el mismo cerebro y entra cuando Meta libere el número (mismo muro de [[whatsapp-multitenant-plan]]).

## Fases (cada una entrega software probable por sí solo)

1. **Cerebro inteligente sobre rieles nuevos (Telegram).** Portar pipeline + context-pack + grounded reply + self-check + memoria + config al flujo de la bandeja, leyendo historial de `messages`, reconciliando atención → `needs_attention` y handoff → `conversations.ai_enabled`. Resultado: agente que entiende, no inventa y recuerda, respondiendo en Telegram y respetando el handoff. (Aún sin escribir acompañantes/alergias.)
2. **Extracción estructurada (acompañantes + alergias).** Agregar la lectura estructurada + aplicador determinista dentro del cerebro. Aquí aterriza el valor único de B, ya dentro del único cerebro.
3. **Panel de configuración + sandbox.** Portar `AgentePanel` (config, FAQ, sandbox, "gaps") al modelo canónico para que el organizador afine el agente.
4. **WhatsApp.** Cablear el mismo cerebro al webhook de WhatsApp (número compartido / cuando Meta libere). Mayormente reúso de la fase 1.

Cada fase es su propio plan de implementación. Esta spec es el mapa; los planes detallan cada fase.

## Fuera de alcance

- **Masivos / plantillas Meta** (SP2 del agente original) — independiente, bloqueado por Meta.
- **Mapear parentescos "mi esposa" → acompañante específico** — visión "casi humano"; requiere memoria/relaciones; futuro.
- **IG/FB como canales** — Graph API, bloqueado por verificación de Meta.

## Pruebas

- **Lógica pura con Vitest:** el aplicador de acompañantes/alergias (`applyExtraction`), `detectOptOut`, y cualquier regla pura que se extraiga al re-conectar las guardas.
- **I/O (Haiku, webhooks, Supabase):** verificación manual local → preview → prod, con el bot @AnfioraEventosbot y el evento de prueba.

## Riesgos

- **Re-encuadre grande sobre código en producción.** Mitigación: por fases, cada una probable en Telegram (sin Meta), sin tocar el flujo de WhatsApp hasta la fase 4; Sentry entrando en prod como red.
- **El cerebro de whatsapp-ia está sobre rieles viejos.** Mitigación: la auditoría confirmó que el grueso es agnóstico de tabla; el acoplamiento a `wa_messages` es chico y localizado (historial + guardas), no toca la lógica de razonamiento.
- **Reconciliar duplicados sin romper lo vivo.** Mitigación: se elige un hogar por concepto y las columnas viejas se dejan de usar, no se borran; el handoff ya vivo (`ai_enabled`) no se toca, solo se le pliega lo de whatsapp-ia.
