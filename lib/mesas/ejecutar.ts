import type { SupabaseClient } from '@supabase/supabase-js'
import { falloDeEscritura, type Fallo } from '@/lib/escrituras/fallo'
import { idNuevo, type Op } from './asientos'

// Corre las ops en orden y se detiene en la primera que no entra. Los inserts
// devuelven su id y sustituyen los ids provisionales ('nuevo:<memberId>') de
// las ops que siguen, para que expandir + mover sea una sola tanda.
export async function ejecutarOps(supabase: SupabaseClient, ops: Op[]): Promise<Fallo | null> {
  const reales = new Map<string, string>()
  const idDe = (seatId: string) => reales.get(seatId) ?? seatId
  for (const op of ops) {
    if (op.kind === 'insert') {
      const r = await supabase.from('table_seats').insert(op.row).select('id')
      const f = falloDeEscritura(r, 1)
      if (f) return f
      if (op.row.party_member_id) reales.set(idNuevo(op.row.party_member_id), (r.data as { id: string }[])[0].id)
    } else if (op.kind === 'mover') {
      const f = falloDeEscritura(await supabase.from('table_seats').update({ table_id: op.table_id, seat_number: op.seat_number }).eq('id', idDe(op.seatId)).select('id'))
      if (f) return f
    } else if (op.kind === 'encoger') {
      const f = falloDeEscritura(await supabase.from('table_seats').update({ party_size: 1 }).eq('id', idDe(op.seatId)).select('id'))
      if (f) return f
    } else {
      const f = falloDeEscritura(await supabase.from('table_seats').delete().eq('id', idDe(op.seatId)).select('id'))
      if (f) return f
    }
  }
  return null
}
