# Estándar único de captura de teléfono — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar teléfonos con lada internacional y formato correcto, guardar todo en E.164, y garantizar que el link de WhatsApp siempre funcione.

**Architecture:** Una utilería pura `lib/phone.ts` sobre `libphonenumber-js` (normaliza/valida/formatea/arma link), un componente reutilizable `<PhoneInput>` con UI Anfiora, y el reemplazo de todos los `<input type="tel">` por ese componente. Almacenamiento canónico E.164 en el campo `phone` existente (cero columnas nuevas). Backfill único idempotente para normalizar lo viejo.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Vitest, `libphonenumber-js` (nueva dependencia).

## Global Constraints

- **Sin columnas ni tablas nuevas** en Supabase. E.164 vive en el campo `phone` que ya existe (`guests`, `party_members`, `suppliers`, `users`).
- **Toda lectura de teléfono pasa por `lib/phone.ts`** (format-independence). Nunca leer `phone` crudo para armar un link.
- **UI en español, sin emojis, estilo flat Tailwind.** CTA teal `#48C9B0`, dropdowns de filtro negro `#1D1E20`. Iconos Lucide.
- **E.164 como único formato canónico:** `+528112345678` (sin espacios, con `+`).
- **País por defecto: México (`'MX'`).**
- **Commits convencionales sin acentos ni ñ** (`feat:`, `fix:`, `refactor:`).
- **No pushear a main ni tocar Supabase sin OK explícito de Diego.** El backfill corre una sola vez, con OK, después del push.
- **Tests:** Vitest solo para `lib/phone.ts` (lógica pura). UI y endpoints con I/O se verifican manual (local → preview → main).

---

### Task 1: Utilería `lib/phone.ts` + tests

**Files:**
- Create: `lib/phone.ts`
- Test: `lib/phone.test.ts`
- Modify: `package.json` (agregar dependencia)

**Interfaces:**
- Produces:
  - `toE164(raw: string, defaultCountry?: CountryCode): string | null`
  - `formatDisplay(value: string): string`
  - `isValidPhone(raw: string, country?: CountryCode): boolean`
  - `detectCountry(raw: string): CountryCode | null`
  - `toWhatsApp(raw: string, defaultCountry?: CountryCode): string | null`
  - `formatAsYouType(raw: string, country?: CountryCode): string`
  - `COUNTRIES: { iso: CountryCode; name: string; dial: string }[]` (MX primero)
  - `DEFAULT_COUNTRY: CountryCode` (`'MX'`)
  - re-export `type CountryCode` desde `libphonenumber-js`

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install libphonenumber-js`
Expected: se agrega `libphonenumber-js` a `dependencies` en `package.json`, sin errores.

- [ ] **Step 2: Escribir el test que falla — `lib/phone.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { toE164, formatDisplay, isValidPhone, detectCountry, toWhatsApp } from './phone'

describe('toE164', () => {
  it('MX local sin lada asume +52', () => {
    expect(toE164('81 1234 5678')).toBe('+528112345678')
  })
  it('MX con lada explicita', () => {
    expect(toE164('+52 81 1234 5678')).toBe('+528112345678')
  })
  it('MX con el 1 extra viejo lo normaliza', () => {
    expect(toE164('+521 81 1234 5678')).toBe('+528112345678')
  })
  it('acepta guiones y parentesis', () => {
    expect(toE164('(81) 1234-5678')).toBe('+528112345678')
  })
  it('pegado internacional Colombia respeta su lada', () => {
    expect(toE164('+57 301 234 5678')).toBe('+573012345678')
  })
  it('basura devuelve null', () => {
    expect(toE164('hola mundo')).toBeNull()
  })
  it('vacio devuelve null', () => {
    expect(toE164('')).toBeNull()
  })
  it('es idempotente sobre su propia salida', () => {
    const once = toE164('81 1234 5678')!
    expect(toE164(once)).toBe(once)
  })
})

describe('toWhatsApp', () => {
  it('arma los digitos sin + desde texto local', () => {
    expect(toWhatsApp('81 1234 5678')).toBe('528112345678')
  })
  it('arma los digitos desde E.164 ya guardado', () => {
    expect(toWhatsApp('+528112345678')).toBe('528112345678')
  })
  it('numero imposible devuelve null', () => {
    expect(toWhatsApp('123')).toBeNull()
  })
})

describe('isValidPhone', () => {
  it('numero MX valido', () => {
    expect(isValidPhone('81 1234 5678', 'MX')).toBe(true)
  })
  it('demasiado corto no es valido', () => {
    expect(isValidPhone('123', 'MX')).toBe(false)
  })
})

describe('detectCountry', () => {
  it('detecta pais desde numero internacional pegado', () => {
    expect(detectCountry('+57 301 234 5678')).toBe('CO')
  })
  it('sin lada no detecta', () => {
    expect(detectCountry('81 1234 5678')).toBeNull()
  })
})

describe('formatDisplay', () => {
  it('formatea E.164 a internacional legible', () => {
    expect(formatDisplay('+528112345678')).toBe('+52 81 1234 5678')
  })
  it('entrada invalida devuelve el crudo sin reventar', () => {
    expect(formatDisplay('no-es-numero')).toBe('no-es-numero')
  })
})
```

- [ ] **Step 3: Correr el test para ver que falla**

Run: `npm test -- lib/phone.test.ts`
Expected: FAIL — no existe `./phone` / funciones no definidas.

- [ ] **Step 4: Implementar `lib/phone.ts`**

```ts
import {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  AsYouType,
  type CountryCode,
} from 'libphonenumber-js'

export type { CountryCode }

export const DEFAULT_COUNTRY: CountryCode = 'MX'

// Lista para el selector de pais (MX primero, luego America y Europa).
// El dial se deriva de libphonenumber para no mantenerlo a mano.
const COUNTRY_ISOS: { iso: CountryCode; name: string }[] = [
  { iso: 'MX', name: 'Mexico' },
  { iso: 'US', name: 'USA / Canada' },
  { iso: 'AR', name: 'Argentina' },
  { iso: 'BO', name: 'Bolivia' },
  { iso: 'BR', name: 'Brasil' },
  { iso: 'CL', name: 'Chile' },
  { iso: 'CO', name: 'Colombia' },
  { iso: 'CR', name: 'Costa Rica' },
  { iso: 'CU', name: 'Cuba' },
  { iso: 'EC', name: 'Ecuador' },
  { iso: 'SV', name: 'El Salvador' },
  { iso: 'GT', name: 'Guatemala' },
  { iso: 'HN', name: 'Honduras' },
  { iso: 'NI', name: 'Nicaragua' },
  { iso: 'PA', name: 'Panama' },
  { iso: 'PY', name: 'Paraguay' },
  { iso: 'PE', name: 'Peru' },
  { iso: 'UY', name: 'Uruguay' },
  { iso: 'VE', name: 'Venezuela' },
  { iso: 'ES', name: 'Espana' },
  { iso: 'DE', name: 'Alemania' },
  { iso: 'FR', name: 'Francia' },
  { iso: 'IT', name: 'Italia' },
  { iso: 'PT', name: 'Portugal' },
  { iso: 'GB', name: 'Reino Unido' },
  { iso: 'US', name: 'Estados Unidos' },
]

export const COUNTRIES: { iso: CountryCode; name: string; dial: string }[] =
  COUNTRY_ISOS
    .filter((c, i, arr) => arr.findIndex(x => x.iso === c.iso) === i)
    .map(c => ({ ...c, dial: `+${getCountryCallingCode(c.iso)}` }))

export function toE164(raw: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): string | null {
  if (!raw || !raw.trim()) return null
  const parsed = parsePhoneNumberFromString(raw.trim(), defaultCountry)
  if (!parsed || !parsed.isPossible()) return null
  return parsed.number
}

export function formatDisplay(value: string): string {
  if (!value || !value.trim()) return ''
  const parsed = parsePhoneNumberFromString(value.trim())
  if (!parsed) return value
  return parsed.formatInternational()
}

export function isValidPhone(raw: string, country: CountryCode = DEFAULT_COUNTRY): boolean {
  if (!raw || !raw.trim()) return false
  const parsed = parsePhoneNumberFromString(raw.trim(), country)
  return !!parsed && parsed.isValid()
}

export function detectCountry(raw: string): CountryCode | null {
  if (!raw || !raw.trim()) return null
  const parsed = parsePhoneNumberFromString(raw.trim())
  return parsed?.country ?? null
}

export function toWhatsApp(raw: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): string | null {
  const e164 = toE164(raw, defaultCountry)
  if (!e164) return null
  return e164.replace(/\D/g, '')
}

export function formatAsYouType(raw: string, country: CountryCode = DEFAULT_COUNTRY): string {
  return new AsYouType(country).input(raw)
}
```

- [ ] **Step 5: Correr los tests hasta verde**

Run: `npm test -- lib/phone.test.ts`
Expected: PASS (todos). Si alguna aserción exacta difiere del output real de libphonenumber, ajustar la aserción al valor E.164 canónico que devuelve (no cambiar la lógica).

- [ ] **Step 6: Verificar build/tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/phone.ts lib/phone.test.ts package.json package-lock.json
git commit -m "feat(phone): utileria E.164 sobre libphonenumber-js con tests"
```

---

### Task 2: Componente `<PhoneInput>`

**Files:**
- Create: `app/components/ui/PhoneInput.tsx`

**Interfaces:**
- Consumes (de Task 1): `COUNTRIES`, `DEFAULT_COUNTRY`, `toE164`, `formatAsYouType`, `detectCountry`, `isValidPhone`, `type CountryCode`
- Produces:
  ```ts
  type PhoneInputProps = {
    value: string                 // E.164 o crudo; '' si vacio
    onChange: (e164OrEmpty: string) => void
    defaultCountry?: CountryCode  // default 'MX'
    placeholder?: string
    disabled?: boolean
    className?: string            // clases del contenedor
  }
  export default function PhoneInput(props: PhoneInputProps): JSX.Element
  ```

**Comportamiento:**
- Estado interno: `country: CountryCode` y `text: string` (lo visible, formateado con `formatAsYouType`).
- Al montar / cuando `value` cambia desde afuera: si `value` parsea, setear `country = detectCountry(value) ?? defaultCountry` y `text = formatAsYouType(value, country)`.
- Al escribir: `text = formatAsYouType(input, country)`; emitir `onChange(toE164(input, country) ?? '')`. Si el usuario borra todo, emitir `''`.
- Si el usuario pega un número con otra lada, `detectCountry` lo salta al país correcto.
- Botón de país a la izquierda que muestra `COUNTRIES.find(c => c.iso === country)?.dial` (ej. `+52`) y abre un panel buscable (input de filtro + lista de `COUNTRIES`, estilo dropdown negro `#1D1E20`). Al elegir país, re-emitir `onChange(toE164(text, nuevoPais) ?? '')`.
- Borde rojo suave (`border-[#ffc0c0]`) cuando `text` no vacío y `!isValidPhone(text, country)`. No bloquea nada (solo señal visual).
- Sin emojis. Layout: contenedor `flex` con el botón de país y el `<input type="tel" inputMode="tel">`.

- [ ] **Step 1: Crear el componente**

Implementar `app/components/ui/PhoneInput.tsx` con la interfaz y comportamiento de arriba. Usar Tailwind. El panel de países se abre/cierra con estado local `open`; cerrar al hacer click en una opción o fuera. Reutilizar el patrón visual de otros dropdowns de la app.

- [ ] **Step 2: Verificación de tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificación manual mínima (local)**

Renderizar temporalmente `<PhoneInput value="" onChange={console.log} />` en cualquier pantalla de dev y probar:
- Teclear `8112345678` → se formatea y el console.log muestra `+528112345678`.
- Cambiar país a Colombia y teclear un número CO → E.164 con `+57`.
- Pegar `+57 301 234 5678` → el botón salta a Colombia solo.
- Número incompleto → borde rojo suave, sin bloquear.
Quitar el render temporal al terminar.

- [ ] **Step 4: Commit**

```bash
git add app/components/ui/PhoneInput.tsx
git commit -m "feat(phone): componente PhoneInput estilo Anfiora"
```

---

### Task 3: Integrar en Invitados (alta, edición, acompañantes, link WA, import CSV)

**Files:**
- Modify: `app/events/[id]/page.tsx`

**Interfaces:**
- Consumes: `PhoneInput` (Task 2); `toWhatsApp`, `toE164` (Task 1)

**Puntos exactos a tocar (referencia de líneas del estado actual):**
- Alta de invitado — input teléfono en `~569`.
- Edición de invitado — input teléfono en `~643`.
- Filas de acompañantes — input teléfono en `~376` (dentro del editor de members).
- `openWhatsApp` en `~1096`: cambiar `const num = (phone || '').replace(/\D/g, '')` por `const num = toWhatsApp(phone); if (!num) { alert('Este invitado no tiene un numero de WhatsApp valido'); return }`.
- Import CSV — normalización en `~1172` (armado de `row.phone`) y dedupe en `~1178-1182`.

- [ ] **Step 1: Importar utilería y componente**

Agregar al top de `page.tsx`:
```ts
import PhoneInput from '@/app/components/ui/PhoneInput'
import { toWhatsApp, toE164 } from '@/lib/phone'
```

- [ ] **Step 2: Reemplazar el input de teléfono en alta de invitado**

En el form de alta (`~569`), cambiar:
```tsx
<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+52 81 1234 5678" style={inp} />
```
por:
```tsx
<PhoneInput value={phone} onChange={setPhone} placeholder="81 1234 5678" />
```

- [ ] **Step 3: Reemplazar el input en edición de invitado**

En el form de edición (`~643`), hacer el mismo reemplazo (usa el mismo `phone`/`setPhone` de ese form).

- [ ] **Step 4: Reemplazar el input en filas de acompañantes**

En el editor de members (`~376`), cambiar el `<input type="tel">` por:
```tsx
<PhoneInput value={m.phone} onChange={val => update(i, 'phone', val)} placeholder="WhatsApp (opcional)" />
```

- [ ] **Step 5: Arreglar `openWhatsApp` para usar E.164**

En `~1096-1097`:
```ts
const openWhatsApp = (phone: string, encodedText?: string) => {
  const num = toWhatsApp(phone)
  if (!num) { alert('Este invitado no tiene un numero de WhatsApp valido'); return }
  // ...resto igual (usa `num`)
```

- [ ] **Step 6: Normalizar teléfono en import CSV + dedupe por E.164**

En el armado de la fila (`~1172`), envolver el teléfono:
```ts
phone: phoneIdx >= 0 ? (toE164(cols[phoneIdx] || '', 'MX') ?? (cols[phoneIdx] || null)) : null,
```
En el dedupe (`~1178-1182`), reemplazar `normalizePhone(row.phone)` por la llave E.164:
```ts
const norm = toE164(row.phone, 'MX'); if (!norm) return
const existingGuest = guests.find(g => g.phone && toE164(g.phone, 'MX') === norm)
```
(mismo criterio para `seenInFile`).

- [ ] **Step 7: Verificación de tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 8: Verificación manual (local, localhost:3000)**

- Alta de invitado tecleando solo `8112345678` → se guarda; el botón de WhatsApp abre un chat con lada `+52` correcta.
- Editar un invitado viejo con número crudo → el link de WhatsApp funciona (best-effort MX).
- Agregar acompañante con teléfono → link funciona.
- Import CSV con números locales sin lada → quedan válidos para WhatsApp; duplicados detectados por E.164.

- [ ] **Step 9: Commit**

```bash
git add "app/events/[id]/page.tsx"
git commit -m "feat(phone): PhoneInput y links WA por E.164 en invitados e import"
```

---

### Task 4: Integrar en Proveedores (modales, card, links WA)

**Files:**
- Modify: `app/events/[id]/proveedores/SupplierModal.tsx`
- Modify: `app/events/[id]/proveedores/SupplierDetailModal.tsx`
- Modify: `app/events/[id]/proveedores/SupplierCard.tsx`

**Interfaces:**
- Consumes: `PhoneInput` (Task 2), `toWhatsApp` (Task 1)

**Nota de compatibilidad:** proveedores hoy guardan `phone` = local y `phone_country_code` = lada por separado, y arman el link concatenando. Migramos a **E.164 en `phone`**. Para no romper nada que aún lea `phone_country_code`, lo seguimos escribiendo derivado (`'+' + <lada del E.164>`), pero los links se arman desde `phone` vía `toWhatsApp`.

- [ ] **Step 1: `SupplierModal.tsx` — usar PhoneInput y guardar E.164**

- Importar `PhoneInput` y `toE164`, `detectCountry` de `@/lib/phone`.
- Quitar `phoneCode`/`setPhoneCode` y el `COUNTRY_CODES` local (`~30`, `~37`).
- El estado `phone` ahora guarda E.164 (lo emite `PhoneInput`).
- Reemplazar el bloque select+input por `<PhoneInput value={phone} onChange={setPhone} placeholder="55 1234 5678" />`.
- En `handleSubmit` (`~67-77`), derivar `phone_country_code` de la lada del país detectado en el E.164:
  ```ts
  import { detectCountry, COUNTRIES } from '@/lib/phone'
  // dentro de handleSubmit, antes de onSubmit:
  const cc = detectCountry(phone)
  const dial = COUNTRIES.find(c => c.iso === cc)?.dial ?? null
  // en el objeto:
  phone:              phone.trim() || null,   // E.164
  phone_country_code: phone.trim() ? dial : null,
  ```
- Ajustar `validate()` (`~57`) para seguir exigiendo al menos un contacto (funciona igual con `phone` en E.164).

- [ ] **Step 2: `SupplierDetailModal.tsx` — usar PhoneInput y link por E.164**

- Importar `PhoneInput`, `toWhatsApp`, `detectCountry`, `COUNTRIES`.
- Estado `phone` = E.164; eliminar dependencia de `phoneCountryCode` para el input (mantener la variable solo para escribir la columna derivada al guardar, `~124`/`~148`).
- Reemplazar el `<select className="country-code-select">` + `<input>` (`~379-382`) por `<PhoneInput value={phone} onChange={setPhone} placeholder="55 1234 5678" />`.
- `openWhatsApp` (`~255`):
  ```ts
  const openWhatsApp = () => {
    const num = toWhatsApp(phone)
    if (!num) return
    window.open(`https://wa.me/${num}`, '_blank', 'noopener,noreferrer')
  }
  ```
- Al guardar (`~124`, `~148`), derivar la lada igual:
  ```ts
  const cc = detectCountry(phone)
  const dial = COUNTRIES.find(c => c.iso === cc)?.dial ?? null
  // ...
  phone_country_code: phone.trim() ? dial : null,
  ```

- [ ] **Step 3: `SupplierCard.tsx` — link por E.164**

`~26`:
```tsx
const waDigits = s.phone ? toWhatsApp(s.phone) : null
const waLink   = waDigits ? `https://wa.me/${waDigits}` : null
```
Importar `toWhatsApp` de `@/lib/phone`.

- [ ] **Step 4: Verificación de tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 5: Verificación manual (local)**

- Alta de proveedor con teléfono → link WA abre con lada correcta.
- Editar proveedor existente (que tenía `phone` local + `phone_country_code`) → el link sigue funcionando tras el backfill; antes del backfill, best-effort MX.
- Card de proveedor: botón WhatsApp abre chat correcto.

- [ ] **Step 6: Commit**

```bash
git add "app/events/[id]/proveedores/SupplierModal.tsx" "app/events/[id]/proveedores/SupplierDetailModal.tsx" "app/events/[id]/proveedores/SupplierCard.tsx"
git commit -m "feat(phone): PhoneInput y links WA por E.164 en proveedores"
```

---

### Task 5: Integrar en Perfil

**Files:**
- Modify: `app/perfil/page.tsx`

**Interfaces:**
- Consumes: `PhoneInput` (Task 2)

- [ ] **Step 1: Reemplazar el input de teléfono**

- Importar `PhoneInput` de `@/app/components/ui/PhoneInput`.
- En `~564` reemplazar el `<input type="tel" value={phone} ...>` por `<PhoneInput value={phone} onChange={setPhone} placeholder="81 1234 5678" />`.
- Al guardar (`~199`) el `phone` ya es E.164; no cambia la query.

- [ ] **Step 2: Verificación de tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificación manual (local)**

Editar el teléfono en perfil, guardar, recargar → se muestra formateado y se guardó en E.164.

- [ ] **Step 4: Commit**

```bash
git add app/perfil/page.tsx
git commit -m "feat(phone): PhoneInput en perfil"
```

---

### Task 6: Backfill único idempotente

**Files:**
- Create: `app/api/admin/backfill-phones/route.ts`

**Interfaces:**
- Consumes: `toE164` (Task 1)

**Comportamiento:** protegido por header `x-backfill-secret === SUPABASE_SERVICE_ROLE_KEY` (mismo patrón que `app/api/admin/backfill-canonical/route.ts`). Recorre paginado y normaliza `phone` a E.164. Idempotente. Reporta normalizados y no-parseables por tabla.
- `guests`, `party_members`, `users`: `toE164(phone, 'MX')`.
- `suppliers`: usar la lada guardada como país base — `toE164((phone_country_code ?? '+52') + ' ' + phone, 'MX')` para respetar proveedores con lada distinta a MX; además setear/mantener `phone_country_code` derivado.

- [ ] **Step 1: Crear el endpoint**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { toE164 } from '@/lib/phone'

const PAGE = 500

async function normalizeTable(
  supabase: ReturnType<typeof createClient>,
  table: 'guests' | 'party_members' | 'users' | 'suppliers',
) {
  let from = 0, updated = 0, skipped = 0
  for (;;) {
    const cols = table === 'suppliers' ? 'id, phone, phone_country_code' : 'id, phone'
    const { data: rows, error } = await supabase.from(table).select(cols).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!rows || rows.length === 0) break
    for (const r of rows as Array<{ id: string; phone: string | null; phone_country_code?: string | null }>) {
      if (!r.phone) continue
      const raw = table === 'suppliers'
        ? `${r.phone_country_code ?? '+52'} ${r.phone}`
        : r.phone
      const e164 = toE164(raw, 'MX')
      if (!e164) { skipped++; continue }
      if (e164 === r.phone) continue
      const patch: Record<string, string> = { phone: e164 }
      const { error: upErr } = await supabase.from(table).update(patch).eq('id', r.id)
      if (upErr) throw new Error(`${table} update ${r.id}: ${upErr.message}`)
      updated++
    }
    from += PAGE
    if (rows.length < PAGE) break
  }
  return { updated, skipped }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('x-backfill-secret') !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 403 })
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  try {
    const report = {
      guests:        await normalizeTable(supabase, 'guests'),
      party_members: await normalizeTable(supabase, 'party_members'),
      suppliers:     await normalizeTable(supabase, 'suppliers'),
      users:         await normalizeTable(supabase, 'users'),
    }
    return NextResponse.json({ ok: true, report })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verificación de tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/backfill-phones/route.ts
git commit -m "feat(phone): endpoint backfill unico a E.164"
```

- [ ] **Step 4: Ejecución del backfill (SOLO con OK de Diego, DESPUÉS del push a main)**

No ejecutar dentro del plan. Cuando Diego dé OK y el código esté en producción, correr una vez contra prod:
```bash
curl -X POST https://anfiora.com/api/admin/backfill-phones -H "x-backfill-secret: <SUPABASE_SERVICE_ROLE_KEY>"
```
Revisar el `report`. Re-ejecutable sin efecto (idempotente).

---

## Notas de despliegue

- Sin cambios de schema → no hay SQL que aplicar.
- Orden: mergear Tasks 1-6 a main → verificar preview → con OK correr el backfill (Task 6 Step 4).
- Feature futura fuera de este plan: "agregar desde contactos" (Contact Picker API, solo Android/Chrome).
