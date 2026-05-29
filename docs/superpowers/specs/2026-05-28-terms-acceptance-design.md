# Aceptación de Términos y Condiciones

**Fecha:** 2026-05-28
**Autor:** Diego Garza

## Resumen

Sistema completo de aceptación de Términos y Condiciones + Aviso de Privacidad para Anfiora, con prueba de consentimiento por usuario (versión + fecha + IP), captura en el registro, y un gate que re-pide aceptación a usuarios existentes y cuando se actualiza el texto. Objetivo: protección legal del negocio. Visibilidad de la evidencia desde el superadmin.

## Contexto actual

- Existe `/privacidad` (aviso de privacidad público). **No existe** página de Términos.
- El registro (`app/components/auth/AuthModal.tsx` y `app/invite/[token]/page.tsx`) **no captura ninguna aceptación**.
- Hay usuarios reales ya registrados sin consentimiento previo.
- Auth: Supabase email/password, sesión client-side. Acceso por página vía `supabase.auth.getUser()`.

## Restricciones

- **Yo (Claude) nunca toco Supabase.** La única acción de schema (crear `terms_acceptances`) se entrega como SQL y la corre Diego, con el código ya en su rama (regla de sincronía Supabase↔Vercel).
- No afectar datos de usuarios existentes. El gate es un prompt único, no destructivo.
- Solo Tailwind, español, estilo flat (igual a `/privacidad`), CTA teal `#48C9B0`, Lucide.
- No soy abogado: el texto de T&C es un **borrador** marcado para revisión con abogado mexicano (LFPDPPP).

## Arquitectura

### Versionado — `lib/legal.ts` (NUEVO)

```ts
export const CURRENT_LEGAL_VERSION = '1.0'
export const LEGAL_EFFECTIVE_DATE = '2026-05-28'
export const LEGAL_DOCUMENT = 'terms_privacy' as const
```

Una sola versión cubre Términos + Aviso de Privacidad. Bumpear `CURRENT_LEGAL_VERSION` re-dispara el gate para todos.

### Tabla — `terms_acceptances` (NUEVA, SQL para Diego)

```sql
create table public.terms_acceptances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document    text not null default 'terms_privacy',
  version     text not null,
  accepted_at timestamptz not null default now(),
  ip_address  text,
  user_agent  text
);
create index terms_acceptances_user_idx on public.terms_acceptances(user_id);
alter table public.terms_acceptances enable row level security;
-- Lectura: el propio usuario ve sus aceptaciones (las del admin pasan por service role en la API)
create policy "own_acceptances_select" on public.terms_acceptances
  for select using (auth.uid() = user_id);
-- Insert: el propio usuario puede registrar su consentimiento
create policy "own_acceptances_insert" on public.terms_acceptances
  for insert with check (auth.uid() = user_id);
```

Append-only por convención (no se actualiza ni borra desde la app). El admin lee con service role.

### API — `POST /api/legal/accept` (NUEVO)

- Verifica sesión (token Bearer → `supabaseAdmin.auth.getUser`).
- Captura IP desde header `x-forwarded-for` (primer valor) y `user-agent`.
- Inserta fila en `terms_acceptances` con `version = CURRENT_LEGAL_VERSION`, `document = 'terms_privacy'`.
- Idempotencia ligera: si ya existe una fila para (user_id, version), no inserta duplicado (devuelve ok igual).
- Responde `{ ok: true }`.

Por qué server-side: la IP confiable solo se obtiene del request en el servidor.

### Captura en registro

- **`AuthModal.tsx`** (vista register): checkbox obligatorio con texto "Acepto los [Términos y Condiciones] y el [Aviso de Privacidad]" (enlaces a `/terminos` y `/privacidad`, abren en pestaña nueva). El botón "Crear cuenta" queda deshabilitado hasta marcarlo. Tras `signUp` exitoso con sesión, llama a `/api/legal/accept`. Si el signup requiere confirmación por correo (sin sesión inmediata), el gate registrará el consentimiento en el primer login.
- **`invite/[token]/page.tsx`** (flujo register inline): mismo checkbox obligatorio + misma llamada al API tras registro.

### Gate de re-consentimiento — `<LegalGate />` (NUEVO)

- Componente client montado **una vez** en `app/layout.tsx` (envuelve todo).
- En mount: `supabase.auth.getSession()`. Si no hay sesión → no renderiza nada (páginas públicas intactas).
- Si hay sesión: consulta si el usuario tiene aceptación para `CURRENT_LEGAL_VERSION` (query a `terms_acceptances` por user_id + version, o vía un endpoint ligero `GET /api/legal/status`). Si **no** la tiene → modal bloqueante: "Actualizamos nuestros Términos y Aviso de Privacidad. Acéptalos para continuar." con enlaces + botón Aceptar.
- Al aceptar → `POST /api/legal/accept` → cierra el modal.
- Cubre: usuarios existentes (sin ninguna fila) y bumps de versión (fila de versión vieja, falta la nueva).
- El modal no permite cerrar sin aceptar (sin botón X, sin cerrar con overlay). Opción "Cerrar sesión" disponible para quien no quiera aceptar.

### Visibilidad en superadmin

- `app/api/admin/users/route.ts`: agregar lectura de `terms_acceptances` (service role) y devolver por usuario: `latest_terms_version`, `latest_terms_at`, y el arreglo `terms_history` (version, accepted_at, ip_address).
- `app/admin/lib/types.ts`: extender `AdminUser` con `terms_version: string | null`, `terms_accepted_at: string | null`, `terms_history: { version: string; accepted_at: string; ip_address: string | null }[]`.
- `app/admin/UsuariosTab.tsx`:
  - Nueva columna "Términos": si `terms_version === CURRENT_LEGAL_VERSION` → `v1.0 · 28-may` (verde); si null o versión vieja → badge rojo `Pendiente`.
  - En la fila expandida: bloque "Historial de consentimiento" con cada aceptación (versión, fecha, IP).

## Páginas de contenido

- **`/terminos`** (NUEVO, `app/terminos/page.tsx`): borrador de T&C en español, secciones: aceptación, descripción del servicio, cuentas y registro, uso aceptable, datos de invitados y responsabilidad del organizador (el usuario es responsable de los datos de terceros que sube), propiedad intelectual, planes y pagos, limitación de responsabilidad, indemnización, terminación, modificaciones, ley aplicable (México) y contacto. Encabezado "Versión 1.0 · vigente desde 28 de mayo de 2026". Banner discreto: "Borrador — pendiente de revisión legal".
- **`/privacidad`** (MODIFICAR): agregar el sello de versión/fecha coherente con `lib/legal.ts`.

## Data flow

1. **Registro:** marca checkbox → `signUp` → si hay sesión, `POST /api/legal/accept` (v1.0, IP, UA).
2. **Login de usuario existente / desactualizado:** `<LegalGate />` detecta falta de versión vigente → modal → aceptar → API.
3. **Admin:** API carga acceptances → UsuariosTab muestra estado + historial.

## Manejo de errores

- API accept falla → el gate muestra error y NO se cierra; el usuario reintenta. (Belt-and-suspenders: si el registro no alcanzó a grabar, el gate lo atrapa en el siguiente load.)
- Query de status falla → el gate, ante la duda, no bloquea (fail-open) para no dejar a usuarios fuera por un error transitorio; se reintenta en el próximo load. (Decisión: disponibilidad > rigor en fallo transitorio.)
- Doble registro de la misma versión → la idempotencia evita duplicados.

## Archivos

| Archivo | Acción |
|---|---|
| `lib/legal.ts` | NUEVO — versión + fecha + constantes |
| `app/terminos/page.tsx` | NUEVO — borrador T&C |
| `app/privacidad/page.tsx` | MODIFICAR — sello de versión |
| `app/api/legal/accept/route.ts` | NUEVO — registra consentimiento (IP, UA) |
| `app/api/legal/status/route.ts` | NUEVO — devuelve si el usuario tiene la versión vigente |
| `app/components/LegalGate.tsx` | NUEVO — modal bloqueante de re-consentimiento |
| `app/layout.tsx` | MODIFICAR — montar `<LegalGate />` |
| `app/components/auth/AuthModal.tsx` | MODIFICAR — checkbox obligatorio + llamada API |
| `app/invite/[token]/page.tsx` | MODIFICAR — checkbox obligatorio + llamada API |
| `app/api/admin/users/route.ts` | MODIFICAR — leer terms_acceptances |
| `app/admin/lib/types.ts` | MODIFICAR — campos de consentimiento en AdminUser |
| `app/admin/UsuariosTab.tsx` | MODIFICAR — columna + historial |
| SQL `terms_acceptances` | Diego lo corre en Supabase |

## Decisiones de diseño

- **Una versión combinada** (terms + privacy) en vez de versionar cada doc por separado: más simple, y en la práctica un cambio en cualquiera amerita re-consentimiento. La columna `document` queda para granularidad futura.
- **Registro server-side** para IP confiable.
- **Gate en root layout**, un solo punto de montaje, en vez de tocar cada página autenticada.
- **Fail-open** ante error transitorio del status check (no encerrar usuarios por un bug).
- **RLS**: el usuario solo ve/inserta lo suyo; el admin lee todo vía service role.

## Fuera de alcance (YAGNI)

- Versionar Términos y Privacidad por separado.
- Editor de documentos legales en el admin (el texto vive en el código).
- Exportar reporte de consentimientos (se ve en admin / Supabase).
- Multi-idioma del texto legal (español primero; el borrador es en español).
- Firma electrónica avanzada / e.firma.

## Criterios de éxito

1. Un usuario nuevo no puede crear cuenta sin marcar el checkbox; su consentimiento queda registrado con versión, fecha e IP.
2. Un usuario existente, al entrar, ve el gate una vez; al aceptar, queda registrado y no se le vuelve a pedir (hasta un bump de versión).
3. Bumpear `CURRENT_LEGAL_VERSION` re-dispara el gate para todos.
4. El superadmin muestra por usuario la versión aceptada + fecha y el historial con IP.
5. Cero cambios hechos por Claude en Supabase; cero impacto en datos de usuarios existentes.
6. `/terminos` y `/privacidad` públicas con sello de versión.
