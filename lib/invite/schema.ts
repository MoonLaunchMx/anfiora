import { z } from 'zod'
import { ThemeSchema } from './theme'

const PortadaContent = z.object({
  kicker: z.string().default(''),
  titulo: z.string().default(''),
  subtitulo: z.string().default(''),
})
const SaludoContent = z.object({
  titulo: z.string().default('Hola'),
  mensaje: z.string().default('Nos encantaría que nos acompañes en este día tan especial.'),
})
const DetallesContent = z.object({
  titulo: z.string().default('Los detalles'),
  mostrar_mapa: z.boolean().default(true),
  maps_url: z.string().default(''),
})
const DressCodeContent = z.object({
  titulo: z.string().default('Código de vestimenta'),
})
const ItinerarioContent = z.object({
  titulo: z.string().default('Itinerario del día'),
})
const RsvpContent = z.object({
  titulo: z.string().default('Confirma tu asistencia'),
  texto: z.string().default('Ayúdanos a organizar todo confirmando si nos acompañas.'),
})
const EngancheContent = z.object({
  titulo: z.string().default('Sé parte de la fiesta'),
  mostrar_playlist: z.boolean().default(true),
  mostrar_mesa: z.boolean().default(true),
})
const PlaylistContent = z.object({
  titulo: z.string().default('Arma la playlist'),
  descripcion: z.string().default('Sugiere las canciones que no pueden faltar'),
})
const MesaContent = z.object({
  titulo: z.string().default('Mesa de regalos'),
  descripcion: z.string().default('Consulta las opciones para tu regalo'),
})
const TextoContent = z.object({
  eyebrow: z.string().default(''),
  titulo: z.string().default(''),
  cuerpo: z.string().default(''),
})
const CierreContent = z.object({
  titulo: z.string().default('Te esperamos'),
  firma: z.string().default(''),
})
const MediaContent = z.object({
  url: z.string().default(''),
  caption: z.string().default(''),
})
const VideoContent = z.object({
  url: z.string().default(''),
  caption: z.string().default(''),
})
const AudioContent = z.object({
  url: z.string().default(''),
  drive_url: z.string().default(''),
  titulo: z.string().default(''),
  caption: z.string().default(''),
})

export const CONTENT_BY_TYPE = {
  portada: PortadaContent,
  saludo: SaludoContent,
  detalles: DetallesContent,
  dress_code: DressCodeContent,
  itinerario: ItinerarioContent,
  rsvp: RsvpContent,
  enganche: EngancheContent,
  playlist: PlaylistContent,
  mesa: MesaContent,
  texto: TextoContent,
  cierre: CierreContent,
  media: MediaContent,
  video: VideoContent,
  audio: AudioContent,
} as const

export type SectionType = keyof typeof CONTENT_BY_TYPE
export const SECTION_TYPES = Object.keys(CONTENT_BY_TYPE) as SectionType[]

export const SectionSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('portada'),    content: PortadaContent }),
  z.object({ id: z.string(), type: z.literal('saludo'),     content: SaludoContent }),
  z.object({ id: z.string(), type: z.literal('detalles'),   content: DetallesContent }),
  z.object({ id: z.string(), type: z.literal('dress_code'), content: DressCodeContent }),
  z.object({ id: z.string(), type: z.literal('itinerario'), content: ItinerarioContent }),
  z.object({ id: z.string(), type: z.literal('rsvp'),       content: RsvpContent }),
  z.object({ id: z.string(), type: z.literal('enganche'),   content: EngancheContent }),
  z.object({ id: z.string(), type: z.literal('playlist'),   content: PlaylistContent }),
  z.object({ id: z.string(), type: z.literal('mesa'),       content: MesaContent }),
  z.object({ id: z.string(), type: z.literal('texto'),      content: TextoContent }),
  z.object({ id: z.string(), type: z.literal('cierre'),     content: CierreContent }),
  z.object({ id: z.string(), type: z.literal('media'),      content: MediaContent }),
  z.object({ id: z.string(), type: z.literal('video'),      content: VideoContent }),
  z.object({ id: z.string(), type: z.literal('audio'),      content: AudioContent }),
])

export const MetaSchema = z.object({
  publicada: z.boolean().default(false),
  fecha_limite: z.string().nullable().default(null),
})

export const InviteDocSchema = z.object({
  v: z.literal(2).default(2),
  meta: MetaSchema.default(() => MetaSchema.parse({})),
  theme: ThemeSchema.default(() => ThemeSchema.parse({})),
  sections: z.array(SectionSchema).default([]),
})

export type Section = z.infer<typeof SectionSchema>
export type InviteMeta = z.infer<typeof MetaSchema>
export type InviteDoc = z.infer<typeof InviteDocSchema>
