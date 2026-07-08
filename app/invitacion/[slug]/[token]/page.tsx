import { createClient } from '@supabase/supabase-js'
import { resolveInviteHeading } from '@/lib/invite'
import { formatFecha } from '@/app/components/invitacion/format'
import InvitacionClient from './InvitacionClient'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const FALLBACK_METADATA = {
  title: 'Invitación | Anfiora',
  description: 'Estás invitado a un evento especial.',
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { token } = await params
  try {
    const db = admin()
    const { data: guest } = await db.from('guests').select('event_id').eq('rsvp_token', token).maybeSingle()
    if (!guest) return FALLBACK_METADATA

    const { data: event } = await db
      .from('events')
      .select('name, event_date, venue, host_name, host_name_2')
      .eq('id', guest.event_id)
      .maybeSingle()
    if (!event) return FALLBACK_METADATA

    const heading = resolveInviteHeading(event)
    const description = [formatFecha(event.event_date), event.venue].filter(Boolean).join(' · ') || FALLBACK_METADATA.description
    const title = `${heading} | Invitación`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: 'Anfiora',
        locale: 'es_MX',
        type: 'website',
      },
    }
  } catch {
    return FALLBACK_METADATA
  }
}

export default async function InvitacionPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { token } = await params
  return <InvitacionClient token={token} />
}
