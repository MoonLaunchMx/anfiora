import type { SupabaseClient } from '@supabase/supabase-js'

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

// Borra el perfil (la cascada de Postgres limpia eventos y todo lo que cuelga
// de el) y luego la cuenta de acceso. Perfil PRIMERO: si la cascada no estuviera
// aplicada, falla aqui sin haber tocado la cuenta de acceso -> nunca deja un
// borrado a medias.
export async function executeUserDeletion(
  admin: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; error: string | null }> {
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
