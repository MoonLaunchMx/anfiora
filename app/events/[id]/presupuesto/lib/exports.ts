import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BudgetCategory, BUDGET_CATEGORY_LABELS, EventBudget, Currency, formatCurrency,
} from '@/lib/types'
import { getSuggestedItems } from './templates'
import { categoryLabel } from './categories'
import { selloDeFecha } from '@/lib/presupuesto/import'

type ExportData = {
  eventName: string
  eventDate: string | null
  currency: Currency
  venue?: string | null
  hosts?: string | null
  itemsByCategory: Record<BudgetCategory, EventBudget[]>
  contractedByItem: Record<string, number>
  paidByItem: Record<string, number>
  totalBudget: number
  totalContracted: number
  totalPaid: number
}

function buildFileName(eventName: string, ext: string): string {
  const clean = eventName.replace(/[\\/:*?"<>|]/g, '').trim()
  return `Presupuesto Anfiora ${clean}.${ext}`
}

function loadImage(src: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0)
      try {
        resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// ============================================
// EXPORT EXCEL
// ============================================
export function exportToExcel(data: ExportData) {
  const rows: any[] = []

  rows.push(['Anfiora'])
  rows.push(['Presupuesto del evento'])
  rows.push([])
  rows.push(['Evento', data.eventName])
  if (data.hosts) rows.push(['Anfitriones', data.hosts])
  if (data.eventDate) rows.push(['Fecha', data.eventDate])
  if (data.venue) rows.push(['Lugar', data.venue])
  rows.push(['Moneda', data.currency])
  // Sirve para avisar si alguien reimporta un archivo viejo (lib/presupuesto/import.ts)
  rows.push(['Generado', selloDeFecha()])
  rows.push([])
  rows.push(['Categoría', 'Concepto', 'Estimado', 'Cotizado', 'Pagado', 'Por pagar'])

  const categories = Object.keys(data.itemsByCategory) as BudgetCategory[]
  categories.forEach(cat => {
    const items = data.itemsByCategory[cat]
    if (!items || items.length === 0) return
    items.forEach(item => {
      const contracted = data.contractedByItem[item.id] || 0
      const paid       = data.paidByItem[item.id] || 0
      const pending    = contracted - paid
      rows.push([
        BUDGET_CATEGORY_LABELS[cat],
        item.subcategory || '(sin nombre)',
        item.budget_amount,
        contracted,
        paid,
        pending,
      ])
    })
  })

  rows.push([])
  rows.push([
    'TOTAL', '',
    data.totalBudget,
    data.totalContracted,
    data.totalPaid,
    data.totalContracted - data.totalPaid,
  ])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 20 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto')
  XLSX.writeFile(wb, buildFileName(data.eventName, 'xlsx'))
}

// ============================================
// EXPORT PDF
// ============================================
export async function exportToPDF(data: ExportData) {
  const doc = new jsPDF()
  const pageW = doc.internal.pageSize.getWidth()

  let logoBottom = 14
  const logo = await loadImage('/images/logo.png')
  if (logo) {
    const lw = 40
    const lh = (logo.h / logo.w) * lw
    doc.addImage(logo.dataUrl, 'PNG', pageW - 14 - lw, 14, lw, lh)
    logoBottom = 14 + lh
  }

  const titleY = logo ? (14 + logoBottom) / 2 + 2 : 20
  doc.setFontSize(16)
  doc.setTextColor(29, 30, 32)
  doc.text('Presupuesto', 14, titleY)

  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(data.hosts ? `${data.eventName} — ${data.hosts}` : data.eventName, 14, titleY + 7)

  let textBottom = titleY + 7
  const meta: string[] = []
  if (data.eventDate) meta.push(data.eventDate)
  if (data.venue) meta.push(data.venue)
  if (meta.length > 0) {
    doc.setFontSize(9)
    doc.text(meta.join('   ·   '), 14, titleY + 13)
    textBottom = titleY + 13
  }

  const startY = Math.max(textBottom, logoBottom) + 6

  const tableRows: any[] = []
  const categories = Object.keys(data.itemsByCategory) as BudgetCategory[]

  categories.forEach(cat => {
    const items = data.itemsByCategory[cat]
    if (!items || items.length === 0) return
    items.forEach((item, idx) => {
      const contracted = data.contractedByItem[item.id] || 0
      const paid       = data.paidByItem[item.id] || 0
      const pending    = contracted - paid
      tableRows.push([
        idx === 0 ? BUDGET_CATEGORY_LABELS[cat] : '',
        item.subcategory || '(sin nombre)',
        formatCurrency(item.budget_amount, data.currency),
        formatCurrency(contracted, data.currency),
        formatCurrency(paid, data.currency),
        formatCurrency(pending, data.currency),
      ])
    })
  })

  tableRows.push([
    { content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold' } },
    { content: formatCurrency(data.totalBudget, data.currency), styles: { fontStyle: 'bold' } },
    { content: formatCurrency(data.totalContracted, data.currency), styles: { fontStyle: 'bold' } },
    { content: formatCurrency(data.totalPaid, data.currency), styles: { fontStyle: 'bold' } },
    { content: formatCurrency(data.totalContracted - data.totalPaid, data.currency), styles: { fontStyle: 'bold' } },
  ])

  autoTable(doc, {
    startY,
    head: [['Categoría', 'Concepto', 'Estimado', 'Cotizado', 'Pagado', 'Por pagar']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [72, 201, 176], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: 50 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  })

  const finalY = (doc as any).lastAutoTable.finalY || 200
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text('Generado en Anfiora', 14, finalY + 10)
  doc.save(buildFileName(data.eventName, 'pdf'))
}

// ============================================
// PLANTILLA PARA IMPORTAR
// ============================================
export function downloadImportTemplate(opts: { categories: string[]; eventType: string | null; eventCategory: string | null }) {
  const { categories, eventType, eventCategory } = opts
  const suggested = getSuggestedItems(eventType, eventCategory)

  // Hoja "Instrucciones"
  const instrucciones: any[] = [
    ['Plantilla de presupuesto - Anfiora'],
    [],
    ['Generado', selloDeFecha()],
    [],
    ['Como usar esta plantilla:'],
    ['1) Ve a la hoja "Presupuesto".'],
    ['2) Escribe el monto estimado de cada concepto en la columna "Presupuesto".'],
    ['3) Agrega tus propios conceptos en filas nuevas (respeta las 3 columnas).'],
    ['4) Guarda el archivo y subelo en el boton "Importar" dentro de Presupuesto.'],
    [],
    ['Notas:'],
    ['- La columna "Categoria" agrupa tus conceptos; usa las que ya vienen en la lista.'],
    ['- Un concepto que ya tengas NO se duplica: se le actualiza el monto.'],
    ['- Si dejas el monto en blanco, el que ya tengas en la app no se toca.'],
    ['- Borrar filas aqui NO borra nada en la app; eso se hace desde Anfiora.'],
    ['- Si le cambias el nombre a un concepto, el import te preguntara si es el mismo.'],
    ['- Antes de guardar veras la lista completa con el monto anterior y el nuevo.'],
  ]
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucciones)
  wsInstr['!cols'] = [{ wch: 70 }]

  // Hoja "Presupuesto" pre-llenada
  const rows: any[] = [['Categoría', 'Concepto', 'Presupuesto']]
  for (const cat of categories) {
    const items = suggested.filter(s => s.category === cat)
    if (items.length === 0) {
      rows.push([categoryLabel(cat), '', ''])
    } else {
      items.forEach(it => rows.push([categoryLabel(cat), it.concepto, '']))
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 22 }, { wch: 38 }, { wch: 16 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto')
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones')
  XLSX.writeFile(wb, 'Plantilla presupuesto Anfiora.xlsx')
}