# Aterrizaje Nucleo Omnicanal v1 (lado-escritura) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar viva en produccion la fundacion canonica omnicanal (5 tablas) con WhatsApp como primer adaptador via dual-write, sin romper el flujo WA actual ni regresar el push.

**Architecture:** Cherry-pick selectivo del nucleo (NO merge de `feature/whatsapp-ia`, que esta divergida y arrastraria el agente IA + regresaria el push). Se traen los archivos nuevos del nucleo (espejo + backfill + SQL) y se re-engancha el espejo en el webhook ACTUAL de main, corriendolo con `after()` para no sumar latencia a la respuesta de Twilio. El espejo es fail-silent: si el SQL no esta aplicado o algo falla, solo loguea y el webhook sigue.

**Tech Stack:** Next.js 16 (App Router, `after()` de `next/server`) + Supabase (service role) + WhatsApp/Twilio.

## Global Constraints

- Codigo completo, nunca fragmentos. Full file replacement, no edits parciales.
- Sin tests automatizados (no hay suite; regla MVP). Verificacion = `npm run build` + prueba manual en prod.
- UI/copy en espanol CON acentos, sin emojis. Commits SIN acentos ni n. Terminar commits con la linea `Co-Authored-By` del harness.
- NUNCA `git push` a main sin OK de Diego. NUNCA tocar Supabase (schema/datos/RLS) antes de pushear el codigo correspondiente.
- Dedupe SIEMPRE por id de fila, nunca sintetizado de datos de negocio: el `provider_message_id` canonico se deriva de `wa_messages.id` (`wa:<id>`), identico en vivo y en backfill, para idempotencia airtight.
- NO mergear `feature/whatsapp-ia`: esta 3 semanas divergida, no tiene el push de main, y reemplazaria el webhook por el del agente IA (diferido + bloqueado por verificacion Meta).
- El espejo corre con `after()`: nunca en el hot-path sincrono del webhook (riesgo de timeout de Twilio).
- `event_collaborators.status` aceptado = `'active'` en este repo (NO `'accepted'`). El `anfiora.sql` original trae `'accepted'` — se corrige a `'active'`.

---

## File Structure

| Archivo | Accion | Responsabilidad |
|---|---|---|
| `lib/whatsapp/canonical-mirror.ts` | Create | Espejo fail-silent de WhatsApp al modelo canonico (mirrorInbound/mirrorOutbound). Autocontenido. |
| `app/api/admin/backfill-canonical/route.ts` | Create | Backfill idempotente de `wa_messages` -> canonico (POST, secreto en header). |
| `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/core.sql` | Create | DDL agnostico: 5 tablas + indices + enable RLS. |
| `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/anfiora.sql` | Create | Acoplamiento de dominio: FK/columnas/CHECK/indices/RLS (con fix status='active'). |
| `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/design.md` | Create | El plano (referencia). |
| `app/api/webhook/whatsapp/route.ts` | Modify | Capturar id de los insert a `wa_messages` y disparar el espejo con `after()`. |

---

## Task 1: Traer el codigo del nucleo (archivos nuevos, sin conflicto)

**Files:**
- Create: `lib/whatsapp/canonical-mirror.ts`
- Create: `app/api/admin/backfill-canonical/route.ts`
- Create: `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/core.sql`
- Create: `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/anfiora.sql`
- Create: `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/design.md`

**Interfaces:**
- Produces:
  - `mirrorInbound(supabase, { guest: { id, name, event_id }, phone, text, sid, waMessageId, createdAt }): Promise<void>`
  - `mirrorOutbound(supabase, { to, guestId, eventId, text, author, status, sid, waMessageId, createdAt }): Promise<void>`
  - `POST /api/admin/backfill-canonical` (header `x-backfill-secret` = `SUPABASE_SERVICE_ROLE_KEY`).

- [ ] **Step 1: Traer los 3 archivos de docs verbatim desde la rama**

```bash
cd "C:/Users/diego/Documents/anfiora"
mkdir -p docs/superpowers/specs/2026-06-24-nucleo-omnicanal
git show origin/feature/whatsapp-ia:docs/superpowers/specs/2026-06-24-nucleo-omnicanal/design.md > docs/superpowers/specs/2026-06-24-nucleo-omnicanal/design.md
git show origin/feature/whatsapp-ia:docs/superpowers/specs/2026-06-24-nucleo-omnicanal/core.sql > docs/superpowers/specs/2026-06-24-nucleo-omnicanal/core.sql
```

- [ ] **Step 2: Crear `anfiora.sql` con el fix de status**

Traer `anfiora.sql` verbatim PERO cambiando las dos apariciones de `status = 'accepted'` por `status = 'active'` en las politicas `cv_collaborator` y `ms_collaborator`. El archivo final es identico al de la rama salvo esas dos lineas. Contenido completo:

```sql
-- =============================================================================
-- anfiora.sql  ·  Acoplamiento de dominio (SOLO Anfiora)
-- Se aplica DESPUES de core.sql.
-- =============================================================================

-- 1) FKs de las columnas intrinsecas del nucleo
alter table channel_accounts
  add constraint fk_ca_workspace foreign key (workspace_id) references users(id) on delete cascade;
alter table channel_participants
  add constraint fk_cp_workspace foreign key (workspace_id) references users(id) on delete cascade;
alter table conversations
  add constraint fk_cv_workspace foreign key (workspace_id)     references users(id) on delete cascade,
  add constraint fk_cv_assignee  foreign key (assigned_user_id) references users(id) on delete set null;
alter table messages
  add constraint fk_ms_workspace foreign key (workspace_id)   references users(id) on delete cascade,
  add constraint fk_ms_author    foreign key (author_user_id) references users(id) on delete set null;

-- 2) Vinculos de dominio en la conversacion
alter table conversations
  add column tenant_id           uuid,
  add column contact_guest_id    uuid,
  add column contact_supplier_id uuid;

alter table conversations
  add constraint fk_cv_tenant   foreign key (tenant_id)           references events(id)    on delete set null,
  add constraint fk_cv_guest    foreign key (contact_guest_id)    references guests(id)    on delete set null,
  add constraint fk_cv_supplier foreign key (contact_supplier_id) references suppliers(id) on delete set null;

alter table conversations
  add constraint chk_cv_contact_xor
  check (not (contact_guest_id is not null and contact_supplier_id is not null));

-- 3) Indices de dominio
create index on conversations (tenant_id, status, last_message_at desc);
create index on conversations (contact_supplier_id) where contact_supplier_id is not null;
create index on conversations (contact_guest_id)    where contact_guest_id    is not null;

-- 4) RLS de dominio: dueno del evento + colaborador
-- (auth.uid() = users.id en Anfiora. status aceptado = 'active' en este repo.)

create policy ca_owner on channel_accounts     for all using (workspace_id = auth.uid());
create policy cp_owner on channel_participants for all using (workspace_id = auth.uid());
create policy ms_owner on messages             for all using (workspace_id = auth.uid());

create policy cv_owner on conversations for all
  using (workspace_id = auth.uid());

create policy cv_collaborator on conversations for select
  using (
    tenant_id in (
      select event_id from event_collaborators
      where user_id = auth.uid() and status = 'active'
    )
    or contact_supplier_id in (
      select es.supplier_id
      from event_suppliers es
      join event_collaborators ec on ec.event_id = es.event_id
      where ec.user_id = auth.uid() and ec.status = 'active'
    )
  );

create policy ms_collaborator on messages for select
  using (
    conversation_id in (
      select id from conversations
      where tenant_id in (
        select event_id from event_collaborators
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

-- webhook_events: sin politica -> solo service_role.
```

- [ ] **Step 3: Traer `canonical-mirror.ts` verbatim desde la rama**

```bash
git show origin/feature/whatsapp-ia:lib/whatsapp/canonical-mirror.ts > lib/whatsapp/canonical-mirror.ts
```

Verificar que el archivo exporta `mirrorInbound` y `mirrorOutbound`, que es fail-silent (try/catch que solo loguea), y que el `provider_message_id` se deriva como `p.sid ?? `wa:${p.waMessageId}`` (dedupe por id de fila).

- [ ] **Step 4: Traer `backfill-canonical/route.ts` verbatim desde la rama**

```bash
mkdir -p app/api/admin/backfill-canonical
git show origin/feature/whatsapp-ia:app/api/admin/backfill-canonical/route.ts > app/api/admin/backfill-canonical/route.ts
```

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: build OK. La ruta `/api/admin/backfill-canonical` aparece en el listado. Sin errores de tipo (el mirror solo importa `SupabaseClient` de `@supabase/supabase-js`, ya instalado).

- [ ] **Step 6: Commit**

```bash
git add lib/whatsapp/canonical-mirror.ts app/api/admin/backfill-canonical/route.ts docs/superpowers/specs/2026-06-24-nucleo-omnicanal/
git commit -m "feat(omnicanal): trae nucleo canonico (espejo + backfill + sql) sin enganchar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Enganchar el espejo en el webhook actual de main (via after())

**Files:**
- Modify: `app/api/webhook/whatsapp/route.ts`

**Interfaces:**
- Consumes: `mirrorInbound`, `mirrorOutbound` (Task 1); `after` de `next/server`.
- Produces: dual-write canonico en vivo desde el webhook de produccion, fuera del hot-path.

**Contexto:** el webhook actual de main hace (1) insert inbound a `wa_messages` (`direction:'received'`), (2) si la interpretacion es clara, genera reply, inserta outbound a `wa_messages` (`direction:'sent'`), envia por Twilio, y dispara el push agrupado. Hay que capturar el `id` de cada insert y espejar con `after()`. Ninguno de los dos insert captura hoy el id.

- [ ] **Step 1: Agregar imports**

Tras la linea `import { sendPushToUsers, resolveEventRecipients } from '@/lib/push'`, agregar:

```ts
import { after } from 'next/server'
import { mirrorInbound, mirrorOutbound } from '@/lib/whatsapp/canonical-mirror'
```

- [ ] **Step 2: Capturar el id del insert inbound y espejar**

Reemplazar el bloque actual del insert inbound:

```ts
    const { error: insertInboundError } = await supabase.from('wa_messages').insert({
      guest_id:   guest.id,
      event_id:   guest.event_id,
      direction:  'received',
      content:    text,
      created_at: new Date().toISOString(),
    })
    console.log('[DB] Insert inbound:', insertInboundError ? JSON.stringify(insertInboundError) : 'OK')
```

por:

```ts
    const inboundAt = new Date().toISOString()
    const { data: inboundRow, error: insertInboundError } = await supabase
      .from('wa_messages')
      .insert({
        guest_id:   guest.id,
        event_id:   guest.event_id,
        direction:  'received',
        content:    text,
        created_at: inboundAt,
      })
      .select('id')
      .maybeSingle()
    console.log('[DB] Insert inbound:', insertInboundError ? JSON.stringify(insertInboundError) : 'OK')

    if (inboundRow?.id) {
      after(() =>
        mirrorInbound(supabase, {
          guest: { id: guest.id, name: guestName, event_id: guest.event_id },
          phone,
          text,
          sid: null,
          waMessageId: inboundRow.id,
          createdAt: inboundAt,
        })
      )
    }
```

- [ ] **Step 3: Capturar el id del insert outbound y espejar**

Reemplazar el bloque actual del insert outbound:

```ts
      const { error: insertOutboundError } = await supabase.from('wa_messages').insert({
        guest_id:   guest.id,
        event_id:   guest.event_id,
        direction:  'sent',
        content:    replyText,
        created_at: new Date().toISOString(),
      })
      console.log('[DB] Insert outbound:', insertOutboundError ? JSON.stringify(insertOutboundError) : 'OK')

      await sendWhatsAppReply(from, replyText)
```

por:

```ts
      const outboundAt = new Date().toISOString()
      const { data: outboundRow, error: insertOutboundError } = await supabase
        .from('wa_messages')
        .insert({
          guest_id:   guest.id,
          event_id:   guest.event_id,
          direction:  'sent',
          content:    replyText,
          created_at: outboundAt,
        })
        .select('id')
        .maybeSingle()
      console.log('[DB] Insert outbound:', insertOutboundError ? JSON.stringify(insertOutboundError) : 'OK')

      if (outboundRow?.id) {
        after(() =>
          mirrorOutbound(supabase, {
            to: from,
            guestId: guest.id,
            eventId: guest.event_id,
            text: replyText,
            author: 'ia',
            status: 'sent',
            sid: null,
            waMessageId: outboundRow.id,
            createdAt: outboundAt,
          })
        )
      }

      await sendWhatsAppReply(from, replyText)
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build OK, sin errores de tipo. El webhook sigue compilando con `after()` importado de `next/server`.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhook/whatsapp/route.ts
git commit -m "feat(omnicanal): dual-write del webhook whatsapp al modelo canonico via after

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Despliegue, SQL y verificacion (checkpoint con Diego)

**Files:** ninguno (operativo).

- [ ] **Step 1: Push + PR (con OK de Diego)**

```bash
git push -u origin feature/omnichannel-core-v1
gh pr create --base main --head feature/omnichannel-core-v1 --title "feat(omnicanal): nucleo canonico v1 lado-escritura (WhatsApp dual-write)" --body "<resumen>"
```

- [ ] **Step 2: Diego aplica el SQL en Supabase (DESPUES del merge)**

En el SQL Editor, en orden:
1. `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/core.sql` (crea las 5 tablas).
2. `docs/superpowers/specs/2026-06-24-nucleo-omnicanal/anfiora.sql` (FK + columnas + CHECK + RLS, con `status = 'active'`).

Expected: 5 tablas nuevas (`channel_accounts`, `channel_participants`, `conversations`, `messages`, `webhook_events`).

- [ ] **Step 3: Verificar dual-write en vivo sin romper WA**

1. Mandar un WhatsApp de prueba de un invitado registrado (o el flujo real cuando exista) que dispare una respuesta del agente.
2. Confirmar que el flujo WA sigue: `wa_messages` recibe inbound + outbound, `guests.rsvp_status` se actualiza, el push agrupado llega.
3. Confirmar en Supabase que aparecieron filas canonicas:
```sql
select c.id, c.tenant_id, c.contact_guest_id, c.last_message_at,
       (select count(*) from messages m where m.conversation_id = c.id) as msgs
from conversations c
order by c.last_message_at desc nulls last
limit 10;
```
Expected: 1 conversacion por (evento, telefono) con sus mensajes inbound/outbound.

- [ ] **Step 4: Backfill de lo historico**

Una vez verificado el dual-write en vivo, correr el backfill (lo lanza Diego con su service role key):

```bash
curl -X POST "https://anfiora.com/api/admin/backfill-canonical" -H "x-backfill-secret: <SUPABASE_SERVICE_ROLE_KEY>"
```

Expected: `{ ok: true, processed: <n> }`. Re-ejecutable sin duplicar (dedupe por `channel_account_id, provider_message_id` con `provider_message_id = wa:<wa_messages.id>`).

- [ ] **Step 5: Verificar idempotencia del backfill**

Correr el backfill una segunda vez.
Expected: `processed` similar, pero el conteo de `messages` en Supabase NO crece (los upsert con `ignoreDuplicates` no insertan de nuevo).

```sql
select count(*) from messages;
```

---

## Self-Review (cobertura del spec, v1 lado-escritura)

- 5 tablas canonicas -> Task 1 (core.sql) + Task 3 (aplicacion).
- Frontera nucleo/dominio (FK/RLS en anfiora.sql) -> Task 1 (con fix status='active') + Task 3.
- WhatsApp como primer adaptador via dual-write -> Task 2 (espejo enganchado al webhook real, via after()).
- No romper prod WA -> espejo fail-silent + `after()` fuera del hot-path; el flujo WA y el push quedan intactos (Task 2 conserva todo).
- Backfill idempotente -> Task 1 (codigo) + Task 3 (ejecucion + verificacion de idempotencia).
- Dedupe por id de fila -> `provider_message_id = wa:<id>`, identico en vivo y backfill (sid=null en ambos).
- NO arrastrar el agente IA ni regresar push -> cherry-pick selectivo, NO merge de la rama.
- Fuera de alcance (fases siguientes): adaptadores IN/OUT genericos, `webhook_events` (aterrizaje crudo + sweeper), Telegram (v2), inbox UI (v4), relocalizar el disparador de push al normalizador, cifrado de credenciales WA.
