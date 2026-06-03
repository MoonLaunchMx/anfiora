export type MessageTemplate = { name: string; body: string }

// Plantillas recomendadas por tipo de evento. El copy usa las variables
// declaradas en configuracion (BASE_VARIABLES + EXTRA_VARIABLES) y se sustituyen
// al enviar en buildWaText (app/events/[id]/page.tsx). Los saltos de linea (\n\n)
// se respetan al mandar por WhatsApp.

function bodaPack(): MessageTemplate[] {
  return [
    { name: 'Save the date', body: 'Hola {nombre}! 💍\n\n{novia} y {novio} se casan y quieren que seas de los primeros en saberlo. Aparta la fecha: {fecha}.\n\nPronto te llega la invitacion con todos los detalles. Un abrazo, {planner}' },
    { name: 'Recordatorio save the date', body: 'Hola {nombre}! 📅\n\nTe recordamos apartar el {fecha} para la boda de {novia} y {novio} en {venue}.\n\nMuy pronto te compartimos la invitacion formal.' },
    { name: 'Invitacion', body: 'Hola {nombre}! ✨\n\nCon mucha ilusion {novia} y {novio} te invitan a su boda el {fecha} a las {hora} en {venue}.\n\nConfirma tu asistencia por aqui, porfa 🙏' },
    { name: 'Recordatorio RSVP', body: 'Hola {nombre}! 🙌\n\nYa casi es la boda de {novia} y {novio} ({fecha}). Si aun no confirmas tu asistencia, ayudanos respondiendo este mensaje.\n\nGracias!' },
    { name: 'Invitacion playlist', body: 'Hola {nombre}! 🎶\n\nAyudanos a armar la playlist de la boda. Sugiere tus canciones aqui:\n{playlist}\n\nQue no falte tu rola!' },
    { name: 'Invitacion fotos', body: 'Hola {nombre}! 📸\n\nComparte y revive las fotos de la boda en el album colaborativo:\n{album}' },
    { name: 'Ubicacion y logistica', body: 'Hola {nombre}! 📍\n\nTe esperamos en la boda de {novia} y {novio}.\n{venue}\n{direccion}\nInicio: {hora}\n\nCualquier duda, por aqui estamos 😊' },
    { name: 'Agradecimiento', body: 'Hola {nombre}! 🤍\n\n{novia} y {novio} te agradecen de corazon por estar en su boda. Fue un dia inolvidable gracias a ti.' },
  ]
}

function socialPack(celebrant: string, emoji: string): MessageTemplate[] {
  return [
    { name: 'Save the date', body: `Hola {nombre}! ${emoji}\n\nSe viene algo especial. Aparta la fecha: {fecha} para celebrar a ${celebrant}.\n\nPronto te llega la invitacion. Un abrazo, {planner}` },
    { name: 'Recordatorio save the date', body: `Hola {nombre}! 📅\n\nTe recordamos apartar el {fecha} para celebrar a ${celebrant} en {venue}.\n\nPronto te compartimos la invitacion formal.` },
    { name: 'Invitacion', body: `Hola {nombre}! ${emoji}\n\nTe invitamos a celebrar a ${celebrant} el {fecha} a las {hora} en {venue}.\n\nConfirma tu asistencia por aqui, porfa 🙏` },
    { name: 'Recordatorio RSVP', body: `Hola {nombre}! 🙌\n\nYa casi celebramos a ${celebrant} ({fecha}). Si aun no confirmas, ayudanos respondiendo este mensaje.\n\nGracias!` },
    { name: 'Invitacion playlist', body: 'Hola {nombre}! 🎶\n\nAyudanos a armar la playlist. Sugiere tus canciones aqui:\n{playlist}' },
    { name: 'Invitacion fotos', body: 'Hola {nombre}! 📸\n\nComparte y revive las fotos en el album colaborativo:\n{album}' },
    { name: 'Ubicacion y logistica', body: 'Hola {nombre}! 📍\n\nTe esperamos en {venue}.\n{direccion}\nInicio: {hora}\n\nCualquier duda, por aqui 😊' },
    { name: 'Agradecimiento', body: `Hola {nombre}! 🤍\n\nGracias por celebrar a ${celebrant} con nosotros. Fue inolvidable gracias a ti.` },
  ]
}

function corporatePack(): MessageTemplate[] {
  return [
    { name: 'Invitacion / Registro', body: 'Hola {nombre} 👋\n\nTe invitamos a {evento} el {fecha} a las {hora} en {venue}.\n\nConfirma tu registro por aqui.' },
    { name: 'Recordatorio', body: 'Hola {nombre},\n\nTe recordamos {evento}: {fecha}, {hora} en {venue}.\n\nTe esperamos.' },
    { name: 'Confirmacion de asistencia', body: 'Hola {nombre},\n\nNos confirmas tu asistencia a {evento}? Tu lugar es importante para nosotros 🙌' },
    { name: 'Agenda / Programa', body: 'Hola {nombre},\n\nEsta es la informacion de {evento}:\n{fecha} · {hora}\n{venue}\n\nPronto te compartimos la agenda completa.' },
    { name: 'Ubicacion y acceso', body: 'Hola {nombre} 📍\n\n{evento} sera en {venue}.\n{direccion}\n\nLlega con tiempo para el registro.' },
    { name: 'Material y recursos', body: 'Hola {nombre},\n\nAqui esta el material de {evento}:\n{album}' },
    { name: 'Agradecimiento', body: 'Hola {nombre},\n\nGracias por participar en {evento}. Nos vemos en la proxima 🙌' },
  ]
}

function impactoPack(): MessageTemplate[] {
  return [
    { name: 'Convocatoria', body: 'Hola {nombre}! 🙌\n\nTe invitamos a {evento} el {fecha} en {venue}.\n\nSuma tu presencia, te necesitamos.' },
    { name: 'Recordatorio', body: 'Hola {nombre},\n\nTe recordamos {evento} el {fecha} en {venue}.\n\nContamos contigo.' },
    { name: 'Confirmacion', body: 'Hola {nombre},\n\nConfirmanos tu participacion en {evento} por aqui, porfa 🙏' },
    { name: 'Que llevar y logistica', body: 'Hola {nombre} 🎒\n\nPara {evento} nos vemos en {venue} a las {hora}.\n{direccion}\n\nPronto te decimos que llevar.' },
    { name: 'Programa y recursos', body: 'Hola {nombre},\n\nAqui el material de {evento}:\n{album}' },
    { name: 'Invitacion playlist', body: 'Hola {nombre}! 🎶\n\nAyudanos con la playlist del evento:\n{playlist}' },
    { name: 'Agradecimiento', body: 'Hola {nombre}! 🤍\n\nGracias por ser parte de {evento}. Hicimos algo grande juntos.' },
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
