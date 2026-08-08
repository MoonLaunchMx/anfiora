'use client'

import CajaShell, { CHIP_MUTE, type PropsCaja } from './CajaShell'

const ROL_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

export default function CajaEquipo({ m, colaboradores, usuarioEmail, modoPersonalizar, onQuitar }: PropsCaja) {
  const ev = m.event

  const gente = [
    {
      id: 'owner',
      nombre: ev.is_shared ? (ev.owner_name || 'El dueño') : (usuarioEmail || 'Tú'),
      rol: 'Dueño',
    },
    ...colaboradores.map(c => ({
      id: c.event_id + c.email,
      nombre: c.full_name || c.email,
      rol: ROL_LABEL[c.role] ?? c.role,
    })),
  ]

  return (
    <CajaShell
      id="equipo"
      titulo="Equipo"
      accion={{ label: '+ Invitar', href: `/events/${ev.id}/configuracion` }}
      modoPersonalizar={modoPersonalizar}
      onQuitar={onQuitar}
    >
      <div className="px-5 py-1">
        {gente.map(p => (
          <div key={p.id} className="flex items-center gap-3 border-t border-[#F0F0F0] py-3 first:border-t-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F0FDFB] text-[13px] font-bold text-[#1A9E88]">
              {p.nombre.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#1D1E20]">{p.nombre}</span>
            <span className={'shrink-0 ' + CHIP_MUTE}>{p.rol}</span>
          </div>
        ))}
      </div>
    </CajaShell>
  )
}
