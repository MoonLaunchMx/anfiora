'use client'
import { supabase } from '@/lib/supabase'

// Un refresh token invalido ("Refresh Token Not Found") deja la sesion en un
// bucle: el token guardado ya no sirve, pero sigue guardado, asi que CADA
// recarga vuelve a fallar igual y la pantalla se queda vacia. Pasa cuando dos
// pestañas o dos efectos se pelean el refresco y uno consume el token antes
// que el otro.
//
// La salida es limpiar lo que ya no sirve y mandar a la puerta. Leer la sesion
// por aqui, y no con supabase.auth.getUser() suelto, deja ese rescate en un
// solo lugar.
export async function usuarioActual(): Promise<{ id: string; email: string } | null> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) {
      // signOut local: borra el token muerto sin depender del servidor, que es
      // justo lo que no esta contestando cuando llegamos aqui.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      return null
    }
    return { id: data.user.id, email: data.user.email ?? '' }
  } catch {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    return null
  }
}
