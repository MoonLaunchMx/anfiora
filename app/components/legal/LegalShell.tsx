'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, Mail } from 'lucide-react'
import { CURRENT_LEGAL_VERSION, LEGAL_EFFECTIVE_DATE, LEGAL_EMAIL } from '@/lib/legal'
import { DOCUMENTOS_LEGALES, formatearInline, type BloqueLegal, type DocumentoLegal } from '@/lib/legal-textos'

function Inline({ texto }: { texto: string }) {
  return (
    <>
      {formatearInline(texto).map((t, i) =>
        t.negrita
          ? <strong key={i} className="font-semibold text-[var(--text)]">{t.texto}</strong>
          : <span key={i}>{t.texto}</span>
      )}
    </>
  )
}

function Bloque({ bloque }: { bloque: BloqueLegal }) {
  if (bloque.tipo === 'parrafo') {
    return <p className="mb-2.5 last:mb-0"><Inline texto={bloque.texto} /></p>
  }
  if (bloque.tipo === 'subtitulo') {
    return <p className="mt-4 mb-1.5 text-[13.5px] font-semibold text-[var(--text)] first:mt-0">{bloque.texto}</p>
  }
  if (bloque.tipo === 'lista') {
    return (
      <ul className="mb-2.5 list-disc pl-[18px] marker:text-[var(--text-dim)]">
        {bloque.items.map((item, i) => <li key={i} className="my-[3px] pl-0.5"><Inline texto={item} /></li>)}
      </ul>
    )
  }
  return (
    <div className="my-1 mb-3.5 overflow-x-auto rounded-[10px] border border-[var(--border)]">
      <table className="w-full min-w-[460px] border-collapse text-[13px]">
        <thead>
          <tr>
            {bloque.encabezados.map(h => (
              <th key={h} className="border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left font-semibold text-[var(--text)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloque.filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((celda, j) => (
                <td
                  key={j}
                  className={`border-b border-[var(--border)] px-3 py-2 align-top last:border-b-0 ${j === 0 ? 'font-medium text-[var(--text)]' : 'text-[var(--text-sec)]'}`}
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function LegalShell({ doc }: { doc: DocumentoLegal }) {
  const [activa, setActiva] = useState(doc.secciones[0]?.id ?? '')
  const [indiceAbierto, setIndiceAbierto] = useState(false)

  useEffect(() => {
    const observador = new IntersectionObserver(
      entradas => {
        const visible = entradas.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiva(visible.target.id)
      },
      { rootMargin: '-80px 0px -70% 0px' }
    )
    doc.secciones.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observador.observe(el)
    })
    return () => observador.disconnect()
  }, [doc])

  const meta = doc.clave === 'terminos'
    ? `Versión ${CURRENT_LEGAL_VERSION} · vigente desde el ${LEGAL_EFFECTIVE_DATE}`
    : `Versión ${CURRENT_LEGAL_VERSION} · última actualización: ${LEGAL_EFFECTIVE_DATE}`

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text)]">
      <header className="flex items-center gap-3.5 border-b border-[var(--border)] bg-[var(--bg)] px-4 py-3.5 sm:px-8 sm:py-4">
        <Link href="/">
          <Image src="/images/isotipoylogo.svg" alt="Anfiora" width={110} height={32} priority className="h-[22px] w-auto sm:h-[26px]" />
        </Link>
        <Link href="/" className="ml-auto text-[13px] text-[var(--text-sec)] hover:text-[var(--text)]">Volver al inicio</Link>
      </header>

      <div className="grid w-full grid-cols-1 gap-0 px-[18px] pt-[18px] lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14 lg:px-10 lg:pt-10 xl:px-16">
        <aside className="sticky top-7 hidden self-start lg:flex lg:flex-col lg:gap-[26px]">
          <div>
            <h2 className="mb-2 text-[11px] uppercase tracking-[0.09em] text-[var(--text-muted)]">Documentos</h2>
            <div className="flex flex-col gap-0.5">
              {DOCUMENTOS_LEGALES.map(d => (
                <Link
                  key={d.clave}
                  href={d.ruta}
                  aria-current={d.clave === doc.clave ? 'page' : undefined}
                  className={`rounded-lg border px-2.5 py-2 text-[13.5px] transition-colors ${
                    d.clave === doc.clave
                      ? 'border-[#48C9B0] bg-[#f0fdfb] font-semibold text-[var(--text)]'
                      : 'border-transparent text-[var(--text-sec)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                  }`}
                >
                  {d.pestana}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-[11px] uppercase tracking-[0.09em] text-[var(--text-muted)]">En esta página</h2>
            <nav className="flex flex-col">
              {doc.secciones.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`rounded-md px-2.5 py-[5px] text-[12.5px] leading-[1.35] transition-colors hover:text-[var(--text)] ${
                    activa === s.id ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {s.titulo}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0">
          <nav aria-label="Documentos legales" className="mb-[18px] flex gap-0.5 overflow-x-auto rounded-[10px] bg-[var(--surface-alt)] p-[3px] lg:hidden">
            {DOCUMENTOS_LEGALES.map(d => (
              <Link
                key={d.clave}
                href={d.ruta}
                aria-current={d.clave === doc.clave ? 'page' : undefined}
                className={`whitespace-nowrap rounded-[7px] px-3.5 py-[7px] text-[13px] ${
                  d.clave === doc.clave ? 'bg-white font-semibold text-[var(--text)] shadow-sm' : 'text-[var(--text-sec)]'
                }`}
              >
                {d.pestana}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-3 pb-4 lg:border-b lg:border-[var(--border)] lg:pb-7">
            <h1 className="text-pretty text-[30px] font-bold leading-[1.05] tracking-[-0.025em] lg:text-[38px]">{doc.titulo}</h1>
            <p className="text-pretty text-[15.5px] font-medium leading-[1.4] text-[var(--text-sec)] lg:text-[17px]">{doc.entrada}</p>
            <p className="text-[12.5px] tabular-nums text-[var(--text-muted)]">{meta}</p>
          </div>

          <details
            open={indiceAbierto}
            onToggle={e => setIndiceAbierto((e.currentTarget as HTMLDetailsElement).open)}
            className="border-y border-[var(--border)] lg:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-[13.5px] font-semibold [&::-webkit-details-marker]:hidden">
              <span>En esta página <span className="ml-1.5 font-normal text-[var(--text-muted)]">{doc.secciones.length}</span></span>
              <ChevronDown size={16} className={`text-[var(--text-muted)] transition-transform ${indiceAbierto ? 'rotate-180' : ''}`} />
            </summary>
            <ol className="mb-3 list-none p-0">
              {doc.secciones.map(s => (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={() => setIndiceAbierto(false)} className="block py-[7px] text-[13.5px] text-[var(--text-sec)]">
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          {doc.pasos && (
            <div className="mt-7 grid grid-cols-1 items-end gap-3.5 rounded-[14px] border border-[var(--border)] p-[18px] sm:gap-5 sm:p-6 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
              {doc.pasos.map((paso, i) => (
                <div key={paso.titulo} className="flex items-start gap-3 lg:flex-col lg:gap-1.5">
                  <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-[var(--surface-alt)] text-xs font-semibold">{i + 1}</span>
                  <div>
                    <div className="text-sm font-semibold">{paso.titulo}</div>
                    <div className="text-[13px] leading-[1.45] text-[var(--text-sec)]">{paso.detalle}</div>
                  </div>
                </div>
              ))}
              <a
                href={`mailto:${LEGAL_EMAIL}?subject=${encodeURIComponent('Eliminación de datos')}`}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#48C9B0] px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Mail size={16} />
                Escribir el correo
              </a>
            </div>
          )}

          <div className="text-sm leading-[1.7] text-[var(--text-sec)]">
            {doc.secciones.map(s => (
              <section key={s.id} id={s.id} className="scroll-mt-5 border-b border-[var(--border)] py-7 last:border-b-0">
                <h2 className="mb-3 text-pretty text-[17px] font-semibold tracking-[-0.01em] text-[var(--text)] lg:text-[19px]">{s.titulo}</h2>
                {s.bloques.map((b, i) => <Bloque key={i} bloque={b} />)}
              </section>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] py-[22px]">
            <div>
              <p className="text-[17px] font-semibold text-[var(--text)]">{doc.contactoTitulo}</p>
              <p className="mt-0.5 text-[13px] text-[var(--text-sec)]">Le respondemos por correo.</p>
            </div>
            <a
              href={`mailto:${LEGAL_EMAIL}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#48C9B0] px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
            >
              <Mail size={16} />
              {LEGAL_EMAIL}
            </a>
          </div>

          <footer className="flex flex-col-reverse items-start justify-between gap-x-6 gap-y-2.5 border-t border-[var(--border)] px-0 pb-8 pt-5 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center">
            <span>© 2026 Anfiora</span>
            <nav className="flex flex-wrap gap-x-[18px] gap-y-1.5">
              {DOCUMENTOS_LEGALES.map(d => (
                <Link key={d.clave} href={d.ruta} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">{d.pestana}</Link>
              ))}
              <a href={`mailto:${LEGAL_EMAIL}`} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Contacto</a>
            </nav>
          </footer>
        </main>
      </div>
    </div>
  )
}
