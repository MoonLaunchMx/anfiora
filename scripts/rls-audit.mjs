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
// se verifican leyendo la migracion aplicada y con la prueba manual.
{
  const { data } = await sb.from('song_recommendations').select('event_id').limit(1000)
  const eventos = new Set((data ?? []).map(r => r.event_id)).size
  console.log(`  info     song_recommendations: anon ve ${data?.length ?? 0} canciones de ${eventos} evento(s) (esperado tras el fix: solo eventos con playlist)`)
}

console.log(failures === 0 ? '\nRESULTADO: TODO CERRADO' : `\nRESULTADO: ${failures} hoyo(s) ABIERTO(S)`)
process.exit(failures === 0 ? 0 : 1)
