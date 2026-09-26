'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import FeatureGuard from '@/app/components/ui/FeatureGuard'
import { Guest } from '@/lib/types'
import { Plus, Trash2, X, List, Map as MapIcon, Printer, Search, ArrowLeft, LayoutPanelLeft, RotateCw, Maximize2, CheckSquare } from 'lucide-react'
import StatsCollapse, { StatsToggleButton, useStatsToggle } from '@/app/components/ui/StatsCollapse'
import { Modal } from '@/app/components/ui/Modal'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import { useToast } from '@/app/components/ui/Toast'
import { falloDeEscritura, describirFallo } from '@/lib/escrituras/fallo'
import { reportError } from '@/lib/observabilidad/report'
import { usePermiso } from '@/lib/event-access-context'
import { Puede } from '@/lib/permisos/Puede'
import { Cargando } from '@/app/components/ui/Cargando'

// ─── CONSTANTES ───────────────────────────────
import { estatusDe, glifoDe } from './estatus'
import { personasDe, mapaAsientos, ocupacionDe, opsSentar, opsQuitar, etiquetaSeparado, type Persona, type Fila } from '@/lib/mesas/asientos'
import { ejecutarOps } from '@/lib/mesas/ejecutar'
import { DndContext, DragOverlay, MouseSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { PersonaCard, ChipFantasma } from './PersonaItem'
import MesaCard from './MesaCard'
import MesaDroppable from './MesaDroppable'
import SillasArrastrables from './SillasArrastrables'
import { sillasDe, RADIO_SILLA, FORMAS, NOMBRE_FORMA, type Forma, type Dibujo } from '@/lib/mesas/sillas'
import { LeyendaEstatus } from './chips'
import SinMesaPanel from './SinMesaPanel'
import ModalAsignar from './ModalAsignar'
import ModalElegirMesa, { type ElegirMesa } from './ModalElegirMesa'
import PersonaMenu from './PersonaMenu'

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

type TableShape = Forma
const SHAPE_LABELS: Record<TableShape, string> = NOMBRE_FORMA

// Cuerpo de una mesa a partir de su dibujo. Lo comparten el plano y los
// iconos del selector de forma.
function CuerpoSVG({ d, fill, stroke, sw }: { d: Dibujo; fill: string; stroke: string; sw: number }) {
  const c = d.cuerpo
  if (c.tipo === 'circulo') return <circle cx={d.cx} cy={d.cy} r={c.r} fill={fill} stroke={stroke} strokeWidth={sw}/>
  if (c.tipo === 'elipse') return <ellipse cx={d.cx} cy={d.cy} rx={c.rx} ry={c.ry} fill={fill} stroke={stroke} strokeWidth={sw}/>
  if (c.tipo === 'rect') return <rect x={d.cx - c.w/2} y={d.cy - c.h/2} width={c.w} height={c.h} rx={c.radio} fill={fill} stroke={stroke} strokeWidth={sw}/>
  if (c.tipo === 'arco') return <path d={`M ${d.cx - c.r} ${d.cy} A ${c.r} ${c.r} 0 0 1 ${d.cx + c.r} ${d.cy} Z`} fill={fill} stroke={stroke} strokeWidth={sw}/>
  if (c.tipo === 'linea') return <line x1={RADIO_SILLA} y1={d.cy + RADIO_SILLA + 4} x2={d.w - RADIO_SILLA} y2={d.cy + RADIO_SILLA + 4} stroke={stroke} strokeWidth={sw} strokeLinecap="round"/>
  if (c.tipo === 'u') {
    const x = d.cx - c.w/2, y = d.cy - c.h/2, g = c.grosor
    return <path d={`M ${x} ${y} h ${c.w} v ${c.h} h ${-g} v ${-(c.h - g)} h ${-(c.w - g*2)} v ${c.h - g} h ${-g} Z`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round"/>
  }
  return <>
    <circle cx={d.cx} cy={d.cy} r={c.r + 9} fill="none" stroke={stroke} strokeWidth={1} strokeDasharray="3 3"/>
    <circle cx={d.cx} cy={d.cy} r={c.r} fill={fill} stroke={stroke} strokeWidth={sw}/>
  </>
}

const CAP_ICONO: Record<TableShape, number> = { round: 8, oval: 8, rectangle: 8, square: 8, imperial: 12, herradura: 10, halfmoon: 5, row: 5, anfitriones: 2, coctel: 0 }
function FormaIcono({ shape }: { shape: TableShape }) {
  const d = sillasDe(shape, CAP_ICONO[shape])
  const k = Math.min(52 / d.w, 40 / d.h)
  return (
    <svg viewBox={`0 0 ${d.w} ${d.h}`} width={Math.round(d.w * k)} height={Math.round(d.h * k)} fill="none">
      {d.sillas.map((sl, i) => <circle key={i} cx={sl.x} cy={sl.y} r={RADIO_SILLA} fill="#e4e4e4" stroke="#bbb" strokeWidth="1.5"/>)}
      <CuerpoSVG d={d} fill="#f8f8f8" stroke="#888" sw={2} />
    </svg>
  )
}
const SHAPE_ICONS: Record<TableShape, React.ReactNode> = Object.fromEntries(FORMAS.map(f => [f, <FormaIcono key={f} shape={f} />])) as Record<TableShape, React.ReactNode>

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
type GuestFull   = Pick<Guest, 'id' | 'name' | 'rsvp_status'> & { tags: string[]; party_size: number; notes: string | null; phone?: string | null; email?: string | null; side?: string | null; checked_in: boolean; party_members: PartyMember[] }
type SeatRecord  = { id: string; table_id: string; event_id: string; seat_number: number; guest_id: string | null; party_size: number; guest?: GuestFull | null }
type TableRecord = { id: string; event_id: string; number: number; name: string | null; capacity: number; shape: string; rotation: number; position_x: number; position_y: number; created_at: string; seats: SeatRecord[] }
type EventInfo   = { name: string; event_date: string | null; venue: string | null }

// ─── HELPERS ──────────────────────────────────
function getTableSvgDims(table: TableRecord): { w: number; h: number } {
  const d = sillasDe(table.shape, table.capacity); return { w: d.w, h: d.h }
}

// ─── SVG MESAS ────────────────────────────────
const SEAT_COLORS: Record<string,{fill:string;stroke:string}> = {
  confirmed:        { fill:'#5DCAA5', stroke:'#0F6E56' },
  pending:          { fill:'#FAC775', stroke:'#92400e' },
  declined:         { fill:'#F09595', stroke:'#991b1b' },
  mensaje_enviado:  { fill:'#85B7EB', stroke:'#1e40af' },
  respondio:        { fill:'#f0c090', stroke:'#9a3412' },
  accion_necesaria: { fill:'#e88bbd', stroke:'#9d174d' },
}
const SEAT_EMPTY = { fill:'#f0f0f0', stroke:'#d0d0d0' }

// Cada silla es una persona con su propio estatus. El borde dice el cupo de
// lejos: gris vacia, teal con gente, verde llena, rojo con sobrecupo.
function TableSVG({ table, ocupados, resaltar, isSelected, isHighlighted, isDimmed, colorFill, colorBorder }: {
  table: TableRecord; ocupados: Persona[]; resaltar: Set<string> | null; isSelected: boolean; isHighlighted: boolean; isDimmed: boolean
  colorFill?: string; colorBorder?: string
}) {
  const cap = table.capacity; const occupied = ocupados.length; const isFull = occupied >= cap; const sobre = occupied > cap
  const stroke = isHighlighted || isSelected ? '#48C9B0' : sobre ? '#cc3333' : isFull ? '#2a7a50' : occupied > 0 ? '#48C9B0' : (colorBorder||'#d0d0d0')
  const sw = isHighlighted ? 3 : isSelected ? 2.5 : occupied > 0 ? 2 : 1.5
  const fill = colorFill && colorFill!=='#ffffff' ? colorFill : (isHighlighted ? '#f0fdfb' : isFull && !sobre ? '#f0fff6' : '#fff')
  const statColor = sobre ? '#cc3333' : isFull ? '#0F6E56' : occupied > 0 ? '#48C9B0' : '#bbb'
  const opacity = isDimmed ? 0.2 : 1
  const d = sillasDe(table.shape, cap)
  const c = d.cuerpo
  const colorDe = (i: number) => i < occupied ? (SEAT_COLORS[ocupados[i].rsvp] || SEAT_COLORS.confirmed) : SEAT_EMPTY
  // El nombre cabe adentro cuando el cuerpo tiene alto; si no, va abajo del dibujo.
  const nombreAdentro = !!table.name && (c.tipo === 'circulo' || c.tipo === 'elipse' || c.tipo === 'u' || (c.tipo === 'rect' && c.h >= 36))
  const nombre = (table.name || '').length > 14 ? (table.name || '').slice(0, 13) + '…' : (table.name || '')
  const base = c.tipo === 'arco' ? d.cy - 8 : c.tipo === 'u' ? d.cy - c.h/2 + c.grosor/2 + 4 : d.cy + 2
  return (
    <svg width={d.w} height={d.h} style={{display:'block',opacity,pointerEvents:'none'}}>
      {d.sillas.map((sl, i) => { const col = colorDe(i); const k = RADIO_SILLA * 1.3 / 24; const apagada = resaltar && i < occupied && !resaltar.has(ocupados[i].clave); return (
        <g key={i} opacity={apagada ? 0.25 : 1}>
          <circle cx={sl.x} cy={sl.y} r={RADIO_SILLA} fill={col.fill} stroke={col.stroke} strokeWidth={resaltar && !apagada && i < occupied ? 2.5 : 1.5}/>
          {i < occupied && <path d={glifoDe(ocupados[i].rsvp)} transform={`translate(${sl.x - 12 * k} ${sl.y - 12 * k}) scale(${k})`} fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"/>}
        </g>
      )})}
      <CuerpoSVG d={d} fill={fill} stroke={stroke} sw={sw} />
      {c.tipo !== 'linea' && (nombreAdentro ? <>
        <text x={d.cx} y={base - 9} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1D1E20">{nombre}</text>
        <text x={d.cx} y={base + 3} textAnchor="middle" fontSize="11" fontWeight="700" fill="#555">#{table.number}</text>
        <text x={d.cx} y={base + 15} textAnchor="middle" fontSize="10" fill={statColor}>{occupied}/{cap}</text>
      </> : <>
        <text x={d.cx} y={base - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1D1E20">#{table.number}</text>
        <text x={d.cx} y={base + 8} textAnchor="middle" fontSize="10" fill={statColor}>{occupied}/{cap}</text>
      </>)}
    </svg>
  )
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
function TableDetailModal({ table, ocupados, ocupacion, etiqueta, onClose, onAssign, onPersona, onEditTable, onDeleteTable, puedeEditar, puedeBorrar }: {
  table: TableRecord; ocupados: Persona[]; ocupacion:(tableId:string)=>number; etiqueta:(p:Persona)=>string|null; onClose:()=>void
  onAssign:(id:string,cap:number)=>void; onPersona:(p:Persona)=>void
  onEditTable:(t:TableRecord)=>void; onDeleteTable:(t:TableRecord)=>void
  puedeEditar:boolean; puedeBorrar:boolean
}) {
  const occ=ocupacion(table.id); const avail=table.capacity-occ; const full=avail<=0
  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header
        title={`#${table.number} ${table.name||`Mesa ${table.number}`}`}
        subtitle={`${SHAPE_LABELS[table.shape as TableShape]||table.shape} · ${occ}/${table.capacity} lugares${full?' · Llena':''}`}
      />
      <Modal.Body>
        {ocupados.length===0?<p className="py-6 text-center text-sm text-[#bbb]">Nadie sentado todavía</p>:(
          <div className="flex flex-col gap-2">
            {ocupados.map(p=><PersonaCard key={p.clave} persona={p} etiqueta={etiqueta(p)} onTap={()=>{onClose();onPersona(p)}}/>)}
          </div>
        )}
        {ocupados.length>0&&<p className="mt-3 text-center text-[11px] text-[#bbb]">Toca a alguien para moverlo o quitarlo</p>}
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
function CanvasFullscreen({ tables, getOccupied, enMesa, grupoDe, etiqueta, arrastrando, onPersona, panel, onBack, onTableClick, onPositionSave, onRotationSave, onOpenCreate, puedeEditar, resetKey,
  decos, setDecos, decoRotations, setDecoRotations, tableColors, setTableColors, decoColors, setDecoColors
}: {
  tables: TableRecord[]; getOccupied:(t:TableRecord)=>number; onBack:()=>void
  enMesa:(tableId:string)=>Persona[]; grupoDe:(p:Persona)=>Persona[]; etiqueta:(p:Persona)=>string|null; arrastrando:Persona[]|null; onPersona:(p:Persona)=>void; panel:React.ReactNode
  onTableClick:(t:TableRecord)=>void; onPositionSave:(id:string,x:number,y:number)=>void
  onRotationSave:(id:string,rotation:number)=>void; onOpenCreate:()=>void
  puedeEditar: boolean
  // Al cambiar, el plano descarta lo que tenia en memoria y vuelve a leer
  // posiciones y giros de `tables`: es el regreso tras un guardado fallido.
  resetKey: number
  decos: DecoItem[]; setDecos: React.Dispatch<React.SetStateAction<DecoItem[]>>
  decoRotations: Record<string,number>; setDecoRotations: React.Dispatch<React.SetStateAction<Record<string,number>>>
  tableColors: Record<string,string>; setTableColors: React.Dispatch<React.SetStateAction<Record<string,string>>>
  decoColors: Record<string,string>; setDecoColors: React.Dispatch<React.SetStateAction<Record<string,string>>>
}) {
  const puedeEditarRef = useRef(puedeEditar)
  puedeEditarRef.current = puedeEditar
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

  useEffect(()=>{
    if(!resetKey)return
    const p:Record<string,{x:number;y:number}>={}, r:Record<string,number>={}
    tables.forEach((t,i)=>{
      p[t.id]=((t.position_x||t.position_y)&&(t.position_x!==0||t.position_y!==0))?{x:t.position_x,y:t.position_y}:{x:80+(i%4)*240,y:80+Math.floor(i/4)*240}
      r[t.id]=t.rotation||0
    })
    setPositions(p); setRotations(r)
  },[resetKey])

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
    if(e.button===2)return
    e.preventDefault(); e.stopPropagation()
    const pos=isDeco?(decosRef.current.find(d=>d.id===id)||{x:0,y:0}):(posRef.current[id]||{x:0,y:0})
    dragRef.current={id,isDeco,startMX:e.clientX,startMY:e.clientY,startX:pos.x,startY:pos.y,hasMoved:false}
    if(puedeEditar)document.body.style.cursor='grabbing'
    if(isDeco){setActiveDeco(id)}else{setActiveId(id);setSelectedId(id)}
  }

  const startResize=(e:React.MouseEvent,id:string,corner:string)=>{
    if(!puedeEditar)return
    e.preventDefault(); e.stopPropagation()
    const d=decosRef.current.find(x=>x.id===id); if(!d)return
    resizeRef.current={id,corner,startMX:e.clientX,startMY:e.clientY,origX:d.x,origY:d.y,origW:d.w,origH:d.h}
    document.body.style.cursor=corner==='nw'||corner==='se'?'nw-resize':'ne-resize'
  }

  const startRotate=(e:React.MouseEvent,id:string,isDeco:boolean)=>{
    if(!puedeEditar)return
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
    if(!puedeEditarRef.current)return
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
  const coincide=useCallback((p:Persona)=>p.nombre.toLowerCase().includes(searchLower)||(p.titular||'').toLowerCase().includes(searchLower),[searchLower])
  const matchingIds=useMemo(()=>{
    if(!hasSearch)return new Set<string>()
    return new Set(tables.filter(t=>enMesa(t.id).some(coincide)).map(t=>t.id))
  },[hasSearch,coincide,tables,enMesa])
  const matchingClaves=useMemo(()=>{
    if(!hasSearch)return null
    const s=new Set<string>();for(const t of tables)for(const p of enMesa(t.id))if(coincide(p))s.add(p.clave);return s
  },[hasSearch,coincide,tables,enMesa])
  // Encuadra todas las mesas de un golpe.
  const ajustar=()=>{
    const area=canvasRef.current;if(!area||tables.length===0)return
    let maxX=0,maxY=0
    for(const t of tables){const pos=positions[t.id]||{x:80,y:80};const dm=getTableSvgDims(t);maxX=Math.max(maxX,pos.x+dm.w+40);maxY=Math.max(maxY,pos.y+dm.h+60)}
    const z=Math.min(2,Math.max(0.3,Math.min(area.clientWidth/maxX,area.clientHeight/maxY)))
    setZoom(z);area.scrollLeft=0;area.scrollTop=0
  }

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
    if(!puedeEditarRef.current)return
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
          <button onClick={ajustar} title="Encuadrar todas las mesas" className="flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#666] hover:border-[#48C9B0] hover:text-[#48C9B0]"><Maximize2 width={12} height={12}/>Ajustar</button>
          <div className="flex overflow-hidden rounded-lg border border-[#e0e0e0]">
            <button onClick={()=>setZoom(z=>Math.min(2,z+0.1))} className="px-2.5 py-1.5 text-xs font-bold text-[#666] hover:bg-[#f5f5f5]">+</button>
            <span className="flex w-12 items-center justify-center border-x border-[#e0e0e0] text-xs text-[#888]">{Math.round(zoom*100)}%</span>
            <button onClick={()=>setZoom(z=>Math.max(0.3,z-0.1))} className="px-2.5 py-1.5 text-xs font-bold text-[#666] hover:bg-[#f5f5f5]">−</button>
          </div>
          {puedeEditar&&<button onClick={onOpenCreate} className="flex items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3ab89f]">
            <Plus width={13} height={13}/>Nueva mesa
          </button>}
        </div>
      </div>

      {/* ── Panel de sin mesa (escritorio) + Canvas ── */}
      <div style={{display:'flex',flex:1,minHeight:0}}>
      <div className="hidden sm:flex" style={{height:'100%'}}>{panel}</div>
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
          <button onClick={e=>{e.stopPropagation();ajustar()}} title="Encuadrar todas las mesas" style={{padding:'8px 8px',borderTop:'1px solid #e0e0e0',background:'transparent',border:'none',cursor:'pointer',color:'#555',display:'flex'}} onMouseDown={e=>e.stopPropagation()}><Maximize2 width={14} height={14}/></button>
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
                style={{position:'absolute',left:pos.x,top:pos.y,userSelect:'none',cursor:puedeEditar?'grab':'pointer',touchAction:'none'}}
                onMouseDown={e=>startDrag(e,table.id,false)}
                onMouseEnter={()=>handleTableEnter(table.id)}
                onMouseLeave={()=>handleTableLeave(table.id)}
                onContextMenu={e=>openContextMenu(e,table.id,'table')}
                onTouchStart={e=>startTouchDrag(e,table.id,false)}>
                {isActive&&puedeEditar&&(
                  <div data-canvas-item="true"
                    onMouseDown={e=>startRotate(e,table.id,false)}
                    onMouseEnter={()=>handleTableEnter(table.id)}
                    title="Rotar mesa"
                    style={{position:'absolute',top:-30,left:'50%',transform:'translateX(-50%)',width:22,height:22,borderRadius:'50%',background:isSel?'#48C9B0':'rgba(72,201,176,0.8)',border:'2.5px solid #fff',boxShadow:'0 2px 8px rgba(0,0,0,0.18)',cursor:'crosshair',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10}}>
                    <RotateCw width={11} height={11} color="white" style={{pointerEvents:'none'}}/>
                  </div>
                )}
                <MesaDroppable tableId={table.id} libres={puedeEditar?table.capacity-occ:0} ocupados={enMesa(table.id)} arrastrando={arrastrando} redonda={table.shape==='round'||table.shape==='oval'}>
                <div style={{transform:`rotate(${rot}deg)`,transformOrigin:'center',display:'inline-block',position:'relative'}}>
                  <TableSVG table={table} ocupados={enMesa(table.id)} resaltar={matchingClaves} isSelected={isActive} isHighlighted={isHL} isDimmed={isDim} colorFill={tableColor.fill} colorBorder={tableColor.border}/>
                  <SillasArrastrables shape={table.shape} capacity={table.capacity} ocupados={enMesa(table.id)} grupoDe={grupoDe} etiqueta={etiqueta} puedeEditar={puedeEditar} onPersona={onPersona}/>
                </div>
                </MesaDroppable>
                {table.name&&!['round','oval','rectangle','square','imperial','herradura'].includes(table.shape)&&(
                  <div style={{width:dims.w,textAlign:'center',marginTop:3,opacity:isDim?0.2:1,pointerEvents:'none'}}>
                    <span style={{fontSize:11,fontWeight:600,color:isSel?'#48C9B0':'#555',display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{table.name}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
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
        {puedeEditar&&<button onClick={onOpenCreate} className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-xs font-semibold text-white">
          <Plus width={13} height={13}/>Nueva mesa
        </button>}
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

function MembersEditor({ value, onChange, puedeEditar = true }: { value:EditMember[]; onChange:(v:EditMember[])=>void; puedeEditar?:boolean }) {
  const MAX=15
  return(
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-medium text-[#555]">Acompañantes <span className="font-normal text-[#ccc]">(máx. {MAX})</span></label>
        {puedeEditar&&value.length<MAX&&<button type="button" onClick={()=>onChange([...value,{name:'',phone:'',rsvp_status:'pending'}])} className="text-xs font-semibold text-[#48C9B0] hover:underline">+ Agregar</button>}
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
              {puedeEditar&&<button type="button" onClick={()=>onChange(value.filter((_,j)=>j!==i))} className="w-full rounded-lg border border-[#ffe0e0] bg-[#fff5f5] py-1.5 text-xs font-semibold text-[#cc3333] hover:bg-[#ffe8e8]">Eliminar acompañante</button>}
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
  const shapes: TableShape[] = [...FORMAS]
  return(
    <Modal open={visible} onClose={onClose} size="sm">
      <Modal.Header title={editTable?'Editar mesa':'Nueva mesa'}/>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Nombre <span className="font-normal text-[#ccc]">(opcional)</span></label><input type="text" value={mName} onChange={e=>setMName(e.target.value)} className={inp} placeholder="Ej: Tíos, Primos, Trabajo…"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Número *</label><input type="number" min="1" value={mNum} onChange={e=>setMNum(e.target.value)} className={inp} placeholder="1"/></div>
            <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Lugares *</label><input type="number" min="1" max="100" value={mCap} onChange={e=>setMCap(e.target.value)} className={inp} placeholder="8"/></div>
          </div>
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

// ─── PÁGINA PRINCIPAL ─────────────────────────
function MesasPageInner() {
  const {id:eventId}=useParams()

  // Toggle de estadísticas en mobile (persiste por evento en localStorage)
  const { visible: statsVisible, toggle: toggleStats } = useStatsToggle(eventId as string, 'tables')
  const askConfirm = useConfirm()
  const toast = useToast()
  const permiso = usePermiso('mesas')
  // Cuando una posicion o giro no se guarda, el plano vuelve a lo que dice la base.
  const [canvasResetKey,setCanvasResetKey]=useState(0)
  const permisoInvitados = usePermiso('invitados')

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
  const [elegirMesa,setElegirMesa]=useState<ElegirMesa|null>(null)
  const [personaMenu,setPersonaMenu]=useState<Persona|null>(null)
  const [arrastrando,setArrastrando]=useState<Persona[]|null>(null)
  // Palomeados en el panel para "Sentar aqui" sin arrastrar.
  const [marcados,setMarcados]=useState<Set<string>>(new Set())
  // El dia del evento: renglones grandes con su cuadro y el arrastre apagado.
  const [modoCheckin,setModoCheckin]=useState(false)
  const [menuMas,setMenuMas]=useState(false)
  const [leyendaAbierta,setLeyendaAbierta]=useState(false)
  const [panelBusqueda,setPanelBusqueda]=useState('')
  const [filas,setFilas]=useState<Fila[]>([])
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
  const [eErrorReintentable,setEErrorReintentable]=useState(false)

  useEffect(()=>{loadData()},[])

  const loadData=async()=>{
    setLoading(true)
    const [tR,sR,gR,mR,eR]=await Promise.all([
      supabase.from('tables').select('*').eq('event_id',eventId).order('number'),
      supabase.from('table_seats').select('*').eq('event_id',eventId),
      supabase.from('guests').select('id,name,rsvp_status,tags,party_size,notes,phone,email,side,checked_in').eq('event_id',eventId).order('name'),
      supabase.from('party_members').select('id,guest_id,name,rsvp_status,checked_in').eq('event_id',eventId),
      supabase.from('events').select('guest_tags,name,event_date,venue,canvas_data').eq('id',eventId).single(),
    ])
    const gMap=new Map<string,GuestFull>()
    for(const g of(gR.data||[])){const members=(mR.data||[]).filter(m=>m.guest_id===g.id);gMap.set(g.id,{...g,tags:g.tags||[],notes:g.notes||null,phone:g.phone||null,email:g.email||null,checked_in:g.checked_in||false,party_size:1+members.length,party_members:members.map(m=>({...m,checked_in:m.checked_in||false}))})}
    const combined:TableRecord[]=(tR.data||[]).map(t=>({...t,rotation:t.rotation||0,seats:(sR.data||[]).filter(s=>s.table_id===t.id).map(s=>({...s,guest:s.guest_id?gMap.get(s.guest_id)||null:null}))}))
    setTables(combined);setGuests(Array.from(gMap.values()));setFilas((sR.data||[]) as Fila[])
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
      supabase.from('guests').select('id,name,rsvp_status,tags,party_size,notes,phone,email,side,checked_in').eq('event_id',eventId).order('name'),
      supabase.from('party_members').select('id,guest_id,name,rsvp_status,checked_in').eq('event_id',eventId),
    ])
    const gMap=new Map<string,GuestFull>()
    for(const g of(gR.data||[])){const members=(mR.data||[]).filter(m=>m.guest_id===g.id);gMap.set(g.id,{...g,tags:g.tags||[],notes:g.notes||null,phone:g.phone||null,email:g.email||null,checked_in:g.checked_in||false,party_size:1+members.length,party_members:members.map(m=>({...m,checked_in:m.checked_in||false}))})}
    const combined:TableRecord[]=(tR.data||[]).map(t=>({...t,rotation:t.rotation||0,seats:(sR.data||[]).filter(s=>s.table_id===t.id).map(s=>({...s,guest:s.guest_id?gMap.get(s.guest_id)||null:null}))}))
    setTables(combined); setGuests(Array.from(gMap.values())); setFilas((sR.data||[]) as Fila[])
  }
  const filasDeLaBase=async()=>((await supabase.from('table_seats').select('*').eq('event_id',eventId)).data||[]) as Fila[]

  // Todo lo que se pinta sale de aqui: una persona por fila de table_seats,
  // con las familias legado (una fila con party_size N) entendidas como si
  // ya estuvieran expandidas.
  const personas=useMemo(()=>personasDe(guests),[guests])
  const mapa=useMemo(()=>mapaAsientos(filas,personas),[filas,personas])
  const ocupacion=useCallback((tableId:string)=>ocupacionDe(tableId,filas),[filas])
  const enMesa=useCallback((tableId:string)=>personas.filter(p=>mapa.get(p.clave)?.tableId===tableId),[personas,mapa])
  const sinMesa=useMemo(()=>personas.filter(p=>!mapa.has(p.clave)),[personas,mapa])
  const numeroDeMesa=useCallback((tableId:string)=>tables.find(t=>t.id===tableId)?.number??0,[tables])
  const etiqueta=useCallback((p:Persona)=>etiquetaSeparado(p,mapa,personas,numeroDeMesa),[mapa,personas,numeroDeMesa])
  const nombreMesa=(tableId:string)=>{const t=tables.find(x=>x.id===tableId);return t?`Mesa ${t.number}${t.name?' · '+t.name:''}`:''}
  const getOccupied=(t:TableRecord)=>ocupacion(t.id)
  const nextNum=()=>{if(!tables.length)return 1;const u=new Set(tables.map(t=>t.number));let n=1;while(u.has(n))n++;return n}

  const confirmed=personas.filter(p=>p.rsvp==='confirmed').length
  const sentados=personas.filter(p=>mapa.has(p.clave)).length
  const llegaron=personas.filter(p=>mapa.has(p.clave)&&p.checkedIn).length
  const unassigned=sinMesa.filter(p=>p.rsvp==='confirmed').length
  const totalSeats=tables.reduce((a,t)=>a+t.capacity,0)
  const totalFree=totalSeats-tables.reduce((a,t)=>a+ocupacion(t.id),0)
  const fullTables=tables.filter(t=>ocupacion(t.id)>=t.capacity).length

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
    if (!permisoInvitados.editar) return
    if (!editGuest) return
    if (!eName) { setEError('El nombre es obligatorio'); return }

    if (ePhone) {
      const n = normalizePhone(ePhone)
      const dup = guests.find(g => g.id !== editGuest.id && g.phone && normalizePhone(g.phone) === n)
      if (dup) { setEError(`WhatsApp ya registrado para "${dup.name}"`); return }
    }

    // Un acompanante nuevo nace sin mesa: ya no hay cupo que validar aqui.
    const newPartySize = 1 + eMembers.length

    setESaving(true)
    setEError('')
    setEErrorReintentable(false)

    // Si algo no entra, el modal se queda abierto con los cambios y
    // Reintentar vuelve a correr todo. El insert va al final a proposito: es
    // la unica escritura que no es idempotente, y asi nunca se duplica a nadie.
    const fallar = (prefijo: string, fallo: ReturnType<typeof describirFallo>) => {
      if (fallo.tipo === 'interno') reportError(fallo.tecnico, { zona: 'planner' })
      setEError(prefijo + ' ' + fallo.detalle)
      setEErrorReintentable(fallo.reintentable)
      setESaving(false)
      loadTables()
    }

    const fGuest = falloDeEscritura(await supabase.from('guests').update({
      name: eName,
      phone: ePhone || null,
      email: eEmail || null,
      party_size: newPartySize,
      notes: eNotes || null,
      tags: eTags,
    }).eq('id', editGuest.id).select('id'))
    if (fGuest) return fallar('No se guardó.', fGuest)

    const deAcomp = 'Se guardó a ' + eName + ' pero no sus acompañantes.'
    const keepIds = eMembers.filter(m => m.id).map(m => m.id as string)
    const toDel = editGuest.party_members.map(m => m.id).filter(id => !keepIds.includes(id))
    if (toDel.length) {
      // Sin contar filas: en un reintento estos ya pueden estar borrados.
      const { error } = await supabase.from('party_members').delete().in('id', toDel)
      if (error) return fallar(deAcomp, describirFallo(error))
    }

    for (const m of eMembers.filter(m => m.id)) {
      const fm = falloDeEscritura(await supabase.from('party_members').update({
        name: m.name,
        phone: m.phone || null,
        rsvp_status: m.rsvp_status,
      }).eq('id', m.id!).select('id'))
      if (fm) return fallar(deAcomp, fm)
    }

    const ins = eMembers.filter(m => !m.id)
    if (ins.length) {
      const fi = falloDeEscritura(await supabase.from('party_members').insert(
        ins.map(m => ({
          guest_id: editGuest.id,
          event_id: eventId as string,
          name: m.name,
          phone: m.phone || null,
          rsvp_status: m.rsvp_status,
        }))
      ).select('id'), ins.length)
      if (fi) return fallar(deAcomp, fi)
    }

    await loadTables()
    setEditGuest(null)
    setESaving(false)
  }

  // Check-in: la palomita cambia al instante y regresa si la base no lo acepta.
  const pintarCheckin=(gId:string,valor:boolean)=>setTables(p=>p.map(t=>({...t,seats:t.seats.map(s=>s.guest?.id!==gId?s:{...s,guest:{...s.guest!,checked_in:valor}})})))
  const toggleCheckin=async(gId:string,cur:boolean):Promise<boolean>=>{
    if (!permiso.editar) return false
    pintarCheckin(gId,!cur)
    const fallo=falloDeEscritura(await supabase.from('guests').update({checked_in:!cur}).eq('id',gId).select('id'))
    if(!fallo)return true
    pintarCheckin(gId,cur)
    toast.fallo({titulo:'No se guardó el check-in de '+(guests.find(g=>g.id===gId)?.name??'el invitado'),fallo,reintentar:()=>toggleCheckin(gId,cur)})
    return false
  }
  const pintarMemberCheckin=(mId:string,gId:string,valor:boolean)=>setTables(p=>p.map(t=>({...t,seats:t.seats.map(s=>{if(s.guest?.id!==gId)return s;return{...s,guest:{...s.guest!,party_members:s.guest!.party_members.map(m=>m.id===mId?{...m,checked_in:valor}:m)}}})})))
  const toggleMemberCheckin=async(mId:string,gId:string,cur:boolean):Promise<boolean>=>{
    if (!permiso.editar) return false
    pintarMemberCheckin(mId,gId,!cur)
    const fallo=falloDeEscritura(await supabase.from('party_members').update({checked_in:!cur}).eq('id',mId).select('id'))
    if(!fallo)return true
    pintarMemberCheckin(mId,gId,cur)
    const nombre=guests.find(g=>g.id===gId)?.party_members.find(m=>m.id===mId)?.name||'el acompañante'
    toast.fallo({titulo:'No se guardó el check-in de '+nombre,fallo,reintentar:()=>toggleMemberCheckin(mId,gId,cur)})
    return false
  }

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
    await borrarMesa(t)
  }
  const borrarMesa=async(t:TableRecord):Promise<boolean>=>{
    const fallo=falloDeEscritura(await supabase.from('tables').delete().eq('id',t.id).select('id'))
    if(fallo){toast.fallo({titulo:'No se eliminó la Mesa '+t.number,fallo,reintentar:()=>borrarMesa(t)});return false}
    setTables(p=>p.filter(x=>x.id!==t.id))
    return true
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

  // Sentar o mover a varias personas a una mesa, de una en una. Cada persona
  // es su propia tanda: si una falla, las anteriores se quedan (son verdad).
  const sentarPersonas=async(claves:string[],tableId:string):Promise<boolean>=>{
    if(!permiso.editar)return false
    const t=tables.find(x=>x.id===tableId);if(!t)return false
    const gente=claves.map(c=>personas.find(p=>p.clave===c)).filter((p):p is Persona=>!!p)
    const nuevos=gente.filter(p=>mapa.get(p.clave)?.tableId!==tableId).length
    // El buscador y el plano ya apagan la mesa llena. Si llega aqui es que
    // alguien mas la lleno mientras tanto: se recarga y se dice, sin reintentar.
    if(nuevos>t.capacity-ocupacion(tableId)){await loadTables();toast.error({titulo:`La Mesa ${t.number} ya no tiene lugar para ${nuevos}`,detalle:'Alguien más la ocupó. La pantalla ya se actualizó.'});return false}
    let vivas=filas
    for(const p of gente){
      const ops=opsSentar(p,tableId,eventId as string,vivas,personas)
      if(ops.length===0)continue
      const fallo=await ejecutarOps(supabase,ops)
      if(fallo){await loadTables();toast.fallo({titulo:gente.length===1?`No se sentó a ${p.nombre} en la Mesa ${t.number}`:`No se sentó a todos en la Mesa ${t.number}`,fallo,reintentar:()=>sentarPersonas(claves,tableId),clave:'sentar-'+tableId});return false}
      vivas=await filasDeLaBase()
    }
    await loadTables()
    return true
  }
  const quitarPersona=async(p:Persona):Promise<boolean>=>{
    if(!permiso.editar)return false
    const ops=opsQuitar(p,filas,personas)
    if(ops.length===0)return true
    const fallo=await ejecutarOps(supabase,ops)
    if(fallo){await loadTables();toast.fallo({titulo:`No se quitó a ${p.nombre} de la mesa`,fallo,reintentar:()=>quitarPersona(p)});return false}
    await loadTables()
    return true
  }
  const removeGuest=async(p:Persona)=>{
    if(!permiso.editar)return
    const ok=await askConfirm({title:`¿Quitar a ${p.nombre} de esta mesa?`,confirmLabel:'Quitar'})
    if(!ok)return
    await quitarPersona(p)
  }
  const abrirMover=(p:Persona)=>setElegirMesa({personas:[p],titulo:'Mover a '+p.nombre})
  const verInvitado=(p:Persona)=>{const g=guests.find(x=>x.id===p.guestId);if(g)openEditGuest(g)}

  // La familia que se mueve con alguien: el titular jala a los suyos que estan
  // donde el esta (sin mesa juntos o en la misma mesa); un acompanante va solo.
  const grupoDe=useCallback((p:Persona):Persona[]=>{
    if(p.memberId)return [p]
    const donde=mapa.get(p.clave)?.tableId??null
    return [p,...personas.filter(x=>x.guestId===p.guestId&&x.memberId&&(mapa.get(x.clave)?.tableId??null)===donde)]
  },[mapa,personas])
  const onMarcar=(claves:string[],on:boolean)=>setMarcados(prev=>{const s=new Set(prev);for(const c of claves)on?s.add(c):s.delete(c);return s})
  const seleccion=useMemo(()=>personas.filter(p=>marcados.has(p.clave)&&!mapa.has(p.clave)),[personas,marcados,mapa])
  const sentarSeleccion=async(tableId:string)=>{
    const ok=await sentarPersonas(seleccion.map(p=>p.clave),tableId)
    if(ok)setMarcados(new Set())
  }

  // Arrastrar solo con mouse: con el dedo las personas se tocan y la lista
  // sigue haciendo scroll. Soltar en una mesa sienta o mueve; en el panel, quita.
  const sensors=useSensors(useSensor(MouseSensor,{activationConstraint:{distance:5}}))
  const onDragStart=(e:DragStartEvent)=>{const g=(e.active.data.current as {personas?:Persona[]}|undefined)?.personas;setArrastrando(g&&g.length?g:null)}
  const onDragEnd=async(e:DragEndEvent)=>{
    const gente=arrastrando;setArrastrando(null)
    if(!gente||!e.over)return
    const over=String(e.over.id)
    if(over==='panel'){for(const p of gente)if(mapa.has(p.clave)){if(!(await quitarPersona(p)))break};return}
    if(over.startsWith('t:'))await sentarPersonas(gente.map(p=>p.clave),over.slice(2))
  }
  const onDragCancel=()=>setArrastrando(null)
  // Posicion y giro del plano: si no se guardan, el plano regresa a lo que
  // dice la base (resetKey) y el aviso ofrece volver a mandar lo mismo.
  const handlePosSave=async(id:string,x:number,y:number):Promise<boolean>=>{
    if (!permiso.editar) return false
    const fallo=falloDeEscritura(await supabase.from('tables').update({position_x:x,position_y:y}).eq('id',id).select('id'))
    if(fallo){
      setCanvasResetKey(k=>k+1)
      const num=tables.find(t=>t.id===id)?.number
      toast.fallo({titulo:'No se guardó la posición de la Mesa '+(num??''),fallo,reintentar:async()=>{const ok=await handlePosSave(id,x,y);if(ok)setCanvasResetKey(k=>k+1);return ok},clave:'pos-'+id})
      return false
    }
    setTables(p=>p.map(t=>t.id===id?{...t,position_x:x,position_y:y}:t))
    return true
  }
  const handleRotSave=async(id:string,rotation:number):Promise<boolean>=>{
    if (!permiso.editar) return false
    const fallo=falloDeEscritura(await supabase.from('tables').update({rotation}).eq('id',id).select('id'))
    if(fallo){
      setCanvasResetKey(k=>k+1)
      const num=tables.find(t=>t.id===id)?.number
      toast.fallo({titulo:'No se guardó el giro de la Mesa '+(num??''),fallo,reintentar:async()=>{const ok=await handleRotSave(id,rotation);if(ok)setCanvasResetKey(k=>k+1);return ok},clave:'rot-'+id})
      return false
    }
    setTables(p=>p.map(t=>t.id===id?{...t,rotation}:t))
    return true
  }

  const handlePrint=()=>{
    const fd=(d:string)=>{const[y,mo,day]=d.split('T')[0].split('-').map(Number);return new Date(y,mo-1,day).toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
    const rows:string[]=[]; let n=1
    for(const t of tables){const ml=t.name?`${t.number} · ${t.name}`:String(t.number);for(const p of enMesa(t.id)){const g=guests.find(x=>x.id===p.guestId);const cls=p.memberId?'ar':'mr';const nombre=p.memberId?`${p.nombre} <span style="color:#999">· de ${p.titular}</span>`:p.nombre;rows.push(`<tr class="${cls}"><td>${n++}</td><td>${ml}</td><td class="nb">${nombre}</td><td>${estatusDe(p.rsvp).label}</td><td>${p.memberId?'—':(g?.tags.join(', ')||'—')}</td><td>${p.memberId?'—':(g?.notes||'—')}</td><td class="cc"><div class="cb"></div></td></tr>`)}}
    const total=tables.reduce((a,t)=>a+enMesa(t.id).length,0)
    const pd=new Date().toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})
    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;font-size:11px;color:#1D1E20;padding:20px}.hd{margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #1D1E20}.hd h1{font-size:18px;font-weight:700}.hm{display:flex;gap:20px;margin-top:5px;font-size:10px;color:#888}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;color:#888;padding:5px 8px;border-bottom:1.5px solid #1D1E20}.mr td{padding:6px 8px;border-bottom:1px solid #e8e8e8;white-space:nowrap}.ar td{padding:3px 8px;border-bottom:1px solid #f0f0f0;color:#666;white-space:nowrap}.nb{font-weight:600}.mn{padding-left:14px!important}.cc{text-align:center}.cb{display:inline-block;width:14px;height:14px;border:1.5px solid #1D1E20;border-radius:3px}.ft{margin-top:14px;padding-top:8px;border-top:1px solid #e8e8e8;font-size:9px;color:#aaa;display:flex;justify-content:space-between}.fb{font-weight:700;color:#48C9B0}@media print{body{padding:0}@page{margin:1.2cm;size:A4 landscape}tr{page-break-inside:avoid}}</style></head><body><div class="hd"><h1>${eventInfo?.name||'Lista'}</h1><div class="hm">${eventInfo?.event_date?`<span>📅 ${fd(eventInfo.event_date)}</span>`:''} ${eventInfo?.venue?`<span>📍 ${eventInfo.venue}</span>`:''}<span>👥 ${total} personas · ${tables.length} mesas</span></div></div><table><thead><tr><th>#</th><th>Mesa</th><th>Nombre</th><th>RSVP</th><th>Tags</th><th>Notas</th><th style="text-align:center">Llegó</th></tr></thead><tbody>${rows.join('')}</tbody></table><div class="ft"><span class="fb">Anfiora</span><span>Impreso el ${pd}</span></div></body></html>`
    const iframe=document.createElement('iframe');iframe.style.cssText='position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';document.body.appendChild(iframe)
    const doc=iframe.contentDocument||iframe.contentWindow?.document;if(!doc){document.body.removeChild(iframe);return}
    doc.open();doc.write(html);doc.close()
    iframe.onload=()=>{try{iframe.contentWindow?.focus();iframe.contentWindow?.print()}finally{setTimeout(()=>{if(document.body.contains(iframe))document.body.removeChild(iframe)},1000)}}
  }

  const TagChips=({tags}:{tags:string[]})=>(<>{tags.length===0?<span className="text-[11px] text-[#ddd]">—</span>:tags.map(tag=>{const i=eventTags.indexOf(tag);const c=TAG_COLORS[i>=0?i%TAG_COLORS.length:0];return<span key={tag} className="rounded-full border px-1.5 py-0.5 text-[9px] font-medium" style={{background:c.bg,borderColor:c.border,color:c.text}}>{tag}</span>})}</>)

  const mesaAsignar=assignModal?(tables.find(t=>t.id===assignModal.tableId)??null):null
  const panelSinMesa=<SinMesaPanel sinMesa={sinMesa} busqueda={panelBusqueda} setBusqueda={setPanelBusqueda} puedeEditar={permiso.editar} arrastrando={arrastrando} marcados={marcados} onMarcar={onMarcar} onTap={p=>setPersonaMenu(p)}/>
  const modalesPersona=(
    <>
      <ModalAsignar key={assignModal?.tableId??'ninguna'} table={mesaAsignar} personas={personas} mapa={mapa} ocupacion={ocupacion} numeroDeMesa={numeroDeMesa} onSentar={claves=>sentarPersonas(claves,assignModal!.tableId)} onClose={()=>setAssignModal(null)}/>
      <ModalElegirMesa abierto={elegirMesa} tables={tables} ocupacion={ocupacion} mapa={mapa} personas={personas} onElegir={tableId=>sentarPersonas(elegirMesa!.personas.map(p=>p.clave),tableId)} onClose={()=>setElegirMesa(null)}/>
      <PersonaMenu persona={personaMenu} sentado={!!personaMenu&&mapa.has(personaMenu.clave)} mesa={personaMenu&&mapa.get(personaMenu.clave)?nombreMesa(mapa.get(personaMenu.clave)!.tableId):'Sin mesa'} puedeEditar={permiso.editar} onMover={()=>personaMenu&&abrirMover(personaMenu)} onVer={()=>personaMenu&&verInvitado(personaMenu)} onQuitar={()=>personaMenu&&removeGuest(personaMenu)} onClose={()=>setPersonaMenu(null)}/>
      <Modal open={leyendaAbierta} onClose={()=>setLeyendaAbierta(false)} size="sm">
        <Modal.Header title="Qué significa cada ícono"/>
        <Modal.Body><LeyendaEstatus className="flex-col !items-start !gap-y-3 text-[15px]"/></Modal.Body>
      </Modal>
      <DragOverlay dropAnimation={null} zIndex={600}>{arrastrando&&<ChipFantasma personas={arrastrando}/>}</DragOverlay>
    </>
  )

  if (loading) return <Cargando mensaje="Cargando las mesas" />

  // ── CANVAS ──
  if(canvasMode)return(
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <CanvasFullscreen tables={tables} getOccupied={getOccupied} enMesa={enMesa} grupoDe={grupoDe} etiqueta={etiqueta} arrastrando={arrastrando} onPersona={p=>setPersonaMenu(p)} panel={panelSinMesa} onBack={()=>setCanvasMode(false)} onTableClick={t=>setCanvasDetailId(t.id)} onPositionSave={handlePosSave} onRotationSave={handleRotSave} onOpenCreate={openCreate} puedeEditar={permiso.editar} resetKey={canvasResetKey}
        decos={canvasDecos} setDecos={setCanvasDecos}
        decoRotations={canvasDecoRots} setDecoRotations={setCanvasDecoRots}
        tableColors={canvasTableColors} setTableColors={setCanvasTableColors}
        decoColors={canvasDecoColors} setDecoColors={setCanvasDecoColors}
      />
      {canvasDetail&&<TableDetailModal table={canvasDetail} ocupados={enMesa(canvasDetail.id)} ocupacion={ocupacion} etiqueta={etiqueta} onClose={()=>setCanvasDetailId(null)} onAssign={(id,cap)=>setAssignModal({tableId:id,tableCapacity:cap})} onPersona={p=>setPersonaMenu(p)} onEditTable={openEditTable} onDeleteTable={handleDeleteTable} puedeEditar={permiso.editar} puedeBorrar={permiso.borrar}/>}
      <ModalMesa visible={showModal && permiso.editar} editTable={editTable} mNum={mNum} setMNum={setMNum} mName={mName} setMName={setMName} mCap={mCap} setMCap={setMCap} mShape={mShape} setMShape={setMShape} mError={mError} mSaving={mSaving} onSave={handleSaveTable} onClose={()=>setShowModal(false)} inp={inp}/>
      {modalesPersona}
    </DndContext>
  )

  // ── LISTA ──
  const cols='28px 36px 24px 1.8fr 90px 100px 1fr 80px 60px 56px'
  const q=listSearch.trim().toLowerCase()
  const filtered=q?tables.filter(t=>t.name?.toLowerCase().includes(q)||String(t.number)===q||enMesa(t.id).some(p=>p.nombre.toLowerCase().includes(q)||(p.titular||'').toLowerCase().includes(q))):tables

  return(
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',background:'#ffffff',color:'#1D1E20'}}>
      {/* Header */}
      <div style={{flexShrink:0,borderBottom:'1px solid #e8e8e8'}} className="px-4 pt-4 pb-0 sm:px-6 sm:pt-5 lg:px-10 lg:pt-6">
        {/* Título + toggle de stats (solo mobile) */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-[#1D1E20] sm:text-xl lg:text-2xl">Mesas</h1>
            <p className="mt-0.5 text-xs text-[#888] sm:text-sm"><span className="sm:hidden">{tables.length} {tables.length===1?'mesa':'mesas'} · {sinMesa.length} sin mesa</span><span className="hidden sm:inline">Organiza tus invitados por mesa</span></p>
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

        <div className="mb-3 hidden flex-wrap items-center gap-2 sm:flex">
          <div className="flex overflow-hidden rounded-lg border border-[#e0e0e0]">
            <button className="flex items-center gap-1.5 bg-[#1D1E20] px-3 py-1.5 text-xs font-medium text-white"><List width={13} height={13}/><span className="hidden sm:inline">Lista</span></button>
            <button onClick={()=>setCanvasMode(true)} className="flex items-center gap-1.5 border-l border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#888] hover:bg-[#f5f5f5]"><MapIcon width={13} height={13}/><span className="hidden sm:inline">Canvas</span></button>
            {permiso.editar&&<button onClick={()=>setModoCheckin(v=>!v)} className={`flex items-center gap-1.5 border-l border-[#e0e0e0] px-3 py-1.5 text-xs font-medium transition ${modoCheckin?'bg-[#48C9B0] text-white':'text-[#888] hover:bg-[#f5f5f5]'}`}><CheckSquare width={13} height={13}/>Check-in{modoCheckin&&<span className="ml-1 rounded-full bg-white/25 px-1.5 text-[10px] tabular-nums">{llegaron} de {sentados}</span>}</button>}
          </div>
          <div className="group relative">
            <button type="button" aria-label="Qué significa cada ícono" className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e0e0e0] text-xs font-bold text-[#888] hover:border-[#48C9B0] hover:text-[#48C9B0]">?</button>
            <div className="invisible absolute left-0 top-9 z-30 w-max rounded-xl border border-[#e8e8e8] bg-white p-3 shadow-xl group-hover:visible group-focus-within:visible"><LeyendaEstatus className="max-w-[280px]" /></div>
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
        {/* Celular: el modo arriba a todo el ancho; buscar, ? y + abajo */}
        <div className="mb-3 flex flex-col gap-2 sm:hidden">
          <div className="flex overflow-hidden rounded-lg border border-[#e0e0e0] text-[13px] font-semibold">
            <button className="flex-1 bg-[#1D1E20] py-2 text-white">Lista</button>
            <button onClick={()=>setCanvasMode(true)} className="flex-1 border-l border-[#e0e0e0] py-2 text-[#666]">Canvas</button>
            {permiso.editar&&<button onClick={()=>setModoCheckin(v=>!v)} className={`flex-1 border-l border-[#e0e0e0] py-2 ${modoCheckin?'bg-[#48C9B0] text-white':'text-[#666]'}`}>Check-in{modoCheckin&&<span className="ml-1 text-[11px] font-medium tabular-nums opacity-90">{llegaron}/{sentados}</span>}</button>}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1"><Search width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]"/><input type="text" value={listSearch} onChange={e=>setListSearch(e.target.value)} placeholder="Buscar a alguien…" className="w-full rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] py-2 pl-9 pr-3 text-[15px] text-[#1D1E20] outline-none focus:border-[#48C9B0]"/></div>
            <button type="button" onClick={()=>setLeyendaAbierta(true)} aria-label="Qué significa cada ícono" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e0e0e0] text-sm font-bold text-[#888]">?</button>
            {permiso.editar&&(
              <div className="relative shrink-0">
                <button type="button" onClick={()=>setMenuMas(v=>!v)} aria-label="Agregar" className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#48C9B0] text-white"><Plus width={20} height={20}/></button>
                {menuMas&&<>
                  <div className="fixed inset-0 z-20" onClick={()=>setMenuMas(false)}/>
                  <div className="absolute right-0 top-12 z-30 w-48 rounded-xl border border-[#e8e8e8] bg-white p-1 shadow-xl">
                    <button type="button" onClick={()=>{setMenuMas(false);openCreate()}} className="w-full rounded-lg px-3 py-2.5 text-left text-[15px] text-[#1D1E20] hover:bg-[#f8f8f8]">Nueva mesa</button>
                    <button type="button" onClick={()=>{setMenuMas(false);setShowBulk(true)}} className="w-full rounded-lg px-3 py-2.5 text-left text-[15px] text-[#1D1E20] hover:bg-[#f8f8f8]">Agregar en bulk</button>
                    {tables.length>0&&<button type="button" onClick={()=>{setMenuMas(false);handlePrint()}} className="w-full rounded-lg px-3 py-2.5 text-left text-[15px] text-[#1D1E20] hover:bg-[#f8f8f8]">Imprimir lista</button>}
                  </div>
                </>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel de sin mesa (escritorio) + Lista */}
      <div style={{flex:1,minHeight:0,display:'flex'}}>
      <div className="hidden sm:flex" style={{height:'100%'}}>{panelSinMesa}</div>
      <div style={{flex:1,overflowY:'auto'}} className="px-4 pb-6 pt-3 sm:px-6 lg:px-10">
        {tables.length===0?(
          <div className="mt-5 rounded-xl border border-dashed border-[#e0e0e0] px-6 py-14 text-center"><p className="text-sm text-[#888]">Sin mesas aún</p><p className="mt-1 text-xs text-[#bbb]">Crea tu primera mesa para empezar</p><div className="mt-4 flex items-center justify-center gap-2">{permiso.editar&&<button onClick={()=>setShowBulk(true)} className="rounded-lg border border-[#e0e0e0] px-4 py-2.5 text-sm text-[#666] hover:border-[#48C9B0] hover:text-[#48C9B0]">Agregar en bulk</button>}{permiso.editar&&<button onClick={openCreate} className="rounded-lg bg-[#48C9B0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3ab89f]">+ Nueva mesa</button>}</div></div>
        ):(
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map(table=>(
                <MesaCard key={table.id} table={table} ocupados={enMesa(table.id)} etiqueta={etiqueta} puedeEditar={permiso.editar} puedeBorrar={permiso.borrar} modoCheckin={modoCheckin}
                  arrastrando={arrastrando} seleccion={seleccion}
                  onSentarSeleccion={()=>sentarSeleccion(table.id)} onEditar={()=>openEditTable(table)} onBorrar={()=>handleDeleteTable(table)} onAsignar={()=>setAssignModal({tableId:table.id,tableCapacity:table.capacity})}
                  onPersona={p=>setPersonaMenu(p)} onCheckin={p=>p.memberId?toggleMemberCheckin(p.memberId,p.guestId,p.checkedIn):toggleCheckin(p.guestId,p.checkedIn)}/>
              ))}
              {filtered.length===0&&<p className="col-span-full py-8 text-center text-sm text-[#bbb]">Nadie con ese nombre en una mesa</p>}
            </div>
          </>
        )}
      </div>
      </div>
      {/* Modal editar invitado */}
      {editGuest&&(
        <Modal open onClose={()=>setEditGuest(null)} size="md">
          <Modal.Header title={permisoInvitados.editar ? 'Editar invitado' : 'Detalle del invitado'} />
          <Modal.Body>
            {mapa.get(editGuest.id)&&(
              <div className="mb-4 rounded-lg border border-[#e8f8f4] bg-[#f0fdfb] px-3 py-2.5">
                <p className="text-[11px] font-semibold text-[#1a9e88]">Sentado en {nombreMesa(mapa.get(editGuest.id)!.tableId)}{etiqueta(personas.find(p=>p.clave===editGuest.id)!)?' · '+etiqueta(personas.find(p=>p.clave===editGuest.id)!):''}</p>
              </div>
            )}
            <fieldset disabled={!permisoInvitados.editar} className="m-0 min-w-0 border-0 p-0">
            <div className="flex flex-col gap-4">
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Nombre *</label><input type="text" value={eName} onChange={e=>setEName(e.target.value)} className={EDIT_GUEST_INPUT_CLASS}/></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">WhatsApp</label><input type="tel" value={ePhone} onChange={e=>setEPhone(e.target.value)} placeholder="+52 81 1234 5678" className={EDIT_GUEST_INPUT_CLASS}/></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Email</label><input type="email" value={eEmail} onChange={e=>setEEmail(e.target.value)} className={EDIT_GUEST_INPUT_CLASS}/></div>
              <div><label className="mb-1.5 block text-xs font-medium text-[#555]">Notas</label><textarea value={eNotes} onChange={e=>setENotes(e.target.value)} rows={2} className={`${EDIT_GUEST_INPUT_CLASS} resize-y`}/></div>
              {eventTags.length>0&&<div><label className="mb-1.5 block text-xs font-medium text-[#555]">Tags</label><TagSelector availableTags={eventTags} selectedTags={eTags} onChange={setETags}/></div>}
              <div className="border-t border-[#f0f0f0] pt-4"><MembersEditor value={eMembers} onChange={setEMembers} puedeEditar={permisoInvitados.editar}/></div>
            </div>
            </fieldset>
            {eError&&(
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] p-2.5 text-xs text-[#cc3333]">
                <span>{eError}</span>
                {eErrorReintentable&&permisoInvitados.editar&&<button onClick={handleEditSave} disabled={eSaving} className="shrink-0 font-semibold text-[#1f8a75] hover:underline disabled:opacity-60">{eSaving?'Reintentando…':'Reintentar'}</button>}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button onClick={()=>setEditGuest(null)} className="flex-1 rounded-lg border border-[#e0e0e0] py-3 text-sm text-[#888]">{permisoInvitados.editar?'Cancelar':'Cerrar'}</button>
            {permisoInvitados.editar&&(<button onClick={handleEditSave} disabled={eSaving} className="flex-[2] rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white disabled:opacity-60">{eSaving?'Guardando…':'Guardar cambios'}</button>)}
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
              <div className="grid grid-cols-3 gap-2">{FORMAS.map(s=><button key={s} type="button" onClick={()=>setBShape(s)} className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] font-medium transition ${bShape===s?'border-[#48C9B0] bg-[#f0fdfb] text-[#1a9e88]':'border-[#e0e0e0] text-[#888]'}`}><div className="flex h-8 w-full items-center justify-center">{SHAPE_ICONS[s]}</div>{SHAPE_LABELS[s]}</button>)}</div>
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

      {modalesPersona}
    </div>
    </DndContext>
  )
}
export default function MesasPage() {
  return (
    <FeatureGuard feature="mesas">
      <MesasPageInner />
    </FeatureGuard>
  )
}
