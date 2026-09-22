// Estatus de Mesas: color, nombre e icono. El icono va siempre junto al
// color, para que el estatus se lea sin depender de distinguir verde de rojo.
// Accion necesaria deja de compartir color con Declinado.
export const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  confirmed:        { bg: '#d4f5e9', border: '#5DCAA5', text: '#0F6E56', label: 'Confirmado'      },
  pending:          { bg: '#fef3c7', border: '#FAC775', text: '#92400e', label: 'Pendiente'        },
  declined:         { bg: '#fee2e2', border: '#F09595', text: '#991b1b', label: 'Declinado'        },
  mensaje_enviado:  { bg: '#dbeafe', border: '#85B7EB', text: '#1e40af', label: 'Msg. enviado'     },
  respondio:        { bg: '#ffedd5', border: '#f0c090', text: '#9a3412', label: 'Respondió'        },
  accion_necesaria: { bg: '#fce7f3', border: '#e88bbd', text: '#9d174d', label: 'Acción necesaria' },
}

export const estatusDe = (rsvp: string) => STATUS_COLORS[rsvp] || STATUS_COLORS.pending

// El mismo icono como trazo SVG (viewBox 24), para las sillas del plano.
export const GLIFO_ESTATUS: Record<string, string> = {
  confirmed: 'm6 12 4 4 8-8',
  pending: 'M12 7v5l3 2',
  declined: 'M7 7l10 10M17 7 7 17',
  mensaje_enviado: 'm20 4-6 16-3-7-7-3z',
  respondio: 'M5 6h14v9H9l-4 4z',
  accion_necesaria: 'M12 6v7M12 17.5h.01',
}
export const glifoDe = (rsvp: string) => GLIFO_ESTATUS[rsvp] || GLIFO_ESTATUS.pending

export const ORDEN_ESTATUS = ['confirmed', 'pending', 'mensaje_enviado', 'respondio', 'accion_necesaria', 'declined']
