'use client'
import type { InviteDoc } from '@/lib/invite/schema'
import type { InviteCtx } from './types'
import { resolveInviteHeading } from '@/lib/invite'
import ThemeProvider from './ThemeProvider'
import PortadaSection from './sections/PortadaSection'
import SaludoSection from './sections/SaludoSection'
import DetallesSection from './sections/DetallesSection'
import DressCodeSection from './sections/DressCodeSection'
import ItinerarioSection from './sections/ItinerarioSection'
import RsvpSection from './sections/RsvpSection'
import EngancheSection from './sections/EngancheSection'
import PlaylistSection from './sections/PlaylistSection'
import MesaSection from './sections/MesaSection'
import TextoSection from './sections/TextoSection'
import CierreSection from './sections/CierreSection'
import MediaSection from './sections/MediaSection'
import GaleriaSection from './sections/GaleriaSection'
import VideoSection from './sections/VideoSection'
import AudioSection from './sections/AudioSection'

export default function InvitacionRenderer({ doc, ctx }: { doc: InviteDoc; ctx: InviteCtx }) {
  const portadaSection = doc.sections.find(s => s.type === 'portada')
  const portadaTitulo =
    portadaSection?.type === 'portada' && portadaSection.content.titulo.trim()
      ? portadaSection.content.titulo
      : resolveInviteHeading(ctx.event)
  return (
    <ThemeProvider theme={doc.theme}>
      <div className="flex flex-col">
        {doc.sections.map(s => {
          switch (s.type) {
            case 'portada':    return <PortadaSection    key={s.id} content={s.content} ctx={ctx} />
            case 'saludo':     return <SaludoSection     key={s.id} content={s.content} ctx={ctx} />
            case 'detalles':   return <DetallesSection   key={s.id} content={s.content} ctx={ctx} />
            case 'dress_code': return <DressCodeSection  key={s.id} content={s.content} ctx={ctx} />
            case 'itinerario': return <ItinerarioSection key={s.id} content={s.content} ctx={ctx} />
            case 'rsvp':       return <RsvpSection       key={s.id} content={s.content} ctx={ctx} anim={doc.theme.anim} />
            case 'enganche':   return <EngancheSection   key={s.id} content={s.content} ctx={ctx} />
            case 'playlist':   return <PlaylistSection   key={s.id} content={s.content} ctx={ctx} />
            case 'mesa':       return <MesaSection       key={s.id} content={s.content} ctx={ctx} />
            case 'texto':      return <TextoSection      key={s.id} content={s.content} ctx={ctx} />
            case 'media':      return <MediaSection      key={s.id} content={s.content} ctx={ctx} />
            case 'galeria':    return <GaleriaSection    key={s.id} content={s.content} ctx={ctx} estilo={doc.theme.carrusel.estilo} />
            case 'video':      return <VideoSection      key={s.id} content={s.content} ctx={ctx} />
            case 'audio':      return <AudioSection      key={s.id} content={s.content} ctx={ctx} />
            case 'cierre':     return <CierreSection     key={s.id} content={s.content} ctx={ctx} portadaTitulo={portadaTitulo} />
            default:           return <div key={(s as any).id} className="px-6 py-3 text-center text-xs text-[#bbb]">Sección no disponible</div>
          }
        })}
      </div>
    </ThemeProvider>
  )
}
