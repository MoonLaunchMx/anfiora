# i18n de Anfiora — Motor de idiomas + traduccion de la app del planner

**Fecha:** 2026-07-24
**Estado:** Spec aprobado, listo para plan de Fase 1
**Alcance de este spec:** el motor de i18n (una sola vez) + la hoja de ruta de traduccion de la app interna del planner. Las superficies del invitado se apartan como feature aparte.

---

## 1. Problema y contexto

Anfiora tiene ~45,400 lineas en 258 archivos `.tsx/.ts` con el espanol **hardcodeado dentro del JSX**. No hay libreria de i18n. Lo unico bilingue hoy son 3 archivos publicos (`app/page.tsx`, `app/[segment]/SegmentClient.tsx`, `app/components/auth/AuthModal.tsx`) con un patron artesanal: objeto `translations[lang]` + `useState<Lang>('es')` local, **sin persistencia** (detecta `navigator.language` y lo olvida al recargar).

**Que empuja esto:** hay un cliente potencial angloparlante concreto, y ademas se deben dejar los cimientos para operar en ambos idiomas de forma permanente. No es un esqueleto vacio: se busca motor solido **y** cobertura real.

---

## 2. Decisiones tomadas (con su razon)

### 2.1 Dos idiomas, dos duenos del dato

Hay dos decisiones de idioma **distintas** que no se deben mezclar:

| Decision | Dueno del dato | Manda sobre | Fase |
|---|---|---|---|
| Idioma de la **cuenta** | `users.locale` | Toda la app interna del planner (dashboard, invitados, presupuesto, etc.) | 1 |
| Idioma del **evento** | `events.locale` | Todo lo **saliente** al invitado (WhatsApp, correos, invitacion, puerta, playlist). Al crear evento hereda el del planner. | 5 |

Un planner ingles en Miami puede tener invitados que hablan espanol; por eso lo saliente NO puede colgar del idioma de la cuenta.

### 2.2 Este spec ataca la **app del planner**

Elegido sobre "superficies del invitado". Es la app en el sentido literal del pedido y lo que permite venderle al cliente ingles.

### 2.3 Profundidad: **todo, hasta lo saliente**

Se traduce: UI (menus, botones, titulos, estados, errores, tablas) + contenido semilla (presupuesto y plantillas WhatsApp nacen en el idioma correcto) + lo saliente (changelog/What's New, correos, textos al invitado).

**Costo recurrente aceptado:** el changelog bilingue obliga a escribir cada release en dos idiomas para siempre. Se confirma al llegar a Fase 5.

### 2.4 Lo saliente habla el idioma del **evento**

Cada evento tiene su idioma (hereda el del planner al crearse, se puede cambiar). Es un solo campo nuevo (`events.locale`) y deja los cimientos para la feature del invitado sin construirla hoy.

### 2.5 Motor: **propio y tipado** (cero dependencias nuevas)

Respeta la regla "stack no cambiar". Descartados:
- **next-intl:** paquete nuevo; su diseno asume segmentos de URL por idioma, que iriamos a contracorriente sin usarlos.
- **URL por idioma (`/es` `/en`):** obligaria a reestructurar TODAS las rutas y romper links en circulacion, para un SEO que en pantallas detras de login no existe.

Ventaja clave del motor propio tipado: **las claves son tipos de TypeScript**. Si se migra una pantalla y falta una frase en ingles, `npm run build` **falla** — no llega a produccion.

### 2.6 Reparto: **por fases, camino del cliente**

Cada fase es una rama que se pushea y prueba sola. El motor no bloquea: una pantalla no migrada sigue mostrando su espanol hardcodeado.

---

## 3. Como funciona i18n bien hecho (modelo mental)

La idea central: **separar el texto del diseno**. Hoy el espanol esta pegado a la pantalla. Se divorcian: la pantalla pide una etiqueta (`boton_guardar`) y un **diccionario** aparte entrega la version del idioma correcto. La pantalla nunca sabe que idioma muestra. Una sola app, un diccionario con dos columnas; agregar un 3er idioma = agregar columna.

Las cuatro reglas que separan un i18n serio de uno de juguete:

1. **No pegar frases con cinta.** Cada frase completa es una sola pieza con huecos marcados: `"Tienes {n} invitados"`, no `"Tienes " + n + " invitados"`. El orden de palabras cambia entre idiomas.
2. **Uno vs. muchos.** Se usa `Intl.PluralRules` (ya en el navegador, trae las reglas de ~200 idiomas) en vez de `if`s.
3. **Fechas, numeros y dinero son formato, no texto.** Jamas se traducen a mano: se piden a `Intl` (`DateTimeFormat`, `NumberFormat`) segun el locale. `formatCurrency` ya existe y recibe el locale.
4. **Red de seguridad contra frases sin traducir.** El motor tipado hace que una clave presente en `es` y ausente en `en` **rompa el build**.

Ubicacion del idioma: Anfiora es tipo Notion/Linear (app detras de login, Google no ve las pantallas privadas) -> el idioma va en la **cuenta**, no en la URL. El estilo Airbnb (`/es` en la URL) solo sirve para SEO de paginas publicas, y la landing publica ya es bilingue con su propio truco.

---

## 4. Arquitectura del motor

```
lib/i18n/
  es.ts        fuente de verdad, objeto anidado marcado `as const`
  en.ts        tipado contra `typeof es` -> falta una clave y el build truena
  index.ts     tipo Locale, resolucion de claves, interpolacion, plurales
  context.tsx  <I18nProvider>, useT(), useLocale(), useSetLocale()
  format.ts    fechas, numeros y moneda con Intl nativo segun el locale
```

Responsabilidades:
- `es.ts` / `en.ts` — diccionarios. `en.ts` se declara con el tipo `typeof es` para forzar cobertura completa.
- `index.ts` — tipo `Locale = 'es' | 'en'`, funcion de resolucion de clave anidada, interpolacion de `{huecos}`, plurales via `Intl.PluralRules`.
- `context.tsx` — `<I18nProvider>` en el layout raiz; hooks `useT()`, `useLocale()`, `useSetLocale()`.
- `format.ts` — envoltorios sobre `Intl.DateTimeFormat` / `Intl.NumberFormat`; reusar/extender `formatCurrency` de `lib/types.ts`.

Uso en pantalla:
```tsx
const t = useT()
<h1>{t('invitados.titulo')}</h1>
<p>{t('invitados.confirmados', { n: 42 })}</p>
t(`presupuesto.categoria.${cat}`)   // 'Banquete' -> 'Catering' (etiqueta; el valor DB no cambia)
```

### Persistencia y arranque
- Verdad: `users.locale`. Espejo en `localStorage` para pintar la primera pantalla sin parpadeo antes de que responda Supabase.
- Usuario nuevo: arranca con `navigator.language` (es/en; cualquier otro cae a `es`).
- El provider corrige el `<html lang="es">` hoy hardcodeado en `app/layout.tsx` a dinamico (accesibilidad + traductor del navegador).

### El selector
- Campo en `/perfil`, junto a nombre y telefono (es preferencia de cuenta).
- Acceso directo en el menu de usuario del sidebar.
- **Sin banderas ni emojis** (regla del proyecto): texto `Español` / `English`. Nota: el toggle de la landing usa emojis de bandera y NO se replica.

### Limite explicito (evita un bug futuro feo)
El provider expone el idioma **de la cuenta**. Las paginas publicas (invitacion, puerta, playlist, mesa de regalos) cuelgan del mismo layout raiz pero **NO deben consumirlo** — leeran `events.locale` en Fase 5. Cablear `users.locale` en una pantalla de invitado es un bug esperable; queda prohibido por diseno.

---

## 5. Modelo de datos

### Hallazgos de la inspeccion (SQL de solo lectura, 2026-07-24)
- **No existe ninguna columna de idioma** en toda la base (`locale`/`lang`/`idioma` -> 0 filas). No se duplica nada.
- `users` tiene una columna `settings jsonb` **muerta**: `.settings` da 0 usos en `.ts/.tsx`. Se descarta meter el idioma ahi (esconderia el dato). Se usa **columna dedicada**.
- RLS de `users`: `users_update_own` con `qual (auth.uid() = id)`. El planner **si puede** escribir su propia fila -> el selector guardara `users.locale` sin tocar RLS. (El bug de /admin que no persiste el plan es otra cosa: ahi el admin edita la fila de OTRO, que RLS bloquea.)
- `events` no tiene campo de idioma; tiene `currency default 'MXN'`. `events.locale` es nuevo y se agrega en Fase 5.

### SQL de Fase 1 (una sola columna)
```sql
-- users.locale: idioma de la cuenta del planner
alter table public.users
  add column locale text not null default 'es';

alter table public.users
  add constraint users_locale_check check (locale in ('es', 'en'));
```
No se toca RLS. `events.locale` se difiere a Fase 5 con el mismo patron.

### Orden de despliegue (regla de sincronia Supabase <-> Vercel)
1. Primero el codigo que **lee** `locale` con fallback a `'es'` cuando la columna aun no exista.
2. Se pushea a `main` y se verifica.
3. Recien entonces se corre el `ALTER`. Asi ni preview ni prod truenan en el intervalo.

---

## 6. Fases (extraccion de frases)

Cada fase es una rama, se pushea y se prueba sola. Tamanos de archivo entre parentesis como referencia de esfuerzo.

| Fase | Que entra | Por que aqui |
|---|---|---|
| **1 — Motor + shell** | `lib/i18n` completo, provider en layout raiz, `users.locale`, selector en `/perfil` + menu de usuario, `<html lang>` dinamico. Migra el **shell**: layout de evento (809), sidebar, bottom nav, menu de usuario. | Es lo que se ve en *toda* pantalla. Sin esto, cambiar idioma no se nota. |
| **2 — Camino critico** | AuthModal (ya bilingue, solo conectar al motor), dashboard (787), NewEventModal (698), invitados (2140 — la mas grande), configuracion (1065). | El recorrido exacto del cliente ingles: entra, crea evento, carga invitados, configura. Al terminar la Fase 2 ya se le puede vender. |
| **3 — Finanzas** | Presupuesto (822), proveedores + modales, pagos (768). Traducir las 14 `BudgetCategory` como **etiquetas** (valor DB sigue en espanol; se traduce al pintar). | Bloque cohesivo, se prueba junto. |
| **4 — Resto de modulos** | Timeline (628), mesas (1744), comida, mensajes (1079), album, playlist (planner). | Modulos de uso posterior, no del primer dia. |
| **5 — Saliente** | `events.locale`, plantillas WhatsApp, correos, respuestas del agente, changelog/What's New. | Distinto dueno del dato (idioma de evento). Es su propio subproyecto. |

### Apartados senalados, NO construidos aqui
- **Superficies del invitado** (invitacion, puerta, playlist publica, mesa de regalos): la otra feature apartada al inicio. Consumen `events.locale`, no `users.locale`. Fase/feature aparte.
- **Changelog bilingue** (Fase 5): costo recurrente de escribir cada release en dos idiomas. Se confirma al llegar.

### Que NO se traduce, por diseno
Lo que el planner escribio a mano: nombre del evento, notas, nombres de invitados, partidas que el nombro. Traducir contenido del usuario seria un error.

---

## 7. Testing

- **Vitest** para la logica pura del motor: resolucion de claves anidadas, interpolacion de `{huecos}`, seleccion de plural via `Intl.PluralRules`, fallback a `es` cuando falta clave o locale invalido, formateo de fecha/numero/moneda por locale.
- **Cobertura tipada como test:** `en.ts` tipado contra `typeof es` hace que una clave faltante rompa `npm run build`. Es la red de seguridad principal contra frases sin traducir.
- **UI y persistencia** (selector guarda en `users.locale`, espejo localStorage, `<html lang>` dinamico) se verifican manual por el flujo local -> preview -> main.

---

## 8. Ciclo de trabajo

Cada fase es su propio ciclo spec -> plan -> implementacion. Lo cerrado hoy es el **spec del motor + la hoja de ruta**. La **Fase 1** pasa de inmediato a plan detallado.
