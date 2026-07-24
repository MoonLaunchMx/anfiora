# Agente unificado — Fase 2.1: cambios y correcciones

Fecha: 2026-07-01
Estado: spec en revisión
Construye sobre: Fase 2 (en prod) — guardia `applyExtraction`, `extractFromMessage`, webhook Telegram.
Relacionado: [[agente-unificado]].

## Qué cambia para el organizador

Hoy el agente solo sabe **sumar**: confirma acompañantes y agrega alergias, pero no sabe **declinar** a un acompañante ni **corregir** una alergia. Por eso, en pruebas reales:
- "Mi esposa Olivia no va" → Olivia seguía **Confirmada**.
- "No es nueces, es gluten" → el agente **apilaba** gluten sin quitar nueces.

Fase 2.1 agrega la capacidad de **cambios y correcciones**, con una regla de seguridad clave: los cambios de asistencia se aplican solos (bajo riesgo, reversibles), pero **las correcciones de alergias se marcan para el organizador** (nunca se auto-borran — un dato de seguridad mal borrado es peor que uno pendiente de revisar).

## Reglas (decididas con el organizador)

**1. Declinar acompañantes — el agente lo aplica (bajo riesgo).**
- Nombre explícito: "Olivia no va" / "mi esposa Olivia ya no asiste" → el guardia pone a Olivia en `declined` (validando el nombre contra los `party_members` reales, igual que las confirmaciones).
- **Exclusividad** ("solo va mi hijo") → **no se infiere** la declinación de los demás. El guardia confirma al nombrado y **levanta bandera** para que el organizador revise a los no mencionados. (Decisión: no adivinar declinaciones no explícitas.)

**2. Corregir alergias — bandera para el organizador (NO auto-cambio).**
- Cuando el mensaje **corrige, niega o reasigna** una alergia ("no es nueces, es gluten", "el de las nueces es mi hijo no mi esposa", "quítale la alergia") → el guardia **no toca las alergias** (ni agrega ni borra) y levanta **bandera de atención** `alergia`. El organizador lo resuelve desde la conversación.
- Un mensaje de alergia **normal y aditivo** ("soy alérgico a mariscos") sigue guardándose como en Fase 2.

**3. La respuesta lo dice con honestidad.**
- "Actualicé que Olivia ya no asistirá" (porque sí se aplicó).
- "Hay un ajuste de alergia que el organizador va a revisar" (porque se dejó en manos del humano).

## Cambios en la lectura (`ExtractionResult`)

Aditivo sobre el esquema de Fase 2:

```ts
companions: {
  action: 'all' | 'none' | 'named' | 'partial_ambiguous'
  names: string[]              // acompanantes que SI van (confirmar)
  decliningNames: string[]     // acompanantes que explicitamente NO van (declinar)  [NUEVO]
  impliesOthersNotComing: boolean   // exclusividad "solo va X" (marca, no infiere)   [NUEVO]
}
allergies: [...]               // igual que Fase 2
allergyCorrection: boolean     // el mensaje corrige/niega/reasigna una alergia        [NUEVO]
complaint: boolean
confidence: 'high' | 'medium' | 'low'
```

## Cambios en el guardia (`applyExtraction`)

- **decliningNames:** por cada nombre, `findMember` (match por token, ya robusto); si existe → `party_members.rsvp_status = 'declined'`. Nombre sin match → escala `peticion` (no crea nada).
- **impliesOthersNotComing = true:** confirma a los nombrados; **no** declina a los no mencionados; levanta `needs_attention` (razón `duda`) para revisión.
- **allergyCorrection = true:** **omite todas las escrituras de alergias** de ese mensaje (ni add ni remove); levanta `needs_attention` (razón `alergia`). La asistencia y las declinaciones del mismo mensaje sí se aplican (son de otro eje y de bajo riesgo).
- **appliedSummary** gana: `declinedCompanions: number` y `allergyCorrectionFlagged: boolean` para alimentar la respuesta honesta.
- `confidence='low'` sigue igual: no escribe nada, solo escala.

## Entregable extra: tabla de comportamiento del agente

Un documento `docs/agente-comportamiento.md` con una **matriz "qué dice el invitado → qué hace el agente"** (asistencia, acompañantes confirmar/declinar/exclusividad, alergias agregar/corregir, queja, baja confianza), como referencia única para entender y probar el 100% del agente. Se llena con los casos de esta fase + los de Fase 2.

## Alcance

Solo **Telegram** (como Fase 2). Sin SQL nuevo (usa `party_members.rsvp_status` y `needs_attention`/`attention_reason` existentes). Reusa `findMember`, el pipeline y la honestidad de Fase 2.

## Fuera de alcance

- **Auto-borrar/mover alergias** (decisión: se marca, no se toca — seguridad).
- **Inferir declinaciones por exclusividad** (decisión: se marca, no se adivina).
- **WhatsApp** (Fase 4), **panel editable del inbox**, **reliability del webhook** (el 502 intermitente se investiga aparte con el logging nuevo de Sentry).
- **Mapear parentescos "mi esposa" → persona** sin nombre (casi-humano futuro).

## Pruebas

- **`applyExtraction` (puro) con Vitest:** declinar nombrado (match/no-match), exclusividad (confirma + flag, no declina otros), corrección de alergia (no escribe alergias + flag), corrección + asistencia en el mismo mensaje (asistencia sí, alergia no), `appliedSummary` correcto.
- **Manual en Telegram (prod):** "mi esposa Olivia no va" → Olivia declinada; "no es nueces, es gluten" → no cambia alergias + bandera; "solo va mi hijo" → confirma hijo + bandera.

## Riesgos

- **Borrado de datos de seguridad.** Mitigado por diseño: las alergias NUNCA se borran automáticamente; toda corrección es bandera humana.
- **Declinar a la persona equivocada.** Mitigado: solo declina nombres que matchean contra la lista real (mismo guardia por token de Fase 2); exclusividad no infiere.
- **Mensajes correctivos complejos → baja confianza → mensaje de espera.** Aceptable (safety net); el esquema más expresivo debería reducir la baja confianza en estos casos. El 502 del webhook es aparte.
