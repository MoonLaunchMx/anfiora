'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CURRENT_LEGAL_VERSION, LEGAL_EFFECTIVE_DATE } from '@/lib/legal'

export default function PrivacidadPage() {
  const fechaActualizacion = LEGAL_EFFECTIVE_DATE

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Header */}
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      >
        <Link href="/">
          <Image
            src="/images/isotipoylogo.svg"
            alt="Anfiora"
            width={110}
            height={32}
            priority
          />
        </Link>
        <Link
          href="/"
          className="text-sm"
          style={{ color: 'var(--text-sec)' }}
        >
          Volver al inicio
        </Link>
      </header>

      {/* Contenido */}
      <main className="max-w-3xl mx-auto px-6 py-12">

        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          Aviso de Privacidad
        </h1>
        <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>
          Version {CURRENT_LEGAL_VERSION} · última actualización: {fechaActualizacion}
        </p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--text-sec)' }}>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              1. Responsable del tratamiento de datos
            </h2>
            <p>
              Diego Garza Rodríguez, con domicilio en Monterrey, Nuevo León, México, es el responsable
              del tratamiento de sus datos personales recabados a través de la plataforma Anfiora,
              disponible en <strong>www.anfiora.com</strong>.
            </p>
            <p className="mt-2">
              Para cualquier asunto relacionado con el tratamiento de sus datos personales, puede
              contactarnos en: <strong>privacidad@anfiora.com</strong>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              2. Datos personales que recabamos
            </h2>
            <p className="mb-2">Recabamos las siguientes categorías de datos personales:</p>
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>De los planners (usuarios registrados):</p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>Nombre completo</li>
              <li>Dirección de correo electrónico</li>
              <li>Número de teléfono</li>
              <li>Información de uso y actividad dentro de la plataforma</li>
              <li>Dirección IP y datos de geolocalización aproximada (ciudad, país)</li>
            </ul>
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>De los invitados a eventos (datos ingresados por el planner):</p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>Nombre</li>
              <li>Número de teléfono</li>
              <li>Correo electrónico</li>
              <li>Alergias y restricciones alimentarias</li>
              <li>Confirmación de asistencia (RSVP)</li>
              <li>Contenido de mensajes intercambiados por WhatsApp</li>
            </ul>
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>De los proveedores (datos ingresados por el planner):</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Nombre del proveedor o empresa</li>
              <li>Nombre del contacto</li>
              <li>Teléfono, correo electrónico, sitio web y redes sociales</li>
              <li>Ciudad, estado y país</li>
              <li>Información comercial (cotizaciones, contratos, pagos)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              3. Finalidades del tratamiento
            </h2>
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Finalidades primarias (necesarias para el servicio):</p>
            <ul className="list-disc list-inside space-y-1 mb-4">
              <li>Crear y administrar su cuenta de planner en Anfiora</li>
              <li>Gestionar listas de invitados y confirmaciones de asistencia</li>
              <li>Enviar y recibir mensajes de WhatsApp a nombre del planner</li>
              <li>Interpretar respuestas de invitados mediante inteligencia artificial para actualizar el estatus de RSVP</li>
              <li>Gestionar presupuestos, proveedores y pagos del evento</li>
              <li>Generar reportes, exportaciones y funciones de la plataforma</li>
            </ul>
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Finalidades secundarias (puede oponerse a estas):</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Envío de comunicaciones sobre nuevas funciones, actualizaciones y ofertas de Anfiora</li>
              <li>
                Uso de datos de proveedores, de forma agregada y con su consentimiento explícito,
                para construir un directorio de proveedores dentro de la plataforma disponible para
                otros planners
              </li>
              <li>Análisis estadístico de uso para mejorar la plataforma</li>
            </ul>
            <p className="mt-3">
              Si desea que sus datos no sean tratados para las finalidades secundarias, puede
              manifestarlo enviando un correo a <strong>privacidad@anfiora.com</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              4. Transferencia de datos a terceros
            </h2>
            <p className="mb-3">
              Para operar la plataforma, sus datos son procesados por los siguientes proveedores
              de tecnología, con quienes mantenemos acuerdos de confidencialidad y protección de datos:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text)' }}>Proveedor</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text)' }}>Finalidad</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text)' }}>País</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Supabase', 'Base de datos y autenticación', 'EUA (Oregon)'],
                    ['Vercel', 'Hospedaje de la aplicación', 'EUA'],
                    ['Twilio', 'Envío y recepción de mensajes WhatsApp', 'EUA'],
                    ['Anthropic', 'Interpretación de mensajes con IA (Claude)', 'EUA'],
                    ['PostHog', 'Analítica de uso de la plataforma', 'EUA'],
                    ['Spotify', 'Búsqueda de canciones para playlist del evento', 'EUA'],
                  ].map(([proveedor, finalidad, pais], i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td className="py-2 px-3 font-medium" style={{ color: 'var(--text)' }}>{proveedor}</td>
                      <td className="py-2 px-3">{finalidad}</td>
                      <td className="py-2 px-3">{pais}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              Todos los proveedores anteriores están ubicados en los Estados Unidos de América.
              Esta transferencia internacional se realiza bajo las excepciones previstas en el
              artículo 37 de la LFPDPPP, dado que dichos proveedores cuentan con niveles de
              protección adecuados o equivalentes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              5. Tratamiento automatizado de datos (Inteligencia Artificial)
            </h2>
            <p>
              Anfiora utiliza el modelo de inteligencia artificial Claude (Anthropic) para
              interpretar automáticamente los mensajes de WhatsApp que envían los invitados
              y determinar su intención de confirmar o declinar asistencia. Este procesamiento
              automatizado actualiza el estatus de RSVP del invitado en la plataforma.
            </p>
            <p className="mt-2">
              El planner tiene acceso completo al historial de mensajes y puede corregir
              manualmente cualquier estatus asignado de forma automática.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              6. Derechos ARCO
            </h2>
            <p className="mb-3">
              Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento
              de sus datos personales. Para ejercer cualquiera de estos derechos, envíe una
              solicitud a <strong>privacidad@anfiora.com</strong> indicando:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Nombre completo y correo electrónico de su cuenta</li>
              <li>El derecho que desea ejercer</li>
              <li>Descripción clara del dato o tratamiento al que se refiere</li>
            </ul>
            <p className="mt-3">
              Responderemos su solicitud en un plazo máximo de 20 días hábiles conforme a lo
              establecido en la LFPDPPP.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              7. Cookies y tecnologías de rastreo
            </h2>
            <p>
              Anfiora utiliza cookies y tecnologías similares para el funcionamiento de la
              plataforma y para analizar el uso mediante PostHog. PostHog recopila datos como
              dirección IP, páginas visitadas, tiempo de sesión y geolocalización aproximada
              (ciudad y país).
            </p>
            <p className="mt-2">
              Puede deshabilitar las cookies desde la configuración de su navegador, aunque
              esto puede afectar el funcionamiento de algunas funciones de la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              8. Conservación de datos
            </h2>
            <p>
              Sus datos se conservan mientras su cuenta esté activa. Al cancelar su cuenta,
              sus datos serán eliminados en un plazo de 30 días naturales, salvo que la ley
              nos obligue a conservarlos por un período mayor.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              9. Cambios a este aviso
            </h2>
            <p>
              Podemos actualizar este Aviso de Privacidad en cualquier momento. Cuando lo
              hagamos, actualizaremos la fecha al inicio del documento y, en caso de cambios
              significativos, se lo notificaremos por correo electrónico.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              10. Autoridad competente
            </h2>
            <p>
              Si considera que su derecho a la protección de datos ha sido vulnerado, puede
              presentar una queja ante el Instituto Nacional de Transparencia, Acceso a la
              Información y Protección de Datos Personales (INAI) en{' '}
              <button
                onClick={() => window.open('https://www.inai.org.mx', '_blank', 'noopener,noreferrer')}
                className="underline"
                style={{ color: '#48C9B0' }}
              >
                www.inai.org.mx
              </button>
              .
            </p>
          </section>

        </div>

        {/* Footer de la página */}
        <div
          className="mt-16 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <span>© 2026 Anfiora. Todos los derechos reservados.</span>
          <div className="flex gap-4">
            <Link href="/privacidad" style={{ color: '#48C9B0' }}>Aviso de Privacidad</Link>
            <Link href="/terminos" style={{ color: 'var(--text-muted)' }}>Términos y Condiciones</Link>
          </div>
        </div>

      </main>
    </div>
  )
}