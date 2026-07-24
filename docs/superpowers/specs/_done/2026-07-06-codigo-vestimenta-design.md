# Código de vestimenta — dress code compartible del evento

**Fecha:** 2026-07-06
**Estado:** Diseño aprobado sección por sección, pendiente de review del spec escrito
**Rama sugerida:** `feat/codigo-vestimenta` (o dentro de `feat/rsvp-invitacion` si se coordina el merge)

## 1. Objetivo

Darle a cada evento un **código de vestimenta** estructurado que el organizador define en un solo lugar y que se comparte de dos formas: (1) se **renderiza dentro de la invitación RSVP** que cada invitado abre, y (2) se **copia como texto limpio** para pegarlo en WhatsApp cuando alguien pregunta "¿cómo me visto?".

Es la pieza que el spec de la invitación RSVP (`2026-07-06-rsvp-pagina-invitacion-design.md`, §5/§12/§13) marca como "código de vestimenta que produce otro agente, la invitación solo lo lee, forma del dato por coordinar". **Este spec define ese contrato.** La forma ya no es ambigua ("texto vs mood board"): es un objeto estructurado (nivel + colores + recomendaciones + notas + fotos).

Es **agnóstico al tipo de evento** (bodas, corporativos, etc.): nada hardcodeado a "boda".

## 2. Relación con el Moodboard (features separadas)

El **Moodboard** (spec aparte) es una herramienta **interna** de planeación visual (tabla propia `moodboard_images`, nadie externo la lee). El **Código de vestimenta** es una pieza **compartible** que la invitación consume. Se mantienen separados; el único cruce es un botón para **jalar la paleta del moodboard** hacia los colores sugeridos del dress code (copia de valores hex, no dependencia dura). Ambos viven bajo el mismo grupo de nav **"Estilo"**.

## 3. Alcance

### Dentro de v1
- Pantalla de configuración del organizador en `/events/[id]/vestimenta` con **vista previa en vivo** de cómo lo verá el invitado.
- Campos: **nivel de formalidad** (uno), **colores sugeridos**, **colores a evitar**, **recomendaciones rápidas** (chips), **nota libre**.
- Extras aprobados: **fotos de ejemplo** de outfits (subidas a Storage) y **guía separada ellas / ellos** (notas por género, opcionales).
- Botón **"Jalar paleta del moodboard"** → copia los hex de la paleta del evento a colores sugeridos.
- Botón **"Copiar como texto"** → arma un mensaje limpio listo para WhatsApp.
- **Consumo por la invitación RSVP:** la página `/invitacion/[slug]/[token]` renderiza la sección "Código de vestimenta" leyendo `event_settings.dress_code` (render-if-present). Esta feature **define y produce** el dato; la invitación solo lo lee.

### Fuera de v1 (futuro)
- **Página pública standalone** del dress code (`/vestimenta/[token]`). Descartado a propósito: no sobre-crear links; la invitación RSVP ya lo muestra a invitados y el texto copiable cubre "responder preguntas".
- Plantilla de texto editable antes de copiar (v1 copia texto generado, sin edición inline).
- Auto-extraer colores desde las fotos de ejemplo (IA/canvas).

## 4. Superficies

### 4.1 Pantalla de configuración del organizador (privada)
Nueva entrada en el grupo de nav **"Estilo"**: **"Código de vestimenta"**. Layout de dos columnas (editor izquierda, preview derecha) que colapsa a una columna en mobile con el preview arriba o accesible por toggle. Estética Anfiora: flat, blanco, acento dorado `#d4a853`, CTA teal `#48C9B0`, sin serifas ni mayúsculas de revista, Lucide, con acentos.

**Editor (izquierda):**
- **Nivel de formalidad** — selector de una opción entre: `casual`, `casual_elegante`, `coctel`, `formal`, `etiqueta`, `tematico`. Cada uno con etiqueta + descripción corta. Si `tematico`, aparece un campo de texto `nivel_custom`.
- **Colores sugeridos** — swatches editables (agregar/quitar). Botón "Jalar paleta del moodboard".
- **Colores a evitar** — swatches editables (marcados en rojo).
- **Recomendaciones rápidas** — chips toggleables prearmados ("Tacón bajo, es jardín", "Lleva abrigo, de noche", "Evita blanco", "Ceremonia religiosa", "Alberca / playa") + agregar chip propio.
- **Nota libre** — textarea.
- **Fotos de ejemplo** (extra) — subir 2-3 outfits de referencia (Storage).
- **Guía ellas / ellos** (extra) — dos notas de texto opcionales; si están vacías no se muestran.
- Botón **Guardar** y botón **Copiar como texto**.

**Preview (derecha):** "Vista del invitado" — tarjeta que muestra nivel + descripción, colores sugeridos (dots), colores a evitar (dots), recomendaciones y nota, tal como aparecerá en la invitación. Sticky en desktop.

### 4.2 Render dentro de la invitación RSVP (pública, sin login)
La página `/invitacion/[slug]/[token]` (otra feature) ya reserva la sección "Los detalles → Código de vestimenta (si existe el dato)". Esta feature entrega:
- El **dato** en `event_settings.dress_code`.
- Una **función pura de render** reutilizable en `lib/dresscode.ts` para que la invitación arme la sección de forma consistente (nivel legible, listas de colores con nombres opcionales, recomendaciones, notas por género si existen, fotos). La invitación importa esa función; no reimplementa el formato.

### 4.3 Copiar como texto
Botón en la pantalla de configuración (y opcionalmente exponible donde convenga) que llama a `buildDressCodeText(dressCode, event)` y copia al portapapeles un mensaje como:

> Código de vestimenta — Boda Ana & Luis
> Nivel: Coctel (vestido corto o traje)
> Colores sugeridos: verde salvia, arena, terracota
> Evita: blanco, marfil
> Notas: Tacón bajo, es jardín. Lleva abrigo, refresca en la noche.

Sin acentos solo en commits; en el texto copiable **con** acentos.

## 5. Modelo de datos

**Sin tablas nuevas.** Cambio aditivo:

### Campo nuevo
- `event_settings.dress_code JSONB` — toda la config del dress code en un campo. Mismo hogar que `invite_config` (donde la invitación RSVP ya lee config del evento). Forma:
  ```jsonc
  {
    "nivel": "coctel",                 // casual | casual_elegante | coctel | formal | etiqueta | tematico
    "nivel_custom": null,               // string si nivel = tematico, si no null
    "colores_sugeridos": [              // array de swatches; nombre opcional
      { "hex": "#3A5A40", "nombre": "Verde salvia" },
      { "hex": "#DAD7CD", "nombre": "Arena" }
    ],
    "colores_evitar": [
      { "hex": "#FFFFFF", "nombre": "Blanco" }
    ],
    "recomendaciones": ["Tacon bajo, es jardin", "Lleva abrigo, de noche"],
    "nota_libre": "El jardin es de pasto natural...",
    "guia_ellas": null,                 // string opcional
    "guia_ellos": null,                 // string opcional
    "fotos_ejemplo": []                 // array de urls (Storage), 0-3 en v1
  }
  ```
  `null`/ausente = el evento no tiene dress code configurado → la invitación no renderiza la sección.

### Storage
- Las **fotos de ejemplo** se suben a Supabase Storage. Bucket compartido de media de eventos (subcarpeta `dress-code/{event_id}/`). Si el Moodboard introduce primero el bucket `event-media` o `moodboard`, se reutiliza con subcarpeta; si no, este spec crea el bucket. (Coordinar con el spec de Moodboard para no crear dos buckets.)

### Datos existentes que se consumen (sin cambios)
- `events`: `name`, `event_date`, `host_name`, `host_name_2` (para el encabezado del texto copiable).
- `event_settings`: `moodboard_palette` (o equivalente del moodboard) para el botón "Jalar paleta".

## 6. Nav

Grupo nuevo **"Estilo"** en `app/events/[id]/layout.tsx`, con dos sub-items:
- **Moodboard** → `/events/[id]/moodboard` (otra feature)
- **Código de vestimenta** → `/events/[id]/vestimenta`

Sigue el patrón `NavGroup` existente (como "Finanzas" y "Recuerdos"): expandido muestra header + sub-items; colapsado y bottom-nav mobile navegan al `defaultPath` (Moodboard). **Riesgo de colisión:** la feature RSVP también edita `layout.tsx` (agrega una `NavItem` "Invitación"). Coordinar el merge de este archivo.

## 7. Lógica pura testeable (Vitest)

Extraída a `lib/dresscode.ts`, cubierta en `lib/dresscode.test.ts`:
- `defaultDressCode()` — objeto vacío/base válido.
- `parseDressCode(raw)` — valida y normaliza el JSONB (tolera campos faltantes, filtra hex inválidos, recorta arrays de fotos a 3).
- `isDressCodeConfigured(dc)` — true si hay algo que mostrar (nivel u otro campo con contenido); decide si la invitación renderiza la sección.
- `resolveNivelLabel(dc)` — id → etiqueta legible (o `nivel_custom` si `tematico`).
- `buildDressCodeText(dc, event)` — arma el texto copiable determinista.

La UI y el I/O (Storage, Supabase) se verifican manual (local → preview → main).

## 8. Rutas y archivos

```
app/events/[id]/
  layout.tsx                → grupo de nav "Estilo" (coordinar con RSVP)
  vestimenta/
    page.tsx                → pantalla de configuracion (editor + preview + copiar texto)
    DressCodeEditor.tsx     → 'use client', editor
    DressCodePreview.tsx    → 'use client', vista del invitado (reusa render de lib)
lib/
  dresscode.ts              → logica pura (parse, labels, texto, render helpers)
  dresscode.test.ts         → Vitest
  types.ts                  → tipo DressCode + DressCodeColor (aditivo; coordinar con RSVP)
SQL (aditivo, aplicado por Diego tras push):
  ALTER event_settings ADD dress_code JSONB
  (bucket Storage para dress-code/ si no existe uno compartido)
```

La invitación RSVP (`app/invitacion/**`) **importa** `lib/dresscode.ts` para renderizar la sección; no vive aquí.

## 9. Coordinación (regla: no duplicar, mapear antes de codear)

- `event_settings.dress_code` es el **contrato** que la invitación RSVP lee. Este spec lo define; el spec de RSVP (§5/§12) lo esperaba abierto. Actualizar la nota de coordinación: la forma es el objeto de §5, no "texto vs moodboard".
- `lib/types.ts` y `app/events/[id]/layout.tsx` son archivos compartidos por 3 agentes en paralelo. Mantener las ediciones al mínimo (un tipo aditivo, un grupo de nav) y coordinar el orden de merge.
- **Nada toca Supabase hasta que el código esté pusheado** (sincronía Supabase↔Vercel). El `ALTER` de `dress_code` y el bucket se aplican después del push.

## 10. Plan de verificación (local → preview → main)

1. `npm test` verde (`lib/dresscode.test.ts`).
2. Local (localhost:3000): configurar dress code de un evento (variando nivel, colores, chips, fotos, guías por género) → ver preview → "Copiar como texto" y verificar el mensaje → abrir la invitación RSVP del mismo evento y verificar que la sección se renderiza igual → probar evento **sin** dress code (la sección no aparece) → "Jalar paleta del moodboard" y verificar que copia los hex.
3. Aplicar SQL aditivo en Supabase (tras push): `event_settings.dress_code`, bucket Storage.
4. Preview (Vercel) → main.

## 11. Fuera de alcance explícito

Página pública standalone del dress code, plantilla de texto editable inline, auto-extracción de color por IA. La invitación RSVP y el itinerario los construyen/consumen otras features; aquí solo producimos `dress_code` y el helper de render.
