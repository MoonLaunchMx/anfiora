'use client'

import { Modal } from '@/app/components/ui/Modal'

// Lo que los tres modales de review comparten: el pie (Después / Guardar) y
// la caja de problemas. Vive aqui para que un cambio de copy o de estilo se
// haga una vez y no tres.
export function PieDeReview({ onSkip, onSave, saving, puedeEditar }: {
  onSkip: () => void
  onSave: () => void
  saving: boolean
  puedeEditar: boolean
}) {
  return (
    <Modal.Footer>
      <button
        onClick={onSkip}
        disabled={saving}
        className="ml-auto px-4 py-2 text-sm text-[var(--text-sec)] hover:text-[var(--text)] disabled:opacity-50"
      >
        Después
      </button>
      {puedeEditar && (
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-[#48C9B0] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3aa896] disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar review'}
        </button>
      )}
    </Modal.Footer>
  )
}

export function ProblemasDeReview({ problemas }: { problemas: string[] }) {
  if (problemas.length === 0) return null
  return (
    <div className="space-y-1 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2">
      {problemas.map(p => (
        <p key={p} className="text-xs text-[var(--error-text)]">{p}</p>
      ))}
    </div>
  )
}
