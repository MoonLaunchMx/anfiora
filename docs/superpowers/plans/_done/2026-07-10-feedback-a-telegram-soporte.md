# Feedback in-app -> bot de Telegram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el boton flotante de feedback (Tally) por un modal in-app que postea sugerencias, notas o errores al bot de Telegram `@SoporteAnfioraBot` (DM de Diego).

**Architecture:** Logica pura de formato en `lib/feedback.ts` (testeable con Vitest). Un endpoint `POST /api/feedback` valida la sesion de Supabase server-side, arma el mensaje y lo envia a Telegram. Un `FeedbackModal` global (montado en `app/layout.tsx`) escucha un evento `window` que despachan los items "Enviar feedback" agregados a los menus de avatar existentes. Se elimina el `FeedbackWidget` flotante.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase (service role), Telegram Bot API, Vitest, Lucide icons.

## Global Constraints

- Idioma UI: espanol CON acentos. Commits: sin acentos ni ñ, terminan con la linea `Co-Authored-By`.
- Sin emojis en la UI. Estilo flat. Botones CTA en teal `#48C9B0`.
- Solo Tailwind (sin inline styles salvo justificacion). Iconos Lucide.
- Tests Vitest solo para logica pura; endpoints con I/O y UI se verifican manual (local -> preview -> main).
- Full file replacement al editar (nunca fragmentos sueltos en el codigo final).
- No tablas nuevas en Supabase. Este feature NO toca schema ni datos.
- El token de Telegram vive solo en env vars server-side, nunca en el cliente.
- Env vars requeridas en runtime: `TELEGRAM_SUPPORT_BOT_TOKEN`, `TELEGRAM_SUPPORT_CHAT_ID` (= `6921652377`). Ya existen `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- Evento `window` de disparo: `anfiora:open-feedback`.
- Tipos de feedback: `sugerencia | nota | error`.
- Mensaje a Telegram en texto plano, SIN `parse_mode` (evita romper con caracteres especiales del usuario).

---

### Task 1: Logica pura de feedback (`lib/feedback.ts`)

**Files:**
- Create: `lib/feedback.ts`
- Test: `lib/feedback.test.ts`

**Interfaces:**
- Produces:
  - `type FeedbackType = 'sugerencia' | 'nota' | 'error'`
  - `const FEEDBACK_TYPES: { value: FeedbackType; label: string }[]`
  - `type FeedbackUser = { name: string; email: string; plan: string }`
  - `type FeedbackPayload = { type: FeedbackType; message: string; page: string; user: FeedbackUser; eventName?: string }`
  - `function formatFeedbackMessage(p: FeedbackPayload): string`
  - `function isFeedbackType(v: unknown): v is FeedbackType`

- [ ] **Step 1: Write the failing test**

Create `lib/feedback.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatFeedbackMessage, isFeedbackType, FEEDBACK_TYPES } from './feedback'

const baseUser = { name: 'Diego', email: 'd@x.com', plan: 'pro' }

describe('formatFeedbackMessage', () => {
  it('pone el prefijo correcto por tipo', () => {
    expect(formatFeedbackMessage({ type: 'sugerencia', message: 'hola', page: '/x', user: baseUser }))
      .toContain('[SUGERENCIA]')
    expect(formatFeedbackMessage({ type: 'nota', message: 'hola', page: '/x', user: baseUser }))
      .toContain('[NOTA]')
    expect(formatFeedbackMessage({ type: 'error', message: 'hola', page: '/x', user: baseUser }))
      .toContain('[ERROR]')
  })

  it('incluye correo, plan y pagina', () => {
    const out = formatFeedbackMessage({ type: 'nota', message: 'algo', page: '/events/1/timeline', user: baseUser })
    expect(out).toContain('d@x.com')
    expect(out).toContain('pro')
    expect(out).toContain('/events/1/timeline')
    expect(out).toContain('algo')
  })

  it('no rompe con caracteres especiales en el mensaje', () => {
    const msg = 'bug con <script> & "comillas" 100% roto'
    const out = formatFeedbackMessage({ type: 'error', message: msg, page: '/x', user: baseUser })
    expect(out).toContain(msg)
  })

  it('incluye el evento solo si viene', () => {
    const con = formatFeedbackMessage({ type: 'nota', message: 'a', page: '/x', user: baseUser, eventName: 'Boda Ana' })
    expect(con).toContain('Boda Ana')
    const sin = formatFeedbackMessage({ type: 'nota', message: 'a', page: '/x', user: baseUser })
    expect(sin).not.toContain('Evento:')
  })

  it('usa fallback cuando no hay nombre', () => {
    const out = formatFeedbackMessage({ type: 'nota', message: 'a', page: '/x', user: { name: '', email: 'e@x.com', plan: 'free' } })
    expect(out).toContain('Sin nombre')
  })
})

describe('isFeedbackType', () => {
  it('acepta los tres validos y rechaza el resto', () => {
    expect(isFeedbackType('sugerencia')).toBe(true)
    expect(isFeedbackType('nota')).toBe(true)
    expect(isFeedbackType('error')).toBe(true)
    expect(isFeedbackType('otro')).toBe(false)
    expect(isFeedbackType(null)).toBe(false)
    expect(isFeedbackType(3)).toBe(false)
  })
})

describe('FEEDBACK_TYPES', () => {
  it('tiene los tres tipos con label', () => {
    expect(FEEDBACK_TYPES.map(t => t.value)).toEqual(['sugerencia', 'nota', 'error'])
    expect(FEEDBACK_TYPES.every(t => t.label.length > 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- feedback`
Expected: FAIL (no se puede resolver `./feedback`).

- [ ] **Step 3: Write minimal implementation**

Create `lib/feedback.ts`:

```ts
export type FeedbackType = 'sugerencia' | 'nota' | 'error'

export const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'nota', label: 'Nota' },
  { value: 'error', label: 'Error' },
]

export type FeedbackUser = { name: string; email: string; plan: string }

export type FeedbackPayload = {
  type: FeedbackType
  message: string
  page: string
  user: FeedbackUser
  eventName?: string
}

const TYPE_PREFIX: Record<FeedbackType, string> = {
  sugerencia: 'SUGERENCIA',
  nota: 'NOTA',
  error: 'ERROR',
}

export function isFeedbackType(v: unknown): v is FeedbackType {
  return v === 'sugerencia' || v === 'nota' || v === 'error'
}

export function formatFeedbackMessage(p: FeedbackPayload): string {
  const lines = [
    `[${TYPE_PREFIX[p.type]}] Anfiora feedback`,
    '',
    p.message.trim(),
    '',
    `De: ${p.user.name || 'Sin nombre'} (${p.user.email})`,
    `Plan: ${p.user.plan}`,
    `Pagina: ${p.page}`,
  ]
  if (p.eventName) lines.push(`Evento: ${p.eventName}`)
  return lines.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- feedback`
Expected: PASS (todos los tests verdes).

- [ ] **Step 5: Commit**

```bash
git add lib/feedback.ts lib/feedback.test.ts
git commit -m "feat(feedback): logica pura de formato de mensaje a Telegram

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Endpoint `POST /api/feedback`

**Files:**
- Create: `app/api/feedback/route.ts`

**Interfaces:**
- Consumes: `formatFeedbackMessage`, `isFeedbackType` de `@/lib/feedback` (Task 1).
- Produces: endpoint que responde `{ ok: true }` o `{ ok: false, error }`. Lo consume el `FeedbackModal` (Task 3).

Sin test Vitest — es I/O (Supabase + Telegram), se verifica manual.

- [ ] **Step 1: Write the route**

Create `app/api/feedback/route.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { formatFeedbackMessage, isFeedbackType } from '@/lib/feedback'

export const runtime = 'nodejs'

const MAX_LEN = 2000

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_SUPPORT_BOT_TOKEN
  const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID
  if (!token || !chatId) {
    console.error('[feedback] faltan env vars TELEGRAM_SUPPORT_*')
    return NextResponse.json({ ok: false, error: 'no configurado' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })
  const accessToken = authHeader.replace('Bearer ', '')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
  if (authError || !user) return NextResponse.json({ ok: false, error: 'no autorizado' }, { status: 401 })

  let body: { type?: unknown; message?: unknown; page?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'json invalido' }, { status: 400 })
  }

  const { type, message, page } = body
  if (!isFeedbackType(type)) return NextResponse.json({ ok: false, error: 'tipo invalido' }, { status: 400 })
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ ok: false, error: 'mensaje vacio' }, { status: 400 })
  }
  if (message.length > MAX_LEN) return NextResponse.json({ ok: false, error: 'mensaje muy largo' }, { status: 400 })
  const pagePath = typeof page === 'string' ? page : ''

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('full_name, plan')
    .eq('id', user.id)
    .single()

  let eventName: string | undefined
  const eventMatch = pagePath.match(/^\/events\/([0-9a-fA-F-]{36})/)
  if (eventMatch) {
    const { data: ev } = await supabaseAdmin
      .from('events')
      .select('name')
      .eq('id', eventMatch[1])
      .single()
    eventName = ev?.name ?? undefined
  }

  const text = formatFeedbackMessage({
    type,
    message,
    page: pagePath,
    user: {
      name: profile?.full_name ?? '',
      email: user.email ?? '',
      plan: profile?.plan ?? 'free',
    },
    eventName,
  })

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[feedback] telegram error:', res.status, detail.slice(0, 200))
      return NextResponse.json({ ok: false, error: 'envio fallo' }, { status: 502 })
    }
  } catch (e) {
    console.error('[feedback] telegram fetch error:', e)
    return NextResponse.json({ ok: false, error: 'envio fallo' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build sin errores de tipos en `app/api/feedback/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/feedback/route.ts
git commit -m "feat(feedback): endpoint POST api feedback que postea a Telegram

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `FeedbackModal` global + retiro del `FeedbackWidget`

**Files:**
- Create: `app/components/FeedbackModal.tsx`
- Modify: `app/layout.tsx` (import + mount)
- Delete: `app/components/FeedbackWidget.tsx`

**Interfaces:**
- Consumes: `FEEDBACK_TYPES`, `FeedbackType` de `@/lib/feedback` (Task 1); endpoint `POST /api/feedback` (Task 2).
- Produces: escucha el evento `window` `anfiora:open-feedback` (lo despacha Task 4).

Sin test Vitest — UI, se verifica manual.

- [ ] **Step 1: Create the modal**

Create `app/components/FeedbackModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { X, MessageSquarePlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { FEEDBACK_TYPES, type FeedbackType } from "@/lib/feedback";

type Status = "idle" | "sending" | "sent" | "error";

export default function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState("");
  const [type, setType] = useState<FeedbackType>("sugerencia");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const handler = () => {
      setPage(window.location.pathname);
      setType("sugerencia");
      setMessage("");
      setStatus("idle");
      setOpen(true);
    };
    window.addEventListener("anfiora:open-feedback", handler);
    return () => window.removeEventListener("anfiora:open-feedback", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  const submit = async () => {
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) { setStatus("error"); return; }
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ type, message, page }),
      });
      if (!res.ok) { setStatus("error"); return; }
      setStatus("sent");
      setTimeout(() => setOpen(false), 1500);
    } catch {
      setStatus("error");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquarePlus size={18} className="text-[#48C9B0]" />
            <h2 className="text-base font-semibold text-[#1D1E20]">Enviar feedback</h2>
          </div>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="rounded-md p-1 text-[#999] transition hover:bg-[#f5f5f5]"
          >
            <X size={18} />
          </button>
        </div>

        {status === "sent" ? (
          <p className="py-6 text-center text-sm text-[#2a7a50]">Gracias, recibimos tu mensaje.</p>
        ) : (
          <>
            <label className="mb-1 block text-xs font-medium text-[#666]">Tipo</label>
            <div className="mb-3 flex gap-2">
              {FEEDBACK_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    type === t.value
                      ? "border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]"
                      : "border-[#e0e0e0] text-[#888] hover:bg-[#f8f8f8]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-xs font-medium text-[#666]">Cuentanos</label>
            <textarea
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Escribe tu sugerencia, nota o error..."
              className="mb-2 w-full resize-none rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0]"
            />

            {status === "error" && (
              <p className="mb-2 text-xs text-[#cc3333]">No se pudo enviar. Intenta de nuevo.</p>
            )}

            <button
              onClick={submit}
              disabled={!message.trim() || status === "sending"}
              className="w-full rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3db39d] disabled:opacity-50"
            >
              {status === "sending" ? "Enviando..." : "Enviar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Swap en `app/layout.tsx`**

Reemplazar el archivo completo `app/layout.tsx` (misma metadata, solo cambia el import y el mount de `FeedbackWidget` -> `FeedbackModal`):

- Linea de import `import FeedbackWidget from "@/app/components/FeedbackWidget";` -> `import FeedbackModal from "@/app/components/FeedbackModal";`
- En el body, `<FeedbackWidget />` -> `<FeedbackModal />`

Resultado del bloque `body`:

```tsx
      <body>
        <PostHogProvider>{children}</PostHogProvider>
        <AttributionCapture />
        <FeedbackModal />
        <LegalGate />
        <InstallPrompt />
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
          }
        `}</Script>
      </body>
```

- [ ] **Step 3: Delete `FeedbackWidget.tsx`**

```bash
git rm app/components/FeedbackWidget.tsx
```

- [ ] **Step 4: Verify build + no dangling refs**

Run: `npm run build`
Expected: build limpio. Confirmar que no quede ninguna referencia a `FeedbackWidget`:
Run: `git grep -n FeedbackWidget`
Expected: sin resultados.

- [ ] **Step 5: Commit**

```bash
git add app/components/FeedbackModal.tsx app/layout.tsx
git commit -m "feat(feedback): modal global y retiro del widget flotante Tally

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Disparadores "Enviar feedback" en los menus existentes

**Files:**
- Modify: `app/events/[id]/layout.tsx` (dos bloques de menu de avatar + import)
- Modify: `app/dashboard/page.tsx` (boton junto al de perfil + import)

**Interfaces:**
- Consumes: evento `window` `anfiora:open-feedback` que escucha el `FeedbackModal` (Task 3).

Sin test Vitest — UI, se verifica manual.

- [ ] **Step 1: Import del icono en `app/events/[id]/layout.tsx`**

En el import de `lucide-react` (que ya trae `User`, `LogOut`, etc.), agregar `MessageSquarePlus`. Ejemplo:

```tsx
import { /* ...iconos existentes..., */ User, LogOut, MessageSquarePlus } from 'lucide-react'
```

- [ ] **Step 2: Boton en el componente `AvatarDropdown` (~linea 424-445)**

Insertar el boton de feedback ENTRE "Mi perfil" y "Cerrar sesion":

```tsx
      <button
        onClick={() => { setAvatarOpen(false); window.dispatchEvent(new CustomEvent('anfiora:open-feedback')) }}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-[#555] transition hover:bg-[#f8f8f8]"
      >
        <MessageSquarePlus size={14} className="text-[#aaa]" />
        Enviar feedback
      </button>
```

El bloque queda: cabecera -> Mi perfil -> **Enviar feedback** -> Cerrar sesion.

- [ ] **Step 3: Boton en el menu inline del sidebar (~linea 522-543)**

Insertar el MISMO boton ENTRE "Mi perfil" y "Cerrar sesion" del bloque inline (el que empieza en `{avatarOpen && (` alrededor de la linea 522):

```tsx
              <button
                onClick={() => { setAvatarOpen(false); window.dispatchEvent(new CustomEvent('anfiora:open-feedback')) }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-[#555] transition hover:bg-[#f8f8f8]"
              >
                <MessageSquarePlus size={14} className="text-[#aaa]" />
                Enviar feedback
              </button>
```

- [ ] **Step 4: Import + boton en `app/dashboard/page.tsx`**

En `app/dashboard/page.tsx`, agregar `MessageSquarePlus` al import de `lucide-react` (si el dashboard no importa de `lucide-react`, agregar `import { MessageSquarePlus } from 'lucide-react'`).

Insertar un boton de feedback JUSTO ANTES del boton "Mi perfil" (~linea 603, el `<button onClick={() => window.location.href = '/perfil'}`):

```tsx
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('anfiora:open-feedback'))}
              title="Enviar feedback"
              className="rounded-lg border border-[#e0e0e0] p-2 text-[#888] transition hover:border-[#48C9B0] hover:text-[#1a9e88]"
            >
              <MessageSquarePlus size={16} />
            </button>
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build limpio, sin errores de import.

- [ ] **Step 6: Commit**

```bash
git add "app/events/[id]/layout.tsx" app/dashboard/page.tsx
git commit -m "feat(feedback): item Enviar feedback en menus de avatar y dashboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verificacion end-to-end (manual)

**Files:** ninguno (solo verificacion).

Prerrequisito: Diego debe tener `TELEGRAM_SUPPORT_BOT_TOKEN` y `TELEGRAM_SUPPORT_CHAT_ID=6921652377` en `.env` local (y en Vercel para preview).

- [ ] **Step 1: Correr tests + build**

Run: `npm test -- feedback && npm run build`
Expected: tests verdes, build limpio.

- [ ] **Step 2: Prueba local (localhost:3000)**

Run: `npm run dev`

Verificar:
- Ya NO aparece el boton flotante negro de feedback en ninguna pantalla.
- En el dashboard: el icono de feedback abre el modal.
- En un evento (`/events/<id>/...`): el menu del avatar (desktop y mobile) muestra "Enviar feedback" y abre el modal.
- El modal: seleccionar tipo, escribir texto, Enviar -> "Gracias..." y cierra solo.
- Llega el mensaje a `@SoporteAnfioraBot` (DM de Diego) con el prefijo del tipo, el texto, nombre/correo/plan, la pagina y (si es evento) el nombre del evento.
- Enviar sin sesion o con token invalido -> el modal muestra "No se pudo enviar".

- [ ] **Step 3: Confirmar con Diego antes de merge/push**

No hacer `git push` ni merge sin OK explicito de Diego (regla del repo). Coordinar el push de codigo ANTES de tocar cualquier config en Vercel.

---

## Self-Review

**Spec coverage:**
- `lib/feedback.ts` puro + test -> Task 1. OK
- `POST /api/feedback` con validacion de token, plan/nombre reales, nombre de evento, envio a Telegram plano -> Task 2. OK
- `FeedbackModal` global, evento `anfiora:open-feedback`, estados idle/enviando/enviado/error -> Task 3. OK
- Disparadores en `AvatarDropdown` (evento, 2 renders) + dashboard -> Task 4. OK
- Borrar `FeedbackWidget` + quitar de layout + quitar Tally -> Task 3. OK
- Env vars, setup manual, sin grupo -> Global Constraints + Task 5. OK
- Fuera de alcance (tour, UserMenu, publicas, DB) -> respetado (no hay tareas). OK

**Placeholder scan:** sin TBD/TODO; todo el codigo esta completo.

**Type consistency:** `FeedbackType`, `FEEDBACK_TYPES`, `formatFeedbackMessage`, `isFeedbackType` usados igual en Tasks 1-3. El evento `anfiora:open-feedback` es identico en Tasks 3 y 4. El endpoint responde `{ ok }` y el modal solo usa `res.ok`. Consistente.
