# Terms & Conditions Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema completo de aceptación de Términos y Aviso de Privacidad con prueba de consentimiento por usuario (versión + fecha + IP), captura en el registro, gate de re-consentimiento para usuarios existentes y bumps de versión, y visibilidad en el superadmin.

**Architecture:** Una versión combinada (`lib/legal.ts`). Tabla append-only `terms_acceptances` (Diego corre el SQL). Consentimiento se registra server-side vía `/api/legal/accept` para capturar IP. Un `<LegalGate />` montado en el root layout consulta `/api/legal/status` y bloquea con un modal si el usuario no tiene la versión vigente. El superadmin lee la tabla con service role.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase JS (browser + service role), Lucide React.

---

## Restricciones

- **Claude nunca toca Supabase.** El SQL de `terms_acceptances` lo corre Diego (ya entregado en el spec).
- No hay tests en el proyecto. Verificación = `npm run lint` (sobre archivos tocados) + `npm run build` + revisión manual.
- Full file replacement en archivos nuevos; edits precisos en existentes. Español, Tailwind, estilo flat, CTA teal `#48C9B0`, Lucide.
- Commits convencionales sin acentos/ñ.
- El texto de `/terminos` es un BORRADOR marcado para revisión legal.

## File Structure

```
lib/legal.ts                          → NUEVO. CURRENT_LEGAL_VERSION + fecha + helpers
app/terminos/page.tsx                 → NUEVO. Borrador T&C
app/privacidad/page.tsx               → MODIFICAR. Sello de version desde lib/legal
app/api/legal/accept/route.ts         → NUEVO. Registra consentimiento (IP, UA)
app/api/legal/status/route.ts         → NUEVO. Devuelve si el usuario tiene la version vigente
app/components/LegalGate.tsx          → NUEVO. Modal bloqueante de re-consentimiento
app/layout.tsx                        → MODIFICAR. Montar <LegalGate />
app/components/auth/AuthModal.tsx     → MODIFICAR. Checkbox obligatorio + accept
app/invite/[token]/page.tsx           → MODIFICAR. Checkbox obligatorio + accept
app/api/admin/users/route.ts          → MODIFICAR. Leer terms_acceptances
app/admin/lib/types.ts                → MODIFICAR. Campos de consentimiento
app/admin/UsuariosTab.tsx             → MODIFICAR. Columna + historial
```

---

## Task 1: Constantes legales (`lib/legal.ts`)

**Files:**
- Create: `lib/legal.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// lib/legal.ts
// Una sola version cubre Terminos + Aviso de Privacidad.
// Subir CURRENT_LEGAL_VERSION re-dispara el gate de consentimiento para todos.

export const CURRENT_LEGAL_VERSION = '1.0'
export const LEGAL_EFFECTIVE_DATE = '28 de mayo de 2026'
export const LEGAL_DOCUMENT = 'terms_privacy'
```

- [ ] **Step 2: Lint**

Run: `npx eslint lib/legal.ts`
Expected: sin salida (sin errores).

- [ ] **Step 3: Commit**

```bash
git add lib/legal.ts
git commit -m "feat(legal): version vigente de terminos y privacidad"
```

---

## Task 2: API registrar consentimiento (`/api/legal/accept`)

**Files:**
- Create: `app/api/legal/accept/route.ts`

Patrón de auth: igual que `app/api/admin/users/route.ts` — token Bearer → `supabaseAdmin.auth.getUser(token)`. Service role para insertar (la tabla tiene RLS; el service role la ignora y además capturamos IP server-side).

- [ ] **Step 1: Crear el archivo**

```ts
// app/api/legal/accept/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_LEGAL_VERSION, LEGAL_DOCUMENT } from '@/lib/legal'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Idempotencia: si ya acepto esta version, no duplicar
  const { data: existing } = await supabaseAdmin
    .from('terms_acceptances')
    .select('id')
    .eq('user_id', user.id)
    .eq('version', CURRENT_LEGAL_VERSION)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, already: true })
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
  const userAgent = req.headers.get('user-agent') || null

  const { error } = await supabaseAdmin.from('terms_acceptances').insert({
    user_id:     user.id,
    document:    LEGAL_DOCUMENT,
    version:     CURRENT_LEGAL_VERSION,
    ip_address:  ip,
    user_agent:  userAgent,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint app/api/legal/accept/route.ts`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add app/api/legal/accept/route.ts
git commit -m "feat(legal): API para registrar consentimiento con IP"
```

---

## Task 3: API estado de consentimiento (`/api/legal/status`)

**Files:**
- Create: `app/api/legal/status/route.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// app/api/legal/status/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { CURRENT_LEGAL_VERSION } from '@/lib/legal'

export async function GET(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('terms_acceptances')
    .select('id')
    .eq('user_id', user.id)
    .eq('version', CURRENT_LEGAL_VERSION)
    .limit(1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ current: !!(data && data.length > 0), version: CURRENT_LEGAL_VERSION })
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint app/api/legal/status/route.ts`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add app/api/legal/status/route.ts
git commit -m "feat(legal): API de estado de consentimiento"
```

---

## Task 4: Páginas de contenido (`/terminos` + sello en `/privacidad`)

**Files:**
- Create: `app/terminos/page.tsx`
- Modify: `app/privacidad/page.tsx` (líneas 6-7 y 41-43)

`/terminos` replica la estructura de `app/privacidad/page.tsx` (header con logo + link, `<main className="max-w-3xl mx-auto px-6 py-12">`, secciones con CSS vars). El header linkea a `/` (no `/landing`, que ya no existe).

- [ ] **Step 1: Crear `app/terminos/page.tsx`**

```tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CURRENT_LEGAL_VERSION, LEGAL_EFFECTIVE_DATE } from '@/lib/legal'

export default function TerminosPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      >
        <Link href="/">
          <Image src="/images/Logo SVG.svg" alt="Anfiora" width={110} height={32} priority />
        </Link>
        <Link href="/" className="text-sm" style={{ color: 'var(--text-sec)' }}>
          Volver al inicio
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          Terminos y Condiciones
        </h1>
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          Version {CURRENT_LEGAL_VERSION} · vigente desde el {LEGAL_EFFECTIVE_DATE}
        </p>
        <div
          className="mb-10 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--accent-bg)', color: 'var(--text-sec)', border: '1px solid var(--border)' }}
        >
          Borrador pendiente de revision legal. No constituye asesoria juridica.
        </div>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--text-sec)' }}>
          <Sec n="1" t="Aceptacion de los terminos">
            Al crear una cuenta o usar Anfiora (la &quot;Plataforma&quot;), disponible en www.anfiora.com,
            usted acepta estos Terminos y Condiciones y nuestro Aviso de Privacidad. Si no esta de acuerdo,
            no utilice la Plataforma.
          </Sec>
          <Sec n="2" t="Descripcion del servicio">
            Anfiora es una plataforma para organizar eventos: gestion de listas de invitados, confirmaciones
            (RSVP) por WhatsApp, albumes colaborativos, playlists, asignacion de mesas, presupuestos,
            proveedores y tareas. El servicio se ofrece &quot;tal cual&quot; y puede cambiar con el tiempo.
          </Sec>
          <Sec n="3" t="Cuentas y registro">
            Usted es responsable de la veracidad de los datos de su cuenta, de mantener la confidencialidad
            de su contrasena y de toda actividad realizada bajo su cuenta. Debe ser mayor de edad para
            registrarse.
          </Sec>
          <Sec n="4" t="Uso aceptable">
            Usted se compromete a no usar la Plataforma para fines ilicitos, enviar spam o comunicaciones no
            autorizadas, vulnerar la seguridad del servicio, ni infringir derechos de terceros. Podemos
            suspender cuentas que incumplan estas reglas.
          </Sec>
          <Sec n="5" t="Datos de invitados y responsabilidad del organizador">
            Usted puede cargar datos personales de terceros (invitados), como nombre, telefono y correo.
            Usted declara que cuenta con la base legitima para tratar esos datos y para compartirlos con
            Anfiora con el fin de prestar el servicio. Usted es el responsable del tratamiento de esos datos
            frente a sus invitados; Anfiora actua como encargado que los procesa por cuenta suya.
          </Sec>
          <Sec n="6" t="Comunicaciones por WhatsApp">
            Las funciones de mensajeria se prestan a traves de terceros (Twilio). Usted es responsable de
            obtener el consentimiento de los destinatarios y de cumplir las politicas de WhatsApp y la
            normativa aplicable en materia de comunicaciones.
          </Sec>
          <Sec n="7" t="Planes y pagos">
            Algunos planes son de pago. Los precios, ciclos de cobro y caracteristicas pueden cambiar con
            aviso razonable. Salvo que la ley exija lo contrario, los pagos no son reembolsables.
          </Sec>
          <Sec n="8" t="Propiedad intelectual">
            La Plataforma, su marca, diseno y software son propiedad de Anfiora. El contenido que usted carga
            sigue siendo suyo; usted nos otorga una licencia limitada para alojarlo y procesarlo con el unico
            fin de prestar el servicio.
          </Sec>
          <Sec n="9" t="Limitacion de responsabilidad">
            La Plataforma se ofrece sin garantias de disponibilidad ininterrumpida o ausencia de errores. En
            la maxima medida permitida por la ley, Anfiora no sera responsable por danos indirectos,
            incidentales o consecuentes, ni por perdida de datos derivada del uso o imposibilidad de uso del
            servicio. Nuestra responsabilidad total se limita al monto pagado por usted en los ultimos 12 meses.
          </Sec>
          <Sec n="10" t="Indemnizacion">
            Usted se compromete a mantener indemne a Anfiora frente a reclamaciones de terceros derivadas del
            uso indebido de la Plataforma o del incumplimiento de estos Terminos, incluyendo el tratamiento de
            datos de invitados sin base legitima.
          </Sec>
          <Sec n="11" t="Terminacion">
            Usted puede cerrar su cuenta cuando quiera. Podemos suspender o terminar el acceso ante
            incumplimientos. Tras la terminacion, podremos eliminar sus datos conforme al Aviso de Privacidad.
          </Sec>
          <Sec n="12" t="Modificaciones">
            Podemos actualizar estos Terminos. Cuando lo hagamos, publicaremos la nueva version y le pediremos
            aceptarla para seguir usando la Plataforma. El uso continuado implica aceptacion.
          </Sec>
          <Sec n="13" t="Ley aplicable y jurisdiccion">
            Estos Terminos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se
            resolvera ante los tribunales competentes de Monterrey, Nuevo Leon, salvo disposicion legal en
            contrario.
          </Sec>
          <Sec n="14" t="Contacto">
            Para cualquier asunto relacionado con estos Terminos, escribanos a legal@anfiora.com.
          </Sec>
        </div>
      </main>
    </div>
  )
}

function Sec({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>{n}. {t}</h2>
      <p>{children}</p>
    </section>
  )
}
```

- [ ] **Step 2: Agregar sello de versión en `app/privacidad/page.tsx`**

Reemplazar la línea 7:

```tsx
  const fechaActualizacion = '12 de mayo de 2026'
```

por (e importar arriba):

```tsx
import { CURRENT_LEGAL_VERSION, LEGAL_EFFECTIVE_DATE } from '@/lib/legal'
```

```tsx
  const fechaActualizacion = LEGAL_EFFECTIVE_DATE
```

Y reemplazar el párrafo de "Última actualización" (líneas 41-43) por:

```tsx
        <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>
          Version {CURRENT_LEGAL_VERSION} · ultima actualizacion: {fechaActualizacion}
        </p>
```

- [ ] **Step 3: Lint + build**

Run: `npx eslint app/terminos/page.tsx app/privacidad/page.tsx`
Expected: sin salida.
Run: `npm run build`
Expected: build exitoso, aparece la ruta `/terminos`.

- [ ] **Step 4: Commit**

```bash
git add app/terminos/page.tsx app/privacidad/page.tsx
git commit -m "feat(legal): pagina de terminos (borrador) y sello de version en privacidad"
```

---

## Task 5: Componente `LegalGate`

**Files:**
- Create: `app/components/LegalGate.tsx`

Client component. Al montar: si hay sesión y el usuario no tiene la versión vigente (consulta a `/api/legal/status`), muestra un modal bloqueante. Al aceptar, llama a `/api/legal/accept`. Fail-open ante error del status (no bloquea por fallo transitorio).

- [ ] **Step 1: Crear el componente**

```tsx
// app/components/LegalGate.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CURRENT_LEGAL_VERSION } from '@/lib/legal'

export default function LegalGate() {
  const [show, setShow] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const res = await fetch('/api/legal/status', {
          headers: { Authorization: 'Bearer ' + session.access_token },
        })
        if (!res.ok) return // fail-open
        const data = await res.json()
        if (active && !data.current) {
          setToken(session.access_token)
          setShow(true)
        }
      } catch {
        // fail-open: no bloquear por error transitorio
      }
    }
    check()
    return () => { active = false }
  }, [])

  async function accept() {
    if (!token) return
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error()
      setShow(false)
    } catch {
      setError('No se pudo registrar tu aceptacion. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/[0.45] px-4">
      <div className="w-full max-w-[460px] rounded-[20px] border border-[#e8e8e8] bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
        <h2 className="text-lg font-bold text-[#1D1E20]">Actualizamos nuestros terminos</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#777]">
          Para seguir usando Anfiora necesitas aceptar nuestros{' '}
          <Link href="/terminos" target="_blank" className="font-medium text-[#48C9B0]">Terminos y Condiciones</Link>{' '}
          y el{' '}
          <Link href="/privacidad" target="_blank" className="font-medium text-[#48C9B0]">Aviso de Privacidad</Link>{' '}
          (version {CURRENT_LEGAL_VERSION}).
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2.5 text-xs text-[#cc3333]">{error}</div>
        )}

        <button
          onClick={accept}
          disabled={submitting}
          className={'mt-6 w-full rounded-[10px] border-none py-3 text-sm font-semibold text-white transition-colors ' +
            (submitting ? 'cursor-not-allowed bg-[#9ee0d4]' : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]')}
        >
          {submitting ? 'Un momento...' : 'Acepto y continuo'}
        </button>
        <button
          onClick={logout}
          className="mt-3 w-full cursor-pointer border-none bg-transparent text-[13px] text-[#aaa] transition-colors hover:text-[#555]"
        >
          Cerrar sesion
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint app/components/LegalGate.tsx`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add app/components/LegalGate.tsx
git commit -m "feat(legal): gate de re-consentimiento bloqueante"
```

---

## Task 6: Montar el gate en el layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Editar `app/layout.tsx`**

Agregar el import tras los existentes:

```tsx
import LegalGate from './components/LegalGate'
```

Y dentro de `<body>`, después de `<FeedbackWidget />`:

```tsx
      <body>
        <PostHogProvider>{children}</PostHogProvider>
        <FeedbackWidget />
        <LegalGate />
      </body>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(legal): montar LegalGate en el root layout"
```

---

## Task 7: Checkbox de aceptación en `AuthModal`

**Files:**
- Modify: `app/components/auth/AuthModal.tsx`

Agregar estado `accepted`, un checkbox en la vista register (debajo de los campos, antes del botón), deshabilitar "Crear cuenta" si no está marcado, y llamar a `/api/legal/accept` tras un signup con sesión.

- [ ] **Step 1: Estado nuevo**

Tras `const [showPassword, setShowPassword] = useState(false)` (línea ~137) agregar:

```tsx
  const [accepted, setAccepted] = useState(false)
```

Y en `reset()` agregar `setAccepted(false)`.

- [ ] **Step 2: Registrar consentimiento tras signup**

En `handleRegister`, dentro del `else` de éxito, cuando hay sesión, antes de redirigir:

```tsx
    } else {
      if (phone && data.user) {
        await supabase.from('users').update({ phone, full_name: name }).eq('id', data.user.id)
      }
      if (data.session) {
        await fetch('/api/legal/accept', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + data.session.access_token },
        }).catch(() => {})
        window.location.href = '/dashboard'
      } else {
        setSuccess(t.success_register)
      }
    }
```

(Si no hay sesión inmediata por confirmación de correo, el `<LegalGate />` registrará el consentimiento en el primer login.)

- [ ] **Step 3: Checkbox + guard en el botón**

En la vista register, después del bloque de campos (`</div>` que cierra los Field, ~línea 348) y antes del bloque `{view === 'login' && (...)}`, agregar:

```tsx
        {view === 'register' && (
          <label className="flex items-start gap-2 text-[12px] leading-snug text-[#777]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#48C9B0]"
            />
            <span>
              Acepto los{' '}
              <a href="/terminos" target="_blank" rel="noopener noreferrer" className="font-medium text-[#48C9B0]">Terminos y Condiciones</a>{' '}
              y el{' '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-medium text-[#48C9B0]">Aviso de Privacidad</a>.
            </span>
          </label>
        )}
```

Y en el botón submit (línea ~362-372), cambiar `disabled` y el handler para exigir el checkbox en register:

```tsx
        <button
          onClick={view === 'login' ? handleLogin : handleRegister}
          disabled={loading || (view === 'register' && !accepted)}
          className={`w-full rounded-[10px] border-none py-3 text-sm font-semibold text-white transition-colors ${
            loading || (view === 'register' && !accepted)
              ? 'cursor-not-allowed bg-[#9ee0d4]'
              : 'cursor-pointer bg-[#48C9B0] hover:bg-[#3ab89f]'
          }`}
        >
          {loading ? t.loading : view === 'login' ? t.submit_login : t.submit_register}
        </button>
```

- [ ] **Step 4: Lint + build**

Run: `npx eslint app/components/auth/AuthModal.tsx`
Expected: sin salida.
Run: `npm run build`
Expected: exitoso.

- [ ] **Step 5: Commit**

```bash
git add app/components/auth/AuthModal.tsx
git commit -m "feat(legal): checkbox obligatorio de aceptacion en registro"
```

---

## Task 8: Checkbox de aceptación en `invite/[token]`

**Files:**
- Modify: `app/invite/[token]/page.tsx`

Replicar el patrón del Task 7 en el flujo de registro inline de la invitación: estado `accepted`, checkbox idéntico (enlaces a `/terminos` y `/privacidad`), botón de registro deshabilitado sin marcar, y llamada a `/api/legal/accept` tras signup con sesión.

- [ ] **Step 1: Localizar el registro inline**

Leer `app/invite/[token]/page.tsx` y ubicar: el estado del formulario, la función que hace `supabase.auth.signUp`, y el botón de "registrarse/aceptar invitacion".

- [ ] **Step 2: Agregar estado**

Junto a los demás `useState` del formulario:

```tsx
  const [accepted, setAccepted] = useState(false)
```

- [ ] **Step 3: Registrar consentimiento tras signup**

Inmediatamente después de un `signUp` exitoso que devuelva sesión (`data.session`), antes de continuar el flujo de aceptar invitación:

```tsx
        if (data.session) {
          await fetch('/api/legal/accept', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + data.session.access_token },
          }).catch(() => {})
        }
```

- [ ] **Step 4: Checkbox + guard**

Antes del botón de registro, agregar (solo en la vista de registro inline):

```tsx
        <label className="flex items-start gap-2 text-[12px] leading-snug text-[#777]">
          <input
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#48C9B0]"
          />
          <span>
            Acepto los{' '}
            <a href="/terminos" target="_blank" rel="noopener noreferrer" className="font-medium text-[#48C9B0]">Terminos y Condiciones</a>{' '}
            y el{' '}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-medium text-[#48C9B0]">Aviso de Privacidad</a>.
          </span>
        </label>
```

Y agregar al `disabled` del botón de registro la condición `|| !accepted` (preservando las condiciones existentes). El botón de **login** del mismo componente NO lleva esta restricción.

- [ ] **Step 5: Lint + build**

Run: `npx eslint "app/invite/[token]/page.tsx"`
Expected: sin salida.
Run: `npm run build`
Expected: exitoso.

- [ ] **Step 6: Commit**

```bash
git add "app/invite/[token]/page.tsx"
git commit -m "feat(legal): checkbox de aceptacion en registro por invitacion"
```

---

## Task 9: API admin lee consentimientos

**Files:**
- Modify: `app/api/admin/users/route.ts`

Agregar la lectura de `terms_acceptances` y devolver por usuario el último consentimiento + historial.

- [ ] **Step 1: Agregar query y merge**

En el `Promise.all` existente, agregar la query de aceptaciones:

```ts
  const [usersRes, eventsRes, guestsRes, partyRes, termsRes] = await Promise.all([
    supabaseAdmin.from('users').select('id, email, full_name, plan, created_at').order('created_at', { ascending: false }),
    supabaseAdmin.from('events').select('id, user_id, name, created_at'),
    supabaseAdmin.from('guests').select('id, event_id, rsvp_status'),
    supabaseAdmin.from('party_members').select('id, event_id'),
    supabaseAdmin.from('terms_acceptances').select('user_id, version, accepted_at, ip_address').order('accepted_at', { ascending: false }),
  ])
```

Después del bloque de `authByUserId`, construir el mapa de consentimientos:

```ts
  const termsByUser: Record<string, { version: string; accepted_at: string; ip_address: string | null }[]> = {}
  for (const t of termsRes.data || []) {
    if (!termsByUser[t.user_id]) termsByUser[t.user_id] = []
    termsByUser[t.user_id].push({ version: t.version, accepted_at: t.accepted_at, ip_address: t.ip_address })
  }
```

Y en el `map` final de `users`, agregar los campos (las filas ya vienen ordenadas por fecha desc, así que la primera es la última aceptación):

```ts
  const users = (usersRes.data || []).map(u => {
    const history = termsByUser[u.id] || []
    return {
      ...u,
      last_sign_in: authByUserId[u.id]?.last_sign_in_at ?? null,
      banned:       authByUserId[u.id]?.banned ?? false,
      terms_version:     history[0]?.version ?? null,
      terms_accepted_at: history[0]?.accepted_at ?? null,
      terms_history:     history,
    }
  })
```

Nota: si la tabla `terms_acceptances` aún no existe en Supabase, `termsRes` traerá error y `termsRes.data` será null → `terms_history` queda `[]` y `terms_version` null (degrada con gracia, no rompe el admin).

- [ ] **Step 2: Lint + build**

Run: `npx eslint app/api/admin/users/route.ts`
Expected: sin salida.
Run: `npm run build`
Expected: exitoso.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/users/route.ts
git commit -m "feat(legal): admin API expone consentimientos por usuario"
```

---

## Task 10: Columna + historial en `UsuariosTab`

**Files:**
- Modify: `app/admin/lib/types.ts`
- Modify: `app/admin/UsuariosTab.tsx`
- Modify: `app/admin/page.tsx` (mapear los campos nuevos al enriquecer)

- [ ] **Step 1: Extender `AdminUser` en `app/admin/lib/types.ts`**

Agregar al final de la interface `AdminUser` (antes del `}`):

```ts
  terms_version: string | null
  terms_accepted_at: string | null
  terms_history: { version: string; accepted_at: string; ip_address: string | null }[]
```

- [ ] **Step 2: Mapear en `app/admin/page.tsx`**

En `ApiUser` agregar los campos:

```ts
interface ApiUser {
  id: string
  email: string
  full_name: string | null
  plan: string
  created_at: string
  last_sign_in: string | null
  banned: boolean
  terms_version: string | null
  terms_accepted_at: string | null
  terms_history: { version: string; accepted_at: string; ip_address: string | null }[]
}
```

Y en el `return` del `map` de `enriched`, agregar:

```ts
        terms_version:     u.terms_version ?? null,
        terms_accepted_at: u.terms_accepted_at ?? null,
        terms_history:     u.terms_history ?? [],
```

- [ ] **Step 3: Columna en `UsuariosTab.tsx`**

Importar la versión vigente y un formateador arriba:

```tsx
import { CURRENT_LEGAL_VERSION } from '@/lib/legal'
```

En el `<thead>` desktop, agregar `<th>` "Terminos" entre "Ultimo login" y "Cambiar plan":

```tsx
                <th className="px-4 py-3 text-xs font-medium text-[#888]">Terminos</th>
```

En cada fila desktop, agregar la celda correspondiente (entre la de Ultimo login y la de Cambiar plan):

```tsx
                    <td className="px-4 py-3">
                      {u.terms_version === CURRENT_LEGAL_VERSION ? (
                        <span className="rounded-full bg-[#e8faf6] px-2 py-0.5 text-xs font-medium text-[#1a7a60]">
                          {'v' + u.terms_version + ' · ' + (u.terms_accepted_at ? formatDate(u.terms_accepted_at) : '')}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-xs font-medium text-[#cc3333]">Pendiente</span>
                      )}
                    </td>
```

Importante: el `colSpan` de las filas "Sin resultados" y de la fila expandida pasa de **8 a 9**.

- [ ] **Step 4: Historial en la fila expandida (desktop) y en mobile**

Dentro del bloque expandido desktop (`<td colSpan={9} ...>`), después del listado de eventos, agregar el bloque de consentimiento:

```tsx
                            <div className="mt-4">
                              <p className="mb-2 text-xs font-medium text-[#888]">Historial de consentimiento</p>
                              {u.terms_history.length === 0 ? (
                                <p className="text-xs text-[#aaa]">Sin aceptaciones registradas</p>
                              ) : (
                                <div className="space-y-1">
                                  {u.terms_history.map((h, i) => (
                                    <div key={i} className="text-xs text-[#666]">
                                      <span className="font-medium text-[#1D1E20]">{'v' + h.version}</span>
                                      {' · ' + formatDateTime(h.accepted_at) + (h.ip_address ? ' · IP ' + h.ip_address : '')}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
```

(Importar `formatDateTime` desde `./lib/format`.)

En el bloque expandido mobile, agregar el mismo listado debajo de los eventos.

En la sección de metadatos mobile (los `<span>` de conteos), agregar:

```tsx
                  <span>{'Terminos: ' + (u.terms_version === CURRENT_LEGAL_VERSION ? 'v' + u.terms_version : 'Pendiente')}</span>
```

- [ ] **Step 5: Lint + build**

Run: `npx eslint app/admin`
Expected: sin salida.
Run: `npm run build`
Expected: exitoso.

- [ ] **Step 6: Verificación manual end-to-end**

Con la tabla `terms_acceptances` ya creada en Supabase y `npm run dev`:
1. Registro nuevo: el botón "Crear cuenta" esta deshabilitado hasta marcar el checkbox. Al registrarse, en Supabase aparece una fila en `terms_acceptances` con version 1.0 e IP.
2. Login con un usuario existente (sin consentimiento): aparece el `<LegalGate />`. Al aceptar, se registra y el modal desaparece; recargar no lo vuelve a mostrar.
3. Superadmin → Usuarios: el usuario que acepto muestra `v1.0 · fecha` (verde); los demas, `Pendiente` (rojo). Al expandir, se ve el historial con IP.
4. Subir `CURRENT_LEGAL_VERSION` a `'1.1'` temporalmente y recargar como usuario al dia: el gate reaparece (re-consentimiento). Revertir a `'1.0'`.
5. `/terminos` y `/privacidad` cargan con el sello de version.

- [ ] **Step 7: Commit**

```bash
git add app/admin/lib/types.ts app/admin/page.tsx app/admin/UsuariosTab.tsx
git commit -m "feat(legal): consentimiento visible en superadmin (columna + historial)"
```

---

## Self-Review (hecho por quien escribe el plan)

**Cobertura del spec:**
- `lib/legal.ts` versión combinada → Task 1 ✓
- Tabla `terms_acceptances` (SQL de Diego) → entregado en spec; consumido en Tasks 2, 3, 9 ✓
- API accept con IP/UA + idempotencia → Task 2 ✓
- API status → Task 3 ✓
- `/terminos` borrador + sello en `/privacidad` → Task 4 ✓
- `<LegalGate />` fail-open + logout → Task 5; montaje en layout → Task 6 ✓
- Checkbox obligatorio en AuthModal → Task 7; en invite → Task 8 ✓
- Admin lee acceptances → Task 9; columna + historial → Task 10 ✓
- Cero cambios de Claude en Supabase / degradación con gracia si la tabla no existe → Task 9 nota ✓

**Placeholder scan:** Task 8 referencia "ubicar el registro inline" porque `invite/[token]/page.tsx` no se ha leído en detalle; el Step 1 instruye leerlo primero y los Steps 2-4 dan el código exacto a insertar. No hay TODOs en código.

**Type consistency:** `terms_version`/`terms_accepted_at`/`terms_history` definidos igual en `AdminUser` (Task 10.1), `ApiUser` (Task 10.2) y devueltos por la API (Task 9). `CURRENT_LEGAL_VERSION` y `LEGAL_DOCUMENT` de `lib/legal.ts` (Task 1) usados consistentemente en Tasks 2, 3, 5, 10. `formatDate`/`formatDateTime` ya existen en `app/admin/lib/format.ts`. El cambio de `colSpan` 8→9 anotado explícitamente en Task 10.3.
