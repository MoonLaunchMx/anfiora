'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/app/components/ui/Modal'

interface ColorPickerProps {
  value: string
  onChange: (hex: string) => void
  onClose: () => void
}

const WEDDING_COLORS: { hex: string; nombre: string }[] = [
  { hex: '#0a0a0a', nombre: 'Negro' },
  { hex: '#1f2d5a', nombre: 'Azul marino' },
  { hex: '#2f5233', nombre: 'Verde bosque' },
  { hex: '#7a9a7e', nombre: 'Salvia' },
  { hex: '#800020', nombre: 'Vino' },
  { hex: '#b76e79', nombre: 'Rosa palo' },
  { hex: '#c46a53', nombre: 'Terracota' },
  { hex: '#d4a853', nombre: 'Oro' },
  { hex: '#e8dcc4', nombre: 'Champagne' },
  { hex: '#b3a2c7', nombre: 'Lavanda' },
  { hex: '#a7c3d9', nombre: 'Azul polvo' },
  { hex: '#f4f1ea', nombre: 'Marfil' },
]

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return null
  const int = parseInt(m[1], 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

export default function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const initial = hexToRgb(value) ?? { r: 212, g: 168, b: 83 }
  const initialHsv = rgbToHsv(initial.r, initial.g, initial.b)
  const [h, setHue] = useState(initialHsv.h)
  const [s, setSat] = useState(initialHsv.s)
  const [v, setVal] = useState(initialHsv.v)
  const [hexInput, setHexInput] = useState(value)

  const currentRgb = hsvToRgb(h, s, v)
  const currentHex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b)

  useEffect(() => {
    if (value.toLowerCase() === currentHex.toLowerCase()) return
    const rgb = hexToRgb(value)
    if (!rgb) return
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
    setHue(hsv.h); setSat(hsv.s); setVal(hsv.v)
    setHexInput(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const apply = (nh: number, ns: number, nv: number) => {
    setHue(nh); setSat(ns); setVal(nv)
    const rgb = hsvToRgb(nh, ns, nv)
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
    setHexInput(hex)
    onChange(hex)
  }

  const onSquare = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const ns = clamp((e.clientX - r.left) / r.width, 0, 1)
    const nv = clamp(1 - (e.clientY - r.top) / r.height, 0, 1)
    apply(h, ns, nv)
  }

  const onHue = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const nh = clamp((e.clientX - r.left) / r.width, 0, 1) * 360
    apply(nh, s, v)
  }

  const commitHex = (raw: string) => {
    const rgb = hexToRgb(raw)
    if (!rgb) { setHexInput(currentHex); return }
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
    apply(hsv.h, hsv.s, hsv.v)
  }

  const hueColor = rgbToHex(...(Object.values(hsvToRgb(h, 1, 1)) as [number, number, number]))

  return (
    <Modal open onClose={onClose} size="sm">
      <Modal.Header title="Elegir color" />
      <Modal.Body>
          <div
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onSquare(e) }}
            onPointerMove={e => { if (e.buttons === 1) onSquare(e) }}
            className="relative h-40 w-full cursor-crosshair touch-none rounded-lg"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
            }}
          >
            <div
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: currentHex }}
            />
          </div>

          <div
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); onHue(e) }}
            onPointerMove={e => { if (e.buttons === 1) onHue(e) }}
            className="relative mt-3 h-4 w-full cursor-pointer touch-none rounded-full"
            style={{
              background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
            }}
          >
            <div
              className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${(h / 360) * 100}%`, background: hueColor }}
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="h-9 w-9 shrink-0 rounded-lg border border-black/10" style={{ background: currentHex }} />
            <input
              value={hexInput}
              onChange={e => setHexInput(e.target.value)}
              onBlur={e => commitHex(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitHex((e.target as HTMLInputElement).value)}
              spellCheck={false}
              className="w-full rounded-lg border border-[#e8e8e8] px-3 py-2 text-base uppercase text-[#1D1E20] focus:border-[#48C9B0] focus:outline-none"
            />
          </div>

          <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-[#bbb]">Colores de boda</p>
          <div className="grid grid-cols-6 gap-2">
            {WEDDING_COLORS.map(c => (
              <button
                key={c.hex}
                type="button"
                title={c.nombre}
                onClick={() => commitHex(c.hex)}
                className={`h-8 w-8 rounded-lg border transition hover:scale-110 ${
                  currentHex.toLowerCase() === c.hex.toLowerCase() ? 'border-[#48C9B0] ring-2 ring-[#48C9B0]/30' : 'border-black/10'
                }`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-[#48C9B0] py-2.5 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
        >
          Listo
        </button>
      </Modal.Footer>
    </Modal>
  )
}
