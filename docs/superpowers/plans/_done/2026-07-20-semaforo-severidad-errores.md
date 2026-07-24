# Semáforo de severidad para errores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clasificar cada error por severidad (pantalla rota / error / cosmético) y reflejarlo en el aviso a Telegram con emoji, notificación silenciosa para cosméticos y etiqueta de zona.

**Architecture:** Reutiliza los error boundaries existentes (`global-error.tsx`, patrón `PreviewBoundary`) y el relay Sentry→Telegram existente (`lib/sentry-alerts/*` + webhook). Se agregan: etiquetas de severidad/zona en el cliente (boundaries + `beforeSend`) y un mapeo puro en el relay. Fase 2 instrumenta los `catch` de 3 flujos críticos con un helper `reportError`.

**Tech Stack:** Next.js 16 App Router, TypeScript, `@sentry/nextjs`, Vitest (lógica pura), Telegram Bot API.

## Global Constraints

- Sentry solo activo en producción (`isSentryEnabled`); nada debe romper si está apagado.
- UI en español CON acentos. Commits sin acentos ni ñ.
- Sin comentarios salvo WHY no obvio.
- Tests Vitest solo para lógica pura; boundaries, envío real y wiring se verifican manual (local → preview → prod).
- No emojis en el código UI; los emojis 🔴🟡🚨 viven solo en el texto del mensaje de Telegram.
- Full file replacement al editar; nunca fragmentos parciales fuera de los pasos aquí descritos.

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `lib/observabilidad/zona.ts` | pura: `zonaDesdePath(path)` → zona | Crear |
| `lib/observabilidad/zona.test.ts` | tests de `zonaDesdePath` | Crear |
| `lib/observabilidad/report.ts` | `reportError(err, {zona, severity})` wrapper de Sentry | Crear |
| `lib/sentry-alerts/format.ts` | + `severidadDesdeAlerta`, tags en parse, emoji+zona en mensaje | Modificar |
| `lib/sentry-alerts/format.test.ts` | tests de severidad/parse | Crear o extender |
| `lib/sentry-alerts/send.ts` | soporte `disable_notification` | Modificar |
| `app/api/webhook/sentry/route.ts` | pasa flag silencioso a send | Modificar |
| `app/global-error.tsx` | captura con `fatal` + `impact: pantalla-rota` | Modificar |
| `app/components/CosmeticBoundary.tsx` | aísla + reporta adorno como cosmético | Crear |
| `app/layout.tsx` | envuelve Banner y AttributionCapture (no PostHog) | Modificar |
| `instrumentation-client.ts` | `beforeSend` etiqueta zona por URL | Modificar |
| `app/components/invitacion/sections/RsvpSection.tsx` | reportError en catch de confirmar | Modificar |
| `app/components/invitacion/RegistroForm.tsx` | reportError en catch de registro/puerta | Modificar |
| `app/events/[id]/page.tsx` | reportError en add/edit/delete/import invitado | Modificar |

---

## Task 1: `zonaDesdePath` (lógica pura)

**Files:**
- Create: `lib/observabilidad/zona.ts`
- Test: `lib/observabilidad/zona.test.ts`

**Interfaces:**
- Produces: `export function zonaDesdePath(path: string | undefined): string` → `"invitacion-publica" | "planner" | "general"`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { zonaDesdePath } from "./zona";

describe("zonaDesdePath", () => {
  it("rutas publicas de invitados", () => {
    expect(zonaDesdePath("/invitacion/boda/abc")).toBe("invitacion-publica");
    expect(zonaDesdePath("/mesa/xyz")).toBe("invitacion-publica");
    expect(zonaDesdePath("/playlist/tok")).toBe("invitacion-publica");
  });
  it("rutas del planner", () => {
    expect(zonaDesdePath("/events/1")).toBe("planner");
    expect(zonaDesdePath("/dashboard")).toBe("planner");
    expect(zonaDesdePath("/perfil")).toBe("planner");
    expect(zonaDesdePath("/admin")).toBe("planner");
  });
  it("cae a general en lo desconocido o vacio", () => {
    expect(zonaDesdePath("/")).toBe("general");
    expect(zonaDesdePath("/privacidad")).toBe("general");
    expect(zonaDesdePath(undefined)).toBe("general");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run lib/observabilidad/zona.test.ts`
Expected: FAIL con "zona" no encontrado / módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

```ts
export function zonaDesdePath(path: string | undefined): string {
  if (!path) return "general";
  if (/^\/(invitacion|mesa|playlist)\b/.test(path)) return "invitacion-publica";
  if (/^\/(events|dashboard|perfil|admin)\b/.test(path)) return "planner";
  return "general";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run lib/observabilidad/zona.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/observabilidad/zona.ts lib/observabilidad/zona.test.ts
git commit -m "feat(observabilidad): zonaDesdePath deriva zona desde la URL"
```

---

## Task 2: severidad + parseo de tags + mensaje enriquecido (`format.ts`)

**Files:**
- Modify: `lib/sentry-alerts/format.ts`
- Test: `lib/sentry-alerts/format.test.ts` (crear si no existe; si existe, agregar el bloque describe nuevo)

**Interfaces:**
- Consumes: tipo `SentryAlert` existente.
- Produces:
  - `SentryAlert` extendido con `severity?: string; impact?: string; zona?: string`
  - `export function severidadDesdeAlerta(a: SentryAlert): { emoji: string; etiqueta: string; silent: boolean }`
  - `formatTelegramMessage(a)` antepone `emoji etiqueta` y agrega línea `Zona: <zona>` cuando hay zona.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { severidadDesdeAlerta, parseSentryWebhook, formatTelegramMessage } from "./format";

describe("severidadDesdeAlerta", () => {
  it("pantalla rota por impact es urgente y no silenciosa", () => {
    const s = severidadDesdeAlerta({ title: "x", impact: "pantalla-rota" });
    expect(s.silent).toBe(false);
    expect(s.emoji).toContain("🚨");
  });
  it("pantalla rota por level fatal tambien", () => {
    const s = severidadDesdeAlerta({ title: "x", level: "fatal" });
    expect(s.emoji).toContain("🚨");
    expect(s.silent).toBe(false);
  });
  it("cosmetico es silencioso y amarillo", () => {
    const s = severidadDesdeAlerta({ title: "x", severity: "cosmetico" });
    expect(s.silent).toBe(true);
    expect(s.emoji).toBe("🟡");
  });
  it("default es rojo no silencioso", () => {
    const s = severidadDesdeAlerta({ title: "x" });
    expect(s.silent).toBe(false);
    expect(s.emoji).toBe("🔴");
  });
});

describe("parseSentryWebhook lee tags", () => {
  it("extrae severity/impact/zona de tags como pares", () => {
    const body = {
      data: {
        event: {
          title: "boom",
          environment: "production",
          tags: [["severity", "cosmetico"], ["zona", "planner"]],
        },
      },
    };
    const a = parseSentryWebhook(body);
    expect(a?.severity).toBe("cosmetico");
    expect(a?.zona).toBe("planner");
  });
});

describe("formatTelegramMessage muestra emoji y zona", () => {
  it("antepone emoji y agrega zona", () => {
    const msg = formatTelegramMessage({ title: "boom", zona: "invitacion-publica" });
    expect(msg).toContain("🔴");
    expect(msg).toContain("Zona: invitacion-publica");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run lib/sentry-alerts/format.test.ts`
Expected: FAIL (`severidadDesdeAlerta` no existe; `severity`/`zona` no en el tipo).

- [ ] **Step 3: Write minimal implementation**

En `lib/sentry-alerts/format.ts`, extiende el tipo y agrega el parseo de tags + la función de severidad. Reemplaza el bloque del tipo `SentryAlert`, `parseSentryWebhook` y `formatTelegramMessage` por:

```ts
export type SentryAlert = {
  title: string;
  level?: string;
  environment?: string;
  project?: string;
  url?: string;
  culprit?: string;
  rule?: string;
  severity?: string;
  impact?: string;
  zona?: string;
};
```

Agrega, junto a los helpers `asObj`/`str` existentes, un lector de tags que soporta pares `[k,v]` y objeto:

```ts
function tagValue(node: AnyObj, key: string): string | undefined {
  const tags = node.tags;
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (Array.isArray(t) && t[0] === key) return str(t[1]);
      const o = asObj(t);
      if (o && str(o.key) === key) return str(o.value);
    }
  }
  const obj = asObj(tags);
  if (obj) return str(obj[key]);
  return undefined;
}
```

En `parseSentryWebhook`, dentro del `return {...}`, agrega tres campos:

```ts
    severity: tagValue(node, "severity"),
    impact: tagValue(node, "impact"),
    zona: tagValue(node, "zona"),
```

Agrega la función de severidad (antes de `formatTelegramMessage`):

```ts
export function severidadDesdeAlerta(a: SentryAlert): {
  emoji: string;
  etiqueta: string;
  silent: boolean;
} {
  if (a.impact === "pantalla-rota" || a.level === "fatal") {
    return { emoji: "🔴🚨", etiqueta: "PANTALLA EN BLANCO", silent: false };
  }
  if (a.severity === "cosmetico") {
    return { emoji: "🟡", etiqueta: "Cosmético", silent: true };
  }
  return { emoji: "🔴", etiqueta: "Error", silent: false };
}
```

Reemplaza `formatTelegramMessage` por:

```ts
export function formatTelegramMessage(a: SentryAlert): string {
  const sev = severidadDesdeAlerta(a);
  const level = (a.level ?? "error").toUpperCase();
  const lines: string[] = [
    `${sev.emoji} <b>[${escapeHtml(level)}] ${escapeHtml(a.title)}</b>`,
  ];
  const head = [a.project, a.environment].filter(Boolean).join(" · ");
  if (head) lines.push(escapeHtml(head));
  if (a.zona) lines.push(escapeHtml(`Zona: ${a.zona}`));
  if (a.rule) lines.push(escapeHtml(`Regla: ${a.rule}`));
  if (a.culprit) lines.push(`<code>${escapeHtml(a.culprit)}</code>`);
  if (a.url) lines.push(`<a href="${escapeHtml(a.url)}">Ver en Sentry</a>`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run lib/sentry-alerts/format.test.ts`
Expected: PASS (todos los bloques nuevos + los previos si el archivo ya existía).

- [ ] **Step 5: Commit**

```bash
git add lib/sentry-alerts/format.ts lib/sentry-alerts/format.test.ts
git commit -m "feat(alertas): severidad, tags y zona en el mensaje de Telegram"
```

---

## Task 3: envío silencioso (`send.ts` + webhook)

**Files:**
- Modify: `lib/sentry-alerts/send.ts`
- Modify: `app/api/webhook/sentry/route.ts`

**Interfaces:**
- Consumes: `severidadDesdeAlerta` (Task 2).
- Produces: `sendTelegramMessage(text, cfg, opts?: { silent?: boolean })`.

- [ ] **Step 1: Modificar `send.ts`**

Reemplaza la firma y el body para aceptar `opts`:

```ts
export type TelegramConfig = { token: string; chatId: string };

export async function sendTelegramMessage(
  text: string,
  cfg: TelegramConfig,
  opts?: { silent?: boolean }
): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${cfg.token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        disable_notification: Boolean(opts?.silent),
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telegram ${res.status}: ${detail.slice(0, 200)}`);
  }
}
```

- [ ] **Step 2: Modificar el webhook**

En `app/api/webhook/sentry/route.ts`, agrega `severidadDesdeAlerta` al import desde `@/lib/sentry-alerts/format` y usa el flag silencioso en el envío. Reemplaza el bloque `try { await sendTelegramMessage(...) }`:

```ts
  try {
    const { silent } = severidadDesdeAlerta(alert);
    await sendTelegramMessage(formatTelegramMessage(alert), { token, chatId }, { silent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "telegram fallo";
    console.error("[sentry-webhook] telegram error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
```

- [ ] **Step 3: Verificar que compila y tests siguen verdes**

Run: `npx tsc --noEmit && npm test -- --run lib/sentry-alerts`
Expected: sin errores de tipo; tests PASS. (El envío real y el silencio se verifican manual en prod.)

- [ ] **Step 4: Commit**

```bash
git add lib/sentry-alerts/send.ts app/api/webhook/sentry/route.ts
git commit -m "feat(alertas): notificacion silenciosa para errores cosmeticos"
```

---

## Task 4: marcar pantalla rota (`global-error.tsx`)

**Files:**
- Modify: `app/global-error.tsx:16`

- [ ] **Step 1: Editar la captura**

Reemplaza la línea `Sentry.captureException(error);` por:

```ts
    Sentry.captureException(error, {
      level: "fatal",
      tags: { impact: "pantalla-rota", zona: "general" },
    });
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores. (El disparo real se verifica manual: forzar un crash de página en preview y confirmar el aviso 🔴🚨.)

- [ ] **Step 3: Commit**

```bash
git add app/global-error.tsx
git commit -m "feat(observabilidad): global-error marca pantalla rota como fatal"
```

---

## Task 5: `CosmeticBoundary` + envolver adornos

**Files:**
- Create: `app/components/CosmeticBoundary.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `export default class CosmeticBoundary` con props `{ zona: string; children: ReactNode }`.

- [ ] **Step 1: Crear el boundary**

```tsx
'use client'

import { Component, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'

export default class CosmeticBoundary extends Component<
  { zona: string; children: ReactNode },
  { fallo: boolean }
> {
  state = { fallo: false }

  static getDerivedStateFromError() {
    return { fallo: true }
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error, {
      level: 'warning',
      tags: { severity: 'cosmetico', zona: this.props.zona },
    })
  }

  render() {
    if (this.state.fallo) return null
    return this.props.children
  }
}
```

- [ ] **Step 2: Envolver los adornos hoja en `layout.tsx`**

Solo se envuelven widgets *hoja* (que renderizan un banner o `null`): `InstallPrompt` y `AttributionCapture`. **NO** se envuelve `PostHogProvider`: ese provider envuelve `{children}` (toda la app), así que un boundary a su alrededor tragaría cualquier crash real como "cosmético" y dejaría la app en blanco. Los errores de PostHog son async (init en `useEffect`, no en render) y un boundary no los atrapa; ya los cubre `ignoreErrors`/`beforeSend`.

Agrega el import:

```tsx
import CosmeticBoundary from './components/CosmeticBoundary'
```

En el body, deja `PostHogProvider` intacto y envuelve solo estas dos piezas:

```tsx
        <PostHogProvider>{children}</PostHogProvider>
        <SentryUser />
        <CosmeticBoundary zona="analytics">
          <AttributionCapture />
        </CosmeticBoundary>
        <FeedbackModal />
        <LegalGate />
        <CosmeticBoundary zona="banner-instalar">
          <InstallPrompt />
        </CosmeticBoundary>
```

- [ ] **Step 3: Verificar compila y build**

Run: `npx tsc --noEmit && npm run build`
Expected: build exitoso. (El aislamiento real se verifica manual.)

- [ ] **Step 4: Commit**

```bash
git add app/components/CosmeticBoundary.tsx app/layout.tsx
git commit -m "feat(observabilidad): CosmeticBoundary aisla y reporta adornos"
```

---

## Task 6: etiqueta de zona automática (`beforeSend`)

**Files:**
- Modify: `instrumentation-client.ts`

**Interfaces:**
- Consumes: `zonaDesdePath` (Task 1).

- [ ] **Step 1: Agregar `beforeSend` al init del cliente**

En `instrumentation-client.ts`, agrega el import y un `beforeSend` que etiqueta la zona si el evento no trae una ya (la del CosmeticBoundary gana). Import:

```ts
import { zonaDesdePath } from "@/lib/observabilidad/zona";
```

Dentro del objeto de `Sentry.init({ ... })`, agrega la propiedad:

```ts
  beforeSend(event) {
    event.tags = event.tags ?? {};
    if (!event.tags.zona) {
      event.tags.zona =
        typeof window !== "undefined"
          ? zonaDesdePath(window.location.pathname)
          : "general";
    }
    return event;
  },
```

- [ ] **Step 2: Verificar compila y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores; build exitoso.

- [ ] **Step 3: Commit**

```bash
git add instrumentation-client.ts
git commit -m "feat(observabilidad): beforeSend etiqueta la zona por URL"
```

---

## Task 7: helper `reportError` (Fase 2)

**Files:**
- Create: `lib/observabilidad/report.ts`

**Interfaces:**
- Produces: `export function reportError(error: unknown, opts: { zona: string; severity?: string }): void`

- [ ] **Step 1: Crear el helper**

```ts
import * as Sentry from "@sentry/nextjs";

export function reportError(
  error: unknown,
  opts: { zona: string; severity?: string }
): void {
  Sentry.captureException(error, {
    tags: { zona: opts.zona, severity: opts.severity ?? "error" },
  });
}
```

- [ ] **Step 2: Verificar compila**

Run: `npx tsc --noEmit`
Expected: sin errores. (Sentry no-op cuando está deshabilitado; se verifica manual en prod.)

- [ ] **Step 3: Commit**

```bash
git add lib/observabilidad/report.ts
git commit -m "feat(observabilidad): helper reportError para catch de flujos criticos"
```

---

## Task 8: instrumentar confirmar RSVP + registro/puerta (Fase 2)

**Files:**
- Modify: `app/components/invitacion/sections/RsvpSection.tsx:266`
- Modify: `app/components/invitacion/RegistroForm.tsx:59`

**Interfaces:**
- Consumes: `reportError` (Task 7).

- [ ] **Step 1: RsvpSection — agregar import**

Agrega arriba, junto a los imports existentes:

```ts
import { reportError } from '@/lib/observabilidad/report'
```

- [ ] **Step 2: RsvpSection — reportar en el catch**

Reemplaza el bloque `catch` de `handleSubmit` (línea ~266):

```ts
    } catch (err) {
      reportError(err, { zona: 'invitacion-publica' })
      setError('No pudimos guardar tu confirmación. Intenta de nuevo.')
    } finally {
```

- [ ] **Step 3: RegistroForm — agregar import**

```ts
import { reportError } from '@/lib/observabilidad/report'
```

- [ ] **Step 4: RegistroForm — reportar en el catch**

Reemplaza el bloque `catch` de `submit` (línea ~59). Solo el catch de excepción, NO el branch `!res.ok` (esos son errores de negocio esperados como `sin_lugar`):

```ts
    } catch (err) {
      reportError(err, { zona: 'invitacion-publica' })
      setError('No pudimos registrarte. Intenta de nuevo.')
    } finally {
```

- [ ] **Step 5: Verificar compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/components/invitacion/sections/RsvpSection.tsx app/components/invitacion/RegistroForm.tsx
git commit -m "feat(observabilidad): reporta fallas de confirmar RSVP y registro"
```

---

## Task 9: instrumentar guardar invitado (Fase 2)

**Files:**
- Modify: `app/events/[id]/page.tsx` (bloques `if (error)` de add/edit/delete/import)

**Interfaces:**
- Consumes: `reportError` (Task 7).

Nota: en este archivo los guardados usan `const { error } = await supabase...; if (error) { alert(...) }` (no `try/catch`). Se agrega `reportError` dentro de esos `if (error)`.

- [ ] **Step 1: Agregar import**

Junto a los imports existentes del archivo:

```ts
import { reportError } from '@/lib/observabilidad/report'
```

- [ ] **Step 2: Instrumentar los 4 sitios**

En cada bloque `if (error)` de estas operaciones, agrega `reportError(error, { zona: 'planner' })` como primera línea del bloque, sin quitar el `alert`/`return` existente:

- Editar invitado (línea ~1018, tras `const { error } = await supabase.from('guests').update(...)`).
- Eliminar invitado (línea ~967, el bloque que hace `alert('No se pudo eliminar el invitado...')`).
- Crear invitado (línea ~1198, tras `const { data: guestData, error } = await supabase.from('guests').insert(...)`).
- Import CSV (línea ~1282, tras `const { data: insertedGuests, error } = await supabase.from('guests').insert(guestPayload)...`).

Patrón exacto a aplicar en cada uno (ejemplo para editar):

```ts
    if (error) {
      reportError(error, { zona: 'planner' })
      alert('No se pudo guardar los cambios. Intenta de nuevo.')
      return
    }
```

Ajusta el texto del `alert` al que ya exista en cada sitio; NO cambies el mensaje visible, solo antepón la línea `reportError`. Si algún sitio no tiene `if (error)` (p. ej. hace la operación sin revisar `error`), envuélvelo primero en `if (error) { reportError(...) }` sin alterar el flujo de éxito.

- [ ] **Step 3: Verificar compila y build**

Run: `npx tsc --noEmit && npm run build`
Expected: build exitoso.

- [ ] **Step 4: Commit**

```bash
git add app/events/[id]/page.tsx
git commit -m "feat(observabilidad): reporta fallas al guardar invitado"
```

---

## Verificación final (manual, antes de PR)

- [ ] `npm test` — toda la lógica pura verde.
- [ ] `npm run build` — build de producción exitoso.
- [ ] `npx eslint` sobre los archivos tocados — sin errores nuevos.
- [ ] Revisión visual: los boundaries cosméticos no cambian la UI en el caso feliz.
- [ ] (En preview) forzar un error cosmético y uno de página; confirmar en Telegram: cosmético llega 🟡 silencioso, página llega 🔴🚨, ambos con `Zona:`.

## Notas de despliegue

- Merge a `main` dispara el deploy en Vercel (auto). Requiere OK explícito de Diego.
- No hay cambios de env vars ni de schema Supabase.
- Confirmar en el primer error real de prod que los tags (`severity`, `zona`, `impact`) llegan al webhook; si Sentry no los incluye en el payload `issue.created`, ajustar `tagValue` o cambiar el disparador del webhook a `error.created`.
