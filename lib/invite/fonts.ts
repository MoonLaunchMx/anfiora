export type FontDef = { id: string; family: string; stack: string; googleName?: string; axes?: string }

const S = (family: string, kind: 'sans' | 'serif' | 'display') =>
  `'${family}', ${kind === 'serif' ? 'serif' : 'sans-serif'}`

// googleName incluye los axes/pesos tal cual van en la URL css2 (family=<googleName>)
export const FONTS: Record<string, FontDef> = {
  'general-sans': { id: 'general-sans', family: 'General Sans', stack: "'General Sans', system-ui, sans-serif" },
  'josefin-sans': { id: 'josefin-sans', family: 'Josefin Sans', stack: S('Josefin Sans', 'sans'), googleName: 'Josefin+Sans:wght@300;400;600' },
  'playfair-display-italic': { id: 'playfair-display-italic', family: 'Playfair Display', stack: S('Playfair Display', 'serif'), googleName: 'Playfair+Display:ital,wght@1,500' },
  'cormorant-garamond': { id: 'cormorant-garamond', family: 'Cormorant Garamond', stack: S('Cormorant Garamond', 'serif'), googleName: 'Cormorant+Garamond:wght@400;500' },
  'cormorant-garamond-italic': { id: 'cormorant-garamond-italic', family: 'Cormorant Garamond', stack: S('Cormorant Garamond', 'serif'), googleName: 'Cormorant+Garamond:ital,wght@1,500' },
  'cinzel': { id: 'cinzel', family: 'Cinzel', stack: S('Cinzel', 'serif'), googleName: 'Cinzel:wght@500' },
  'bungee-inline': { id: 'bungee-inline', family: 'Bungee Inline', stack: S('Bungee Inline', 'display'), googleName: 'Bungee+Inline' },
  'great-vibes': { id: 'great-vibes', family: 'Great Vibes', stack: S('Great Vibes', 'display'), googleName: 'Great+Vibes' },
  'pacifico': { id: 'pacifico', family: 'Pacifico', stack: S('Pacifico', 'display'), googleName: 'Pacifico' },
  'baloo-2': { id: 'baloo-2', family: 'Baloo 2', stack: S('Baloo 2', 'display'), googleName: 'Baloo+2:wght@700' },
  'rowdies': { id: 'rowdies', family: 'Rowdies', stack: S('Rowdies', 'display'), googleName: 'Rowdies:wght@700' },
  'audiowide': { id: 'audiowide', family: 'Audiowide', stack: S('Audiowide', 'display'), googleName: 'Audiowide' },
  'titan-one': { id: 'titan-one', family: 'Titan One', stack: S('Titan One', 'display'), googleName: 'Titan+One' },
  'orbitron': { id: 'orbitron', family: 'Orbitron', stack: S('Orbitron', 'display'), googleName: 'Orbitron:wght@700' },
  'anton': { id: 'anton', family: 'Anton', stack: S('Anton', 'display'), googleName: 'Anton' },
  'monoton': { id: 'monoton', family: 'Monoton', stack: S('Monoton', 'display'), googleName: 'Monoton' },
  'michroma': { id: 'michroma', family: 'Michroma', stack: S('Michroma', 'display'), googleName: 'Michroma' },
  'limelight': { id: 'limelight', family: 'Limelight', stack: S('Limelight', 'display'), googleName: 'Limelight' },
  'quicksand': { id: 'quicksand', family: 'Quicksand', stack: S('Quicksand', 'sans'), googleName: 'Quicksand:wght@400;500' },
  'prata': { id: 'prata', family: 'Prata', stack: S('Prata', 'serif'), googleName: 'Prata' },
  'bodoni-moda': { id: 'bodoni-moda', family: 'Bodoni Moda', stack: S('Bodoni Moda', 'serif'), googleName: 'Bodoni+Moda:wght@400;500' },
  // toolkit extra
  'abril-fatface': { id: 'abril-fatface', family: 'Abril Fatface', stack: S('Abril Fatface', 'display'), googleName: 'Abril+Fatface' },
  'caveat': { id: 'caveat', family: 'Caveat', stack: S('Caveat', 'display'), googleName: 'Caveat:wght@500;700' },
  'fraunces': { id: 'fraunces', family: 'Fraunces', stack: S('Fraunces', 'serif'), googleName: 'Fraunces:ital,opsz,wght@0,9..144,500' },
  'bricolage-grotesque': { id: 'bricolage-grotesque', family: 'Bricolage Grotesque', stack: S('Bricolage Grotesque', 'sans'), googleName: 'Bricolage+Grotesque:opsz,wght@12..96,800' },
  'rubik-wet-paint': { id: 'rubik-wet-paint', family: 'Rubik Wet Paint', stack: S('Rubik Wet Paint', 'display'), googleName: 'Rubik+Wet+Paint' },
  'bagel-fat-one': { id: 'bagel-fat-one', family: 'Bagel Fat One', stack: S('Bagel Fat One', 'display'), googleName: 'Bagel+Fat+One' },
  'bungee-spice': { id: 'bungee-spice', family: 'Bungee Spice', stack: S('Bungee Spice', 'display'), googleName: 'Bungee+Spice' },
}

const FALLBACK = "'General Sans', system-ui, sans-serif"

export function fontStack(id: string): string {
  return FONTS[id]?.stack ?? FALLBACK
}

export function googleFontsHref(ids: string[]): string | null {
  const families = Array.from(new Set(ids))
    .map(id => FONTS[id]?.googleName)
    .filter((x): x is string => Boolean(x))
  if (families.length === 0) return null
  const query = families.map(f => `family=${f}`).join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}
