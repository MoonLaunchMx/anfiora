# Agente unificado — Fase 2: extracción estructurada (acompañantes + alergias)

Fecha: 2026-07-01
Estado: spec en revisión
Construye sobre: Fase 1 (en prod, `lib/agent/*` + webhook Telegram con el pipeline grounded).
Parte de: `docs/superpowers/specs/2026-06-30-agente-unificado-design.md` (Fase 2). Conserva las reglas de la spec obsoleta de B.
Relacionado: [[agente-unificado]], [[whatsapp-ia-feature]].

## Qué cambia para el organizador

Hoy el agente entiende y responde bien, pero todavía **no "toma nota"**: si el invitado dice "vamos todos", los acompañantes siguen sin confirmar; si dice "soy alérgico a mariscos", la alergia no se guarda. Fase 2 cierra eso: el agente **confirma a los acompañantes** cuando el invitado lo dice claro, **guarda las alergias en la persona correcta**, y **lo dice con honestidad** en su respuesta ("ya confirmé tu lugar y el de tus 2 acompañantes"). Cuando algo es ambiguo (no se sabe a quién pertenece, cuántos exactamente), **no adivina**: levanta bandera para que el organizador lo resuelva desde la conversación.

## Filosofía: híbrido (c)

El agente actúa con lo inequívoco y escala lo ambiguo. Escribe confirmaciones y alergias cuando puede mapearlas con certeza contra la lista real; cuando no, levanta bandera de atención. Un dato mal puesto en el corazón es peor que un dato pendiente.

## Integración con el cerebro vivo (la decisión de esta fase)

Hoy el webhook de Telegram hace: `interpretRSVPMessage` → `resolveRsvpAndAttention` (escribe asistencia/atención) → `buildContextPack` → `runPipelineOnPack` (responde) → memoria.

Fase 2 **reemplaza el primer paso por una lectura estructurada única** y jubila el `resolveRsvpAndAttention` del webhook:

```
mensaje → extractFromMessage (Haiku tool-use) → ExtractionResult
        → applyExtraction (puro, guardia) → WritePlan
        → executeWritePlan (escribe guests + party_members)
        → runPipelineOnPack (responde grounded, alimentado por el intent derivado)
        → respuesta HONESTA (recibe appliedSummary) + memoria
```

- **Una sola lectura** del mensaje saca asistencia + acompañantes + alergias + queja + confianza. No se duplica el clasificador.
- **El guardia determinista** (`applyExtraction`) valida contra los `party_members` reales y produce el plan de escritura. Es la única pieza pura y testeable con Vitest.
- **El pipeline sigue respondiendo grounded**, alimentado con un `intent` derivado de `extraction.attendance` (para no romper su firma).
- La escritura de asistencia/atención deja de venir de A (`resolveRsvpAndAttention`) en este webhook; ahora sale del mismo guardia (una sola fuente de verdad). `lib/agent/attention.ts` de A queda disponible pero el webhook de Telegram ya no lo usa.

## El esquema (`ExtractionResult`)

El modelo extrae hechos, no decide políticas:

```ts
type ExtractionResult = {
  attendance: 'confirmed' | 'declined' | 'none'          // del titular
  companions: { action: 'all' | 'none' | 'named' | 'partial_ambiguous'; names: string[] }
  allergies: Array<{ who: 'titular' | 'companion' | 'unknown'; name: string; text: string }>
  complaint: boolean
  confidence: 'high' | 'medium' | 'low'
}
```

## El guardia (`applyExtraction` → `WritePlan`)

Reglas deterministas, validando contra los `party_members` reales del invitado:

- **Asistencia (titular):** `confirmed`/`declined` → escribe `guests.rsvp_status` (solo si cambia); `none` → no toca.
- **Acompañantes:** `all` → todos a `confirmed`. `none` ("solo voy yo") → quedan `pending`. `named` → confirma solo los nombres que **existen** en `party_members` (match por nombre normalizado); un nombre que no existe (persona extra) → **escala** `peticion`, no crea filas. `partial_ambiguous` ("vamos 2 de 3") → no toca acompañantes, **escala** `peticion`.
- **Alergias:** `titular` → `guests.allergies`. `companion` con nombre que **existe** → `party_members.allergies` de esa persona. `companion` sin match, o `unknown` → **no escribe**, solo bandera `alergia` (el organizador asigna desde la conversación).
- **Atención (derivada por el código):** prioridad `alergia > queja > peticion > duda`.
- **`confidence: low`** → **no escribe nada al corazón**, solo escala. El guardia protege la base cuando el modelo duda.

`WritePlan` lleva `guestUpdate`, `partyMemberUpdates`, `escalations` y un `appliedSummary` (qué se hizo realmente).

## Honestidad de la respuesta — opción (a)

El `appliedSummary` se le pasa a `generateGroundedReply` como una sección de "acciones realizadas". El agente teje con naturalidad lo que de verdad ocurrió ("ya confirmé tu lugar y el de tus 2 acompañantes") **solo si está en el resumen**. El self-check sigue vigente: no puede inventar más allá del contexto. La honestidad está garantizada por construcción — solo se le da lo que el guardia escribió.

Cambio de plomería: `generateGroundedReply` gana un parámetro opcional `applied?: AppliedSummary`, que se inyecta al prompt de generación como notas de acciones (no al `contextText` que ve el self-check, para no confundir la verificación de mundo cerrado).

## Alcance: Telegram

Fase 2 cablea solo el webhook de **Telegram** (canal de prueba, sin Meta). El webhook de WhatsApp usa el mismo guardia cuando llegue la Fase 4.

## Hogar del código

- `lib/agent/apply.ts` — `ExtractionResult`, `WritePlan`, `AppliedSummary`, `applyExtraction` (puro) + `apply.test.ts`.
- `lib/agent/extraction.ts` — `extractFromMessage` (tool-use Haiku) + `executeWritePlan` (I/O).
- `lib/ai-rsvp.ts` — `generateGroundedReply` gana el parámetro `applied`.
- `app/api/webhook/telegram/route.ts` — orquesta el nuevo flujo.

## Pruebas

- **`applyExtraction` (puro) con Vitest** — el grueso: acompañantes `all`/`none`/`named`(match y no-match)/`partial_ambiguous`; alergias `titular`/`companion`-match/`companion`-sin-match/`unknown`; `low confidence` = solo escala; derivación de atención con prioridad; `appliedSummary` correcto.
- **`extractFromMessage` y webhook** → manual en Telegram (prod): "vamos todos" (confirma acompañantes), "Ana es alérgica al gluten" (guarda en Ana), "vamos 2 de 3" (escala, no adivina), "soy alérgico a mariscos" (guarda en titular). La respuesta debe anunciar con honestidad lo escrito.

## Fuera de alcance

- **WhatsApp** (Fase 4), **panel de config + sandbox** (Fase 3), **backlog de UI del inbox** ([[inbox-ui-backlog]]).
- **Mapear parentescos "mi esposa" → acompañante específico** (visión casi-humano; futuro).

## Riesgos

- **Escribe al corazón** (`guests`, `party_members`). Mitigación: todo pasa por el guardia determinista y testeable; `low confidence` no escribe; los nombres se validan contra filas reales; Sentry en prod como red.
- **Extracción incorrecta del modelo.** Mitigación: el modelo solo propone; el código valida y lo no-mapeable escala en vez de adivinar.
- **Una llamada estructurada reemplaza al clasificador** (no se suma): sin llamadas netas nuevas en el hot-path del webhook.
