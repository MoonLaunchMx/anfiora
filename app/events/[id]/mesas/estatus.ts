// Colores de estatus de Mesas. Se unifican con los de Invitados en el PR de
// estatus con icono; por ahora viven aqui para que los componentes de la
// carpeta los compartan con la pagina.
export const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  confirmed:        { bg: '#d4f5e9', border: '#5DCAA5', text: '#0F6E56', label: 'Confirmado'      },
  pending:          { bg: '#fef3c7', border: '#FAC775', text: '#92400e', label: 'Pendiente'        },
  declined:         { bg: '#fee2e2', border: '#F09595', text: '#991b1b', label: 'Declinado'        },
  mensaje_enviado:  { bg: '#dbeafe', border: '#85B7EB', text: '#1e40af', label: 'Msg. enviado'     },
  respondio:        { bg: '#ffedd5', border: '#f0c090', text: '#9a3412', label: 'Respondió'        },
  accion_necesaria: { bg: '#fee2e2', border: '#F09595', text: '#991b1b', label: 'Acción necesaria' },
}

export const estatusDe = (rsvp: string) => STATUS_COLORS[rsvp] || STATUS_COLORS.pending
