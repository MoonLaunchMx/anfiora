import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const ALLOWLIST = [
  ['app/globals.css', 'animaciones decorativas del landing, vh es correcto ahi'],
  ['app/page.tsx', 'landing publica de alto completo'],
  ['app/[segment]/SegmentClient.tsx', 'landing de nicho de alto completo'],
  ['app/components/ui/Modal.tsx', 'el primitivo, unico autorizado a montar un overlay'],
  ['app/components/ui/ConfirmModal.tsx', 'primitivo de confirmacion'],
]

const VH = /(?<![a-z])(\d+(?:\.\d+)?)vh(?![a-z])/
const SCREEN = /\b(?:min-)?h-screen\b/
const OVERLAY = /fixed\s+inset-0/
const SHEET = /rounded-t-2xl/

function isAllowed(file) {
  const norm = file.split(sep).join('/')
  return ALLOWLIST.some(([path]) => norm === path)
}

export function auditSource(file, source) {
  if (isAllowed(file)) return []
  const lines = source.split('\n')
  const out = []

  lines.forEach((text, i) => {
    if (VH.test(text)) out.push({ file, line: i + 1, rule: 'vh', snippet: text.trim() })
    if (SCREEN.test(text)) out.push({ file, line: i + 1, rule: 'h-screen', snippet: text.trim() })
  })

  const hasOverlay = lines.some(l => OVERLAY.test(l))
  const hasSheet = lines.some(l => SHEET.test(l))
  if (hasOverlay && hasSheet) {
    const line = lines.findIndex(l => SHEET.test(l)) + 1
    out.push({ file, line, rule: 'modal-a-mano', snippet: lines[line - 1].trim() })
  }

  return out
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.(tsx?|css)$/.test(entry)) acc.push(full)
  }
  return acc
}

function main() {
  const root = process.cwd()
  const files = walk(join(root, 'app'))
  const violations = files.flatMap(f => auditSource(relative(root, f), readFileSync(f, 'utf8')))

  console.log(`viewport-audit: ${files.length} archivos revisados en app/`)

  if (violations.length === 0) {
    console.log('viewport-audit: limpio')
    return
  }

  console.error(`\nviewport-audit: ${violations.length} violaciones\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.snippet.slice(0, 90)}`)
  }
  console.error(`
Usa dvh en vez de vh, y el primitivo <Modal> de app/components/ui/Modal.tsx
en vez de escribir un overlay a mano. Si la excepcion es legitima, agregala
a ALLOWLIST en scripts/viewport-audit.mjs con el motivo escrito.
`)
  process.exit(1)
}

// pathToFileURL y no `file://${argv[1]}`: en Windows la ruta es C:\... y la comparacion directa nunca casa
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
