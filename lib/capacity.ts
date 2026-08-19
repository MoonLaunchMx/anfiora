import { supabase } from '@/lib/supabase'

export type AccountCapacity = {
  active: number
  lim: number | null
  remaining: number | null
  over: boolean
}

export async function fetchAccountCapacity(userId: string): Promise<AccountCapacity | null> {
  const { data, error } = await supabase.rpc('get_account_capacity', { p_user_id: userId })
  if (error || !data?.[0]) return null
  return data[0] as AccountCapacity
}

export function parseLimitError(msg: string): { needed: number; limit: number } | null {
  const m = msg.match(/EVENT_LIMIT_EXCEEDED:(\d+):(\d+)/)
  return m ? { needed: Number(m[1]), limit: Number(m[2]) } : null
}

export function esErrorDeCupo(error: { message: string } | null): boolean {
  return !!error && parseLimitError(error.message) !== null
}

export function esErrorDeArchivado(error: { message: string } | null): boolean {
  return !!error && error.message.includes('EVENTO_ARCHIVADO')
}
