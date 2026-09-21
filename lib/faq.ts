// Fuente unica de las preguntas frecuentes: la pagina /preguntas y el JSON-LD
// que lee Google salen de aqui. Cada respuesta esta verificada contra el codigo;
// si una feature cambia, la respuesta cambia con ella. Ver .claude/skills/copy-mx.

export type FaqItem = { q: string; a: string }

export type FaqContent = {
  eyebrow: string
  title: string
  sub: string
  ctaEyebrow: string
  ctaTitle: string
  ctaSub: string
  ctaBtn: string
  items: FaqItem[]
}

export const FAQ: Record<'es' | 'en', FaqContent> = {
  es: {
    eyebrow: 'Preguntas frecuentes',
    title: 'Lo que te preguntas antes de empezar',
    sub: 'Cómo funciona Anfiora para ti y para tus invitados.',
    ctaEyebrow: 'Empieza hoy',
    ctaTitle: '¿Ya resolviste tu duda?',
    ctaSub: 'Sin tarjeta de crédito. Listo en menos de 2 minutos.',
    ctaBtn: 'Crear mi primer evento gratis',
    items: [
      { q: '¿Qué es Anfiora?',
        a: 'Es el lugar donde organizas tu evento de principio a fin: tus invitados confirman desde su celular mientras tú llevas mesas, presupuesto y proveedores sin brincar entre Excel y WhatsApp.' },
      { q: '¿Para quién es?',
        a: 'Es para planners que llevan los eventos de sus clientes y para quien está armando su propia boda, sus XV o cualquier fiesta.' },
      { q: '¿Qué me ahorra?',
        a: 'Te ahorra perseguir confirmaciones, pasar teléfonos de Excel a WhatsApp y adivinar cuánto llevas gastado. Con Anfiora todo vive en un solo lugar y tus invitados te confirman solos.' },
      { q: '¿Sirve para cualquier tipo de evento?',
        a: 'Sí, hay 16 tipos listos: bodas, XV años, cumpleaños, conferencias, lanzamientos, retiros y más. Cada uno abre con las herramientas que de verdad necesita.' },
      { q: '¿Mis invitados tienen que descargar algo?',
        a: 'No, solo abren el link de su invitación y confirman desde el celular con todo y sus alergias. Tú ves cada respuesta en tu lista al momento.' },
      { q: '¿Puedo subir mi lista desde Excel?',
        a: 'Sí, subes tu hoja como CSV y Anfiora acomoda cada columna en su lugar. Si viene un teléfono repetido te avisa antes de guardar.' },
      { q: '¿Qué más puedo organizar ahí?',
        a: 'Mesas, presupuesto, proveedores con sus pagos, mesa de regalos, playlist colaborativa y el QR para tu álbum de fotos. Prendes nada más las herramientas que tu evento necesita.' },
      { q: '¿Puedo trabajar con mi equipo y mis clientes?',
        a: 'Sí, les mandas un link y decides qué ve y qué edita cada quien. Tu cliente solo entra al evento que le compartes.' },
      { q: '¿Funciona en el celular?',
        a: 'Sí, de principio a fin. Hasta lo puedes instalar en tu pantalla de inicio sin pasar por la tienda de apps.' },
      { q: '¿Puedo sacar mi información?',
        a: 'Cuando quieras: invitados, presupuesto, pagos y playlist salen en Excel o PDF.' },
      { q: '¿Necesito tarjeta de crédito para empezar?',
        a: 'No, creas tu cuenta con tu correo y en un par de minutos ya estás armando tu primer evento.' },
    ],
  },
  en: {
    eyebrow: 'Frequently asked questions',
    title: 'What you are wondering before you start',
    sub: 'How Anfiora works for you and for your guests.',
    ctaEyebrow: 'Start today',
    ctaTitle: 'Got your answer?',
    ctaSub: 'No credit card required. Ready in under 2 minutes.',
    ctaBtn: 'Create my first event free',
    items: [
      { q: 'What is Anfiora?',
        a: 'It is where you run your event from start to finish: your guests confirm from their phone while you handle seating, budget and suppliers without jumping between Excel and WhatsApp.' },
      { q: 'Who is it for?',
        a: 'It is for planners who run events for their clients and for anyone putting together their own wedding, quinceañera or party.' },
      { q: 'What does it save me?',
        a: 'It saves you chasing RSVPs, copying phone numbers from Excel into WhatsApp and guessing how much you have spent. With Anfiora everything lives in one place and your guests confirm on their own.' },
      { q: 'Does it work for any kind of event?',
        a: 'Yes, there are 16 event types ready to go: weddings, quinceañeras, birthdays, conferences, launches, retreats and more. Each one opens with the tools it actually needs.' },
      { q: 'Do my guests have to download anything?',
        a: 'No, they just open the link to their invitation and confirm from their phone, allergies included. You see every reply in your list right away.' },
      { q: 'Can I upload my list from Excel?',
        a: 'Yes, you upload your sheet as a CSV and Anfiora puts each column in its place. If a phone number shows up twice it warns you before saving.' },
      { q: 'What else can I organize there?',
        a: 'Seating, budget, suppliers and their payments, a gift registry, a collaborative playlist and the QR code for your photo album. You only turn on the tools your event needs.' },
      { q: 'Can I work with my team and my clients?',
        a: 'Yes, you send them a link and decide what each person can see and edit. Your client only gets into the event you share with them.' },
      { q: 'Does it work on my phone?',
        a: 'Yes, from start to finish. You can even install it on your home screen without going through the app store.' },
      { q: 'Can I export my information?',
        a: 'Anytime: guests, budget, payments and playlist export to Excel or PDF.' },
      { q: 'Do I need a credit card to start?',
        a: 'No, you create your account with your email and in a couple of minutes you are already setting up your first event.' },
    ],
  },
}
