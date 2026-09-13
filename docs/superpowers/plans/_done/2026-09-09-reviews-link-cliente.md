# Link del cliente (review de desempeño del cliente final) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El planner manda un link público a su cliente al terminar el evento; el cliente califica, uno por uno y desde el teléfono, a los proveedores contratados que el planner eligió; el link vence 14 días después del evento y un admin puede darle más tiempo o reactivarlo.

**Architecture:** Tres columnas nuevas en `event_settings` (token, vencimiento, selección de proveedores), sin tabla nueva. La escritura del cliente entra por una API con service role que valida token, vigencia y selección, y hace upsert en `supplier_reviews` con `autor = 'cliente'`. Del lado del planner: un aviso de una línea arriba de la lista de Proveedores con el plazo, un modal para elegir a quién califican y mandar por WhatsApp, y un renglón "Según el cliente" en la lista "Qué falta" de la ficha.

**Tech Stack:** Next.js 16 App Router, Supabase (service role solo en la API), Vitest para la lógica pura, Tailwind, Lucide.

**Spec:** `docs/superpowers/specs/2026-09-06-reviews-proveedores-design.md` §2.3, §3.4, §4, §5. Mockups aprobados: formulario del cliente https://claude.ai/code/artifact/d4e2a7c8-3ed6-469c-bf0d-9a08718aa78c · aviso + lista (B + 2) https://claude.ai/code/artifact/6319496f-6302-423f-8bc6-d3117a2716fc

## Global Constraints

- Copy en español de México con acentos. **"evento" y "cliente", nunca "boda" ni "novios"** en pantalla.
- **Avisos de una línea**: verbo + objeto + fecha. El porqué no va en el banner.
- Sin emojis; iconos Lucide. CTA en teal `#48C9B0`. Negro `#1D1E20` solo en dropdowns de filtro.
- Fechas de evento son `'YYYY-MM-DD'`: se parten a mano, nunca `new Date(iso)` (corrimiento UTC).
- Sin tablas nuevas. Sin `git add -A`. Commits sin acentos ni ñ, convencionales.
- Cada escritura a Supabase desde el navegador pide `.select()` y pasa por `interpretarEscritura` (un UPDATE filtrado por RLS no da error).
- Un `1` del cliente en recomendación **no veta**: solo se guarda.
- Todo lo que el cliente ve del planner es: nombre del evento y nombres/categorías de los proveedores elegidos. Nada más.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/reviews/ejes.ts` (modificar) | contexto `desempeno_cliente` con anclas espejo; recomendación del cliente |
| `lib/reviews/link-cliente.ts` (crear) | plazo, estado del link, textos del aviso, URL, mensaje de WhatsApp |
| `lib/reviews/opinion-publica.ts` (crear) | parseo y validación de lo que manda el cliente |
| `lib/rolodex/fecha-corta.ts` (modificar) | exportar `MESES_CORTOS` y `fechaCortaISO` |
| `lib/types.ts` (modificar) | tres campos en `EventSettings` |
| `docs/superpowers/plans/sql/2026-09-09-reviews-link-cliente.sql` (crear) | columnas + candado del trigger |
| `app/api/opinion/[token]/route.ts` (crear) | GET datos del formulario · POST guardar una review del cliente |
| `app/opinion/[token]/page.tsx` (crear) | la superficie pública, un proveedor por pantalla |
| `app/events/[id]/proveedores/PedirOpinionModal.tsx` (crear) | elegir proveedores, enviar por WhatsApp, copiar link |
| `app/events/[id]/proveedores/AvisoOpinionCliente.tsx` (crear) | el aviso arriba de la lista + Dar más tiempo |
| `app/events/[id]/proveedores/page.tsx` (modificar) | cargar ajustes del link, contar contestados, montar aviso y modal |
| `app/events/[id]/proveedores/FichaDelEvento.tsx` (modificar) | renglón "Según el cliente" en "Qué falta" |
| `app/events/[id]/proveedores/FichaModal.tsx`, `SupplierFicheroView.tsx` (modificar) | pasar la prop `opinionCliente` |

---

### Task 1: Anclas espejo y recomendación del cliente

**Files:**
- Modify: `lib/reviews/ejes.ts`
- Test: `lib/reviews/ejes.test.ts`

**Interfaces:**
- Produces: `ContextoAnclas` gana `'desempeno_cliente'`; `anclasDe('desempeno_cliente', eje)` cae a `desempeno` cuando no hay espejo; `ANCLAS_RECOMENDACION_CLIENTE: string[]`; `ETIQUETA_NO_APLICO_CLIENTE = 'No hubo imprevistos'`.

- [ ] **Step 1: Prueba que falla**

```ts
// lib/reviews/ejes.test.ts (agregar al final)
describe('anclas del cliente (contexto desempeno_cliente)', () => {
  it('comunicacion, servicio_trato y manejo_imprevistos hablan en plural', () => {
    expect(anclasDe('desempeno_cliente', 'comunicacion')).toEqual([
      'Nunca pudimos localizarlo',
      'Tuvimos que perseguirlo todo el proceso',
      'Respondía, pero siempre empezábamos nosotros',
      'Accesible y claro todo el proceso',
      'Proactivo, nos avisaba antes de preguntar',
    ])
    expect(anclasDe('desempeno_cliente', 'servicio_trato')[0]).toBe('Nos trató mal a nosotros o a nuestros invitados')
    expect(anclasDe('desempeno_cliente', 'manejo_imprevistos')[4]).toBe('Lo resolvió sin que nos enteráramos')
  })

  it('precio_valor y calidad caen textualmente a las del planner', () => {
    expect(anclasDe('desempeno_cliente', 'precio_valor')).toEqual(anclasDe('desempeno', 'precio_valor'))
    expect(anclasDe('desempeno_cliente', 'calidad')).toEqual(anclasDe('desempeno', 'calidad'))
  })

  it('la recomendacion del cliente cambia solo el ancla 5', () => {
    expect(ANCLAS_RECOMENDACION_CLIENTE.slice(0, 4)).toEqual(ANCLAS_RECONTRATACION.slice(0, 4))
    expect(ANCLAS_RECOMENDACION_CLIENTE[4]).toBe('Definitivamente sí, sería nuestra primera opción')
  })

  it('el boton de no aplico del cliente dice que no hubo imprevistos', () => {
    expect(ETIQUETA_NO_APLICO_CLIENTE).toBe('No hubo imprevistos')
  })
})
```

Ajustar el import del test: `import { anclasDe, ANCLAS_RECONTRATACION, ANCLAS_RECOMENDACION_CLIENTE, ETIQUETA_NO_APLICO_CLIENTE } from './ejes'` (conservar lo que ya importa).

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run lib/reviews/ejes.test.ts`
Expected: FAIL, `ANCLAS_RECOMENDACION_CLIENTE` no existe.

- [ ] **Step 3: Implementar**

En `lib/reviews/ejes.ts`:

```ts
export type ContextoAnclas = 'propuesta' | 'desempeno' | 'desempeno_cliente'
```

Agregar dentro de `ANCLAS`, después de `desempeno: {...}`:

```ts
  // La voz del cliente: mismo eje, mismo 1-5, misma posicion. Solo cambia el
  // sujeto de la frase. precio_valor y calidad no tienen espejo porque ya
  // estaban escritas sin sujeto: anclasDe cae a 'desempeno'.
  desempeno_cliente: {
    comunicacion: [
      'Nunca pudimos localizarlo',
      'Tuvimos que perseguirlo todo el proceso',
      'Respondía, pero siempre empezábamos nosotros',
      'Accesible y claro todo el proceso',
      'Proactivo, nos avisaba antes de preguntar',
    ],
    servicio_trato: [
      'Nos trató mal a nosotros o a nuestros invitados',
      'Correcto pero frío',
      'Profesional, sin más',
      'Cálido, se notó',
      'Lo comentamos entre nosotros sin que nadie preguntara',
    ],
    manejo_imprevistos: [
      'Empeoró el problema o lo negó',
      'Se paralizó, lo resolvieron otros',
      'Resolvió a medias o con ayuda',
      'Resolvió solo, sin alarmar a nadie',
      'Lo resolvió sin que nos enteráramos',
    ],
  },
```

Después de `ANCLAS_RECONTRATACION`:

```ts
export const ANCLAS_RECOMENDACION_CLIENTE = [
  ...ANCLAS_RECONTRATACION.slice(0, 4),
  'Definitivamente sí, sería nuestra primera opción',
]

export const ETIQUETA_NO_APLICO_CLIENTE = 'No hubo imprevistos'
```

Reemplazar `anclasDe`:

```ts
export function anclasDe(contexto: ContextoAnclas, eje: Eje): string[] {
  const propias = ANCLAS[contexto][eje]
  if (propias) return propias
  if (contexto === 'desempeno_cliente') return ANCLAS.desempeno[eje] ?? []
  return []
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run lib/reviews/ejes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reviews/ejes.ts lib/reviews/ejes.test.ts
git commit -m "feat(reviews): anclas espejo y recomendacion en la voz del cliente"
```

---

### Task 2: Fechas cortas compartidas

**Files:**
- Modify: `lib/rolodex/fecha-corta.ts`
- Test: `lib/rolodex/fecha-corta.test.ts` (crear si no existe)

**Interfaces:**
- Produces: `export const MESES_CORTOS`; `fechaCortaISO(iso: string | null): string` → `'26 jul'` a partir de `'2026-07-26'` sin pasar por `new Date`.

- [ ] **Step 1: Prueba que falla**

```ts
// lib/rolodex/fecha-corta.test.ts
import { describe, it, expect } from 'vitest'
import { fechaCortaISO, MESES_CORTOS } from './fecha-corta'

describe('fechaCortaISO', () => {
  it('parte la fecha a mano: 2026-07-26 es 26 jul, sin corrimiento UTC', () => {
    expect(fechaCortaISO('2026-07-26')).toBe('26 jul')
    expect(fechaCortaISO('2026-01-01')).toBe('1 ene')
  })
  it('vacio o basura devuelve cadena vacia', () => {
    expect(fechaCortaISO(null)).toBe('')
    expect(fechaCortaISO('hoy')).toBe('')
  })
  it('los meses son doce', () => {
    expect(MESES_CORTOS).toHaveLength(12)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run lib/rolodex/fecha-corta.test.ts`
Expected: FAIL, `fechaCortaISO` no existe.

- [ ] **Step 3: Implementar**

En `lib/rolodex/fecha-corta.ts` cambiar `const MESES_CORTOS` por `export const MESES_CORTOS` y agregar al final:

```ts
// Para fechas de evento ('YYYY-MM-DD'): se parten a mano para no caer en el
// corrimiento UTC de new Date('2026-07-26'), que en Mexico da el 25.
export function fechaCortaISO(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  const mes = MESES_CORTOS[Number(m[2]) - 1]
  if (!mes) return ''
  return `${Number(m[3])} ${mes}`
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run lib/rolodex/fecha-corta.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rolodex/fecha-corta.ts lib/rolodex/fecha-corta.test.ts
git commit -m "feat(rolodex): fechaCortaISO para fechas de evento sin corrimiento"
```

---

### Task 3: El plazo y el estado del link (lógica pura)

**Files:**
- Create: `lib/reviews/link-cliente.ts`
- Test: `lib/reviews/link-cliente.test.ts`

**Interfaces:**
- Produces:

```ts
export const DIAS_PLAZO_CLIENTE = 14
export type EstadoLink = 'antes' | 'sin_pedir' | 'enviada' | 'por_vencer' | 'vencida'
export type InfoLink = { estado: EstadoLink; vence: string | null; diasRestantes: number | null }
export function sumarDias(iso: string, dias: number): string
export function diasEntre(desde: string, hasta: string): number
export function venceDefault(ultimoDiaEvento: string): string
export function estadoDelLink(a: { hoy: string; ultimoDiaEvento: string | null; token: string | null; expiresAt: string | null }): InfoLink
export function extenderVencimiento(a: { hoy: string; venceActual: string | null; dias: number }): string
export function textoAviso(info: InfoLink, contestados: number, total: number): string
export function urlOpinion(origin: string, token: string): string
export function mensajeWhatsApp(nombreEvento: string, url: string): string
```

- [ ] **Step 1: Prueba que falla**

```ts
// lib/reviews/link-cliente.test.ts
import { describe, it, expect } from 'vitest'
import {
  DIAS_PLAZO_CLIENTE, sumarDias, diasEntre, venceDefault, estadoDelLink,
  extenderVencimiento, textoAviso, urlOpinion, mensajeWhatsApp,
} from './link-cliente'

describe('fechas', () => {
  it('suma dias sin pasar por UTC', () => {
    expect(sumarDias('2026-07-12', 14)).toBe('2026-07-26')
    expect(sumarDias('2026-12-25', 10)).toBe('2027-01-04')
  })
  it('cuenta dias entre dos fechas', () => {
    expect(diasEntre('2026-07-14', '2026-07-26')).toBe(12)
    expect(diasEntre('2026-07-27', '2026-07-26')).toBe(-1)
  })
  it('el plazo por defecto es 14 dias despues del ultimo dia del evento', () => {
    expect(DIAS_PLAZO_CLIENTE).toBe(14)
    expect(venceDefault('2026-07-12')).toBe('2026-07-26')
  })
})

describe('estadoDelLink', () => {
  const base = { ultimoDiaEvento: '2026-07-12', token: null, expiresAt: null }

  it('antes del evento (o el mismo dia) no se puede pedir', () => {
    expect(estadoDelLink({ ...base, hoy: '2026-07-01' }).estado).toBe('antes')
    expect(estadoDelLink({ ...base, hoy: '2026-07-12' }).estado).toBe('antes')
  })
  it('sin fecha de evento no hay nada que pedir', () => {
    expect(estadoDelLink({ ...base, ultimoDiaEvento: null, hoy: '2026-07-20' }).estado).toBe('antes')
  })
  it('paso el evento y no hay token: sin pedir, con el plazo por defecto', () => {
    const info = estadoDelLink({ ...base, hoy: '2026-07-14' })
    expect(info).toEqual({ estado: 'sin_pedir', vence: '2026-07-26', diasRestantes: 12 })
  })
  it('con token y plazo vivo: enviada', () => {
    expect(estadoDelLink({ ...base, token: 'abc', hoy: '2026-07-14' }).estado).toBe('enviada')
  })
  it('a 3 dias o menos del vencimiento: por vencer', () => {
    expect(estadoDelLink({ ...base, token: 'abc', hoy: '2026-07-23' }).estado).toBe('por_vencer')
    expect(estadoDelLink({ ...base, token: 'abc', hoy: '2026-07-26' })).toEqual({ estado: 'por_vencer', vence: '2026-07-26', diasRestantes: 0 })
  })
  it('pasado el vencimiento: vencida, con o sin token', () => {
    expect(estadoDelLink({ ...base, token: 'abc', hoy: '2026-07-27' }).estado).toBe('vencida')
    expect(estadoDelLink({ ...base, token: null, hoy: '2026-07-27' }).estado).toBe('vencida')
  })
  it('un vencimiento guardado manda sobre el plazo por defecto', () => {
    const info = estadoDelLink({ ...base, token: 'abc', expiresAt: '2026-08-09', hoy: '2026-07-30' })
    expect(info).toEqual({ estado: 'enviada', vence: '2026-08-09', diasRestantes: 10 })
  })
})

describe('extenderVencimiento', () => {
  it('suma a la fecha actual de vencimiento si sigue viva', () => {
    expect(extenderVencimiento({ hoy: '2026-07-20', venceActual: '2026-07-26', dias: 7 })).toBe('2026-08-02')
  })
  it('si ya vencio, suma desde hoy', () => {
    expect(extenderVencimiento({ hoy: '2026-08-01', venceActual: '2026-07-26', dias: 7 })).toBe('2026-08-08')
  })
  it('sin vencimiento actual, suma desde hoy', () => {
    expect(extenderVencimiento({ hoy: '2026-08-01', venceActual: null, dias: 14 })).toBe('2026-08-15')
  })
})

describe('textoAviso: una linea', () => {
  it('sin pedir', () => {
    expect(textoAviso({ estado: 'sin_pedir', vence: '2026-07-26', diasRestantes: 12 }, 0, 8))
      .toBe('Pide la opinión de tu cliente · vence el 26 jul')
  })
  it('enviada', () => {
    expect(textoAviso({ estado: 'enviada', vence: '2026-07-26', diasRestantes: 9 }, 3, 8))
      .toBe('Tu cliente lleva 3 de 8 · vence el 26 jul')
  })
  it('por vencer: hoy, manana, en N dias', () => {
    expect(textoAviso({ estado: 'por_vencer', vence: '2026-07-26', diasRestantes: 0 }, 3, 8)).toBe('Vence hoy · 3 de 8')
    expect(textoAviso({ estado: 'por_vencer', vence: '2026-07-26', diasRestantes: 1 }, 3, 8)).toBe('Vence mañana · 3 de 8')
    expect(textoAviso({ estado: 'por_vencer', vence: '2026-07-26', diasRestantes: 2 }, 3, 8)).toBe('Vence en 2 días · 3 de 8')
  })
  it('vencida', () => {
    expect(textoAviso({ estado: 'vencida', vence: '2026-07-26', diasRestantes: -3 }, 3, 8)).toBe('Venció el 26 jul · 3 de 8')
  })
})

describe('link y mensaje', () => {
  it('la url es /opinion/<token>', () => {
    expect(urlOpinion('https://anfiora.com', 'AbC123')).toBe('https://anfiora.com/opinion/AbC123')
  })
  it('el mensaje de WhatsApp trae el evento y el link', () => {
    expect(mensajeWhatsApp('Boda Ana & Luis', 'https://anfiora.com/opinion/x'))
      .toBe('¿Nos ayudan a calificar a los proveedores de Boda Ana & Luis? Les toma unos minutos: https://anfiora.com/opinion/x')
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run lib/reviews/link-cliente.test.ts`
Expected: FAIL, módulo no existe.

- [ ] **Step 3: Implementar**

```ts
// lib/reviews/link-cliente.ts
import { fechaCortaISO } from '@/lib/rolodex/fecha-corta'

// El cliente tiene 14 dias despues del evento para contestar. El plazo cuenta
// desde el ULTIMO dia del evento, no desde que se manda el link: mandar tarde
// deja menos dias, y el aviso lo dice antes de enviar.
export const DIAS_PLAZO_CLIENTE = 14

export type EstadoLink = 'antes' | 'sin_pedir' | 'enviada' | 'por_vencer' | 'vencida'

export type InfoLink = {
  estado: EstadoLink
  vence: string | null
  diasRestantes: number | null
}

const DIA_MS = 24 * 60 * 60 * 1000

// Todo en UTC a proposito: la fecha 'YYYY-MM-DD' se trata como un dia sin
// zona, y Date.UTC no le aplica la zona de la maquina.
function aUTC(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

function aISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function sumarDias(iso: string, dias: number): string {
  return aISO(aUTC(iso) + dias * DIA_MS)
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / DIA_MS)
}

export function venceDefault(ultimoDiaEvento: string): string {
  return sumarDias(ultimoDiaEvento, DIAS_PLAZO_CLIENTE)
}

export function estadoDelLink({ hoy, ultimoDiaEvento, token, expiresAt }: {
  hoy: string
  ultimoDiaEvento: string | null
  token: string | null
  expiresAt: string | null
}): InfoLink {
  if (!ultimoDiaEvento || diasEntre(ultimoDiaEvento, hoy) <= 0) {
    return { estado: 'antes', vence: null, diasRestantes: null }
  }
  const vence = expiresAt ?? venceDefault(ultimoDiaEvento)
  const diasRestantes = diasEntre(hoy, vence)
  if (diasRestantes < 0) return { estado: 'vencida', vence, diasRestantes }
  if (!token) return { estado: 'sin_pedir', vence, diasRestantes }
  if (diasRestantes <= 3) return { estado: 'por_vencer', vence, diasRestantes }
  return { estado: 'enviada', vence, diasRestantes }
}

// Suma sobre lo que siga vivo: si el plazo ya paso, desde hoy.
export function extenderVencimiento({ hoy, venceActual, dias }: {
  hoy: string
  venceActual: string | null
  dias: number
}): string {
  const base = venceActual && diasEntre(hoy, venceActual) >= 0 ? venceActual : hoy
  return sumarDias(base, dias)
}

export function textoAviso(info: InfoLink, contestados: number, total: number): string {
  const avance = `${contestados} de ${total}`
  const vence = `vence el ${fechaCortaISO(info.vence)}`
  switch (info.estado) {
    case 'sin_pedir': return `Pide la opinión de tu cliente · ${vence}`
    case 'enviada':   return `Tu cliente lleva ${avance} · ${vence}`
    case 'por_vencer': {
      const cuando =
        info.diasRestantes === 0 ? 'Vence hoy' :
        info.diasRestantes === 1 ? 'Vence mañana' :
        `Vence en ${info.diasRestantes} días`
      return `${cuando} · ${avance}`
    }
    case 'vencida':   return `Venció el ${fechaCortaISO(info.vence)} · ${avance}`
    default:          return ''
  }
}

export function urlOpinion(origin: string, token: string): string {
  return `${origin}/opinion/${token}`
}

export function mensajeWhatsApp(nombreEvento: string, url: string): string {
  return `¿Nos ayudan a calificar a los proveedores de ${nombreEvento}? Les toma unos minutos: ${url}`
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run lib/reviews/link-cliente.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reviews/link-cliente.ts lib/reviews/link-cliente.test.ts
git commit -m "feat(reviews): plazo y estado del link del cliente"
```

---

### Task 4: Lo que manda el cliente (parseo y validación)

**Files:**
- Create: `lib/reviews/opinion-publica.ts`
- Test: `lib/reviews/opinion-publica.test.ts`

**Interfaces:**
- Consumes: `validarReview`, `BorradorReview` de `lib/reviews/validacion.ts`; `EJES_DESEMPENO` de `lib/reviews/ejes.ts`.
- Produces:

```ts
export type RespuestaCliente = {
  event_supplier_id: string
  precio_valor: number | null
  calidad: number | null
  comunicacion: number | null
  servicio_trato: number | null
  manejo_imprevistos: number | null
  recontratacion: number | null
  cobros_extra: boolean | null
  monto_cobros_extra: number | null
  comentarios: string | null
}
export function parseRespuestaCliente(body: unknown): { ok: true; datos: RespuestaCliente } | { ok: false; problemas: string[] }
```

- [ ] **Step 1: Prueba que falla**

```ts
// lib/reviews/opinion-publica.test.ts
import { describe, it, expect } from 'vitest'
import { parseRespuestaCliente } from './opinion-publica'

const completa = {
  event_supplier_id: '11111111-1111-1111-1111-111111111111',
  precio_valor: 4, calidad: 5, comunicacion: 4, servicio_trato: 5, manejo_imprevistos: null,
  recontratacion: 5, cobros_extra: false, monto_cobros_extra: null, comentarios: '  Excelente  ',
}

describe('parseRespuestaCliente', () => {
  it('acepta una respuesta completa y limpia los comentarios', () => {
    const r = parseRespuestaCliente(completa)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.datos.comentarios).toBe('Excelente')
  })
  it('manejo_imprevistos puede venir null (no hubo imprevistos)', () => {
    expect(parseRespuestaCliente({ ...completa, manejo_imprevistos: null }).ok).toBe(true)
  })
  it('rechaza sin event_supplier_id', () => {
    const r = parseRespuestaCliente({ ...completa, event_supplier_id: '' })
    expect(r.ok).toBe(false)
  })
  it('rechaza ejes fuera de 1..5 o no numericos', () => {
    expect(parseRespuestaCliente({ ...completa, calidad: 6 }).ok).toBe(false)
    expect(parseRespuestaCliente({ ...completa, calidad: 'cinco' }).ok).toBe(false)
  })
  it('exige recomendacion y cobros extra', () => {
    const r = parseRespuestaCliente({ ...completa, recontratacion: null, cobros_extra: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problemas.length).toBeGreaterThanOrEqual(2)
  })
  it('el monto solo cuenta si hubo cobros extra', () => {
    const r = parseRespuestaCliente({ ...completa, cobros_extra: false, monto_cobros_extra: 500 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.datos.monto_cobros_extra).toBeNull()
  })
  it('basura no truena', () => {
    expect(parseRespuestaCliente(null).ok).toBe(false)
    expect(parseRespuestaCliente('x').ok).toBe(false)
  })
})
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npx vitest run lib/reviews/opinion-publica.test.ts`
Expected: FAIL, módulo no existe.

- [ ] **Step 3: Implementar**

```ts
// lib/reviews/opinion-publica.ts
import { validarReview } from './validacion'
import type { BorradorReview } from './validacion'
import { EJES_DESEMPENO } from './ejes'
import { MAX_COMENTARIOS } from '@/lib/types'

export type RespuestaCliente = {
  event_supplier_id: string
  precio_valor: number | null
  calidad: number | null
  comunicacion: number | null
  servicio_trato: number | null
  manejo_imprevistos: number | null
  recontratacion: number | null
  cobros_extra: boolean | null
  monto_cobros_extra: number | null
  comentarios: string | null
}

function escala(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return null
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) return undefined
  return v
}

// El cliente no tiene sesion: todo lo que llega es texto de un desconocido.
// Aqui se convierte a un borrador con la forma exacta de una review post
// evento y se valida con las mismas reglas que las del planner.
export function parseRespuestaCliente(body: unknown): { ok: true; datos: RespuestaCliente } | { ok: false; problemas: string[] } {
  if (!body || typeof body !== 'object') return { ok: false, problemas: ['Respuesta vacía.'] }
  const b = body as Record<string, unknown>

  const id = typeof b.event_supplier_id === 'string' ? b.event_supplier_id.trim() : ''
  if (!id) return { ok: false, problemas: ['Falta el proveedor.'] }

  const ejes: Record<string, number | null> = {}
  for (const eje of EJES_DESEMPENO) {
    const v = escala(b[eje])
    if (v === undefined) return { ok: false, problemas: ['Las calificaciones van del 1 al 5.'] }
    ejes[eje] = v
  }
  const recontratacion = escala(b.recontratacion)
  if (recontratacion === undefined) return { ok: false, problemas: ['La recomendación va del 1 al 5.'] }

  const cobros_extra = typeof b.cobros_extra === 'boolean' ? b.cobros_extra : null
  const montoCrudo = typeof b.monto_cobros_extra === 'number' && b.monto_cobros_extra > 0 ? b.monto_cobros_extra : null
  const comentarios = typeof b.comentarios === 'string' ? b.comentarios.trim().slice(0, MAX_COMENTARIOS) || null : null

  const borrador: BorradorReview = {
    review_type: 'post_evento',
    precio_valor: ejes.precio_valor, calidad: ejes.calidad, comunicacion: ejes.comunicacion,
    servicio_trato: ejes.servicio_trato, manejo_imprevistos: ejes.manejo_imprevistos,
    razones_seleccion: null, motivo_descarte: null,
    recontratacion, cobros_extra, comentarios,
  }
  const problemas = validarReview(borrador)
  if (problemas.length > 0) return { ok: false, problemas }

  return {
    ok: true,
    datos: {
      event_supplier_id: id,
      precio_valor: ejes.precio_valor, calidad: ejes.calidad, comunicacion: ejes.comunicacion,
      servicio_trato: ejes.servicio_trato, manejo_imprevistos: ejes.manejo_imprevistos,
      recontratacion, cobros_extra,
      monto_cobros_extra: cobros_extra ? montoCrudo : null,
      comentarios,
    },
  }
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npx vitest run lib/reviews/opinion-publica.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reviews/opinion-publica.ts lib/reviews/opinion-publica.test.ts
git commit -m "feat(reviews): parseo y validacion de la respuesta del cliente"
```

---

### Task 5: Columnas, tipo y SQL

**Files:**
- Modify: `lib/types.ts` (tipo `EventSettings`, líneas 123-143)
- Create: `docs/superpowers/plans/sql/2026-09-09-reviews-link-cliente.sql`

**Interfaces:**
- Produces: `EventSettings.review_token?: string | null`, `review_expires_at?: string | null`, `review_event_supplier_ids?: string[] | null`.

- [ ] **Step 1: Tipo**

En `lib/types.ts`, dentro de `export type EventSettings = {`, después de `max_companions?: number | null`:

```ts
  // Link publico para que el cliente califique a los proveedores contratados.
  // Vencimiento null = 14 dias despues del ultimo dia del evento (ver
  // lib/reviews/link-cliente.ts); solo un admin lo mueve.
  review_token?: string | null
  review_expires_at?: string | null
  review_event_supplier_ids?: string[] | null
```

- [ ] **Step 2: SQL**

```sql
-- docs/superpowers/plans/sql/2026-09-09-reviews-link-cliente.sql
-- El link del cliente. Tres columnas en event_settings, sin tabla nueva.
-- Seguro de correr ANTES o DESPUES del deploy: son columnas nullable que el
-- codigo viejo no lee.
--
-- Quien puede tocarlas:
--   * review_token y review_event_supplier_ids: quien edita Proveedores en
--     ese evento (mandar el link es parte de la herramienta).
--   * review_expires_at: SOLO owner/admin (Dar mas tiempo / Reactivar).
--
-- ANTES DE CORRER, lee la definicion vigente del trigger y conserva TODAS las
-- columnas que ya vigila; aqui se agrega review_expires_at a esa lista:
--   select pg_get_triggerdef(oid) from pg_trigger where tgname = 'guard_event_settings_config';

BEGIN;

ALTER TABLE public.event_settings
  ADD COLUMN IF NOT EXISTS review_token text,
  ADD COLUMN IF NOT EXISTS review_expires_at date,
  ADD COLUMN IF NOT EXISTS review_event_supplier_ids uuid[];

CREATE UNIQUE INDEX IF NOT EXISTS event_settings_review_token_key
  ON public.event_settings (review_token) WHERE review_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_event_config()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  viejo jsonb := to_jsonb(OLD);
  nuevo jsonb := to_jsonb(NEW);
  eid uuid := (nuevo ->> TG_ARGV[0])::uuid;
  col text;
  i int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'events'
     AND (viejo -> 'user_id') IS DISTINCT FROM (nuevo -> 'user_id')
     AND (viejo ->> 'user_id')::uuid IS DISTINCT FROM auth.uid()
  THEN
    RAISE EXCEPTION 'Solo el dueno del evento puede transferirlo'
      USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'event_settings'
     AND (viejo -> 'budget_categories') IS DISTINCT FROM (nuevo -> 'budget_categories')
     AND NOT public.puede_editar(eid, 'presupuesto')
  THEN
    RAISE EXCEPTION 'No tienes acceso para cambiar las secciones del presupuesto'
      USING ERRCODE = '42501';
  END IF;

  -- El link del cliente es parte de Proveedores: mandarlo pide esa herramienta.
  IF TG_TABLE_NAME = 'event_settings'
     AND ((viejo -> 'review_token') IS DISTINCT FROM (nuevo -> 'review_token')
       OR (viejo -> 'review_event_supplier_ids') IS DISTINCT FROM (nuevo -> 'review_event_supplier_ids'))
     AND NOT public.puede_editar(eid, 'proveedores')
  THEN
    RAISE EXCEPTION 'No tienes acceso para mandar el link del cliente'
      USING ERRCODE = '42501';
  END IF;

  IF public.is_event_admin(eid) THEN RETURN NEW; END IF;

  FOR i IN 1 .. TG_NARGS - 1 LOOP
    col := TG_ARGV[i];
    IF (viejo -> col) IS DISTINCT FROM (nuevo -> col) THEN
      RAISE EXCEPTION 'Solo el administrador del evento puede cambiar %', col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

-- Lista de columnas de solo-admin: la vigente (del pg_get_triggerdef de arriba)
-- MAS review_expires_at. La de abajo es la conocida al 9-sep-2026.
DROP TRIGGER IF EXISTS guard_event_settings_config ON public.event_settings;
CREATE TRIGGER guard_event_settings_config
  BEFORE UPDATE ON public.event_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_config(
    'event_id',
    'event_id', 'message_templates', 'template_names', 'enabled_features', 'agent_config',
    'review_expires_at'
  );

COMMIT;

-- Verificacion:
-- select column_name from information_schema.columns
--  where table_name = 'event_settings' and column_name like 'review_%';   -- 3 filas
-- select pg_get_triggerdef(oid) from pg_trigger where tgname = 'guard_event_settings_config';  -- trae review_expires_at
```

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts docs/superpowers/plans/sql/2026-09-09-reviews-link-cliente.sql
git commit -m "feat(reviews): columnas del link del cliente en event_settings y su candado"
```

---

### Task 6: La API pública

**Files:**
- Create: `app/api/opinion/[token]/route.ts`

**Interfaces:**
- Consumes: `estadoDelLink`, `venceDefault` (Task 3); `parseRespuestaCliente` (Task 4).
- Produces:
  - `GET /api/opinion/:token` → `200 { evento: { nombre }, vence: 'YYYY-MM-DD', vencido: boolean, proveedores: [{ id, nombre, categoria }], respuestas: Record<id, RespuestaGuardada> }` · `404 { error: 'not_found' }`.
  - `POST /api/opinion/:token` body `RespuestaCliente` → `200 { ok: true }` · `400 { error: 'bad_request', problemas }` · `403 { error: 'fuera_de_lista' }` · `404` · `410 { error: 'vencido', vence }`.

- [ ] **Step 1: Escribir la ruta**

```ts
// app/api/opinion/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { estadoDelLink } from '@/lib/reviews/link-cliente'
import { parseRespuestaCliente } from '@/lib/reviews/opinion-publica'

// La opinion del cliente final, acotada por token. Va por service role como
// la mesa de regalos y la puerta publica: supplier_reviews no tiene policy
// para anon, y no se abre. Solo expone nombre del evento y nombres/categorias
// de los proveedores que el planner eligio. Nunca reviews del planner.

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

type Ajustes = {
  event_id: string
  review_token: string | null
  review_expires_at: string | null
  review_event_supplier_ids: string[] | null
}

async function resolver(db: ReturnType<typeof admin>, token: string) {
  if (!token) return null
  const { data: ajustes } = await db
    .from('event_settings')
    .select('event_id, review_token, review_expires_at, review_event_supplier_ids')
    .eq('review_token', token)
    .maybeSingle<Ajustes>()
  if (!ajustes) return null

  const { data: evento } = await db
    .from('events')
    .select('id, name, user_id, event_date, event_end_date')
    .eq('id', ajustes.event_id)
    .maybeSingle()
  if (!evento) return null

  const info = estadoDelLink({
    hoy: hoyISO(),
    ultimoDiaEvento: evento.event_end_date || evento.event_date,
    token: ajustes.review_token,
    expiresAt: ajustes.review_expires_at,
  })
  return { ajustes, evento, info, ids: ajustes.review_event_supplier_ids ?? [] }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = admin()
  const r = await resolver(db, token)
  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const [{ data: fichas }, { data: respuestas }] = await Promise.all([
    r.ids.length
      ? db.from('event_suppliers').select('id, supplier:suppliers(name, category_id)').in('id', r.ids)
      : Promise.resolve({ data: [] as { id: string; supplier: { name: string; category_id: string | null } | null }[] }),
    r.ids.length
      ? db.from('supplier_reviews')
          .select('event_supplier_id, precio_valor, calidad, comunicacion, servicio_trato, manejo_imprevistos, recontratacion, cobros_extra, monto_cobros_extra, comentarios')
          .eq('autor', 'cliente').eq('review_type', 'post_evento').in('event_supplier_id', r.ids)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  const categoriaIds = [...new Set((fichas ?? []).map(f => f.supplier?.category_id).filter((x): x is string => !!x))]
  const { data: categorias } = categoriaIds.length
    ? await db.from('categories').select('id, name').in('id', categoriaIds)
    : { data: [] as { id: string; name: string }[] }
  const nombreCategoria = new Map((categorias ?? []).map(c => [c.id, c.name]))

  // En el orden en que el planner los eligio.
  const porId = new Map((fichas ?? []).map(f => [f.id, f]))
  const proveedores = r.ids
    .map(id => porId.get(id))
    .filter((f): f is NonNullable<typeof f> => !!f)
    .map(f => ({
      id: f.id,
      nombre: f.supplier?.name ?? 'Proveedor',
      categoria: f.supplier?.category_id ? (nombreCategoria.get(f.supplier.category_id) ?? '') : '',
    }))

  const guardadas: Record<string, unknown> = {}
  for (const row of (respuestas ?? []) as { event_supplier_id: string }[]) guardadas[row.event_supplier_id] = row

  return NextResponse.json({
    evento: { nombre: r.evento.name },
    vence: r.info.vence,
    vencido: r.info.estado === 'vencida',
    proveedores,
    respuestas: guardadas,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = admin()
  const r = await resolver(db, token)
  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (r.info.estado === 'vencida') return NextResponse.json({ error: 'vencido', vence: r.info.vence }, { status: 410 })

  const body = await req.json().catch(() => null)
  const parsed = parseRespuestaCliente(body)
  if (!parsed.ok) return NextResponse.json({ error: 'bad_request', problemas: parsed.problemas }, { status: 400 })
  const datos = parsed.datos

  // Solo los proveedores que el planner eligio: el token no abre el evento entero.
  if (!r.ids.includes(datos.event_supplier_id)) {
    return NextResponse.json({ error: 'fuera_de_lista' }, { status: 403 })
  }

  const { data: ficha } = await db
    .from('event_suppliers').select('id, supplier_id, event_id')
    .eq('id', datos.event_supplier_id).eq('event_id', r.evento.id).maybeSingle()
  if (!ficha) return NextResponse.json({ error: 'fuera_de_lista' }, { status: 403 })

  const { error } = await db.from('supplier_reviews').upsert({
    user_id: r.evento.user_id,
    supplier_id: ficha.supplier_id,
    event_id: r.evento.id,
    event_supplier_id: ficha.id,
    review_type: 'post_evento',
    autor: 'cliente',
    precio_valor: datos.precio_valor,
    calidad: datos.calidad,
    comunicacion: datos.comunicacion,
    servicio_trato: datos.servicio_trato,
    manejo_imprevistos: datos.manejo_imprevistos,
    razones_seleccion: null,
    motivo_descarte: null,
    recontratacion: datos.recontratacion,
    cobros_extra: datos.cobros_extra,
    monto_cobros_extra: datos.monto_cobros_extra,
    comentarios: datos.comentarios,
    created_by: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_supplier_id,review_type,autor' })

  if (error) {
    console.error('Error guardando la opinion del cliente:', error.message ?? error, error)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Probar a mano contra local** (después de correr el SQL en Supabase y de tener un token en `event_settings`):

```bash
curl -s http://localhost:3003/api/opinion/NOEXISTE   # -> 404
curl -s http://localhost:3003/api/opinion/<token>    # -> 200 con proveedores
```

- [ ] **Step 4: Commit**

```bash
git add "app/api/opinion/[token]/route.ts"
git commit -m "feat(reviews): API publica de la opinion del cliente por token"
```

---

### Task 7: La página pública, un proveedor por pantalla

**Files:**
- Create: `app/opinion/[token]/page.tsx`

**Interfaces:**
- Consumes: la API de Task 6; `EscalaCinco` (`app/components/ui/EscalaCinco.tsx`); `anclasDe('desempeno_cliente', eje)`, `EJES_DESEMPENO`, `NOMBRE_EJE`, `ANCLAS_RECOMENDACION_CLIENTE`, `ETIQUETA_NO_APLICO_CLIENTE` (Task 1); `fechaCortaISO` (Task 2); `MAX_COMENTARIOS` de `lib/types`.

Diseño (mockup aprobado): teléfono primero. Cabecera con "ANFIORA" en Josefin Sans y el nombre del evento. Barra de avance "Proveedor 2 de 4". Nombre y categoría del proveedor. Cinco `EscalaCinco` con anclas del cliente, `manejo_imprevistos` con botón "No hubo imprevistos". Bloque ámbar "¿Les cobró algo extra que no estaba acordado?" Sí/No + monto. "¿Lo recomendarían?" con `ANCLAS_RECOMENDACION_CLIENTE`. Textarea "Opcional". Atrás / Siguiente (el último dice Terminar). **Se guarda al pasar al siguiente**; si el POST falla, se muestran los problemas y no avanza. Pantalla final "Listo, gracias". Link vencido: "Este link venció el 26 jul." Link inexistente: "Este link no existe."

- [ ] **Step 1: Escribir la página**

```tsx
// app/opinion/[token]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import EscalaCinco from '@/app/components/ui/EscalaCinco'
import { anclasDe, EJES_DESEMPENO, NOMBRE_EJE, ANCLAS_RECOMENDACION_CLIENTE, ETIQUETA_NO_APLICO_CLIENTE } from '@/lib/reviews/ejes'
import type { Eje } from '@/lib/reviews/ejes'
import { fechaCortaISO } from '@/lib/rolodex/fecha-corta'
import { MAX_COMENTARIOS } from '@/lib/types'

type Proveedor = { id: string; nombre: string; categoria: string }
type Guardada = Partial<Record<Eje, number | null>> & {
  recontratacion?: number | null
  cobros_extra?: boolean | null
  monto_cobros_extra?: number | null
  comentarios?: string | null
}
type Datos = {
  evento: { nombre: string }
  vence: string | null
  vencido: boolean
  proveedores: Proveedor[]
  respuestas: Record<string, Guardada>
}

type Formulario = {
  valores: Record<Eje, number | 'na' | null>
  recontratacion: number | null
  cobrosExtra: boolean | null
  montoExtra: string
  comentarios: string
}

const josefin = { fontFamily: "'Josefin Sans', sans-serif" }

function vacio(): Formulario {
  return {
    valores: { precio_valor: null, calidad: null, comunicacion: null, servicio_trato: null, manejo_imprevistos: null },
    recontratacion: null, cobrosExtra: null, montoExtra: '', comentarios: '',
  }
}

// Una respuesta ya guardada se precarga para poder corregirla mientras el
// link siga vivo. manejo_imprevistos null en una guardada es "no hubo".
function desdeGuardada(g: Guardada | undefined): Formulario {
  if (!g) return vacio()
  const f = vacio()
  for (const eje of EJES_DESEMPENO) {
    const v = g[eje]
    f.valores[eje] = v != null ? v : (eje === 'manejo_imprevistos' ? 'na' : null)
  }
  f.recontratacion = g.recontratacion ?? null
  f.cobrosExtra = g.cobros_extra ?? null
  f.montoExtra = g.monto_cobros_extra != null ? String(g.monto_cobros_extra) : ''
  f.comentarios = g.comentarios ?? ''
  return f
}

export default function OpinionPublicaPage() {
  const { token } = useParams<{ token: string }>()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [noExiste, setNoExiste] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [indice, setIndice] = useState(0)
  const [formularios, setFormularios] = useState<Record<string, Formulario>>({})
  const [problemas, setProblemas] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [terminado, setTerminado] = useState(false)

  useEffect(() => {
    let vigente = true
    fetch(`/api/opinion/${token}`)
      .then(async res => {
        if (!vigente) return
        if (!res.ok) { setNoExiste(true); return }
        const d = (await res.json()) as Datos
        setDatos(d)
        const iniciales: Record<string, Formulario> = {}
        for (const p of d.proveedores) iniciales[p.id] = desdeGuardada(d.respuestas[p.id])
        setFormularios(iniciales)
      })
      .catch(() => { if (vigente) setNoExiste(true) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [token])

  const actual = datos?.proveedores[indice] ?? null
  const form = actual ? (formularios[actual.id] ?? vacio()) : vacio()
  const setForm = (cambio: Partial<Formulario>) => {
    if (!actual) return
    setFormularios(prev => ({ ...prev, [actual.id]: { ...(prev[actual.id] ?? vacio()), ...cambio } }))
  }

  const guardarYSeguir = async () => {
    if (!actual || !datos) return
    setProblemas([])
    setGuardando(true)
    const aNumero = (v: number | 'na' | null) => (v === 'na' ? null : v)
    const res = await fetch(`/api/opinion/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_supplier_id: actual.id,
        precio_valor: aNumero(form.valores.precio_valor),
        calidad: aNumero(form.valores.calidad),
        comunicacion: aNumero(form.valores.comunicacion),
        servicio_trato: aNumero(form.valores.servicio_trato),
        manejo_imprevistos: aNumero(form.valores.manejo_imprevistos),
        recontratacion: form.recontratacion,
        cobros_extra: form.cobrosExtra,
        monto_cobros_extra: form.cobrosExtra ? Number(form.montoExtra) || null : null,
        comentarios: form.comentarios,
      }),
    }).catch(() => null)
    setGuardando(false)

    if (!res) { setProblemas(['No se pudo guardar. Revisa tu conexión e intenta de nuevo.']); return }
    if (res.status === 410) { setDatos({ ...datos, vencido: true }); return }
    if (!res.ok) {
      const cuerpo = await res.json().catch(() => null)
      setProblemas(cuerpo?.problemas ?? ['No se pudo guardar. Intenta de nuevo.'])
      return
    }
    if (indice + 1 >= datos.proveedores.length) setTerminado(true)
    else { setIndice(indice + 1); window.scrollTo({ top: 0 }) }
  }

  const Cascara = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-dvh bg-white text-[#1D1E20]">
      <div className="mx-auto w-full max-w-md px-5 pb-16 pt-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#aaa]" style={josefin}>Anfiora</p>
        {children}
      </div>
    </div>
  )

  if (cargando) return <Cascara><div className="mt-10 h-40 animate-pulse rounded-xl bg-[#f5f5f5]" /></Cascara>
  if (noExiste || !datos) return <Cascara><h1 className="mt-10 text-xl font-bold">Este link no existe.</h1></Cascara>
  if (datos.vencido) {
    return (
      <Cascara>
        <h1 className="mt-10 text-xl font-bold">Este link venció{datos.vence ? ` el ${fechaCortaISO(datos.vence)}` : ''}.</h1>
        <p className="mt-2 text-sm text-[#666]">Pídele a tu planner que lo reactive.</p>
      </Cascara>
    )
  }
  if (datos.proveedores.length === 0) {
    return <Cascara><h1 className="mt-10 text-xl font-bold">No hay proveedores por calificar.</h1></Cascara>
  }
  if (terminado) {
    return (
      <Cascara>
        <h1 className="mt-10 text-xl font-bold">Listo, gracias</h1>
        <p className="mt-2 text-sm text-[#666]">Calificaron a los {datos.proveedores.length} proveedores de {datos.evento.nombre}.</p>
        <button type="button" onClick={() => { setIndice(0); setTerminado(false) }} className="mt-6 text-sm font-semibold text-[#48C9B0]">
          Corregir alguna
        </button>
      </Cascara>
    )
  }

  const total = datos.proveedores.length
  const avance = Math.round((indice / total) * 100)

  return (
    <Cascara>
      <h1 className="mt-2 text-lg font-semibold">{datos.evento.nombre}</h1>

      <div className="mt-6 flex items-center justify-between text-[11.5px] tabular-nums text-[#999]">
        <span>Proveedor {indice + 1} de {total}</span>
        <span>{avance}%</span>
      </div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[#f2f2f2]">
        <div className="h-full rounded-full bg-[#48C9B0] transition-all" style={{ width: `${avance}%` }} />
      </div>

      <h2 className="mt-5 text-[18px] font-semibold tracking-tight">{actual?.nombre}</h2>
      {actual?.categoria && <p className="mt-0.5 text-xs text-[#999]">{actual.categoria}</p>}

      <div className="mt-5 space-y-5">
        {EJES_DESEMPENO.map(eje => (
          <EscalaCinco
            key={eje}
            nombre={NOMBRE_EJE[eje]}
            anclas={anclasDe('desempeno_cliente', eje)}
            valor={form.valores[eje]}
            onChange={v => setForm({ valores: { ...form.valores, [eje]: v } })}
            noAplico={eje === 'manejo_imprevistos'}
            etiquetaNoAplico={ETIQUETA_NO_APLICO_CLIENTE}
          />
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-[#e8d4a6] bg-[var(--accent-bg)] p-3">
        <p className="text-sm font-medium">¿Les cobró algo extra que no estaba acordado?</p>
        <div className="mt-2 flex gap-2">
          {[true, false].map(v => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={form.cobrosExtra === v}
              onClick={() => setForm({ cobrosExtra: v })}
              className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                form.cobrosExtra === v ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] bg-white text-[#666]'
              }`}
            >
              {v ? 'Sí' : 'No'}
            </button>
          ))}
        </div>
        {form.cobrosExtra === true && (
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="monto-extra" className="text-xs text-[#666]">Monto</label>
            <input
              id="monto-extra"
              type="text"
              inputMode="decimal"
              value={form.montoExtra}
              onChange={e => setForm({ montoExtra: e.target.value })}
              placeholder="0.00"
              className="w-32 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-sm tabular-nums outline-none focus:border-[#48C9B0]"
            />
          </div>
        )}
      </div>

      <div className="mt-5">
        <EscalaCinco
          nombre="¿Lo recomendarían?"
          anclas={ANCLAS_RECOMENDACION_CLIENTE}
          valor={form.recontratacion}
          onChange={v => setForm({ recontratacion: typeof v === 'number' ? v : null })}
        />
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium">Algo que quieran agregar</p>
        <textarea
          value={form.comentarios}
          onChange={e => setForm({ comentarios: e.target.value })}
          maxLength={MAX_COMENTARIOS}
          rows={3}
          placeholder="Opcional"
          className="mt-2 w-full resize-none rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#48C9B0]"
        />
      </div>

      {problemas.length > 0 && (
        <div className="mt-4 space-y-1 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2">
          {problemas.map(p => <p key={p} className="text-xs text-[var(--error-text)]">{p}</p>)}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={indice === 0 || guardando}
          onClick={() => { setProblemas([]); setIndice(indice - 1) }}
          className="px-2 py-2 text-sm text-[#666] disabled:opacity-30"
        >
          Atrás
        </button>
        <button
          type="button"
          disabled={guardando}
          onClick={guardarYSeguir}
          className="ml-auto rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : indice + 1 >= total ? 'Terminar' : 'Siguiente'}
        </button>
      </div>
    </Cascara>
  )
}
```

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Probar en el navegador** (con el SQL corrido y un token puesto a mano o desde Task 8): `http://localhost:3003/opinion/<token>` en vista móvil. Calificar uno, avanzar, regresar y ver la precarga; abrir un token inventado y ver "Este link no existe."

- [ ] **Step 4: Commit**

```bash
git add "app/opinion/[token]/page.tsx"
git commit -m "feat(reviews): pagina publica para que el cliente califique, un proveedor por pantalla"
```

---

### Task 8: Pedir la opinión (modal) y el aviso con Dar más tiempo

**Files:**
- Create: `app/events/[id]/proveedores/PedirOpinionModal.tsx`
- Create: `app/events/[id]/proveedores/AvisoOpinionCliente.tsx`
- Modify: `app/events/[id]/proveedores/page.tsx`

**Interfaces:**
- Consumes: `estadoDelLink`, `textoAviso`, `urlOpinion`, `mensajeWhatsApp`, `extenderVencimiento`, `InfoLink` (Task 3); `randomToken` de `lib/invite`; `interpretarEscritura` de `lib/invite/persistencia`; `useEventAccess().canAdmin`; `usePermiso('proveedores')`; `Modal`; `DatePicker` (`mode='single'`, `value`, `onChange`, `minDate`); `useConfirm`.
- Produces:

```ts
// PedirOpinionModal
type Props = {
  abierto: boolean
  onClose: () => void
  eventoId: string
  eventoNombre: string
  contratados: { id: string; nombre: string; categoria: string }[]
  seleccionActual: string[] | null
  token: string | null
  onEnviado: (token: string, ids: string[]) => void
}
// AvisoOpinionCliente
type Props = {
  info: InfoLink
  contestados: number
  total: number
  puedeEditar: boolean
  canAdmin: boolean
  onPedir: () => void
  onReenviar: () => void
  onDarMasTiempo: (nuevoVence: string) => Promise<string | null>  // devuelve el problema o null
}
```

- [ ] **Step 1: El modal**

```tsx
// app/events/[id]/proveedores/PedirOpinionModal.tsx
'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { FaWhatsapp } from 'react-icons/fa'
import { Modal } from '@/app/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { randomToken } from '@/lib/invite'
import { interpretarEscritura } from '@/lib/invite/persistencia'
import { urlOpinion, mensajeWhatsApp } from '@/lib/reviews/link-cliente'

type Contratado = { id: string; nombre: string; categoria: string }

type Props = {
  abierto: boolean
  onClose: () => void
  eventoId: string
  eventoNombre: string
  contratados: Contratado[]
  seleccionActual: string[] | null
  token: string | null
  onEnviado: (token: string, ids: string[]) => void
}

// El planner elige a quienes califica el cliente: es el unico que sabe con
// quien tuvieron cara. Vienen todos palomeados; desmarca al generador de luz.
export default function PedirOpinionModal({
  abierto, onClose, eventoId, eventoNombre, contratados, seleccionActual, token, onEnviado,
}: Props) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!abierto) return
    const base = seleccionActual && seleccionActual.length > 0
      ? seleccionActual.filter(id => contratados.some(c => c.id === id))
      : contratados.map(c => c.id)
    setMarcados(new Set(base))
    setError('')
    setCopiado(false)
  }, [abierto, seleccionActual, contratados])

  const alternar = (id: string) => {
    setMarcados(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  // Un solo link por evento: se crea la primera vez y se reutiliza siempre.
  const asegurarLink = async (): Promise<string | null> => {
    const ids = contratados.filter(c => marcados.has(c.id)).map(c => c.id)
    if (ids.length === 0) { setError('Elige al menos un proveedor.'); return null }
    const tokenFinal = token ?? randomToken(12)
    setGuardando(true)
    const res = await supabase
      .from('event_settings')
      .update({ review_token: tokenFinal, review_event_supplier_ids: ids })
      .eq('event_id', eventoId)
      .select('event_id')
    setGuardando(false)
    const r = interpretarEscritura(res)
    if (!r.ok) { setError(r.motivo); return null }
    onEnviado(tokenFinal, ids)
    return tokenFinal
  }

  const enviarWhatsApp = async () => {
    const t = await asegurarLink()
    if (!t) return
    const url = urlOpinion(window.location.origin, t)
    window.open(`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp(eventoNombre, url))}`, '_blank', 'noopener,noreferrer')
    onClose()
  }

  const copiarLink = async () => {
    const t = await asegurarLink()
    if (!t) return
    try {
      await navigator.clipboard.writeText(urlOpinion(window.location.origin, t))
      setCopiado(true)
    } catch {
      setError('No se pudo copiar. Mándalo por WhatsApp.')
    }
  }

  if (!abierto) return null
  const n = marcados.size

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header title="Pedir la opinión de tu cliente" subtitle={`${contratados.length} proveedores contratados`} />
      <Modal.Body>
        <ul className="divide-y divide-[#f2f2f2] rounded-xl border border-[#eee]">
          {contratados.map(c => {
            const on = marcados.has(c.id)
            return (
              <li key={c.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => alternar(c.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#fafafa]"
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-[#1D1E20] bg-[#1D1E20] text-white' : 'border-[#e0e0e0] bg-white'}`}>
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${on ? 'text-[#1D1E20]' : 'text-[#999]'}`}>{c.nombre}</span>
                    {c.categoria && <span className="block text-xs text-[#999]">{c.categoria}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {error && <p className="mt-3 text-xs text-[var(--error-text)]">{error}</p>}
        {copiado && <p className="mt-3 text-xs text-[#2a7a50]">Link copiado.</p>}
      </Modal.Body>
      <Modal.Footer>
        <span className="text-xs tabular-nums text-[#666]"><b className="text-[#1D1E20]">{n}</b> de {contratados.length} · les toma {Math.max(1, n)} min</span>
        <button
          type="button"
          onClick={copiarLink}
          disabled={guardando}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-2 text-xs font-semibold text-[#1D1E20] hover:bg-[#f5f5f5] disabled:opacity-50"
        >
          <Copy size={13} /> Copiar link
        </button>
        <button
          type="button"
          onClick={enviarWhatsApp}
          disabled={guardando}
          className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50"
        >
          <FaWhatsapp size={14} /> Enviar por WhatsApp
        </button>
      </Modal.Footer>
    </Modal>
  )
}
```

- [ ] **Step 2: El aviso**

```tsx
// app/events/[id]/proveedores/AvisoOpinionCliente.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import DatePicker from '@/app/components/ui/DatePicker'
import { extenderVencimiento, textoAviso } from '@/lib/reviews/link-cliente'
import type { InfoLink } from '@/lib/reviews/link-cliente'

type Props = {
  info: InfoLink
  contestados: number
  total: number
  puedeEditar: boolean
  canAdmin: boolean
  onPedir: () => void
  onReenviar: () => void
  onDarMasTiempo: (nuevoVence: string) => Promise<string | null>
}

const hoyISO = () => new Date().toISOString().slice(0, 10)

// Una linea. Solo existe despues del evento, y se va cuando todos contestaron.
// Vencido no desaparece: es donde vive Reactivar.
export default function AvisoOpinionCliente({
  info, contestados, total, puedeEditar, canAdmin, onPedir, onReenviar, onDarMasTiempo,
}: Props) {
  const [menu, setMenu] = useState(false)
  const [eligiendoFecha, setEligiendoFecha] = useState(false)
  const [fecha, setFecha] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const fuera = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [menu])

  if (info.estado === 'antes' || total === 0) return null
  if (info.estado !== 'vencida' && contestados >= total) return null

  const vencida = info.estado === 'vencida'
  const tono =
    info.estado === 'sin_pedir' ? 'border-[#efd9a6] bg-[#fdf8ee]' :
    info.estado === 'por_vencer' ? 'border-[#f0c9c5] bg-[#fdf3f2]' :
    vencida ? 'border-[#e8e8e8] bg-[#f5f5f3]' :
    'border-[#bdebdf] bg-[#f0faf7]'

  const aplicar = async (nuevoVence: string) => {
    setError('')
    setOcupado(true)
    const problema = await onDarMasTiempo(nuevoVence)
    setOcupado(false)
    if (problema) { setError(problema); return }
    setMenu(false)
    setEligiendoFecha(false)
  }

  const masDias = (dias: number) =>
    aplicar(extenderVencimiento({ hoy: hoyISO(), venceActual: info.vence, dias }))

  return (
    <div className={`mb-3 rounded-xl border px-4 py-2.5 ${tono}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-semibold text-[#1D1E20]">{textoAviso(info, contestados, total)}</p>

        <div className="ml-auto flex items-center gap-2">
          {info.estado === 'sin_pedir' && puedeEditar && (
            <button type="button" onClick={onPedir} className="rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3aa896]">
              Pedir opinión
            </button>
          )}
          {(info.estado === 'enviada' || info.estado === 'por_vencer') && puedeEditar && (
            <button type="button" onClick={onReenviar} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${info.estado === 'por_vencer' ? 'bg-[#48C9B0] text-white hover:bg-[#3aa896]' : 'border border-[#e0e0e0] bg-white text-[#1D1E20] hover:bg-[#f5f5f5]'}`}>
              Reenviar
            </button>
          )}
          {canAdmin && info.estado !== 'sin_pedir' && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenu(v => !v)}
                disabled={ocupado}
                className="flex items-center gap-1 rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1E20] hover:bg-[#f5f5f5] disabled:opacity-50"
              >
                {vencida ? 'Reactivar' : 'Dar más tiempo'} <ChevronDown size={12} />
              </button>
              {menu && (
                <div className="absolute right-0 z-20 mt-1.5 w-56 rounded-xl border border-[#e0e0e0] bg-white p-1.5 shadow-lg">
                  {!eligiendoFecha ? (
                    <>
                      <button type="button" onClick={() => masDias(7)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f5f5f5]">7 días más</button>
                      <button type="button" onClick={() => masDias(14)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f5f5f5]">14 días más</button>
                      <button type="button" onClick={() => setEligiendoFecha(true)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f5f5f5]">Elegir fecha</button>
                    </>
                  ) : (
                    <div className="p-1">
                      <DatePicker mode="single" value={fecha} onChange={setFecha} minDate={hoyISO()} placeholder="Nueva fecha" />
                      <button
                        type="button"
                        disabled={!fecha || ocupado}
                        onClick={() => aplicar(fecha)}
                        className="mt-2 w-full rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-[var(--error-text)]">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Cablear la página**

En `app/events/[id]/proveedores/page.tsx`:

1. Imports (junto a los existentes):

```ts
import { useEventAccess } from '@/lib/event-access-context'
import { estadoDelLink } from '@/lib/reviews/link-cliente'
import { interpretarEscritura } from '@/lib/invite/persistencia'
import { calcularScores } from '@/lib/reviews/scores'   // ya esta importado: no duplicar
import PedirOpinionModal from './PedirOpinionModal'
import AvisoOpinionCliente from './AvisoOpinionCliente'
```

2. Estado (junto a `conteoPagosPorItem`):

```ts
  const { canAdmin } = useEventAccess()
  const [ajustesLink, setAjustesLink] = useState<{ token: string | null; expiresAt: string | null; ids: string[] | null }>({ token: null, expiresAt: null, ids: null })
  const [scoreClientePorItem, setScoreClientePorItem] = useState<Record<string, number | null>>({})
  const [pedirOpinionAbierto, setPedirOpinionAbierto] = useState(false)
```

3. En `loadAll`, agregar a la carga paralela una cuarta consulta y guardarla:

```ts
      const [eventRes, suppliersRes, budgetsRes, ajustesRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        supabase.from('event_suppliers').select('*, supplier:suppliers(*)').eq('event_id', eventId).order('created_at', { ascending: false }),
        supabase.from('event_budgets').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
        supabase.from('event_settings').select('review_token, review_expires_at, review_event_supplier_ids').eq('event_id', eventId).maybeSingle(),
      ])
      ...
      if (ajustesRes.data) {
        setAjustesLink({
          token: ajustesRes.data.review_token ?? null,
          expiresAt: ajustesRes.data.review_expires_at ?? null,
          ids: ajustesRes.data.review_event_supplier_ids ?? null,
        })
      }
```

4. En `cargarDineroYReviews`, agregar una tercera consulta al `Promise.all` y su reducción:

```ts
      supabase.from('supplier_reviews')
        .select('event_supplier_id, review_type, autor, precio_valor, calidad, comunicacion, servicio_trato, manejo_imprevistos')
        .eq('review_type', 'post_evento').eq('autor', 'cliente').in('event_supplier_id', ids),
```

```ts
    const clientes: Record<string, number | null> = {}
    for (const r of (opinionesCliente ?? []) as (ReviewParaScore & { event_supplier_id: string })[]) {
      clientes[r.event_supplier_id] = calcularScores([r]).clientes
    }
    setScoreClientePorItem(clientes)
```

(`opinionesCliente` es el tercer resultado destructurado del `Promise.all`; registrar su error con `console.error` como los otros dos.)

5. Derivados, después de `filtered`:

```ts
  const ultimoDia = event ? (event.event_end_date || event.event_date) : null
  const infoLink = estadoDelLink({
    hoy: new Date().toISOString().slice(0, 10),
    ultimoDiaEvento: ultimoDia,
    token: ajustesLink.token,
    expiresAt: ajustesLink.expiresAt,
  })
  const contratados = items
    .filter(i => i.status === 'contratado')
    .map(i => ({ id: i.id, nombre: i.supplier.name, categoria: nombrePorId(categorias, i.supplier.category_id) }))
  const idsEnLink = ajustesLink.ids && ajustesLink.ids.length > 0 ? ajustesLink.ids : contratados.map(c => c.id)
  const totalEnLink = idsEnLink.length
  const contestados = idsEnLink.filter(id => scoreClientePorItem[id] != null).length

  const darMasTiempo = async (nuevoVence: string): Promise<string | null> => {
    const res = await supabase.from('event_settings').update({ review_expires_at: nuevoVence }).eq('event_id', eventId).select('event_id')
    const r = interpretarEscritura(res)
    if (!r.ok) return r.motivo
    setAjustesLink(prev => ({ ...prev, expiresAt: nuevoVence }))
    return null
  }
```

6. Montar el aviso justo antes del bloque que pinta las vistas (arriba de `{viewMode === 'lista' && ...}`):

```tsx
            <AvisoOpinionCliente
              info={infoLink}
              contestados={contestados}
              total={totalEnLink}
              puedeEditar={permiso.editar}
              canAdmin={canAdmin}
              onPedir={() => setPedirOpinionAbierto(true)}
              onReenviar={() => setPedirOpinionAbierto(true)}
              onDarMasTiempo={darMasTiempo}
            />
```

7. Montar el modal junto a los otros modales:

```tsx
      <PedirOpinionModal
        abierto={pedirOpinionAbierto && permiso.editar}
        onClose={() => setPedirOpinionAbierto(false)}
        eventoId={eventId}
        eventoNombre={event.name}
        contratados={contratados}
        seleccionActual={ajustesLink.ids}
        token={ajustesLink.token}
        onEnviado={(token, ids) => setAjustesLink(prev => ({ ...prev, token, ids }))}
      />
```

- [ ] **Step 4: tsc y prueba manual**

Run: `npx tsc --noEmit -p .`
Probar en `localhost:3003`: con la boda demo (fecha pasada) debe salir el aviso ámbar "Pide la opinión de tu cliente · vence el …". Pedir opinión, desmarcar uno, Copiar link, abrir el link en otra pestaña. Como admin: Dar más tiempo 7 días y ver la fecha cambiar. Con un evento futuro: no hay aviso.

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/proveedores/PedirOpinionModal.tsx" "app/events/[id]/proveedores/AvisoOpinionCliente.tsx" "app/events/[id]/proveedores/page.tsx"
git commit -m "feat(reviews): pedir la opinion del cliente, aviso con plazo y dar mas tiempo"
```

---

### Task 9: El renglón "Según el cliente" en la ficha

**Files:**
- Modify: `app/events/[id]/proveedores/FichaDelEvento.tsx` (props, `ListaQueFalta`)
- Modify: `app/events/[id]/proveedores/FichaModal.tsx`, `app/events/[id]/proveedores/SupplierFicheroView.tsx`
- Modify: `app/events/[id]/proveedores/page.tsx` (pasar la prop)

**Interfaces:**
- Produces en `FichaDelEvento`: prop opcional `opinionCliente?: { info: InfoLink; onPedir?: () => void }`. Si no viene (Presupuesto), el renglón solo aparece cuando ya existe la review del cliente.

- [ ] **Step 1: FichaDelEvento**

Imports: `import type { InfoLink } from '@/lib/reviews/link-cliente'` y `import { fechaCortaISO } from '@/lib/rolodex/fecha-corta'`.

Props: agregar `opinionCliente?: { info: InfoLink; onPedir?: () => void }` y destructurarla.

Derivado, junto a `reviewPostEvento`:

```ts
  const reviewCliente = useMemo(
    () => reviews.find(r => r.event_supplier_id === item.id && r.review_type === 'post_evento' && r.autor === 'cliente') ?? null,
    [reviews, item.id],
  )
```

Pasar a `ListaQueFalta`: `reviewCliente={reviewCliente}` y `opinionCliente={item.status === 'contratado' ? opinionCliente : undefined}`.

En `ListaQueFalta`, nuevas props `reviewCliente: SupplierReview | null` y `opinionCliente?: { info: InfoLink; onPedir?: () => void }`. Después del `filas.map(...)`, dentro del mismo `<ul>`, agregar el renglón:

```tsx
          {(reviewCliente || opinionCliente) && (() => {
            const score = reviewCliente ? calcularScores([reviewCliente]).clientes : null
            const info = opinionCliente?.info
            const hecha = !!reviewCliente
            const clase = hecha ? 'ok' : info && (info.estado === 'sin_pedir' || info.estado === 'enviada' || info.estado === 'por_vencer') ? 'pend' : 'off'
            const subtitulo =
              hecha ? 'Calificó a este proveedor' :
              !info || info.estado === 'antes' ? 'Después del evento' :
              info.estado === 'vencida' ? 'No calificó a este proveedor' :
              `Vence el ${fechaCortaISO(info.vence)}`
            return (
              <li className="flex items-center gap-3 border-t border-[#f2f2f2] px-4 py-2.5">
                <span
                  aria-hidden
                  className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] ' + (
                    clase === 'ok' ? 'border-[#48C9B0] bg-[#48C9B0] text-white' :
                    clase === 'pend' ? 'border-dashed border-[#d4a853]' : 'border-[#ccc]'
                  )}
                >
                  {hecha && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={'block text-[13px] font-semibold ' + (clase === 'off' ? 'text-[#999]' : 'text-[#1D1E20]')}>Según el cliente</span>
                  <span className="block text-[11px] text-[#999]">{subtitulo}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  {hecha ? (
                    <Estrellas score={score} tamano={12} />
                  ) : info?.estado === 'sin_pedir' && opinionCliente?.onPedir && puedeEditar ? (
                    <button type="button" onClick={opinionCliente.onPedir} className="rounded-lg border border-[#e0e0e0] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#1D1E20] hover:bg-[#f5f5f5]">
                      Pedir opinión
                    </button>
                  ) : info?.estado === 'vencida' ? (
                    <span className="rounded-full border border-[#e0e0e0] bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#999]">Venció</span>
                  ) : info && info.estado !== 'antes' ? (
                    <span className="rounded-full border border-[#bdebdf] bg-[#f0faf7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2e9e88]">Enviada</span>
                  ) : (
                    <span className="rounded-full border border-[#e0e0e0] bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#999]">Después del evento</span>
                  )}
                </span>
              </li>
            )
          })()}
```

Nota: el renglón del cliente **no cuenta** en `resumenPendientes` (esa cuenta es de lo que el planner llena).

- [ ] **Step 2: FichaModal y Fichero**

En `FichaModal.tsx` Props: `opinionCliente?: { info: InfoLink; onPedir?: () => void }` (se pasa por el spread que ya existe; solo agregar al tipo y el import del tipo).

En `SupplierFicheroView.tsx` Props: la misma prop opcional, y pasarla a `<FichaDelEvento opinionCliente={opinionCliente} ... />`.

- [ ] **Step 3: page.tsx**

Pasar `opinionCliente={{ info: infoLink, onPedir: () => setPedirOpinionAbierto(true) }}` a `SupplierFicheroView` y a `FichaModal`.

- [ ] **Step 4: tsc, pruebas y build**

Run: `npx tsc --noEmit -p . && npx vitest run && npm run build`
Expected: todo verde.

- [ ] **Step 5: Commit**

```bash
git add "app/events/[id]/proveedores/FichaDelEvento.tsx" "app/events/[id]/proveedores/FichaModal.tsx" "app/events/[id]/proveedores/SupplierFicheroView.tsx" "app/events/[id]/proveedores/page.tsx"
git commit -m "feat(reviews): el renglon Segun el cliente en la lista Que falta"
```

---

### Task 10: Cierre

- [ ] Actualizar `CLAUDE.md`: en el esquema de `event_settings` agregar `review_token TEXT, review_expires_at DATE, review_event_supplier_ids UUID[]` y una línea en "Contexto técnico": *"Opinión del cliente: link público `/opinion/[token]`, API con service role, 14 días desde el último día del evento, solo admin mueve `review_expires_at`."*
- [ ] `git push origin feat/reviews-cliente` y abrir el PR con la descripción: qué es, el SQL que hay que correr (antes o después del deploy, es seguro), y cómo probar.
- [ ] Correr el SQL en Supabase (Diego). Probar en preview: mandar link, calificar desde el teléfono, ver estrellas en la ficha, Dar más tiempo.

---

## Fuera de alcance (a propósito)

- Disparo automático a los 4 días por cron: Diego decidió que es manual.
- Correo como canal: solo WhatsApp y copiar link.
- Tope al "Dar más tiempo": sin tope.
- Mostrar el score del cliente en la cabecera de la ficha: Diego rechazó dos scores etiquetados en la cabecera.
