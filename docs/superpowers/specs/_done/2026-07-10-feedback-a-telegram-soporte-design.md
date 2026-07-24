# Feedback in-app -> bot de Telegram (@SoporteAnfioraBot)

Fecha: 2026-07-10
Estado: aprobado (brainstorming) — pendiente de plan de implementacion

## Contexto

Anfiora tiene hoy un boton flotante de feedback (`FeedbackWidget`) montado global
en `app/layout.tsx`, que abre un formulario de Tally. El patron de boton flotante
tapa contenido, compite con los CTA de cada pantalla y en mobile se encima con el
bottom-nav y los FAB de WhatsApp.

Este spec cambia dos cosas respecto al spec previo
(`2026-07-07-feedback-usermenu-y-tours-design.md`):

1. **Destino:** el feedback deja de ir a Tally y pasa a un bot de Telegram
   dedicado, `@SoporteAnfioraBot`. Diego recibe los mensajes como DM del bot.
2. **Alcance reducido:** NO se consolida el `UserMenu`. Solo se agrega el
   disparador de feedback a los menus de avatar que ya existen. El tour de
   producto (driver.js) queda fuera de esta tanda.

El objetivo es simple: recibir **sugerencias, notas o errores** de los usuarios,
sin nada extravagante.

## Estado actual (lo que ya existe)

- `app/components/FeedbackWidget.tsx` — boton flotante negro que dispara Tally
  `oblyB5`. Montado en `app/layout.tsx`. Solo se muestra con sesion.
- `app/events/[id]/layout.tsx` — contiene `AvatarDropdown` inline (menu de avatar
  con "Mi perfil" y "Cerrar sesion"), renderizado en 3 puntos (sidebar expandido,
  sidebar colapsado, bottom-nav mobile).
- `app/dashboard/page.tsx` — tiene un boton/acceso a "Mi perfil" suelto (~linea
  612), no un menu completo.
- Ya existe infra de Telegram: bot de alertas de Sentry
  (`TELEGRAM_ALERT_BOT_TOKEN`, webhook `/api/webhook/sentry`) y el bot de eventos
  `@AnfioraEventosbot`. El envio a la API de Telegram es un `fetch` a
  `https://api.telegram.org/bot<TOKEN>/sendMessage`.
- Auth es client-side (Supabase, localStorage — NO cookies). El middleware
  (`proxy.ts`) pasa todo through; los checks viven en las paginas.

---

## Decision

Eliminar el boton flotante de Tally. En su lugar, un item **"Enviar feedback"** en
el menu de avatar existente abre un modal chico (Tipo + texto libre) que postea el
mensaje a `@SoporteAnfioraBot` via la API de Telegram. Diego lo recibe como DM.

Tipos de feedback: **Sugerencia | Nota | Error** (mapean a lo que Diego quiere
recibir).

## Piezas

### 1. `lib/feedback.ts` — logica pura (testeable)

Funcion pura, sin I/O, testeable con Vitest:

```ts
export type FeedbackType = 'sugerencia' | 'nota' | 'error'

export type FeedbackPayload = {
  type: FeedbackType
  message: string
  page: string                 // pathname desde donde reportan
  user: { name: string; email: string; plan: string }
  eventName?: string           // si la ruta es de un evento
}

export function formatFeedbackMessage(p: FeedbackPayload): string
```

- Arma el texto para Telegram con un prefijo por tipo
  (`[SUGERENCIA]` / `[NOTA]` / `[ERROR]`) y las lineas de metadata (nombre, correo,
  plan, pagina, evento). Texto plano — nada de parse_mode HTML/Markdown para
  evitar romper con caracteres especiales del mensaje del usuario.
- Tambien exporta `FEEDBACK_TYPES` (array con label en espanol) para el select del
  modal, fuente unica de verdad.

Tests (`lib/feedback.test.ts`):
- Cada tipo produce su prefijo correcto.
- La metadata (correo, plan, pagina) aparece en el mensaje.
- Un mensaje con caracteres especiales no rompe el formato.
- `eventName` opcional se incluye solo si viene.

### 2. `app/api/feedback/route.ts` — POST

- Recibe `{ type, message, page }` en el body y el access token de Supabase en el
  header `Authorization: Bearer <token>` (lo manda el cliente con la sesion
  actual).
- Valida el token con el cliente service-role
  (`supabase.auth.getUser(token)`) para obtener el usuario **real** — no se confia
  en identidad enviada por el cliente. De `users` saca `full_name` y `plan`.
- Si `page` corresponde a un evento (`/events/<id>/...`), consulta el nombre del
  evento para incluirlo (best-effort; si falla, se omite).
- Valida: `type` en el enum, `message` no vacio y con tope de longitud
  (p. ej. 2000 chars). Si falla validacion -> 400.
- Llama `formatFeedbackMessage(...)` y hace `fetch` a
  `https://api.telegram.org/bot${TELEGRAM_SUPPORT_BOT_TOKEN}/sendMessage` con
  `{ chat_id: TELEGRAM_SUPPORT_CHAT_ID, text }`.
- Responde `{ ok: true }` en exito; `{ ok: false }` + status de error si Telegram
  falla, para que el modal muestre "reintentar".
- Si faltan las env vars -> 500 con log claro (no silencioso: el usuario debe
  saber que no se envio).

Env vars nuevas:
- `TELEGRAM_SUPPORT_BOT_TOKEN`
- `TELEGRAM_SUPPORT_CHAT_ID`

### 3. `app/components/FeedbackModal.tsx` — modal global

- Client component. Se monta **una sola vez** en `app/layout.tsx`, ocupando el
  lugar que deja `FeedbackWidget`.
- Escucha el evento `window` `anfiora:open-feedback`. Al abrir, captura el
  `pathname` actual (`window.location.pathname`) para mandarlo como `page`.
- Contenido:
  - Titulo corto ("Enviar feedback").
  - Select de **Tipo** (Sugerencia / Nota / Error) — usa `FEEDBACK_TYPES`.
  - Textarea "Cuentanos..." (autofocus).
  - Boton **Enviar** teal `#48C9B0`.
- Estados: `idle -> enviando -> enviado | error`.
  - `enviando`: boton deshabilitado con spinner.
  - `enviado`: mensaje de gracias, cierra solo (~1.5 s) y resetea.
  - `error`: aviso + permitir reintentar.
- Al enviar: obtiene el access token con `supabase.auth.getSession()` y hace
  `POST /api/feedback` con el header `Authorization`.
- Estilo flat, blanco, consistente con los modales existentes. **Sin emojis**
  (regla de UI). Cierra con overlay/Escape/boton X.

### 4. Disparador "Enviar feedback" en los menus existentes

No se crea un `UserMenu` nuevo. Se agrega el item en los dos lugares donde ya
vive el acceso a cuenta:

- **`app/events/[id]/layout.tsx`** — agregar un item "Enviar feedback"
  (`MessageSquarePlus`) al `AvatarDropdown`, entre "Mi perfil" y "Cerrar sesion".
  Como el dropdown se renderiza en 3 puntos, el item va en el componente/bloque
  compartido para no duplicar logica. El `onClick` solo despacha
  `window.dispatchEvent(new CustomEvent('anfiora:open-feedback'))` y cierra el
  menu.
- **`app/dashboard/page.tsx`** — agregar el mismo acceso "Enviar feedback" junto
  al boton/menu de perfil existente. Mismo despacho de evento.

### 5. Limpieza

- **Borrar** `app/components/FeedbackWidget.tsx`.
- **Editar** `app/layout.tsx` — quitar `<FeedbackWidget />`, montar
  `<FeedbackModal />`. Se elimina la carga del script de Tally (`embed.js`) de
  esta ruta; si Tally no se usa en ningun otro lado, queda fuera.

## Setup manual (lo hace Diego, una vez)

1. El bot ya existe: `@SoporteAnfioraBot`. Obtener su token de BotFather.
2. Abrirle conversacion al bot y mandarle cualquier mensaje ("hola") para que
   exista un chat.
3. Obtener el `chat_id` del DM con una llamada a
   `https://api.telegram.org/bot<TOKEN>/getUpdates` (Claude pasa el comando exacto
   en la implementacion).
4. Poner `TELEGRAM_SUPPORT_BOT_TOKEN` y `TELEGRAM_SUPPORT_CHAT_ID` en Vercel
   (Production/Preview) y en `.env` local.

No hace falta grupo — el feedback llega como DM al chat privado con el bot.

## Fuera de alcance

- Tour de producto (driver.js) — otra tanda; el spec previo lo cubre.
- Consolidar el `UserMenu` en un componente unico — se deja el `AvatarDropdown`
  inline como esta.
- Feedback en paginas publicas (landing, invitacion, playlist publica) — no hay
  sesion ahi.
- Guardar el feedback en Supabase — no toca la DB, no hay tabla nueva. Telegram es
  el unico destino.
- Analytics de feedback (PostHog) — se puede sumar despues.

## Verificacion

- **Vitest** para `lib/feedback.ts` (logica pura).
- **Manual (local -> preview -> main)** para lo demas:
  - El item "Enviar feedback" aparece en el menu de avatar (evento y dashboard).
  - El modal abre, envia, muestra gracias y cierra.
  - Llega el mensaje a `@SoporteAnfioraBot` con el tipo, texto y metadata correctos.
  - Un error de red muestra "reintentar".
  - Ya no existe el boton flotante en ninguna pantalla.

## Riesgos / notas

- El token de Telegram vive solo server-side (env var, nunca en el cliente). El
  cliente solo llama a `/api/feedback`.
- La validacion del token de Supabase server-side evita feedback anonimo con
  identidad falseada. Si el token no es valido -> 401 (no se envia).
- Tope de longitud del mensaje para no exceder el limite de Telegram (~4096 chars)
  ni recibir spam gigante.
