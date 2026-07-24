# Agente robusto — Sub-proyecto A: modelo de datos (asistencia vs atención)

Fecha: 2026-06-30
Estado: spec en revisión
Relacionado: `docs/superpowers/specs/2026-06-29-inbox-omnicanal-ui-design.md`, rama diferida `feature/whatsapp-ia` (pipeline anti-alucinación, sub-proyecto C).

## Contexto

El agente de WhatsApp/Telegram hoy contesta, suena bien, pero **miente y no persiste**. La causa raíz no es el prompt: es el **modelo de datos**. Ambos webhooks (`app/api/webhook/whatsapp/route.ts`, `app/api/webhook/telegram/route.ts`) clasifican el mensaje en 1 de 6 intents (`lib/ai-rsvp.ts` → `interpretRSVPMessage`) y escriben ese intent crudo en el único campo `guests.rsvp_status`. Ese campo mezcla dos preguntas independientes:

1. **¿Viene?** (asistencia)
2. **¿El organizador debe atender algo?** (atención / servicio)

El clasificador desempata `accion_necesaria > confirmed/declined > respondio`. Resultado real:

> Invitado: *"¡Sí vamos los 3! Soy alérgico a mariscos"*
> → clasifica `accion_necesaria` → `rsvp_status = accion_necesaria` → **se pierde el `confirmed`**. La alergia no se guarda en ningún lado. El agente dice "le paso la info al organizador" pero no se la pasa a nada.

Este sub-proyecto (A) arregla **solo el cimiento de datos**. No toca el cerebro del agente (C) ni la extracción estructurada que llena los datos (B); esos se apoyan sobre este modelo.

## Decisión central: dos capas independientes

- **Capa 1 — Asistencia.** Lo único que cuenta para los conteos "¿cuántos vienen?". Valores conceptuales: `pending` · `confirmed` · `declined`.
- **Capa 2 — Atención / conversación.** El servicio al cliente: alergias, peticiones de acompañantes, quejas, dudas. **Independiente** de la capa 1.

Invariante nuevo: un invitado puede estar `confirmed` (capa 1) **y** con atención pendiente (capa 2) **al mismo tiempo**. Hoy es imposible y ése es el bug.

## Cambios de esquema (todos aditivos, un solo pase SQL que corre Diego)

No se toca el CHECK constraint de `rsvp_status` (el mismo que mordió la sesión pasada al rechazar valores con el webhook tragándose el error). Queda permisivo con sus 6 valores. El cambio de capa 1 es de **comportamiento en código**, no de DDL.

```sql
-- Capa 2: atención sobre el invitado
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attention_reason TEXT;   -- 'alergia' | 'peticion' | 'queja' | 'duda' | 'otro' | NULL

-- Paridad de acompañantes con invitados (preparación para sub-proyecto B)
ALTER TABLE party_members
  ADD COLUMN IF NOT EXISTS allergies JSONB,
  ADD COLUMN IF NOT EXISTS tags JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT;
```

Razones de diseño:
- **Bandera + razón** (no un enum `attention_status`): el inbox filtra y pone badge por el boolean (rápido); `attention_reason` da el porqué; "resolver" = apagar el boolean. Simple y suficiente.
- **`party_members` gana columnas, no se fusiona con `guests`.** Mismo shape que `guests` (`allergies`/`tags` JSONB, `notes` TEXT) → los mismos componentes y helpers sirven para titular y acompañante. La fusión a una sola tabla "personas" se descarta ahora (toca lista, mesas, `table_seats`, `party_size`, RPC de conteo, CSV, audit, agente = romper el corazón). Se reconsidera cuando un acompañante necesite hablar/sentarse/confirmar por su cuenta.

## Cambios de tipos (`lib/types.ts`)

```ts
export type AttentionReason = 'alergia' | 'peticion' | 'queja' | 'duda' | 'otro'

export type Guest = {
  // ...campos actuales...
  needs_attention?: boolean
  attention_reason?: AttentionReason | null
}

export type PartyMember = {
  // ...campos actuales...
  allergies?: string[]
  tags?: string[]
  notes?: string | null
}
```

`RsvpStatus` **no cambia** (sigue con los 6 valores, sin migración destructiva). Cumple la regla de CLAUDE.md de confirmar compatibilidad antes de tocar `lib/types.ts`: estos campos son aditivos y opcionales, no rompen ningún consumidor.

## Cambios de comportamiento (lógica de escritura)

Regla nueva, idéntica en ambos webhooks (la lógica compartida es deseada — el cerebro es agnóstico de canal):

- Intents de **asistencia** (`confirmed`, `declined`) → escriben `rsvp_status`. `pending` es el default de fábrica.
- Intents de **atención** (`accion_necesaria`, y `respondio` cuando aplique) → setean `needs_attention = true` + `attention_reason`, **sin pisar** `rsvp_status`.
- El agente **deja de escribir** los valores legacy `mensaje_enviado` / `respondio` / `accion_necesaria` en `rsvp_status`.
- Cuando un mensaje trae ambas cosas ("sí vamos + alergia"), se escribe `rsvp_status = confirmed` **y** `needs_attention = true, attention_reason = 'alergia'`. Bug resuelto.

> Nota: la *extracción* fina (qué alergia exacta, confirmar a cada acompañante, llenar `party_members.allergies`) es sub-proyecto **B**. En A, la capa 2 solo levanta la **bandera + razón** a partir del intent ya existente. No se cambia `interpretRSVPMessage` en A salvo, si hace falta, separar el valor de asistencia del de atención que devuelve.

## Superficies afectadas (lectura/render)

Valores legacy de `rsvp_status` siguen renderizables (nada truena). Se agrega visualización de la bandera de atención:

- `app/events/[id]/page.tsx` — lista de invitados: badge/indicador de `needs_attention`; editor de acompañantes en el modal gana campos `allergies`/`tags`/`notes` (mismo patrón que el titular). Acción "resolver atención" (apaga el boolean).
- `app/events/[id]/mensajes/page.tsx` — inbox omnicanal: filtro/indicador de atención pendiente (se alinea con el futuro indicador de no leídos, pendiente aparte).
- `app/events/[id]/mesas/page.tsx`, `app/dashboard/page.tsx` — solo verificar que siguen pintando los 6 valores de `rsvp_status` sin romper (no requieren la bandera, pero se revisan).

## Rollout (orden seguro, respeta sincronía Supabase ↔ Vercel)

1. Código de A pusheado a `origin/main` (tipos + lógica de webhooks + UI), tolerante a columnas ausentes (campos opcionales).
2. Diego corre el ALTER aditivo en Supabase.
3. Verificación manual local → preview → prod: mensaje "sí vamos + alergia" → `rsvp_status=confirmed` **y** `needs_attention=true`. Acompañantes editables con alergias/tags/notas.
4. (Opcional, después) limpieza one-shot que migra filas legacy `accion_necesaria/respondio` a `needs_attention=true` + `rsvp_status` a su mejor asistencia conocida (`pending`). Migración controlada y revisable, no parte del primer corte.

## Pruebas

Vitest sobre lógica pura extraída (regla 5 de CLAUDE.md):
- Mapeo intent → (asistencia, atención): "sí vamos + alergia" ⇒ `{rsvp: 'confirmed', needs_attention: true, reason: 'alergia'}`.
- Intent puro de asistencia ⇒ no levanta atención.
- Intent puro de atención ⇒ no pisa asistencia.
UI y webhooks (I/O Twilio/Telegram/Supabase) se verifican manual local → preview → prod.

## Fuera de alcance (sub-proyectos siguientes)

- **B — Extracción estructurada:** confirmar `party_members.rsvp_status` con "vamos todos"; capturar alergias del titular y por acompañante a las columnas nuevas; candados anti-adivinanza.
- **C — Cerebro que no alucina:** portar el pipeline de `feature/whatsapp-ia` (grounding mundo-cerrado + self-check + handoff) al modelo canónico, compartido por ambos canales.

## Riesgos

- **Toca el corazón (`guests`).** Mitigación: todo aditivo, sin DDL destructivo, sin tocar el constraint, campos opcionales, Sentry entrando en prod en paralelo como red.
- **Doble fuente de verdad temporal** (legacy en `rsvp_status` + bandera nueva). Mitigación: regla clara de escritura (asistencia en `rsvp_status`, atención en columnas nuevas; nunca legacy nuevo) + limpieza opcional posterior.
