import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type DjSong = {
  song_title: string
  artist: string
  category: string | null
  guest_name: string
  is_host_pick: boolean
  duration_ms: number | null
  spotify_url: string | null
  notes: string | null
}

export type DjExportData = {
  eventName: string
  eventDate: string | null
  songs: DjSong[]
}

function fmtDuration(ms: number | null): string {
  if (!ms) return ''
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  const [year, month, day] = d.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

function buildFileName(eventName: string, ext: string): string {
  const safe = eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  return `playlist-dj-${safe}.${ext}`
}

function buildCounts(songs: DjSong[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of songs) {
    if (s.is_host_pick) continue
    const key = `${s.song_title.toLowerCase().trim()}|${s.artist.toLowerCase().trim()}`
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}

const HEADERS = ['Orden', 'Cancion', 'Artista', 'Etapa', 'De los novios', 'Veces pedida', 'Pedida por', 'Duracion', 'Spotify', 'Notas']

function buildRows(data: DjExportData): (string | number)[][] {
  const counts = buildCounts(data.songs)
  return data.songs.map((s, i) => {
    const key = `${s.song_title.toLowerCase().trim()}|${s.artist.toLowerCase().trim()}`
    return [
      i + 1,
      s.song_title,
      s.artist,
      s.category || '',
      s.is_host_pick ? 'Si' : 'No',
      s.is_host_pick ? '' : (counts.get(key) || 1),
      s.guest_name,
      fmtDuration(s.duration_ms),
      s.spotify_url || '',
      s.notes || '',
    ]
  })
}

export function exportDjToExcel(data: DjExportData) {
  const wb = XLSX.utils.book_new()
  const rows: (string | number)[][] = []

  rows.push([`Playlist DJ — ${data.eventName}`])
  if (data.eventDate) rows.push([fmtDate(data.eventDate)])
  rows.push([])
  rows.push(HEADERS)
  rows.push(...buildRows(data))

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 6 }, { wch: 32 }, { wch: 24 }, { wch: 14 }, { wch: 12 },
    { wch: 11 }, { wch: 20 }, { wch: 9 }, { wch: 44 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Playlist')
  XLSX.writeFile(wb, buildFileName(data.eventName, 'xlsx'))
}

export function exportDjToPDF(data: DjExportData) {
  const doc = new jsPDF({ orientation: 'landscape' })

  doc.setFontSize(14)
  doc.text(`Playlist DJ — ${data.eventName}`, 14, 16)
  if (data.eventDate) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(fmtDate(data.eventDate), 14, 22)
  }

  autoTable(doc, {
    startY: data.eventDate ? 27 : 22,
    head: [HEADERS],
    body: buildRows(data).map(r => r.map(String)),
    styles: { fontSize: 7.5, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [72, 201, 176], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12 },
      7: { cellWidth: 16 },
      8: { cellWidth: 50 },
    },
  })

  doc.save(buildFileName(data.eventName, 'pdf'))
}

export function exportDjToM3U(data: DjExportData) {
  const lines = ['#EXTM3U']
  for (const s of data.songs) {
    const secs = s.duration_ms ? Math.round(s.duration_ms / 1000) : -1
    lines.push(`#EXTINF:${secs},${s.artist} - ${s.song_title}`)
    lines.push(s.spotify_url || '')
  }
  const blob = new Blob([lines.join('\n')], { type: 'audio/x-mpegurl;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = buildFileName(data.eventName, 'm3u8')
  a.click()
  URL.revokeObjectURL(url)
}
