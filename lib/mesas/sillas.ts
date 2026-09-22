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
export type Dibujo = { w: number; h: number; cx: number; cy: number; sillas: Silla[]; cuerpo: Cuerpo }

const sR = 7
const gap = 22
const pad = sR + 10

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
    const sillas: Silla[] = []
    for (let i = 0; i < tbEach; i++) sillas.push({ x: cx - ((tbEach - 1) * gap) / 2 + i * gap, y: pad - sR })
    for (let i = 0; i < tbBot; i++) sillas.push({ x: cx - ((tbBot - 1) * gap) / 2 + i * gap, y: h - pad + sR })
    for (let i = 0; i < sides; i++) sillas.push({ x: pad - sR, y: cy - ((sides - 1) * gap) / 2 + i * gap })
    for (let i = 0; i < sides; i++) sillas.push({ x: w - pad + sR, y: cy - ((sides - 1) * gap) / 2 + i * gap })
    return { w, h, cx, cy, cuerpo: { tipo: 'rect', w: tW, h: tH, radio: 8 }, sillas }
  }
  if (shape === 'square') {
    const perSide = Math.ceil(n / 4); const tW = Math.max(60, perSide * gap + 20)
    const w = tW + pad * 2; const h = w; const cx = w / 2; const cy = h / 2
    const sillas: Silla[] = []
    for (let i = 0; i < perSide; i++) sillas.push({ x: cx - ((perSide - 1) * gap) / 2 + i * gap, y: pad - sR })
    for (let i = 0; i < perSide; i++) sillas.push({ x: cx - ((perSide - 1) * gap) / 2 + i * gap, y: h - pad + sR })
    for (let i = 0; i < perSide; i++) sillas.push({ x: pad - sR, y: cy - ((perSide - 1) * gap) / 2 + i * gap })
    for (let i = 0; i < perSide; i++) sillas.push({ x: w - pad + sR, y: cy - ((perSide - 1) * gap) / 2 + i * gap })
    return { w, h, cx, cy, cuerpo: { tipo: 'rect', w: tW, h: tW, radio: 6 }, sillas: sillas.slice(0, n) }
  }
  if (shape === 'halfmoon') {
    const tW = Math.max(80, n * gap + 20); const arcR = tW / 2; const w = tW; const h = arcR + pad + sR
    const cy = h - pad; const cx = w / 2
    return { w, h, cx, cy, cuerpo: { tipo: 'arco', r: arcR }, sillas: Array.from({ length: n }, (_, i) => ({ x: cx - ((n - 1) * gap) / 2 + i * gap, y: h - sR - 4 })) }
  }
  if (shape === 'row') {
    const w = n * gap + pad; const h = sR * 2 + 16; const cy = h / 2 - 4
    return { w, h, cx: w / 2, cy, cuerpo: { tipo: 'linea' }, sillas: Array.from({ length: n }, (_, i) => ({ x: sR + i * gap + pad / 2, y: cy })) }
  }
  // round y cualquier forma desconocida
  const r = Math.max(28, Math.min(44, 20 + n * 2)); const orbit = r + sR + 5
  const size = (orbit + sR + 6) * 2; const cx = size / 2; const cy = size / 2
  return { w: size, h: size, cx, cy, cuerpo: { tipo: 'circulo', r }, sillas: Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return { x: cx + Math.cos(a) * orbit, y: cy + Math.sin(a) * orbit } }) }
}

export const RADIO_SILLA = sR
