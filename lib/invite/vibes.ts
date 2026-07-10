import { ThemeSchema, type Theme, type VibeCategory } from './theme'

export type Vibe = { id: string; nombre: string; categoria: VibeCategory; theme: Theme }

function v(
  id: string, nombre: string, categoria: VibeCategory,
  t: {
    fondo: string; texto: string; acento: string; botonBg: string; botonTexto: string
    titulo: string; forma: Theme['boton']['forma']; estilo: Theme['boton']['estilo']
    fondoTipo?: Theme['fondo']['tipo']; efecto?: Theme['fondo']['efectoId']
    si?: Theme['anim']['si']; no?: Theme['anim']['no']
  },
): Vibe {
  const theme = ThemeSchema.parse({
    vibeId: id,
    colores: { fondo: t.fondo, texto: t.texto, acento: t.acento, botonBg: t.botonBg, botonTexto: t.botonTexto },
    fonts: { titulo: t.titulo, cuerpo: 'general-sans' },
    boton: { forma: t.forma, estilo: t.estilo },
    fondo: { tipo: t.fondoTipo ?? 'solido', efectoId: t.efecto ?? 'none' },
    anim: { si: t.si ?? 'confeti', no: t.no ?? 'calido' },
  })
  return { id, nombre, categoria, theme }
}

export const VIBES: Vibe[] = [
  // elegantes
  v('anfiora-claro', 'Anfiora Claro', 'elegantes', { fondo: '#ffffff', texto: '#1D1E20', acento: '#48C9B0', botonBg: '#48C9B0', botonTexto: '#ffffff', titulo: 'josefin-sans', forma: 'redondo', estilo: 'elevado', si: 'confeti', no: 'calido' }),
  v('anfiora-noche', 'Anfiora Noche', 'elegantes', { fondo: '#1D1E20', texto: '#f5f5f5', acento: '#F4C430', botonBg: '#48C9B0', botonTexto: '#1D1E20', titulo: 'josefin-sans', forma: 'redondo', estilo: 'elevado', fondoTipo: 'animado', efecto: 'estrellas', si: 'destellos', no: 'calido' }),
  v('romantico', 'Romántico', 'elegantes', { fondo: 'linear-gradient(160deg,#fbe9ec,#eabfce)', texto: '#8a4a5e', acento: '#c76b86', botonBg: '#c76b86', botonTexto: '#ffffff', titulo: 'playfair-display-italic', forma: 'pill', estilo: 'relleno', fondoTipo: 'gradiente', si: 'corazones', no: 'corazon-roto' }),
  v('botanico', 'Botánico', 'elegantes', { fondo: 'linear-gradient(160deg,#e8efe0,#d3e0c4)', texto: '#3f5335', acento: '#6b8455', botonBg: '#6b8455', botonTexto: '#ffffff', titulo: 'cormorant-garamond', forma: 'pill', estilo: 'relleno', fondoTipo: 'gradiente', si: 'confeti', no: 'calido' }),
  v('dorado', 'Dorado clásico', 'elegantes', { fondo: 'linear-gradient(160deg,#faf6ec,#f0e4c8)', texto: '#7a5f24', acento: '#b8912f', botonBg: '#b8912f', botonTexto: '#ffffff', titulo: 'cinzel', forma: 'recto', estilo: 'relleno', fondoTipo: 'gradiente', si: 'champan', no: 'calido' }),
  // celebracion
  v('fiesta', 'Fiesta', 'celebracion', { fondo: 'linear-gradient(135deg,#6a2cf5,#c336d6 55%,#ff5e8a)', texto: '#ffffff', acento: '#ffe600', botonBg: '#ffe600', botonTexto: '#6a2cf5', titulo: 'bungee-inline', forma: 'pill', estilo: 'elevado', fondoTipo: 'animado', efecto: 'gradiente-vivo', si: 'emojis', no: 'matorral' }),
  v('xv', 'XV años', 'celebracion', { fondo: 'linear-gradient(160deg,#fdeef3,#f6cfe0 60%,#e9b6cf)', texto: '#9b4a72', acento: '#d98bb3', botonBg: '#d98bb3', botonTexto: '#ffffff', titulo: 'great-vibes', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'gradiente-vivo', si: 'corazones', no: 'corazon-roto' }),
  v('playa', 'Playa', 'celebracion', { fondo: 'linear-gradient(180deg,#7ec8e3,#b8e0d2 55%,#f4e4c1)', texto: '#0d5a6e', acento: '#e08a5b', botonBg: '#e08a5b', botonTexto: '#ffffff', titulo: 'pacifico', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'olas', si: 'confeti', no: 'lluvia' }),
  v('kids', 'Kids', 'celebracion', { fondo: 'linear-gradient(135deg,#ffd93d,#ff8fab 60%,#8ac6ff)', texto: '#3a2a5a', acento: '#3a2a5a', botonBg: '#3a2a5a', botonTexto: '#ffffff', titulo: 'baloo-2', forma: 'redondo', estilo: 'retro3d', fondoTipo: 'animado', efecto: 'confeti', si: 'globos', no: 'matorral' }),
  // retro
  v('70s', 'Setentas', 'retro', { fondo: 'linear-gradient(160deg,#e8a13c,#c65f2e 55%,#7a3b1e)', texto: '#fdf0d5', acento: '#fdf0d5', botonBg: '#fdf0d5', botonTexto: '#c65f2e', titulo: 'rowdies', forma: 'pill', estilo: 'retro3d', fondoTipo: 'animado', efecto: 'gradiente-vivo', si: 'confeti', no: 'matorral' }),
  v('80s', 'Ochentas', 'retro', { fondo: '#140a2e', texto: '#ffffff', acento: '#00e5ff', botonBg: '#00e5ff', botonTexto: '#140a2e', titulo: 'audiowide', forma: 'recto', estilo: 'neon', fondoTipo: 'animado', efecto: 'grid-synthwave', si: 'arcade', no: 'luces-off' }),
  v('90s', 'Noventas', 'retro', { fondo: '#14b5b0', texto: '#ffffff', acento: '#ffe600', botonBg: '#ff5ea3', botonTexto: '#ffffff', titulo: 'titan-one', forma: 'recto', estilo: 'retro3d', fondoTipo: 'animado', efecto: 'halftone', si: 'emojis', no: 'scratch' }),
  v('y2k', 'Y2K', 'retro', { fondo: 'linear-gradient(135deg,#c0c0ff,#e6b3ff 55%,#b3f0ff)', texto: '#5a2a8a', acento: '#7a3bd4', botonBg: '#7a3bd4', botonTexto: '#ffffff', titulo: 'orbitron', forma: 'pill', estilo: 'cromo', fondoTipo: 'animado', efecto: 'grid-synthwave', si: 'jackpot', no: 'luces-off' }),
  // musica
  v('rock', 'Rock and roll', 'musica', { fondo: '#0a0a0a', texto: '#ffffff', acento: '#e11d1d', botonBg: '#e11d1d', botonTexto: '#ffffff', titulo: 'anton', forma: 'recto', estilo: 'relleno', si: 'fuegos', no: 'scratch' }),
  v('disco', 'Disco', 'musica', { fondo: 'radial-gradient(circle at 50% 30%,#3a2a6a,#0a0620)', texto: '#f0d97a', acento: '#e0c04a', botonBg: 'linear-gradient(90deg,#ff2e97,#39ff88)', botonTexto: '#1a1030', titulo: 'monoton', forma: 'pill', estilo: 'degradado', fondoTipo: 'animado', efecto: 'bokeh', si: 'bola-disco', no: 'luces-off' }),
  v('electro', 'Electrónica', 'musica', { fondo: '#03060a', texto: '#39ff88', acento: '#2ee0ff', botonBg: '#39ff88', botonTexto: '#03060a', titulo: 'michroma', forma: 'recto', estilo: 'neon', fondoTipo: 'animado', efecto: 'bokeh', si: 'estrellas', no: 'luces-off' }),
  v('jazz', 'Jazz / lounge', 'musica', { fondo: 'linear-gradient(160deg,#1a1230,#3a1f2e)', texto: '#e8c98a', acento: '#c99a4a', botonBg: 'transparent', botonTexto: '#e8c98a', titulo: 'limelight', forma: 'pill', estilo: 'contorno', fondoTipo: 'animado', efecto: 'estrellas', si: 'champan', no: 'calido' }),
  // temporada
  v('verano', 'Verano', 'temporada', { fondo: 'linear-gradient(160deg,#ffd75e,#ff9a52 55%,#ff6f91)', texto: '#ffffff', acento: '#ff7a52', botonBg: '#ffffff', botonTexto: '#ff7a52', titulo: 'quicksand', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'gradiente-vivo', si: 'confeti', no: 'lluvia' }),
  v('primavera', 'Primavera', 'temporada', { fondo: 'linear-gradient(160deg,#fce4ef,#e8f3d4 60%,#d4ecdf)', texto: '#6a7a4a', acento: '#c76b9b', botonBg: '#e79ac0', botonTexto: '#ffffff', titulo: 'cormorant-garamond-italic', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'petalos', si: 'corazones', no: 'calido' }),
  v('otono', 'Otoño', 'temporada', { fondo: 'linear-gradient(160deg,#e0a24a,#b5532a 55%,#7a2f1e)', texto: '#fdeccd', acento: '#fdeccd', botonBg: '#fdeccd', botonTexto: '#b5532a', titulo: 'prata', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'hojas', si: 'confeti', no: 'calido' }),
  v('invierno', 'Invierno', 'temporada', { fondo: 'linear-gradient(160deg,#eaf3f8,#c7dced 55%,#9db9d4)', texto: '#2a4a6a', acento: '#5a7a9a', botonBg: '#2a4a6a', botonTexto: '#eaf3f8', titulo: 'bodoni-moda', forma: 'pill', estilo: 'relleno', fondoTipo: 'animado', efecto: 'estrellas', si: 'destellos', no: 'nevada' }),
]

export const VIBE_IDS = VIBES.map(x => x.id)

const BY_ID = new Map(VIBES.map(x => [x.id, x]))
export function getVibe(id: string): Vibe {
  return BY_ID.get(id) ?? BY_ID.get('anfiora-claro')!
}

export const VIBES_BY_CATEGORY = VIBES.reduce((acc, x) => {
  ;(acc[x.categoria] ??= []).push(x)
  return acc
}, {} as Record<VibeCategory, Vibe[]>)
