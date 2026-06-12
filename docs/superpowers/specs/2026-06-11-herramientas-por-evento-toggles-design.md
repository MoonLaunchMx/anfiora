# ANF-050 — Herramientas por evento (toggles en paso 3) — Design Spec

**Fecha:** 2026-06-11
**Contexto:** el nav de cada evento muestra todas las features sin importar el tipo (playlist en una asamblea corporativa, mesa de regalos en una conferencia). Se agrega un paso 3 al modal de creacion donde el usuario prende/apaga las herramientas de su evento, con defaults inteligentes segun el tipo.

---

## 1. Objetivo

Que cada evento tenga solo las herramientas que le aplican. El tipo de evento (boda, conferencia, campamento...) pre-enciende lo recomendado; el usuario ajusta en el paso 3 de creacion y puede cambiarlo despues en Configuracion. El sistema queda extensible: features futuras (QR check-in, invitados de fuera / boda destino) se agregan como una entrada mas al registro sin redisenar nada.

## 2. Alcance de toggles

**Siempre activas (sin toggle, se muestran como chips informativos):**
Invitados, Mensajes, Timeline, Finanzas (Presupuesto + Proveedores + Pagos), Configuracion.
Razon: son la columna vertebral; apagar Finanzas romperia la vinculacion presupuesto-proveedores; Mensajes ya tiene gating por plan (PRO), no por evento.

**Toggleables (5):**

| Key | Label UI | Nav que controla |
|---|---|---|
| `mesas` | Mesas y check-in | Mesas |
| `regalos` | Mesa de regalos | Mesa de regalos |
| `album` | Album de fotos | Recuerdos > Album |
| `playlist` | Playlist | Recuerdos > Playlist |
| `comida` | Planificador de comida | Comida (HOY OCULTA — este sistema la reintegra al nav cuando esta activa) |

Si album y playlist quedan apagados, el grupo Recuerdos desaparece del nav.

## 3. Defaults por tipo de evento

| Tipo | mesas | regalos | album | playlist | comida |
|---|---|---|---|---|---|
| boda | ON | ON | ON | ON | off |
| xv | ON | ON | ON | ON | off |
| cumpleanos | ON | ON | ON | ON | off |
| graduacion | ON | off | ON | ON | off |
| bautizo | ON | ON | ON | off | off |
| fiesta | off | off | ON | ON | ON |
| despedida | off | ON | ON | ON | off |
| conferencia | ON | off | off | off | off |
| capacitacion | off | off | off | off | ON |
| teambuilding | off | off | ON | off | ON |
| lanzamiento | ON | off | ON | off | off |
| asamblea | ON | off | off | off | off |
| retiro | off | off | ON | off | ON |
| congreso | ON | off | off | off | off |
| campamento | off | off | ON | ON | ON |
| caridad | ON | off | ON | off | off |
| otro | ON | off | ON | ON | off |

Logica: mesas donde hay asignacion formal de lugares; regalos solo en celebraciones personales donde se regala; album casi siempre salvo eventos puramente de trabajo; playlist donde hay fiesta o convivencia musical; comida donde el organizador coordina el menu el mismo (campamento, retiro, coffee breaks) en vez de contratarlo.

## 4. Modelo de datos

**`event_settings.enabled_features JSONB`** (nullable) — ej. `{"mesas": true, "regalos": false, "album": true, "playlist": true, "comida": false}`.

Reglas de resolucion (helper unico `resolveFeatures(eventType, enabledFeatures)`):
1. **Columna `null`** (eventos existentes) → **todo encendido** (comportamiento actual, cero migracion).
2. **Clave ausente** en el JSON → **default del tipo de evento** para esa feature. Asi una feature futura (ej. `destino`) aparece sola en eventos viejos solo si su default para ese tipo es ON, sin migrar datos. El WhatsNewModal anuncia la herramienta nueva y de donde activarla.
3. **Clave presente** → se respeta tal cual.

Sin tablas nuevas. Requiere un `ALTER TABLE event_settings ADD COLUMN` — antes de proponer el SQL final se pide inspeccion read-only del schema, y el SQL lo corre Diego despues del push del codigo (regla de sincronia Supabase-Vercel; columna nullable = aditiva e inerte).

## 5. Registro de features

Nuevo modulo `lib/features.ts`:
- `FeatureKey = 'mesas' | 'regalos' | 'album' | 'playlist' | 'comida'`
- `FEATURES`: array con `{ key, label, description, icon, navPaths }` — fuente unica para paso 3, Configuracion y filtrado del nav.
- `resolveFeatures(eventTypeValue, enabledFeatures)` → `Record<FeatureKey, boolean>` aplicando las 3 reglas de la seccion 4.

`lib/event-types.ts`: cada `EventTypeConfig` gana `defaultFeatures: FeatureKey[]` (las que arrancan ON), siguiendo el patron existente de `showVenue`/`showOrg`.

Agregar una feature futura = 1 entrada en `FEATURES` + actualizar `defaultFeatures` de los tipos que aplique. Nada mas.

## 6. UI

**NewEventModal — de 2 a 3 pasos** (Tipo → Datos → Herramientas):
- Header de steps pasa a 3 indicadores. "Crear evento" se mueve al paso 3; el paso 2 gana boton "Siguiente".
- Paso 3: bloque "Siempre incluidas" (chips informativos: Invitados, Mensajes, Timeline, Finanzas) + bloque "Activa lo que tu evento necesita" con los 5 toggles. Cada toggle: icono Lucide, label, descripcion de 1 linea, badge "Recomendado" en los que el tipo trae ON. Lista vertical con scroll natural (preparada para crecer).
- Al seleccionar tipo en paso 1 se inicializan los toggles con `defaultFeatures`; si el usuario regresa y cambia de tipo, se re-inicializan (sus ajustes manuales del paso 3 se descartan — el tipo manda).
- Al crear: `enabled_features` se guarda **completo** (las 5 claves explicitas) en el insert de `event_settings`.
- Nota al pie: "Puedes cambiar esto despues en Configuracion".

**Nav (`app/events/[id]/layout.tsx`):**
- El layout ya carga el evento; carga tambien `enabled_features` de `event_settings` y filtra `NAV_ITEMS` con `resolveFeatures`. Grupos cuyos sub-items quedan todos apagados desaparecen. `Comida` se agrega como entrada del nav visible solo cuando `comida` esta ON.

**Configuracion (`/events/[id]/configuracion`):**
- Seccion nueva "Herramientas del evento" con los mismos 5 toggles (misma fuente `FEATURES`). Editable solo por owner/admin (via `useEventAccess()`). Guarda el JSON completo en `event_settings`.

**Guard suave en paginas apagadas:**
- Si alguien entra por URL directa a una feature apagada, la pagina muestra empty state: "Esta herramienta esta desactivada para este evento" + boton "Activar" (solo owner/admin; para otros roles, solo el mensaje). Apagar nunca borra datos — solo oculta.

## 7. Lo que NO incluye esta iteracion

- QR check-in e "invitados de fuera / boda destino": features futuras; entraran como claves nuevas del registro cuando existan.
- Mesa de regalos como "donativos" en eventos de caridad: idea anotada, fuera de alcance.
- Toggles para Mensajes o Finanzas: descartado (decision de Diego 2026-06-11).
- Cambios en OnboardingModal: solo aplica al NewEventModal del dashboard. (Verificar en implementacion si OnboardingModal crea eventos por el mismo camino; si inserta `event_settings` directo, dejarle `enabled_features: null` = todo ON, valido por la regla 1.)

## 8. Fases

1. **Registro + tipos:** `lib/features.ts`, `defaultFeatures` en `lib/event-types.ts`, tipo `EventSettings` en `lib/types.ts`.
2. **NewEventModal paso 3** (guardando `enabled_features` en el insert).
3. **Nav filtrado** en layout + reintegracion de Comida.
4. **Configuracion:** seccion de toggles.
5. **Guards suaves** en las 5 paginas toggleables.
6. **SQL** (Diego lo corre tras el push) + **WhatsNew** release.

## 9. Reglas

- Solo Tailwind, UI en espanol con acentos, sin emojis, mobile first, Lucide, CTA teal `#48C9B0`.
- Codigo completo, archivo entero. Commits en ingles sin acentos.
- Local → preview → (Diego testea) → main con su OK. SQL lo corre Diego.
