// scripts/rls-audit.mjs
// Guardian de RLS: usa el ANON key (llave publica) e intenta leer lo que NO deberia.
// Correr con:  node --env-file=.env.local scripts/rls-audit.mjs
//
// Ninguna pagina lee la base con la llave anonima: las publicas (invitacion,
// mesa, playlist, opinion, invite) van por su API con service role. Asi que un
// anonimo no debe leer NADA. Se prueba por columna y no con select('*'): un
// permiso de columna suelto deja leer esa columna aunque el '*' salga denegado.
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !anon) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local')
  process.exit(2)
}

const sb = createClient(url, anon)
let failures = 0

async function expectEmpty(table, columns) {
  for (const col of columns) {
    const { data, error } = await sb.from(table).select(col).limit(5)
    const n = data?.length ?? 0
    if (n > 0) {
      console.log(`  ABIERTO  ${table}.${col}: anon leyo ${n} fila(s)`)
      failures++
    } else {
      console.log(`  cerrado  ${table}.${col}: 0 filas${error ? ' (denegado)' : ''}`)
    }
  }
}

console.log('--- Auditoria RLS (anon key) ---')
await expectEmpty('users', ['id'])
await expectEmpty('event_audit_log', ['id'])
await expectEmpty('event_itinerary_moments', ['id'])
await expectEmpty('events', ['id', 'address', 'planner_phone'])
await expectEmpty('event_settings', ['event_id', 'playlist_token', 'registry_token', 'shared_token', 'review_token', 'registry_payment_info'])
await expectEmpty('song_recommendations', ['id'])
await expectEmpty('guests', ['id', 'rsvp_token'])
await expectEmpty('gift_reservations', ['id'])
await expectEmpty('event_collaborators', ['id'])
await expectEmpty('workspace_members', ['id'])
await expectEmpty('forms', ['id'])
await expectEmpty('form_responses', ['id'])
await expectEmpty('terms_acceptances', ['id'])

console.log(failures === 0 ? '\nRESULTADO: TODO CERRADO' : `\nRESULTADO: ${failures} hoyo(s) ABIERTO(S)`)
process.exit(failures === 0 ? 0 : 1)
