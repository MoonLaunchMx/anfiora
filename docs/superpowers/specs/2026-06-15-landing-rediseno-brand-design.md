# Rediseño de la landing principal de Anfiora (página de marca)

**Fecha:** 2026-06-15
**Estado:** Diseño aprobado en mockups · pendiente de implementar
**Ruta a implementar:** `app/page.tsx` (reemplaza la landing actual)
**Mockups de referencia:** `.superpowers/brainstorm/manual-1/content/` (hero-light-v7.html, section-manifiesto-v14.html, section3-plataforma-v8.html, section4-agente.html, section-excel.html, section5-paraquien.html, section6-cierre.html)

---

## 1. Contexto y objetivo

La landing principal (`/`) deja de ser una página de bodas para convertirse en el **manifiesto de marca de Anfiora**: posicionarla como **la plataforma "papá de todos"** — el sistema operativo del organizador de eventos, no una appcita de un solo nicho.

- **No es una landing de nicho.** Bodas, XV, corporativos, etc. tendrán sus propias landings aparte. Esta es la de marca, agnóstica al tipo de evento.
- **Tono:** elite, aspiracional, en calma. "Trabajan con los mejores organizadores del mundo". Acceso por invitación.
- **Diferenciador protagonista:** el **agente de IA** que responde por ti en WhatsApp (y pronto Instagram, Facebook, Telegram).
- **Audiencia doble:** anfitriones (un evento) y planners profesionales (negocio). La única página que mantiene ambos es esta y la de precios.

---

## 2. Sistema de diseño

Se respeta la marca y se ejecuta con nivel "production-grade" (no AI-slop genérico).

**Paleta**
- Fondo: `#fbfaf7` (crema cálido). Superficie: `#ffffff`. Crema acento: `#f4efe7`.
- Tinta: `#1D1E20`. Texto sec: `#585957`. Muteado: `#9a9a96`.
- Teal marca: `#48C9B0`. Teal oscuro: `#0F6E56` / `#0b4e3d`.
- **Teal "amigable":** para estados activos NO usar teal sólido fuerte; usar menta suave `#eef9f5` / `#e2f4ec` con borde `#cdebe1` y acentos teal. (Feedback explícito: el teal sólido se ve muy fuerte.)
- Estados RSVP (reuso de la app): confirmado `#e1f5ee`/`#0F6E56`, pendiente `#faeeda`/`#854F0B`, declinado `#fcebeb`/`#A32D2D`.

**Tipografía (las de la app)**
- Display/títulos: **Satoshi** (700), tracking negativo (`-0.02em`).
- Cuerpo: **General Sans**.
- Marca "Anfiora": **Josefin Sans** (solo donde aplique branding textual).
- En los mockups se cargaron desde Fontshare (Satoshi, General Sans) y Google (Josefin). En la app ya existen como `@font-face` locales — usar las locales.

**Botones (idénticos a la app)**
- Primario: `bg #48C9B0`, texto blanco, `border-radius:12px`, `box-shadow:0 4px 16px rgba(72,201,176,.35)`, hover `#3ab89f`.
- Secundario: blanco, borde `#e0e0e0`, hover borde+texto teal.

**Logo (CRÍTICO — varios intentos fallaron)**
- `public/images/isotipo.svg` es el isotipo **a color** (arco teal + reloj oscuro + manecillas naranjas) PERO trae **dos `<rect>` blancos de fondo** que se ven como un cuadrado. Hay que **quitar esos rects** para tener fondo transparente. Renderiza bien **sobre fondo blanco/claro** (no sobre teal: el arco teal se pierde).
- `public/images/isotipoylogo.svg` es el **logo real completo** (isotipo + "ANFIORA" en mayúsculas espaciadas). En footer oscuro va en blanco con `filter:brightness(0) invert(1)` (mismo truco que el footer actual de la app).
- En implementación real estos son `<img src="/images/...">` servidos por Next; no requieren incrustar como en los mockups (eso fue solo porque el server de mockups no sirve assets sueltos).

**Motion**
- Reveal escalonado en hero, easing `cubic-bezier(.22,1,.36,1)`.
- Animaciones contenidas, "en calma". Framer Motion ya está en el stack.

**Mobile-first y ortografía**
- Todo debe verse impecable en mobile (iPhone 14 Pro Max incluido). Botones a ancho completo, nav colapsado, animaciones que no desbordan.
- Copy en español correcto **con acentos y ñ**, gramática cuidada, **sin comas de más**.

---

## 3. Secciones (orden final)

### Sección 1 — Hero
- **Eyebrow:** "La plataforma de los mejores organizadores del mundo".
- **Título (Satoshi):** `No administras [palabra rotativa]` / `Diriges momentos` — "momentos" en teal.
  - Palabra rotativa (cada ~2.4s, slide-up): eventos → bodas → galas → bautizos → cumpleaños → XV años → conferencias. (Sin punto después de la palabra.)
- **Subtítulo (2 líneas en desktop, corrido en mobile):** "**Todo en un solo lugar** y un agente de IA que te acompaña. No más apps sueltas."
- **CTAs:** primario "Solicitar acceso" + secundario "Ver el concepto".
- **Fine print:** "Acceso por invitación · Para anfitriones y para planners profesionales".
- **Visual (derecha):** tarjeta del **Agente Anfiora** que tipea en vivo y enciende canales en secuencia (WhatsApp → Instagram → Messenger/Facebook → Telegram), con burbuja del invitado + respuesta de IA y sello "respondido por IA · RSVP actualizado". Halo/órbitas suaves.
- **Nav:** logo + "Plataforma", "Para planners", "Iniciar sesión" (bordeado), "Solicitar acceso" (teal). En mobile se ocultan links secundarios.

### Sección 2 — "¿Así se organiza tu evento hoy?" (el pain)
- **Título (pregunta):** "¿Así se organiza tu evento hoy?" (sin subtítulo, padding reducido). No menciona Anfiora.
- **Izquierda — animación por clic:** chips de apps sueltas dispersos con **hilos enredados** (caos) que van a la deriva. Al hacer **clic**, todo se reúne en el **isotipo** que queda **respirando/palpitando** (3 ondas teal). El isotipo va en círculo blanco, a color, sin cuadrado.
- **Derecha — pestañas (pains, sin mencionar Anfiora):** una pestaña por módulo; al hacer clic muestra solo **el dolor de hoy** + (cuando aplica) el costo. Sin etiqueta "Hoy", sin solución, sin títulos repetidos. Textos limpios:
  - Invitaciones — "Pagas el diseño de la invitación y a alguien más para que confirme a tus invitados." (hasta $1,200)
  - Galería de fotos — "Te llegan mil fotos por WhatsApp y se pierden entre tantas conversaciones después del evento."
  - Mesa de regalos — "Las plataformas externas cobran comisión por cada regalo y aun así se repiten." (hasta $7,000)
  - Playlist — "Reúnes las canciones una por una por WhatsApp o con un formulario interminable."
  - Acomodo de mesas — "Mueves los nombres en papel o en Excel y empiezas de cero cuando alguien cancela."
  - Presupuesto — "Lo mantienes a mano y entre tantas versiones nadie sabe cuál es la buena."
  - Pagos — "Anotas abonos y saldos en una hoja que pierdes de vista si no la actualizas."
  - Proveedores — "Guardas las cotizaciones en el correo, los contratos en WhatsApp y los teléfonos en notas."
- **CTA al cierre de la sección:** "Todo esto, en un solo lugar." + "Ver planes" (abre modal de planes).

### Sección 3 — La plataforma (la respuesta)
- **Eyebrow:** "La plataforma". **Título:** "Para cada evento, *todo en su lugar*."
- **Segmented control (3 categorías, etiquetas cortas):** **Social · Corporativo · Impacto** (píldora menta que se desliza). Sin subtipos listados.
- **Layout maestro-detalle, sin caja:** lista de herramientas a la izquierda (clic, NO hover); a la derecha una **mini animación limpia** de cada feature + una línea de "qué puedes hacer" (sin repetir el título).
- **Herramientas por categoría (curadas, no todas):**
  - **Social:** Invitados, Álbum con QR, Playlist, Acomodo de mesas, Mesa de regalos, Presupuesto y pagos.
  - **Corporativo:** Invitados, Check-in con QR, Presupuesto y pagos, Proveedores.
  - **Impacto:** Invitados, Check-in con QR, Mesa de donaciones, Presupuesto y pagos, Proveedores.
- **Mini animaciones (CSS/JS, en loop):**
  - Invitados: una persona que cambia de estado (Confirmado/Pendiente/Declinó) con colores RSVP.
  - Check-in con QR: código QR con línea de escaneo + check (badge "Pronto", sale la próxima semana).
  - Álbum: carrusel de **fotos reales** de eventos/bodas (en prod usar imágenes propias; en mockup se usó Unsplash).
  - Playlist: canciones reales agregándose (cover + título + artista + **tag de etapa**: Entrada, Cena, Brindis, Vals, Fiesta). Sin check verde.
  - Acomodo de mesas: lienzo tipo seating con **pista, bocinas y mesas con los círculos de invitados** (verde/ámbar/rojo), con zoom-out.
  - Mesa de regalos: lista tipo registry (producto + precio + estado) con **Fondo de luna de miel** y avance.
  - Mesa de donaciones (impacto): total recaudado + barra de avance + tipos de donativo ("Donar").
  - Presupuesto y pagos: barra que se llena + montos ("se actualiza con cada pago").
  - Proveedores: tarjetas con estrellas que entran en stagger.
- **Mobile:** ilustración arriba, features como **menú en grid** abajo (no scroll horizontal).
- El **Agente de IA** NO se incluye aquí (tiene su sección propia); decisión revisable.

### Sección 4 — El agente de IA
- **Eyebrow:** "El agente de IA". **Título:** "Responde por ti, *día y noche*."
- **Lead:** "Un agente con inteligencia artificial atiende a tus invitados como lo harías tú: confirma, resuelve dudas y mantiene tu lista al día. Sin que muevas un dedo."
- **Capacidades (con check):** confirma asistencia y acompañantes; responde dudas (hora, lugar, código de vestimenta); registra cambios y alergias al instante; mantiene tu lista actualizada, sola.
- **Canales:** WhatsApp (activo) · Instagram · Facebook · Telegram (los tres "pronto", en punteado).
- **Visual (derecha):** teléfono con el Agente Anfiora atendiendo una conversación en bucle (pregunta hora → confirma 2 → registra nota vegetariana → chip "Lista actualizada · +2 confirmados · 1 nota"), con indicador de "escribiendo".

### Sección 4.5 — "¿Ya tienes todo en Excel? Tráelo en un clic." (puente de migración)
Va **entre el Agente de IA y "Para quién"**: mata el último miedo (migrar). Mockup: `section-excel.html`.
- **Título:** "¿Ya tienes todo en Excel? *Tráelo en un clic.*" (sin eyebrow, se repetía).
- **Lead (con empatía):** "Sabemos que le tienes cariño a ese archivo. **No empieces de cero:** sube tus hojas y en minutos tus invitados, tu presupuesto y tus mesas viven en Anfiora, ahora sí ordenados."
- **Chips:** Invitados · Presupuesto · Mesas. **CTA:** "Importar mi Excel".
- **Animación:** `invitados.xlsx` plano → flecha teal → lista de Anfiora que se llena con avatares + estados RSVP + chip "342 invitados importados". En mobile se apila (Excel → flecha abajo → lista).

### Sección 5 — Para quién (las dos puertas)
- **Eyebrow:** "Para quién". **Título:** "Para los dos lados *del evento*."
- **Card "Anfitrión":** "Organizas tu propio evento". Bullets: un evento + todas las herramientas; agente de IA para confirmaciones; listo en minutos. Precio: **Gratis · hasta 50 invitados**. CTA "Empezar gratis".
- **Card "Planner profesional" (destacada, menta + cinta "Para los mejores"):** "Vives de crear eventos". Bullets: eventos y clientes ilimitados; equipo y colaboradores con roles; número dedicado + agente de IA completo. Precio: **Desde $1,990 · por mes**. CTA "Soy planner".

### Sección 6 — Cierre (CTA + footer)
- **CTA: sección completa** (no card) a todo lo ancho, fondo degradado menta con isotipo watermark y halo que respira.
  - Eyebrow "Empieza hoy" → "El día llega una sola vez. Que te encuentre *en calma*."
  - Sub: "Reúne todo tu evento en un solo lugar y deja que el agente de IA haga el resto."
  - CTAs: "Solicitar acceso" (teal) + "Ver planes". Fine: "Acceso por invitación · sin tarjeta para empezar".
- **Footer negro** (`#1D1E20`), full width, **logo real** (isotipoylogo en blanco). Columnas: Producto / Eventos / Compañía. Abajo: "© 2026 Anfiora · Hecho en México" + iconos (Instagram, WhatsApp, correo).

---

## 4. Planes (precios reales de hoy)

Tomados de CLAUDE.md (MXN). El paywall sigue bloqueado por decisión de precios, así que estos son los vigentes documentados:
- **Free:** $0 · **hasta 50 invitados** · wa.me manual.
- **Pro:** $1,990/mes · número compartido · agente de IA.
- **Agency:** $3,990–4,990/mes · número dedicado · equipo.

Modal "Ver planes": tres planes para elegir y pagar en línea (en mockup quedaron de ejemplo; alinear con la decisión final de precios antes de implementar el cobro real).

---

## 5. Notas de implementación

- `app/page.tsx` es `'use client'`; reusar `AuthModal` para login/registro y abrir el modal de planes desde los CTAs.
- Logos desde `public/images/` (no incrustar). Procesar `isotipo.svg` para quitar los 2 `<rect>` blancos de fondo (o exportar una versión limpia y guardarla en `public/images/`).
- Reusar tokens de diseño de `app/globals.css` (teal `#48C9B0`, etc.); agregar las variables menta suaves si no existen.
- Estructura por componentes: extraer cada sección a su propio componente (`Hero`, `SectionPain`, `SectionPlatform`, `SectionAgent`, `SectionAudience`, `SectionClose`) para mantener archivos enfocados.
- Datos de las features/animaciones por categoría como arrays tipados (similar a los mockups) para que agregar/editar sea trivial.

---

## 6. Decisiones abiertas (confirmar antes de implementar)

1. **Bilingüe (es/en): RESUELTO — SÍ, bilingüe.** Mantener toggle es/en con copy de primera calidad en ambos. Además **Google Translate debe funcionar** para cualquier otro idioma: declarar `<html lang>` correcto, todo el copy como **texto real** (no dentro de imágenes/SVG; el logo es imagen y NO se traduce, correcto). **Ojo React + Google Translate:** reemplazar nodos traducidos puede romper la reconciliación de React (errores de removeChild); mitigar con keys estables y evitando toggles que reescriban nodos ya traducidos.
2. **Subtipos de "Impacto": PENDIENTE** — Diego trae la información esta semana (los actuales son tentativos).
3. **Agente de IA en sección 3:** hoy excluido (tiene sección 4 propia). ¿Dejarlo fuera?
4. **Sección de prueba social/testimonios:** se omitió. ¿Agregar antes del cierre cuando haya testimonios reales?
5. **Precios: RESUELTO — usar los reales actualizados** (Free $0 · hasta 50 invitados, Pro $1,990/mes, Agency $3,990–4,990/mes) hasta que cambie la decisión de paywall.
6. **Imágenes del álbum:** sustituir Unsplash por fotos propias/licenciadas para producción.
