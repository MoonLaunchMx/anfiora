'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CURRENT_LEGAL_VERSION, LEGAL_EFFECTIVE_DATE } from '@/lib/legal'

export default function TerminosPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      >
        <Link href="/">
          <Image src="/images/isotipoylogo.svg" alt="Anfiora" width={110} height={32} priority />
        </Link>
        <Link href="/" className="text-sm" style={{ color: 'var(--text-sec)' }}>
          Volver al inicio
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          Terminos y Condiciones
        </h1>
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          Version {CURRENT_LEGAL_VERSION} · vigente desde el {LEGAL_EFFECTIVE_DATE}
        </p>
        <div
          className="mb-10 rounded-lg px-3 py-2 text-xs"
          style={{ background: 'var(--accent-bg)', color: 'var(--text-sec)', border: '1px solid var(--border)' }}
        >
          Borrador pendiente de revision legal. No constituye asesoria juridica.
        </div>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--text-sec)' }}>
          <Sec n="1" t="Aceptacion de los terminos">
            Al crear una cuenta o usar Anfiora (la &quot;Plataforma&quot;), disponible en www.anfiora.com,
            usted acepta estos Terminos y Condiciones y nuestro Aviso de Privacidad. Si no esta de acuerdo,
            no utilice la Plataforma.
          </Sec>
          <Sec n="2" t="Descripcion del servicio">
            Anfiora es una plataforma para organizar eventos: gestion de listas de invitados, confirmaciones
            (RSVP) por WhatsApp, albumes colaborativos, playlists, asignacion de mesas, presupuestos,
            proveedores y tareas. El servicio se ofrece &quot;tal cual&quot; y puede cambiar con el tiempo.
          </Sec>
          <Sec n="3" t="Cuentas y registro">
            Usted es responsable de la veracidad de los datos de su cuenta, de mantener la confidencialidad
            de su contrasena y de toda actividad realizada bajo su cuenta. Debe ser mayor de edad para
            registrarse.
          </Sec>
          <Sec n="4" t="Uso aceptable">
            Usted se compromete a no usar la Plataforma para fines ilicitos, enviar spam o comunicaciones no
            autorizadas, vulnerar la seguridad del servicio, ni infringir derechos de terceros. Podemos
            suspender cuentas que incumplan estas reglas.
          </Sec>
          <Sec n="5" t="Datos de invitados y responsabilidad del organizador">
            Usted puede cargar datos personales de terceros (invitados), como nombre, telefono y correo.
            Usted declara que cuenta con la base legitima para tratar esos datos y para compartirlos con
            Anfiora con el fin de prestar el servicio. Usted es el responsable del tratamiento de esos datos
            frente a sus invitados; Anfiora actua como encargado que los procesa por cuenta suya.
          </Sec>
          <Sec n="6" t="Comunicaciones por WhatsApp">
            Las funciones de mensajeria se prestan a traves de terceros (Twilio). Usted es responsable de
            obtener el consentimiento de los destinatarios y de cumplir las politicas de WhatsApp y la
            normativa aplicable en materia de comunicaciones.
          </Sec>
          <Sec n="7" t="Planes y pagos">
            Algunos planes son de pago. Los precios, ciclos de cobro y caracteristicas pueden cambiar con
            aviso razonable. Salvo que la ley exija lo contrario, los pagos no son reembolsables.
          </Sec>
          <Sec n="8" t="Propiedad intelectual">
            La Plataforma, su marca, diseno y software son propiedad de Anfiora. El contenido que usted carga
            sigue siendo suyo; usted nos otorga una licencia limitada para alojarlo y procesarlo con el unico
            fin de prestar el servicio.
          </Sec>
          <Sec n="9" t="Limitacion de responsabilidad">
            La Plataforma se ofrece sin garantias de disponibilidad ininterrumpida o ausencia de errores. En
            la maxima medida permitida por la ley, Anfiora no sera responsable por danos indirectos,
            incidentales o consecuentes, ni por perdida de datos derivada del uso o imposibilidad de uso del
            servicio. Nuestra responsabilidad total se limita al monto pagado por usted en los ultimos 12 meses.
          </Sec>
          <Sec n="10" t="Indemnizacion">
            Usted se compromete a mantener indemne a Anfiora frente a reclamaciones de terceros derivadas del
            uso indebido de la Plataforma o del incumplimiento de estos Terminos, incluyendo el tratamiento de
            datos de invitados sin base legitima.
          </Sec>
          <Sec n="11" t="Terminacion">
            Usted puede cerrar su cuenta cuando quiera. Podemos suspender o terminar el acceso ante
            incumplimientos. Tras la terminacion, podremos eliminar sus datos conforme al Aviso de Privacidad.
          </Sec>
          <Sec n="12" t="Modificaciones">
            Podemos actualizar estos Terminos. Cuando lo hagamos, publicaremos la nueva version y le pediremos
            aceptarla para seguir usando la Plataforma. El uso continuado implica aceptacion.
          </Sec>
          <Sec n="13" t="Ley aplicable y jurisdiccion">
            Estos Terminos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se
            resolvera ante los tribunales competentes de Monterrey, Nuevo Leon, salvo disposicion legal en
            contrario.
          </Sec>
          <Sec n="14" t="Contacto">
            Para cualquier asunto relacionado con estos Terminos, escribanos a legal@anfiora.com.
          </Sec>
        </div>
      </main>
    </div>
  )
}

function Sec({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>{n}. {t}</h2>
      <p>{children}</p>
    </section>
  )
}
