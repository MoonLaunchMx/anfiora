import type { SupabaseClient } from '@supabase/supabase-js'
import {
  prefijosABorrar,
  rutasBajoPrefijo,
  type ClienteStorage,
  type EntradaStorage,
} from './archivos-usuario'

export interface DeleteTarget {
  id: string
  email: string
  plan: string
}

export interface DeletableCheck {
  ok: boolean
  error: string | null
}

const PROTECTED_PLANS = ['pro', 'agency']

export function checkUserDeletable(params: {
  actorId: string
  target: DeleteTarget | null
  emailConfirm: string
}): DeletableCheck {
  const { actorId, target, emailConfirm } = params

  if (!target) return { ok: false, error: 'Usuario no encontrado.' }
  if (target.id === actorId) return { ok: false, error: 'No puedes eliminar tu propia cuenta.' }

  if (PROTECTED_PLANS.includes((target.plan || 'free').toLowerCase())) {
    return { ok: false, error: 'No se puede eliminar a un usuario Pro o Agency. Bajalo a plan free primero.' }
  }

  const expected = (target.email || '').trim().toLowerCase()
  if (!expected || emailConfirm.trim().toLowerCase() !== expected) {
    return { ok: false, error: 'El correo no coincide.' }
  }

  return { ok: true, error: null }
}

// storage.list pagina de 100 en 100 por default: sin esto, una cuenta con
// muchas fotos se borraria a medias y en silencio.
const PAGINA = 100

function clienteDeBucket(admin: SupabaseClient, bucket: string): ClienteStorage {
  const api = admin.storage.from(bucket)
  return {
    async list(prefijo: string) {
      const todas: EntradaStorage[] = []
      for (let offset = 0; ; offset += PAGINA) {
        const { data, error } = await api.list(prefijo, { limit: PAGINA, offset })
        if (error) return { data: null, error: { message: error.message } }
        const pagina = (data || []) as EntradaStorage[]
        todas.push(...pagina)
        if (pagina.length < PAGINA) break
      }
      return { data: todas, error: null }
    },
    async remove(rutas: string[]) {
      const { error } = await api.remove(rutas)
      return { error: error ? { message: error.message } : null }
    },
  }
}

// Los buckets no cuelgan de ninguna tabla, asi que la cascada no los toca. Se
// corre ANTES de borrar el perfil: despues ya no hay como saber que eventos
// eran suyos.
export async function deleteUserFiles(
  admin: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; borrados: number; error: string | null }> {
  const [eventos, workspaces] = await Promise.all([
    admin.from('events').select('id').eq('user_id', userId),
    admin.from('workspaces').select('id').eq('primary_owner_id', userId),
  ])
  if (eventos.error) return { ok: false, borrados: 0, error: 'No se pudieron listar sus eventos: ' + eventos.error.message }
  if (workspaces.error) return { ok: false, borrados: 0, error: 'No se pudieron listar sus workspaces: ' + workspaces.error.message }

  const prefijos = prefijosABorrar({
    userId,
    eventIds: (eventos.data || []).map(e => e.id as string),
    workspaceIds: (workspaces.data || []).map(w => w.id as string),
  })

  let borrados = 0
  for (const { bucket, prefijo } of prefijos) {
    const cliente = clienteDeBucket(admin, bucket)
    const { rutas, error } = await rutasBajoPrefijo(cliente, prefijo)
    if (error) return { ok: false, borrados, error: `No se pudo leer ${bucket}/${prefijo}: ${error}` }
    if (rutas.length === 0) continue

    const fallo = await cliente.remove(rutas)
    if (fallo.error) return { ok: false, borrados, error: `No se pudieron borrar los archivos de ${bucket}/${prefijo}: ${fallo.error.message}` }
    borrados += rutas.length
  }

  return { ok: true, borrados, error: null }
}

// Borra los archivos, luego el perfil (la cascada de Postgres limpia eventos y
// todo lo que cuelga de el) y al final la cuenta de acceso. Los archivos van
// primero porque necesitan los eventos todavia vivos para saber cuales son;
// si fallan, nada de la base se toco y se puede reintentar. Perfil antes que
// cuenta de acceso: si la cascada no estuviera aplicada, falla ahi sin haber
// tocado la cuenta -> nunca deja un borrado a medias.
export async function executeUserDeletion(
  admin: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; error: string | null }> {
  const archivos = await deleteUserFiles(admin, userId)
  if (!archivos.ok) {
    console.error('[deleteUser] fallo borrando archivos', archivos.error)
    return { ok: false, error: archivos.error }
  }

  const { error: profileErr } = await admin.from('users').delete().eq('id', userId)
  if (profileErr) {
    console.error('[deleteUser] fallo borrando perfil', JSON.stringify(profileErr))
    return { ok: false, error: 'No se pudo borrar el perfil del usuario: ' + profileErr.message }
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr) {
    console.error('[deleteUser] fallo borrando cuenta de acceso', JSON.stringify(authErr))
    return { ok: false, error: 'Perfil borrado, pero fallo la cuenta de acceso: ' + authErr.message }
  }

  return { ok: true, error: null }
}
