# Agente robusto — Sub-proyecto B: extracción estructurada (acompañantes + alergias)

> **OBSOLETO (30-jun).** Reemplazado por `2026-06-30-agente-unificado-design.md`. Este sub-proyecto describía un tercer cerebro en paralelo; su valor único (confirmar acompañantes + capturar alergias) se conserva, pero ahora vive DENTRO del cerebro unificado (fase 2), no como módulo aparte. No construir desde este documento.

Fecha: 2026-06-30
Estado: OBSOLETO — ver agente unificado
Depende de: Sub-proyecto A (PR #6, `feat/agente-robusto-A`) — B se ramifica desde A.
Relacionado: `docs/superpowers/specs/2026-06-30-agente-robusto-A-modelo-datos-design.md`, rama diferida `feature/whatsapp-ia` (pipeline anti-alucinación = sub-proyecto C).

## Qué cambia para el organizador

Hoy el agente contesta bonito pero no "hace": cuando un invitado dice "vamos todos" los acompañantes siguen sin confirmar, y cuando dice "soy alérgico a mariscos" la alergia no se guarda en ningún lado. B cierra ese hueco: el agente **confirma a los acompañantes** cuando el invitado lo dice claro, **guarda las alergias en la persona correcta**, y cuando algo es ambiguo (no se sabe a quién pertenece, cuántos exactamente) **levanta una bandera para que el organizador lo resuelva** — nunca adivina un dato que va al corazón de la lista.

A (ya construido) separó "¿viene?" de "¿hay algo que atender?". B llena esas casillas con datos reales y confiables.

## Filosofía de escritura: híbrido (c)

El agente **actúa con lo inequívoco y escala lo ambiguo**. Sí escribe confirmaciones de acompañantes y alergias cuando puede mapearlas con certeza; cuando no, levanta bandera de atención y deja que el organizador decida desde la conversación (que el inbox ya muestra completa). Un dato mal puesto en el corazón es peor que un dato pendiente.

## Arquitectura: la IA propone, el código dispone

Patrón estándar de la industria para agentes que escriben a un sistema de registro: salida estructurada del modelo + una capa determinista que valida contra la realidad y aplica. El modelo nunca escribe directo a la base.

Módulo nuevo `lib/agent/extraction.ts`, dos piezas con responsabilidad separada:

- **`extractFromMessage(message, context)`** — la "lectura". Una llamada a Claude Haiku con tool-use de esquema estricto que devuelve un `ExtractionResult` tipado. Única pieza con I/O al modelo. No escribe nada.
- **`applyExtraction(result, guest, partyMembers)`** — el "aplicador". Función **pura, sin I/O**, que valida la propuesta contra los `party_members` reales y produce un `WritePlan` determinista. Aquí viven las reglas de "no adivinar". Es lo que se testea con Vitest.

Flujo en el webhook (ambos canales, mismo cerebro agnóstico de canal):

```
mensaje → extractFromMessage (Haiku tool-use) → ExtractionResult
        → applyExtraction (puro, reglas) → WritePlan
        → webhook ejecuta WritePlan (updates a guests/party_members)
        → generateAgentReply recibe appliedSummary → respuesta honesta
```

B reemplaza el paso `interpretRSVPMessage` + `resolveRsvpAndAttention` de A por esta lectura estructurada (que absorbe la separación asistencia/atención de forma nativa). Las columnas de A (`needs_attention`, `attention_reason`, `party_members.allergies`) son el destino de escritura.

## El esquema (`ExtractionResult`)

El modelo extrae hechos, no decide políticas:

```ts
type ExtractionResult = {
  attendance: 'confirmed' | 'declined' | 'none'          // del titular
  companions: {
    action: 'all' | 'none' | 'named' | 'partial_ambiguous'
    names: string[]                                       // solo si action='named'
  }
  allergies: Array<{ who: 'titular' | 'companion' | 'unknown'; name: string | null; text: string }>
  complaint: boolean                                      // queja detectada
  confidence: 'high' | 'medium' | 'low'
}
```

## El aplicador (`applyExtraction` → `WritePlan`)

Reglas deterministas. El aplicador valida cada propuesta contra los `party_members` reales del invitado:

**Asistencia (titular):**
- `confirmed` / `declined` → escribe `guests.rsvp_status` (solo si cambia).
- `none` → no toca asistencia.

**Acompañantes:**
- `all` → todos los `party_members` a `confirmed`; asegura titular `confirmed`.
- `none` ("solo voy yo") → titular `confirmed`; acompañantes quedan en `pending`.
- `named` → confirma solo los nombres que **existen** en `party_members` (match por nombre, normalizado). Un nombre que **no** existe (persona extra no registrada) → **escala** `peticion`, no crea filas.
- `partial_ambiguous` ("vamos 2 de 3") → no toca acompañantes; **escala** `peticion`.

**Alergias:**
- `who='titular'` → agrega `text` a `guests.allergies`.
- `who='companion'` con `name` que **existe** en `party_members` → agrega `text` a `party_members.allergies` de esa persona.
- `who='companion'` sin match, o `who='unknown'` → **no escribe**; solo bandera `alergia` (el organizador asigna desde la conversación).

**Atención (derivada por el código, no por el modelo):**
- Se levanta `needs_attention=true` con razón según lo que no se pudo aplicar con certeza: prioridad `alergia > queja > peticion > duda`.
- `complaint=true` → razón `queja`.

**Confianza:**
- `confidence='low'` → **no escribe nada al corazón** (ni asistencia, ni acompañantes, ni alergias); solo escala (bandera + el mensaje queda en el inbox). El guardia protege la base cuando el modelo duda.

**Salida `WritePlan`:**

```ts
type WritePlan = {
  guestUpdate: { rsvp_status?: string; needs_attention?: boolean; attention_reason?: string; allergies?: string[] } | null
  partyMemberUpdates: Array<{ id: string; rsvp_status?: string; allergies?: string[] }>
  escalations: string[]                                  // razones, para log y honestidad
  appliedSummary: {                                      // qué se hizo realmente, para la respuesta
    confirmedGuest: boolean
    confirmedCompanions: number
    capturedAllergies: number
    flagged: string | null
  }
}
```

El webhook ejecuta `guestUpdate` y `partyMemberUpdates` (con captura y log de error, como en A), y pasa `appliedSummary` a la respuesta.

## Honestidad de la respuesta

`generateAgentReply` recibe `appliedSummary` y afirma solo lo que de verdad ocurrió ("ya confirmé tu lugar y el de tus 2 acompañantes" únicamente si se escribieron). El blindaje completo del texto (grounding mundo-cerrado + self-check) es **C**; B solo cierra el lazo "di lo que hiciste".

## Pruebas

- **`applyExtraction` (puro) con Vitest** — el grueso: acompañantes `all`/`none`/`named`(match y no-match)/`partial_ambiguous`; alergias `titular`/`companion`-match/`companion`-sin-match/`unknown`; `low confidence` = solo escala; derivación de atención con prioridad; `appliedSummary` correcto.
- **`extractFromMessage` (I/O Haiku)** y cableado de webhooks → verificación manual local → preview → prod.

## Fuera de alcance

- **C — blindaje anti-alucinación del texto** (grounding + self-check del pipeline de `feature/whatsapp-ia`).
- **Debounce / multi-mensaje** (juntar mensajes enviados por separado) → reliability, va con C.
- **Mapear parentescos ("mi esposa") a un acompañante específico** → visión "casi humano"; requiere memoria/relaciones; futuro.
- **UI de tags de acompañante** → follow-up de A.

## Riesgos

- **Escribe al corazón (`guests`, `party_members`).** Mitigación: todo pasa por el aplicador determinista y testeable; `low confidence` no escribe; nombres se validan contra filas reales; Sentry entrando en prod como red.
- **Extracción incorrecta del modelo.** Mitigación: el modelo solo propone; el código valida nombres y mapeos; lo no-mapeable escala en vez de adivinar.
- **Latencia (una llamada estructurada extra).** Mitigación: una sola llamada Haiku **reemplaza** al clasificador actual (no se suma a él), así que no agrega llamadas netas. En Telegram corre en `after()` fuera del hot-path; en WhatsApp ocupa el mismo punto donde hoy ya corre el clasificador antes de responder.
