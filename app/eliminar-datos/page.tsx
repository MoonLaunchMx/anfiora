'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CURRENT_LEGAL_VERSION, LEGAL_EFFECTIVE_DATE } from '@/lib/legal'

export default function EliminarDatosPage() {
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
          Eliminación de datos
        </h1>
        <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>
          Version {CURRENT_LEGAL_VERSION} · última actualización: {fechaActualizacion}
        </p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--text-sec)' }}>

          <section>
            <p>
              Esta página explica cómo solicitar la eliminación de sus datos personales tratados
              por Anfiora, la plataforma de gestión de eventos disponible en{' '}
              <strong>www.anfiora.com</strong>. El responsable del tratamiento es Diego Garza
              Rodríguez, con domicilio en Monterrey, Nuevo León, México.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              1. A quién aplica
            </h2>
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Planners (usuarios registrados):</p>
            <p className="mb-3">
              Titulares de una cuenta en Anfiora que administran eventos, listas de invitados,
              presupuestos y proveedores.
            </p>
            <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Invitados y contactos:</p>
            <p>
              Personas cuyos datos fueron ingresados por un planner (nombre, teléfono, correo,
              confirmación de asistencia) o que intercambiaron mensajes de WhatsApp gestionados a
              través de la plataforma. Si usted es invitado y no tiene cuenta, también puede
              solicitar la eliminación de sus datos por los medios descritos abajo.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              2. Qué datos se eliminan
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Datos de la cuenta del planner (nombre, correo, teléfono)</li>
              <li>Datos de invitados (nombre, teléfono, correo, alergias, RSVP)</li>
              <li>Contenido de mensajes intercambiados por WhatsApp</li>
              <li>Datos de proveedores, presupuestos y pagos asociados a sus eventos</li>
              <li>Datos de uso y analítica vinculados a su cuenta</li>
            </ul>
            <p className="mt-3">
              La eliminación es permanente. Salvo que la ley nos obligue a conservar cierta
              información por un período mayor, los datos no podrán recuperarse una vez eliminados.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              3. Cómo solicitar la eliminación
            </h2>
            <p className="mb-3">
              Envíe una solicitud por correo electrónico a{' '}
              <strong>privacidad@anfiora.com</strong> con el asunto{' '}
              <strong>&ldquo;Eliminación de datos&rdquo;</strong> e incluya:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>Nombre completo</li>
              <li>Correo electrónico o número de teléfono asociado a sus datos</li>
              <li>Descripción de los datos que desea eliminar (o indicar que desea eliminar todo)</li>
            </ul>
            <p>
              Si usted es invitado a un evento, también puede pedir directamente al planner
              organizador que elimine sus datos de la lista del evento.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              4. Plazo de respuesta
            </h2>
            <p>
              Confirmaremos la recepción de su solicitud y eliminaremos sus datos en un plazo
              máximo de <strong>30 días naturales</strong>. Las solicitudes de derechos ARCO
              (Acceso, Rectificación, Cancelación y Oposición) se atienden en un máximo de{' '}
              <strong>20 días hábiles</strong> conforme a la Ley Federal de Protección de Datos
              Personales en Posesión de los Particulares (LFPDPPP).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>
              5. Más información
            </h2>
            <p>
              El detalle completo sobre cómo tratamos, conservamos y transferimos sus datos está
              disponible en nuestro{' '}
              <Link href="/privacidad" className="underline" style={{ color: '#48C9B0' }}>
                Aviso de Privacidad
              </Link>
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
