'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { AdminUser } from './lib/types'
import { Modal } from '@/app/components/ui/Modal'

interface Props {
  user: AdminUser
  loading: boolean
  onCancel: () => void
  onConfirm: (emailConfirm: string) => void
}

export default function DeleteUserModal({ user, loading, onCancel, onConfirm }: Props) {
  const [emailConfirm, setEmailConfirm] = useState('')

  const canDelete = emailConfirm.trim().toLowerCase() === user.email.trim().toLowerCase()

  return (
    <Modal open onClose={onCancel} size="md">
      <Modal.Header title="Zona de riesgo" subtitle="Eliminar cuenta de forma permanente" />
      <Modal.Body>
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <p className="text-sm text-[#555]">
            Vas a eliminar a <span className="font-semibold text-[#1D1E20]">{user.full_name || user.email}</span>.
            Esto borra su cuenta y <span className="font-semibold text-red-600">todos sus datos</span>: no se puede deshacer.
          </p>

          <div className="mt-3 rounded-lg border border-[#f0f0f0] bg-[#fafafa] px-3 py-2 text-xs text-[#666]">
            Se borrara en cascada:{' '}
            <span className="font-medium text-[#1D1E20]">{user.event_count} evento{user.event_count !== 1 ? 's' : ''}</span>
            {', '}
            <span className="font-medium text-[#1D1E20]">{user.total_count} persona{user.total_count !== 1 ? 's' : ''}</span>
            {' (invitados + acompanantes) y todo lo asociado (mesas, presupuesto, proveedores, pagos, mensajes).'}
          </div>

          <label className="mt-4 block text-xs font-medium text-[#666]">
            Escribe <span className="font-semibold text-[#1D1E20]">{user.email}</span> para confirmar
          </label>
          <input
            type="text"
            autoFocus
            value={emailConfirm}
            onChange={e => setEmailConfirm(e.target.value)}
            placeholder={user.email}
            className="mt-1.5 w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-base text-[#1D1E20] outline-none focus:border-red-400"
          />
      </Modal.Body>
      <Modal.Footer>
        <div className="flex w-full items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm text-[#555] transition hover:bg-[#f5f5f5] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(emailConfirm)}
            disabled={!canDelete || loading}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Eliminando...' : 'Eliminar definitivamente'}
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  )
}
