export type Lang = 'es' | 'en'

export const landingCopy = {
  es: {
    nav: {
      platform: 'Plataforma',
      planners: 'Para planners',
      login: 'Iniciar sesión',
      cta: 'Solicitar acceso',
    },
    hero: {
      eyebrow: 'La plataforma de los mejores organizadores del mundo',
      line1: 'No administras',
      line3a: 'Diriges ',
      line3em: 'momentos',
      rotating: ['eventos', 'bodas', 'galas', 'bautizos', 'cumpleaños', 'XV años', 'conferencias'],
      sub1: 'Todo en un solo lugar',
      sub2: ' y un agente de IA que te acompaña. No más apps sueltas.',
      cta1: 'Solicitar acceso',
      cta2: 'Ver el concepto',
      fine: 'Acceso por invitación · Para anfitriones y para planners profesionales',
      agentName: 'Agente Anfiora',
      channels: ['WhatsApp', 'Instagram', 'Messenger', 'Telegram'],
      replyLabel: 'respondiendo en',
      aiTag: 'respondido por IA · RSVP actualizado',
      scenarios: [
        {
          guest: 'Hola, ¿todavía hay lugar para 2?',
          ai: '¡Claro! Quedan lugares. Te confirmo a ti y a tu acompañante. ¿Algún detalle de alergias?',
        },
        {
          guest: 'Vi la invitación en tu historia, ¿cómo confirmo?',
          ai: '¡Qué gusto! Te aparto tu lugar ahora mismo. ¿Vienes acompañado?',
        },
        {
          guest: 'No voy a poder llegar a la cena.',
          ai: 'Gracias por avisar, lo marco como declinado. ¡Te mandamos las fotos!',
        },
        {
          guest: '¿A qué hora es la ceremonia?',
          ai: 'La ceremonia es a las 18:00 en el Jardín Norte. Te envío la ubicación.',
        },
      ],
    },
  },
  en: {
    nav: {
      platform: 'Platform',
      planners: 'For planners',
      login: 'Log in',
      cta: 'Request access',
    },
    hero: {
      eyebrow: 'The platform of the world’s best event organizers',
      line1: 'You don’t manage',
      line3a: 'You direct ',
      line3em: 'moments',
      rotating: ['events', 'weddings', 'galas', 'baptisms', 'birthdays', 'sweet 16s', 'conferences'],
      sub1: 'Everything in one place',
      sub2: ' and an AI agent that has your back. No more scattered apps.',
      cta1: 'Request access',
      cta2: 'See the concept',
      fine: 'By invitation only · For hosts and professional planners',
      agentName: 'Anfiora Agent',
      channels: ['WhatsApp', 'Instagram', 'Messenger', 'Telegram'],
      replyLabel: 'replying on',
      aiTag: 'answered by AI · RSVP updated',
      scenarios: [
        {
          guest: 'Hi, is there still room for 2?',
          ai: 'Of course! There are spots left. I’ll confirm you plus one. Any allergies I should note?',
        },
        {
          guest: 'I saw the invite in your story, how do I confirm?',
          ai: 'So glad! I’m saving your spot right now. Are you bringing a guest?',
        },
        {
          guest: 'I won’t be able to make it to dinner.',
          ai: 'Thanks for letting me know, I’ll mark it as declined. We’ll send you the photos!',
        },
        {
          guest: 'What time is the ceremony?',
          ai: 'The ceremony is at 6:00 PM in the North Garden. Sending you the location.',
        },
      ],
    },
  },
} as const
