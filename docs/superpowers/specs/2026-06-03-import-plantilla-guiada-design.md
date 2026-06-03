# Plantilla de importación guiada (presupuesto)

**Fecha:** 2026-06-03
**Estado:** Diseño aprobado
**Rama:** `feature/import-plantilla-guiada`

## Objetivo

Hacerle la vida fácil al usuario que vive en Excel pero no conoce la app: que la plantilla
de importación de presupuesto venga **pre-llenada con las categorías del evento y conceptos
sugeridos de su tipo**, con instrucciones claras. El import sigue **agregando** (con dedupe).

## Alcance

1. **Plantilla descargable enriquecida** (3 hojas):
   - **"Instrucciones"**: pasos amigables en español (sin tecnicismos): llenar la columna
     *Presupuesto* con el monto, borrar filas que no apliquen, agregar las propias, guardar
     y subir en *Importar*.
   - **"Presupuesto"**: header `Categoría | Concepto | Presupuesto`, pre-llenada con las
     **categorías del evento** (de `getEventCategories`, respeta personalización) y los
     **conceptos sugeridos del tipo** (reusa las plantillas: boda nivel Clásica;
     social/corporativo su lista). Columna *Presupuesto* vacía. Categorías del evento sin
     conceptos sugeridos aparecen con una fila de concepto en blanco.
   - **"Categorías"**: referencia con las categorías válidas del evento.
2. **Import acepta categorías custom** (FIX necesario): hoy `handleFileChange` descarta
   filas cuya categoría no sea una de las 14 fijas (`if (!category) continue`). Con
   categorías editables eso rompe el ida-y-vuelta. Cambio: `category =
   LABEL_TO_CATEGORY[catRaw] ?? catRaw` (usa el texto tal cual si no es conocida; `category`
   ya es `string`). Quitar el `continue` por categoría desconocida.

## Archivos

- **`presupuesto/lib/templates.ts`**: agregar
  `getSuggestedItems(eventType: string|null, eventCategory: string|null): {category: string; concepto: string}[]`
  (boda → `getBodaItems('clasica')`; corporativo → CORPORATIVO; resto → SOCIAL).
- **`presupuesto/lib/exports.ts`**: cambiar firma a
  `downloadImportTemplate(opts: { categories: string[]; eventType: string|null; eventCategory: string|null })`
  y construir las 3 hojas. Orden de filas de "Presupuesto": recorrer `categories` (orden del
  evento); por cada una, sus conceptos sugeridos (match por categoría); si no tiene, una
  fila `[categoryLabel(cat), '', '']`. Usar `categoryLabel(cat)` en la columna Categoría.
  Filename: `Plantilla presupuesto Anfiora.xlsx` (ya existente).
- **`presupuesto/page.tsx`**:
  - En el menú Importar, `downloadImportTemplate({ categories, eventType: event?.event_type ?? null, eventCategory: event?.event_category ?? null })`.
  - En `handleFileChange`: `const category = LABEL_TO_CATEGORY[catRaw.toLowerCase()] ?? catRaw` y quitar `if (!category) continue` (mantener `if (!catRaw || !conRaw) continue` y el skip de filas "ejemplo:").

## Sin cambios en Supabase. Sin emojis. UI con acentos.

## Criterios de éxito
- Descargar plantilla → trae categorías del evento + conceptos sugeridos + instrucciones.
- Llenar montos y subir → importa (agrega, dedupe), incluyendo categorías custom.
- Un evento con categorías personalizadas: su plantilla las refleja y reimporta sin perder
  filas custom.
- `npm run lint` + `npm run build` pasan.
