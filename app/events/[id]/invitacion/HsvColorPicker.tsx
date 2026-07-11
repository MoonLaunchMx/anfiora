'use client'
import { useEffect, useRef, useState } from 'react'

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { h: 174, s: 62, v: 79 }
  const int = parseInt(m[1], 16)
  const r = (int >> 16) / 255, g = ((int >> 8) & 255) / 255, b = (int & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60; if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 }
}

function hsvToHex(h: number, s: number, v: number): string {
  s /= 100; v /= 100
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function isValidHex(v: string): boolean {
  return /^#?[0-9a-f]{6}$/i.test(v.trim())
}

export default function HsvColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (hex: string) => void
}) {
  const initial = isValidHex(value) ? value : '#48C9B0'
  const [{ h, s, v }, setHsv] = useState(() => hexToHsv(initial))
  const squareRef = useRef<HTMLDivElement | null>(null)
  const hueRef = useRef<HTMLDivElement | null>(null)
  const draggingSquare = useRef(false)
  const draggingHue = useRef(false)

  useEffect(() => {
    if (isValidHex(value)) {
      const next = hexToHsv(value)
      const current = hsvToHex(h, s, v)
      if (current.toLowerCase() !== value.toLowerCase()) {
        setHsv(next)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const updateFromSquare = (clientX: number, clientY: number) => {
    const el = squareRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ns = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)
    const nv = clamp((1 - (clientY - rect.top) / rect.height) * 100, 0, 100)
    setHsv(prev => {
      const next = { h: prev.h, s: ns, v: nv }
      onChange(hsvToHex(next.h, next.s, next.v))
      return next
    })
  }

  const updateFromHue = (clientX: number) => {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const nh = clamp(((clientX - rect.left) / rect.width) * 360, 0, 360)
    setHsv(prev => {
      const next = { h: nh, s: prev.s, v: prev.v }
      onChange(hsvToHex(next.h, next.s, next.v))
      return next
    })
  }

  return (
    <div>
      <div
        ref={squareRef}
        className="relative h-40 w-full cursor-crosshair rounded-xl"
        style={{ background: `hsl(${h}, 100%, 50%)` }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          draggingSquare.current = true
          updateFromSquare(e.clientX, e.clientY)
        }}
        onPointerMove={e => {
          if (draggingSquare.current) updateFromSquare(e.clientX, e.clientY)
        }}
        onPointerUp={() => { draggingSquare.current = false }}
        onPointerCancel={() => { draggingSquare.current = false }}
      >
        <div className="absolute inset-0 rounded-xl" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
        <div className="absolute inset-0 rounded-xl" style={{ background: 'linear-gradient(to top, #000, transparent)' }} />
        <div
          className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${s}%`, top: `${100 - v}%` }}
        />
      </div>
      <div
        ref={hueRef}
        className="relative mt-3 h-4 w-full cursor-pointer rounded-full"
        style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          draggingHue.current = true
          updateFromHue(e.clientX)
        }}
        onPointerMove={e => {
          if (draggingHue.current) updateFromHue(e.clientX)
        }}
        onPointerUp={() => { draggingHue.current = false }}
        onPointerCancel={() => { draggingHue.current = false }}
      >
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${(h / 360) * 100}%` }}
        />
      </div>
    </div>
  )
}
