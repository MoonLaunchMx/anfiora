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
          <Image src="/images/Logo SVG.svg" alt="Anfiora" width={110} height={32} priority />
        </Link>
        <Link href="/" className="text-sm" style={{ color: 'var(--text-sec)' }}>
          Volver al inicio
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          Términos y Condiciones
        </h1>
        <p className="text-sm mb-10" style={{ color: 'var(--text-muted)' }}>
          Versión {CURRENT_LEGAL_VERSION} · vigente desde el {LEGAL_EFFECTIVE_DATE}
        </p>

        <p className="mb-10 text-sm leading-relaxed" style={{ color: 'var(--text-sec)' }}>
          El presente contrato regula el acceso y uso de la plataforma de Software como Servicio (SaaS)
          Anfiora (la &quot;Plataforma&quot;), disponible en anfiora.com, cuyo titular es Diego Garza
          Rodríguez (el &quot;Licenciante&quot;), con domicilio en Ciudad de México. Al registrarse, realizar
          un pago o utilizar la Plataforma, el usuario (el &quot;Cliente&quot;) acepta de manera expresa estos
          Términos.
        </p>

        <div className="space-y-10 text-sm leading-relaxed" style={{ color: 'var(--text-sec)' }}>
          <Sec n="1" t="Aceptación de los términos">
            Al crear una cuenta o usar Anfiora, usted acepta estos Términos y nuestro{' '}
            <Link href="/privacidad" className="underline" style={{ color: '#48C9B0' }}>Aviso de Privacidad</Link>.
            Si no está de acuerdo, no utilice la Plataforma.
          </Sec>

          <Sec n="2" t="Objeto del servicio y licencia">
            El Licenciante otorga una licencia de uso no exclusiva, limitada e intransferible para usar
            Anfiora, cuyo fin es la creación, administración y gestión integral de eventos (listas de
            invitados, confirmaciones por WhatsApp, álbumes, playlists, mesas, presupuestos, proveedores y
            tareas). Anfiora es exclusivamente un proveedor de software; no interviene en la organización
            física, el boletaje ni la logística de los eventos. El servicio se ofrece &quot;tal cual&quot; y
            puede evolucionar con el tiempo.
          </Sec>

          <Sec n="3" t="Cuentas y registro">
            Usted es responsable de la veracidad de los datos de su cuenta, de la confidencialidad de su
            contraseña y de toda actividad realizada bajo su cuenta. Debe ser mayor de edad para registrarse.
          </Sec>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>4. Modelo de pago y vigencia</h2>
            <p className="mb-3">El Cliente se sujeta a las tarifas publicadas en anfiora.com, bajo dos modalidades:</p>
            <ul className="list-disc list-inside space-y-2 mb-3">
              <li>
                <strong style={{ color: 'var(--text)' }}>Suscripción (Planner):</strong> pago recurrente
                mensual o anual que da acceso a la Plataforma mientras la suscripción esté vigente. La falta
                de pago provoca la suspensión del servicio. Disponible una prueba inicial de 14 días sin tarjeta.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>Pago único (Anfitrión):</strong> un pago único por
                evento que habilita el evento contratado y eleva su límite de invitados según el plan elegido.
                Este pago otorga acceso a ese evento por un periodo de hasta 12 meses (un año) contados desde la fecha
                del pago; transcurrido el plazo, el Cliente deberá renovar bajo los planes vigentes. El pago
                único corresponde a un solo evento y no otorga derecho a eventos adicionales.
              </li>
            </ul>
            <p>
              Los precios se expresan en pesos mexicanos (MXN) e incluyen el IVA aplicable. Las
              características y precios pueden cambiar con aviso razonable.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text)' }}>5. Política de reembolsos</h2>
            <p className="mb-3">Anfiora ofrece reembolsos bajo las siguientes condiciones:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong style={{ color: 'var(--text)' }}>Suscripciones:</strong> la prueba de 14 días sin
                tarjeta le permite evaluar el servicio sin costo. Una vez cobrado, puede cancelar en cualquier
                momento para detener cobros futuros; el periodo en curso (mes o año) no se reembolsa, salvo
                que, en el plan anual, la solicitud se presente dentro de los primeros 14 días del cobro, en
                cuyo caso se reembolsa de forma proporcional.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>Pago único:</strong> reembolso completo si lo
                solicita dentro de 14 días del pago y siempre que (a) el evento aún no haya ocurrido y (b) no
                haya enviado invitaciones o mensajes masivos ni superado el 25% del límite de invitados de su
                plan. Cumplida cualquiera de esas condiciones, o vencido el plazo, no procede el reembolso.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>Excepción:</strong> fallas técnicas críticas e
                insubsanables imputables a Anfiora, evaluadas caso por caso.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>Frente a terceros:</strong> Anfiora no vende boletos
                ni cobra por asistente, y no reembolsa dinero a los invitados del Cliente por ningún concepto.
                Cualquier disputa económica se resuelve directamente entre el Cliente y sus invitados.
              </li>
            </ul>
            <p className="mt-3">
              Lo anterior se aplica sin perjuicio de los derechos irrenunciables que la legislación de
              protección al consumidor otorgue al Cliente.
            </p>
          </section>

          <Sec n="6" t="Carga de bases de datos de invitados">
            Cuando el Cliente importe o cargue listas de invitados (incluyendo archivos Excel/CSV o captura
            manual), declara y garantiza que obtuvo dichos datos de forma lícita y que cuenta con el
            consentimiento o la base legítima necesaria para tratarlos y compartirlos con Anfiora con el fin
            de operar su evento. El Cliente es el único Responsable de esos datos frente a sus titulares;
            Anfiora actúa como Encargado. El Cliente mantiene indemne a Anfiora frente a cualquier reclamación
            derivada de la carga de datos sin base legítima.
          </Sec>

          <Sec n="7" t="Datos personales y roles">
            El Cliente puede cargar datos personales de terceros (invitados y proveedores), incluyendo datos
            sensibles como alergias o restricciones alimentarias. El Cliente es el &quot;Responsable&quot; de
            esos datos y se obliga a contar con su propio aviso de privacidad y el consentimiento de sus
            titulares; Anfiora actúa como &quot;Encargado&quot;. El tratamiento se rige por nuestro{' '}
            <Link href="/privacidad" className="underline" style={{ color: '#48C9B0' }}>Aviso de Privacidad</Link>.
          </Sec>

          <Sec n="8" t="Comunicaciones por WhatsApp">
            La mensajería se presta a través de terceros (Twilio). El Cliente es responsable de obtener el
            consentimiento de los destinatarios y de cumplir las políticas de WhatsApp y la normativa
            aplicable en materia de comunicaciones.
          </Sec>

          <Sec n="9" t="Subprocesadores y transferencia internacional">
            Para operar, Anfiora se apoya en subprocesadores que pueden tratar datos fuera de México: Supabase
            (base de datos y autenticación, EUA), Vercel (hospedaje, EUA), Twilio (WhatsApp, EUA), Anthropic
            (IA para interpretar RSVP, EUA), PostHog (analítica técnica, EUA) y Spotify (búsqueda de música,
            EUA). Al usar la Plataforma, el Cliente reconoce y consiente estas transferencias, indispensables
            para prestar el servicio.
          </Sec>

          <Sec n="10" t="Facturación e impuestos">
            Los precios incluyen el IVA (16%) aplicable. El Cliente puede solicitar factura (CFDI)
            proporcionando sus datos fiscales a través de los canales que Anfiora habilite.
          </Sec>

          <Sec n="11" t="Propiedad intelectual">
            La Plataforma, su marca, diseño y software son propiedad del Licenciante. El contenido que el
            Cliente carga sigue siendo suyo; el Cliente otorga a Anfiora una licencia limitada para alojarlo y
            procesarlo con el único fin de prestar el servicio.
          </Sec>

          <Sec n="12" t="Uso aceptable">
            El Cliente se compromete a no usar la Plataforma para fines ilícitos, enviar spam o comunicaciones
            no autorizadas, vulnerar la seguridad del servicio ni infringir derechos de terceros. Anfiora
            puede suspender cuentas que incumplan estas reglas.
          </Sec>

          <Sec n="13" t="Exclusión de garantías y limitación de responsabilidad">
            La Plataforma se ofrece &quot;tal cual está&quot;, sin garantía de disponibilidad ininterrumpida o
            ausencia de errores, ni por interrupciones causadas por proveedores externos de infraestructura
            (p. ej. AWS, Google Cloud) o eventos de fuerza mayor. En la máxima medida permitida por la ley,
            Anfiora no será responsable por daños indirectos, incidentales o consecuentes, ni por pérdidas
            financieras, demandas de invitados o cancelaciones derivadas del éxito o fracaso del evento. La
            responsabilidad total de Anfiora se limita al monto pagado por el Cliente en los últimos 12 meses.
          </Sec>

          <Sec n="14" t="Indemnización">
            El Cliente mantendrá indemne a Anfiora frente a reclamaciones de terceros derivadas del uso
            indebido de la Plataforma o del incumplimiento de estos Términos, incluyendo el tratamiento de
            datos de invitados sin base legítima.
          </Sec>

          <Sec n="15" t="Terminación y suspensión">
            El Cliente puede cerrar su cuenta cuando quiera. Anfiora puede suspender o terminar el acceso ante
            incumplimientos o falta de pago. Tras la terminación, los datos se eliminan conforme al Aviso de
            Privacidad.
          </Sec>

          <Sec n="16" t="Modificaciones">
            Anfiora puede actualizar estos Términos. Cuando el cambio sea significativo, se publicará la nueva
            versión y se solicitará su aceptación para seguir usando la Plataforma. El uso continuado implica
            aceptación.
          </Sec>

          <Sec n="17" t="Cesión y divisibilidad">
            El Cliente no puede ceder estos Términos sin consentimiento de Anfiora. Si alguna cláusula se
            declara inválida, el resto permanece en vigor.
          </Sec>

          <Sec n="18" t="Ley aplicable y jurisdicción">
            Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Las partes se someten a los
            tribunales competentes de Ciudad de México, renunciando a cualquier otra jurisdicción.
          </Sec>

          <Sec n="19" t="Contacto">
            Para cualquier asunto relacionado con estos Términos, escríbanos a legal@anfiora.com.
          </Sec>
        </div>

        <div
          className="mt-16 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <span>© 2026 Anfiora. Todos los derechos reservados.</span>
          <div className="flex gap-4">
            <Link href="/privacidad" style={{ color: 'var(--text-muted)' }}>Aviso de Privacidad</Link>
            <Link href="/terminos" style={{ color: '#48C9B0' }}>Términos y Condiciones</Link>
          </div>
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
