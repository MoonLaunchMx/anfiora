'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { AdminUser } from './lib/types'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#f0f0f0] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1D1E20]">Zona de riesgo</h2>
              <p className="text-xs text-[#888]">Eliminar cuenta de forma permanente</p>
            </div>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1 text-[#aaa] transition hover:bg-[#f5f5f5] hover:text-[#1D1E20]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
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
            className="mt-1.5 w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm text-[#1D1E20] outline-none focus:border-red-400"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#f0f0f0] px-5 py-3">
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
      </div>
    </div>
  )
}
