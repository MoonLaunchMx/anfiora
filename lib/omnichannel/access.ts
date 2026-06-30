import { createClient } from '@supabase/supabase-js'

export async function verifyEventAccess(
  authHeader: string | null,
  eventId: string,
): Promise<{ uid: string; eventName: string } | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token || !eventId) return null

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: userData } = await anon.auth.getUser(token)
  const uid = userData?.user?.id
  if (!uid) return null

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: event } = await admin
    .from('events').select('id, user_id, name').eq('id', eventId).maybeSingle()
  if (!event) return null

  if (event.user_id === uid) return { uid, eventName: event.name ?? '' }

  const { data: collab } = await admin
    .from('event_collaborators').select('id')
    .eq('event_id', eventId).eq('user_id', uid).eq('status', 'active').maybeSingle()
  if (collab) return { uid, eventName: event.name ?? '' }

  return null
}
