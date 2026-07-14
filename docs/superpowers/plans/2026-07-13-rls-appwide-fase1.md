# RLS app-wide — Fase 1 (tapar los 4 hoyos) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los 4 huecos reales de RLS (`users`, `song_recommendations`, `event_audit_log`, `event_itinerary_moments`) sin romper páginas públicas por token ni rutas con service role, con un guardián de verificación permanente.

**Architecture:** Denormalizar el nombre del planner en `events.planner_name` para blindar `users` a fila propia; reescribir/activar RLS en las otras 3 tablas con helpers `SECURITY DEFINER`. La verificación es un script Node que usa el anon key e intenta los ataques (before/after). El SQL lo corre **Diego** en Supabase (Claude nunca toca Supabase); el código se despliega **antes** del SQL peligroso.

**Tech Stack:** Postgres RLS (Supabase), `@supabase/supabase-js` (ya es dependencia), Node 24 (`--env-file`), Next.js 16 App Router.

**Spec:** `docs/superpowers/specs/2026-07-13-rls-appwide-design.md`

## Global Constraints

- **Claude NUNCA toca Supabase** (schema, datos, RLS). Todo SQL lo corre Diego; el plan entrega archivos `.sql` versionados y listos para pegar.
- **Regla sync Supabase ↔ Vercel:** código pusheado a `origin/main` ANTES de correr SQL que rompa el código viejo. Excepción additiva: `ALTER TABLE ... ADD COLUMN` nullable puede correr antes (no rompe nada).
- **Nunca `git push` sin OK explícito de Diego.**
- SQL idempotente: `DROP POLICY IF EXISTS` / `CREATE OR REPLACE`, envuelto en `BEGIN; ... COMMIT;`.
- Rama de trabajo: `feat/rls-appwide` (worktree `.claude/worktrees/rls-appwide`).
- Commits convencionales, sin acentos ni ñ.
- Helpers ya existentes (NO recrear): `is_event_owner`, `is_event_member`, `is_event_admin`, `event_has_playlist_token`.

---

## Estructura de archivos

- **Crear** `scripts/rls-audit.mjs` — guardián de verificación (anon key intenta los ataques).
- **Crear** `docs/superpowers/plans/sql/2026-07-13-rls-planner-name.sql` — additive: columna + backfill.
- **Crear** `docs/superpowers/plans/sql/2026-07-13-rls-holes.sql` — helpers + cierre de los 4 hoyos.
- **Modificar** `app/events/[id]/page.tsx` (`loadEvent`, ~817-830) — leer `planner_name` del evento.
- **Modificar** `app/perfil/page.tsx` (`handleSaveProfile`, ~197-208) — propagar el nombre a `events.planner_name`.

---

## Task 1: Guardián de verificación `scripts/rls-audit.mjs`

**Files:**
- Create: `scripts/rls-audit.mjs`

**Interfaces:**
- Produces: script ejecutable con `node --env-file=.env.local scripts/rls-audit.mjs`. Exit 0 = todo cerrado; exit 1 = hoyo abierto. Usado en Task 4 para confirmar el cierre.
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` de `.env.local`.

- [ ] **Step 1: Escribir el script**

```js
// scripts/rls-audit.mjs
// Guardian de RLS: usa el ANON key (llave publica) e intenta leer lo que NO deberia.
// Correr con:  node --env-file=.env.local scripts/rls-audit.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !anon) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local')
  process.exit(2)
}

const sb = createClient(url, anon)
let failures = 0

// Estas 3 tablas NO deben devolver NADA a un anon (ni por token ni de otra forma).
async function expectEmpty(label, table) {
  const { data, error } = await sb.from(table).select('*').limit(5)
  const n = data?.length ?? 0
  if (n > 0) {
    console.log(`  ABIERTO  ${label}: anon leyo ${n} fila(s) de ${table}`)
    failures++
  } else {
    console.log(`  cerrado  ${label}: anon leyo 0 filas${error ? ' (denegado)' : ''}`)
  }
}

console.log('--- Auditoria RLS (anon key) ---')
await expectEmpty('users', 'users')
await expectEmpty('event_audit_log', 'event_audit_log')
await expectEmpty('event_itinerary_moments', 'event_itinerary_moments')

// song_recommendations: la lectura anon SI es legitima para eventos con playlist activa.
// El guardian solo reporta cuantas ve (informativo); el token-scoping y el dedupe 6->4
// se verifican leyendo la migracion aplicada y con la prueba manual (Task 4).
{
  const { data } = await sb.from('song_recommendations').select('event_id').limit(1000)
  const eventos = new Set((data ?? []).map(r => r.event_id)).size
  console.log(`  info     song_recommendations: anon ve ${data?.length ?? 0} canciones de ${eventos} evento(s) (esperado: solo eventos con playlist)`)
}

console.log(failures === 0 ? '\nRESULTADO: TODO CERRADO' : `\nRESULTADO: ${failures} hoyo(s) ABIERTO(S)`)
process.exit(failures === 0 ? 0 : 1)
```

- [ ] **Step 2: Correr contra producción — debe mostrar los hoyos ABIERTOS**

Run: `node --env-file=.env.local scripts/rls-audit.mjs`
Expected: `users`, `event_audit_log`, `event_itinerary_moments` salen **ABIERTO** (leen filas). Exit code 1. Esto **documenta el estado actual** (el "test que falla"). Guardar la salida.

- [ ] **Step 3: Commit**

```bash
git add scripts/rls-audit.mjs
git commit -m "chore(rls): guardian de verificacion anon-key para los 4 hoyos"
```

---

## Task 2: Denormalizar `events.planner_name` (código + SQL additive)

**Files:**
- Create: `docs/superpowers/plans/sql/2026-07-13-rls-planner-name.sql`
- Modify: `app/events/[id]/page.tsx` (`loadEvent`)
- Modify: `app/perfil/page.tsx` (`handleSaveProfile`)

**Interfaces:**
- Produces: columna `events.planner_name text`. El código lee el nombre del planner de la fila del evento (ya legible vía RLS de `events`), eliminando la única lectura cruzada de `users`. Prerrequisito para poder borrar la policy `true` de `users` en Task 3.

- [ ] **Step 1: Escribir el SQL additive (lo corre Diego)**

Create `docs/superpowers/plans/sql/2026-07-13-rls-planner-name.sql`:
```sql
-- FASE 1 / additive: nombre del planner denormalizado en el evento.
-- Es una columna nullable nueva: NO rompe codigo viejo, se puede correr ANTES del deploy.
BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS planner_name text;

UPDATE public.events e
   SET planner_name = u.full_name
  FROM public.users u
 WHERE u.id = e.user_id
   AND e.planner_name IS DISTINCT FROM u.full_name;

COMMIT;
```

- [ ] **Step 2: Modificar `loadEvent` en `app/events/[id]/page.tsx`**

Reemplazar el bloque actual (lee `users`):
```tsx
  const loadEvent = async () => {
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('event_settings').select('*').eq('event_id', id).single(),
    ])
    if (data) {
      setEvent(data)
      if (data.user_id) {
        const { data: planner } = await supabase.from('users').select('full_name').eq('id', data.user_id).single()
        if (planner?.full_name) setPlannerName(planner.full_name)
      }
    }
    if (settings) setEventSettings(settings)
  }
```
por (lee `planner_name` de la misma fila del evento):
```tsx
  const loadEvent = async () => {
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase.from('event_settings').select('*').eq('event_id', id).single(),
    ])
    if (data) {
      setEvent(data)
      if (data.planner_name) setPlannerName(data.planner_name)
    }
    if (settings) setEventSettings(settings)
  }
```

- [ ] **Step 3: Propagar el nombre en `handleSaveProfile` (`app/perfil/page.tsx`)**

En el bloque de éxito (después de `supabase.auth.updateUser(...)`), agregar la propagación a los eventos propios:
```tsx
    if (error) {
      setProfileMsg({ type: 'error', text: 'No se pudo guardar. Intenta de nuevo.' })
    } else {
      // Sincronizar metadata de auth tambien
      await supabase.auth.updateUser({ data: { full_name: name.trim() } })
      // Mantener fresco el nombre denormalizado en los eventos propios
      await supabase.from('events').update({ planner_name: name.trim() }).eq('user_id', userId)
      setProfileMsg({ type: 'success', text: 'Perfil actualizado correctamente' })
    }
```

- [ ] **Step 4: Verificar build/tsc**

Run: `npm run build`
Expected: compila sin errores de tipos en los dos archivos tocados.

- [ ] **Step 5: Commit**

```bash
git add app/events/[id]/page.tsx app/perfil/page.tsx docs/superpowers/plans/sql/2026-07-13-rls-planner-name.sql
git commit -m "feat(rls): denormaliza events.planner_name y lo lee del evento (blinda users)"
```

- [ ] **Step 6: 🧑 CHECKPOINT Diego — desplegar en orden**

1. Diego corre `docs/superpowers/plans/sql/2026-07-13-rls-planner-name.sql` en Supabase (additive, seguro).
2. Con OK de Diego: merge de `feat/rls-appwide` → push a `origin/main`.
3. Verificación manual: abrir un evento (dueño y colaborador) → el nombre del planner aparece en las plantillas de WhatsApp (`{planner}`). Cambiar el nombre en `/perfil` → se refleja en el evento.

**No avanzar a Task 3 hasta que este código esté en `origin/main`.**

---

## Task 3: Migración de los 4 hoyos (SQL)

**Files:**
- Create: `docs/superpowers/plans/sql/2026-07-13-rls-holes.sql`

**Interfaces:**
- Consumes: `events.planner_name` + código de Task 2 ya en `origin/main` (para que borrar la policy `true` de `users` no rompa nada).
- Produces: `users` blindada a fila propia; `song_recommendations` acotada por token; `event_audit_log` y `event_itinerary_moments` con RLS. Helpers nuevos `is_event_editor`, `is_platform_admin`.

- [ ] **Step 1: Escribir la migración**

Create `docs/superpowers/plans/sql/2026-07-13-rls-holes.sql`:
```sql
-- FASE 1: cierre de los 4 hoyos de RLS.
-- PRERREQUISITO: el codigo de Task 2 (lee events.planner_name) YA en origin/main.
-- Idempotente. Correr completo en el SQL Editor de Supabase.
BEGIN;

-- ============ Helpers nuevos ============
-- owner o colaborador activo con rol admin/editor
CREATE OR REPLACE FUNCTION public.is_event_editor(eid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_collaborators
                 WHERE event_id = eid AND user_id = auth.uid()
                   AND status = 'active' AND role IN ('admin','editor'));
$$;

-- admin de plataforma: espeja el gate por correo de /admin (ADMIN_EMAIL)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT (auth.jwt() ->> 'email') = 'diego.garza@moonlaunch.mx';
$$;

-- ============ 1) users: quitar la lectura total ============
-- El admin ya lee por service role (/api/admin/users). Queda solo fila propia.
DROP POLICY IF EXISTS "Admin can read all users" ON public.users;

-- ============ 2) song_recommendations: token-scoping + dedupe 6->4 ============
DROP POLICY IF EXISTS "anon insert song_recommendations" ON public.song_recommendations;
DROP POLICY IF EXISTS "authenticated insert song_recommendations" ON public.song_recommendations;
DROP POLICY IF EXISTS "public can insert song_recommendations" ON public.song_recommendations;
DROP POLICY IF EXISTS "anon select song_recommendations" ON public.song_recommendations;
DROP POLICY IF EXISTS "authenticated select song_recommendations" ON public.song_recommendations;
DROP POLICY IF EXISTS "public can read song_recommendations" ON public.song_recommendations;

CREATE POLICY songs_anon_select ON public.song_recommendations
  FOR SELECT TO anon USING (public.event_has_playlist_token(event_id));
CREATE POLICY songs_anon_insert ON public.song_recommendations
  FOR INSERT TO anon WITH CHECK (public.event_has_playlist_token(event_id));
CREATE POLICY songs_member_select ON public.song_recommendations
  FOR SELECT TO authenticated USING (public.is_event_member(event_id));
CREATE POLICY songs_editor_write ON public.song_recommendations
  FOR ALL TO authenticated
  USING (public.is_event_editor(event_id))
  WITH CHECK (public.is_event_editor(event_id));

-- ============ 3) event_audit_log: prender RLS ============
ALTER TABLE public.event_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_member_insert ON public.event_audit_log;
DROP POLICY IF EXISTS audit_admin_select ON public.event_audit_log;
-- Escribe el usuario que actua (cliente del browser), solo en eventos donde es miembro
CREATE POLICY audit_member_insert ON public.event_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_event_member(event_id));
-- Lee solo el admin de plataforma (feature de super-admin en /admin)
CREATE POLICY audit_admin_select ON public.event_audit_log
  FOR SELECT TO authenticated USING (public.is_platform_admin());
-- Sin UPDATE/DELETE -> bitacora inmutable desde el cliente

-- ============ 4) event_itinerary_moments: prender RLS ============
-- La lectura publica sigue por service role (/api/invitacion/[token]) -> bypassa RLS.
ALTER TABLE public.event_itinerary_moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS itinerary_member_select ON public.event_itinerary_moments;
DROP POLICY IF EXISTS itinerary_editor_write ON public.event_itinerary_moments;
CREATE POLICY itinerary_member_select ON public.event_itinerary_moments
  FOR SELECT TO authenticated USING (public.is_event_member(event_id));
CREATE POLICY itinerary_editor_write ON public.event_itinerary_moments
  FOR ALL TO authenticated
  USING (public.is_event_editor(event_id))
  WITH CHECK (public.is_event_editor(event_id));

COMMIT;
```

- [ ] **Step 2: Confirmar el hallazgo del itinerario (§2 del spec)**

Antes de aplicar, confirmar de dónde se **escribe** `event_itinerary_moments`:
Run: `git -C <repo-main> grep -rn "event_itinerary_moments" -- app lib` (en `origin/main`, no solo en esta rama).
- Si se escribe desde el **cliente autenticado** (owner/editor) → la policy `itinerary_editor_write` lo cubre. OK.
- Si se escribe desde una **API con service role** → bypassa RLS igual. OK.
- Si aparece un **path anon directo** de escritura → ajustar el plan antes de aplicar.
Documentar el hallazgo en el commit.

- [ ] **Step 3: Commit del SQL**

```bash
git add docs/superpowers/plans/sql/2026-07-13-rls-holes.sql
git commit -m "feat(rls): migracion de cierre de los 4 hoyos (helpers + users/songs/audit/itinerario)"
```

- [ ] **Step 4: 🧑 CHECKPOINT Diego — aplicar la migración**

Con el código de Task 2 ya en `origin/main`, Diego corre `2026-07-13-rls-holes.sql` en Supabase.

---

## Task 4: Verificación de cierre

**Files:** ninguno (verificación).

**Interfaces:**
- Consumes: `scripts/rls-audit.mjs` (Task 1) + migración aplicada (Task 3).

- [ ] **Step 1: Re-correr el guardián — debe mostrar TODO CERRADO**

Run: `node --env-file=.env.local scripts/rls-audit.mjs`
Expected: `users`, `event_audit_log`, `event_itinerary_moments` salen **cerrado** (0 filas). Exit code 0. `song_recommendations` reporta solo canciones de eventos con playlist.

- [ ] **Step 2: Camino feliz manual (no debe romperse nada)**

Verificar en preview/prod:
- Guest list como **dueño** y como **colaborador**: carga, el nombre `{planner}` aparece en plantillas WhatsApp.
- **Playlist pública** (`/playlist/[token]`): un invitado sin login lee la lista y **agrega** una canción.
- **Invitación pública** (`/invitacion/[slug]/[token]`): el itinerario visible se muestra.
- **`/admin`**: el audit log de un evento se lee (como Diego).
- **Timeline / itinerario**: el planner ve y edita momentos.

- [ ] **Step 3: Cerrar la Fase 1**

- Actualizar la memoria `rls-appwide-epic` (Fase 1 EN PROD, pendiente Fase 2).
- Confirmar que la Fase 2 (higiene + tablas de Forms/notif) queda documentada en el spec §6 para retomarla.

---

## Self-Review (hecho)

- **Cobertura del spec:** los 4 hoyos (§5.1–5.4) → Tasks 2+3; guardián (§7) → Task 1; verificación y orden de deploy (§7) → checkpoints de Task 2/3 + Task 4; helpers (§4) → Task 3. Higiene (§6) y tablas nuevas quedan fuera de Fase 1 por diseño (§3). ✅
- **Placeholders:** sin TBD; todo el SQL y código están completos. ✅
- **Consistencia de tipos/nombres:** helpers `is_event_editor`/`is_platform_admin` y policies `songs_*`/`audit_*`/`itinerary_*` usados igual en migración y verificación. `planner_name` consistente entre SQL, `loadEvent` y `handleSaveProfile`. ✅
