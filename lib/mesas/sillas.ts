// Donde va cada silla en el dibujo de una mesa, por forma, y que cuerpo se
// dibuja en medio. Lo usan el SVG del plano y las sillas arrastrables que van
// encima, para que coincidan pixel a pixel.

export type Silla = { x: number; y: number }
export type Cuerpo =
  | { tipo: 'circulo'; r: number }
  | { tipo: 'elipse'; rx: number; ry: number }
  | { tipo: 'rect'; w: number; h: number; radio: number }
  | { tipo: 'arco'; r: number }
  | { tipo: 'linea' }
  | { tipo: 'u'; w: number; h: number; grosor: number }
  | { tipo: 'coctel'; r: number }
export type Dibujo = { w: number; h: number; cx: number; cy: number; sillas: Silla[]; cuerpo: Cuerpo }

export const FORMAS = ['round', 'oval', 'rectangle', 'square', 'imperial', 'herradura', 'halfmoon', 'row', 'anfitriones', 'coctel'] as const
export type Forma = typeof FORMAS[number]

export const NOMBRE_FORMA: Record<Forma, string> = {
  round: 'Redonda', oval: 'Ovalada', rectangle: 'Rectangular', square: 'Cuadrada',
  imperial: 'Imperial', herradura: 'Herradura', halfmoon: 'Media luna', row: 'Mesa de honor',
  anfitriones: 'Anfitriones', coctel: 'Coctel',
}

// Coctel es de pie: cuenta personas, no sillas. Nada que arrastrar en el plano.
export const SIN_SILLAS: ReadonlySet<string> = new Set(['coctel'])

const sR = 7
const gap = 22
const pad = sR + 10

const arriba = (cx: number, y: number, n: number): Silla[] => Array.from({ length: n }, (_, i) => ({ x: cx - ((n - 1) * gap) / 2 + i * gap, y }))
const lado = (x: number, cy: number, n: number): Silla[] => Array.from({ length: n }, (_, i) => ({ x, y: cy - ((n - 1) * gap) / 2 + i * gap }))

export function sillasDe(shape: string, cap: number): Dibujo {
  const n = Math.max(0, cap)
  if (shape === 'oval') {
    const rx = Math.max(48, Math.min(80, 30 + n * 3)); const ry = Math.round(rx * 0.55)
    const orbitRx = rx + sR + 5; const orbitRy = ry + sR + 5
    const w = (orbitRx + sR + 8) * 2; const h = (orbitRy + sR + 8) * 2
    const cx = w / 2; const cy = h / 2
    return { w, h, cx, cy, cuerpo: { tipo: 'elipse', rx, ry }, sillas: Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return { x: cx + Math.cos(a) * orbitRx, y: cy + Math.sin(a) * orbitRy } }) }
  }
  if (shape === 'rectangle') {
    const sides = n > 6 ? Math.floor((n - Math.ceil(n * 0.6)) / 2) : 0
    const tbEach = Math.ceil((n - sides * 2) / 2); const tbBot = n - sides * 2 - tbEach
    const tW = Math.max(80, tbEach * gap + 20); const tH = Math.max(40, sides > 0 ? sides * gap + 20 : 40)
    const w = tW + pad * 2; const h = tH + pad * 2 + sR * 2; const cx = w / 2; const cy = h / 2
    const sillas = [...arriba(cx, pad - sR, tbEach), ...arriba(cx, h - pad + sR, tbBot), ...lado(pad - sR, cy, sides), ...lado(w - pad + sR, cy, sides)]
    return { w, h, cx, cy, cuerpo: { tipo: 'rect', w: tW, h: tH, radio: 8 }, sillas }
  }
  if (shape === 'imperial') {
    // Larga, sillas solo arriba y abajo. De 12 a 40 lugares.
    const top = Math.ceil(n / 2); const bot = n - top
    const tW = Math.max(120, top * gap + 20); const tH = 36
    const w = tW + pad * 2; const h = tH + pad * 2 + sR * 2; const cx = w / 2; const cy = h / 2
    return { w, h, cx, cy, cuerpo: { tipo: 'rect', w: tW, h: tH, radio: 4 }, sillas: [...arriba(cx, pad - sR, top), ...arriba(cx, h - pad + sR, bot)] }
  }
  if (shape === 'herradura') {
    // En U abierta hacia abajo: sillas por fuera de la barra de arriba y de
    // las dos patas, y por dentro de la barra (presidium).
    const patas = n >= 4 ? Math.max(1, Math.floor(n * 0.3)) : 0; const barra = n - patas * 2
    const dentro = Math.floor(barra / 2); const fuera = barra - dentro
    const grosor = 30
    const tW = Math.max(120, Math.max(fuera, dentro) * gap + 20 + grosor * 2); const tH = Math.max(90, patas * gap + grosor + 10)
    const w = tW + pad * 2; const h = tH + pad * 2 + sR; const cx = w / 2; const top = pad
    const sillas = [
      ...arriba(cx, top - sR, fuera),
      ...arriba(cx, top + grosor + sR + 2, dentro),
      ...lado(pad - sR, top + grosor + (tH - grosor) / 2, patas),
      ...lado(w - pad + sR, top + grosor + (tH - grosor) / 2, patas),
    ]
    return { w, h, cx, cy: top + tH / 2, cuerpo: { tipo: 'u', w: tW, h: tH, grosor }, sillas }
  }
  if (shape === 'square') {
    const perSide = Math.ceil(n / 4); const tW = Math.max(60, perSide * gap + 20)
    const w = tW + pad * 2; const h = w; const cx = w / 2; const cy = h / 2
    const sillas = [...arriba(cx, pad - sR, perSide), ...arriba(cx, h - pad + sR, perSide), ...lado(pad - sR, cy, perSide), ...lado(w - pad + sR, cy, perSide)]
    return { w, h, cx, cy, cuerpo: { tipo: 'rect', w: tW, h: tW, radio: 6 }, sillas: sillas.slice(0, n) }
  }
  if (shape === 'halfmoon') {
    const tW = Math.max(80, n * gap + 20); const arcR = tW / 2; const w = tW; const h = arcR + pad + sR
    const cy = h - pad; const cx = w / 2
    return { w, h, cx, cy, cuerpo: { tipo: 'arco', r: arcR }, sillas: arriba(cx, h - sR - 4, n) }
  }
  if (shape === 'row') {
    const w = n * gap + pad; const h = sR * 2 + 16; const cy = h / 2 - 4
    return { w, h, cx: w / 2, cy, cuerpo: { tipo: 'linea' }, sillas: Array.from({ length: n }, (_, i) => ({ x: sR + i * gap + pad / 2, y: cy })) }
  }
  if (shape === 'anfitriones') {
    // Mesa chica con las sillas de un solo lado, de cara a todos.
    const tW = Math.max(70, n * gap + 20); const tH = 30
    const w = tW + pad * 2; const h = tH + pad + sR * 2 + 6; const cx = w / 2; const cy = pad + tH / 2 + 4
    return { w, h, cx, cy, cuerpo: { tipo: 'rect', w: tW, h: tH, radio: 10 }, sillas: arriba(cx, pad - sR, n) }
  }
  if (shape === 'coctel') {
    const r = 22; const size = (r + 14) * 2
    return { w: size, h: size, cx: size / 2, cy: size / 2, cuerpo: { tipo: 'coctel', r }, sillas: [] }
  }
  // round y cualquier forma desconocida
  const r = Math.max(28, Math.min(44, 20 + n * 2)); const orbit = r + sR + 5
  const size = (orbit + sR + 6) * 2; const cx = size / 2; const cy = size / 2
  return { w: size, h: size, cx, cy, cuerpo: { tipo: 'circulo', r }, sillas: Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return { x: cx + Math.cos(a) * orbit, y: cy + Math.sin(a) * orbit } }) }
}

export const RADIO_SILLA = sR
