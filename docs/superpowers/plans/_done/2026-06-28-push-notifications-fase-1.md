# Notificaciones Push — Fase 1 (Base + WhatsApp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar el pipeline Web Push end-to-end (suscribir un dispositivo desde /perfil y recibir una notificacion cuando un invitado responde por WhatsApp).

**Architecture:** Web Push estandar (VAPID) sobre la PWA ya instalable. Un nucleo de envio `lib/push.ts` (service role) que todos los disparadores reusan; handlers `push`/`notificationclick` en `public/sw.js` sin tocar el passthrough actual; suscripciones en la tabla nueva `push_subscriptions`; toggle de activacion en `/perfil`; primer disparador enganchado en el webhook de WhatsApp.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Supabase (service role en API routes) + `web-push` (VAPID) + Service Worker.

## Global Constraints

- Codigo completo, nunca fragmentos. Full file replacement, no edits parciales conceptuales.
- Sin tests automatizados (no hay suite; regla MVP). Verificacion = `npm run lint` + `npm run build` + prueba manual en dispositivo real.
- UI en espanol CON acentos. Sin emojis. CTA en teal `#48C9B0`. Estilo flat, solo Tailwind.
- Commits convencionales SIN acentos ni n (`feat:`, `fix:`). Terminar con la linea `Co-Authored-By` que pide el harness.
- Auth en API routes: header `Authorization: Bearer <access_token>` + `supabaseAdmin.auth.getUser(token)` (la sesion vive client-side, NO en cookies).
- NUNCA `git push` a main sin OK explicito de Diego. NUNCA instalar paquetes sin permiso. NUNCA tocar Supabase (schema/datos/RLS) antes de pushear el codigo correspondiente.
- Las VAPID keys las genera Diego con `npx web-push generate-vapid-keys` y las pega el mismo en Vercel y `.env.local`. El chat NO maneja las keys.
- Destinatarios de un evento: owner (`events.user_id`) + colaboradores `status='active'` con `role in ('admin','editor')`, excluyendo al actor. En el disparador de WhatsApp el actor es el invitado (no es un user), asi que no hay exclusion.

---

## File Structure

| Archivo | Accion | Responsabilidad |
|---|---|---|
| `package.json` | Modify | Agregar dependencia `web-push`. |
| `.env.local` | Modify (local, Diego) | VAPID keys + subject (no se commitea). |
| `lib/push.ts` | Create | Nucleo: `sendPushToUsers()` + `resolveEventRecipients()`. Limpia suscripciones muertas. |
| `public/sw.js` | Modify | Agregar handlers `push` y `notificationclick` sin tocar el passthrough. |
| `app/api/push/subscribe/route.ts` | Create | POST (upsert suscripcion) + DELETE (borrar por endpoint), auth Bearer. |
| `app/perfil/page.tsx` | Modify | Seccion "Notificaciones" con switch activar/desactivar en este dispositivo. |
| `app/api/webhook/whatsapp/route.ts` | Modify | Tras actualizar RSVP, disparar push a los destinatarios del evento. |
| `docs/superpowers/plans/2026-06-28-push-fase-1.sql` | Create | SQL de la tabla `push_subscriptions` + RLS (se aplica DESPUES de pushear). |

Orden de tareas pensado para que cada una sea verificable sola y para que el SQL quede listo pero sin aplicar hasta el final (prod-safety).

---

## Task 1: Dependencia `web-push` + scaffolding de env

**Files:**
- Modify: `package.json` (seccion `dependencies`)
- Modify: `.env.local` (solo local, lo edita Diego con sus keys)

**Interfaces:**
- Produces: paquete `web-push` disponible para `import webpush from 'web-push'`; variables `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` en runtime.

- [ ] **Step 1: Pedir permiso e instalar `web-push`**

PEDIR PERMISO A DIEGO antes de correr nada. Una vez autorizado:

```bash
npm install web-push
```

Esto agrega `web-push` a `dependencies` en `package.json` y `package-lock.json`. No se necesita `@types/web-push` (el paquete trae tipos propios desde v3).

- [ ] **Step 2: Generar las VAPID keys (lo hace Diego)**

Diego corre en su terminal y guarda la salida:

```bash
npx web-push generate-vapid-keys
```

Devuelve `Public Key` y `Private Key`. Diego las pega en `.env.local` y en Vercel (Production + Preview). El chat NO toca las keys.

- [ ] **Step 3: Documentar las env vars en `.env.local` (Diego)**

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key de web-push>
VAPID_PRIVATE_KEY=<private key de web-push>
VAPID_SUBJECT=mailto:diego.garza@moonlaunch.mx
```

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` es publica (la usa el navegador para suscribirse). `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` son solo de servidor.

- [ ] **Step 4: Verificar instalacion**

Run: `npm run build`
Expected: build OK, sin errores de modulo no encontrado.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(push): agrega dependencia web-push"
```

---

## Task 2: Nucleo de envio `lib/push.ts`

**Files:**
- Create: `lib/push.ts`

**Interfaces:**
- Consumes: env VAPID (Task 1); tabla `push_subscriptions` (creada en SQL, aplicada al final; en local Diego la crea antes de probar).
- Produces:
  - `type PushPayload = { title: string; body: string; url: string; tag?: string }`
  - `sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void>`
  - `resolveEventRecipients(eventId: string, actorUserId?: string): Promise<string[]>`

- [ ] **Step 1: Crear `lib/push.ts` completo**

```ts
import 'server-only'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const VAPID_SUBJECT = process.env.VAPID_SUBJECT
const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY

let configured = false

function ensureConfigured(): boolean {
  if (configured) return true
  if (!VAPID_SUBJECT || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[push] VAPID keys ausentes - push deshabilitado')
    return false
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
  return true
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type PushPayload = {
  title: string
  body: string
  url: string
  tag?: string
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return

  const ids = [...new Set(userIds)].filter(Boolean)
  if (ids.length === 0) return

  const supabase = admin()
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', ids)

  if (error || !subs || subs.length === 0) return

  const body = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        )
      } catch (err: any) {
        const status = err?.statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('[push] envio fallido', status, err?.message ?? err)
        }
      }
    })
  )
}

export async function resolveEventRecipients(eventId: string, actorUserId?: string): Promise<string[]> {
  const supabase = admin()
  const recipients = new Set<string>()

  const { data: event } = await supabase
    .from('events')
    .select('user_id')
    .eq('id', eventId)
    .single()
  if (event?.user_id) recipients.add(event.user_id)

  const { data: collaborators } = await supabase
    .from('event_collaborators')
    .select('user_id, role')
    .eq('event_id', eventId)
    .eq('status', 'active')
    .in('role', ['admin', 'editor'])
  for (const c of collaborators ?? []) {
    if (c.user_id) recipients.add(c.user_id)
  }

  if (actorUserId) recipients.delete(actorUserId)
  return [...recipients]
}
```

Notas: `server-only` evita que se importe por accidente desde un client component (filtraria la private key). El nucleo falla suave si faltan keys (no rompe el webhook). La limpieza de suscripciones muertas (404/410) es por fila/`id`, no por endpoint sintetizado.

- [ ] **Step 2: Verificar typecheck/lint**

Run: `npm run lint`
Expected: sin errores en `lib/push.ts`.

Run: `npm run build`
Expected: build OK (la tabla aun no existe en prod, pero no se consulta en build).

- [ ] **Step 3: Commit**

```bash
git add lib/push.ts
git commit -m "feat(push): nucleo de envio web-push y resolucion de destinatarios"
```

---

## Task 3: Handlers `push` / `notificationclick` en el Service Worker

**Files:**
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: payload JSON `{ title, body, url, tag? }` enviado por `lib/push.ts`.
- Produces: notificacion del sistema + foco/apertura de ventana en `data.url`.

- [ ] **Step 1: Reemplazar `public/sw.js` completo (suma handlers, conserva el passthrough)**

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Anfiora', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: data.url || '/dashboard' },
      tag: data.tag,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const hit = wins.find((w) => w.url.includes(url));
      if (hit) return hit.focus();
      return clients.openWindow(url);
    })
  );
});
```

El bloque `fetch` queda intacto: el SW sigue siendo passthrough y no cachea nada.

- [ ] **Step 2: Verificar en navegador (local)**

Run: `npm run dev`, abrir `http://localhost:3000`, DevTools > Application > Service Workers. Confirmar que el SW se actualiza (puede requerir "Update" / cerrar pestanas). Expected: sin errores de parseo en el SW.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat(push): handlers push y notificationclick en el service worker"
```

---

## Task 4: Endpoint `/api/push/subscribe` (POST + DELETE)

**Files:**
- Create: `app/api/push/subscribe/route.ts`

**Interfaces:**
- Consumes: header `Authorization: Bearer <access_token>`; body POST `{ subscription: PushSubscriptionJSON, userAgent?: string }`; body DELETE `{ endpoint: string }`.
- Produces: filas en `push_subscriptions` (upsert por `endpoint`), borrado por `endpoint`.

- [ ] **Step 1: Crear `app/api/push/subscribe/route.ts` completo**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const db = admin()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body invalido' }, { status: 400 })
  }

  const sub = payload?.subscription
  const endpoint: string | undefined = sub?.endpoint
  const p256dh: string | undefined = sub?.keys?.p256dh
  const auth: string | undefined = sub?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Suscripcion incompleta' }, { status: 400 })
  }

  const db = admin()
  const { error } = await db
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: typeof payload?.userAgent === 'string' ? payload.userAgent : null,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    console.error('[push/subscribe] upsert fallido', error.message)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body invalido' }, { status: 400 })
  }

  const endpoint: string | undefined = payload?.endpoint
  if (!endpoint) return NextResponse.json({ error: 'Falta endpoint' }, { status: 400 })

  const db = admin()
  const { error } = await db
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)

  if (error) {
    console.error('[push/subscribe] delete fallido', error.message)
    return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

El upsert por `endpoint` (UNIQUE) reasigna `user_id` si el mismo dispositivo cambia de cuenta. El DELETE va acotado por `user_id` para que nadie borre suscripciones ajenas.

- [ ] **Step 2: Verificar typecheck/lint/build**

Run: `npm run lint && npm run build`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add app/api/push/subscribe/route.ts
git commit -m "feat(push): endpoint subscribe upsert y delete por endpoint"
```

---

## Task 5: Toggle "Notificaciones" en `/perfil`

**Files:**
- Modify: `app/perfil/page.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (cliente); `/api/push/subscribe` (POST/DELETE) con Bearer token; `navigator.serviceWorker` + `PushManager`.
- Produces: seccion UI con switch que crea/borra la suscripcion del dispositivo.

> Nota de entrega: por la regla "full file replacement", al ejecutar se entrega el archivo completo. Aqui van los bloques exactos a insertar y sus anclas; el resto del archivo (Identidad, Plan, Informacion personal, Cambiar contrasena) se conserva tal cual.

- [ ] **Step 1: Agregar el helper `urlBase64ToUint8Array` (top-level, fuera del componente)**

Insertar justo despues del bloque `const PLAN_STYLES = {...}` (linea ~21):

```ts
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}
```

- [ ] **Step 2: Agregar estado de notificaciones en el componente**

Insertar despues del bloque de estado de contrasena (despues de la linea `const [passMsg, setPassMsg] = useState<...>(null)`, linea ~109):

```ts
  // Notificaciones push
  const [pushSupported, setPushSupported]   = useState(true)
  const [pushEnabled, setPushEnabled]       = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [pushBusy, setPushBusy]             = useState(false)
  const [pushMsg, setPushMsg]               = useState<{ type: 'success' | 'error'; text: string } | null>(null)
```

- [ ] **Step 3: Detectar soporte y estado actual al montar**

Agregar un segundo `useEffect` despues del `useEffect` de carga de perfil (despues de su cierre `}, [router])`, linea ~136):

```ts
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    if (!supported) {
      setPushSupported(false)
      return
    }

    setPushPermission(Notification.permission)

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushEnabled(!!sub))
      .catch(() => setPushEnabled(false))
  }, [])
```

- [ ] **Step 4: Agregar los handlers de activar/desactivar**

Agregar despues de `handleChangePassword` (antes de `const planStyle = ...`, linea ~213):

```ts
  const enablePush = async () => {
    setPushMsg(null)
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') {
        setPushMsg({ type: 'error', text: 'Permiso de notificaciones bloqueado. Actívalo desde los ajustes del navegador.' })
        setPushBusy(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setPushMsg({ type: 'error', text: 'Falta configuración del servidor. Intenta más tarde.' })
        setPushBusy(false)
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      })

      if (!res.ok) throw new Error('subscribe failed')

      setPushEnabled(true)
      setPushMsg({ type: 'success', text: 'Notificaciones activadas en este dispositivo' })
    } catch {
      setPushMsg({ type: 'error', text: 'No se pudieron activar las notificaciones. Intenta de nuevo.' })
    }
    setPushBusy(false)
  }

  const disablePush = async () => {
    setPushMsg(null)
    setPushBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ endpoint }),
        })
      }
      setPushEnabled(false)
      setPushMsg({ type: 'success', text: 'Notificaciones desactivadas en este dispositivo' })
    } catch {
      setPushMsg({ type: 'error', text: 'No se pudieron desactivar. Intenta de nuevo.' })
    }
    setPushBusy(false)
  }
```

- [ ] **Step 5: Importar el icono `Bell`**

Modificar la linea de import de lucide (linea 7) para sumar `Bell`:

```ts
import { User, Phone, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft, ChevronDown, Bell } from 'lucide-react'
```

- [ ] **Step 6: Insertar la seccion "Notificaciones" en el JSX**

Insertar como nueva `<section>` dentro de `<div className="flex flex-col gap-4">`, justo despues de la seccion "Plan actual" y antes de "Informacion personal" (despues de la `</section>` de Plan actual, linea ~344):

```tsx
          {/* ── Notificaciones ── */}
          <section className="rounded-2xl border border-[#e8e8e8] bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-[#48C9B0]" />
              <h2 className="text-sm font-semibold text-[#1D1E20]">Notificaciones</h2>
            </div>
            <p className="mt-1 text-[12px] text-[#aaa]">
              Recibe avisos en este dispositivo cuando pase algo importante en tus eventos.
            </p>

            {!pushSupported ? (
              <p className="mt-4 text-xs text-[#888]">
                Este navegador no admite notificaciones. En iPhone o iPad necesitas instalar Anfiora como app desde Safari para activarlas.
              </p>
            ) : (
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1D1E20]">Activar en este dispositivo</p>
                  <p className="text-[11px] text-[#aaa]">
                    {pushPermission === 'denied'
                      ? 'Permiso bloqueado. Habilítalo desde los ajustes del navegador.'
                      : pushEnabled
                        ? 'Estás recibiendo notificaciones aquí.'
                        : 'Las notificaciones están desactivadas aquí.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pushEnabled}
                  disabled={pushBusy || pushPermission === 'denied'}
                  onClick={() => (pushEnabled ? disablePush() : enablePush())}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
                    ${pushEnabled ? 'bg-[#48C9B0]' : 'bg-[#d8d8d8]'}
                    ${pushBusy || pushPermission === 'denied' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                      ${pushEnabled ? 'translate-x-5' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            )}

            {pushMsg && (
              <div className="mt-4">
                <Toast type={pushMsg.type} message={pushMsg.text} />
              </div>
            )}
          </section>
```

- [ ] **Step 7: Verificar lint/build**

Run: `npm run lint && npm run build`
Expected: OK, sin warnings de hooks ni de variables sin usar.

- [ ] **Step 8: Commit**

```bash
git add app/perfil/page.tsx
git commit -m "feat(push): toggle de notificaciones por dispositivo en perfil"
```

---

## Task 6: Enganche del disparador en el webhook de WhatsApp

**Files:**
- Modify: `app/api/webhook/whatsapp/route.ts`

**Interfaces:**
- Consumes: `sendPushToUsers`, `resolveEventRecipients` de `lib/push.ts` (Task 2).
- Produces: push a owner+colaboradores cuando un invitado responde y se actualiza el RSVP.

- [ ] **Step 1: Importar el nucleo de push**

Agregar tras los imports existentes (despues de la linea 4):

```ts
import { sendPushToUsers, resolveEventRecipients } from '@/lib/push'
```

- [ ] **Step 2: Disparar el push tras procesar la respuesta**

Dentro del bloque `if (interpretation.intent !== 'ambiguous' && interpretation.confidence !== 'low') { ... }`, justo despues de `await sendWhatsAppReply(from, replyText)` (linea ~117), agregar:

```ts
      try {
        const recipients = await resolveEventRecipients(guest.event_id)
        const statusLabel =
          interpretation.intent === 'confirmed' ? 'confirmó asistencia'
          : interpretation.intent === 'declined' ? 'no podrá asistir'
          : 'respondió por WhatsApp'
        await sendPushToUsers(recipients, {
          title: eventContext.name,
          body: `${guestName} ${statusLabel}.`,
          url: `/events/${guest.event_id}/mensajes`,
          tag: `wa-${guest.id}`,
        })
      } catch (pushErr: any) {
        console.error('[Webhook] push fallido', pushErr?.message ?? pushErr)
      }
```

El `try/catch` aisla el push: si falla, el webhook responde 200 igual (nunca rompe el flujo de Twilio). No hay actor a excluir (el invitado no es un user).

- [ ] **Step 3: Verificar lint/build**

Run: `npm run lint && npm run build`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add app/api/webhook/whatsapp/route.ts
git commit -m "feat(push): notifica al equipo cuando un invitado responde por whatsapp"
```

---

## Task 7: SQL de `push_subscriptions` (preparar, NO aplicar todavia)

**Files:**
- Create: `docs/superpowers/plans/2026-06-28-push-fase-1.sql`

**Interfaces:**
- Produces: tabla `push_subscriptions` + indice + RLS. Se aplica en Supabase SOLO despues de pushear el codigo (regla prod-safety). En local Diego la corre antes de probar.

- [ ] **Step 1: Crear el archivo SQL completo**

```sql
-- Notificaciones push - Fase 1
-- Aplicar en Supabase SOLO despues de pushear el codigo a origin/main (o a la rama de la feature).

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- El usuario solo ve/gestiona sus propias suscripciones desde el cliente.
-- El envio (lib/push.ts) usa service role, que bypassa RLS.
create policy "push_own_select" on push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_own_insert" on push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_own_update" on push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "push_own_delete" on push_subscriptions
  for delete using (auth.uid() = user_id);
```

Nota: aunque el endpoint `/api/push/subscribe` escribe con service role (bypassa RLS), las policies dejan la tabla segura ante cualquier acceso anon/cliente directo.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-06-28-push-fase-1.sql
git commit -m "chore(push): sql de tabla push_subscriptions con rls"
```

- [ ] **Step 3: Checkpoint de despliegue (con OK de Diego)**

1. Pedir OK para `git push`.
2. Tras pushear, Diego aplica `2026-06-28-push-fase-1.sql` en Supabase (SQL Editor).
3. Diego confirma que las env VAPID estan en Vercel (Production + Preview) y en `.env.local`.

---

## Verificacion end-to-end (Fase 1)

Tras aplicar SQL + env (local primero, luego prod):

- [ ] En el celular: abrir Anfiora instalada como PWA (en iOS es obligatorio instalarla). Ir a `/perfil` > Notificaciones > activar el switch. Aceptar el permiso del navegador.
- [ ] Confirmar en Supabase que aparece una fila en `push_subscriptions` con el `user_id` correcto.
- [ ] Enviar un WhatsApp de prueba desde el numero de un invitado registrado (o usar `/api/webhook/test`) que dispare un RSVP `confirmed`/`declined`.
- [ ] Confirmar que llega la notificacion al celular con el nombre del evento y, al tocarla, abre `/events/[id]/mensajes`.
- [ ] Apagar el switch en `/perfil` y confirmar que la fila desaparece de `push_subscriptions`.

---

## Self-Review (cobertura del spec, Fase 1)

- Tabla `push_subscriptions` -> Task 7. RLS incluido.
- Dep `web-push` + env VAPID -> Task 1.
- `lib/push.ts` (`sendPushToUsers` + `resolveEventRecipients`, limpieza 404/410) -> Task 2.
- Handlers `push`/`notificationclick` sin tocar passthrough -> Task 3.
- `/api/push/subscribe` (POST upsert + DELETE) auth Bearer -> Task 4.
- Toggle en `/perfil` con estados denied/no-soporte -> Task 5.
- Enganche en webhook WhatsApp (actor invitado, sin exclusion) -> Task 6.
- Prod-safety: SQL preparado pero aplicado al final, tras push -> Task 7 + checkpoint.
- Fuera de Fase 1 (se haran despues): columna `reminder_sent_at`, `/api/cron/reminders` + Vercel Cron (Fase 2), `/api/push/event-activity` (Fase 3).
