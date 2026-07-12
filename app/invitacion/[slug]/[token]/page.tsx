import { createClient } from '@supabase/supabase-js'
import type { Section } from '@/lib/invite/schema'
import { resolveDoc } from '@/lib/invite/doc'
import { formatFecha } from '@/app/components/invitacion/format'
import InvitacionClient from './InvitacionClient'

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const FALLBACK_METADATA = {
  title: 'Invitación',
  description: 'Estás invitado a un evento especial.',
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { token } = await params
  try {
    const db = admin()
    const { data: guest } = await db.from('guests').select('event_id').eq('rsvp_token', token).maybeSingle()
    if (!guest) return FALLBACK_METADATA

    const { data: settings } = await db
      .from('event_settings')
      .select('invite_config')
      .eq('event_id', guest.event_id)
      .maybeSingle()
    const doc = resolveDoc(settings?.invite_config, () => crypto.randomUUID())
    if (!doc.meta.publicada) return FALLBACK_METADATA

    const { data: event } = await db
      .from('events')
      .select('name, event_date, venue')
      .eq('id', guest.event_id)
      .maybeSingle()
    if (!event) return FALLBACK_METADATA

    const portada = doc.sections.find((s): s is Extract<Section, { type: 'portada' }> => s.type === 'portada')
    const heading = portada?.content.titulo?.trim() || event.name?.trim()
    const description = [formatFecha(event.event_date), event.venue].filter(Boolean).join(' · ') || FALLBACK_METADATA.description
    const title = heading ? `${heading} | Invitación` : FALLBACK_METADATA.title

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
