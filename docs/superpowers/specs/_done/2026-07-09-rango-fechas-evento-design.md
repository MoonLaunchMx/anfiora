# Rango de fechas del evento (inicio + fin)

**Fecha:** 2026-07-09
**Estado:** Aprobado, listo para plan

## Problema

Al crear un evento (`NewEventModal`) solo se puede seleccionar la fecha de inicio. Un
cliente con un evento multi-dia en un viñedo necesita definir inicio **y** fin. La columna
`events.event_end_date` ya existe y ya se usa en Comida y Configuracion, pero el alta del
evento no la captura y la interaccion de dos calendarios separados (en Configuracion) no es
la mejor. Se quiere un solo calendario tipo rango, consistente en toda la app.

## Decisiones

1. **Modelo de datos (ya existe, no hay migracion):**
   - `event_date` = inicio, siempre presente.
   - `event_end_date` = fin, **nullable**. `null` = evento de un dia. Nunca se guarda
     `end === start` redundante.

2. **Interaccion:** un solo calendario en **modo rango** (react-day-picker `mode="range"`).
   Primer clic = inicio, segundo clic = fin. **Fin opcional**: 1 clic = evento de un dia
   (`event_end_date = null`); 2 clics = multi-dia.

3. **Formato de display:** colapsado estilo Google/Airbnb (solo se repite lo que cambia).

4. **Consistencia:** el mismo calendario de rango se usa en **Nuevo evento** y en
   **Configuracion**. Los calendarios de **fecha unica** (invitacion, timeline) NO cambian.

## Alcance (puramente aditivo, cero migracion de DB)

Auditoria de los 38 archivos que tocan `event_date` / `event_end_date`:
la columna y el tipo `Event.event_end_date: string | null` ya existen; dashboard y layout ya
traen `event_end_date` en su `.select()` (solo no lo pintan); Comida ya lee el rango;
invitacion/playlist/mesas/presupuesto/timeline/webhooks/agente solo usan `event_date` y no
se ven afectados porque `end` es opcional.

## Componentes

### 1. `DatePicker` gana modo rango (aditivo, no rompe usos existentes)

Archivo: `app/components/ui/DatePicker.tsx`

- Nueva prop opcional `mode?: 'single' | 'range'`, **default `'single'`**.
- Modo `'single'`: comportamiento identico al de hoy. Firma `onChange(v: string)` intacta.
  Los 3 usos de fecha unica (invitacion, timeline via su propio picker) no se tocan.
- Modo `'range'`:
  - Props: `startValue: string`, `endValue: string`, `onRangeChange(start: string, end: string) => void`.
  - `DayPicker mode="range"`, `selected={{ from, to }}`.
  - 1 clic selecciona `from` y deja `to` vacio -> al confirmar/cerrar: `end = ''` (un dia).
  - 2 clics: `from` + `to`.
  - Boton muestra el rango con `formatEventDate` (ver abajo); placeholder si vacio.
  - `minDate` sigue aplicando (no fechas antes de X si se pasa).
- Decision de implementacion: mantener el componente en un solo archivo con ramas por
  `mode`. Si crece demasiado, extraer el cuerpo del rango a un subcomponente interno, pero
  la API publica es un solo `DatePicker`.

### 2. Helper `formatEventDate(start, end?)` — formato colapsado

Archivo: `lib/types.ts` (junto a `formatCurrency`)

```ts
formatEventDate(start: string | null, end?: string | null): string
```

Reglas (locale `es-MX`):
- Sin `start` -> `''`.
- Sin `end` o `end === start` -> `"9 de julio de 2026"`.
- Mismo mes y año -> `"9 – 11 de julio de 2026"`.
- Distinto mes, mismo año -> `"30 de julio – 2 de agosto de 2026"`.
- Distinto año -> `"30 dic 2026 – 2 ene 2027"` (formato corto en ambos lados).

Parseo local con `split('T')[0].split('-')` para evitar corrimiento de zona horaria (mismo
patron que ya usan dashboard/layout). Separador: guion largo `–` con espacios.

**Es logica pura -> test con Vitest** cubriendo los 5 casos + edge (fin antes de inicio se
trata como fin ausente / se ignora, pero la UI ya impide seleccionarlo con `minDate`).

### 3. Nuevo evento captura el rango

Archivo: `app/components/NewEventModal.tsx`

- Estado: agregar `endDate`. Reemplazar el `<DatePicker value={date} .../>` de fecha por
  `<DatePicker mode="range" startValue={date} endValue={endDate} onRangeChange={...} />`.
- Label: "Fecha" (el hint de rango vive en el propio calendario). Validacion sin cambios
  (inicio obligatorio; fin opcional).
- Insert a `events`: agregar `event_end_date: endDate || null`.
- `resetForm` limpia `endDate`.

### 4. Configuracion usa el mismo calendario de rango

Archivo: `app/events/[id]/configuracion/page.tsx`

- Reemplazar los dos `<DatePicker>` separados (inicio / fin) por un unico
  `<DatePicker mode="range" ... />`. Mantener el auto-save (`scheduleAutoSave`) en
  `onRangeChange`. El guardado ya escribe `event_end_date`.

### 5. Display en dashboard y layout

- `app/dashboard/page.tsx` y `app/events/[id]/layout.tsx` tienen cada uno un `formatDate`
  local (fecha unica, duplicado). Reemplazar ambos por `formatEventDate(event.event_date,
  event.event_end_date)`. El `.select()` ya trae ambos campos.
- Comida ya maneja el rango; no se toca su logica, pero puede adoptar `formatEventDate` si
  aplica (opcional, no bloqueante).

## Testing

- **Vitest (logica pura):** `formatEventDate` con los 5 casos + edge.
- **Manual (flujo local -> preview -> main):** crear evento de un dia y multi-dia; editar en
  config; verificar display colapsado en dashboard, header y comida; confirmar que
  invitacion y timeline (fecha unica) siguen intactos.

## No incluye (YAGNI)

- No se cambian los calendarios de fecha unica.
- No se agrega hora de fin (solo fecha de fin).
- No se toca el esquema de Supabase.
