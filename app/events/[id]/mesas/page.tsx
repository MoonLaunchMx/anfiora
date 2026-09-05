'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FeatureGuard from '@/app/components/ui/FeatureGuard'
import { Guest } from '@/lib/types'
import { Plus, Trash2, ChevronDown, ChevronUp, X, List, Map as MapIcon, Printer, Search, LayoutGrid, ArrowLeft, LayoutPanelLeft, RotateCw } from 'lucide-react'
import StatsCollapse, { StatsToggleButton, useStatsToggle } from '@/app/components/ui/StatsCollapse'
import { Modal } from '@/app/components/ui/Modal'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { usePermiso } from '@/lib/event-access-context'
import { Puede } from '@/lib/permisos/Puede'

// ─── CONSTANTES ───────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  confirmed:        { bg: '#d4f5e9', border: '#5DCAA5', text: '#0F6E56', label: 'Confirmado'      },
  pending:          { bg: '#fef3c7', border: '#FAC775', text: '#92400e', label: 'Pendiente'        },
  declined:         { bg: '#fee2e2', border: '#F09595', text: '#991b1b', label: 'Declinado'        },
  mensaje_enviado:  { bg: '#dbeafe', border: '#85B7EB', text: '#1e40af', label: 'Msg. enviado'     },
  respondio:        { bg: '#ffedd5', border: '#f0c090', text: '#9a3412', label: 'Respondió'        },
  accion_necesaria: { bg: '#fee2e2', border: '#F09595', text: '#991b1b', label: 'Acción necesaria' },
}

const TAG_COLORS = [
  { bg: '#f0fdfb', border: '#9FE1CB', text: '#0F6E56' },
  { bg: '#f0f0ff', border: '#afa9ec', text: '#3C3489' },
  { bg: '#fff5f0', border: '#F0997B', text: '#993C1D' },
  { bg: '#f0f8ff', border: '#85B7EB', text: '#0C447C' },
  { bg: '#fffbf0', border: '#FAC775', text: '#854F0B' },
  { bg: '#fff0f7', border: '#ED93B1', text: '#72243E' },
  { bg: '#f3fde8', border: '#C0DD97', text: '#3B6D11' },
  { bg: '#fff5f0', border: '#f09595', text: '#A32D2D' },
]

const inp = 'w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-2.5 text-sm text-[#1D1E20] outline-none focus:border-[#48C9B0]'
const EDIT_GUEST_INPUT_CLASS = 'w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3.5 py-2.5 text-base text-[#1D1E20] outline-none'

type TableShape = 'round' | 'rectangle' | 'square' | 'oval' | 'halfmoon' | 'row'

const SHAPE_LABELS: Record<TableShape, string> = {
  round: 'Redonda', rectangle: 'Rectangular', square: 'Cuadrada',
  oval: 'Ovalada', halfmoon: 'Media luna', row: 'Fila de sillas',
}

const SHAPE_ICONS: Record<TableShape, React.ReactNode> = {
  round: (
    <svg viewBox="0 0 60 60" fill="none" width="44" height="44">
      <circle cx="30" cy="30" r="14" stroke="#888" strokeWidth="1.5" fill="#f8f8f8"/>
      {Array.from({length:8},(_,i)=>{const a=(2*Math.PI*i)/8-Math.PI/2;const ox=Math.cos(a)*22;const oy=Math.sin(a)*22;return<circle key={i} cx={30+ox} cy={30+oy} r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>})}
    </svg>
  ),
  rectangle: (
    <svg viewBox="0 0 70 50" fill="none" width="52" height="38">
      <rect x="12" y="12" width="46" height="26" rx="4" stroke="#888" strokeWidth="1.5" fill="#f8f8f8"/>
      {[18,30,42].map(x=><circle key={`t${x}`} cx={x} cy={6} r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>)}
      {[18,30,42].map(x=><circle key={`b${x}`} cx={x} cy={44} r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>)}
      <circle cx={6} cy={25} r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>
      <circle cx={64} cy={25} r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>
    </svg>
  ),
  square: (
    <svg viewBox="0 0 54 54" fill="none" width="44" height="44">
      <rect x="14" y="14" width="26" height="26" rx="3" stroke="#888" strokeWidth="1.5" fill="#f8f8f8"/>
      <circle cx="27" cy="7" r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>
      <circle cx="27" cy="47" r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>
      <circle cx="7" cy="27" r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>
      <circle cx="47" cy="27" r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>
    </svg>
  ),
  oval: (
    <svg viewBox="0 0 70 50" fill="none" width="52" height="38">
      <ellipse cx="35" cy="25" rx="22" ry="13" stroke="#888" strokeWidth="1.5" fill="#f8f8f8"/>
      {[20,35,50].map(x=><circle key={`t${x}`} cx={x} cy={7} r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>)}
      {[20,35,50].map(x=><circle key={`b${x}`} cx={x} cy={43} r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>)}
      <circle cx={8} cy={25} r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>
      <circle cx={62} cy={25} r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>
    </svg>
  ),
  halfmoon: (
    <svg viewBox="0 0 60 50" fill="none" width="48" height="40">
      <path d="M10 38 A 20 20 0 0 1 50 38 Z" stroke="#888" strokeWidth="1.5" fill="#f8f8f8"/>
      {[15,22,30,38,45].map((x,i)=><circle key={i} cx={x} cy={44} r="4" fill="#ddd" stroke="#bbb" strokeWidth="1"/>)}
    </svg>
  ),
  row: (
    <svg viewBox="0 0 70 30" fill="none" width="56" height="24">
      {[10,22,34,46,58].map(x=><circle key={x} cx={x} cy={10} r="5" fill="#ddd" stroke="#bbb" strokeWidth="1.5"/>)}
      <line x1="5" y1="20" x2="65" y2="20" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
}

// ─── ICONOS DECO SVG ──────────────────────────
const DECO_ICONS: Record<string, React.ReactNode> = {
  dancefloor_rect: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><rect x="3" y="3" width="16" height="16" rx="1"/><rect x="21" y="3" width="16" height="16" rx="1"/><rect x="3" y="21" width="16" height="16" rx="1"/><rect x="21" y="21" width="16" height="16" rx="1"/></svg>,
  dancefloor_round: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="8"/><line x1="20" y1="4" x2="20" y2="36"/><line x1="4" y1="20" x2="36" y2="20"/></svg>,
  stage: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><path d="M4 34 Q20 10 36 34 Z"/><line x1="4" y1="34" x2="36" y2="34"/><circle cx="20" cy="20" r="2.5"/><line x1="20" y1="12" x2="20" y2="10"/><line x1="14" y1="14" x2="13" y2="12"/><line x1="26" y1="14" x2="27" y2="12"/></svg>,
  bar: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><rect x="4" y="22" width="32" height="12" rx="3"/><path d="M12 22v-8a4 4 0 0 1 8 0"/><path d="M26 22v-6a3 3 0 0 0-6 0"/><circle cx="12" cy="10" r="2"/></svg>,
  restroom: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><circle cx="13" cy="9" r="3"/><circle cx="27" cy="9" r="3"/><path d="M8 15h10v10H8z"/><line x1="13" y1="25" x2="13" y2="33"/><path d="M22 15l5 10 5-10"/><line x1="27" y1="25" x2="27" y2="33"/></svg>,
  dj: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><rect x="4" y="10" width="32" height="20" rx="3"/><circle cx="14" cy="20" r="5"/><circle cx="14" cy="20" r="2"/><line x1="22" y1="14" x2="34" y2="14"/><line x1="22" y1="19" x2="34" y2="19"/><line x1="22" y1="24" x2="30" y2="24"/></svg>,
  cake: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><rect x="6" y="20" width="28" height="14" rx="2"/><path d="M10 20v-4a10 10 0 0 1 20 0v4"/><line x1="20" y1="10" x2="20" y2="6"/><circle cx="20" cy="5" r="1.5" fill="currentColor" stroke="none"/></svg>,
  gifts: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><rect x="6" y="16" width="28" height="18" rx="2"/><rect x="4" y="10" width="32" height="6" rx="1"/><line x1="20" y1="10" x2="20" y2="34"/><path d="M20 10c0 0-4-6 0-6s0 6 0 6"/><path d="M20 10c0 0 4-6 0-6"/></svg>,
  photobooth: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><rect x="4" y="10" width="32" height="24" rx="3"/><circle cx="20" cy="22" r="7"/><circle cx="20" cy="22" r="3.5"/><rect x="26" y="12" width="6" height="4" rx="1"/></svg>,
  entrance: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><rect x="10" y="6" width="20" height="30" rx="2"/><path d="M10 36H6V10a2 2 0 0 1 2-2h2"/><path d="M30 36h4V10a2 2 0 0 0-2-2h-2"/><circle cx="25" cy="21" r="1.5" fill="currentColor" stroke="none"/></svg>,
  tree: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><path d="M20 4L7 22h7L8 36h24L26 22h7Z"/><line x1="20" y1="36" x2="20" y2="40"/></svg>,
  speaker: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><rect x="8" y="6" width="24" height="28" rx="4"/><circle cx="20" cy="26" r="5"/><circle cx="20" cy="26" r="2"/><circle cx="20" cy="12" r="3"/><circle cx="20" cy="12" r="1" fill="currentColor" stroke="none"/></svg>,
  light: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{pointerEvents:'none'}}><line x1="20" y1="3" x2="20" y2="7"/><line x1="31" y1="9" x2="28" y2="12"/><line x1="37" y1="20" x2="33" y2="20"/><line x1="31" y1="31" x2="28" y2="28"/><line x1="9" y1="31" x2="12" y2="28"/><line x1="3" y1="20" x2="7" y2="20"/><line x1="9" y1="9" x2="12" y2="12"/><circle cx="20" cy="20" r="7"/><line x1="20" y1="27" x2="20" y2="36"/><line x1="16" y1="36" x2="24" y2="36"/></svg>,
  arrow: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{pointerEvents:'none'}}><line x1="20" y1="36" x2="20" y2="8"/><polyline points="12,16 20,8 28,16"/></svg>,
  pillar: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" style={{pointerEvents:'none'}}><rect x="14" y="4" width="12" height="32" rx="2"/><rect x="11" y="4" width="18" height="4" rx="1"/><rect x="11" y="32" width="18" height="4" rx="1"/></svg>,
}

type DecoType = { id: string; label: string; boxed: boolean; defaultW: number; defaultH: number }
const DECO_ELEMENTS: DecoType[] = [
  { id: 'dancefloor_rect',  label: 'Pista (rect)',    boxed: true,  defaultW: 160, defaultH: 120 },
  { id: 'dancefloor_round', label: 'Pista (round)',   boxed: true,  defaultW: 120, defaultH: 120 },
  { id: 'stage',            label: 'Escenario',       boxed: true,  defaultW: 160, defaultH: 100 },
  { id: 'bar',              label: 'Barra',           boxed: true,  defaultW: 130, defaultH: 90  },
  { id: 'restroom',         label: 'Baños',           boxed: true,  defaultW: 100, defaultH: 90  },
  { id: 'dj',               label: 'DJ',              boxed: true,  defaultW: 110, defaultH: 90  },
  { id: 'cake',             label: 'Pastel',          boxed: true,  defaultW: 90,  defaultH: 90  },
  { id: 'gifts',            label: 'Regalos',         boxed: true,  defaultW: 90,  defaultH: 90  },
  { id: 'photobooth',       label: 'Photo booth',     boxed: true,  defaultW: 100, defaultH: 100 },
  { id: 'entrance',         label: 'Entrada',         boxed: true,  defaultW: 80,  defaultH: 100 },
  { id: 'tree',             label: 'Árbol',           boxed: false, defaultW: 56,  defaultH: 56  },
  { id: 'speaker',          label: 'Bocina',          boxed: false, defaultW: 48,  defaultH: 56  },
  { id: 'light',            label: 'Luz',             boxed: false, defaultW: 48,  defaultH: 56  },
  { id: 'arrow',            label: 'Flecha',          boxed: false, defaultW: 40,  defaultH: 56  },
  { id: 'pillar',           label: 'Pilar',           boxed: false, defaultW: 40,  defaultH: 56  },
]

type DecoItem = { id: string; type: string; label: string; x: number; y: number; w: number; h: number; boxed: boolean }

// ─── TIPOS ────────────────────────────────────
function normalizePhone(p: string) { return p.replace(/\D/g, '') }
type EditMember  = { id?: string; name: string; phone: string; rsvp_status: 'pending' | 'confirmed' | 'declined' }
type PartyMember = { id: string; name: string; rsvp_status: 'pending' | 'confirmed' | 'declined'; checked_in: boolean }
type GuestFull   = Pick<Guest, 'id' | 'name' | 'rsvp_status'> & { tags: string[]; party_size: number; notes: string | null; phone?: string | null; email?: string | null; checked_in: boolean; party_members: PartyMember[] }
type SeatRecord  = { id: string; table_id: string; event_id: string; seat_number: number; guest_id: string | null; party_size: number; guest?: GuestFull | null }
type TableRecord = { id: string; event_id: string; number: number; name: string | null; capacity: number; shape: string; rotation: number; position_x: number; position_y: number; created_at: string; seats: SeatRecord[] }
type MoveModal   = { guest: GuestFull; fromSeatId: string; fromTableNumber: number; toTableId: string; toTableCapacity: number }
type EventInfo   = { name: string; event_date: string | null; venue: string | null }

// ─── HELPERS ──────────────────────────────────
function getTableSvgDims(table: TableRecord): { w: number; h: number } {
  const cap = table.capacity; const sR = 7; const gap = 22; const pad = sR + 10
  switch (table.shape) {
    case 'round': { const r = Math.max(28, Math.min(44, 20 + cap * 2)); const orbit = r + sR + 5; const s = (orbit + sR + 6) * 2; return { w: s, h: s } }
    case 'oval':  { const tW = Math.max(90, Math.ceil(cap/2)*gap+24); return { w: tW+pad*2, h: 70+pad*2 } }
    case 'rectangle': { const top = Math.ceil(cap/2); const tW = Math.max(80, top*gap+20); return { w: tW+pad*2, h: 44+pad*2+sR*2 } }
    case 'square': { const side = Math.ceil(cap/4); const tW = Math.max(60, side*gap+20); return { w: tW+pad*2, h: tW+pad*2 } }
    case 'halfmoon': { const tW = Math.max(80, cap*gap+20); return { w: tW, h: tW/2+pad+sR } }
    case 'row': { return { w: cap*(gap)+pad, h: sR*2+16 } }
    default: { const r = Math.max(28, Math.min(44, 20 + cap * 2)); const orbit = r + sR + 5; const s = (orbit + sR + 6) * 2; return { w: s, h: s } }
  }
}

// ─── SVG MESAS ────────────────────────────────
const SEAT_COLORS: Record<string,{fill:string;stroke:string}> = {
  confirmed:        { fill:'#5DCAA5', stroke:'#0F6E56' },
  pending:          { fill:'#FAC775', stroke:'#92400e' },
  declined:         { fill:'#F09595', stroke:'#991b1b' },
  mensaje_enviado:  { fill:'#85B7EB', stroke:'#1e40af' },
  respondio:        { fill:'#f0c090', stroke:'#9a3412' },
  accion_necesaria: { fill:'#F09595', stroke:'#991b1b' },
}
const SEAT_EMPTY = { fill:'#f0f0f0', stroke:'#d0d0d0' }

function getSeatColors(table: TableRecord, seatIndex: number): {fill:string;stroke:string} {
  let idx = 0
  for (const seat of table.seats) {
    if (!seat.guest) continue
    const status = seat.guest.rsvp_status
    const sc = SEAT_COLORS[status] || SEAT_COLORS.confirmed
    const size = seat.guest.party_size || 1
    for (let j = 0; j < size; j++) {
      if (idx === seatIndex) return sc
      idx++
    }
  }
  return SEAT_EMPTY
}

function TableSVG({ table, occupied, isSelected, isHighlighted, isDimmed, colorFill, colorBorder }: {
  table: TableRecord; occupied: number; isSelected: boolean; isHighlighted: boolean; isDimmed: boolean
  colorFill?: string; colorBorder?: string
}) {
  const cap = table.capacity; const isFull = occupied >= cap; const sR = 7; const gap = 22; const pad = sR + 10
  const stroke = isHighlighted ? '#48C9B0' : isFull ? '#5DCAA5' : isSelected ? '#48C9B0' : (colorBorder||'#d0d0d0')
  const sw = isHighlighted ? 3 : isSelected ? 2.5 : 1.5
  const fill = colorFill && colorFill!=='#ffffff' ? colorFill : (isHighlighted ? '#f0fdfb' : isFull ? '#f0fff6' : '#fff')
  const statColor = isFull ? '#0F6E56' : occupied > 0 ? '#48C9B0' : '#bbb'
  const opacity = isDimmed ? 0.2 : 1

  const seatColorList = Array.from({length:cap}, (_,i) =>
    i < occupied ? getSeatColors(table, i) : SEAT_EMPTY
  )

  if (table.shape === 'round') {
    const r = Math.max(28, Math.min(44, 20 + cap * 2)); const orbit = r + sR + 5
    const size = (orbit + sR + 6) * 2; const cx = size/2; const cy = size/2
    const seats = Array.from({length:cap}, (_,i) => { const a=(2*Math.PI*i)/cap-Math.PI/2; return {x:Math.cos(a)*orbit,y:Math.sin(a)*orbit,c:seatColorList[i]} })
    return (
      <svg width={size} height={size} style={{display:'block',opacity,pointerEvents:'none'}}>
        {seats.map((s,i)=><circle key={i} cx={cx+s.x} cy={cy+s.y} r={sR} fill={s.c.fill} stroke={s.c.stroke} strokeWidth="1.5"/>)}
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={sw}/>
        <text x={cx} y={cy-5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1D1E20">#{table.number}</text>
        <text x={cx} y={cy+9} textAnchor="middle" fontSize="10" fill={statColor}>{occupied}/{cap}</text>
      </svg>
    )
  }

  if (table.shape === 'oval') {
    const rx = Math.max(48, Math.min(80, 30 + cap * 3)); const ry = Math.round(rx * 0.55)
    const orbitRx = rx + sR + 5; const orbitRy = ry + sR + 5
    const svgW = (orbitRx + sR + 8) * 2; const svgH = (orbitRy + sR + 8) * 2
    const cx = svgW/2; const cy = svgH/2
    const seats = Array.from({length:cap}, (_,i) => {
      const a = (2*Math.PI*i)/cap - Math.PI/2
      return { x: cx + Math.cos(a)*orbitRx, y: cy + Math.sin(a)*orbitRy, c: seatColorList[i] }
    })
    return (
      <svg width={svgW} height={svgH} style={{display:'block',opacity,pointerEvents:'none'}}>
        {seats.map((s,i)=><circle key={i} cx={s.x} cy={s.y} r={sR} fill={s.c.fill} stroke={s.c.stroke} strokeWidth="1.5"/>)}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={sw}/>
        <text x={cx} y={cy-5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1D1E20">#{table.number}</text>
        <text x={cx} y={cy+9} textAnchor="middle" fontSize="10" fill={statColor}>{occupied}/{cap}</text>
      </svg>
    )
  }

  if (table.shape === 'rectangle') {
    const sides = cap > 6 ? Math.floor((cap - Math.ceil(cap*0.6)) / 2) : 0
    const tbEach = Math.ceil((cap - sides*2) / 2); const tbBot = cap - sides*2 - tbEach
    const tW = Math.max(80, tbEach*gap+20); const tH = Math.max(40, sides>0?sides*gap+20:40)
    const svgW = tW+pad*2; const svgH = tH+pad*2+sR*2; const cx = svgW/2; const cy = svgH/2
    const topS  = Array.from({length:tbEach},(_,i)=>({x:cx-((tbEach-1)*gap)/2+i*gap, y:pad-sR, i:i}))
    const botS  = Array.from({length:tbBot}, (_,i)=>({x:cx-((tbBot-1)*gap)/2+i*gap,  y:svgH-pad+sR, i:i+tbEach}))
    const leftS = Array.from({length:sides}, (_,i)=>({x:pad-sR, y:cy-((sides-1)*gap)/2+i*gap, i:i+tbEach+tbBot}))
    const rightS= Array.from({length:sides}, (_,i)=>({x:svgW-pad+sR, y:cy-((sides-1)*gap)/2+i*gap, i:i+tbEach+tbBot+sides}))
    const dot=(s:{x:number;y:number;i:number},k:string)=>{const c=seatColorList[s.i];return<circle key={k} cx={s.x} cy={s.y} r={sR} fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>}
    return (
      <svg width={svgW} height={svgH} style={{display:'block',opacity,pointerEvents:'none'}}>
        {topS.map((s)=>dot(s,`t${s.i}`))}
        {botS.map((s)=>dot(s,`b${s.i}`))}
        {leftS.map((s)=>dot(s,`l${s.i}`))}
        {rightS.map((s)=>dot(s,`r${s.i}`))}
        <rect x={cx-tW/2} y={cy-tH/2} width={tW} height={tH} rx="8" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <text x={cx} y={cy-5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1D1E20">#{table.number}</text>
        <text x={cx} y={cy+9} textAnchor="middle" fontSize="10" fill={statColor}>{occupied}/{cap}</text>
      </svg>
    )
  }

  if (table.shape === 'square') {
    const perSide = Math.ceil(cap/4); const tW = Math.max(60, perSide*gap+20)
    const svgW = tW+pad*2; const svgH = tW+pad*2; const cx = svgW/2; const cy = svgH/2
    const topS  = Array.from({length:perSide},(_,i)=>({x:cx-((perSide-1)*gap)/2+i*gap,y:pad-sR,           i:i}))
    const botS  = Array.from({length:perSide},(_,i)=>({x:cx-((perSide-1)*gap)/2+i*gap,y:svgH-pad+sR,      i:i+perSide}))
    const leftS = Array.from({length:perSide},(_,i)=>({y:cy-((perSide-1)*gap)/2+i*gap,x:pad-sR,           i:i+perSide*2}))
    const rightS= Array.from({length:perSide},(_,i)=>({y:cy-((perSide-1)*gap)/2+i*gap,x:svgW-pad+sR,      i:i+perSide*3}))
    const dot=(s:any,k:string)=>{const c=seatColorList[s.i];return<circle key={k} cx={s.x} cy={s.y} r={sR} fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>}
    return (
      <svg width={svgW} height={svgH} style={{display:'block',opacity,pointerEvents:'none'}}>
        {topS.map(s=>dot(s,`t${s.i}`))}
        {botS.map(s=>dot(s,`b${s.i}`))}
        {leftS.map(s=>dot(s,`l${s.i}`))}
        {rightS.map(s=>dot(s,`r${s.i}`))}
        <rect x={cx-tW/2} y={cy-tW/2} width={tW} height={tW} rx="6" fill={fill} stroke={stroke} strokeWidth={sw}/>
        <text x={cx} y={cy-5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1D1E20">#{table.number}</text>
        <text x={cx} y={cy+9} textAnchor="middle" fontSize="10" fill={statColor}>{occupied}/{cap}</text>
      </svg>
    )
  }

  if (table.shape === 'halfmoon') {
    const tW = Math.max(80, cap*gap+20); const arcR = tW/2; const svgW = tW; const svgH = arcR+pad+sR
    const cy = svgH-pad; const cx = svgW/2
    const botS = Array.from({length:cap},(_,i)=>({x:cx-((cap-1)*gap)/2+i*gap, y:svgH-sR-4, i:i}))
    return (
      <svg width={svgW} height={svgH} style={{display:'block',opacity,pointerEvents:'none'}}>
        {botS.map(s=>{const c=seatColorList[s.i];return<circle key={s.i} cx={s.x} cy={s.y} r={sR} fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>})}
        <path d={`M ${cx-arcR} ${cy} A ${arcR} ${arcR} 0 0 1 ${cx+arcR} ${cy} Z`} fill={fill} stroke={stroke} strokeWidth={sw}/>
        <text x={cx} y={cy-14} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1D1E20">#{table.number}</text>
        <text x={cx} y={cy-2} textAnchor="middle" fontSize="10" fill={statColor}>{occupied}/{cap}</text>
      </svg>
    )
  }

  if (table.shape === 'row') {
    const svgW = cap*gap+pad; const svgH = sR*2+16; const cy = svgH/2-4
    const seats = Array.from({length:cap},(_,i)=>({x:sR+i*gap+pad/2, y:cy, i:i}))
    return (
      <svg width={svgW} height={svgH} style={{display:'block',opacity,pointerEvents:'none'}}>
        {seats.map(s=>{const c=seatColorList[s.i];return<circle key={s.i} cx={s.x} cy={s.y} r={sR} fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>})}
        <line x1={sR} y1={cy+sR+4} x2={svgW-sR} y2={cy+sR+4} stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
      </svg>
    )
  }

  return null
}

// ─── ELEMENTO DECO ────────────────────────────
function DecoElement({ item, isActive, colorFill, colorBorder, onMouseDown, onResizeMouseDown, onRotateMouseDown, onClickBody }: {
  item: DecoItem; isActive: boolean; colorFill?: string; colorBorder?: string
  onMouseDown: (e: React.MouseEvent) => void
  onResizeMouseDown: (e: React.MouseEvent, corner: string) => void
  onRotateMouseDown: (e: React.MouseEvent) => void
  onClickBody: () => void
}) {
  const icon = DECO_ICONS[item.type]
  const iconColor = isActive ? '#48C9B0' : '#999'
  const bgColor = colorFill && colorFill!=='#ffffff' ? colorFill : (isActive?'rgba(72,201,176,0.06)':'rgba(255,255,255,0.88)')
  const borderColor = isActive ? '#48C9B0' : (colorBorder && colorBorder!=='#d0d0d0' ? colorBorder : '#c0c0c0')
  const handles = (['nw','ne','se','sw'] as const).map(c => (
    <div key={c} onMouseDown={e=>{e.stopPropagation();onResizeMouseDown(e,c)}} style={{
      position:'absolute', width:10, height:10, borderRadius:3,
      background:'#48C9B0', border:'2px solid #fff', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
      cursor: c==='nw'||c==='se'?'nw-resize':'ne-resize',
      ...(c.includes('n')?{top:-5}:{bottom:-5}), ...(c.includes('w')?{left:-5}:{right:-5}),
    }}/>
  ))

  const rotHandle = isActive && (
    <div data-canvas-item="true" onMouseDown={e=>{e.stopPropagation();onRotateMouseDown(e)}} title="Rotar"
      style={{
        position:'absolute', top:-30, left:'50%', transform:'translateX(-50%)',
        width:20, height:20, borderRadius:'50%',
        background:'rgba(72,201,176,0.85)', border:'2.5px solid #fff',
        boxShadow:'0 2px 6px rgba(0,0,0,0.18)', cursor:'crosshair',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:10,
      }}>
      <RotateCw width={10} height={10} color="white" style={{pointerEvents:'none'}}/>
    </div>
  )

  const baseStyle: React.CSSProperties = {
    position:'absolute', left:item.x, top:item.y, width:item.w, height:item.h,
    userSelect:'none', cursor:'grab',
  }

  if (!item.boxed) {
    return (
      <div style={baseStyle} data-canvas-item="true" onMouseDown={onMouseDown} onClick={onClickBody}>
        {rotHandle}
        <div style={{
          width:'100%', height:'100%', display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:4,
          outline: isActive ? '2px dashed #48C9B0' : '2px dashed transparent',
          borderRadius:8, pointerEvents:'none',
        }}>
          <div style={{ width:item.w*0.65, height:item.h*0.65, color:iconColor, pointerEvents:'none' }}>{icon}</div>
          <span style={{ fontSize:10, color:isActive?'#48C9B0':'#999', fontWeight:500, pointerEvents:'none' }}>{item.label}</span>
        </div>
        {isActive && handles}
      </div>
    )
  }

  return (
    <div style={baseStyle} data-canvas-item="true" onMouseDown={onMouseDown}>
      {rotHandle}
      <div onClick={onClickBody} style={{
        width:'100%', height:'100%', cursor:'grab',
        border:`2px ${isActive?'solid':'dashed'} ${borderColor}`,
        borderRadius:12, background:bgColor,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
        pointerEvents:'none',
      }}>
        <div style={{ width:Math.min(item.w,item.h)*0.42, height:Math.min(item.w,item.h)*0.42, color:iconColor, flexShrink:0, pointerEvents:'none' }}>{icon}</div>
        <span style={{ fontSize:11, color:isActive?'#48C9B0':'#777', textAlign:'center', lineHeight:1.2, paddingInline:6, fontWeight:500, pointerEvents:'none' }}>{item.label}</span>
      </div>
      {isActive && handles}
    </div>
  )
}

// ─── MENÚ CONTEXTUAL ─────────────────────────
const CANVAS_COLORS = [
  { id: 'default', fill: '#ffffff', border: '#d0d0d0', ring: '#e0e0e0' },
  { id: 'teal',    fill: '#f0fdfb', border: '#9FE1CB', ring: '#48C9B0' },
  { id: 'amber',   fill: '#fffbf0', border: '#FAC775', ring: '#EF9F27' },
  { id: 'rose',    fill: '#fff0f7', border: '#ED93B1', ring: '#D4537E' },
  { id: 'lavender',fill: '#f3f0ff', border: '#AFA9EC', ring: '#7F77DD' },
  { id: 'coral',   fill: '#fff0f0', border: '#F09595', ring: '#E24B4A' },
]

type ContextMenuState = {
  x: number; y: number
  targetId: string
  targetType: 'table' | 'deco'
  currentColor: string
}

function ContextMenu({ menu, onColor, onDuplicate, onDelete, onClose }: {
  menu: ContextMenuState
  onColor: (id: string, type: 'table'|'deco', colorId: string) => void
  onDuplicate: (id: string, type: 'table'|'deco') => void
  onDelete: (id: string, type: 'table'|'deco') => void
  onClose: () => void
}) {
  return (
    <div style={{
      position:'fixed', left:menu.x, top:menu.y, zIndex:1000,
      background:'#fff', borderRadius:10,
      border:'0.5px solid rgba(0,0,0,0.12)',
      boxShadow:'0 8px 24px rgba(0,0,0,0.12)',
      minWidth:176, overflow:'hidden',
    }} onClick={e=>e.stopPropagation()} onContextMenu={e=>e.preventDefault()}>

      <div style={{padding:'10px 12px 10px'}}>
        <div style={{fontSize:10,color:'#aaa',marginBottom:8,letterSpacing:'0.05em',textTransform:'uppercase'}}>Color</div>
        <div style={{display:'flex',gap:7,alignItems:'center'}}>
          {CANVAS_COLORS.map(c=>(
            <button key={c.id} onClick={()=>{onColor(menu.targetId,menu.targetType,c.id);onClose()}}
              title={c.id}
              style={{
                width:20,height:20,borderRadius:'50%',cursor:'pointer',flexShrink:0,
                background:c.fill, border:`1.5px solid ${c.border}`,
                boxShadow: menu.currentColor===c.id ? `0 0 0 2.5px ${c.ring}` : 'none',
                outline:'none',padding:0,
              }}/>
          ))}
        </div>
      </div>

      {menu.targetType==='deco'&&(
      <button onClick={()=>{onDuplicate(menu.targetId,menu.targetType);onClose()}}
        style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 14px',background:'transparent',border:'none',cursor:'pointer',textAlign:'left'}}
        onMouseEnter={e=>(e.currentTarget.style.background='#f5f5f5')}
        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{pointerEvents:'none'}}>
          <rect x="5" y="5" width="9" height="9" rx="2"/>
          <path d="M11 5V3a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
        </svg>
        <span style={{fontSize:13,color:'#1D1E20'}}>Duplicar</span>
      </button>
      )}

      <button onClick={()=>{onDelete(menu.targetId,menu.targetType);onClose()}}
        style={{
          display:'flex',alignItems:'center',gap:10,width:'100%',
          padding:'9px 14px',background:'transparent',border:'none',
          cursor:'pointer',textAlign:'left',
        }}
        onMouseEnter={e=>(e.currentTarget.style.background='#fff5f5')}
        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#cc3333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{pointerEvents:'none'}}>
          <polyline points="2,4 14,4"/>
          <path d="M5 4V2h6v2"/>
          <rect x="3" y="4" width="10" height="10" rx="1"/>
          <line x1="6" y1="7" x2="6" y2="11"/>
          <line x1="10" y1="7" x2="10" y2="11"/>
        </svg>
        <span style={{fontSize:13,color:'#cc3333'}}>Eliminar</span>
      </button>
    </div>
  )
}

// ─── MODAL DETALLE MESA ───────────────────────
function TableDetailModal({ table, getOccupied, onClose, onAssign, onRemoveGuest, onEditTable, onDeleteTable, puedeEditar, puedeBorrar }: {
  table: TableRecord; getOccupied:(t:TableRecord)=>number; onClose:()=>void
  onAssign:(id:string,cap:number)=>void; onRemoveGuest:(seatId:string,name:string)=>void
  onEditTable:(t:TableRecord)=>void; onDeleteTable:(t:TableRecord)=>void
  puedeEditar:boolean; puedeBorrar:boolean
}) {
  const occ=getOccupied(table); const avail=table.capacity-occ; const full=avail===0
  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header
        title={`#${table.number} ${table.name||`Mesa ${table.number}`}`}
        subtitle={`${SHAPE_LABELS[table.shape as TableShape]||table.shape} · ${occ}/${table.capacity} asientos${full?' · Llena':''}`}
      />
      <Modal.Body>
        {!table.seats.some(s=>s.guest)?<p className="py-6 text-center text-sm text-[#bbb]">Sin invitados asignados</p>:(
          <div className="flex flex-col gap-2">
            {table.seats.map(seat=>{const g=seat.guest;if(!g)return null;const st=STATUS_COLORS[g.rsvp_status];return(
              <div key={seat.id} className="rounded-xl border px-3 py-2.5" style={{background:st.bg,borderColor:st.border}}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2"><span className="truncate text-sm font-semibold" style={{color:st.text}}>{g.name}</span>{g.party_size>1&&<span className="text-xs font-semibold" style={{color:st.text}}>+{g.party_size-1}</span>}</div>
                  <div className="flex items-center gap-2"><span className="text-xs font-semibold" style={{color:st.text}}>{st.label}</span>{puedeEditar&&<button onClick={()=>onRemoveGuest(seat.id,g.name)} className="opacity-40 hover:opacity-100" style={{color:st.text}}><X width={12} height={12}/></button>}</div>
                </div>
                {g.party_members.length>0&&<div className="mt-1.5 flex flex-col gap-1 border-t pt-1.5" style={{borderColor:st.border}}>{g.party_members.map(m=><div key={m.id} className="flex items-center justify-between"><div className="flex items-center gap-1.5"><div className="h-3 w-[2px] rounded-full opacity-30" style={{background:st.text}}/><span className="text-xs" style={{color:st.text}}>{m.name||'Acompañante'}</span></div><span className="text-[11px]" style={{color:STATUS_COLORS[m.rsvp_status].text}}>{STATUS_COLORS[m.rsvp_status].label}</span></div>)}</div>}
              </div>
            )})}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {puedeBorrar&&<button onClick={()=>{onDeleteTable(table);onClose()}} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#ffe0e0] bg-[#fff5f5] text-[#cc3333] hover:bg-[#ffe8e8]"><Trash2 width={14} height={14}/></button>}
        {puedeEditar&&<button onClick={()=>{onEditTable(table);onClose()}} className="flex-1 rounded-lg border border-[#e0e0e0] py-2 text-sm text-[#666] hover:border-[#48C9B0] hover:text-[#48C9B0]">Editar mesa</button>}
        {!full&&puedeEditar&&<button onClick={()=>{onAssign(table.id,table.capacity);onClose()}} className="flex-1 rounded-lg bg-[#48C9B0] py-2 text-sm font-semibold text-white hover:bg-[#3ab89f]">+ Asignar</button>}
      </Modal.Footer>
    </Modal>
  )
}

// ─── CANVAS FULLSCREEN ────────────────────────
function CanvasFullscreen({ tables, getOccupied, onBack, onTableClick, onPositionSave, onRotationSave, onOpenCreate, puedeEditar,
  decos, setDecos, decoRotations, setDecoRotations, tableColors, setTableColors, decoColors, setDecoColors
}: {
  tables: TableRecord[]; getOccupied:(t:TableRecord)=>number; onBack:()=>void
  onTableClick:(t:TableRecord)=>void; onPositionSave:(id:string,x:number,y:number)=>void
  onRotationSave:(id:string,rotation:number)=>void; onOpenCreate:()=>void
  puedeEditar: boolean
  decos: DecoItem[]; setDecos: React.Dispatch<React.SetStateAction<DecoItem[]>>
  decoRotations: Record<string,number>; setDecoRotations: React.Dispatch<React.SetStateAction<Record<string,number>>>
  tableColors: Record<string,string>; setTableColors: React.Dispatch<React.SetStateAction<Record<string,string>>>
  decoColors: Record<string,string>; setDecoColors: React.Dispatch<React.SetStateAction<Record<string,string>>>
}) {
  const [positions,  setPositions]  = useState<Record<string,{x:number;y:number}>>({})
  const [rotations,  setRotations]  = useState<Record<string,number>>({})
  const [selectedId, setSelectedId] = useState<string|null>(null)
  const [activeId,   setActiveId]   = useState<string|null>(null)
  const [activeDeco, setActiveDeco] = useState<string|null>(null)
  const [zoom,       setZoom]       = useState(1)
  const [search,     setSearch]     = useState('')
  const [showDecoPicker, setShowDecoPicker] = useState(false)
  const [isPanning,  setIsPanning]  = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState|null>(null)

  const dragRef   = useRef<{id:string;isDeco:boolean;startMX:number;startMY:number;startX:number;startY:number;hasMoved:boolean}|null>(null)
  const resizeRef = useRef<{id:string;corner:string;startMX:number;startMY:number;origX:number;origY:number;origW:number;origH:number}|null>(null)
  const rotateRef = useRef<{id:string;isDeco:boolean;centerX:number;centerY:number;startAngle:number;startRot:number}|null>(null)
  const panRef    = useRef<{startMX:number;startMY:number;startScrollX:number;startScrollY:number}|null>(null)
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  const savePosTimer    = useRef<ReturnType<typeof setTimeout>|null>(null)
  const saveRotTimer    = useRef<ReturnType<typeof setTimeout>|null>(null)

  const posRef       = useRef(positions);     posRef.current       = positions
  const rotRef       = useRef(rotations);     rotRef.current       = rotations
  const decoRotRef   = useRef(decoRotations); decoRotRef.current   = decoRotations
  const decosRef     = useRef(decos);         decosRef.current     = decos
  const canvasRef    = useRef<HTMLDivElement>(null)

  useEffect(()=>{
    setPositions(prev=>{
      const p:Record<string,{x:number;y:number}>={};
      tables.forEach((t,i)=>{
        p[t.id]=prev[t.id]??(((t.position_x||t.position_y)&&(t.position_x!==0||t.position_y!==0))?{x:t.position_x,y:t.position_y}:{x:80+(i%4)*240,y:80+Math.floor(i/4)*240})
      })
      return p
    })
    setRotations(prev=>{
      const r:Record<string,number>={};
      tables.forEach(t=>{ r[t.id]=prev[t.id]??(t.rotation||0) })
      return r
    })
  },[tables.map(t=>t.id).join(',')])

  const autoLayout=()=>{
    const p:Record<string,{x:number;y:number}>={}, r:Record<string,number>={}
    tables.forEach((t,i)=>{p[t.id]={x:80+(i%4)*240,y:80+Math.floor(i/4)*240};r[t.id]=0})
    setPositions(p); setRotations(r)
    tables.forEach(t=>{onPositionSave(t.id,p[t.id].x,p[t.id].y);onRotationSave(t.id,0)})
  }

  const addDeco=(def:DecoType)=>{
    const id=`deco_${Date.now()}`
    const area=canvasRef.current
    const cx=area?(area.scrollLeft+area.clientWidth/2)/zoom-def.defaultW/2:200
    const cy=area?(area.scrollTop+area.clientHeight/2)/zoom-def.defaultH/2:200
    setDecos(p=>[...p,{id,type:def.id,label:def.label,x:Math.max(0,cx),y:Math.max(0,cy),w:def.defaultW,h:def.defaultH,boxed:def.boxed}])
    setDecoRotations(p=>({...p,[id]:0}))
    setShowDecoPicker(false)
  }

  const openContextMenu=(e:React.MouseEvent, targetId:string, targetType:'table'|'deco')=>{
    e.preventDefault(); e.stopPropagation()
    const currentColor = targetType==='table' ? (tableColors[targetId]||'default') : (decoColors[targetId]||'default')
    setContextMenu({x:e.clientX, y:e.clientY, targetId, targetType, currentColor})
    setShowDecoPicker(false)
  }

  const handleContextColor=(id:string, type:'table'|'deco', colorId:string)=>{
    if(type==='table') setTableColors(p=>({...p,[id]:colorId}))
    else setDecoColors(p=>({...p,[id]:colorId}))
  }

  const handleContextDuplicate=(id:string, type:'table'|'deco')=>{
    if(type==='deco'){
      const orig=decosRef.current.find(d=>d.id===id); if(!orig)return
      const newId=`deco_${Date.now()}`
      setDecos(p=>[...p,{...orig,id:newId,x:orig.x+30,y:orig.y+30}])
      setDecoRotations(p=>({...p,[newId]:decoRotRef.current[id]||0}))
      setDecoColors(p=>({...p,[newId]:decoColors[id]||'default'}))
    }
  }

  const handleContextDelete=(id:string, type:'table'|'deco')=>{
    if(type==='deco'){
      setDecos(p=>p.filter(d=>d.id!==id))
      setActiveDeco(p=>p===id?null:p)
    }
  }

  const handleTableEnter=(id:string)=>{
    if(hoverLeaveTimer.current)clearTimeout(hoverLeaveTimer.current)
    setActiveId(id)
  }
  const handleTableLeave=(id:string)=>{
    hoverLeaveTimer.current=setTimeout(()=>setActiveId(p=>p===id?null:p),120)
  }
  const handleDecoEnter=(id:string)=>{
    if(hoverLeaveTimer.current)clearTimeout(hoverLeaveTimer.current)
    setActiveDeco(id)
  }
  const handleDecoLeave=(id:string)=>{
    hoverLeaveTimer.current=setTimeout(()=>setActiveDeco(p=>p===id?null:p),120)
  }

  const startDrag=(e:React.MouseEvent,id:string,isDeco:boolean)=>{
    if(!puedeEditar)return
    if(e.button===2)return
    e.preventDefault(); e.stopPropagation()
    const pos=isDeco?(decosRef.current.find(d=>d.id===id)||{x:0,y:0}):(posRef.current[id]||{x:0,y:0})
    dragRef.current={id,isDeco,startMX:e.clientX,startMY:e.clientY,startX:pos.x,startY:pos.y,hasMoved:false}
    document.body.style.cursor='grabbing'
    if(isDeco){setActiveDeco(id)}else{setActiveId(id);setSelectedId(id)}
  }

  const startResize=(e:React.MouseEvent,id:string,corner:string)=>{
    e.preventDefault(); e.stopPropagation()
    const d=decosRef.current.find(x=>x.id===id); if(!d)return
    resizeRef.current={id,corner,startMX:e.clientX,startMY:e.clientY,origX:d.x,origY:d.y,origW:d.w,origH:d.h}
    document.body.style.cursor=corner==='nw'||corner==='se'?'nw-resize':'ne-resize'
  }

  const startRotate=(e:React.MouseEvent,id:string,isDeco:boolean)=>{
    e.preventDefault(); e.stopPropagation()
    let cx:number, cy:number, startRot:number
    if(isDeco){
      const d=decosRef.current.find(x=>x.id===id)!
      cx=d.x+d.w/2; cy=d.y+d.h/2; startRot=decoRotRef.current[id]||0
    } else {
      const pos=posRef.current[id]||{x:0,y:0}
      const dims=getTableSvgDims(tables.find(t=>t.id===id)!)
      cx=pos.x+dims.w/2; cy=pos.y+dims.h/2; startRot=rotRef.current[id]||0
    }
    const mx=e.clientX/zoom; const my=e.clientY/zoom
    const startAngle=Math.atan2(my-cy,mx-cx)*180/Math.PI
    rotateRef.current={id,isDeco,centerX:cx,centerY:cy,startAngle,startRot}
    document.body.style.cursor='crosshair'
  }

  const startPan=(e:React.MouseEvent)=>{
    if((e.target as HTMLElement).closest('[data-canvas-item]'))return
    const area=canvasRef.current; if(!area)return
    panRef.current={startMX:e.clientX,startMY:e.clientY,startScrollX:area.scrollLeft,startScrollY:area.scrollTop}
    setIsPanning(true); setContextMenu(null); document.body.style.cursor='grabbing'
  }

  const onMouseMove=useCallback((e:MouseEvent)=>{
    if(resizeRef.current){
      const{id,corner,startMX,startMY,origX,origY,origW,origH}=resizeRef.current
      const dx=(e.clientX-startMX)/zoom; const dy=(e.clientY-startMY)/zoom
      setDecos(p=>p.map(d=>{
        if(d.id!==id)return d
        let{x,y,w,h}={x:origX,y:origY,w:origW,h:origH}
        if(corner.includes('e'))w=Math.max(40,origW+dx)
        if(corner.includes('s'))h=Math.max(30,origH+dy)
        if(corner.includes('w')){w=Math.max(40,origW-dx);x=origX+(origW-w)}
        if(corner.includes('n')){h=Math.max(30,origH-dy);y=origY+(origH-h)}
        return{...d,x,y,w,h}
      })); return
    }
    if(rotateRef.current){
      const{id,isDeco,centerX,centerY,startAngle,startRot}=rotateRef.current
      const mx=e.clientX/zoom; const my=e.clientY/zoom
      const angle=Math.atan2(my-centerY,mx-centerX)*180/Math.PI
      const rot=startRot+(angle-startAngle)
      if(isDeco) setDecoRotations(p=>({...p,[id]:rot}))
      else setRotations(p=>({...p,[id]:rot}))
      return
    }
    if(panRef.current){
      const{startMX,startMY,startScrollX,startScrollY}=panRef.current
      const area=canvasRef.current; if(!area)return
      area.scrollLeft=startScrollX-(e.clientX-startMX)
      area.scrollTop=startScrollY-(e.clientY-startMY); return
    }
    if(!dragRef.current)return
    const{id,isDeco,startMX,startMY,startX,startY}=dragRef.current
    const dx=(e.clientX-startMX)/zoom; const dy=(e.clientY-startMY)/zoom
    if(Math.sqrt(dx*dx+dy*dy)>4)dragRef.current.hasMoved=true
    const nx=Math.max(0,startX+dx); const ny=Math.max(0,startY+dy)
    if(isDeco)setDecos(p=>p.map(d=>d.id===id?{...d,x:nx,y:ny}:d))
    else setPositions(p=>({...p,[id]:{x:nx,y:ny}}))
  },[zoom])

  const onMouseUp=useCallback((e:MouseEvent)=>{
    document.body.style.cursor=''
    if(resizeRef.current){resizeRef.current=null;return}
    if(rotateRef.current){
      const{id,isDeco}=rotateRef.current
      if(!isDeco){const rot=rotRef.current[id]||0;if(saveRotTimer.current)clearTimeout(saveRotTimer.current);saveRotTimer.current=setTimeout(()=>onRotationSave(id,rot),400)}
      rotateRef.current=null; return
    }
    if(panRef.current){panRef.current=null;setIsPanning(false);return}
    if(!dragRef.current)return
    const{id,isDeco,hasMoved}=dragRef.current
    if(!isDeco){
      const pos=posRef.current[id]
      if(pos){if(savePosTimer.current)clearTimeout(savePosTimer.current);savePosTimer.current=setTimeout(()=>onPositionSave(id,pos.x,pos.y),600)}
      if(!hasMoved && e.button===0){const table=tables.find(t=>t.id===id);if(table)setTimeout(()=>onTableClick(table),0)}
    }
    dragRef.current=null
  },[tables,onTableClick,onPositionSave,onRotationSave])

  const onWheel=useCallback((e:WheelEvent)=>{
    if(!e.ctrlKey&&!e.metaKey)return
    e.preventDefault()
    setZoom(z=>Math.min(2,Math.max(0.3,z+(e.deltaY>0?-0.08:0.08))))
  },[])

  const [showSearch, setShowSearch] = useState(false)

  const searchLower=search.toLowerCase().trim()
  const hasSearch=searchLower.length>0
  const matchingIds=useMemo(()=>{
    if(!hasSearch)return new Set<string>()
    return new Set(tables.filter(t=>t.seats.some(s=>s.guest&&(s.guest.name.toLowerCase().includes(searchLower)||s.guest.party_members.some(m=>m.name?.toLowerCase().includes(searchLower))))).map(t=>t.id))
  },[hasSearch,searchLower,tables])

  const selectedTable=selectedId?tables.find(t=>t.id===selectedId):null

  // ── Touch events ──────────────────────────────
  const touchRef = useRef<{id:string;isDeco:boolean;startTX:number;startTY:number;startX:number;startY:number;hasMoved:boolean;longPressTimer:ReturnType<typeof setTimeout>|null}|null>(null)
  const pinchRef = useRef<{dist:number}|null>(null)

  const startTouchDrag=(e:React.TouchEvent, id:string, isDeco:boolean)=>{
    if(e.touches.length!==1)return
    e.stopPropagation()
    const t=e.touches[0]
    const pos=isDeco?(decosRef.current.find(d=>d.id===id)||{x:0,y:0}):(posRef.current[id]||{x:0,y:0})
    const timer=setTimeout(()=>{
      if(touchRef.current&&!touchRef.current.hasMoved&&!isDeco){
        const table=tables.find(x=>x.id===id)
        if(table)onTableClick(table)
        touchRef.current=null
      }
    },350)
    touchRef.current={id,isDeco,startTX:t.clientX,startTY:t.clientY,startX:pos.x,startY:pos.y,hasMoved:false,longPressTimer:timer}
    if(isDeco)setActiveDeco(id)
    else{setActiveId(id);setSelectedId(id)}
  }

  const onTouchMove=useCallback((e:TouchEvent)=>{
    if(e.touches.length===2){
      const dx=e.touches[0].clientX-e.touches[1].clientX
      const dy=e.touches[0].clientY-e.touches[1].clientY
      const dist=Math.sqrt(dx*dx+dy*dy)
      if(pinchRef.current){
        const delta=dist-pinchRef.current.dist
        setZoom(z=>Math.min(2,Math.max(0.3,z+delta*0.004)))
      }
      pinchRef.current={dist}
      return
    }
    if(!touchRef.current)return
    const t=e.touches[0]
    const{id,isDeco,startTX,startTY,startX,startY}=touchRef.current
    const dx=(t.clientX-startTX)/zoom
    const dy=(t.clientY-startTY)/zoom
    if(Math.sqrt(dx*dx+dy*dy)>6){
      touchRef.current.hasMoved=true
      if(touchRef.current.longPressTimer){clearTimeout(touchRef.current.longPressTimer);touchRef.current.longPressTimer=null}
    }
    if(!touchRef.current.hasMoved)return
    const nx=Math.max(0,startX+dx); const ny=Math.max(0,startY+dy)
    if(isDeco)setDecos(p=>p.map(d=>d.id===id?{...d,x:nx,y:ny}:d))
    else setPositions(p=>({...p,[id]:{x:nx,y:ny}}))
  },[zoom])

  const onTouchEnd=useCallback(()=>{
    pinchRef.current=null
    if(!touchRef.current)return
    const{id,isDeco,hasMoved,longPressTimer}=touchRef.current
    if(longPressTimer)clearTimeout(longPressTimer)
    if(!isDeco&&hasMoved){
      const pos=posRef.current[id]
      if(pos){if(savePosTimer.current)clearTimeout(savePosTimer.current);savePosTimer.current=setTimeout(()=>onPositionSave(id,pos.x,pos.y),600)}
    }
    if(!isDeco&&!hasMoved){
      const table=tables.find(t=>t.id===id)
      if(table)setTimeout(()=>onTableClick(table),0)
    }
    touchRef.current=null
  },[tables,onTableClick,onPositionSave])

  const onCanvasTouchStart=(e:React.TouchEvent)=>{
    if(e.touches.length===2){pinchRef.current={dist:0};return}
    const isItem=(e.target as HTMLElement).closest('[data-canvas-item]')
    if(!isItem){
      const area=canvasRef.current; if(!area)return
      panRef.current={startMX:e.touches[0].clientX,startMY:e.touches[0].clientY,startScrollX:area.scrollLeft,startScrollY:area.scrollTop}
    }
  }

  const onCanvasTouchMove=(e:TouchEvent)=>{
    if(e.touches.length===2){onTouchMove(e);return}
    if(touchRef.current){onTouchMove(e);return}
    if(panRef.current){
      const{startMX,startMY,startScrollX,startScrollY}=panRef.current
      const area=canvasRef.current; if(!area)return
      area.scrollLeft=startScrollX-(e.touches[0].clientX-startMX)
      area.scrollTop=startScrollY-(e.touches[0].clientY-startMY)
    }
  }

  const onCanvasTouchEnd=()=>{
    panRef.current=null
    onTouchEnd()
  }

  useEffect(()=>{
    window.addEventListener('mousemove',onMouseMove)
    window.addEventListener('mouseup',onMouseUp)
    const el=canvasRef.current
    if(el){
      el.addEventListener('wheel',onWheel,{passive:false})
      el.addEventListener('touchmove',onCanvasTouchMove,{passive:false})
      el.addEventListener('touchend',onCanvasTouchEnd)
    }
    return()=>{
      window.removeEventListener('mousemove',onMouseMove)
      window.removeEventListener('mouseup',onMouseUp)
      if(el){
        el.removeEventListener('wheel',onWheel)
        el.removeEventListener('touchmove',onCanvasTouchMove)
        el.removeEventListener('touchend',onCanvasTouchEnd)
      }
    }
  },[onMouseMove,onMouseUp,onWheel,onTouchMove,onTouchEnd])

  const handleBack=useCallback(()=>{
    if(savePosTimer.current){
      clearTimeout(savePosTimer.current)
      const pos=posRef.current
      tables.forEach(t=>{
        const cur=pos[t.id]
        if(cur&&(cur.x!==t.position_x||cur.y!==t.position_y)) onPositionSave(t.id,cur.x,cur.y)
      })
    }
    if(saveRotTimer.current){
      clearTimeout(saveRotTimer.current)
      const rot=rotRef.current
      tables.forEach(t=>{
        if(rot[t.id]!==undefined&&rot[t.id]!==t.rotation) onRotationSave(t.id,rot[t.id])
      })
    }
    onBack()
  },[tables,onPositionSave,onRotationSave,onBack])

  return (
    <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',flexDirection:'column',background:'#f5f5f5'}}>
      {/* ── Header ── */}
      <div style={{flexShrink:0,background:'#fff',borderBottom:'1px solid #e8e8e8',display:'flex',alignItems:'center',gap:8,padding:'8px 12px'}}>
        <button onClick={handleBack} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] hover:border-[#48C9B0] hover:text-[#48C9B0]">
          <ArrowLeft width={13} height={13}/>Lista
        </button>
        <div className="relative hidden sm:flex flex-1">
          <Search width={12} height={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#bbb]"/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar invitado…"
            className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] py-1.5 pl-7 pr-3 text-xs outline-none focus:border-[#48C9B0]"/>
          {search&&<button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#bbb]"><X width={10} height={10}/></button>}
        </div>
        {hasSearch&&<span className="hidden sm:inline-flex rounded-full bg-[#f0fdfb] px-2 py-0.5 text-[10px] font-semibold text-[#48C9B0]">{matchingIds.size} mesa{matchingIds.size!==1?'s':''}</span>}
        {selectedTable&&(
          <div className="flex items-center gap-1.5 rounded-lg border border-[#48C9B0] bg-[#f0fdfb] px-2 py-1">
            <span className="text-[11px] font-medium text-[#48C9B0]">{selectedTable.name||`#${selectedTable.number}`}</span>
            <span className="text-[10px] text-[#aaa]">{Math.round(((rotations[selectedTable.id]||0)%360+360)%360)}°</span>
            <button onClick={()=>{setRotations(p=>({...p,[selectedTable.id]:0}));onRotationSave(selectedTable.id,0)}} className="text-[#48C9B0] hover:text-[#1a9e88]"><RotateCw width={12} height={12}/></button>
          </div>
        )}
        <div className="hidden sm:flex items-center gap-2 ml-auto">
          <div className="relative">
            <button onClick={()=>setShowDecoPicker(v=>!v)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${showDecoPicker?'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]':'border-[#e0e0e0] text-[#666] hover:border-[#48C9B0] hover:text-[#48C9B0]'}`}>
              <LayoutPanelLeft width={12} height={12}/>Elementos
            </button>
            {showDecoPicker&&(
              <div className="absolute right-0 top-10 z-20 w-72 rounded-xl border border-[#e8e8e8] bg-white p-3 shadow-2xl" onClick={e=>e.stopPropagation()}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Agregar al plano</p>
                <div className="grid grid-cols-4 gap-2">
                  {DECO_ELEMENTS.map(d=>(
                    <button key={d.id} onClick={()=>addDeco(d)} className="flex flex-col items-center gap-1.5 rounded-lg border border-[#e8e8e8] p-2 hover:border-[#48C9B0] hover:bg-[#f0fdfb]">
                      <div className="h-7 w-7 text-[#888]" style={{pointerEvents:'none'}}>{DECO_ICONS[d.id]}</div>
                      <span className="text-[9px] text-[#777] leading-tight text-center">{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex overflow-hidden rounded-lg border border-[#e0e0e0]">
            <button onClick={()=>setZoom(z=>Math.min(2,z+0.1))} className="px-2.5 py-1.5 text-xs font-bold text-[#666] hover:bg-[#f5f5f5]">+</button>
            <span className="flex w-12 items-center justify-center border-x border-[#e0e0e0] text-xs text-[#888]">{Math.round(zoom*100)}%</span>
            <button onClick={()=>setZoom(z=>Math.max(0.3,z-0.1))} className="px-2.5 py-1.5 text-xs font-bold text-[#666] hover:bg-[#f5f5f5]">−</button>
          </div>
          <button onClick={onOpenCreate} className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3ab89f]">
            <Plus width={13} height={13}/>Nueva mesa
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div ref={canvasRef} className="relative flex-1 overflow-auto sm:pb-0 pb-16"
        style={{background:'#f5f5f5',cursor:isPanning?'grabbing':'grab',touchAction:'none'}}
        onMouseDown={startPan}
        onTouchStart={onCanvasTouchStart}
        onClick={e=>{
          if(!(e.target as HTMLElement).closest('[data-canvas-item]')){
            setSelectedId(null);setActiveId(null);setActiveDeco(null);setShowDecoPicker(false);setContextMenu(null);setShowSearch(false)
          }
        }}>
        <div style={{position:'absolute',inset:0,minWidth:2400,minHeight:1800,backgroundImage:'radial-gradient(circle, #bbb 1px, transparent 1px)',backgroundSize:'28px 28px',pointerEvents:'none'}}/>

        {/* Zoom flotante vertical — solo mobile */}
        <div className="sm:hidden" style={{position:'fixed',right:12,bottom:72,zIndex:55,display:'flex',flexDirection:'column',alignItems:'center',overflow:'hidden',borderRadius:10,border:'1px solid #e0e0e0',background:'#fff',boxShadow:'0 2px 12px rgba(0,0,0,0.10)'}}>
          <button onClick={e=>{e.stopPropagation();setZoom(z=>Math.min(2,z+0.1))}} style={{padding:'8px 12px',fontSize:15,fontWeight:700,color:'#555',background:'transparent',border:'none',cursor:'pointer',lineHeight:1}} onMouseDown={e=>e.stopPropagation()}>+</button>
          <span style={{display:'flex',alignItems:'center',justifyContent:'center',width:38,height:28,fontSize:10,color:'#888',borderTop:'1px solid #e0e0e0',borderBottom:'1px solid #e0e0e0'}}>{Math.round(zoom*100)}%</span>
          <button onClick={e=>{e.stopPropagation();setZoom(z=>Math.max(0.3,z-0.1))}} style={{padding:'8px 12px',fontSize:15,fontWeight:700,color:'#555',background:'transparent',border:'none',cursor:'pointer',lineHeight:1}} onMouseDown={e=>e.stopPropagation()}>−</button>
        </div>

        <div style={{position:'absolute',inset:0,minWidth:2400,minHeight:1800,transformOrigin:'top left',transform:`scale(${zoom})`}}>
          {/* Decos */}
          {decos.map(item=>{
            const isDecoActive=activeDeco===item.id
            const decoRot=decoRotations[item.id]||0
            const decoColorId=decoColors[item.id]||'default'
            const decoColor=CANVAS_COLORS.find(c=>c.id===decoColorId)||CANVAS_COLORS[0]
            return(
              <div key={item.id}
                data-canvas-item="true"
                style={{position:'absolute',left:item.x,top:item.y,width:item.w,height:item.h,transform:`rotate(${decoRot}deg)`,transformOrigin:'center'}}
                onMouseEnter={()=>handleDecoEnter(item.id)}
                onMouseLeave={()=>handleDecoLeave(item.id)}
                onContextMenu={e=>openContextMenu(e,item.id,'deco')}
                onTouchStart={e=>startTouchDrag(e,item.id,true)}>
                <DecoElement item={{...item,x:0,y:0}} isActive={isDecoActive}
                  colorFill={decoColor.fill} colorBorder={decoColor.border}
                  onMouseDown={e=>startDrag(e,item.id,true)}
                  onResizeMouseDown={(e,corner)=>startResize(e,item.id,corner)}
                  onRotateMouseDown={e=>startRotate(e,item.id,true)}
                  onClickBody={()=>setActiveDeco(item.id)}/>
              </div>
            )
          })}

          {/* Mesas */}
          {tables.map(table=>{
            const pos=positions[table.id]||{x:80,y:80}
            const rot=rotations[table.id]||0
            const occ=getOccupied(table)
            const isActive=activeId===table.id
            const isSel=selectedId===table.id
            const isHL=hasSearch&&matchingIds.has(table.id)
            const isDim=hasSearch&&!matchingIds.has(table.id)
            const dims=getTableSvgDims(table)
            const tableColorId=tableColors[table.id]||'default'
            const tableColor=CANVAS_COLORS.find(c=>c.id===tableColorId)||CANVAS_COLORS[0]

            return(
              <div key={table.id} data-canvas-item="true"
                style={{position:'absolute',left:pos.x,top:pos.y,userSelect:'none',cursor:'grab',touchAction:'none'}}
                onMouseDown={e=>startDrag(e,table.id,false)}
                onMouseEnter={()=>handleTableEnter(table.id)}
                onMouseLeave={()=>handleTableLeave(table.id)}
                onContextMenu={e=>openContextMenu(e,table.id,'table')}
                onTouchStart={e=>startTouchDrag(e,table.id,false)}>
                {isActive&&(
                  <div data-canvas-item="true"
                    onMouseDown={e=>startRotate(e,table.id,false)}
                    onMouseEnter={()=>handleTableEnter(table.id)}
                    title="Rotar mesa"
                    style={{position:'absolute',top:-30,left:'50%',transform:'translateX(-50%)',width:22,height:22,borderRadius:'50%',background:isSel?'#48C9B0':'rgba(72,201,176,0.8)',border:'2.5px solid #fff',boxShadow:'0 2px 8px rgba(0,0,0,0.18)',cursor:'crosshair',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>
                    <RotateCw width={11} height={11} color="white" style={{pointerEvents:'none'}}/>
                  </div>
                )}
                <div style={{transform:`rotate(${rot}deg)`,transformOrigin:'center',display:'inline-block'}}>
                  <TableSVG table={table} occupied={occ} isSelected={isActive} isHighlighted={isHL} isDimmed={isDim} colorFill={tableColor.fill} colorBorder={tableColor.border}/>
                </div>
                {table.name&&(
                  <div style={{width:dims.w,textAlign:'center',marginTop:3,opacity:isDim?0.2:1,pointerEvents:'none'}}>
                    <span style={{fontSize:11,fontWeight:600,color:isSel?'#48C9B0':'#555',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{table.name}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Menú contextual ── */}
      {contextMenu&&(
        <ContextMenu menu={contextMenu} onColor={handleContextColor} onDuplicate={handleContextDuplicate}
          onDelete={(id,type)=>{if(type==='deco')handleContextDelete(id,type);else{const t=tables.find(x=>x.id===id);if(t)onTableClick(t)}}}
          onClose={()=>setContextMenu(null)}/>
      )}

      {/* ── Barra flotante inferior — SOLO MOBILE ── */}
      <div className="sm:hidden flex items-center gap-2" style={{position:'fixed',bottom:0,left:0,right:0,zIndex:60,background:'#fff',borderTop:'1px solid #e8e8e8',padding:'8px 12px'}}>
        {showSearch?(
          <div className="relative flex-1">
            <Search width={12} height={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#bbb]"/>
            <input autoFocus type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar invitado…"
              className="w-full rounded-lg border border-[#48C9B0] bg-[#f8f8f8] py-1.5 pl-7 pr-6 text-xs outline-none"/>
            <button onClick={()=>{setSearch('');setShowSearch(false)}} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#bbb]"><X width={10} height={10}/></button>
          </div>
        ):(
          <button onClick={()=>setShowSearch(true)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${hasSearch?'border-[#48C9B0] bg-[#f0fdfb] text-[#48C9B0]':'border-[#e0e0e0] text-[#666]'}`}>
            <Search width={12} height={12}/>{hasSearch?`${matchingIds.size} mesas`:'Buscar'}
          </button>
        )}
        {!showSearch&&(
          <div className="relative">
            <button onClick={()=>setShowDecoPicker(v=>!v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${showDecoPicker?'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]':'border-[#e0e0e0] text-[#666]'}`}>
              <LayoutPanelLeft width={12} height={12}/>Elementos
            </button>
            {showDecoPicker&&(
              <div style={{position:'absolute',bottom:48,left:0,width:280,background:'#fff',borderRadius:12,border:'1px solid #e8e8e8',boxShadow:'0 -4px 20px rgba(0,0,0,0.12)',padding:12,zIndex:70}} onClick={e=>e.stopPropagation()}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Agregar al plano</p>
                <div className="grid grid-cols-4 gap-2">
                  {DECO_ELEMENTS.map(d=>(
                    <button key={d.id} onClick={()=>addDeco(d)} className="flex flex-col items-center gap-1.5 rounded-lg border border-[#e8e8e8] p-2 hover:border-[#48C9B0] hover:bg-[#f0fdfb]">
                      <div className="h-7 w-7 text-[#888]" style={{pointerEvents:'none'}}>{DECO_ICONS[d.id]}</div>
                      <span className="text-[9px] text-[#777] leading-tight text-center">{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <button onClick={onOpenCreate} className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white">
          <Plus width={13} height={13}/>Nueva mesa
        </button>
      </div>

      {/* Eliminar elemento deco activo — solo mobile */}
      {activeDeco&&(
        <div className="sm:hidden" style={{position:'fixed',top:56,right:8,zIndex:59}}>
          <button onClick={e=>{e.stopPropagation();setDecos(p=>p.filter(d=>d.id!==activeDeco));setActiveDeco(null)}}
            style={{display:'flex',alignItems:'center',gap:6,borderRadius:8,border:'1px solid #ffe0e0',background:'#fff5f5',padding:'6px 10px',fontSize:11,color:'#cc3333',cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
            <Trash2 width={11} height={11}/>Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── SUBCOMPONENTES LISTA ─────────────────────
function TagSelector({ availableTags, selectedTags, onChange }: { availableTags:string[]; selectedTags:string[]; onChange:(t:string[])=>void }) {
  if(!availableTags.length)return<p className="text-xs text-[#bbb]">Sin tags — agrégalos desde Configuración.</p>
  return(
    <div className="flex flex-wrap gap-1.5">
      {availableTags.map((tag,i)=>{const c=TAG_COLORS[i%TAG_COLORS.length];const on=selectedTags.includes(tag);return(
        <button key={tag} type="button" onClick={()=>onChange(on?selectedTags.filter(x=>x!==tag):[...selectedTags,tag])} className="rounded-full border px-2.5 py-1 text-xs font-medium transition"
          style={on?{background:c.bg,borderColor:c.border,color:c.text}:{background:'#f8f8f8',borderColor:'#e0e0e0',color:'#aaa'}}>{tag}</button>
      )})}
    </div>
  )
}

function MembersEditor({ value, onChange }: { value:EditMember[]; onChange:(v:EditMember[])=>void }) {
  const MAX=15
  return(
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-medium text-[#555]">Acompañantes <span className="font-normal text-[#ccc]">(máx. {MAX})</span></label>
        {value.length<MAX&&<button type="button" onClick={()=>onChange([...value,{name:'',phone:'',rsvp_status:'pending'}])} className="text-xs font-semibold text-[#48C9B0] hover:underline">+ Agregar</button>}
      </div>
      {!value.length&&<p className="text-xs text-[#bbb]">Sin acompañantes.</p>}
      <div className="flex flex-col gap-2">
        {value.map((m,i)=>(
          <div key={i} className="rounded-lg border border-[#e8e8e8] bg-[#f8f8f8] p-3">
            <div className="mb-2 text-[11px] font-semibold text-[#aaa]">+{i+1}</div>
            <div className="flex flex-col gap-2">
              <input type="text" value={m.name} onChange={e=>onChange(value.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder="Nombre (opcional)" className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-2 text-base text-[#1D1E20] outline-none"/>
              <input type="tel" value={m.phone} onChange={e=>onChange(value.map((x,j)=>j===i?{...x,phone:e.target.value}:x))} placeholder="WhatsApp (opcional)" className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-2 text-base text-[#1D1E20] outline-none"/>
              <select value={m.rsvp_status} onChange={e=>onChange(value.map((x,j)=>j===i?{...x,rsvp_status:e.target.value as EditMember['rsvp_status']}:x))} className="w-full cursor-pointer rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-2 text-base text-[#1D1E20] outline-none">
                <option value="pending">Pendiente</option><option value="confirmed">Confirmado</option><option value="declined">Declinó</option>
              </select>
              <button type="button" onClick={()=>onChange(value.filter((_,j)=>j!==i))} className="w-full rounded-lg border border-[#ffe0e0] bg-[#fff5f5] py-1.5 text-xs font-semibold text-[#cc3333] hover:bg-[#ffe8e8]">Eliminar acompañante</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DonutChart({value,total}:{value:number;total:number}) {
  const r=16;const c=2*Math.PI*r;const d=Math.min(value/Math.max(total,1),1)*c
  return(<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r={r} fill="none" stroke="#e8e8e8" strokeWidth="5"/><circle cx="22" cy="22" r={r} fill="none" stroke="#48C9B0" strokeWidth="5" strokeDasharray={`${d} ${c}`} strokeLinecap="round" transform="rotate(-90 22 22)"/></svg>)
}

// ─── MODALES REUTILIZABLES ────────────────────
function ModalMesa({ visible=true, editTable, mNum, setMNum, mName, setMName, mCap, setMCap, mShape, setMShape, mError, mSaving, onSave, onClose, inp }: {
  visible?:boolean; editTable:TableRecord|null; mNum:string; setMNum:(v:string)=>void; mName:string; setMName:(v:string)=>void; mCap:string; setMCap:(v:string)=>void; mShape:string; setMShape:(v:string)=>void; mError:string; mSaving:boolean; onSave:()=>void; onClose:()=>void; inp:string
}) {
  const shapes: TableShape[] = ['round','oval','rectangle','square','halfmoon','row']
  return(
    <Modal open={visible} onClose={onClose} size="sm">
      <Modal.Header title={editTable?'Editar mesa':'Nueva mesa'}/>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1.5 block text-xs font-medium text-[#555]"># Mesa *</label><input type="number" min="1" value={mNum} onChange={e=>setMNum(e.target.value)} className={inp} placeholder="1"/></div>
            <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Capacidad *</label><input type="number" min="1" max="100" value={mCap} onChange={e=>setMCap(e.target.value)} className={inp} placeholder="8"/></div>
          </div>
          <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Nombre <span className="font-normal text-[#ccc]">(opcional)</span></label><input type="text" value={mName} onChange={e=>setMName(e.target.value)} className={inp} placeholder="Ej: Mesa de honor…"/></div>
          <div>
            <label className="mb-2 block text-xs font-medium text-[#555]">Forma</label>
            <div className="grid grid-cols-3 gap-2">
              {shapes.map(s=>(
                <button key={s} type="button" onClick={()=>setMShape(s)} className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition ${mShape===s?'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]':'border-[#e0e0e0] text-[#888] hover:border-[#48C9B0]'}`}>
                  <div className="flex h-10 w-full items-center justify-center">{SHAPE_ICONS[s]}</div>
                  <span className="text-[10px]">{SHAPE_LABELS[s]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {mError&&<div className="mt-3 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">{mError}</div>}
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="flex-1 rounded-lg border border-[#e0e0e0] py-3 text-sm text-[#888]">Cancelar</button>
        <button onClick={onSave} disabled={mSaving} className="flex-[2] rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">{mSaving?'Guardando…':editTable?'Guardar cambios':'Crear mesa'}</button>
      </Modal.Footer>
    </Modal>
  )
}

function ModalAsignar({ tables, guests, assignModal, assignSearch, setAssignSearch, assignRef, gSeatMap, getOccupied, handleSelectGuest, onClose }: {
  tables:TableRecord[]; guests:GuestFull[]; assignModal:{tableId:string;tableCapacity:number}|null; assignSearch:string; setAssignSearch:(v:string)=>void; assignRef:React.RefObject<HTMLInputElement|null>; gSeatMap:Map<string,any>; getOccupied:(t:TableRecord)=>number; handleSelectGuest:(gId:string,tId:string,cap:number)=>void; onClose:()=>void
}) {
  if(!assignModal)return null
  const table=tables.find(t=>t.id===assignModal.tableId)
  if(!table)return null
  const occ=getOccupied(table); const avail=table.capacity-occ
  const isFull=avail<=0
  const filtered=assignSearch?guests.filter(g=>g.name.toLowerCase().includes(assignSearch.toLowerCase())):guests
  return(
    <Modal open onClose={onClose} size="sm">
      <div className="shrink-0 border-b border-[#f0f0f0] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#1D1E20]">
              Asignar a <span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-xs font-bold text-[#555]">#{table.number}</span>{table.name||`Mesa ${table.number}`}
            </p>
            <p className="text-[11px]" style={{color:isFull?'#cc3333':'#aaa'}}>
              {isFull ? 'Mesa llena' : `${avail} asiento(s) disponible(s) · ${occ}/${table.capacity}`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3ab89f]">Listo</button>
        </div>
        <div className="relative mt-3">
          <Search width={13} height={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]"/>
          <input ref={assignRef} type="text" value={assignSearch} onChange={e=>setAssignSearch(e.target.value)} placeholder="Buscar invitado..." className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] py-2 pl-8 pr-3 text-base outline-none focus:border-[#48C9B0]"/>
        </div>
      </div>
      {/* lista a sangre: el primitivo no expone un cuerpo sin respiro lateral */}
      <div className="min-h-0 flex-1 overflow-y-auto">
          {!filtered.length?<p className="px-4 py-6 text-center text-xs text-[#bbb]">Sin resultados</p>:filtered.map(g=>{
            const need=1+g.party_members.length
            const ex=gSeatMap.get(g.id)
            const here=ex?.tableId===assignModal.tableId
            const elsewhere=ex&&!here
            const noSpace=need>avail&&!here&&!elsewhere
            return(
              <button key={g.id}
                onClick={()=>{ if(!here && !noSpace) handleSelectGuest(g.id,assignModal.tableId,table.capacity) }}
                disabled={here||noSpace}
                className={`flex w-full items-center gap-3 border-b border-[#f5f5f5] px-4 py-3 text-left transition last:border-0 ${here||noSpace?'cursor-not-allowed opacity-40':'cursor-pointer hover:bg-[#f0fdfb]'}`}>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-[#1D1E20]">{g.name}</span>
                    {need>1&&<span className="shrink-0 rounded-full border border-[#9FE1CB] bg-[#f0fdfb] px-1.5 text-[9px] font-semibold text-[#0F6E56]">+{need-1}</span>}
                    {here&&<span className="shrink-0 rounded-full bg-[#f0fdfb] px-1.5 text-[9px] font-semibold text-[#48C9B0]">Ya asignado</span>}
                    {elsewhere&&<span className="shrink-0 rounded-full border border-[#f0d080] bg-[#fffbf0] px-1.5 text-[9px] font-semibold text-[#b8860b]">#{ex.tableNumber}</span>}
                  </div>
                  {noSpace&&<span className="text-[10px] text-[#cc3333]">Necesita {need} asientos — hay {avail}</span>}
                  {elsewhere&&!noSpace&&<span className="text-[10px] text-[#b8860b]">Mover a esta mesa</span>}
                </div>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{background:STATUS_COLORS[g.rsvp_status].bg,borderColor:STATUS_COLORS[g.rsvp_status].border,color:STATUS_COLORS[g.rsvp_status].text}}>{STATUS_COLORS[g.rsvp_status].label.slice(0,4)}</span>
              </button>
            )
          })}
      </div>
    </Modal>
  )
}

function ModalMover({ moveModal, tables, moveSaving, onConfirm, onClose }: {
  moveModal:MoveModal|null; tables:TableRecord[]; moveSaving:boolean; onConfirm:()=>void; onClose:()=>void
}) {
  if(!moveModal)return null
  return(
    <Modal open onClose={onClose} size="sm">
      <Modal.Body className="py-6 text-center">
        <h2 className="text-base font-bold text-[#1D1E20]">¿Mover a otra mesa?</h2>
        <p className="mt-2 text-sm text-[#555]"><span className="font-semibold">{moveModal.guest.name}</span>{moveModal.guest.party_size>1&&<span className="text-[#888]"> +{moveModal.guest.party_size-1}</span>}{' '}está en <span className="font-semibold">Mesa #{moveModal.fromTableNumber}</span>. ¿Mover a <span className="font-semibold">Mesa #{tables.find(t=>t.id===moveModal.toTableId)?.number}</span>?</p>
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="flex-1 rounded-lg border border-[#e0e0e0] py-3 text-sm text-[#888]">Cancelar</button>
        <button onClick={onConfirm} disabled={moveSaving} className="flex-[2] rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">{moveSaving?'Moviendo…':'Sí, mover'}</button>
      </Modal.Footer>
    </Modal>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────
function MesasPageInner() {
  const {id:eventId}=useParams()

  // Toggle de estadísticas en mobile (persiste por evento en localStorage)
  const { visible: statsVisible, toggle: toggleStats } = useStatsToggle(eventId as string, 'tables')
  const askConfirm = useConfirm()
  const permiso = usePermiso('mesas')

  const [tables,setTables]=useState<TableRecord[]>([])
  const [guests,setGuests]=useState<GuestFull[]>([])
  const [eventTags,setEventTags]=useState<string[]>([])
  const [eventInfo,setEventInfo]=useState<EventInfo|null>(null)
  const [loading,setLoading]=useState(true)
  const [canvasMode,setCanvasMode]=useState(false)
  const [listSearch,setListSearch]=useState('')
  const [expanded,setExpanded]=useState<Set<string>>(new Set())

  const [showModal,setShowModal]=useState(false)
  const [editTable,setEditTable]=useState<TableRecord|null>(null)
  const [mNum,setMNum]=useState('')
  const [mName,setMName]=useState('')
  const [mCap,setMCap]=useState('8')
  const [mShape,setMShape]=useState('round')
  const [mSaving,setMSaving]=useState(false)
  const [mError,setMError]=useState('')

  const [showBulk,setShowBulk]=useState(false)
  const [bCount,setBCount]=useState('5')
  const [bCap,setBCap]=useState('8')
  const [bShape,setBShape]=useState('round')
  const [bSaving,setBSaving]=useState(false)
  const [bError,setBError]=useState('')

  const [canvasDetailId,setCanvasDetailId]=useState<string|null>(null)
  const canvasDetail = canvasDetailId ? (tables.find(t=>t.id===canvasDetailId) ?? null) : null
  const [assignModal,setAssignModal]=useState<{tableId:string;tableCapacity:number}|null>(null)
  const [assignSearch,setAssignSearch]=useState('')
  const [moveModal,setMoveModal]=useState<MoveModal|null>(null)
  const [moveSaving,setMoveSaving]=useState(false)
  const assignRef=useRef<HTMLInputElement>(null)
  const canvasSaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null)

  const [canvasDecos,       setCanvasDecos]       = useState<DecoItem[]>([])
  const [canvasDecoRots,    setCanvasDecoRots]    = useState<Record<string,number>>({})
  const [canvasTableColors, setCanvasTableColors] = useState<Record<string,string>>({})
  const [canvasDecoColors,  setCanvasDecoColors]  = useState<Record<string,string>>({})
  const [canvasLoaded,      setCanvasLoaded]      = useState(false)

  // Auto-save canvas state a Supabase con debounce de 1.2s
  useEffect(()=>{
    if(!canvasLoaded)return
    if(canvasSaveTimer.current)clearTimeout(canvasSaveTimer.current)
    canvasSaveTimer.current=setTimeout(()=>{
      supabase.from('events').update({canvas_data:{decos:canvasDecos,decoRotations:canvasDecoRots,tableColors:canvasTableColors,decoColors:canvasDecoColors}}).eq('id',eventId as string).then(()=>{})
    },1200)
    return()=>{if(canvasSaveTimer.current)clearTimeout(canvasSaveTimer.current)}
  },[canvasDecos,canvasDecoRots,canvasTableColors,canvasDecoColors,canvasLoaded])

  const [editGuest,setEditGuest]=useState<GuestFull|null>(null)
  const [eName,setEName]=useState('')
  const [ePhone,setEPhone]=useState('')
  const [eEmail,setEEmail]=useState('')
  const [eNotes,setENotes]=useState('')
  const [eTags,setETags]=useState<string[]>([])
  const [eMembers,setEMembers]=useState<EditMember[]>([])
  const [eSaving,setESaving]=useState(false)
  const [eError,setEError]=useState('')

  useEffect(()=>{loadData()},[])
  useEffect(()=>{if(assignModal)setTimeout(()=>assignRef.current?.focus(),50)},[assignModal])

  const loadData=async()=>{
    setLoading(true)
    const [tR,sR,gR,mR,eR]=await Promise.all([
      supabase.from('tables').select('*').eq('event_id',eventId).order('number'),
      supabase.from('table_seats').select('*').eq('event_id',eventId),
      supabase.from('guests').select('id,name,rsvp_status,tags,party_size,notes,phone,email,checked_in').eq('event_id',eventId).order('name'),
      supabase.from('party_members').select('id,guest_id,name,rsvp_status,checked_in').eq('event_id',eventId),
      supabase.from('events').select('guest_tags,name,event_date,venue,canvas_data').eq('id',eventId).single(),
    ])
    const gMap=new Map<string,GuestFull>()
    for(const g of(gR.data||[])){const members=(mR.data||[]).filter(m=>m.guest_id===g.id);gMap.set(g.id,{...g,tags:g.tags||[],notes:g.notes||null,phone:g.phone||null,email:g.email||null,checked_in:g.checked_in||false,party_size:1+members.length,party_members:members.map(m=>({...m,checked_in:m.checked_in||false}))})}
    const combined:TableRecord[]=(tR.data||[]).map(t=>({...t,rotation:t.rotation||0,seats:(sR.data||[]).filter(s=>s.table_id===t.id).map(s=>({...s,guest:s.guest_id?gMap.get(s.guest_id)||null:null}))}))
    setTables(combined);setGuests(Array.from(gMap.values()))
    setEventTags(eR.data?.guest_tags||[])
    setEventInfo({name:eR.data?.name||'',event_date:eR.data?.event_date||null,venue:eR.data?.venue||null})
    const cd=eR.data?.canvas_data
    if(cd){
      if(cd.decos)          setCanvasDecos(cd.decos)
      if(cd.decoRotations)  setCanvasDecoRots(cd.decoRotations)
      if(cd.tableColors)    setCanvasTableColors(cd.tableColors)
      if(cd.decoColors)     setCanvasDecoColors(cd.decoColors)
    }
    setCanvasLoaded(true)
    setLoading(false)
  }

  const loadTables=async()=>{
    const [tR,sR,gR,mR]=await Promise.all([
      supabase.from('tables').select('*').eq('event_id',eventId).order('number'),
      supabase.from('table_seats').select('*').eq('event_id',eventId),
      supabase.from('guests').select('id,name,rsvp_status,tags,party_size,notes,phone,email,checked_in').eq('event_id',eventId).order('name'),
      supabase.from('party_members').select('id,guest_id,name,rsvp_status,checked_in').eq('event_id',eventId),
    ])
    const gMap=new Map<string,GuestFull>()
    for(const g of(gR.data||[])){const members=(mR.data||[]).filter(m=>m.guest_id===g.id);gMap.set(g.id,{...g,tags:g.tags||[],notes:g.notes||null,phone:g.phone||null,email:g.email||null,checked_in:g.checked_in||false,party_size:1+members.length,party_members:members.map(m=>({...m,checked_in:m.checked_in||false}))})}
    const combined:TableRecord[]=(tR.data||[]).map(t=>({...t,rotation:t.rotation||0,seats:(sR.data||[]).filter(s=>s.table_id===t.id).map(s=>({...s,guest:s.guest_id?gMap.get(s.guest_id)||null:null}))}))
    setTables(combined); setGuests(Array.from(gMap.values()))
  }

  const getOccupied=(t:TableRecord)=>t.seats.filter(s=>s.guest_id).reduce((a,s)=>a+(s.guest?s.guest.party_size:(s.party_size||1)),0)
  const nextNum=()=>{if(!tables.length)return 1;const u=new Set(tables.map(t=>t.number));let n=1;while(u.has(n))n++;return n}

  const gSeatMap=useMemo(()=>{const m=new Map<string,any>();for(const t of tables)for(const s of t.seats)if(s.guest_id)m.set(s.guest_id,{seatId:s.id,tableNumber:t.number,tableId:t.id,tableCapacity:t.capacity});return m},[tables])

  const confirmed=guests.filter(g=>g.rsvp_status==='confirmed').length
  const seatedIds=useMemo(()=>{const s=new Set<string>();for(const t of tables)for(const seat of t.seats)if(seat.guest_id)s.add(seat.guest_id);return s},[tables])
  const unassigned=guests.filter(g=>g.rsvp_status==='confirmed'&&!seatedIds.has(g.id)).length
  const totalSeats=tables.reduce((a,t)=>a+t.capacity,0)
  const totalFree=totalSeats-tables.reduce((a,t)=>a+getOccupied(t),0)
  const fullTables=tables.filter(t=>getOccupied(t)>=t.capacity).length

  const openEditGuest=(g:GuestFull)=>{
    setEditGuest(g)
    setEName(g.name)
    setEPhone(g.phone||'')
    setEEmail(g.email||'')
    setENotes(g.notes||'')
    setETags(g.tags||[])
    setEError('')
    setEMembers(g.party_members.map(m=>({id:m.id,name:m.name,phone:'',rsvp_status:m.rsvp_status})))
  }

  // ─── FIX: handleEditSave con validacion de capacidad ─────────────────────
  const handleEditSave = async () => {
    if (!permiso.editar) return
    if (!editGuest) return
    if (!eName) { setEError('El nombre es obligatorio'); return }

    if (ePhone) {
      const n = normalizePhone(ePhone)
      const dup = guests.find(g => g.id !== editGuest.id && g.phone && normalizePhone(g.phone) === n)
      if (dup) { setEError(`WhatsApp ya registrado para "${dup.name}"`); return }
    }

    const newPartySize = 1 + eMembers.length

    // Validar capacidad solo si el invitado ya está asignado a una mesa
    const seatRecord = gSeatMap.get(editGuest.id)
    if (seatRecord) {
      const assignedTable = tables.find(t => t.id === seatRecord.tableId)
      if (assignedTable) {
        const currentOccupied = getOccupied(assignedTable)
        // Espacio real = capacidad total - ocupados + lo que ocupa este grupo actualmente
        // (descontamos el grupo actual porque va a ser reemplazado por el nuevo tamaño)
        const spaceAvailableForThisGroup = assignedTable.capacity - currentOccupied + editGuest.party_size
        if (newPartySize > spaceAvailableForThisGroup) {
          setEError(
            `Sin espacio en Mesa #${seatRecord.tableNumber}: necesitas ${newPartySize} asiento(s) ` +
            `pero solo hay ${spaceAvailableForThisGroup} disponible(s) para este grupo. ` +
            `Reduce acompañantes o mueve al invitado a otra mesa primero.`
          )
          return
        }
      }
    }

    setESaving(true)
    setEError('')

    await supabase.from('guests').update({
      name: eName,
      phone: ePhone || null,
      email: eEmail || null,
      party_size: newPartySize,
      notes: eNotes || null,
      tags: eTags,
    }).eq('id', editGuest.id)

    // Eliminar acompañantes removidos
    const keepIds = eMembers.filter(m => m.id).map(m => m.id as string)
    const toDel = editGuest.party_members.map(m => m.id).filter(id => !keepIds.includes(id))
    if (toDel.length) await supabase.from('party_members').delete().in('id', toDel)

    // Actualizar acompañantes existentes
    for (const m of eMembers.filter(m => m.id)) {
      await supabase.from('party_members').update({
        name: m.name,
        phone: m.phone || null,
        rsvp_status: m.rsvp_status,
      }).eq('id', m.id!)
    }

    // Insertar acompañantes nuevos
    const ins = eMembers.filter(m => !m.id)
    if (ins.length) {
      await supabase.from('party_members').insert(
        ins.map(m => ({
          guest_id: editGuest.id,
          event_id: eventId as string,
          name: m.name,
          phone: m.phone || null,
          rsvp_status: m.rsvp_status,
        }))
      )
    }

    // Actualizar party_size en table_seats si está asignado
    if (seatRecord) {
      await supabase.from('table_seats').update({ party_size: newPartySize }).eq('id', seatRecord.seatId)
    }

    await loadTables()
    setEditGuest(null)
    setESaving(false)
  }

  const toggleCheckin=async(gId:string,cur:boolean)=>{
    if (!permiso.editar) return
    await supabase.from('guests').update({checked_in:!cur}).eq('id',gId);setTables(p=>p.map(t=>({...t,seats:t.seats.map(s=>s.guest?.id!==gId?s:{...s,guest:{...s.guest!,checked_in:!cur}})})))}
  const toggleMemberCheckin=async(mId:string,gId:string,cur:boolean)=>{
    if (!permiso.editar) return
    await supabase.from('party_members').update({checked_in:!cur}).eq('id',mId);setTables(p=>p.map(t=>({...t,seats:t.seats.map(s=>{if(s.guest?.id!==gId)return s;return{...s,guest:{...s.guest!,party_members:s.guest!.party_members.map(m=>m.id===mId?{...m,checked_in:!cur}:m)}}})})))}

  const openCreate=()=>{setEditTable(null);setMNum(String(nextNum()));setMName('');setMCap('8');setMShape('round');setMError('');setShowModal(true)}
  const openEditTable=(t:TableRecord)=>{setEditTable(t);setMNum(String(t.number));setMName(t.name||'');setMCap(String(t.capacity));setMShape(t.shape);setMError('');setShowModal(true)}
  const handleSaveTable=async()=>{
    if (!permiso.editar) return
    const num=parseInt(mNum);if(!mNum||isNaN(num)||num<1){setMError('Número obligatorio');return}
    const cap=parseInt(mCap);if(!cap||cap<1||cap>100){setMError('Capacidad entre 1 y 100');return}
    if(tables.find(t=>t.number===num&&t.id!==editTable?.id)){setMError(`Mesa ${num} ya existe`);return}
    setMSaving(true);setMError('')
    if(editTable)await supabase.from('tables').update({number:num,name:mName||null,capacity:cap,shape:mShape}).eq('id',editTable.id)
    else await supabase.from('tables').insert({event_id:eventId,number:num,name:mName||null,capacity:cap,shape:mShape,rotation:0})
    await loadTables();setShowModal(false);setMSaving(false)
  }
  const handleDeleteTable=async(t:TableRecord)=>{
    if (!permiso.borrar) return
    const sentados=getOccupied(t)
    const ok=await askConfirm({
      title:`¿Eliminar la Mesa ${t.number}${t.name?' — '+t.name:''}?`,
      message:sentados>0
        ?`${sentados===1?'La persona sentada ahí vuelve':`Las ${sentados} personas sentadas ahí vuelven`} a la lista sin mesa. Nadie se borra del evento.`
        :'La mesa está vacía, no afecta a ningún invitado.',
    })
    if(!ok)return
    await supabase.from('tables').delete().eq('id',t.id);setTables(p=>p.filter(x=>x.id!==t.id))
  }

  const previewNums=(count:number)=>{const u=new Set(tables.map(t=>t.number));const r:number[]=[];let n=1;while(r.length<count){if(!u.has(n))r.push(n);n++};return r}
  const handleBulk=async()=>{
    if (!permiso.editar) return
    const c=parseInt(bCount),cap=parseInt(bCap)
    if(!c||c<1||c>50){setBError('Entre 1 y 50');return}if(!cap||cap<1||cap>100){setBError('Cap. entre 1 y 100');return}
    setBSaving(true);setBError('')
    await supabase.from('tables').insert(previewNums(c).map(n=>({event_id:eventId as string,number:n,name:null,capacity:cap,shape:bShape,rotation:0})))
    await loadTables();setShowBulk(false);setBSaving(false)
  }

  const doAssign=async(tableId:string,cap:number,guest:GuestFull)=>{
    if (!permiso.editar) return
    const t=tables.find(x=>x.id===tableId)!;const occ=getOccupied(t);const need=1+guest.party_members.length
    if(need>cap-occ){alert(`Sin espacio. "${guest.name}" necesita ${need} asiento(s), solo hay ${cap-occ} libre(s).`);return}
    const next=(t.seats.map(s=>s.seat_number).sort((a,b)=>b-a)[0]||0)+1
    await supabase.from('table_seats').insert({table_id:tableId,event_id:eventId,seat_number:next,guest_id:guest.id,party_size:need})
    await loadTables()
    setAssignSearch('')
  }
  const handleSelectGuest=(gId:string,tableId:string,cap:number)=>{
    const g=guests.find(x=>x.id===gId)!;const ex=gSeatMap.get(gId)
    if(ex&&ex.tableId!==tableId){setMoveModal({guest:g,fromSeatId:ex.seatId,fromTableNumber:ex.tableNumber,toTableId:tableId,toTableCapacity:cap});setAssignModal(null);setAssignSearch('');return}
    doAssign(tableId,cap,g)
  }
  const handleMove=async()=>{
    if (!permiso.editar) return
    if(!moveModal)return;setMoveSaving(true)
    const{guest,fromSeatId,toTableId,toTableCapacity}=moveModal
    const t=tables.find(x=>x.id===toTableId)!;const need=1+guest.party_members.length
    if(need>toTableCapacity-getOccupied(t)){alert('Sin espacio en mesa destino.');setMoveSaving(false);setMoveModal(null);return}
    await supabase.from('table_seats').delete().eq('id',fromSeatId)
    const next=(t.seats.map(s=>s.seat_number).sort((a,b)=>b-a)[0]||0)+1
    await supabase.from('table_seats').insert({table_id:toTableId,event_id:eventId,seat_number:next,guest_id:guest.id,party_size:need})
    await loadTables();setMoveModal(null);setMoveSaving(false)
  }
  const removeGuest=async(seatId:string,name:string)=>{
    if (!permiso.editar) return
    const ok=await askConfirm({
      title:`¿Quitar a ${name} de esta mesa?`,
      message:'Vuelve a la lista de invitados sin mesa. No se borra del evento.',
      confirmLabel:'Quitar',
    })
    if(!ok)return
    await supabase.from('table_seats').delete().eq('id',seatId);await loadTables()
  }
  const handlePosSave=async(id:string,x:number,y:number)=>{
    if (!permiso.editar) return
    await supabase.from('tables').update({position_x:x,position_y:y}).eq('id',id)
    setTables(p=>p.map(t=>t.id===id?{...t,position_x:x,position_y:y}:t))
  }
  const handleRotSave=async(id:string,rotation:number)=>{
    if (!permiso.editar) return
    await supabase.from('tables').update({rotation}).eq('id',id)
    setTables(p=>p.map(t=>t.id===id?{...t,rotation}:t))
  }

  const handlePrint=()=>{
    const fd=(d:string)=>{const[y,mo,day]=d.split('T')[0].split('-').map(Number);return new Date(y,mo-1,day).toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
    const rows:string[]=[]; let n=1
    for(const t of tables){const ml=t.name?`${t.number} · ${t.name}`:String(t.number);for(const s of t.seats){const g=s.guest;if(!g)continue;rows.push(`<tr class="mr"><td>${n++}</td><td>${ml}</td><td class="nb">${g.name}</td><td>${STATUS_COLORS[g.rsvp_status].label}</td><td>${g.tags.join(', ')||'—'}</td><td>${g.notes||'—'}</td><td class="cc"><div class="cb"></div></td></tr>`);for(const m of g.party_members)rows.push(`<tr class="ar"><td>${n++}</td><td></td><td class="mn">↳ ${m.name||'Acompañante'}</td><td>${STATUS_COLORS[m.rsvp_status].label}</td><td>—</td><td>—</td><td class="cc"><div class="cb"></div></td></tr>`)}}
    const total=tables.reduce((a,t)=>a+t.seats.reduce((b,s)=>b+(s.guest?1+s.guest.party_members.length:0),0),0)
    const pd=new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})
    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;font-size:11px;color:#1D1E20;padding:20px}.hd{margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #1D1E20}.hd h1{font-size:18px;font-weight:700}.hm{display:flex;gap:20px;margin-top:5px;font-size:10px;color:#888}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;color:#888;padding:5px 8px;border-bottom:1.5px solid #1D1E20}.mr td{padding:6px 8px;border-bottom:1px solid #e8e8e8;white-space:nowrap}.ar td{padding:3px 8px;border-bottom:1px solid #f0f0f0;color:#666;white-space:nowrap}.nb{font-weight:600}.mn{padding-left:14px!important}.cc{text-align:center}.cb{display:inline-block;width:14px;height:14px;border:1.5px solid #1D1E20;border-radius:3px}.ft{margin-top:14px;padding-top:8px;border-top:1px solid #e8e8e8;font-size:9px;color:#aaa;display:flex;justify-content:space-between}.fb{font-weight:700;color:#48C9B0}@media print{body{padding:0}@page{margin:1.2cm;size:A4 landscape}tr{page-break-inside:avoid}}</style></head><body><div class="hd"><h1>${eventInfo?.name||'Lista'}</h1><div class="hm">${eventInfo?.event_date?`<span>📅 ${fd(eventInfo.event_date)}</span>`:''} ${eventInfo?.venue?`<span>📍 ${eventInfo.venue}</span>`:''}<span>👥 ${total} personas · ${tables.length} mesas</span></div></div><table><thead><tr><th>#</th><th>Mesa</th><th>Nombre</th><th>RSVP</th><th>Tags</th><th>Notas</th><th style="text-align:center">Llegó</th></tr></thead><tbody>${rows.join('')}</tbody></table><div class="ft"><span class="fb">Anfiora</span><span>Impreso el ${pd}</span></div></body></html>`
    const iframe=document.createElement('iframe');iframe.style.cssText='position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';document.body.appendChild(iframe)
    const doc=iframe.contentDocument||iframe.contentWindow?.document;if(!doc){document.body.removeChild(iframe);return}
    doc.open();doc.write(html);doc.close()
    iframe.onload=()=>{try{iframe.contentWindow?.focus();iframe.contentWindow?.print()}finally{setTimeout(()=>{if(document.body.contains(iframe))document.body.removeChild(iframe)},1000)}}
  }

  const TagChips=({tags}:{tags:string[]})=>(<>{tags.length===0?<span className="text-[11px] text-[#ddd]">—</span>:tags.map(tag=>{const i=eventTags.indexOf(tag);const c=TAG_COLORS[i>=0?i%TAG_COLORS.length:0];return<span key={tag} className="rounded-full border px-1.5 py-0.5 text-[9px] font-medium" style={{background:c.bg,borderColor:c.border,color:c.text}}>{tag}</span>})}</>)

  if(loading)return(<div className="flex h-full items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]"/><p className="text-sm text-[#999]">Cargando mesas...</p></div></div>)

  // ── CANVAS ──
  if(canvasMode)return(
    <>
      <CanvasFullscreen tables={tables} getOccupied={getOccupied} onBack={()=>setCanvasMode(false)} onTableClick={t=>setCanvasDetailId(t.id)} onPositionSave={handlePosSave} onRotationSave={handleRotSave} onOpenCreate={openCreate} puedeEditar={permiso.editar}
        decos={canvasDecos} setDecos={setCanvasDecos}
        decoRotations={canvasDecoRots} setDecoRotations={setCanvasDecoRots}
        tableColors={canvasTableColors} setTableColors={setCanvasTableColors}
        decoColors={canvasDecoColors} setDecoColors={setCanvasDecoColors}
      />
      {canvasDetail&&<TableDetailModal table={canvasDetail} getOccupied={getOccupied} onClose={()=>setCanvasDetailId(null)} onAssign={(id,cap)=>{setAssignModal({tableId:id,tableCapacity:cap});setAssignSearch('')}} onRemoveGuest={removeGuest} onEditTable={openEditTable} onDeleteTable={handleDeleteTable} puedeEditar={permiso.editar} puedeBorrar={permiso.borrar}/>}
      <ModalMesa visible={showModal} editTable={editTable} mNum={mNum} setMNum={setMNum} mName={mName} setMName={setMName} mCap={mCap} setMCap={setMCap} mShape={mShape} setMShape={setMShape} mError={mError} mSaving={mSaving} onSave={handleSaveTable} onClose={()=>setShowModal(false)} inp={inp}/>
      <ModalAsignar tables={tables} guests={guests} assignModal={assignModal} assignSearch={assignSearch} setAssignSearch={setAssignSearch} assignRef={assignRef} gSeatMap={gSeatMap} getOccupied={getOccupied} handleSelectGuest={handleSelectGuest} onClose={()=>{setAssignModal(null);setAssignSearch('')}}/>
      <ModalMover moveModal={moveModal} tables={tables} moveSaving={moveSaving} onConfirm={handleMove} onClose={()=>setMoveModal(null)}/>
    </>
  )

  // ── LISTA ──
  const cols='28px 36px 24px 1.8fr 90px 100px 1fr 80px 60px 56px'
  const filtered=listSearch?tables.map(t=>({...t,seats:t.seats.filter(s=>s.guest?.name.toLowerCase().includes(listSearch.toLowerCase())||s.guest?.party_members.some(m=>m.name?.toLowerCase().includes(listSearch.toLowerCase())))})).filter(t=>t.seats.length>0||t.name?.toLowerCase().includes(listSearch.toLowerCase())):tables

  return(
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',background:'#ffffff',color:'#1D1E20'}}>
      {/* Header */}
      <div style={{flexShrink:0,borderBottom:'1px solid #e8e8e8'}} className="px-4 pt-4 pb-0 sm:px-6 sm:pt-5 lg:px-10 lg:pt-6">
        {/* Título + toggle de stats (solo mobile) */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-[#1D1E20] sm:text-xl lg:text-2xl">Mesas</h1>
            <p className="mt-0.5 text-xs text-[#888] sm:text-sm">Organiza tus invitados por mesa</p>
          </div>
          <div className="lg:hidden shrink-0 pt-1">
            <StatsToggleButton visible={statsVisible} onClick={toggleStats} />
          </div>
        </div>

        {/* Bloque de stats colapsable en mobile, siempre visible en desktop */}
        <StatsCollapse visible={statsVisible}>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3"><div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Confirmados</span><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#48C9B0" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="#48C9B0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div><div className="text-2xl font-bold text-[#1D1E20]">{confirmed}</div><div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e8e8e8]"><div className="h-full rounded-full bg-[#48C9B0]" style={{width:guests.length>0?`${(confirmed/guests.length)*100}%`:'0%'}}/></div><div className="mt-1 text-[10px] text-[#aaa]">{guests.length} invitados totales</div></div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3"><div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Por asignar</span><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="2.5" stroke={unassigned>0?'#cc8800':'#bbb'} strokeWidth="1.5"/><path d="M3 14c0-2.2 2.2-5 5-5s5 2.2 5 5" stroke={unassigned>0?'#cc8800':'#bbb'} strokeWidth="1.5" strokeLinecap="round"/></svg></div><div className="text-2xl font-bold" style={{color:unassigned>0?'#cc8800':'#1D1E20'}}>{unassigned}</div>{unassigned>0?<div className="mt-1 text-[10px] font-medium text-[#cc8800]">Sin mesa asignada</div>:<div className="mt-1 text-[10px] text-[#48C9B0]">Todos asignados</div>}</div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3"><div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Asientos libres</span><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="3" y="9" width="10" height="4" rx="1" stroke="#48C9B0" strokeWidth="1.5"/><path d="M5 9V6a3 3 0 0 1 6 0v3" stroke="#48C9B0" strokeWidth="1.5" strokeLinecap="round"/></svg></div><div className="text-2xl font-bold text-[#1D1E20]">{String(totalFree).padStart(2,'0')}</div><div className="mt-1 text-[10px] text-[#aaa]">de {totalSeats} totales</div></div>
            <div className="rounded-xl border border-[#e8e8e8] bg-white p-3"><div className="mb-1.5"><span className="text-[10px] font-semibold uppercase tracking-wide text-[#aaa]">Mesas listas</span></div><div className="flex items-center justify-between"><div><div className="text-2xl font-bold text-[#1D1E20]">{fullTables}<span className="text-sm font-normal text-[#aaa]"> / {tables.length}</span></div><div className="mt-1 text-[10px] text-[#aaa]">Mesas al 100%</div></div><DonutChart value={fullTables} total={tables.length}/></div></div>
          </div>
        </StatsCollapse>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-[#e0e0e0]">
            <button className="flex items-center gap-1.5 bg-[#1D1E20] px-3 py-1.5 text-xs font-medium text-white"><List width={13} height={13}/><span className="hidden sm:inline">Lista</span></button>
            <button onClick={()=>setCanvasMode(true)} className="flex items-center gap-1.5 border-l border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#888] hover:bg-[#f5f5f5]"><MapIcon width={13} height={13}/><span className="hidden sm:inline">Canvas</span></button>
          </div>
          <div className="relative flex-1 sm:max-w-xs"><Search width={13} height={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]"/><input type="text" value={listSearch} onChange={e=>setListSearch(e.target.value)} placeholder="Buscar invitado..." className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] py-1.5 pl-8 pr-3 text-xs text-[#1D1E20] outline-none focus:border-[#48C9B0]"/></div>
          <div className="ml-auto flex items-center gap-2">
            {tables.length>0&&<button onClick={handlePrint} className="hidden items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs text-[#666] hover:border-[#48C9B0] hover:text-[#48C9B0] sm:flex"><Printer width={13} height={13}/>Imprimir lista</button>}
            <Puede modulo="mesas" accion="editar">
              <button onClick={()=>setShowBulk(true)} className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] hover:border-[#48C9B0] hover:text-[#48C9B0]"><Plus width={13} height={13}/><span className="hidden sm:inline">Agregar en</span> bulk</button>
            </Puede>
            <Puede modulo="mesas" accion="editar">
              <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3ab89f] sm:px-4 sm:text-sm"><Plus width={14} height={14}/>Nueva mesa</button>
            </Puede>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div style={{flex:1,overflowY:'auto'}} className="px-4 pb-6 pt-3 sm:px-6 lg:px-10">
        {tables.length===0?(
          <div className="mt-5 rounded-xl border border-dashed border-[#e0e0e0] px-6 py-14 text-center"><p className="text-sm text-[#888]">Sin mesas aún</p><p className="mt-1 text-xs text-[#bbb]">Crea tu primera mesa para empezar</p><div className="mt-4 flex items-center justify-center gap-2">{permiso.editar&&<button onClick={()=>setShowBulk(true)} className="rounded-lg border border-[#e0e0e0] px-4 py-2.5 text-sm text-[#666] hover:border-[#48C9B0] hover:text-[#48C9B0]">Agregar en bulk</button>}{permiso.editar&&<button onClick={openCreate} className="rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3ab89f]">+ Nueva mesa</button>}</div></div>
        ):(
          <>
            {/* Desktop */}
            <div className="hidden overflow-visible rounded-xl border border-[#e8e8e8] sm:block">
              <div className="grid items-center border-b border-[#e8e8e8] bg-[#f8f8f8] px-4 py-2" style={{gridTemplateColumns:cols}}>
                <div/><div/><div/>
                {['Invitado','Status','Tags','Notas','Asientos','Llegó',''].map((h,i)=><div key={i} className="text-[11px] font-semibold uppercase tracking-wide text-[#aaa]">{h}</div>)}
              </div>
              {filtered.map((table,idx)=>{
                const occ=getOccupied(table),avail=table.capacity-occ,full=avail===0,over=occ>table.capacity,open=expanded.has(table.id),bg=idx%2===0?'bg-white':'bg-[#fafafa]'
                return(
                  <div key={table.id}>
                    <div className={`grid items-center px-4 py-3 ${bg} border-b border-[#f0f0f0]`} style={{gridTemplateColumns:cols}}>
                      <div className="text-xs text-[#888]">{SHAPE_LABELS[table.shape as TableShape]?.slice(0,3)||'?'}</div>
                      <div><span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-xs font-bold text-[#555]">#{table.number}</span></div>
                      <div/>
                      <div className="cursor-pointer" onClick={()=>openEditTable(table)}>
                        <span className="text-sm font-semibold text-[#1D1E20] hover:text-[#48C9B0]">{table.name||<span className="font-normal text-[#ccc]">Sin nombre</span>}</span>
                        {over?<span className="ml-2 rounded-full border border-[#ffc0c0] bg-[#fff0f0] px-1.5 py-0.5 text-[9px] font-semibold text-[#cc3333]">Sobrecupo</span>:full&&<span className="ml-2 rounded-full border border-[#a0e0c0] bg-[#f0fff6] px-1.5 py-0.5 text-[9px] font-semibold text-[#2a7a50]">Llena</span>}
                      </div>
                      <div/><div/><div/>
                      <div className="text-sm text-[#888]"><span className="font-semibold" style={{color:over?'#cc3333':'#1D1E20'}}>{occ}</span>/{table.capacity}<div className="mt-0.5 h-1 w-12 overflow-hidden rounded-full bg-[#e8e8e8]"><div className="h-full rounded-full" style={{width:`${Math.min((occ/table.capacity)*100,100)}%`,background:over?'#cc3333':full?'#48C9B0':'#a0e0c0'}}/></div></div>
                      <div/>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={()=>setExpanded(p=>{const n=new Set(p);n.has(table.id)?n.delete(table.id):n.add(table.id);return n})} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888] hover:border-[#48C9B0] hover:text-[#48C9B0]">{open?<ChevronUp width={12} height={12}/>:<ChevronDown width={12} height={12}/>}</button>
                        {permiso.borrar&&<button onClick={()=>handleDeleteTable(table)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#ffe0e0] bg-[#fff5f5] text-[#cc3333] hover:bg-[#ffe8e8]"><Trash2 width={12} height={12}/></button>}
                      </div>
                    </div>
                    {open&&<>
                      {table.seats.map(seat=>{const g=seat.guest;if(!g)return null;const st=STATUS_COLORS[g.rsvp_status];return(
                        <div key={seat.id}>
                          <div className={`grid items-center border-b border-[#f5f5f5] px-4 py-2 ${bg}`} style={{gridTemplateColumns:cols}}>
                            <div/><div/><div className="flex justify-center"><div className="h-5 w-[2px] rounded-full" style={{background:st.border}}/></div>
                            <div className="flex items-center gap-1.5"><button onClick={()=>openEditGuest(g)} className="text-xs font-semibold text-[#1D1E20] hover:text-[#48C9B0] hover:underline">{g.name}</button>{g.party_size>1&&<span className="rounded-full border border-[#9FE1CB] bg-[#f0fdfb] px-1.5 py-0.5 text-[9px] font-semibold text-[#0F6E56]">+{g.party_size-1}</span>}</div>
                            <div><span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{background:st.bg,borderColor:st.border,color:st.text}}>{st.label.slice(0,4)}.</span></div>
                            <div className="flex flex-wrap gap-1"><TagChips tags={g.tags}/></div>
                            <div className="truncate text-[11px] text-[#aaa]">{g.notes||<span className="text-[#ddd]">—</span>}</div>
                            <div/>
                            <div className="flex justify-center">{!permiso.editar?<span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${g.checked_in?'border-[#48C9B0] bg-[#48C9B0]':'border-[#d0d0d0] bg-white'}`}>{g.checked_in&&<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</span>:<button onClick={()=>toggleCheckin(g.id,g.checked_in)} className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${g.checked_in?'border-[#48C9B0] bg-[#48C9B0]':'border-[#d0d0d0] bg-white hover:border-[#48C9B0]'}`}>{g.checked_in&&<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</button>}</div>
                            <div className="flex justify-end">{permiso.editar&&<button onClick={()=>removeGuest(seat.id,g.name)} className="flex h-6 w-6 items-center justify-center rounded text-[#ccc] hover:text-[#cc3333]"><X width={11} height={11}/></button>}</div>
                          </div>
                          {g.party_members.map(m=>(
                            <div key={m.id} className={`grid items-center border-b border-[#f5f5f5] px-4 py-1.5 ${bg}`} style={{gridTemplateColumns:cols}}>
                              <div/><div/><div className="flex justify-center"><div className="h-4 w-[2px] rounded-full opacity-25" style={{background:st.border}}/></div>
                              <div className="flex items-center pl-3"><span className="text-[11px] text-[#888]">{m.name||'Acompañante'}</span></div>
                              <div><span className="rounded-full border px-2 py-0.5 text-[9px] font-semibold" style={{background:STATUS_COLORS[m.rsvp_status].bg,borderColor:STATUS_COLORS[m.rsvp_status].border,color:STATUS_COLORS[m.rsvp_status].text}}>{STATUS_COLORS[m.rsvp_status].label.slice(0,4)}.</span></div>
                              <div/><div/><div/>
                              <div className="flex justify-center">{!permiso.editar?<span className={`flex h-5 w-5 items-center justify-center rounded border-2 ${m.checked_in?'border-[#48C9B0] bg-[#48C9B0]':'border-[#d0d0d0] bg-white'}`}>{m.checked_in&&<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</span>:<button onClick={()=>toggleMemberCheckin(m.id,g.id,m.checked_in)} className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${m.checked_in?'border-[#48C9B0] bg-[#48C9B0]':'border-[#d0d0d0] bg-white hover:border-[#48C9B0]'}`}>{m.checked_in&&<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</button>}</div>
                              <div/>
                            </div>
                          ))}
                        </div>
                      )})}
                      {avail>0&&permiso.editar&&<div className={`border-b border-[#f0f0f0] px-4 py-2 ${bg}`}><button onClick={()=>{setAssignModal({tableId:table.id,tableCapacity:table.capacity});setAssignSearch('')}} className="flex items-center gap-1.5 text-xs text-[#48C9B0] hover:underline"><Plus width={11} height={11}/>Asignar invitado ({avail} libre{avail!==1?'s':''})</button></div>}
                      {over&&<div className={`border-b border-[#f0f0f0] px-4 py-2 ${bg}`}><span className="text-xs font-medium text-[#cc3333]">Sobrecupo: {occ} de {table.capacity} asientos ({occ-table.capacity} de más)</span></div>}
                    </>}
                  </div>
                )
              })}
            </div>

            {/* Mobile */}
            <div className="flex flex-col gap-3 sm:hidden">
              {filtered.map(table=>{
                const occ=getOccupied(table),avail=table.capacity-occ,full=avail===0,over=occ>table.capacity,open=expanded.has(table.id)
                return(
                  <div key={table.id} className="rounded-xl border border-[#e8e8e8] bg-white">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f8f8f8] text-xs font-semibold text-[#888]">{SHAPE_LABELS[table.shape as TableShape]?.slice(0,3)||'?'}</div>
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={()=>openEditTable(table)}>
                        <div className="flex items-center gap-2"><span className="rounded bg-[#f0f0f0] px-1.5 py-0.5 text-xs font-bold text-[#555]">#{table.number}</span><span className="text-sm font-bold text-[#1D1E20]">{table.name||`Mesa ${table.number}`}</span>{over?<span className="rounded-full border border-[#ffc0c0] bg-[#fff0f0] px-1.5 py-0.5 text-[9px] font-semibold text-[#cc3333]">Sobrecupo</span>:full&&<span className="rounded-full border border-[#a0e0c0] bg-[#f0fff6] px-1.5 py-0.5 text-[9px] font-semibold text-[#2a7a50]">Llena</span>}</div>
                        <div className="mt-1 flex items-center gap-2"><span className="text-xs" style={{color:over?'#cc3333':'#888'}}>{occ}/{table.capacity}</span><div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e8e8e8]"><div className="h-full rounded-full" style={{width:`${Math.min((occ/table.capacity)*100,100)}%`,background:over?'#cc3333':full?'#48C9B0':'#a0e0c0'}}/></div><span className="text-[11px]" style={{color:over?'#cc3333':'#bbb'}}>{over?`+${occ-table.capacity} sobrecupo`:`${avail} libres`}</span></div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={()=>setExpanded(p=>{const n=new Set(p);n.has(table.id)?n.delete(table.id):n.add(table.id);return n})} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e0e0e0] text-[#888]">{open?<ChevronUp width={14} height={14}/>:<ChevronDown width={14} height={14}/>}</button>
                        {permiso.borrar&&<button onClick={()=>handleDeleteTable(table)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ffe0e0] bg-[#fff5f5] text-[#cc3333]"><Trash2 width={13} height={13}/></button>}
                      </div>
                    </div>
                    {open&&<div className="border-t border-[#f0f0f0] px-3 py-2">
                      <div className="flex flex-col gap-2">
                        {table.seats.map(seat=>{const g=seat.guest;const st=g?STATUS_COLORS[g.rsvp_status]:null;if(!g)return null;return(
                          <div key={seat.id} className="rounded-xl border px-3 py-2.5" style={{background:st!.bg,borderColor:st!.border}}>
                            <div className="flex items-start justify-between gap-2">
                              <button className="flex min-w-0 items-center gap-1.5" onClick={()=>openEditGuest(g)}><span className="truncate text-sm font-semibold hover:underline" style={{color:st!.text}}>{g.name}</span>{g.party_size>1&&<span className="shrink-0 text-sm font-semibold" style={{color:st!.text}}>+{g.party_size-1}</span>}</button>
                              <div className="flex shrink-0 items-center gap-1.5"><span className="text-xs font-semibold" style={{color:st!.text}}>{st!.label}</span>{permiso.editar&&<button onClick={()=>removeGuest(seat.id,g.name)} style={{color:st!.text,opacity:0.4}}><X width={12} height={12}/></button>}</div>
                            </div>
                            {g.party_members.length>0&&<div className="mt-1.5 flex flex-col gap-1 border-t pt-1.5" style={{borderColor:st!.border}}>{g.party_members.map(m=><div key={m.id} className="flex items-center justify-between"><div className="flex items-center gap-1.5"><div className="h-3 w-[2px] shrink-0 rounded-full opacity-30" style={{background:st!.text}}/><span className="text-xs" style={{color:st!.text}}>{m.name||'Acompañante'}</span></div><span className="text-[11px]" style={{color:STATUS_COLORS[m.rsvp_status].text}}>{STATUS_COLORS[m.rsvp_status].label}</span></div>)}</div>}
                          </div>
                        )})}
                      </div>
                      {avail>0&&permiso.editar&&<button onClick={()=>{setAssignModal({tableId:table.id,tableCapacity:table.capacity});setAssignSearch('')}} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-[#e0e0e0] px-3 py-2 hover:border-[#48C9B0] hover:bg-[#f0fdfb]"><Plus width={12} height={12} className="text-[#48C9B0]"/><span className="text-xs text-[#aaa]">Asignar invitado ({avail} libres)</span></button>}
                      {over&&<p className="mt-2 text-xs font-medium text-[#cc3333]">Sobrecupo: {occ} de {table.capacity} asientos</p>}
                    </div>}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal editar invitado */}
      {editGuest&&(
        <Modal open onClose={()=>setEditGuest(null)} size="md">
          <Modal.Header title="Editar invitado" />
          <Modal.Body>
            {/* Aviso de mesa asignada */}
            {gSeatMap.get(editGuest.id)&&(()=>{
              const sr=gSeatMap.get(editGuest.id)
              const assignedTable=tables.find(t=>t.id===sr.tableId)
              if(!assignedTable)return null
              const occ=getOccupied(assignedTable)
              const available=assignedTable.capacity-occ+editGuest.party_size
              return(
                <div className="mb-4 rounded-lg border border-[#e8f8f4] bg-[#f0fdfb] px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-[#1a9e88]">
                    Asignado a Mesa #{sr.tableNumber} · {available} asiento(s) disponibles para este grupo
                  </p>
                </div>
              )
            })()}
            <div className="flex flex-col gap-4">
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Nombre *</label><input type="text" value={eName} onChange={e=>setEName(e.target.value)} className={EDIT_GUEST_INPUT_CLASS}/></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">WhatsApp</label><input type="tel" value={ePhone} onChange={e=>setEPhone(e.target.value)} placeholder="+52 81 1234 5678" className={EDIT_GUEST_INPUT_CLASS}/></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Email</label><input type="email" value={eEmail} onChange={e=>setEEmail(e.target.value)} className={EDIT_GUEST_INPUT_CLASS}/></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Notas</label><textarea value={eNotes} onChange={e=>setENotes(e.target.value)} rows={2} className={`${EDIT_GUEST_INPUT_CLASS} resize-y`}/></div>
              {eventTags.length>0&&<div><label className="mb-1.5 block text-xs font-medium text-[#555]">Tags</label><TagSelector availableTags={eventTags} selectedTags={eTags} onChange={setETags}/></div>}
              <div className="border-t border-[#f0f0f0] pt-4"><MembersEditor value={eMembers} onChange={setEMembers}/></div>
            </div>
            {eError&&<div className="mt-3 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">{eError}</div>}
          </Modal.Body>
          <Modal.Footer>
            <button onClick={()=>setEditGuest(null)} className="flex-1 rounded-lg border border-[#e0e0e0] py-3 text-sm text-[#888]">Cancelar</button>
            <button onClick={handleEditSave} disabled={eSaving} className="flex-[2] rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">{eSaving?'Guardando…':'Guardar cambios'}</button>
          </Modal.Footer>
        </Modal>
      )}

      <ModalMesa visible={showModal} editTable={editTable} mNum={mNum} setMNum={setMNum} mName={mName} setMName={setMName} mCap={mCap} setMCap={setMCap} mShape={mShape} setMShape={setMShape} mError={mError} mSaving={mSaving} onSave={handleSaveTable} onClose={()=>setShowModal(false)} inp={inp}/>

      <Modal open={showBulk} onClose={()=>setShowBulk(false)} size="sm">
        <Modal.Header title="Agregar en bulk" subtitle={`Números automáticos${tables.length>0?` (siguiente: #${nextNum()})`:' (desde #1)'}`}/>
        <Modal.Body>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3"><div><label className="mb-1.5 block text-xs font-medium text-[#555]">Cantidad *</label><input type="number" min="1" max="50" value={bCount} onChange={e=>setBCount(e.target.value)} className={inp} placeholder="5"/></div><div><label className="mb-1.5 block text-xs font-medium text-[#555]">Capacidad c/u *</label><input type="number" min="1" max="100" value={bCap} onChange={e=>setBCap(e.target.value)} className={inp} placeholder="8"/></div></div>
            <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Forma</label>
              <div className="grid grid-cols-3 gap-2">{(['round','oval','rectangle','square','halfmoon','row'] as TableShape[]).map(s=><button key={s} type="button" onClick={()=>setBShape(s)} className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-medium transition ${bShape===s?'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]':'border-[#e0e0e0] text-[#888]'}`}><div className="flex h-8 w-full items-center justify-center">{SHAPE_ICONS[s]}</div>{SHAPE_LABELS[s]}</button>)}</div>
            </div>
            {(()=>{const c=parseInt(bCount);if(!c||c<1||c>50)return null;const ns=previewNums(c);const pv=ns.length<=8?ns.map(n=>`#${n}`).join(', '):`#${ns[0]}, #${ns[1]}... hasta #${ns[ns.length-1]}`;return<div className="rounded-lg border border-[#e8f8f4] bg-[#f0fdfb] px-3 py-2.5"><p className="text-[11px] font-semibold text-[#1a9e88]">Se crearán {c} mesas:</p><p className="mt-0.5 text-[11px] text-[#48C9B0]">{pv}</p></div>})()}
          </div>
          {bError&&<div className="mt-3 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">{bError}</div>}
        </Modal.Body>
        <Modal.Footer>
          <button onClick={()=>setShowBulk(false)} className="flex-1 rounded-lg border border-[#e0e0e0] py-3 text-sm text-[#888]">Cancelar</button>
          <button onClick={handleBulk} disabled={bSaving} className="flex-[2] rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">{bSaving?'Creando…':`Crear ${bCount||0} mesas`}</button>
        </Modal.Footer>
      </Modal>

      <ModalAsignar tables={tables} guests={guests} assignModal={assignModal} assignSearch={assignSearch} setAssignSearch={setAssignSearch} assignRef={assignRef} gSeatMap={gSeatMap} getOccupied={getOccupied} handleSelectGuest={handleSelectGuest} onClose={()=>{setAssignModal(null);setAssignSearch('')}}/>
      <ModalMover moveModal={moveModal} tables={tables} moveSaving={moveSaving} onConfirm={handleMove} onClose={()=>setMoveModal(null)}/>
    </div>
  )
}
export default function MesasPage() {
  return (
    <FeatureGuard feature="mesas">
      <MesasPageInner />
    </FeatureGuard>
  )
}
