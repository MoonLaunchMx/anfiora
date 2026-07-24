# Borrar invitado con conversación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que borrar un invitado funcione de verdad (limpiando sus datos en orden), preguntando qué hacer con su chat cuando tiene uno, y sin mentir en la UI si la base rechaza.

**Architecture:** Un helper compartido borra al invitado y sus hijos en orden de dependencia (hijos antes que el invitado), decidiendo la conversación por modo: `unlink` (desvincular, conservar historial) o `purge` (borrar chat y mensajes). La construcción de la secuencia de borrado es una función pura testeable; la ejecución (Supabase) verifica el error de cada paso. El borrado individual muestra un modal cuando el invitado tiene chat; el bulk usa `unlink` por defecto.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (browser client), Vitest.

## Global Constraints

- **Sin DDL / sin SQL:** el borrado limpia los hijos en orden desde el codigo; funciona con cualquier config de FK. No se tocan constraints. (Decision: mas seguro que cirugia de FK en prod.)
- "Chat" = el invitado tiene una `conversations` con **al menos un** `messages`. (Spec)
- Individual con chat -> modal "Conservar chat" (unlink) / "Eliminar tambien el chat" (purge). Sin chat -> borra directo (con el confirm actual). (Spec)
- **Verificar el error de cada borrado; solo quitar de la UI si la base confirmo.** Fin del borrado optimista que miente. (Spec)
- El invitado (`guests`) se borra SIEMPRE al final (despues de sus hijos). (Spec)
- Tablas hijas por `guest_id`: `party_members`, `table_seats`, `wa_messages`, `song_recommendations`. Conversacion por `contact_guest_id` en `conversations`; `messages` cuelga de `conversations` (borrar mensajes antes que la conversacion en modo purge).
- Tests Vitest para la logica pura (`buildGuestDeletionOps`); helpers I/O y UI se verifican manual. UI con acentos, sin emojis. Commits SIN acentos ni ñ. Nunca push/merge sin OK. Claude no toca Supabase.

---

### Task 1: Helper de borrado — secuencia pura + ejecutor I/O

**Files:**
- Create: `lib/guests/delete.ts`
- Test: `lib/guests/delete.test.ts`

**Interfaces:**
- Produces:
  - `type DeleteOp` y `type ConversationMode = 'unlink' | 'purge'`
  - `buildGuestDeletionOps(guestId: string, conversationIds: string[], mode: ConversationMode): DeleteOp[]` (pura)
  - `guestConversationIds(supabase, guestId): Promise<string[]>` (I/O)
  - `guestHasChat(supabase, guestId): Promise<boolean>` (I/O)
  - `executeGuestDeletion(supabase, ops: DeleteOp[]): Promise<{ ok: boolean; error: string | null }>` (I/O)

- [ ] **Step 1: Escribir el test que falla** — `lib/guests/delete.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { buildGuestDeletionOps } from './delete'

describe('buildGuestDeletionOps', () => {
  it('unlink: borra hijos propios, desvincula la conversacion y borra al invitado AL FINAL', () => {
    const ops = buildGuestDeletionOps('g1', ['c1'], 'unlink')
    expect(ops.map(o => `${o.kind}:${o.table}`)).toEqual([
      'deleteEq:party_members', 'deleteEq:table_seats', 'deleteEq:wa_messages', 'deleteEq:song_recommendations',
      'unlinkEq:conversations',
      'deleteEq:guests',
    ])
    expect(ops[ops.length - 1]).toEqual({ kind: 'deleteEq', table: 'guests', column: 'id', value: 'g1' })
  })
  it('purge: borra mensajes ANTES que las conversaciones, e invitado al final', () => {
    const ops = buildGuestDeletionOps('g1', ['c1', 'c2'], 'purge')
    const kinds = ops.map(o => `${o.kind}:${o.table}`)
    expect(kinds).toEqual([
      'deleteEq:party_members', 'deleteEq:table_seats', 'deleteEq:wa_messages', 'deleteEq:song_recommendations',
      'deleteIn:messages', 'deleteIn:conversations',
      'deleteEq:guests',
    ])
    const msgs = ops.find(o => o.table === 'messages')
    expect(msgs).toEqual({ kind: 'deleteIn', table: 'messages', column: 'conversation_id', values: ['c1', 'c2'] })
  })
  it('purge sin conversaciones: no incluye ops de messages/conversations', () => {
    const ops = buildGuestDeletionOps('g1', [], 'purge')
    expect(ops.some(o => o.table === 'messages' || o.table === 'conversations')).toBe(false)
    expect(ops[ops.length - 1].table).toBe('guests')
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- delete`
Expected: FAIL (`Cannot find module './delete'`).

- [ ] **Step 3: Implementar `lib/guests/delete.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type ConversationMode = 'unlink' | 'purge'

export type DeleteOp =
  | { kind: 'deleteEq'; table: string; column: string; value: string }
  | { kind: 'deleteIn'; table: string; column: string; values: string[] }
  | { kind: 'unlinkEq'; table: string; column: string; value: string }

const OWNED_TABLES = ['party_members', 'table_seats', 'wa_messages', 'song_recommendations']

export function buildGuestDeletionOps(guestId: string, conversationIds: string[], mode: ConversationMode): DeleteOp[] {
  const ops: DeleteOp[] = []
  for (const table of OWNED_TABLES) ops.push({ kind: 'deleteEq', table, column: 'guest_id', value: guestId })
  if (mode === 'purge') {
    if (conversationIds.length > 0) {
      ops.push({ kind: 'deleteIn', table: 'messages', column: 'conversation_id', values: conversationIds })
      ops.push({ kind: 'deleteIn', table: 'conversations', column: 'id', values: conversationIds })
    }
  } else {
    ops.push({ kind: 'unlinkEq', table: 'conversations', column: 'contact_guest_id', value: guestId })
  }
  ops.push({ kind: 'deleteEq', table: 'guests', column: 'id', value: guestId })
  return ops
}

export async function guestConversationIds(supabase: SupabaseClient, guestId: string): Promise<string[]> {
  const { data } = await supabase.from('conversations').select('id').eq('contact_guest_id', guestId)
  return (data ?? []).map((c) => c.id as string)
}

export async function guestHasChat(supabase: SupabaseClient, guestId: string): Promise<boolean> {
  const ids = await guestConversationIds(supabase, guestId)
  if (ids.length === 0) return false
  const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).in('conversation_id', ids)
  return (count ?? 0) > 0
}

export async function executeGuestDeletion(supabase: SupabaseClient, ops: DeleteOp[]): Promise<{ ok: boolean; error: string | null }> {
  for (const op of ops) {
    let error: { message: string } | null = null
    if (op.kind === 'deleteEq') {
      ({ error } = await supabase.from(op.table).delete().eq(op.column, op.value))
    } else if (op.kind === 'deleteIn') {
      if (op.values.length === 0) continue
      ({ error } = await supabase.from(op.table).delete().in(op.column, op.values))
    } else {
      ({ error } = await supabase.from(op.table).update({ [op.column]: null }).eq(op.column, op.value))
    }
    if (error) {
      console.error('[deleteGuest] fallo en', op.table, JSON.stringify(error))
      return { ok: false, error: error.message }
    }
  }
  return { ok: true, error: null }
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- delete`
Expected: PASS.

- [ ] **Step 5: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `lib/guests/delete.ts` (ignorar los pre-existentes de @sentry/nextjs).

- [ ] **Step 6: Commit**

```bash
git add lib/guests/delete.ts lib/guests/delete.test.ts
git commit -m "feat(invitados): helper de borrado en orden (hijos, conversacion unlink/purge, invitado al final)"
```

---

### Task 2: Borrado individual con modal de conversación

**Files:**
- Modify: `app/events/[id]/page.tsx` (`deleteGuest` + estado y JSX del modal)

**Interfaces:**
- Consumes: `buildGuestDeletionOps`, `executeGuestDeletion`, `guestConversationIds` de `@/lib/guests/delete`.

Verificacion: manual (I/O + UI).

- [ ] **Step 1: Imports**

En `app/events/[id]/page.tsx`, agregar:
```ts
import { buildGuestDeletionOps, executeGuestDeletion, guestConversationIds } from '@/lib/guests/delete'
```

- [ ] **Step 2: Estado del modal**

Junto a los otros `useState` del componente principal (cerca de `const [confirmDelete...` o los estados de edicion), agregar:
```ts
const [deleteChatModal, setDeleteChatModal] = useState<{ guestId: string; conversationIds: string[] } | null>(null)
```

- [ ] **Step 3: Reemplazar `deleteGuest` (lineas 734-742) y agregar el ejecutor**

```ts
  const performDeleteGuest = async (guestId: string, conversationIds: string[], mode: 'unlink' | 'purge') => {
    const ops = buildGuestDeletionOps(guestId, conversationIds, mode)
    const { ok, error } = await executeGuestDeletion(supabase, ops)
    if (!ok) {
      alert('No se pudo eliminar el invitado. Intenta de nuevo.' + (error ? ' (' + error + ')' : ''))
      return
    }
    await supabase.rpc('decrement_guests', { event_id_input: id })
    setGuests(prev => prev.filter(g => g.id !== guestId))
    setEvent(prev => prev ? { ...prev, total_guests: Math.max(0, prev.total_guests - 1) } : prev)
    setSelected(prev => { const n = new Set(prev); n.delete(guestId); return n })
  }

  const deleteGuest = async (guestId: string) => {
    const conversationIds = await guestConversationIds(supabase, guestId)
    let hasChat = false
    if (conversationIds.length > 0) {
      const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).in('conversation_id', conversationIds)
      hasChat = (count ?? 0) > 0
    }
    if (hasChat) {
      setDeleteChatModal({ guestId, conversationIds })
      return
    }
    if (!confirm('¿Eliminar este invitado?')) return
    await performDeleteGuest(guestId, conversationIds, 'unlink')
  }
```

- [ ] **Step 4: JSX del modal**

Agregar cerca de los otros modales del componente principal (por ejemplo junto al modal de edicion). Estilo flat, acentos, sin emojis:
```tsx
{deleteChatModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteChatModal(null)}>
    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
      <h3 className="text-base font-bold text-[#1D1E20]">Este invitado tiene una conversación</h3>
      <p className="mt-1.5 text-sm text-[#666]">¿Qué quieres hacer con el chat?</p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={async () => { const m = deleteChatModal; setDeleteChatModal(null); await performDeleteGuest(m.guestId, m.conversationIds, 'unlink') }}
          className="rounded-lg border border-[#e0e0e0] py-2.5 text-sm font-semibold text-[#1D1E20] transition hover:border-[#48C9B0]"
        >
          Conservar el chat
          <span className="mt-0.5 block text-xs font-normal text-[#999]">Se guarda el historial; el hilo queda sin invitado</span>
        </button>
        <button
          onClick={async () => { const m = deleteChatModal; setDeleteChatModal(null); await performDeleteGuest(m.guestId, m.conversationIds, 'purge') }}
          className="rounded-lg bg-[#cc3333] py-2.5 text-sm font-semibold text-white transition hover:bg-[#b82e2e]"
        >
          Eliminar también el chat
        </button>
        <button onClick={() => setDeleteChatModal(null)} className="py-1.5 text-xs font-medium text-[#999]">Cancelar</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Verificacion manual**

`npm run dev`. En un evento: (1) borrar un invitado SIN chat → confirm normal → se va y NO reaparece al refrescar. (2) Borrar un invitado CON chat (ej. el de Telegram) → sale el modal; "Conservar" → invitado fuera, la conversación sigue en la bandeja como "sin invitado"; "Eliminar también" → invitado y chat fuera. Confirmar en la base que el invitado realmente se borró.

- [ ] **Step 7: Commit**

```bash
git add app/events/[id]/page.tsx
git commit -m "feat(invitados): borrado individual verifica error y pregunta que hacer con el chat"
```

---

### Task 3: Borrado masivo (bulk) sin mentir + conserva chats por defecto

**Files:**
- Modify: `app/events/[id]/page.tsx` (`bulkDelete`)

**Interfaces:**
- Consumes: `buildGuestDeletionOps`, `executeGuestDeletion`, `guestConversationIds` de `@/lib/guests/delete`.

Verificacion: manual.

- [ ] **Step 1: Reemplazar el cuerpo de `bulkDelete`**

Reemplazar el bloque de borrado dentro de `bulkDelete` (el `if (guestIds.length > 0) { await supabase.from('guests').delete()... } ... party_members.delete()...`) por un borrado por invitado que limpia en orden, conserva los chats (unlink) y verifica error. Los acompañantes sueltos (`looseMemberIds`) se borran aparte. Version:

```ts
    let anyFailed = false
    for (const gid of guestIds) {
      const convIds = await guestConversationIds(supabase, gid)
      const ops = buildGuestDeletionOps(gid, convIds, 'unlink')
      const { ok } = await executeGuestDeletion(supabase, ops)
      if (!ok) { anyFailed = true; deletedGuestSet.delete(gid) }
    }
    const okGuestCount = guestIds.filter(g => deletedGuestSet.has(g)).length
    if (okGuestCount > 0) await supabase.rpc('increment_guests_by', { event_id_input: id, amount: -okGuestCount })

    const looseArr = Array.from(new Set(looseMemberIds))
    for (let i = 0; i < looseArr.length; i += 200) await supabase.from('party_members').delete().in('id', looseArr.slice(i, i + 200))

    if (anyFailed) alert('Algunos invitados no se pudieron eliminar y se conservaron en la lista.')
```

Ajustar la actualizacion optimista de `setGuests` que sigue: filtrar por `deletedGuestSet` (que ahora solo contiene los que SI se borraron) — reusar el `deletedGuestSet` ya depurado. Los acompañantes de invitados borrados se van con el cascade del helper (party_members por guest_id), asi que en `setGuests` basta con quitar los invitados de `deletedGuestSet` y, para los invitados que quedan, quitar los `looseMemberIds`.

Nota: el helper YA borra los `party_members` de cada invitado borrado (estan en OWNED_TABLES), por lo que el loop viejo que juntaba `memberIdsToDelete` de invitados borrados ya no hace falta; solo quedan los acompañantes SUELTOS (de invitados que se quedan).

- [ ] **Step 2: Aviso de chats en el confirm (opcional, mismo commit)**

Antes del `confirm(...)`, contar cuantos de los seleccionados tienen chat y mencionarlo, para que el usuario sepa que se conservaran:
```ts
    let conChat = 0
    for (const gid of guestIds) { if ((await guestConversationIds(supabase, gid)).length > 0) conChat++ }
    const chatNota = conChat > 0 ? ' (' + conChat + ' con conversación; sus chats se conservarán sin invitado)' : ''
```
e incluir `chatNota` en el string del `confirm`.

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificacion manual**

Seleccionar varios invitados (uno con chat) y borrar en masa: los que no tienen chat se van; el que tiene chat se va y su conversación queda sin invitado; el conteo baja correcto; ninguno reaparece al refrescar.

- [ ] **Step 5: Commit**

```bash
git add app/events/[id]/page.tsx
git commit -m "feat(invitados): borrado masivo en orden, verifica error y conserva chats por defecto"
```

---

## Self-Review

**Spec coverage:**
- Preguntar solo con chat (>=1 mensaje) → Task 2 (deleteGuest chequea count) + modal. ✓
- Conservar (unlink) / eliminar (purge) → Task 1 (buildGuestDeletionOps modos) + Task 2 (botones). ✓
- Arreglo borrado silencioso (verificar error, no quitar si falla) → Task 1 (executeGuestDeletion retorna ok) + Task 2/3 (solo actualizan UI si ok). ✓
- Orden correcto (hijos antes, invitado al final) → Task 1 + test. ✓
- Sin SQL/DDL (codigo limpia en orden) → todas; ninguna toca Supabase schema. ✓
- Bulk mismo arreglo → Task 3. ✓
- Multicanal/inbound fuera → no aparece. ✓

**Placeholder scan:** cada paso con codigo/comando. Task 3 Step 1 pide ajustar el setGuests existente (describe como) — el implementer lee el bloque real; es integracion, no placeholder. ✓

**Type consistency:** `DeleteOp`/`ConversationMode`/`buildGuestDeletionOps`/`executeGuestDeletion`/`guestConversationIds` definidos en Task 1, usados igual en Task 2/3. ✓

**Riesgo:** `song_recommendations`/`wa_messages`/`table_seats` podrian NO tener filas para un invitado (delete de 0 filas = ok, sin error). Confirmado inofensivo. Si alguna tabla adicional referenciara `guests` y bloqueara (no detectada), el borrado fallaria y — gracias al fix — la UI lo avisaria en vez de mentir (falla segura).
