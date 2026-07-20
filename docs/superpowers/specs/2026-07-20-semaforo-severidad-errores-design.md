# Semáforo de severidad para errores (Sentry → Telegram)

**Fecha:** 2026-07-20
**Estado:** Diseño aprobado, pendiente plan de implementación

## Problema

Los reportes de error que llegan a Telegram (relay Sentry existente) no distinguen
gravedad: un error que deja la pantalla en blanco al invitado y un adorno que truena
llegan igual. No hay forma de saber la urgencia de un vistazo, y las fallas
"silenciosas" (un `catch` que muestra un toast) ni siquiera llegan a Sentry.

## Objetivo

Clasificar cada error por severidad y reflejarlo en el aviso a Telegram:
- 🔴🚨 **Pantalla en blanco** — la app se le rompió al usuario. Vibra, va primero.
- 🔴 **Error** — cualquier otro error real. Vibra.
- 🟡 **Cosmético** — adorno aislado que truena. Llega **silencioso** (sin sonido ni vibración).

Además, cada aviso muestra la **zona** donde ocurrió (invitación pública, planner, etc.)
como contexto, no como criterio de prioridad.

## Modelo de severidad (decidido con el usuario)

Mezcla de dos señales:
1. **Estructural (automática):** ¿se rompió la pantalla del usuario? Si una red de
   seguridad (error boundary) atrapa un crash de render → alta prioridad.
2. **Zona de negocio:** el usuario marcó **toda la app como crítica**. Por lo tanto,
   en la práctica **todo error no atrapado avisa 🔴**, excepto una lista corta de
   adornos cosméticos que avisan 🟡 silencioso.

Consecuencia de diseño: no hace falta un mapa de zonas para *decidir* prioridad
(todo es crítico). La zona se usa solo como **etiqueta de contexto** en el mensaje.

### Zona cosmética (nunca urgente)
Componentes reales, montados en el layout raíz:
- `InstallPrompt` (banner de instalar la PWA)
- `PostHogProvider` (analytics)
- `AttributionCapture` (atribución de marketing)

`FeedbackModal` **no** es cosmético (es un canal real de soporte). El antiguo widget
de Tally ya no existe. `WhatsNewModal` no se monta en el layout raíz, no aplica.

## Lo que ya existe (no se construye)

- `app/global-error.tsx` — error boundary de toda la app. Como no hay `error.tsx`
  por ruta, **cualquier página que truene cae aquí**. Ya reporta a Sentry vía
  `captureException`, pero sin etiqueta de severidad.
- `app/components/invitacion/PreviewBoundary.tsx` — class component error boundary
  (patrón a reutilizar). Hoy solo muestra fallback, no reporta a Sentry.
- El SDK de Sentry ya **auto-captura** todos los errores no atrapados (default).
- El relay a Telegram ya existe: `lib/sentry-alerts/format.ts`, `send.ts`,
  `app/api/webhook/sentry/route.ts` (verifica firma HMAC, filtra a producción).

## Arquitectura

### Fase 1 — Semáforo estructural (sobre lo que Sentry ya ve)

**1. Marcar la pantalla rota.**
En `global-error.tsx`, al capturar, se fija nivel `fatal` y una etiqueta
`impact: pantalla-rota`:
```ts
Sentry.captureException(error, { level: "fatal", tags: { impact: "pantalla-rota" } })
```

**2. Cerca cosmética reutilizable.**
Nuevo `app/components/CosmeticBoundary.tsx` — class component (patrón de
PreviewBoundary) que, al atrapar un error:
- renderiza un fallback nulo o mínimo (el adorno simplemente desaparece),
- reporta a Sentry con `Sentry.captureException(error, { level: "warning", tags: { severity: "cosmetico", zona } })`.
Recibe una prop `zona` (string) para etiquetar de dónde viene.
Se envuelven en el layout: `InstallPrompt`, `PostHogProvider`, `AttributionCapture`.

**3. Etiqueta de zona automática.**
En `instrumentation-client.ts` (o `lib/sentry/config.ts`), un `beforeSend` que deriva
la `zona` desde `window.location.pathname` y la añade como tag, salvo que el evento
ya traiga una zona (la del CosmeticBoundary gana). Función pura `zonaDesdePath(path)`:
- `/invitacion`, `/mesa`, `/playlist/` → `invitacion-publica`
- `/events`, `/dashboard`, `/perfil`, `/admin` → `planner`
- resto → `general`

(Los prefijos exactos se confirman en el plan contra las rutas reales.)

**4. Relay Telegram enriquecido.**
- `format.ts`: `parseSentryWebhook` extiende la extracción para leer los tags del
  payload (`severity`, `impact`, `zona`). Nueva función pura que mapea a
  `{ emoji, etiqueta, silent }`:
  - `impact = pantalla-rota` o `level = fatal` → `🔴🚨 PANTALLA EN BLANCO`, `silent=false`
  - `severity = cosmetico` → `🟡 Cosmético`, `silent=true`
  - default → `🔴 Error`, `silent=false`
  `formatTelegramMessage` antepone el emoji/etiqueta y agrega la línea `Zona: <zona>`.
- `send.ts`: acepta `disable_notification` y lo pasa a la API de Telegram.
- `webhook/route.ts`: pasa el flag `silent` de `format` a `send`.

### Fase 2 — Fallas silenciosas (solo flujos críticos)

Hoy los errores atrapados en `catch` no llegan a Sentry (solo hay 2 `captureException`
en toda la app). Para que las fallas de los flujos críticos también avisen:

**5. Helper de reporte.**
Nuevo `lib/observabilidad/report.ts`:
```ts
export function reportError(error: unknown, opts: { zona: string; severity?: string }): void
```
Envuelve `Sentry.captureException` fijando tags `zona` y `severity` (default `error`).
Falla en silencio si Sentry no está activo (mismo criterio que el resto).

**6. Instrumentar los catch.** Solo estos flujos:
- **Confirmar RSVP** en la invitación pública (`/invitacion/[slug]/[token]`).
- **Puerta / cobro** — registro/confirmación pública (la que usa `lib/puerta.ts`).
- **Guardar invitado** en la lista del planner (`/events/[id]`): crear, editar,
  borrar, acompañantes, import CSV.

En cada `catch` de guardado de esos flujos se agrega `reportError(err, { zona })`
sin cambiar el manejo visible existente (el toast sigue igual).

## Interfaces / unidades

| Unidad | Qué hace | Depende de |
|---|---|---|
| `zonaDesdePath(path)` | pura: URL → zona | nada (testeable) |
| `severidadDesdeAlerta(alert)` | pura: tags/level → {emoji, etiqueta, silent} | nada (testeable) |
| `CosmeticBoundary` | aísla + reporta un adorno | Sentry |
| `reportError(err, opts)` | reporta un catch con tags | Sentry, config |
| `format.ts` / `send.ts` / webhook | relay a Telegram con prioridad | Telegram API |

## Testing

Vitest (lógica pura):
- `zonaDesdePath`: cada prefijo de ruta → zona esperada; ruta desconocida → `general`.
- `severidadDesdeAlerta`: pantalla-rota → 🔴🚨 no-silent; cosmético → 🟡 silent;
  default → 🔴 no-silent.

Manual (flujo local → preview → prod):
- Boundaries (cosmético y global) y envío real a Telegram, incluido el flag silencioso.
- Verificación end-to-end de que los tags viajan del cliente al webhook.

## Fuera de alcance (YAGNI)

- `error.tsx` por ruta (segmentar "esta sección se rompió pero el nav sigue"): no hace
  falta mientras todo sea crítico; `global-error` cubre el caso.
- Zonas como criterio de prioridad (hoy solo contexto).
- Canal de Telegram separado para baja prioridad (se decidió silencioso en el mismo chat).
- Instrumentar todos los `catch` de la app (solo los 3 flujos críticos).

## Riesgos

- **Fatiga de alertas:** con todo en 🔴, al crecer el tráfico el volumen puede subir.
  Aceptado a la escala actual; revisitar si molesta.
- **Tags en el payload del webhook:** confirmar que los tags del cliente llegan al
  webhook `issue.created` de Sentry; `parseSentryWebhook` debe leerlos defensivamente.
- **Fase 2 toca flujos en producción:** los cambios son aditivos (solo agregan
  `reportError` en catch existentes), sin alterar el manejo visible.
