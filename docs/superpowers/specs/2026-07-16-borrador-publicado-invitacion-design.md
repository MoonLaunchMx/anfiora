# Borrador vs publicado en la invitación

**Fecha:** 2026-07-16
**Estado:** aprobado en brainstorm, pendiente de plan de implementación

## El problema

Hoy la invitación **no tiene borrador**. Verificado en el código:

- `app/events/[id]/invitacion/page.tsx:122-126` — `updateDoc` autoguarda el documento **completo** (secciones, tema, textos, fecha límite) a `event_settings.invite_config`, 800 ms después de que el anfitrión deja de teclear.
- `handlePublish` (misma página, L128) **solo** prende `meta.publicada = true`. No hay una segunda copia.
- Las tres rutas públicas leen **ese mismo** `invite_config`: la puerta (`app/api/invitacion/[token]/route.ts`), el registro (`app/api/invitacion/[token]/registro/route.ts`) y la vista de WhatsApp (`app/invitacion/[slug]/[token]/page.tsx`, `generateMetadata`).

Consecuencia: **una vez publicada la invitación, cada edición está en vivo al instante** en los links que ya se repartieron, sin ningún aviso. El anfitrión corrige una fecha a medias, alguien abre el link en ese momento, y ve la versión rota. Para un producto que manda invitaciones a cientos de personas, es un riesgo operativo real.

Además, el botón "Publicada" con palomita se ve picable después de publicar: parece un **estado**, no una acción, lo que refuerza la confusión de que no hay nada más que hacer.

## El modelo

Se separa lo que el anfitrión **edita** de lo que los invitados **ven**:

```
edita  ──►  BORRADOR (privado)   ──[Publicar]──►  PUBLICADO (lo que ven los invitados)
```

- El anfitrión edita un **borrador privado**. Nadie más lo ve.
- Los invitados siguen viendo la **última versión publicada**.
- Los cambios salen **solo cuando el anfitrión publica**.

Es el patrón estándar de borrador/publicado. Lo pidió Diego con estas palabras: *"luego se hacen cambios ni se dan cuenta y no se ha republicado"*.

## Modelo de datos

### `event_settings` — una columna nueva

| Columna | Qué es |
|---|---|
| `invite_config` (ya existe) | **Lo publicado.** Lo que ven los invitados. |
| `invite_draft` (nueva, `jsonb`) | **El borrador.** Lo que edita el anfitrión. |

**Por qué `invite_config` se queda siendo lo publicado y no al revés:** las tres rutas públicas ya leen `invite_config`, y sirven a 971 links repartidos. Si `invite_config` sigue siendo lo publicado, **esas tres rutas no cambian ni una línea** y los links vivos no corren ningún riesgo. Solo el editor y su preview pasan a leer el borrador.

**Quién lee qué** (verificado con `grep invite_config`):

| Archivo | Lee | Cambia |
|---|---|---|
| `app/api/invitacion/[token]/route.ts` (puerta + RSVP) | publicado | no |
| `app/api/invitacion/[token]/registro/route.ts` (registro) | publicado | no |
| `app/invitacion/[slug]/[token]/page.tsx` (metadata WhatsApp) | publicado | no |
| `app/events/[id]/invitacion/page.tsx` (editor) | **borrador** | sí |
| `app/invitacion/preview/[id]/page.tsx` (preview del editor) | **borrador** | sí |

### Migración

```sql
alter table event_settings add column if not exists invite_draft jsonb;
update event_settings set invite_draft = invite_config where invite_config is not null;
```

Copiar `invite_config → invite_draft` en todos los eventos existentes hace que el editor arranque con lo que ya hay. Los eventos ya publicados quedan con `draft == config`, o sea **sin cambios pendientes** al inicio — que es lo correcto: publicar de nuevo no debe pedirse si no se ha tocado nada. Correr **antes** del código (columna nueva).

## Los tres estados

El sello arriba del editor tiene tres estados, derivados de dos datos: si lo publicado ya existe, y si el borrador difiere de lo publicado.

| Estado | Sello | Cuándo |
|---|---|---|
| **Borrador** | gris | `invite_config.meta.publicada === false` — nunca se ha publicado |
| **Publicada** | verde | publicada, y `draft` igual a `config` — nada pendiente |
| **Cambios sin publicar** | ámbar | publicada, y `draft` distinto de `config` |

**El estado ámbar solo existe cuando ya hay algo publicado.** Antes de la primera publicación siempre es "Borrador", aunque el borrador difiera del default — porque no hay invitados viendo nada todavía, así que no hay nada que "quedar sin publicar".

## Las acciones

### Publicar

- El botón dice **"Publicar cambios"** cuando el estado es ámbar; **"Publicar"** la primera vez (estado gris).
- Publicar **copia el borrador encima de lo publicado** (`invite_draft → invite_config`) y marca `meta.publicada = true` en ambos, para que queden idénticos y el estado vuelva a "Publicada".
- El repartir de `rsvp_token` que hoy hace `handlePublish` (L136-145) y el acuñar del `shared_token` (fase 2 de la puerta) **siguen ocurriendo al publicar** — no cambian.

### Descartar

- Un botón **"Descartar"**, tenue, a la izquierda de "Publicar cambios". **Visible solo en estado ámbar** (con cambios pendientes); desaparece cuando todo está publicado.
- Descarta = **revierte el borrador a lo publicado** (`invite_config → invite_draft`). El anfitrión vuelve a la versión que está viva sin deshacer a mano.
- Es destructivo (borra el trabajo desde la última publicación), así que **pide confirmación**: modal "¿Descartar los cambios? Tu invitación volverá a la última versión publicada. Lo que editaste desde entonces se pierde." Botón peligroso en rojo (`#cc3333`), lo fácil es cancelar.

## El aviso al salir (nivel medio)

Elegido por Diego sobre las alternativas suave y fuerte. Cubre los dos caminos de salir del editor con cambios pendientes:

1. **Navegar dentro de la app** (picar otro item del sidebar del evento) → **modal propio** de Anfiora: "Tienes cambios sin publicar. Lo que editaste todavía no lo ven tus invitados. ¿Publicarlo antes de salir?" Botones: "Publicar cambios" (teal) / "Salir sin publicar" (tenue).
2. **Cerrar la pestaña o recargar** → el `beforeunload` nativo del navegador (prompt genérico, no personalizable — es lo máximo que el navegador permite ahí).

**Complejidad técnica reconocida:** Next.js 16 App Router no ofrece un API para bloquear la navegación interna. El modal propio del caso 1 requiere que el **nav sepa si el editor tiene cambios pendientes**. La solución: un contexto ligero provisto en el layout del evento (`app/events/[id]/layout.tsx`), que envuelve al nav y al editor. El editor registra "hay cambios sin publicar" en ese contexto; el nav, al picar un item, si hay cambios, muestra el modal y espera la decisión antes de navegar. El aviso solo se arma en estado ámbar.

## La fecha límite

Va **junto con todo el borrador** (`meta.fecha_limite` en el draft), y aplica al publicar. Decisión de Diego por simplicidad: cambias la fecha, publicas, listo. Sin excepción de "aplica de inmediato". Coherente con el resto del contenido.

## Lógica pura testeable (Vitest)

- **`hayCambiosSinPublicar(draft, config): boolean`** — compara los dos documentos por contenido. La red contra falsos positivos (mismo contenido, distinto orden de keys) y falsos negativos. Es el corazón del estado ámbar.
- **`estadoPublicacion(draft, config): 'borrador' | 'publicada' | 'cambios'`** — deriva el estado del sello a partir de los dos documentos, aplicando la regla de que el ámbar solo existe cuando lo publicado ya existe.

## Fases

Cada una se para sola y se puede shipear.

1. **El núcleo: borrador separado.** Migración, el editor escribe al borrador, "Publicar cambios" copia al publicado, "Descartar" revierte, los tres estados del sello, el botón que cambia de texto. **Esto ya mata el problema:** las ediciones dejan de estar en vivo. El preview del editor lee el borrador.
2. **El aviso al salir.** `beforeunload` para cerrar/recargar, y la intercepción de la navegación interna con el modal propio (el contexto en el layout). Es la red de seguridad contra el olvido — el "nivel medio".

## Fuera de alcance

- **Historial de versiones / deshacer múltiple.** Solo hay un borrador y una versión publicada; no se guarda el pasado.
- **Programar la publicación** para una fecha/hora. No se pidió.
- **Vista previa de "lo que verán" vs "lo que edito" lado a lado.** El preview muestra el borrador; comparar ambos no entra.
- **Aviso al salir por sidebar en otras páginas** (mesas, timeline, etc.). Solo el editor de invitación tiene borrador; el aviso es exclusivo de ahí.

## Notas de construcción

- **El orden de migración va al revés de la "Regla crítica" de `CLAUDE.md`:** para columnas nuevas, la migración va **antes** que el código. La corre Diego en Supabase; Claude nunca toca la base.
- **El cliente de Supabase no está tipado**, así que `tsc` no valida nombres de columna en los `select`/`update`. Verificar `invite_draft` a mano contra la base.
- La comparación de documentos y la derivación del estado son funciones puras: ahí va la red de Vitest. El resto (el editor, el nav, los modales) se verifica manual por el flujo local → preview → main.
- **`handlePublish` ya hace varias cosas al publicar** (repartir `rsvp_token`, acuñar `shared_token`): el copiar borrador→publicado se suma ahí, no las reemplaza.
