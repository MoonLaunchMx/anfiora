# RLS app-wide — diseño del épico

**Fecha:** 2026-07-13
**Rama:** por definir (se creará de `main` en su propio worktree)
**Autor:** Diego + Claude (CTO partner)
**Estado:** diseño aprobado, pendiente de plan de implementación

---

## 1. Contexto y motivación

`NEXT_PUBLIC_SUPABASE_ANON_KEY` es público por diseño (viaja en el bundle). El modelo de
seguridad de Supabase asume que **RLS es la protección real**; el control de acceso a nivel
app (`useEventAccess`) lo respeta la UI pero **no la base de datos**. Quien extraiga el anon
key puede hablarle directo a Postgres con los permisos de `anon`/`authenticated`.

Este épico audita y cierra los huecos reales de RLS en las 25 tablas de producción, y deja
un patrón consistente y **auditable** con un guardián de verificación permanente.

**Principio rector (criterio CTO, firme):** la protección vive en Postgres. **No** se agrega
superficie de `service-role` para resolver lecturas cruzadas. El `service-role` apaga TODA la
RLS; cada endpoint nuevo con esa llave es otra superficie donde un error de validación filtra
tablas completas. `service-role` solo vive donde no hay `auth.uid()`: `/api/webhook/*` y las
páginas públicas por token (`playlist/[token]`, `invitacion`, `mesa`).

---

## 2. Estado actual real (auditoría)

Confirmado con dos consultas read-only a producción el 2026-07-13. La nota previa del épico
estaba **muy desactualizada**: casi todo ya tiene RLS. De 25 tablas, **21 correctas**,
**4 con problemas reales**.

### 🔴 Hoyos reales

| # | Tabla | Problema |
|---|---|---|
| 1 | `users` | Policy `"Admin can read all users"` = `SELECT {public} USING (true)` → **cualquier anon lee toda la tabla `users`** (email, teléfono, nombre, plan, datos de adquisición). El panel admin ya lee por service role, así que la policy es innecesaria además de peligrosa. |
| 2 | `song_recommendations` | Las 6 policies usan `true` (anon+authenticated select/insert). Cualquier anon lee las playlists y nombres de invitados de **todos** los eventos e inserta filas en cualquiera. Incluye 3 policies duplicadas. |
| 3 | `event_audit_log` | **Sin RLS.** Anon lee/escribe la bitácora completa (correos, acciones). |
| 4 | `event_itinerary_moments` | **Sin RLS.** Anon lee/escribe itinerarios. |

### 🟡 Observaciones

- `webhook_events`: RLS activo, **0 policies** → default-deny, solo service role entra. Correcto e intencional (lo escribe el webhook). Se deja igual.
- ~18 policies usan el rol `{public}` con predicados que referencian `auth.uid()`. Hoy son
  seguras (para anon, `auth.uid()` es NULL y no devuelve filas), pero es frágil confiar en
  ese truco. Se normalizan a `{authenticated}`.
- Varias tablas repiten el mismo subquery `... UNION SELECT event_collaborators ...` copiado
  a mano en 15+ policies. Se centraliza en un helper.
- Policies redundantes (ej. `guests` tiene la de solo-dueño **y** la de colaborador que ya la
  incluye). Se consolidan.

### Rutas de acceso confirmadas en código

- **Nombre del planner** (`events/[id]/page.tsx:825`): lee `users.full_name` de otro usuario
  con el cliente del browser. Solo alimenta la variable `{planner}` de plantillas WhatsApp
  (línea 1071) — es un **nombre de adorno**. Lo ve el dueño (su propio nombre) y los
  colaboradores (nombre del dueño).
- **`/api/admin/users`**: usa `SERVICE_ROLE_KEY` → no depende de la policy `true` de `users`.
- **Audit log**: lo **escribe el navegador** del usuario autenticado (`lib/audit.ts` →
  `logAction`), y solo lo **lee el admin** en `/admin` (gateado a `ADMIN_EMAIL =
  'diego.garza@moonlaunch.mx'`, cliente del browser).
- **Playlist pública** (`playlist/[token]/page.tsx`): lee (104, 136) e inserta (223)
  `song_recommendations` con el cliente anon. **No borra.**
- **Invitación pública**: lee `event_itinerary_moments` vía `/api/invitacion/[token]` con
  **service role** (seguro ante RLS).
- **Itinerario — hallazgo a confirmar:** el código que *escribe* `event_itinerary_moments`
  **no aparece en la rama actual** (`feat/forms`). Puede estar sin mergear o la nota está
  vieja. La policy de miembro cubre la escritura igual; confirmar al implementar para no
  verificar a ciegas.

---

## 3. Alcance y secuencia (decisión 2026-07-13)

Hay tres streams tocando la misma base de producción: **Forms** (mergeándose), **notificaciones
por invitación** (en diseño) y este épico. Para no reescribir policies dos veces ni meter una
reescritura grande en medio de tres streams, el épico se parte por **urgencia**:

### Fase 1 — AHORA (este épico): tapar los 4 hoyos
Los 4 hoyos están **aislados** y no tocan tablas de Forms ni de notificaciones. Cierran toda la
exposición real de PII de un jalón, con riesgo bajo.
- Cerrar `users`, `song_recommendations`, `event_audit_log`, `event_itinerary_moments`.
- Helpers nuevos necesarios (`is_event_editor`, `is_platform_admin`).
- Denormalización de `events.planner_name` + código asociado.
- Script de verificación (`scripts/rls-audit.mjs`) como guardián permanente.

### Fase 2 — DESPUÉS (épico separado, cuando Forms + notificaciones estén listos)
Una sola pasada consolidada sobre el esquema ya estable:
- Higiene completa: helpers centralizados en las ~21 tablas ya correctas,
  `{public}`→`{authenticated}`, dedupe de policies redundantes. Semántica idéntica.
- RLS de las tablas nuevas de **Forms** (`forms`/`form_responses`, anon-insert-por-token) y de
  **notificaciones**, siguiendo el mismo patrón.

**Por qué esperar la higiene es *más inteligente*, no solo más seguro:** Forms y notificaciones
agregan tablas nuevas que también necesitan RLS. Hacer la higiene ahora = rehacerla al aterrizar
esas features. Consolidar = una pasada limpia sobre un esquema que ya no se mueve. El diseño de
la higiene queda documentado en §6 para retomarlo tal cual.

**Fuera (permanente):**
- Column-level security (RLS es row-level; no se persigue ocultar columnas sueltas).
- Migrar el audit log fuera del super-admin (deuda separada).
- Cambiar el modelo de auth de localStorage a cookies.

---

## 4. Helpers (funciones `SECURITY DEFINER`)

Las `SECURITY DEFINER` evalúan sin RLS, rompen recursión y centralizan la lógica de acceso.

**Ya existen** (creadas en `anf-052`/`anf-053`):
- `is_event_owner(eid)` — `events.user_id = auth.uid()`
- `is_event_member(eid)` — owner **o** colaborador activo
- `is_event_admin(eid)` — owner **o** colaborador activo con rol `admin`
- `event_has_playlist_token(eid)` — el evento tiene `playlist_token`

**Nuevos:**
- `is_event_editor(eid)` — owner **o** colaborador activo con rol `admin`/`editor`. Reemplaza
  el subquery `... UNION ... role = ANY(ARRAY['admin','editor'])` repetido a mano.
  ```sql
  CREATE OR REPLACE FUNCTION public.is_event_editor(eid uuid)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM events WHERE id = eid AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM event_collaborators
                   WHERE event_id = eid AND user_id = auth.uid()
                     AND status = 'active' AND role IN ('admin','editor'));
  $$;
  ```
- `is_platform_admin()` — para leer el audit log. **Espeja exactamente el gate actual de la
  app**, que es por correo (`ADMIN_EMAIL = 'diego.garza@moonlaunch.mx'` en `app/admin/page.tsx`).
  Ojo: `users.role` **no** sirve para esto — es el rol profesional del onboarding (planner,
  etc.), no una bandera de admin. Se usa el claim de correo del JWT:
  ```sql
  CREATE OR REPLACE FUNCTION public.is_platform_admin()
  RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
  SET search_path = public AS $$
    SELECT (auth.jwt() ->> 'email') = 'diego.garza@moonlaunch.mx';
  $$;
  ```
  Deuda menor: cuando el admin deje de ser un solo correo, cambiar a una columna
  `users.is_platform_admin boolean`. Por ahora, mirror del correo = cero superficie nueva.

---

## 5. Diseño por tabla — los 4 hoyos

### 5.1 `users` (denormalización — Opción 4)

Migración de datos + código (orden en §7):
1. `ALTER TABLE events ADD COLUMN planner_name text;`
2. Backfill: `UPDATE events e SET planner_name = u.full_name FROM users u WHERE u.id = e.user_id;`
3. Código: `events/[id]/page.tsx` lee `planner_name` de la fila del evento (ya legible por
   dueño y colaboradores vía RLS de `events`). Se elimina la query a `users` de la línea 825.
4. `/perfil`: al guardar `full_name`, actualizar también `events.planner_name` de los eventos
   propios (mantener el nombre fresco).
5. **Solo después de desplegar el código:** `DROP POLICY "Admin can read all users" ON users;`

Estado final de `users`: solo `users_select_own` (`auth.uid() = id`) y `users_update_own`.
Tabla blindada a fila propia. El admin sigue leyendo todo vía service role.

### 5.2 `song_recommendations`

Borrar las 6 policies actuales. Estado objetivo:
```sql
-- Público (página playlist por token): leer + agregar, solo eventos con playlist activa
CREATE POLICY songs_anon_select ON song_recommendations
  FOR SELECT TO anon USING (public.event_has_playlist_token(event_id));
CREATE POLICY songs_anon_insert ON song_recommendations
  FOR INSERT TO anon WITH CHECK (public.event_has_playlist_token(event_id));

-- Planner/equipo: leer del evento del que son miembros, escribir si son editores
CREATE POLICY songs_member_select ON song_recommendations
  FOR SELECT TO authenticated USING (public.is_event_member(event_id));
CREATE POLICY songs_editor_write ON song_recommendations
  FOR ALL TO authenticated
  USING (public.is_event_editor(event_id))
  WITH CHECK (public.is_event_editor(event_id));
```
**Tradeoff aceptado:** anon puede leer/insertar en cualquier evento *con playlist activa* (no
solo el del token que tiene), igual que el patrón existente de `events`. RLS no ve el token en
la sesión; el anti-abuso real es el límite de 3 canciones (app) + moderación manual. Es
estrictamente más cerrado que el `true` de hoy.

### 5.3 `event_audit_log`

```sql
ALTER TABLE event_audit_log ENABLE ROW LEVEL SECURITY;

-- Escribe el usuario que actúa (cliente del browser), solo en eventos de los que es miembro
CREATE POLICY audit_member_insert ON event_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_event_member(event_id));

-- Lee solo el admin de plataforma (feature de super-admin en /admin)
CREATE POLICY audit_admin_select ON event_audit_log
  FOR SELECT TO authenticated USING (public.is_platform_admin());
-- Sin UPDATE/DELETE → la bitácora es inmutable desde el cliente.
```

### 5.4 `event_itinerary_moments`

```sql
ALTER TABLE event_itinerary_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY itinerary_member_select ON event_itinerary_moments
  FOR SELECT TO authenticated USING (public.is_event_member(event_id));
CREATE POLICY itinerary_editor_write ON event_itinerary_moments
  FOR ALL TO authenticated
  USING (public.is_event_editor(event_id))
  WITH CHECK (public.is_event_editor(event_id));
-- Lectura pública sigue por service role (/api/invitacion/[token]) → bypassa RLS.
```
Confirmar en implementación de dónde se escribe (ver §2, hallazgo).

---

## 6. Diseño de la pasada de higiene — FASE 2 (diferida)

> **Diferida a Fase 2** (ver §3). Se documenta aquí completa para retomarla tal cual cuando
> Forms y notificaciones aterricen. No se ejecuta en Fase 1.

Transformación mecánica, **semántica idéntica**, aplicada a las ~21 tablas ya correctas:

1. **Rol:** toda policy `{public}` cuyo predicado dependa de `auth.uid()` pasa a
   `{authenticated}`. (Excepción: policies genuinamente anon por token — `events`,
   `event_settings`, `song_recommendations` — se quedan explícitas en `anon`.)
2. **Helpers:** todo subquery inline de ownership/colaboración se reemplaza por el helper
   correspondiente:
   - lectura por miembro → `is_event_member(event_id)`
   - escritura por editor → `is_event_editor(event_id)`
   - solo dueño → `is_event_owner(event_id)`
   Tablas afectadas: `guests`, `party_members`, `tables`, `table_seats`, `event_budgets`,
   `event_suppliers`, `supplier_payments`, `gift_registry_items`, `gift_reservations`,
   `event_timeline_tasks`, `wa_messages`, y las omnicanal (`channel_accounts`,
   `channel_participants`, `conversations`, `messages`) que usan `workspace_id = auth.uid()`.
3. **Dedupe:** eliminar policies solo-dueño superseded por su equivalente de colaborador
   (ej. `guests` "Users can view/insert/update/delete" quedan cubiertas por las
   "collaborators can ...").
4. **Naming:** convención consistente `{tabla}_{rol}_{accion}`.

Cada cambio de esta pasada preserva exactamente qué filas ve/escribe cada usuario; solo cambia
la forma. Se verifica con el mismo script (§7) más pruebas de camino feliz autenticado.

---

## 7. Verificación y despliegue

### Guardián de verificación — `scripts/rls-audit.mjs`
Script Node repetible que usa el **anon key** (llave pública) e **intenta los ataques**:
- Leer toda la tabla `users` → debe devolver 0 filas / error.
- Leer `guests`/`song_recommendations`/`supplier_payments`/`event_budgets` sin sesión → 0.
- Leer `event_audit_log` sin ser admin → 0.
- Insertar en un evento ajeno → denegado.

Se corre **antes** (documenta el hoyo abierto) y **después** (confirma cierre). Es read-only
salvo los intentos de insert que deben fallar. Queda como **guardián permanente** contra
regresiones (se puede correr en cada deploy). Complemento: prueba de camino feliz con un
usuario de prueba autenticado (leer sus propios datos sí funciona).

### Orden de despliegue — Fase 1 (regla sagrada: código antes que SQL)
Una sola migración de hoyos, en orden seguro (no cambios a ciegas):
1. `ALTER TABLE events ADD COLUMN planner_name` + backfill (inocuo, se puede correr antes).
2. **Push** del código: leer `planner_name` del evento, `/perfil` lo actualiza.
3. SQL: helpers nuevos (`is_event_editor`, `is_platform_admin`) + `DROP` policy `true` de
   `users` + reescribir `song_recommendations` + RLS de `event_audit_log` y
   `event_itinerary_moments`.
4. Correr `rls-audit.mjs` → confirmar cierre. Verificar caminos: playlist pública, invitación,
   admin, guest list.

SQL idempotente (`DROP POLICY IF EXISTS` / `CREATE OR REPLACE`) envuelto en `BEGIN/COMMIT`.

**Fase 2 (diferida):** la migración de higiene + RLS de tablas nuevas se despliega igual
(código antes que SQL, `rls-audit.mjs` + camino feliz, local → preview → main) cuando Forms y
notificaciones estén listos.

---

## 8. Riesgos y dependencias

- **Producción única, sin staging.** Mitigación: `rls-audit.mjs` + secuencia en dos
  migraciones + `BEGIN/COMMIT` + verificar preview antes de main.
- **Reescritura de policies que hoy funcionan** (higiene) es el mayor riesgo/recompensa.
  Mitigación: va en Migración B, después de cerrar lo urgente; semántica preservada y
  verificada tabla por tabla.
- **`forms`/`form_responses`** (rama `feat/forms`): al aterrizar necesitan RLS con
  anon-insert-por-token (registro) y read del panel por miembro. Este épico define el patrón;
  coordinar el merge para no chocar. No bloquea este épico.
- **Itinerario:** confirmar ruta de escritura antes de verificar (§2).
- **Admin por correo:** `is_platform_admin()` hardcodea el correo de Diego para espejar el
  gate actual de `/admin`. Si en el futuro hay más admins, migrar a columna dedicada.

---

## 9. Criterios de éxito

**Fase 1 (este épico):**
1. `rls-audit.mjs` pasa: ningún ataque anon devuelve datos ni escribe en los 4 hoyos.
2. Todos los caminos felices siguen funcionando: guest list (dueño y colaborador), playlist
   pública, invitación pública, admin, itinerario, presupuesto, proveedores, pagos.
3. `users` blindada a fila propia; `song_recommendations` acotada por token; audit log e
   itinerario con RLS. Cero `USING (true)` salvo los inserts anon genuinos por token acotados
   por `event_has_playlist_token`.
4. El patrón queda documentado y reproducible (base para Fase 2 y para Forms/notif).

**Fase 2 (diferida):**
5. Toda policy de las ~21 tablas usa un helper; rol `authenticated`/`anon` explícito; sin
   policies redundantes. Tablas de Forms y notificaciones cubiertas.
