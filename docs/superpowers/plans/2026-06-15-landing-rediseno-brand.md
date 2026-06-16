# Rediseño de la landing de marca — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `app/page.tsx` por la nueva landing de marca de Anfiora (7 secciones, bilingüe es/en, animaciones), siguiendo el spec `docs/superpowers/specs/2026-06-15-landing-rediseno-brand-design.md`.

**Architecture:** `app/page.tsx` queda como un client component delgado que mantiene el estado de idioma (`lang`) y de modales (auth + planes), y compone componentes de sección bajo `app/components/landing/`. El copy vive en un diccionario es/en (`i18n.ts`). Cada sección con animación pesada lleva su CSS Module co-localizado (porteado del mockup correspondiente). Los mockups en `.superpowers/brainstorm/manual-1/content/` son la **fuente de verdad del markup/CSS exacto**.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, CSS Modules (animaciones), Framer Motion (ya en stack), AuthModal existente.

**Convenciones del proyecto (obligatorias):**
- Sin suite de tests → verificación por tarea = `npm run lint` + `npm run build` + revisión visual en `npm run dev`.
- Archivo completo en cada cambio (no fragmentos). Un cambio a la vez. Commits convencionales **sin acentos** (`feat:`, `fix:`).
- UI **con acentos y ñ**, gramática cuidada, **sin comas de más**.
- No `git push`, no tocar Supabase. Trabajar en rama `feature/landing-brand` (no `main`).
- Mobile-first impecable. Botones y fuentes idénticos a la app.

---

## Estructura de archivos

```
app/
  page.tsx                         (MODIFICAR — compositor delgado, estado lang + modales)
  components/landing/
    i18n.ts                        (CREAR — tipos + diccionario es/en de TODO el copy)
    LandingNav.tsx                 (CREAR)
    Hero.tsx + Hero.module.css     (CREAR — titular rotativo + chat IA multicanal)
    SectionPain.tsx + .module.css  (CREAR — hilos enredados -> isotipo + pestañas de pains)
    SectionPlatform.tsx + .module.css (CREAR — segmented + master-detail + mini animaciones)
    SectionAgent.tsx + .module.css (CREAR — chat del agente en bucle)
    SectionExcel.tsx + .module.css (CREAR — excel -> lista Anfiora)
    SectionAudience.tsx + .module.css (CREAR — 2 cards anfitrion/planner)
    SectionClose.tsx + .module.css (CREAR — CTA seccion + footer negro)
    PlansModal.tsx                 (CREAR — modal de planes reusado por varios CTAs)
public/images/
    isotipo-flat.svg               (CREAR — isotipo a color SIN los 2 <rect> de fondo)
```

Regla de datos: las features/animaciones por categoría (sección plataforma) y los pains (sección 2) se definen como **arrays tipados dentro de su componente**, con el texto saliendo de `i18n.ts` por clave.

---

## Task 1: Preparar el asset del isotipo limpio

**Files:**
- Create: `public/images/isotipo-flat.svg`

- [ ] **Step 1: Generar el SVG sin los rects de fondo**

Run (Git Bash):
```bash
node -e "const fs=require('fs');let s=fs.readFileSync('public/images/isotipo.svg','utf8');s=s.split('<rect x=\"-150\" width=\"1800\" fill=\"#ffffff\" y=\"-149.999993\" height=\"1799.99992\" fill-opacity=\"1\"/>').join('');fs.writeFileSync('public/images/isotipo-flat.svg',s);console.log('rects restantes:',(s.match(/<rect/g)||[]).length)"
```
Expected: `rects restantes: 0`

- [ ] **Step 2: Verificar visualmente** que `public/images/isotipo-flat.svg` se ve a color (arco teal + reloj) con fondo transparente, abriéndolo en el navegador sobre fondo claro.

- [ ] **Step 3: Commit**
```bash
git add public/images/isotipo-flat.svg
git commit -m "chore: isotipo a color sin fondo para landing"
```

Nota: `isotipoylogo.svg` (logo completo) se usa tal cual en el footer con `filter:brightness(0) invert(1)`.

---

## Task 2: Diccionario i18n y tipos

**Files:**
- Create: `app/components/landing/i18n.ts`

- [ ] **Step 1: Crear el diccionario** con la forma:

```ts
export type Lang = 'es' | 'en'

export const landingCopy = {
  es: {
    nav: { platform: 'Plataforma', planners: 'Para planners', login: 'Iniciar sesión', cta: 'Solicitar acceso' },
    hero: {
      eyebrow: 'La plataforma de los mejores organizadores del mundo',
      line1: 'No administras', line3a: 'Diriges ', line3em: 'momentos',
      rotating: ['eventos','bodas','galas','bautizos','cumpleaños','XV años','conferencias'],
      sub1: 'Todo en un solo lugar', sub2: ' y un agente de IA que te acompaña. No más apps sueltas.',
      cta1: 'Solicitar acceso', cta2: 'Ver el concepto',
      fine: 'Acceso por invitación · Para anfitriones y para planners profesionales',
      agentName: 'Agente Anfiora',
      channels: ['WhatsApp','Instagram','Messenger','Telegram'],
      // pares (mensaje invitado, respuesta IA) por canal — ver Hero.tsx
    },
    pain: { title: '¿Así se organiza tu evento hoy?', /* tabs: ver SectionPain */ },
    platform: { eyebrow: 'La plataforma', title1: 'Para cada evento, ', titleEm: 'todo en su lugar',
      cats: { social: 'Social', corp: 'Corporativo', impact: 'Impacto' } /* + modulos */ },
    agent: { /* ... */ },
    excel: { /* ... */ },
    audience: { /* ... */ },
    close: { /* ... */ },
    footer: { /* ... */ },
  },
  en: { /* MISMA forma, traducido — ver Task 10 */ },
} as const
```

(El contenido completo de cada sección se llena al construir su componente; en este task crear al menos `nav` y `hero` completos en es/en para desbloquear Hero. El resto se agrega en su task y se traduce en Task 10.)

- [ ] **Step 2: Verificar** `npm run lint` (sin errores de tipos en el archivo).

- [ ] **Step 3: Commit** `git commit -am "feat(landing): i18n scaffolding es/en"`

---

## Task 3: Compositor `page.tsx` + Nav

**Files:**
- Modify: `app/page.tsx` (reemplazo completo)
- Create: `app/components/landing/LandingNav.tsx`

- [ ] **Step 1: `page.tsx`** — client component que:
  - mantiene `const [lang,setLang]=useState<Lang>('es')` y detecta `navigator.language` (como la landing actual).
  - mantiene `authOpen`/`authTab` y `plansOpen`.
  - declara `<html lang={lang}>`? No: `lang` del `<html>` se setea en `app/layout.tsx`; aquí solo togglear el contenido. (Mitigación React+GoogleTranslate: ver Task 10.)
  - renderiza `<LandingNav .../>`, todas las secciones en orden (Hero, Pain, Platform, Agent, Excel, Audience, Close), `<AuthModal/>` y `<PlansModal/>`.
  - pasa `t={landingCopy[lang]}` y callbacks `openAuth`, `openPlans` a cada sección.

- [ ] **Step 2: `LandingNav.tsx`** — portar nav del mockup `hero-light-v7.html`: logo (`/images/isotipoylogo.svg`), links es/en, toggle idioma (🇲🇽/🇬🇧 como la landing actual), "Iniciar sesión" (abre auth login), "Solicitar acceso" (abre auth register o plans). Mobile: ocultar links secundarios (hamburguesa opcional fase 2).

- [ ] **Step 3: Verificar** `npm run dev`, abrir `/`: nav visible, toggle de idioma cambia textos del nav, botones abren AuthModal.

- [ ] **Step 4:** `npm run build` pasa.

- [ ] **Step 5: Commit** `git commit -am "feat(landing): compositor page + nav bilingue"`

---

## Task 4: Hero

**Files:**
- Create: `app/components/landing/Hero.tsx`, `app/components/landing/Hero.module.css`

- [ ] **Step 1: Portar `hero-light-v7.html`** a `Hero.tsx` + `Hero.module.css`:
  - Estructura grid copy/stage del mockup → CSS Module (clases `.hero`, `.eyebrow`, `.rot`, `.stage`, `.card`, etc.).
  - **Palabra rotativa:** `useState` index + `setInterval(2400)`; texto desde `t.hero.rotating`. Animación `wordIn` en el módulo.
  - **Chat IA multicanal:** portar el JS de tipeo + ciclo de canales a un `useEffect` con limpieza (`clearTimeout`/`clearInterval` en el return). Mensajes desde `t.hero` (pares por canal).
  - Botones: primario `openAuth('register')` (o `openPlans`), secundario scroll a sección plataforma.
  - Imágenes: ninguna (la tarjeta es CSS). 
  - **Limpieza de timers obligatoria** para evitar fugas en re-render por cambio de idioma.

- [ ] **Step 2: Verificar visual** en `/`: titular rotativo, chat tipeando y canales encendiendo en secuencia; responsive (angostar a mobile: una columna, botones full-width, sin scroll horizontal).

- [ ] **Step 3:** `npm run lint` + `npm run build` pasan.

- [ ] **Step 4: Commit** `git commit -am "feat(landing): hero con titular rotativo y agente IA"`

---

## Task 5: Sección Pain ("¿Así se organiza tu evento hoy?")

**Files:**
- Create: `app/components/landing/SectionPain.tsx`, `SectionPain.module.css`

- [ ] **Step 1: Portar `section-manifiesto-v14.html`:**
  - Izquierda: hilos SVG (drift) + chips dispersos; al **clic** en el stage, `toggle` clase `calm` → chips colapsan, isotipo (`/images/isotipo-flat.svg`) aparece respirando + 3 pulsos. Estado con `useState(calm)`.
  - Derecha: `MODS` array (clave + color + posición) con `head/desc/price` desde `t.pain.tabs`. Pestañas (`useState(active)`), panel muestra solo el pain + chip de precio (rojo si paga, gris si Excel).
  - CTA de cierre: "Todo esto, en un solo lugar." + "Ver planes" → `openPlans`.
  - Mobile: una columna, animación arriba.

- [ ] **Step 2: Agregar `pain` a `i18n.ts`** (es completo; en se llena en Task 10): title + array de 8 tabs `{name, head, desc, price, free}`.

- [ ] **Step 3: Verificar visual** (clic en animación caos↔calma, cambio de pestañas, isotipo a color sin cuadrado) + responsive.

- [ ] **Step 4:** `npm run lint` + `npm run build`.

- [ ] **Step 5: Commit** `git commit -am "feat(landing): seccion pain con animacion y pestanas"`

---

## Task 6: Sección Plataforma

**Files:**
- Create: `app/components/landing/SectionPlatform.tsx`, `SectionPlatform.module.css`

- [ ] **Step 1: Portar `section3-plataforma-v8.html`:**
  - Segmented control 3 categorías (Social/Corporativo/Impacto) con píldora deslizante (`useState(cat)`; medir `offsetLeft/Width` del botón activo con `useRef` + `useLayoutEffect`).
  - Maestro-detalle: lista de features (clic, **no hover**), `screen` muestra la mini animación de la feature activa.
  - **Mini animaciones** como sub-componentes o templates por clave: `confirm` (persona cambia estado), `qr` (escaneo), `album` (carrusel — usar fotos en `/images/landing/album-*.jpg`; placeholder Unsplash en dev, ver decisión #6), `playlist` (canciones + tag de etapa), `mesas` (lienzo pista/bocinas/mesas con dots), `regalos` (registry + fondo luna de miel), `donaciones` (recaudación), `finanzas` (barra), `proveedores` (cards+estrellas).
  - Datos `MODS`/`CATS` tipados; texto desde `t.platform`.
  - Mobile: ilustración arriba, features en grid abajo; etiquetas de categoría cortas.

- [ ] **Step 2: Agregar `platform` a `i18n.ts`** (cats + por cada módulo `{name, desc}`; badge "Pronto"/"Soon" para check-in).

- [ ] **Step 3: Verificar visual** cada categoría y cada mini animación (clic, no hover); responsive.

- [ ] **Step 4:** `npm run lint` + `npm run build`.

- [ ] **Step 5: Commit** `git commit -am "feat(landing): seccion plataforma con mini animaciones"`

---

## Task 7: Sección Agente de IA

**Files:**
- Create: `app/components/landing/SectionAgent.tsx`, `SectionAgent.module.css`

- [ ] **Step 1: Portar `section4-agente.html`:** copy + capacidades (check) + chips de canales (WhatsApp activo, IG/FB/Telegram "pronto") desde `t.agent`. Teléfono con chat en bucle (`useEffect` con scheduler de `setTimeout` y limpieza en return; al desmontar/recambiar idioma, cancelar). Quitado "al vuelo" → "al instante".

- [ ] **Step 2: Agregar `agent` a `i18n.ts`** (eyebrow, title, lead, caps[], channels[], steps[] del chat).

- [ ] **Step 3: Verificar visual** (chat se reproduce y reinicia; sin fugas de timer al cambiar idioma) + responsive (visual abajo en mobile).

- [ ] **Step 4:** `npm run lint` + `npm run build`.

- [ ] **Step 5: Commit** `git commit -am "feat(landing): seccion agente de IA"`

---

## Task 8: Sección "Trae tu Excel"

**Files:**
- Create: `app/components/landing/SectionExcel.tsx`, `SectionExcel.module.css`

- [ ] **Step 1: Portar `section-excel.html`:** copy (sin eyebrow) + chips + botón "Importar mi Excel" (`openAuth('register')` o `openPlans`). Animación excel→flecha→lista Anfiora (filas en `rowcycle` loop CSS, chip "342 invitados importados"). Mobile: apilar en columna con flecha hacia abajo. Texto desde `t.excel`.

- [ ] **Step 2: Agregar `excel` a `i18n.ts`** (title, titleEm, lead con `<b>`, chips[], cta, filas demo, doneLabel).

- [ ] **Step 3: Verificar visual** + responsive (apilado).

- [ ] **Step 4:** `npm run lint` + `npm run build`.

- [ ] **Step 5: Commit** `git commit -am "feat(landing): seccion importar excel"`

---

## Task 9: Sección "Para quién" + Sección Cierre + Modal de planes

**Files:**
- Create: `app/components/landing/SectionAudience.tsx`, `SectionAudience.module.css`
- Create: `app/components/landing/SectionClose.tsx`, `SectionClose.module.css`
- Create: `app/components/landing/PlansModal.tsx`

- [ ] **Step 1: `SectionAudience.tsx`** — portar `section5-paraquien.html`: 2 cards (Anfitrión: "Gratis · hasta 50 invitados", CTA "Empezar gratis"; Planner: card menta + cinta "Para los mejores", "Desde $1,990 · por mes", CTA "Soy planner"). CTAs → `openPlans`. Texto desde `t.audience`.

- [ ] **Step 2: `SectionClose.tsx`** — portar `section6-cierre.html`: CTA como **sección completa** menta con isotipo watermark (`/images/isotipo-flat.svg`) + halo; footer **negro** full-width con logo real (`/images/isotipoylogo.svg`, `filter:brightness(0) invert(1)`), columnas Producto/Eventos/Compañía, copyright + social. Texto desde `t.close` y `t.footer`.

- [ ] **Step 3: `PlansModal.tsx`** — modal reusable (overlay + 3 planes con precios reales: Free $0 hasta 50 invitados / Pro $1,990 mes / Agency $3,990–4,990 mes). Botones de plan → por ahora `openAuth('register')` (cobro real se conecta cuando se defina paywall). Controlado por `plansOpen`/`setPlansOpen` desde `page.tsx`.

- [ ] **Step 4: Agregar `audience`, `close`, `footer`, `plans` a `i18n.ts`.**

- [ ] **Step 5: Verificar visual** (cards, CTA seccion sin recuadro, footer negro con logo blanco, modal abre desde varios CTAs) + responsive.

- [ ] **Step 6:** `npm run lint` + `npm run build`.

- [ ] **Step 7: Commit** `git commit -am "feat(landing): para quien, cierre y modal de planes"`

---

## Task 10: Traducción EN completa + i18n correcto + Google Translate

**Files:**
- Modify: `app/components/landing/i18n.ts` (completar bloque `en`)
- Modify: `app/layout.tsx` (si aplica, `lang` dinámico no es trivial en server layout; documentar)

- [ ] **Step 1: Completar TODO el bloque `en`** de `landingCopy` con traducción cuidada (no Google) de cada string usada en las 7 secciones, nav, footer y modal.

- [ ] **Step 2: Verificar** que al togglear idioma en `/` TODA la landing cambia es↔en sin texto hardcodeado en español.

- [ ] **Step 3: Mitigación React + Google Translate** — documentar y aplicar lo barato: (a) `<html lang="es">` declarado en layout; (b) en nodos de texto que cambian por estado, envolver en elementos estables (evitar cambiar `textContent` de un nodo que Google pudo traducir — preferir keys de React estables / re-montaje por `key={lang}`). Añadir `key={lang}` al contenedor raíz de la landing para forzar re-montaje limpio al cambiar idioma y evitar choques con nodos traducidos.

- [ ] **Step 4:** `npm run lint` + `npm run build`.

- [ ] **Step 5: Commit** `git commit -am "feat(landing): traduccion en completa y lang"`

---

## Task 11: QA responsive + accesibilidad básica + limpieza

**Files:** (ajustes menores en componentes/CSS según hallazgos)

- [ ] **Step 1: Revisión mobile** en anchos 360 / 390 (iPhone 14 Pro Max) / 768: ninguna sección desborda, sin scroll horizontal, botones full-width, animaciones escaladas.
- [ ] **Step 2:** Verificar que `lib`/imports muertos de la landing vieja se eliminaron y que `npm run lint` no reporta warnings nuevos.
- [ ] **Step 3:** `npm run build` final limpio.
- [ ] **Step 4: Commit** `git commit -am "fix(landing): qa responsive y limpieza"`

---

## Notas de verificación (en vez de TDD)

Cada task se valida con:
1. `npm run lint` — sin errores.
2. `npm run build` — compila.
3. **Revisión visual** en `npm run dev` (`/`): comportamiento descrito + responsive (DevTools responsive / angostar ventana). Usar el skill `run`/`verify` si se quiere screenshot.

No se hace `git push` ni merge a `main` sin OK explícito de Diego. Al terminar, usar `superpowers:finishing-a-development-branch`.

---

## Decisiones abiertas que afectan tasks (del spec)
- **Subtipos de Impacto:** pendientes (Diego, esta semana) — no bloquean (la sección plataforma no lista subtipos; afecta solo a futuras landings de nicho).
- **Fotos del álbum (Task 6):** sustituir Unsplash por imágenes propias en `/images/landing/` antes de producción.
- **IA en sección 3 / testimonios:** menores; no incluidos por defecto.
- **Precios del modal:** reales de hoy; reconfirmar al activar cobro.
