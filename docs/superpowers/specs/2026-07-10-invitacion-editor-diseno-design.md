# Spec — Editor de diseño de invitaciones (personalización completa)

**Fecha:** 2026-07-10
**Rama/worktree:** `worktree-invitacion-editor-diseno` (base `origin/main` = be10d97)
**Estado:** diseño aprobado en brainstorm, pendiente de revisión de spec → plan.

## 1. Objetivo

Convertir la invitación digital de Anfiora en algo **ultra personalizable y a la vez sencillo**, inspirado en Partiful pero más fácil de usar. Hoy la invitación se ve bien pero es visualmente fija (colores, fuentes, fondos hardcodeados). Este epic agrega una **capa de diseño (tema)** sobre el motor de bloques existente, un editor con **Vibes + Personalizar + preview en vivo**, **fondos animados**, **animaciones de RSVP Sí/No**, **pantalla post-confirmación** y un **slug bonito**.

Principio rector: **simple por default, profundo bajo demanda.** El usuario nunca empieza en un lienzo en blanco: elige un Vibe (1 tap = bonito) y, si quiere, abre "Personalizar" para control total (que ya viene pre-lleno con los tokens del Vibe).

## 2. Arquitectura actual (lo que ya existe, no se rompe)

- **Motor de bloques:** `InviteDoc = { v, meta, sections[] }` persistido en `event_settings.invite_config` (JSONB). Esquema Zod en `lib/invite/schema.ts`, helpers en `lib/invite/doc.ts`.
- **11 tipos de sección** (`portada, saludo, detalles, dress_code, itinerario, rsvp, enganche, playlist, mesa, texto, cierre`), cada una con solo **contenido** (textos + toggles). Sin estilo.
- **Render compartido:** `app/components/invitacion/InvitacionRenderer.tsx` + secciones en `sections/*.tsx`. Lo usan idénticamente el editor (`app/events/[id]/invitacion/page.tsx`) y la página pública (`app/invitacion/[slug]/[token]/InvitacionClient.tsx`), diferenciados por `InviteCtx.mode` (`preview` | `public`).
- **Editor:** `app/events/[id]/invitacion/` — `page.tsx` (tabs Diseño/Enviar, autosave 800ms a `event_settings.invite_config`, publicar genera `rsvp_token` por invitado), `BlockEditor.tsx` (DnD de bloques), `SectionForm.tsx` (formularios por sección), `RepartoLinks.tsx` (reparto de links).
- **RSVP:** `sections/RsvpSection.tsx` (botones Sí/No por invitado + acompañantes) → `POST /api/invitacion/[token]` → actualiza `guests`/`party_members`. Post-respuesta actual: texto inline "¡Gracias por confirmar!". No hay pantalla dedicada.
- **Slug:** `lib/invite.ts` `slugifyEvent()` (derivado en cliente de host_name/name, **no persistido**) + `randomToken()`. Link = `/invitacion/{slug}/{token}`.
- **Framer Motion** está instalado y usado en otras partes; **cero** uso en la invitación hoy.

## 3. Modelo de datos nuevo: capa de tema

Se extiende `InviteDoc` con un campo `theme` (aditivo, retrocompatible: docs sin `theme` resuelven al Vibe default "Anfiora Claro").

```ts
InviteDoc {
  v: 2,                       // bump de versión con migración tolerante (v1 → default theme)
  meta: { publicada, fecha_limite, ... },
  theme: Theme,               // NUEVO
  sections: Section[]         // sin cambios de forma; heredan el theme al renderizar
}

Theme {
  vibeId: VibeId,             // 'anfiora-claro' | ... (21 vibes)
  fonts:   { titulo: FontId, cuerpo: FontId },
  colores: { fondo, texto, acento, botonBg, botonTexto },  // strings CSS (color o gradiente)
  boton:   { forma: 'pill'|'redondo'|'recto', estilo: 'relleno'|'contorno'|'degradado'|'elevado'|'retro3d'|'neon'|'cromo' },
  fondo:   { tipo: 'solido'|'gradiente'|'imagen'|'animado', efectoId?: EffectId },
  animRsvp:{ si: SiAnimId, no: NoAnimId },
  copy:    { /* overrides de textos de celebración Sí/No y post-confirmación */ }
}
```

- Al **elegir un Vibe** se copian sus tokens a `theme` (deep copy).
- En **"Personalizar"** el usuario sobreescribe cualquier token (control total). El `vibeId` se conserva como referencia/etiqueta pero los tokens mandan.
- El registro de Vibes vive en código (`lib/invite/vibes.ts`), no en DB: **agregar un vibe = agregar una entrada** (escala infinito sin migración).

### 3.1 Catálogo de Vibes (21) — v1

Cada Vibe = preset de tokens. Fuentes: Google Fonts (gratis). Cuerpo default: General Sans (fuente del sistema Anfiora) salvo que se indique.

| id | Nombre | Categoría | Font título | Fondo | Texto | Acento | Botón | Anim fondo |
|---|---|---|---|---|---|---|---|---|
| anfiora-claro | Anfiora Claro | elegantes | Josefin Sans | #ffffff | #1D1E20 | #48C9B0 | redondo/elevado | aurora (opc) |
| anfiora-noche | Anfiora Noche | elegantes | Josefin Sans | #1D1E20 | #f5f5f5 | #F4C430 (amarillo) + #48C9B0 | redondo/elevado | estrellas (opc) |
| romantico | Romántico | elegantes | Playfair Display italic | blush grad | #8a4a5e | #c76b86 | pill/relleno | — |
| botanico | Botánico | elegantes | Cormorant Garamond | verde grad | #3f5335 | #6b8455 | pill/relleno | — |
| dorado | Dorado clásico | elegantes | Cinzel | crema grad | #7a5f24 | #b8912f | recto/relleno | papel arrugado (opc) |
| fiesta | Fiesta | celebracion | Bungee Inline | morado→rosa | #fff | #ffe600 | pill/elevado | gradiente vivo |
| xv | XV años | celebracion | Great Vibes | rosa grad | #9b4a72 | #d98bb3 | pill/relleno | gradiente vivo |
| playa | Playa | celebracion | Pacifico | mar→arena | #0d5a6e | #e08a5b | pill/relleno | olas |
| kids | Kids | celebracion | Baloo 2 | multicolor | #3a2a5a | #3a2a5a | redondo/retro3d | confeti |
| 70s | Setentas | retro | Rowdies | mostaza grad | #fdf0d5 | #fdf0d5 | pill/retro3d | gradiente vivo |
| 80s | Ochentas | retro | Audiowide | #140a2e | neón grad | #00e5ff | recto/neon | grid synthwave |
| 90s | Noventas | retro | Titan One | #14b5b0 | #fff | #ffe600 | recto/retro3d | halftone pop |
| y2k | Y2K | retro | Orbitron | cromo grad | #5a2a8a | #7a3bd4 | pill/cromo | grid synthwave |
| rock | Rock and roll | musica | Anton | #0a0a0a | #fff | #e11d1d | recto/relleno | — |
| disco | Disco | musica | Monoton (multicolor) | radial oscuro | multicolor | #e0c04a | pill/degradado | bola disco / bokeh |
| electro | Electrónica | musica | Michroma | #03060a | #39ff88 | #2ee0ff | recto/neon | grid / bokeh |
| jazz | Jazz / lounge | musica | Limelight | vino grad | #e8c98a | #c99a4a | pill/contorno | estrellas / bokeh |
| verano | Verano | temporada | Quicksand | sol grad | #fff | #ff7a52 | pill/relleno | gradiente vivo / olas |
| primavera | Primavera | temporada | Cormorant Garamond italic | pastel grad | #6a7a4a | #c76b9b | pill/relleno | pétalos |
| otono | Otoño | temporada | Prata | ámbar grad | #fdeccd | #fdeccd | pill/relleno | hojas |
| invierno | Invierno | temporada | Bodoni Moda | hielo grad | #2a4a6a | #5a7a9a | pill/relleno | nevada / estrellas |

Notas:
- Auto-sugerencia: como Anfiora conoce la fecha del evento, el editor **propone** la temporada correspondiente (dic → Invierno) como Vibe inicial sugerido. Solo sugerencia, no forzado.
- Vibes de la lista de deseos (post-v1): Pop, Urbano/reggaetón, Indie/folk, Banda, "Burbuja" (baby shower). India/Bollywood y Mexicano **descartados**.

### 3.2 Toolkit de fuentes (picker "Personalizar › Fuente")

Aplicables a **cualquier** Vibe, además de la fuente propia de cada uno. Todas gratis en Google Fonts:

- **Chunky:** Anton
- **Handwritten:** Caveat
- **High contrast serif:** Abril Fatface
- **Ink trap:** Fraunces
- **Variable:** Bricolage Grotesque
- **Liquid:** Rubik Wet Paint
- **Bubble:** Bagel Fat One, Bungee Spice

(+ todas las fuentes de los Vibes quedan disponibles como opciones.)

Carga: subset dinámico de Google Fonts vía `next/font/google` o `<link>` con las familias efectivamente usadas por el doc (no cargar 26 familias siempre). Fuentes con `display: swap`.

### 3.3 Modelo de botón

- **forma:** `pill` (999px) · `redondo` (~10px, estilo Anfiora real) · `recto` (~2-4px)
- **estilo:** `relleno` · `contorno` · `degradado` · `elevado` (sombra suave) · `retro3d` (borde + sombra dura offset) · `neon` (glow) · `cromo` (degradado glossy con brillo)
- Corrección clave: **Anfiora = redondo 10px + sombra suave teal** (no pill). Referencia real en código: `rounded-[10px] bg-[#48C9B0] shadow-[0_2px_16px_rgba(72,201,176,.1)]`.

### 3.4 Fondos (~15 efectos)

Todos **CSS/SVG puro** (cero imágenes que cargar), **sutiles**, y respetan `prefers-reduced-motion` (se apagan). Efectos: gradiente vivo, confeti cayendo, grid synthwave, estrellas/brillo, olas, bokeh, pétalos, hojas de otoño, papel cuaderno, papel cuadrícula, aurora/mesh (colores de marca), halftone pop, papel arrugado (crema/kraft/noche, vía filtro SVG feTurbulence + feDiffuseLighting).

`fondo.tipo`: `solido` | `gradiente` | `imagen` (subida — **fuera de v1**, entra con epic de media) | `animado` (con `efectoId`).

### 3.5 Animaciones de RSVP (Sí / No)

Con Framer Motion + CSS. Se **auto-emparejan con el Vibe** pero son cambiables en "Personalizar". Todo el **copy es editable**.

**Sí (banco):** confeti · corazones subiendo · destellos elegantes · fuegos artificiales · globos · explosión de emojis · champán+burbujas · arcade/pixel ("PLAYER 2 JOINED") · tragamonedas 777 · bola disco+rayos · lluvia de estrellas.

**No (banco, temáticos por vibe):** cierre cálido default · empieza a llover (Verano/Playa) · se apagan las luces (Disco/80s) · corazón que se agrieta (Romántico) · matorral rodante con humor (default/Rock) · nevada+freeze (Invierno) · record scratch+abucheo (Rock/Retro).

Regla: el "No" nunca hace sentir culpa; es cálido o divertido, nunca confeti.

## 4. UX del editor

- **Desktop (Layout A):** panel de controles a la izquierda + preview de la invitación real a la derecha (sticky al hacer scroll). El preview usa el `InvitacionRenderer` compartido.
- **Mobile (WYSIWYG estilo Partiful):** la invitación **es** la superficie de edición (el preview mismo). Controles en **barra inferior** con chips (Vibe · Color · Fuente · Fondo · Efecto · Botón) que abren **hojas deslizables** desde abajo. Header Cancelar/Guardar. Sin botón separado de preview (el preview es la pantalla).
- **Estructura de controles:**
  1. **Vibes** (galería, categorizada) — puerta de entrada, 1 tap.
  2. **Personalizar** (progressive disclosure) — Color (principal/texto/acento/botón), Fuente (título/cuerpo, del toolkit), Fondo (tipo + efecto animado), Botón (forma + estilo), Animación RSVP (Sí/No), y edición de todo el copy.
  3. **Preview en vivo** siempre reflejando cambios.
- Autosave existente (800ms a `event_settings.invite_config`) se conserva; ahora también persiste `theme`.

## 5. Render

- `InvitacionRenderer` y las `sections/*.tsx` dejan de hardcodear colores/fuentes: leen del `theme` (vía context o props). Se introduce un **ThemeProvider** ligero (CSS variables: `--inv-fondo`, `--inv-texto`, `--inv-acento`, `--inv-boton-bg`, etc. + clases de fuente) que envuelve el render.
- El fondo animado se monta como capa detrás del contenido (z-index), con guard de `prefers-reduced-motion`.
- Un único punto de estilo → editor y público se ven idénticos (ya comparten renderer).

## 6. RSVP + post-confirmación

- Al confirmar (Sí) o declinar (No): corre la **animación** correspondiente como overlay y aterriza en la **tarjeta de estado**:
  - **Confirmado:** chip ✓ + "¡Listo, te esperamos!" + recap (fecha/hora/lugar + ver mapa) + botón **Agregar a mi calendario** (Google + `.ics`) + accesos rápidos (Sugerir canción, Mesa de regalos, Vestimenta, Itinerario, según lo que el evento tenga activo) + "**Editar mi respuesta**".
  - **Declinado:** cierre cálido/divertido según Vibe + "Editar mi respuesta".
- El invitado sigue pudiendo hacer scroll a toda la invitación. Todo el copy editable.
- Backend `POST /api/invitacion/[token]` sin cambios de contrato (sigue guardando rsvp_status/allergies); la pantalla es cliente.

## 7. Slug

- Ruta nueva: `/i/{slug}/{token}` (acorta `/invitacion/`). Se mantiene retro-compat con la ruta vieja (redirect 308) para links ya repartidos.
- **Slug persistido** en `event_settings` (nuevo campo `invite_slug` TEXT, único blando por dedupe con sufijo). Se genera automático de los nombres del evento (**A, default**) y es **editable** por el organizador con validación de disponibilidad en vivo (**B**).
- El **token** por invitado se conserva (identidad + seguridad; link único por invitado).

## 8. Accesibilidad y performance

- `prefers-reduced-motion`: apaga fondos animados y animaciones de RSVP (muestra estado final directo).
- Fondos 100% CSS/SVG (sin imágenes) → cero costo de red, buen rendimiento en móvil.
- Fuentes: cargar solo las familias usadas por el doc, `display: swap`.
- Contraste: los presets de Vibe garantizan contraste texto/fondo AA; en "Personalizar" se puede advertir (no bloquear) si el contraste queda bajo.

## 9. Fuera de alcance (epic 2 — Medios ricos)

Diferido explícitamente: **audio** (canción de fondo + notas de voz), **video** (subir o embed TikTok/IG), **imágenes/GIFs** (subida + buscador Giphy/Tenor), **fondo tipo imagen subida**. Serán nuevos tipos de bloque que **heredan** este sistema de diseño. Requieren bucket de Supabase, reproductor, reglas de autoplay/mute e integraciones externas. Se construye **después** de lanzar este epic.

## 10. Cambios en el esquema Supabase

- `event_settings.invite_config` (JSONB): ya existe; ahora guarda también `theme` (sin ALTER, es JSONB).
- `event_settings.invite_slug` (TEXT, nullable): **nuevo campo** para el slug persistido/editable. Único blando (dedupe en app). Requiere `ALTER TABLE event_settings ADD COLUMN invite_slug TEXT`.
- Sin tablas nuevas.

## 11. Fases sugeridas (para el plan)

1. **Fundaciones de tema:** `Theme` en schema (v2 + migración tolerante), `lib/invite/vibes.ts` (21 vibes), ThemeProvider + CSS variables, renderer leyendo tokens. Sin cambiar UI del editor todavía (aplica Vibe default = look actual ≈ Anfiora).
2. **Editor — Vibes + Personalizar + preview:** galería de Vibes, panel Personalizar (color/fuente/fondo/botón), carga dinámica de Google Fonts. Desktop Layout A.
3. **Editor mobile WYSIWYG** (barra inferior + hojas).
4. **Fondos animados** (~15 efectos + reduce-motion).
5. **Animaciones RSVP Sí/No** (banco + auto-emparejado + copy editable).
6. **Post-confirmación** (tarjeta confirmado/declinado + calendario + accesos rápidos + editar respuesta).
7. **Slug** (`invite_slug`, ruta `/i/…`, redirect legacy, editor de slug).

## 12. Riesgos / decisiones abiertas

- **Migración v1→v2:** debe ser 100% tolerante (docs viejos siguen funcionando con Vibe default). `resolveDoc` ya es tolerante; extender.
- **Carga de fuentes:** validar estrategia `next/font` vs `<link>` para familias dinámicas por-doc.
- **Contraste en control total:** advertir sin bloquear.
- **`event_settings.invite_slug`:** aplicar ALTER en Supabase solo con el código ya en `origin/main` (regla de sincronía).
```
