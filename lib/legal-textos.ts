import { LEGAL_EMAIL, LEGAL_RESPONSABLE, LEGAL_DOMICILIO, LEGAL_JURISDICCION } from './legal'

// Los textos legales se escriben con **negritas** en vez de JSX para que el
// documento se lea de corrido en un solo archivo y se pueda diffear sin ruido.
export type TrozoInline = { negrita: boolean; texto: string }

export function formatearInline(texto: string): TrozoInline[] {
  const trozos: TrozoInline[] = []
  let resto = texto
  while (resto.length > 0) {
    const abre = resto.indexOf('**')
    if (abre === -1) break
    const cierra = resto.indexOf('**', abre + 2)
    if (cierra === -1) break
    if (abre > 0) trozos.push({ negrita: false, texto: resto.slice(0, abre) })
    trozos.push({ negrita: true, texto: resto.slice(abre + 2, cierra) })
    resto = resto.slice(cierra + 2)
  }
  if (resto.length > 0) trozos.push({ negrita: false, texto: resto })
  return trozos
}

export type BloqueLegal =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'tabla'; encabezados: [string, string, string]; filas: [string, string, string][] }

export type SeccionLegal = { id: string; titulo: string; bloques: BloqueLegal[] }

export type PasoLegal = { titulo: string; detalle: string }

export type DocumentoLegal = {
  clave: 'privacidad' | 'terminos' | 'eliminar'
  ruta: string
  pestana: string
  titulo: string
  entrada: string
  contactoTitulo: string
  pasos?: PasoLegal[]
  secciones: SeccionLegal[]
}

const E = `**${LEGAL_EMAIL}**`

const PRIVACIDAD: DocumentoLegal = {
  clave: 'privacidad',
  ruta: '/privacidad',
  pestana: 'Aviso de Privacidad',
  titulo: 'Aviso de Privacidad',
  entrada: 'Qué datos guarda Anfiora, para qué los usa, con quién los comparte y cómo pedir que los borremos.',
  contactoTitulo: '¿Dudas sobre tus datos?',
  secciones: [
    {
      id: 'responsable',
      titulo: 'Responsable del tratamiento',
      bloques: [
        { tipo: 'parrafo', texto: `${LEGAL_RESPONSABLE}, con domicilio para oír y recibir notificaciones en ${LEGAL_DOMICILIO}, es el responsable del tratamiento de los datos personales que se recaban a través de Anfiora, disponible en **www.anfiora.com**.` },
        { tipo: 'parrafo', texto: 'Cuando un organizador captura en Anfiora los datos de sus invitados, clientes o proveedores, el organizador es el responsable de esos datos frente a ellos, y Anfiora los trata por su cuenta, como encargado, para prestarle el servicio.' },
        { tipo: 'parrafo', texto: `Para cualquier asunto relacionado con sus datos personales, escríbanos a ${E}.` },
      ],
    },
    {
      id: 'datos',
      titulo: 'Datos personales que recabamos',
      bloques: [
        { tipo: 'subtitulo', texto: 'De los organizadores y los miembros de su equipo:' },
        { tipo: 'lista', items: [
          'Nombre, correo electrónico, teléfono y foto de perfil',
          'Rol, plan, workspace al que pertenecen y permisos',
          'Datos de sus eventos: nombre del organizador y de los anfitriones, fecha, lugar y dirección',
          'Cómo llegaron a Anfiora: campaña, sitio de origen y tipo de dispositivo',
          'Registro de actividad: quién creó, cambió o borró información en cada evento',
          'Aceptación de estos documentos: versión, fecha, dirección IP y navegador',
          'Preferencias de avisos y suscripciones a notificaciones del navegador',
        ] },
        { tipo: 'subtitulo', texto: 'De los clientes del evento:' },
        { tipo: 'lista', items: [
          'Correo electrónico y permisos que el organizador les da',
          'Opiniones sobre proveedores: calificación, cargos extra y comentarios',
        ] },
        { tipo: 'subtitulo', texto: 'De los invitados (capturados por el organizador o por el propio invitado):' },
        { tipo: 'lista', items: [
          'Nombre, teléfono y correo electrónico',
          'Acompañantes: nombre y teléfono',
          'Confirmación de asistencia, mesa asignada, registro de llegada y pagos de acceso que registre el organizador',
          'Alergias, restricciones alimentarias y notas',
          'Mensajes por WhatsApp o Telegram, incluidos el identificador y el nombre de usuario de Telegram',
          'Notas que el asistente de inteligencia artificial guarda de las conversaciones',
          'Regalos apartados: nombre, teléfono, monto y mensaje',
          'Canciones sugeridas para la playlist',
        ] },
        { tipo: 'subtitulo', texto: 'De los proveedores (capturados por el organizador):' },
        { tipo: 'lista', items: [
          'Nombre de la empresa y del contacto',
          'Teléfono, correo electrónico, sitio web y redes sociales',
          'Ciudad, estado y país',
          'Cotizaciones, contratos, pagos y comprobantes en archivo',
          'Opiniones y calificaciones',
        ] },
      ],
    },
    {
      id: 'sensibles',
      titulo: 'Datos sensibles y financieros',
      bloques: [
        { tipo: 'parrafo', texto: 'Algunos datos que se capturan en Anfiora requieren protección especial:' },
        { tipo: 'lista', items: [
          '**De salud:** alergias, restricciones alimentarias y condiciones que un invitado mencione (por ejemplo, embarazo, diabetes o discapacidad) para que el evento lo atienda.',
          '**Financieros:** datos bancarios que el organizador publica en la mesa de regalos (banco, titular, CLABE o número de tarjeta) y la dirección de envío.',
        ] },
        { tipo: 'parrafo', texto: 'Estos datos son opcionales: el evento funciona sin ellos. Los pedimos solo donde hacen falta, señalando en el mismo formulario para qué son, y se tratan únicamente para organizar el evento. No los usamos para ninguna finalidad secundaria ni los compartimos con nadie fuera de los proveedores de tecnología listados más abajo.' },
      ],
    },
    {
      id: 'finalidades',
      titulo: 'Finalidades del tratamiento',
      bloques: [
        { tipo: 'subtitulo', texto: 'Necesarias para prestar el servicio:' },
        { tipo: 'lista', items: [
          'Crear y administrar cuentas, workspaces y permisos',
          'Gestionar invitados, confirmaciones, mesas, mesa de regalos, playlist y registro de llegada',
          'Enviar y recibir mensajes por WhatsApp y Telegram a nombre del organizador',
          'Interpretar con inteligencia artificial los mensajes de los invitados',
          'Gestionar presupuestos, proveedores, pagos y sus archivos',
          'Enviar avisos y recordatorios del evento',
          'Detectar y corregir errores de la plataforma',
          'Llevar el registro de actividad y la prueba de aceptación de estos documentos',
        ] },
        { tipo: 'subtitulo', texto: 'Secundarias (puede negarse):' },
        { tipo: 'lista', items: [
          'Comunicaciones sobre nuevas funciones, actualizaciones y ofertas de Anfiora',
          'Medir cómo se usa la plataforma y de qué campañas llegan los usuarios',
          'Uso de datos de proveedores, de forma agregada y con su consentimiento, para un directorio disponible para otros organizadores',
        ] },
        { tipo: 'parrafo', texto: `Para negarse a las finalidades secundarias escriba a ${E}. Negarse no afecta el servicio.` },
      ],
    },
    {
      id: 'terceros',
      titulo: 'Con quién compartimos sus datos',
      bloques: [
        { tipo: 'parrafo', texto: 'Para operar Anfiora, estos proveedores de tecnología procesan sus datos por cuenta nuestra, con el único fin de prestar el servicio:' },
        { tipo: 'tabla', encabezados: ['Proveedor', 'Para qué', 'País'], filas: [
          ['Supabase', 'Base de datos, inicio de sesión, archivos y correos de acceso', 'EUA'],
          ['Vercel', 'Hospedaje de la aplicación', 'EUA'],
          ['Twilio', 'Mensajes de WhatsApp', 'EUA'],
          ['Telegram', 'Mensajes con invitados y soporte a organizadores', 'Emiratos Árabes Unidos'],
          ['Anthropic', 'Inteligencia artificial (Claude)', 'EUA'],
          ['Sentry', 'Monitoreo de errores', 'EUA'],
          ['PostHog', 'Analítica de uso', 'EUA'],
          ['Spotify', 'Búsqueda de canciones', 'Suecia'],
          ['Giphy', 'Búsqueda de GIFs', 'EUA'],
          ['Google, Apple y Mozilla', 'Entrega de notificaciones del navegador', 'EUA'],
        ] },
        { tipo: 'parrafo', texto: 'Algunas páginas cargan contenido de Google Fonts, YouTube, TikTok, Instagram, Spotify o Giphy cuando el organizador lo agrega, y las recomendaciones de la invitación muestran la vista previa del sitio que él enlaza. Esos servicios reciben su dirección IP y se rigen por sus propios avisos de privacidad.' },
        { tipo: 'parrafo', texto: 'Estas transferencias internacionales son necesarias para prestar el servicio y se realizan conforme a la LFPDPPP.' },
      ],
    },
    {
      id: 'ia',
      titulo: 'Inteligencia artificial',
      bloques: [
        { tipo: 'parrafo', texto: 'Anfiora usa Claude, de Anthropic, para leer los mensajes que los invitados envían por WhatsApp o Telegram. Con eso:' },
        { tipo: 'lista', items: [
          'Marca si el invitado asiste o no',
          'Registra los acompañantes, alergias y peticiones que mencione',
          'Redacta la respuesta al invitado',
          'Guarda notas breves de la conversación para responder mejor después',
        ] },
        { tipo: 'parrafo', texto: 'Para hacerlo, la inteligencia artificial recibe el mensaje, la conversación previa, el nombre del invitado y los datos del evento. No se toman decisiones automatizadas con efectos legales sobre usted: el organizador ve todo el historial y puede corregir cualquier dato que se haya cambiado automáticamente.' },
      ],
    },
    {
      id: 'arco',
      titulo: 'Derechos ARCO y revocación',
      bloques: [
        { tipo: 'parrafo', texto: `Usted puede Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales, así como revocar su consentimiento. Envíe su solicitud a ${E} indicando:` },
        { tipo: 'lista', items: [
          'Nombre completo y el correo o teléfono con el que fue registrado',
          'El derecho que desea ejercer',
          'El dato o tratamiento al que se refiere',
        ] },
        { tipo: 'parrafo', texto: 'Responderemos en un plazo máximo de 20 días hábiles. Si usted es invitado, también puede pedir directamente al organizador que corrija o elimine sus datos.' },
      ],
    },
    {
      id: 'cookies',
      titulo: 'Cookies y almacenamiento en el navegador',
      bloques: [
        { tipo: 'lista', items: [
          '**Sesión:** su sesión de Anfiora se guarda en el almacenamiento local del navegador.',
          '**Preferencias:** vistas, columnas y avisos que ya vio.',
          '**Analítica:** PostHog usa una cookie con un identificador anónimo y registra las páginas visitadas, su dirección IP y su dispositivo.',
          '**Errores:** Sentry graba algunas sesiones, con el texto y las imágenes ocultos, para reproducir fallas.',
        ] },
        { tipo: 'parrafo', texto: 'Puede borrar o bloquear estos datos desde la configuración de su navegador. Si borra la sesión, tendrá que volver a iniciar sesión.' },
      ],
    },
    {
      id: 'conservacion',
      titulo: 'Conservación de datos',
      bloques: [
        { tipo: 'parrafo', texto: 'Conservamos sus datos mientras su cuenta o el evento sigan activos.' },
        { tipo: 'parrafo', texto: 'Cuando se elimina una cuenta, borramos de inmediato el perfil, sus eventos y todo lo que cuelga de ellos (invitados, mensajes, proveedores, presupuestos y pagos), los archivos que se hayan subido y la cuenta de acceso. Si la solicitud nos llega por correo, la atendemos en un plazo máximo de 30 días naturales.' },
        { tipo: 'parrafo', texto: 'Solo conservamos, por el tiempo que la ley nos obligue, la información que debamos guardar para efectos fiscales o para acreditar el cumplimiento de estos documentos.' },
      ],
    },
    {
      id: 'cambios',
      titulo: 'Cambios a este aviso',
      bloques: [
        { tipo: 'parrafo', texto: 'Cuando actualicemos este aviso cambiaremos la fecha que aparece arriba. Si el cambio agrega finalidades o afecta sus derechos, se lo avisaremos al entrar a Anfiora y le pediremos aceptarlo de nuevo.' },
      ],
    },
    {
      id: 'autoridad',
      titulo: 'Autoridad competente',
      bloques: [
        { tipo: 'parrafo', texto: 'Si considera que su derecho a la protección de datos personales fue vulnerado, puede acudir a la Secretaría Anticorrupción y Buen Gobierno, autoridad en la materia conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares vigente desde 2025.' },
      ],
    },
  ],
}

const TERMINOS: DocumentoLegal = {
  clave: 'terminos',
  ruta: '/terminos',
  pestana: 'Términos',
  titulo: 'Términos y Condiciones',
  entrada: 'Las reglas para usar Anfiora: qué le toca a usted y qué nos toca a nosotros.',
  contactoTitulo: '¿Dudas sobre estos términos?',
  secciones: [
    { id: 'aceptacion', titulo: 'Aceptación de los términos', bloques: [
      { tipo: 'parrafo', texto: 'Al crear una cuenta o usar Anfiora (la "Plataforma"), disponible en www.anfiora.com, usted acepta estos Términos y Condiciones y nuestro Aviso de Privacidad. Si no está de acuerdo, no utilice la Plataforma.' },
    ] },
    { id: 'servicio', titulo: 'Descripción del servicio', bloques: [
      { tipo: 'parrafo', texto: 'Anfiora es una plataforma para organizar eventos: workspaces con equipo y clientes, listas de invitados, invitación digital, confirmaciones por WhatsApp y Telegram, mesa de regalos, playlists, asignación de mesas, registro de llegada, presupuestos, proveedores y tareas. El servicio se ofrece "tal cual" y puede cambiar con el tiempo.' },
    ] },
    { id: 'cuentas', titulo: 'Cuentas y registro', bloques: [
      { tipo: 'parrafo', texto: 'Usted es responsable de la veracidad de los datos de su cuenta, de mantener la confidencialidad de su contraseña y de toda actividad realizada bajo su cuenta. Si invita a miembros de su equipo o a clientes, usted responde por lo que hagan con los permisos que les otorga. Debe ser mayor de edad para registrarse.' },
    ] },
    { id: 'uso', titulo: 'Uso aceptable', bloques: [
      { tipo: 'parrafo', texto: 'Usted se compromete a no usar la Plataforma para fines ilícitos, enviar spam o comunicaciones no autorizadas, vulnerar la seguridad del servicio, ni infringir derechos de terceros. Podemos suspender cuentas que incumplan estas reglas.' },
    ] },
    { id: 'datos-invitados', titulo: 'Datos de invitados y responsabilidad del organizador', bloques: [
      { tipo: 'parrafo', texto: 'Usted puede cargar datos personales de terceros, como nombre, teléfono, correo, alergias o datos bancarios para la mesa de regalos. Usted declara que cuenta con la base legítima y, cuando se trate de datos sensibles o financieros, con el consentimiento expreso de sus titulares para tratarlos y compartirlos con Anfiora con el fin de prestar el servicio. Usted es el responsable del tratamiento de esos datos frente a sus invitados; Anfiora actúa como encargado que los procesa por cuenta suya.' },
    ] },
    { id: 'mensajeria', titulo: 'Mensajes por WhatsApp, Telegram e inteligencia artificial', bloques: [
      { tipo: 'parrafo', texto: 'Las funciones de mensajería se prestan a través de terceros (Twilio y Telegram). Usted es responsable de obtener el consentimiento de los destinatarios y de cumplir las políticas de cada servicio y la normativa aplicable. Las respuestas y los datos que la inteligencia artificial registra pueden contener errores; usted debe revisarlos y corregirlos.' },
    ] },
    { id: 'mesa-regalos', titulo: 'Mesa de regalos y pagos entre usuarios', bloques: [
      { tipo: 'parrafo', texto: 'Anfiora no procesa pagos entre invitados y organizadores. Los datos bancarios que publica el organizador, las transferencias que realizan los invitados y los cobros de acceso que registra el organizador son responsabilidad exclusiva de ellos.' },
    ] },
    { id: 'planes', titulo: 'Planes y pagos', bloques: [
      { tipo: 'parrafo', texto: 'Algunos planes son de pago. Los precios, ciclos de cobro y características pueden cambiar con aviso razonable. Salvo que la ley exija lo contrario, los pagos no son reembolsables.' },
    ] },
    { id: 'propiedad', titulo: 'Propiedad intelectual', bloques: [
      { tipo: 'parrafo', texto: 'La Plataforma, su marca, diseño y software son propiedad de Anfiora. El contenido que usted carga sigue siendo suyo; usted nos otorga una licencia limitada para alojarlo y procesarlo con el único fin de prestar el servicio.' },
    ] },
    { id: 'terceros', titulo: 'Contenido de terceros', bloques: [
      { tipo: 'parrafo', texto: 'La Plataforma puede mostrar videos, GIFs, canciones o enlaces a tiendas de terceros que usted agrega. Ese contenido se rige por los términos de cada servicio y Anfiora no responde por su disponibilidad.' },
    ] },
    { id: 'responsabilidad', titulo: 'Limitación de responsabilidad', bloques: [
      { tipo: 'parrafo', texto: 'La Plataforma se ofrece sin garantías de disponibilidad ininterrumpida o ausencia de errores. En la máxima medida permitida por la ley, Anfiora no será responsable por daños indirectos, incidentales o consecuentes, ni por pérdida de datos derivada del uso o imposibilidad de uso del servicio. Nuestra responsabilidad total se limita al monto pagado por usted en los últimos 12 meses.' },
    ] },
    { id: 'indemnizacion', titulo: 'Indemnización', bloques: [
      { tipo: 'parrafo', texto: 'Usted se compromete a mantener indemne a Anfiora frente a reclamaciones de terceros derivadas del uso indebido de la Plataforma o del incumplimiento de estos Términos, incluyendo el tratamiento de datos de invitados sin base legítima.' },
    ] },
    { id: 'terminacion', titulo: 'Terminación', bloques: [
      { tipo: 'parrafo', texto: 'Usted puede cerrar su cuenta cuando quiera. Podemos suspender o terminar el acceso ante incumplimientos. Tras la terminación, podremos eliminar sus datos conforme al Aviso de Privacidad.' },
    ] },
    { id: 'modificaciones', titulo: 'Modificaciones', bloques: [
      { tipo: 'parrafo', texto: 'Podemos actualizar estos Términos. Cuando lo hagamos, publicaremos la nueva versión y le pediremos aceptarla para seguir usando la Plataforma.' },
    ] },
    { id: 'ley', titulo: 'Ley aplicable y jurisdicción', bloques: [
      { tipo: 'parrafo', texto: `Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se resolverá ante los tribunales competentes de ${LEGAL_JURISDICCION}, salvo disposición legal en contrario.` },
    ] },
    { id: 'contacto', titulo: 'Contacto', bloques: [
      { tipo: 'parrafo', texto: `Para cualquier asunto relacionado con estos Términos, escríbanos a ${E}.` },
    ] },
  ],
}

const ELIMINAR: DocumentoLegal = {
  clave: 'eliminar',
  ruta: '/eliminar-datos',
  pestana: 'Eliminar mis datos',
  titulo: 'Eliminar mis datos',
  entrada: 'Con un correo borramos lo que Anfiora tenga de usted, tenga cuenta o no.',
  contactoTitulo: '¿Listo para solicitarlo?',
  pasos: [
    { titulo: 'Escríbanos', detalle: `A ${LEGAL_EMAIL} con el asunto "Eliminación de datos".` },
    { titulo: 'Diga quién es', detalle: 'Su nombre y el correo o teléfono con el que lo registraron.' },
    { titulo: 'Lo borramos', detalle: 'Confirmamos que lo recibimos y borramos en máximo 30 días.' },
  ],
  secciones: [
    { id: 'aplica', titulo: 'A quién aplica', bloques: [
      { tipo: 'parrafo', texto: `Esta página explica cómo solicitar la eliminación de sus datos personales tratados por Anfiora. El responsable es ${LEGAL_RESPONSABLE}, con domicilio para oír y recibir notificaciones en ${LEGAL_DOMICILIO}.` },
      { tipo: 'subtitulo', texto: 'Organizadores, miembros de su equipo y clientes:' },
      { tipo: 'parrafo', texto: 'Personas con cuenta en Anfiora que administran o consultan eventos, invitados, presupuestos y proveedores.' },
      { tipo: 'subtitulo', texto: 'Invitados, proveedores y contactos:' },
      { tipo: 'parrafo', texto: 'Personas cuyos datos capturó un organizador, o que conversaron por WhatsApp o Telegram a través de la plataforma. No necesita tener cuenta para solicitar la eliminación.' },
    ] },
    { id: 'que-se-elimina', titulo: 'Qué datos se eliminan', bloques: [
      { tipo: 'lista', items: [
        'Datos de la cuenta: nombre, correo, teléfono y foto de perfil',
        'Datos de invitados: nombre, teléfono, correo, alergias y confirmación',
        'Conversaciones por WhatsApp y Telegram, y las notas del asistente de IA',
        'Proveedores, presupuestos, pagos y sus archivos (cotizaciones y comprobantes)',
        'Imágenes, audios y documentos que se hayan subido a sus eventos',
        'Registro de actividad y datos de uso vinculados a la cuenta',
      ] },
      { tipo: 'parrafo', texto: 'La eliminación es permanente. Salvo que la ley nos obligue a conservar cierta información, los datos no podrán recuperarse.' },
    ] },
    { id: 'como', titulo: 'Cómo solicitar la eliminación', bloques: [
      { tipo: 'parrafo', texto: `Envíe una solicitud a ${E} con el asunto **"Eliminación de datos"** e incluya:` },
      { tipo: 'lista', items: [
        'Nombre completo',
        'Correo electrónico o número de teléfono asociado a sus datos',
        'Los datos que desea eliminar, o indique que desea eliminar todo',
      ] },
      { tipo: 'parrafo', texto: 'Si usted es invitado, también puede pedir directamente al organizador que elimine sus datos de la lista del evento.' },
    ] },
    { id: 'plazo', titulo: 'Plazo de respuesta', bloques: [
      { tipo: 'parrafo', texto: 'Confirmaremos la recepción de su solicitud y eliminaremos sus datos en un plazo máximo de **30 días naturales**. Las solicitudes de derechos ARCO se atienden en un máximo de **20 días hábiles**, conforme a la LFPDPPP.' },
    ] },
    { id: 'mas', titulo: 'Más información', bloques: [
      { tipo: 'parrafo', texto: 'El detalle completo sobre cómo tratamos, conservamos y compartimos sus datos está en nuestro Aviso de Privacidad.' },
    ] },
  ],
}

export const DOCUMENTOS_LEGALES: DocumentoLegal[] = [PRIVACIDAD, TERMINOS, ELIMINAR]

export function documentoLegal(clave: DocumentoLegal['clave']): DocumentoLegal {
  const doc = DOCUMENTOS_LEGALES.find(d => d.clave === clave)
  if (!doc) throw new Error(`Documento legal desconocido: ${clave}`)
  return doc
}
