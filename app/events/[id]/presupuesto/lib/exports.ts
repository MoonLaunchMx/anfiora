import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  BudgetCategory, BUDGET_CATEGORY_LABELS, EventBudget, Currency, formatCurrency,
} from '@/lib/types'

// Datos preparados para export
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

// Construye nombre de archivo seguro
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

  // Header de la hoja
  rows.push(['Presupuesto', data.eventName])
  if (data.eventDate) rows.push(['Fecha del evento', data.eventDate])
  rows.push(['Moneda', data.currency])
  rows.push([]) // linea vacia
  rows.push(['Categoria', 'Partida', 'Estimado', 'Cotizado', 'Pagado', 'Por pagar'])

  // Filas por categoria
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

  // Linea de totales
  rows.push([])
  rows.push([
    'TOTAL', '',
    data.totalBudget,
    data.totalContracted,
    data.totalPaid,
    data.totalContracted - data.totalPaid,
  ])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Ancho de columnas
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

  // Header
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

  // Construir filas para autoTable
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

  // Fila de total
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
    headStyles: {
      fillColor: [72, 201, 176],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 50,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
  })

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY || 200
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text('Generado en Anfiora', 14, finalY + 10)

  doc.save(buildFileName(data.eventName, 'pdf'))
}