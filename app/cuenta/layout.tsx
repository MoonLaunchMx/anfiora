'use client'
import { Suspense, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Lock, Users } from 'lucide-react'
import { Cargando } from '@/app/components/ui/Cargando'
import { etiquetaPlan } from '@/lib/workspace/planes'
import { ROL_LABEL } from '@/lib/workspace/tipos'
import { WorkspaceProvider, useWorkspace } from './WorkspaceContext'

// Solo Equipo por ahora. Actividad y Plan y facturacion llegan en las tandas 4 y 5:
// agregar aqui un renglon y su carpeta, nada mas.
const PESTANAS = [
  { key: 'equipo', label: 'Equipo', href: '/cuenta/equipo', icon: Users },
]

function Cascara({ children }: { children: ReactNode }) {
  const { activo, workspaces, cargando, error } = useWorkspace()
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <header className="sticky top-0 z-10 border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <button onClick={() => router.push('/dashboard')} className="shrink-0">
            <Image src="/images/Logo-010526newest.svg" alt="Anfiora" width={110} height={45} priority className="h-8 w-auto object-contain" />
          </button>
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-1.5 text-xs text-[#888] transition hover:text-[#48C9B0]">
            <ArrowLeft size={14} /> Volver
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {cargando ? (
          <Cargando mensaje="Cargando tu workspace" />
        ) : !activo ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-[#e0e0e0] text-[#bbb]"><Lock size={18} /></span>
            <h2 className="text-[15px] font-semibold text-[#1D1E20]">No administras ningún workspace</h2>
            <p className="max-w-xs text-[13px] text-[#888]">{error ?? 'Esta sección es de dueños y administradores.'}</p>
            <Link href="/dashboard" className="mt-1 rounded-lg bg-[#48C9B0] px-4 py-2 text-[13px] font-semibold text-[#08312a]">Volver al inicio</Link>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <p className="text-xs text-[#888]">Mi workspace</p>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-[#1D1E20] sm:text-2xl">{activo.name}</h1>
                <span className="rounded-full border border-[#e0e0e0] px-2.5 py-0.5 text-[11px] font-semibold text-[#666]">{etiquetaPlan(activo.plan)}</span>
                <span className="text-[11px] text-[#aaa]">{ROL_LABEL[activo.miRol]}</span>
              </div>
              {workspaces.length > 1 && (
                <p className="mt-1 text-xs text-[#888]">
                  También administras:{' '}
                  {workspaces.filter(w => w.id !== activo.id).map((w, i) => (
                    <span key={w.id}>{i > 0 && ', '}<Link href={`${pathname}?ws=${w.id}`} className="text-[#1a9e88] underline">{w.name}</Link></span>
                  ))}
                </p>
              )}
            </div>
            <nav className="mb-5 flex gap-1 border-b border-[#e8e8e8]">
              {PESTANAS.map(p => {
                const on = pathname.startsWith(p.href)
                const Icon = p.icon
                return (
                  <Link key={p.key} href={p.href} className={'-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold ' + (on ? 'border-[#1D1E20] text-[#1D1E20]' : 'border-transparent text-[#999] hover:text-[#1D1E20]')}>
                    <Icon size={14} /> {p.label}
                  </Link>
                )
              })}
            </nav>
            {children}
          </>
        )}
      </main>
    </div>
  )
}

export default function CuentaLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Cargando mensaje="Cargando" pantallaCompleta />}>
      <WorkspaceProvider>
        <Cascara>{children}</Cascara>
      </WorkspaceProvider>
    </Suspense>
  )
}
