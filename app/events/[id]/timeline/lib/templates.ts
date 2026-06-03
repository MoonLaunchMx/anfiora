import { TimelineCategory, TimelinePriority } from '@/lib/types'

export interface TaskTemplate {
  title: string
  category: TimelineCategory
  offsetDays: number
  priority: TimelinePriority | null
}

export interface TimelineTaskInsert {
  event_id: string
  title: string
  emoji: null
  category: TimelineCategory
  task_date: string
  task_time: null
  notes: null
  is_highlighted: boolean
  priority: TimelinePriority | null
  assigned_to_user_id: null
  assigned_to_name: null
  event_supplier_id: null
  reminder_date: null
}

const BODA: TaskTemplate[] = [
  { title: 'Definir presupuesto y estilo',                 category: 'tarea',        offsetDays: 365, priority: 'bloqueante' },
  { title: 'Armar lista de invitados (estimado)',          category: 'tarea',        offsetDays: 365, priority: 'bloqueante' },
  { title: 'Reservar venue / lugar',                       category: 'tarea',        offsetDays: 330, priority: 'bloqueante' },
  { title: 'Anticipo del venue',                           category: 'pago',         offsetDays: 330, priority: 'no_bloqueante' },
  { title: 'Contratar banquete / catering',                category: 'tarea',        offsetDays: 270, priority: 'bloqueante' },
  { title: 'Contratar fotógrafo y video',                  category: 'tarea',        offsetDays: 240, priority: 'no_bloqueante' },
  { title: 'Contratar música / DJ o banda',                category: 'tarea',        offsetDays: 240, priority: 'no_bloqueante' },
  { title: 'Enviar save the date',                         category: 'comunicacion', offsetDays: 210, priority: 'no_bloqueante' },
  { title: 'Elegir vestido de novia',                      category: 'tarea',        offsetDays: 210, priority: 'no_bloqueante' },
  { title: 'Definir decoración y flores',                  category: 'tarea',        offsetDays: 180, priority: 'no_bloqueante' },
  { title: 'Elegir traje del novio',                       category: 'tarea',        offsetDays: 150, priority: 'no_bloqueante' },
  { title: 'Pastel de bodas',                              category: 'tarea',        offsetDays: 120, priority: 'no_bloqueante' },
  { title: 'Enviar invitaciones',                          category: 'comunicacion', offsetDays:  90, priority: 'no_bloqueante' },
  { title: 'Prueba de hair & makeup',                      category: 'tarea',        offsetDays:  90, priority: 'no_bloqueante' },
  { title: 'Prueba de menú con el banquete',               category: 'reunion',      offsetDays:  60, priority: 'no_bloqueante' },
  { title: 'Acomodo de mesas (seating)',                   category: 'tarea',        offsetDays:  30, priority: 'no_bloqueante' },
  { title: 'Confirmar asistencia (RSVP)',                  category: 'comunicacion', offsetDays:  21, priority: 'no_bloqueante' },
  { title: 'Pagos finales a proveedores',                  category: 'pago',         offsetDays:  14, priority: 'bloqueante' },
  { title: 'Confirmar logística del día con proveedores',  category: 'reunion',      offsetDays:   7, priority: 'bloqueante' },
  { title: 'Detalles finales / kit de emergencia',         category: 'tarea',        offsetDays:   3, priority: 'no_bloqueante' },
]

const SOCIAL: TaskTemplate[] = [
  { title: 'Definir presupuesto',              category: 'tarea',        offsetDays: 180, priority: 'bloqueante' },
  { title: 'Armar lista de invitados',         category: 'tarea',        offsetDays: 180, priority: 'bloqueante' },
  { title: 'Reservar lugar',                   category: 'tarea',        offsetDays: 150, priority: 'bloqueante' },
  { title: 'Contratar comida / banquete',      category: 'tarea',        offsetDays: 120, priority: 'bloqueante' },
  { title: 'Contratar música / DJ',            category: 'tarea',        offsetDays:  90, priority: 'no_bloqueante' },
  { title: 'Decoración y temática',            category: 'tarea',        offsetDays:  75, priority: 'no_bloqueante' },
  { title: 'Enviar invitaciones',              category: 'comunicacion', offsetDays:  45, priority: 'no_bloqueante' },
  { title: 'Pastel y postres',                 category: 'tarea',        offsetDays:  30, priority: 'no_bloqueante' },
  { title: 'Confirmar asistencia (RSVP)',      category: 'comunicacion', offsetDays:  14, priority: 'no_bloqueante' },
  { title: 'Pagos finales a proveedores',      category: 'pago',         offsetDays:   7, priority: 'bloqueante' },
  { title: 'Confirmar logística del día',      category: 'reunion',      offsetDays:   3, priority: 'no_bloqueante' },
]

const CORPORATIVO: TaskTemplate[] = [
  { title: 'Definir objetivos y brief del evento',         category: 'tarea',        offsetDays: 120, priority: 'bloqueante' },
  { title: 'Definir presupuesto',                          category: 'tarea',        offsetDays: 120, priority: 'bloqueante' },
  { title: 'Reservar sede',                                category: 'tarea',        offsetDays: 105, priority: 'bloqueante' },
  { title: 'Contratar catering',                           category: 'tarea',        offsetDays:  90, priority: 'no_bloqueante' },
  { title: 'Contratar AV y producción',                    category: 'tarea',        offsetDays:  90, priority: 'bloqueante' },
  { title: 'Definir agenda y programa',                    category: 'tarea',        offsetDays:  75, priority: 'no_bloqueante' },
  { title: 'Confirmar ponentes / invitados clave',         category: 'comunicacion', offsetDays:  75, priority: 'bloqueante' },
  { title: 'Armar lista de asistentes',                    category: 'tarea',        offsetDays:  60, priority: 'no_bloqueante' },
  { title: 'Abrir registro / enviar invitaciones',         category: 'comunicacion', offsetDays:  45, priority: 'no_bloqueante' },
  { title: 'Material y branding (señalética, gafetes)',    category: 'entrega',      offsetDays:  30, priority: 'no_bloqueante' },
  { title: 'Confirmaciones y seguimiento',                 category: 'comunicacion', offsetDays:  14, priority: 'no_bloqueante' },
  { title: 'Pagos a proveedores',                          category: 'pago',         offsetDays:  10, priority: 'bloqueante' },
  { title: 'Ensayo y logística final',                     category: 'reunion',      offsetDays:   5, priority: 'bloqueante' },
]

export function getTemplate(eventType: string | null, eventCategory: string | null): TaskTemplate[] {
  if (eventType === 'boda') return BODA
  if (eventCategory === 'corporativo') return CORPORATIVO
  return SOCIAL
}

function toISODate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function buildTimelineTasks(
  eventId: string,
  eventType: string | null,
  eventCategory: string | null,
  eventDate: string,
  existingTitles: Set<string>,
): TimelineTaskInsert[] {
  const template = getTemplate(eventType, eventCategory)

  const [ey, em, ed] = eventDate.split('T')[0].split('-').map(Number)
  const eventDay = new Date(ey, em - 1, ed)

  const now = new Date()
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return template
    .filter(t => !existingTitles.has(t.title.toLowerCase()))
    .map(t => {
      const d = new Date(eventDay)
      d.setDate(d.getDate() - t.offsetDays)
      const finalDate = d < todayMid ? todayMid : d
      return {
        event_id:            eventId,
        title:               t.title,
        emoji:               null,
        category:            t.category,
        task_date:           toISODate(finalDate),
        task_time:           null,
        notes:               null,
        is_highlighted:      false,
        priority:            t.priority,
        assigned_to_user_id: null,
        assigned_to_name:    null,
        event_supplier_id:   null,
        reminder_date:       null,
      }
    })
}
