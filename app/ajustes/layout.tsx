import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'

export default function AjustesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#f8f5f0] font-sans text-[#1D1E20]">

      <header className="sticky top-0 z-10 border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link href="/dashboard" className="shrink-0">
            <Image src="/images/Logo-010526newest.svg" alt="Anfiora" width={110} height={45} priority className="h-8 w-auto object-contain" />
          </Link>
          <Link
            href="/perfil"
            className="flex items-center gap-1.5 text-xs text-[#888] transition hover:text-[#48C9B0]"
          >
            <ArrowLeft size={14} />
            Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  )
}
