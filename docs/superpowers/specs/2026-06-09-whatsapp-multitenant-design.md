# ANF-048 — WhatsApp multi-tenant (Twilio Tech Provider) — Design Spec

**Fecha:** 2026-06-09
**Branch:** `feature/ANF-048-whatsapp-multitenant` (desde `feature/whatsapp-ia`)
**Continua:** el agente IA de `feature/whatsapp-ia` (cerebro ya hecho, agnostico al canal)

---

## 1. Objetivo

Migrar WhatsApp de **single-tenant** (un numero global `TWILIO_WHATSAPP_FROM`) a **multi-tenant via Twilio Tech Provider Program**, donde:

- Cada planner conecta SU PROPIA **linea dedicada** via Embedded Signup.
- Anfiora envia **desde el numero del planner**.
- El inbound se **rutea al evento/planner correcto**.
- Se **mide consumo por planner y por categoria** de mensaje.

## 2. Que es la "linea dedicada" (y por que NO coexistence)

La linea dedicada es una **linea de negocio aparte** que el planner trae (chip/eSIM solo para eventos), **NO su numero personal**. Se registra de forma **clasica** (el registro saca el numero de la app de WhatsApp). Vive en Anfiora (Cloud API / sender de Twilio); el planner responde desde el **hub de mensajes de Anfiora**, no desde la app de WhatsApp en su celular. Anfiora **no provisiona** el numero, el planner lo trae.

**Coexistence fue descartado a proposito.** Mantiene el numero PERSONAL del planner en juego (el que usa con proveedores), lo que implica: el agente IA contestando a proveedores, problema de privacidad, y el quality rating personal arrastrando el envio. La linea dedicada elimina los tres problemas. **No reconsiderar coexistence.**

## 3. Alcance "ahorita" vs go-live

- Construir la **arquitectura multi-tenant completa** desde el inicio, corriendo en **dev mode** con SOLO el numero de Diego conectado.
- El **self-serve publico** (cualquier planner) se abre en **go-live**, que espera **app review de Meta** + **gate de pago**.
- Codigo multi-tenant ya; **acceso gateado**.
- **Dependencia de corto plazo** para probar Fases 3-4 en dev mode: ticket de **Twilio Partner Solution** (1-2 dias habiles) + setup de la **Meta App**. NO requiere app review completo (eso es solo para el publico).
- **Target:** ~30-jun-2026 (3 semanas) con el end-to-end funcionando en dev mode.

## 4. Estado del codigo (verificado)

- **Outbound:** chokepoint unico `enqueueOutbound` (`lib/whatsapp/reliability.ts`), con Twilio hardcodeado inline (lineas ~89-114: `fetch` a `api.twilio.com/.../Messages.json`). Usa `TWILIO_WHATSAPP_FROM` global.
- **Inbound:** webhook pegado a Twilio en el borde (`app/api/webhook/whatsapp/route.ts`): `validateRequest` de firma, params `Body`/`From`/`MessageSid`, responde TwiML `<Response/>`.
- **Cerebro (agnostico, se reusa tal cual):** `getAgentConfig`, `claimInboundForReply`, `runAgentPipeline`, `enqueueOutbound`. NO se toca.

## 5. Decisiones de arquitectura horneadas

- **Credenciales de sender a nivel PLANNER (`users`)**, no por evento. Un planner = una linea para todos sus eventos.
- **Subaccount de Twilio por planner** (aisla quality rating). **No guardar tokens crudos** por planner: la cuenta maestra envia a nombre del subaccount; se guarda `subaccount_sid` + sender, no el token.
- **Ruteo inbound por numero destino (`To`)** -> planner -> invitado por `From` entre sus eventos. Keyword/deep-link desambigua si el mismo telefono esta en 2 eventos del mismo planner.
- **`from` entra en la firma de `enqueueOutbound` desde Fase 1** (default = env global). El "puro cableado" aplica a la **resolucion de credenciales** (`getSenderForEvent`), NO a `transport.ts`: con subaccount por planner cambia el **Account SID en la URL y el auth** (mandas a nombre del subaccount), y en Fase 3 la **Senders API** probablemente mueve el envio a un Messaging Service / sender registrado, no a `Messages.json` crudo. Por eso `transport.ts` recibe una **edicion real en Fase 2/3**, no solo wiring.
- **No ensanchar `SendParams` de forma especulativa.** La forma exacta que pide la Senders API aun no se conoce; meter campos adivinados seria over-engineering. El "sender context" (`from` + `accountSid`/subaccount + auth-ref) se define **cuando se cablee el flujo real de subaccounts**, no antes.
- **Cero tablas nuevas.** Solo columnas aditivas nullable en `users`, `wa_messages`, `event_settings`.
- El `transport.ts` queda como interfaz por si algun dia se migra a Meta directo; **no es objetivo ahora**.

## 6. Principios de costo y mensajeria (criticos)

- Toda **apertura** (Save the Date, primer RSVP) es iniciada por el negocio = **plantilla PAGADA**. La ventana de 24h gratis SOLO abre cuando el invitado escribe primero.
- La **categoria (marketing/utility/auth) la decide META** por contenido, no nosotros. Save the Date tiende a marketing. No asumir utility.
- **Maximizar entradas iniciadas por el invitado** (QR/link en la invitacion) para caer en ventana de servicio gratis y que todo el flujo RSVP (alergias, party size, logistica) sea gratis dentro de las 24h.
- **Plantillas BLOQUEADAS:** el planner solo edita variables (`{nombre}`, `{fecha}`, `{link}`); el body es fijo. Preserva la aprobacion y evita reclasificacion sorpresa.
- El **metering registra categoria por mensaje**, para ver margen real por planner y detectar reclasificaciones de Meta.

## 7. Plan por fases

### Fase 1 — Extraer `transport.send()` + aislar Twilio (behavior-preserving)
- **Nuevos:** `lib/whatsapp/transport.ts` — interfaz `WhatsAppTransport { send({ to, body, from }) }` + impl `twilioTransport` (lineas 89-114 reubicadas, identicas).
- **Modificados:** `lib/whatsapp/reliability.ts` — `enqueueOutbound` recibe `from` opcional en `OutboundPayload` (default = `TWILIO_WHATSAPP_FROM`) y delega a `transport.send`. Guard de opt-out e insert a `wa_messages` igual. Callers NO cambian (default preserva comportamiento).
- **Riesgo:** Bajo. Refactor sin cambio de comportamiento. Verificar con `npx tsc --noEmit` + sandbox.
- **DB:** Ninguno.

### Fase 2 — Credenciales multi-tenant por planner
- **DB (aditivo nullable en `users`):** `wa_sender_phone`, `wa_phone_number_id`, `wa_waba_id`, `wa_subaccount_sid`, `wa_sender_status` ('pending'|'connected'|'disconnected'|'error'), `wa_connected_at`. Inerte en prod.
- **Nuevos:** `lib/whatsapp/sender.ts` — `getSenderForEvent(eventId)` -> planner dueno -> linea/creds. Fuente unica.
- **Modificados:** `reliability.ts` resuelve `from` via `getSenderForEvent` (fallback al env global si no hay sender, para dev); `lib/types.ts` agrega los campos al tipo `User`.
- **Riesgo:** Medio. `from` dinamico; clave el fallback. Modelo subaccount: guardar `subaccount_sid` + sender, no tokens.
- **Calibracion `transport.ts`:** aqui (o en Fase 3) `transport.ts` deja de usar las creds maestras del env: el envio pasa a usar el `accountSid`/subaccount y auth del sender resuelto. La firma de `send` evoluciona de `{ to, body, from }` a un "sender context"; se define al cablear subaccounts, no antes.
- **DB:** Aditivo nullable.

### Fase 3 — UI Embedded Signup "Conectar WhatsApp" (mockup antes de codear)
- **Nuevos:** UI de conexion a nivel planner (ubicacion a decidir con mockup: `/perfil` o `/configuracion/whatsapp`); `app/api/whatsapp/connect/route.ts` (intercambia token, registra sender via Twilio Senders API bajo el subaccount del planner, escribe creds Fase 2).
- **Env nuevas:** `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID` (+ Twilio ISV).
- **Riesgo:** Alto. Integracion externa (popup OAuth, Senders API); depende del ticket Partner Solution + Meta App. Probable en dev mode con numero de Diego + testers.
- **DB:** Ninguno nuevo (usa columnas Fase 2).

### Fase 4 — Entrada del invitado (QR/deep link) + ruteo inbound
- **Nuevos:** `lib/whatsapp/deeplink.ts` (`wa.me/<linea>?text=<prellenado>` por evento); `lib/whatsapp/routing.ts` (`resolveInbound({ to, from, text })` -> { planner, event, guest }, keyword desambigua); UI de QR + link por evento (reusar `qrcode.react`).
- **Modificados:** `app/api/webhook/whatsapp/route.ts` — leer `To`, rutear via `routing.ts`, luego `runAgentPipeline` igual. Firma respeta el auth token correcto (subaccount).
- **Riesgo:** Medio-Alto. Correctness de ruteo (mismo telefono en 2 eventos del planner); webhook multi-tenant.
- **DB:** Ninguno nuevo. Opcional aditivo: `event_settings.wa_inbound_keyword` nullable.

### Fase 5 — Metering por planner Y por categoria
- **DB (aditivo nullable en `wa_messages`):** `category` ('marketing'|'utility'|'authentication'|'service'), `billable`, `in_service_window`, `price`, `price_unit`. `user_id` por mensaje es derivable via evento->planner; NO denormalizar salvo que el rollup lo pida.
- **Nuevos:** `app/api/whatsapp/status/route.ts` (status callback de Twilio -> `status` + `price`/`price_unit` + categoria si Twilio la expone); `lib/whatsapp/metering.ts` (rollups por planner + categoria).
- **Modificados:** `reliability.ts` — el send agrega `StatusCallback`; el insert pone `in_service_window` (de `isWithinSession` al enviar) + categoria tentativa.
- **Deteccion de reclasificacion de Meta:** la senal mas fiel es el **precio del callback divergiendo de la tarifa esperada de la categoria**. El rollup compara **esperado vs real**, no solo registra la categoria tentativa.
- **Riesgo:** Medio. Callbacks asincronos; `price` puede llegar tarde/faltar en dev.
- **DB:** Aditivo nullable.

### Fase 6 — Librería de plantillas pre-aprobadas y BLOQUEADAS (bodas primero)
- **Nuevos:** `lib/whatsapp/templates.ts` — definiciones por tipo. Bodas: apertura RSVP (redaccion lo mas transaccional posible apuntando a utility, **presupuestada como marketing y monitoreada**), recordatorio a confirmados (utility), Save the Date (opcional/marketing).
- **Modificados:** `app/events/[id]/mensajes/page.tsx` — extender pestana Plantillas (ya existe) para editar solo variables; body bloqueado.
- **DB (aditivo en `event_settings`):** mapeo de template aprobado + valores de variables por evento (extender JSONB existente o columna nullable).
- **Riesgo:** Medio. Aprobacion de plantillas con Meta + mapear template IDs.

## 8. Resumen de cambios de DB (todos aditivos nullable)

| Fase | Tabla | Tipo |
|---|---|---|
| 1 | — | ninguno |
| 2 | `users` (+6) | aditivo nullable |
| 3 | — | usa Fase 2 |
| 4 | `event_settings` (opcional +1) | aditivo nullable |
| 5 | `wa_messages` (+5) | aditivo nullable |
| 6 | `event_settings` (JSONB/+1) | aditivo |

## 9. Backlog (NO construir aun)

- **Monitoreo de quality rating / messaging tier por planner:** numero nuevo arranca en tier bajo; vigilar ANTES de dejar que un planner blastee masivos.
- **Cap de 2 numeros** del portafolio nuevo lo levanta el enrolamiento Tech Provider.
- **Opt-out por linea de planner**, no global (hoy `wa_opt_out` es por invitado/global).
- (Fase 5) Comparacion esperado-vs-real para deteccion de reclasificacion (ya incorporado al diseno de Fase 5).

## 10. Restricciones de proceso

- Spec primero; implementar **solo Fase 1** tras aprobacion.
- Un paso a la vez; archivos completos, nunca fragmentos.
- Nada de Supabase sin el codigo correspondiente ya en main.
- Sin tablas nuevas (ya hay 17): extender existentes con columnas aditivas nullable.
- Pedir permiso antes de cualquier comando o instalacion. Commits en ingles, sin acentos.
- SQL lo corre Diego.
