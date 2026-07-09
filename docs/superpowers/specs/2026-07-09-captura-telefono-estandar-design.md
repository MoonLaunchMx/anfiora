# Estándar único de captura de teléfono

Fecha: 2026-07-09
Estado: aprobado (brainstorming)

## Problema

Hoy el teléfono se captura en un solo `<input type="tel">` de texto libre. El
número se guarda tal cual lo teclea el usuario. Al armar el link de WhatsApp solo
se hace `phone.replace(/\D/g, '')` (quita todo lo que no sea dígito). Si el usuario
no tecleó la lada (`+52`), el link queda con un número local de 10 dígitos y
WhatsApp lo rechaza — "no me lo toma como disponible". Además cada módulo captura
el teléfono a su manera (invitados con texto libre, proveedores con `select` de
lada + texto), sin formateo ni validación real.

## Objetivo

Un **estándar único reutilizable** en toda la app que:

1. Capture la lada internacional de forma clara (default México).
2. Formatee el número correctamente mientras se escribe.
3. Garantice que el link de WhatsApp **siempre** funcione.
4. Guarde un formato canónico único (E.164) en toda la base de datos.

Fuera de alcance (feature aparte): agregar desde los contactos del celular
(Contact Picker API — solo Android/Chrome).

## Decisiones tomadas

- **Enfoque:** utilería propia sobre `libphonenumber-js` (Google) + componente
  `<PhoneInput>` con UI 100% Anfiora. No usar componente de terceros (choca con el
  design system).
- **Almacenamiento:** E.164 en el campo `phone` que ya existe. Cero columnas nuevas.
  E.164 es el formato canónico al que se migra a escala, no del que se huye.
- **Migración:** backfill único (script idempotente que corre una vez con OK, tras
  push) + toda lectura pasa por la utilería (format-independence como red de
  seguridad). No auto-sanado perezoso como único mecanismo.

## Arquitectura

### 1. Utilería — `lib/phone.ts` (funciones puras, testeables)

Envuelve `libphonenumber-js`. API:

- `toE164(raw: string, defaultCountry?: CountryCode): string | null`
  Normaliza cualquier entrada (texto libre, pegado, con/sin lada) a `+528112345678`.
  Si no trae lada, asume `defaultCountry` (default `'MX'`). Devuelve `null` si no es
  un número posible.
- `formatDisplay(e164: string): string`
  Formato legible para mostrar en listas (`+52 81 1234 5678`). Si no parsea,
  devuelve el crudo tal cual (nunca revienta).
- `isValidPhone(raw: string, country?: CountryCode): boolean`
  Valida que sea un número **posible** para ese país (no solo "tiene dígitos").
- `detectCountry(raw: string): CountryCode | null`
  Detecta país cuando el usuario pega un número internacional (`+57...` → `CO`).
- `toWhatsApp(raw: string, defaultCountry?: CountryCode): string | null`
  Dígitos sin `+` para el link de wa.me (`528112345678`). Best-effort: si el número
  guardado aún está crudo (10 dígitos, sin lada) asume `defaultCountry`.

Nota: `libphonenumber-js` resuelve correctamente el quirk histórico del `521`/`52`
de México — por eso no se hace a mano.

### 2. Componente — `app/components/ui/PhoneInput.tsx`

UI Anfiora (Tailwind, sin emojis, dropdown de país estilo filtro negro `#1D1E20`):

- Botón de país a la izquierda que muestra la lada (ej. `+52`) y abre un buscador de
  país (reutiliza `PHONE_COUNTRY_CODES` de `lib/types.ts`, extendido si hace falta).
- Input de número que **autoformatea al escribir** (`AsYouType` de la librería).
- Default a México (`+52`). Si el usuario pega un número con otra lada, salta solo al
  país correcto (`detectCountry`).
- Marca en rojo suave (`--error-*`) si el número no es válido para el país
  seleccionado, **sin bloquear** el guardado (puede quedar incompleto a propósito).
- Props: `value` (E.164 o crudo), `onChange(e164OrEmpty)`, `defaultCountry?`,
  `placeholder?`, `disabled?`. Emite **siempre E.164** (o string vacío) al padre.

### 3. Almacenamiento

- Se guarda E.164 en `phone` en: `guests`, `party_members`, `suppliers`, `users`.
- **Proveedores:** ya tienen `phone_country_code`. Se mantiene sincronizado (derivado
  del E.164) para no romper su display actual, pero la verdad vive en `phone`.
- Sin columnas nuevas. Sin cambios de schema.

### 4. Puntos de uso (reemplazo de `<input type="tel">` por `<PhoneInput>`)

- Modal alta de invitado (`app/events/[id]/page.tsx`).
- Modal edición de invitado (mismo archivo).
- Filas de acompañantes (`party_members`, mismo archivo).
- `SupplierModal.tsx` y `SupplierDetailModal.tsx`.
- Perfil (`app/perfil/page.tsx`).
- `openWhatsApp` pasa a usar `toWhatsApp` en vez de `.replace(/\D/g,'')`.

### 5. Import CSV

Sin UI nueva. El pipeline de import (`app/events/[id]/page.tsx`) pasa cada número por
`toE164(raw, 'MX')` antes de insertar. Los archivos con números locales quedan
válidos para WhatsApp automáticamente. La detección de duplicados usa el E.164
normalizado como llave (más confiable que `normalizePhone` actual).

### 6. Backfill único — `app/api/admin/backfill-phones/route.ts`

Sigue el patrón de `app/api/admin/backfill-canonical/route.ts` (admin-only, service
role). Recorre `guests`, `party_members`, `suppliers`, `users`; para cada `phone` no
vacío corre `toE164(raw, 'MX')` y actualiza si cambió. Idempotente (correrlo dos
veces no altera nada). Se ejecuta **una vez, con OK de Diego, después del push**.
Reporta cuántos normalizó y cuántos no pudo parsear (para revisión manual).

## Error handling

- Ninguna función de `lib/phone.ts` lanza: entrada inválida → `null` o crudo.
- El componente nunca bloquea el guardado; la validación es visual (rojo suave).
- El backfill omite lo que no parsea con confianza y lo reporta; nunca corrompe.

## Testing

`lib/phone.test.ts` (Vitest, lógica pura):

- MX con lada, sin lada, con `1` extra, con espacios/guiones/paréntesis.
- Pegado internacional (`+57...`, `+1...`) → E.164 correcto + país detectado.
- Basura / vacío → `null`.
- E.164 idempotente (`toE164(toE164(x)) === toE164(x)`).
- `toWhatsApp` sobre número crudo viejo (best-effort MX) y sobre E.164.
- `formatDisplay` nunca revienta con entrada inválida.

UI y endpoints con I/O se verifican manual (local → preview → main).

## Dependencia nueva

- `libphonenumber-js` (pequeña, tree-shakeable). Instalar con OK antes de codear.

## Plan de despliegue (respeta sincronía Supabase ↔ Vercel)

1. Código a `main` (componente + utilería + reemplazos + endpoint backfill).
2. Verificación manual local → preview.
3. Con OK, correr el backfill una vez en producción.
4. No hay cambios de schema, así que no hay SQL que aplicar.
