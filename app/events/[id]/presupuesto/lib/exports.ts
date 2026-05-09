import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BudgetCategory, BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS, EventBudget, Currency, formatCurrency,
} from '@/lib/types'

type ExportData = {
  eventName: string
  eventDate: string | null
  currency: Currency
  itemsByCategory: Record<BudgetCategory, EventBudget[]>
  contractedByItem: Record<string, number>
  paidByItem: Record<string, number>
  totalBudget: number
  totalContracted: number
  totalPaid: number
}

function buildFileName(eventName: string, ext: string): string {
  const safe = eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const date = new Date().toISOString().split('T')[0]
  return `presupuesto_${safe}_${date}.${ext}`
}

// ============================================
// EXPORT EXCEL
// ============================================
export function exportToExcel(data: ExportData) {
  const rows: any[] = []

  rows.push(['Presupuesto', data.eventName])
  if (data.eventDate) rows.push(['Fecha del evento', data.eventDate])
  rows.push(['Moneda', data.currency])
  rows.push([])
  rows.push(['Categoria', 'Partida', 'Estimado', 'Cotizado', 'Pagado', 'Por pagar'])

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
export function exportToPDF(data: ExportData) {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.setTextColor(29, 30, 32)
  doc.text('Presupuesto', 14, 18)

  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(data.eventName, 14, 25)

  if (data.eventDate) {
    doc.setFontSize(9)
    doc.text(data.eventDate, 14, 31)
  }

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
    startY: 38,
    head: [['Categoria', 'Partida', 'Estimado', 'Cotizado', 'Pagado', 'Por pagar']],
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
export function downloadImportTemplate() {
  // Hoja de instrucciones + datos de ejemplo
  const rows: any[] = [
    ['Categoria', 'Concepto', 'Presupuesto'],
    // Ejemplos por categoria
    ...BUDGET_CATEGORIES.map(cat => [
      BUDGET_CATEGORY_LABELS[cat],
      'Ejemplo: ' + (cat === 'Venue' ? 'Salon principal' :
                     cat === 'Banquete' ? 'Catering 200 personas' :
                     cat === 'Audio y Video' ? 'DJ' :
                     cat === 'Imagen' ? 'Fotografia' :
                     cat === 'Decoracion' ? 'Floreria' : 'Concepto'),
      0,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Ancho de columnas
  ws['!cols'] = [{ wch: 22 }, { wch: 35 }, { wch: 16 }]

  // Hoja de categorias validas como referencia
  const refRows: any[] = [
    ['Categorias validas (copia exactamente como aparece aqui)'],
    ...BUDGET_CATEGORIES.map(cat => [BUDGET_CATEGORY_LABELS[cat]]),
  ]
  const wsRef = XLSX.utils.aoa_to_sheet(refRows)
  wsRef['!cols'] = [{ wch: 40 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto')
  XLSX.utils.book_append_sheet(wb, wsRef, 'Categorias')

  XLSX.writeFile(wb, 'plantilla_presupuesto_anfiora.xlsx')
}