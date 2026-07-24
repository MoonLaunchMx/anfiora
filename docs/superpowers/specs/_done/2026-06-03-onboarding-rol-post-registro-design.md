# Onboarding post-registro: rol + foco de eventos

**Fecha:** 2026-06-03
**Estado:** Diseño aprobado, pendiente de plan de implementación
**Rama sugerida:** `feature/onboarding-rol`

## Objetivo

Capturar, una sola vez por cuenta, **quién es el usuario** (planner vs anfitrión) y **qué
tipos de evento le interesan**. El dato sirve para dos cosas:

1. **Métrica de negocio:** contar cuántos planners vs anfitriones hay (segmentación,
   panel `/admin`, decisiones de venta). Mapea directo al modelo de dos puertas del paywall.
2. **Personalización futura:** habilita adaptar la UI/onboarding por rol más adelante
   (fuera de alcance de este spec — aquí solo se captura el dato).

El rol es propiedad de la **cuenta**, no del evento (un planner crea muchos eventos), por
eso NO vive en el alta de evento ni en el `AuthModal` (que también usan colaboradores
invitados vía `/invite/[token]`).

## Alcance

Pantalla de onboarding post-registro de **2 pasos**, en ruta nueva `/bienvenida`, mostrada
**exactamente una vez** antes de llegar al dashboard.

### Ruta

`app/bienvenida/page.tsx` — componente `'use client'`, full-screen, UI en español, estilo
flat/teal del sistema (CTA teal `#48C9B0`, sin emojis, iconos Lucide).

### Trigger (doble red de seguridad)

Garantiza que nadie se escape y que se muestre una sola vez. La señal de "ya pasó el
onboarding" es **`users.role != null`** — no se necesita columna extra tipo
`onboarding_visto`. Por eso el paso 1 (rol) es **obligatorio**: si se permitiera saltarlo,
`role` quedaría `null` y se re-gatearía al usuario para siempre.

1. **Tras signup con sesión inmediata** (`handleRegister` en `AuthModal`): redirige a
   `/bienvenida` en vez de `/dashboard`.
2. **Catch-all en dashboard:** en `checkAuth()`, si `users.role IS NULL` → redirige a
   `/bienvenida`. Cubre a quienes confirman email (entran por login y se saltarían el
   punto 1) y a cualquier cuenta vieja sin rol.
3. **Auto-protección de `/bienvenida`:** al cargar, si `role` ya está seteado →
   redirige a `/dashboard`. No se puede re-disparar volviendo a la URL.

### Paso 1 — ¿Quién eres? (obligatorio)

Dos cards grandes seleccionables:

| Card | Valor guardado | Subtítulo |
|---|---|---|
| Planner / Organizador profesional | `role = 'planner'` | "Organizo eventos para mis clientes." |
| Anfitrión | `role = 'anfitrion'` | "Organizo mi propio evento (boda, XV, fiesta...)." |

Solo 2 roles. No hay un tercer "Particular": no tendría diferencia de cobro con
"Anfitrión", sería una columna con cero valor de negocio. La "persona cualquiera que
organiza su evento" cae en *anfitrión*.

No se puede avanzar al paso 2 sin elegir rol.

### Paso 2 — ¿Qué tipo de eventos? (multi-selección, opcional)

- Reutiliza los **16 tipos exactos** de `EVENT_TYPES`, agrupados visualmente por sus 3
  categorías (social / corporativo / impacto).
- Guarda los `value` seleccionados en `users.event_focus text[]` (ej. `['boda','xv']`).
- Label adaptable según rol del paso 1:
  - planner → "¿Qué tipos de eventos manejas?"
  - anfitrión → "¿Qué tipo de evento organizas?"
- El botón "Continuar" funciona aunque no se elija nada (no friccionamos: el dato duro
  —el rol— ya quedó capturado en el paso 1).

### Guardado y redirección final

Al terminar (botón del paso 2):

1. `update users set role = <rol>, event_focus = <array> where id = <user.id>`.
2. **Pulido anti doble-popup:** setear `localStorage.gf_welcomed = '1'` antes de redirigir,
   para que el welcome (`WhatsNewModal` / `showWelcome`, disparado por `gf_welcomed` en
   `checkAuth` del dashboard) NO aparezca en el mismo primer load del dashboard. Evita que
   el usuario nuevo se coma dos popups seguidos.
3. Redirigir a `/dashboard`.

## Refactor de soporte: fuente única de tipos de evento

Extraer `EVENT_TYPES` (y `CATEGORIES`, más el tipo `EventTypeConfig` / `EventCategory`)
desde `app/components/NewEventModal.tsx` a **`lib/event-types.ts`**, e importarlo en ambos
lados (el modal de alta + el onboarding paso 2).

**Requisito de extracción pura:**
- `NewEventModal` debe quedar **idéntico en comportamiento**.
- Los imports de iconos Lucide usados por la constante (`Gem`, `Crown`, `Cake`, etc.) se
  mueven limpios a `lib/event-types.ts` junto con la constante.
- `NewEventModal` pasa a importar `EVENT_TYPES` / `CATEGORIES` desde `lib/event-types.ts`
  y conserva solo los iconos que use fuera de la constante (`ChevronRight`, `ArrowLeft`,
  `X`, y el icono del tipo seleccionado vía `eventType.icon`).
- Sin cambios de `value` ni `label`: es la misma lista, en un solo lugar.

## Cambios de datos (SQL — lo corre Diego, NO Claude)

```sql
alter table users add column if not exists role text;
alter table users add column if not exists event_focus text[];
```

Sin valores enum a nivel DB (es `text` / `text[]` libre); los valores válidos los controla
el código (`'planner' | 'anfitrion'` para `role`; los `value` de `EVENT_TYPES` para
`event_focus`).

### Orden de despliegue (regla Supabase ↔ Vercel)

El código debe **tolerar** que `role` / `event_focus` aún no existan en la DB:

1. Se puede pushear el código primero; el SQL se corre después sin romper la app.
2. El onboarding solo **escribe** esas columnas. Si no existieran todavía, fallaría el
   guardado del onboarding (no la app en general). Idealmente: push código → correr SQL →
   verificar.
3. La lectura en `checkAuth` (`select role`) debe manejar el caso de columna ausente sin
   tronar el dashboard (degradar a "no redirigir" si la query falla).

## Fuera de alcance (YAGNI)

- **Fuente de adquisición** ("¿cómo nos conociste?"): no se incluye (no está en el SQL
  acordado). Posible 3ª columna futura.
- **Personalización de UI por rol:** solo se captura el dato; adaptar la UI es paso
  posterior.
- No se modifica `lib/types.ts` salvo que sea estrictamente necesario; no hay interfaz
  `User` central que romper.

## Criterios de éxito

- Un usuario nuevo (cualquier ruta de signup) ve `/bienvenida` exactamente una vez y no
  llega al dashboard sin haber elegido rol.
- `users.role` y `users.event_focus` quedan poblados y son consultables en agregado para
  la métrica planner-vs-anfitrión.
- `NewEventModal` se comporta idéntico tras el refactor.
- El usuario nuevo no ve dos popups seguidos (onboarding + welcome).
- `npm run lint` y `npm run build` pasan.
