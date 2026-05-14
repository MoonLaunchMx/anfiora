import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PagoExport = {
  supplier_name: string
  supplier_category: string
  payment_date: string
  amount: number
  payment_method: string | null
  paid_by: string | null
  reference: string | null
}

export type PagosExportData = {
  eventName: string
  eventDate: string | null
  currency: string
  pagos: PagoExport[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  transferencia: 'Transferencia',
  efectivo:      'Efectivo',
  tarjeta:       'Tarjeta',
  cheque:        'Cheque',
}

function fmtDate(d: string) {
  const [year, month, day] = d.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtCurrency(amount: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount)
}

function buildFileName(eventName: string, ext: string): string {
  const safe = eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const date = new Date().toISOString().split('T')[0]
  return `pagos_${safe}_${date}.${ext}`
}

function groupBySupplier(pagos: PagoExport[]): Map<string, PagoExport[]> {
  const map = new Map<string, PagoExport[]>()
  for (const p of pagos) {
    if (!map.has(p.supplier_name)) map.set(p.supplier_name, [])
    map.get(p.supplier_name)!.push(p)
  }
  return map
}

// ─── Export Excel — 2 pestañas ────────────────────────────────────────────────

export function exportPagosToExcel(data: PagosExportData) {
  const wb = XLSX.utils.book_new()
  const grouped = groupBySupplier(data.pagos)
  const total   = data.pagos.reduce((s, p) => s + p.amount, 0)

  // ── Pestaña 1: Por proveedor ──────────────────────────────────────────────

  const tab1: any[] = []

  // Headers
  tab1.push(['Proveedor', 'Fecha', 'Pagado por', 'Metodo', 'Referencia', 'Monto'])

  grouped.forEach((items, supplierName) => {
    const subtotal = items.reduce((s, p) => s + p.amount, 0)
    items.forEach((p, i) => {
      tab1.push([
        i === 0 ? supplierName : '',
        fmtDate(p.payment_date),
        p.paid_by   || '—',
        METHOD_LABEL[p.payment_method || ''] || p.payment_method || '—',
        p.reference || '—',
        p.amount,
      ])
    })
    // Subtotal sin fila vacía
    tab1.push(['', '', '', '', 'Subtotal ' + supplierName, subtotal])
  })

  // Total global
  tab1.push(['', '', '', '', 'TOTAL', total])

  const ws1 = XLSX.utils.aoa_to_sheet(tab1)
  ws1['!cols'] = [
    { wch: 26 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 26 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, 'Por proveedor')

  // ── Pestaña 2: Historial flat ─────────────────────────────────────────────

  const tab2: any[] = []

  // Headers
  tab2.push(['Proveedor', 'Pagado por', 'Metodo', 'Monto', 'Fecha'])

  data.pagos.forEach(p => {
    tab2.push([
      p.supplier_name,
      p.paid_by   || '—',
      METHOD_LABEL[p.payment_method || ''] || p.payment_method || '—',
      p.amount,
      fmtDate(p.payment_date),
    ])
  })

  // Total
  tab2.push(['', '', 'TOTAL', total, ''])

  const ws2 = XLSX.utils.aoa_to_sheet(tab2)
  ws2['!cols'] = [
    { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, 'Historial')

  XLSX.writeFile(wb, buildFileName(data.eventName, 'xlsx'))
}

// ─── Export PDF ───────────────────────────────────────────────────────────────

export function exportPagosToPDF(data: PagosExportData) {
  const doc = new jsPDF()
  const totalPagado = data.pagos.reduce((s, p) => s + p.amount, 0)

  // Encabezado
  doc.setFontSize(18)
  doc.setTextColor(29, 30, 32)
  doc.text('Historial de Pagos', 14, 18)

  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(data.eventName, 14, 25)

  if (data.eventDate) {
    doc.setFontSize(9)
    doc.setTextColor(150)
    doc.text(fmtDate(data.eventDate), 14, 31)
  }

  // Resumen de métricas
  const grouped = groupBySupplier(data.pagos)
  doc.setFontSize(9)
  doc.setTextColor(100)
  const resumen = [
    'Total pagado: ' + fmtCurrency(totalPagado, data.currency),
    'Pagos: ' + data.pagos.length,
    'Proveedores: ' + grouped.size,
  ].join('   ·   ')
  doc.text(resumen, 14, data.eventDate ? 38 : 32)

  // Tabla agrupada por proveedor
  const tableRows: any[] = []

  grouped.forEach((items, supplierName) => {
    const subtotal = items.reduce((s, p) => s + p.amount, 0)

    // Fila de grupo
    tableRows.push([
      {
        content: supplierName,
        colSpan: 5,
        styles: {
          fillColor: [248, 245, 240],
          fontStyle: 'bold',
          textColor: [29, 30, 32],
          fontSize: 8,
        },
      },
      {
        content: fmtCurrency(subtotal, data.currency),
        styles: {
          fillColor: [248, 245, 240],
          fontStyle: 'bold',
          textColor: [29, 30, 32],
          halign: 'right',
          fontSize: 8,
        },
      },
    ])

    // Filas de pagos
    items.forEach(p => {
      tableRows.push([
        { content: supplierName, styles: { textColor: [150, 150, 150], fontSize: 7.5 } },
        fmtDate(p.payment_date),
        p.paid_by   || '—',
        METHOD_LABEL[p.payment_method || ''] || p.payment_method || '—',
        p.reference || '—',
        { content: fmtCurrency(p.amount, data.currency), styles: { halign: 'right' } },
      ])
    })
  })

  // Total global
  tableRows.push([
    {
      content: 'TOTAL',
      colSpan: 5,
      styles: { fontStyle: 'bold', textColor: [29, 30, 32], fontSize: 8.5 },
    },
    {
      content: fmtCurrency(totalPagado, data.currency),
      styles: {
        fontStyle: 'bold',
        textColor: [72, 201, 176],
        halign: 'right',
        fontSize: 8.5,
      },
    },
  ])

  autoTable(doc, {
    startY: data.eventDate ? 44 : 38,
    head: [['Proveedor', 'Fecha', 'Pagado por', 'Metodo', 'Referencia', 'Monto']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [72, 201, 176],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: { fontSize: 8, textColor: 80 },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles: { 5: { halign: 'right' } },
  })

  // Footer
  const finalY   = (doc as any).lastAutoTable.finalY || 200
  const pageH    = doc.internal.pageSize.height
  doc.setFontSize(7.5)
  doc.setTextColor(180)
  doc.text(
    'Hecho con Anfiora  ·  anfiora.com  ·  Generado el ' + new Date().toLocaleDateString('es-MX'),
    14,
    Math.min(finalY + 10, pageH - 10)
  )

  doc.save(buildFileName(data.eventName, 'pdf'))
}