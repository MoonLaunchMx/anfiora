import { z } from 'zod'

export const VIBE_CATEGORIES = ['elegantes', 'celebracion', 'retro', 'musica', 'temporada'] as const
export type VibeCategory = (typeof VIBE_CATEGORIES)[number]

export const BUTTON_FORMAS = ['pill', 'redondo', 'recto'] as const
export type ButtonForma = (typeof BUTTON_FORMAS)[number]

export const BUTTON_ESTILOS = ['relleno', 'contorno', 'degradado', 'elevado', 'retro3d', 'neon', 'cromo'] as const
export type ButtonEstilo = (typeof BUTTON_ESTILOS)[number]

export const FONDO_TIPOS = ['solido', 'gradiente', 'imagen', 'animado'] as const
export type FondoTipo = (typeof FONDO_TIPOS)[number]

export const EFFECT_IDS = [
  'none', 'gradiente-vivo', 'confeti', 'grid-synthwave', 'estrellas', 'olas', 'bokeh',
  'petalos', 'hojas', 'papel-cuaderno', 'papel-cuadricula', 'aurora', 'halftone', 'papel-arrugado',
  'bola-disco',
] as const
export type EffectId = (typeof EFFECT_IDS)[number]

export const SI_ANIM_IDS = [
  'confeti', 'corazones', 'destellos', 'fuegos', 'globos', 'emojis', 'champan', 'arcade', 'jackpot', 'bola-disco', 'estrellas',
] as const
export type SiAnimId = (typeof SI_ANIM_IDS)[number]

export const NO_ANIM_IDS = [
  'calido', 'lluvia', 'luces-off', 'corazon-roto', 'matorral', 'nevada', 'scratch',
] as const
export type NoAnimId = (typeof NO_ANIM_IDS)[number]

export const ThemeColorsSchema = z.object({
  fondo: z.string().default('#ffffff'),
  texto: z.string().default('#1D1E20'),
  acento: z.string().default('#48C9B0'),
  botonBg: z.string().default('#48C9B0'),
  botonTexto: z.string().default('#ffffff'),
})

export const ThemeFontsSchema = z.object({
  titulo: z.string().default('josefin-sans'),
  cuerpo: z.string().default('general-sans'),
})

export const ThemeBotonSchema = z.object({
  forma: z.enum(BUTTON_FORMAS).default('redondo'),
  estilo: z.enum(BUTTON_ESTILOS).default('elevado'),
})

export const ThemeFondoSchema = z.object({
  tipo: z.enum(FONDO_TIPOS).default('solido'),
  efectoId: z.enum(EFFECT_IDS).default('none'),
})

export const ThemeAnimSchema = z.object({
  si: z.enum(SI_ANIM_IDS).default('confeti'),
  no: z.enum(NO_ANIM_IDS).default('calido'),
})

export const ThemeSchema = z.object({
  vibeId: z.string().default('anfiora-claro'),
  colores: ThemeColorsSchema.default(() => ThemeColorsSchema.parse({})),
  fonts: ThemeFontsSchema.default(() => ThemeFontsSchema.parse({})),
  boton: ThemeBotonSchema.default(() => ThemeBotonSchema.parse({})),
  fondo: ThemeFondoSchema.default(() => ThemeFondoSchema.parse({})),
  anim: ThemeAnimSchema.default(() => ThemeAnimSchema.parse({})),
  copy: z.record(z.string(), z.string()).default({}),
})

export type Theme = z.infer<typeof ThemeSchema>

export const DEFAULT_THEME: Theme = ThemeSchema.parse({
  vibeId: 'clasico',
  colores: { fondo: '#FBF7F0', texto: '#1D1E20', acento: '#d4a853', botonBg: '#48C9B0', botonTexto: '#ffffff' },
  fonts: { titulo: 'josefin-sans', cuerpo: 'general-sans' },
  boton: { forma: 'pill', estilo: 'relleno' },
  fondo: { tipo: 'solido', efectoId: 'none' },
  anim: { si: 'confeti', no: 'calido' },
})
