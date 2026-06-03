export type MessageTemplate = { name: string; body: string }

// Plantillas recomendadas por tipo de evento. El copy usa las variables
// declaradas en configuracion (BASE_VARIABLES + EXTRA_VARIABLES) y se sustituyen
// al enviar en buildWaText (app/events/[id]/page.tsx).

function bodaPack(): MessageTemplate[] {
  return [
    { name: 'Save the date', body: 'Hola {nombre}! 💍 {novia} y {novio} se casan y quieren que seas de los primeros en saberlo. Aparta la fecha: {fecha}. Pronto te llega la invitacion. Un abrazo, {planner}' },
    { name: 'Recordatorio save the date', body: 'Hola {nombre}! 📅 Recuerda apartar el {fecha} para la boda de {novia} y {novio} en {venue}. Muy pronto la invitacion formal.' },
    { name: 'Invitacion', body: 'Hola {nombre}! ✨ Con mucha ilusion {novia} y {novio} te invitan a su boda el {fecha} a las {hora} en {venue}. Confirma tu asistencia por aqui, porfa 🙏' },
    { name: 'Recordatorio RSVP', body: 'Hola {nombre}! Ya casi es la boda de {novia} y {novio} ({fecha}). Si aun no confirmas tu asistencia, ayudanos respondiendo este mensaje 🙌' },
    { name: 'Invitacion playlist', body: 'Hola {nombre}! 🎶 Ayudanos a armar la playlist de la boda. Sugiere tus canciones aqui: {playlist}. Que no falte tu rola!' },
    { name: 'Invitacion fotos', body: 'Hola {nombre}! 📸 Comparte y revive las fotos de la boda en el album: {album}' },
    { name: 'Ubicacion y logistica', body: 'Hola {nombre}! 📍 Te esperamos en la boda de {novia} y {novio}. {venue}, {direccion}. Inicio {hora}. Cualquier duda, por aqui estamos 😊' },
    { name: 'Agradecimiento', body: 'Hola {nombre}! 🤍 {novia} y {novio} te agradecen por estar en su boda. Fue un dia inolvidable gracias a ti.' },
  ]
}

function socialPack(celebrant: string, emoji: string): MessageTemplate[] {
  return [
    { name: 'Save the date', body: `Hola {nombre}! ${emoji} Se viene algo especial. Aparta la fecha: {fecha} para celebrar a ${celebrant}. Pronto te llega la invitacion. Un abrazo, {planner}` },
    { name: 'Recordatorio save the date', body: `Hola {nombre}! 📅 Recuerda apartar el {fecha} para celebrar a ${celebrant} en {venue}. Pronto la invitacion formal.` },
    { name: 'Invitacion', body: `Hola {nombre}! ${emoji} Te invitamos a celebrar a ${celebrant} el {fecha} a las {hora} en {venue}. Confirma tu asistencia por aqui, porfa 🙏` },
    { name: 'Recordatorio RSVP', body: `Hola {nombre}! Ya casi celebramos a ${celebrant} ({fecha}). Si aun no confirmas, ayudanos respondiendo este mensaje 🙌` },
    { name: 'Invitacion playlist', body: 'Hola {nombre}! 🎶 Ayudanos a armar la playlist. Sugiere tus canciones aqui: {playlist}' },
    { name: 'Invitacion fotos', body: 'Hola {nombre}! 📸 Comparte y revive las fotos en el album: {album}' },
    { name: 'Ubicacion y logistica', body: 'Hola {nombre}! 📍 Te esperamos en {venue}, {direccion}. Inicio {hora}. Cualquier duda, por aqui 😊' },
    { name: 'Agradecimiento', body: `Hola {nombre}! 🤍 Gracias por celebrar a ${celebrant} con nosotros. Fue inolvidable gracias a ti.` },
  ]
}

function corporatePack(): MessageTemplate[] {
  return [
    { name: 'Invitacion / Registro', body: 'Hola {nombre} 👋 Te invitamos a {evento} el {fecha} a las {hora} en {venue}. Confirma tu registro por aqui.' },
    { name: 'Recordatorio', body: 'Hola {nombre}, te recordamos {evento}: {fecha}, {hora} en {venue}. Te esperamos.' },
    { name: 'Confirmacion de asistencia', body: 'Hola {nombre}, nos confirmas tu asistencia a {evento}? Tu lugar es importante para nosotros 🙌' },
    { name: 'Agenda / Programa', body: 'Hola {nombre}, esta es la informacion de {evento}: {fecha}, {hora}, {venue}. Pronto te compartimos la agenda completa.' },
    { name: 'Ubicacion y acceso', body: 'Hola {nombre} 📍 {evento} sera en {venue}, {direccion}. Llega con tiempo para el registro.' },
    { name: 'Material y recursos', body: 'Hola {nombre}, aqui esta el material de {evento}: {album}' },
    { name: 'Agradecimiento', body: 'Hola {nombre}, gracias por participar en {evento}. Nos vemos en la proxima 🙌' },
  ]
}

function impactoPack(): MessageTemplate[] {
  return [
    { name: 'Convocatoria', body: 'Hola {nombre}! 🙌 Te invitamos a {evento} el {fecha} en {venue}. Suma tu presencia, te necesitamos.' },
    { name: 'Recordatorio', body: 'Hola {nombre}, recuerda {evento} el {fecha} en {venue}. Contamos contigo.' },
    { name: 'Confirmacion', body: 'Hola {nombre}, confirmanos tu participacion en {evento} por aqui, porfa 🙏' },
    { name: 'Que llevar y logistica', body: 'Hola {nombre} 🎒 Para {evento} nos vemos en {venue}, {direccion} a las {hora}. Pronto te decimos que llevar.' },
    { name: 'Programa y recursos', body: 'Hola {nombre}, aqui el material de {evento}: {album}' },
    { name: 'Invitacion playlist', body: 'Hola {nombre}! 🎶 Ayudanos con la playlist del evento: {playlist}' },
    { name: 'Agradecimiento', body: 'Hola {nombre}! 🤍 Gracias por ser parte de {evento}. Hicimos algo grande juntos.' },
  ]
}

const SOCIAL_CELEBRANT: Record<string, { celebrant: string; emoji: string }> = {
  xv:         { celebrant: '{festejada}', emoji: '👑' },
  cumpleanos: { celebrant: '{festejado}', emoji: '🎂' },
  graduacion: { celebrant: '{graduado}',  emoji: '🎓' },
  bautizo:    { celebrant: '{bautizado}', emoji: '🤍' },
  despedida:  { celebrant: '{festejado}', emoji: '🥂' },
  fiesta:     { celebrant: '{anfitrion}', emoji: '🎉' },
}

const CORPORATE_TYPES = new Set(['conferencia', 'capacitacion', 'teambuilding', 'lanzamiento', 'asamblea'])
const IMPACTO_TYPES = new Set(['retiro', 'congreso', 'campamento', 'caridad'])

export function getTemplatePack(eventType: string | null | undefined): MessageTemplate[] {
  if (!eventType) return socialPack('{evento}', '🎉')
  if (eventType === 'boda') return bodaPack()
  if (SOCIAL_CELEBRANT[eventType]) {
    const { celebrant, emoji } = SOCIAL_CELEBRANT[eventType]
    return socialPack(celebrant, emoji)
  }
  if (CORPORATE_TYPES.has(eventType)) return corporatePack()
  if (IMPACTO_TYPES.has(eventType)) return impactoPack()
  return socialPack('{evento}', '🎉')
}
