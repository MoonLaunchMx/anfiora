import Link from 'next/link'
import Image from 'next/image'
import VolverRolodex from './VolverRolodex'

export default function RolodexLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#f8f5f0] font-sans text-[#1D1E20]">

      <header className="sticky top-0 z-10 border-b border-[#e8e8e8] bg-white">
        <div className="mx-auto flex h-14 w-full max-w-[90vw] items-center justify-between sm:h-16">
          <Link href="/dashboard" className="shrink-0">
            <Image src="/images/Logo-010526newest.svg" alt="Anfiora" width={110} height={45} priority className="h-8 w-auto object-contain" />
          </Link>
          <VolverRolodex />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[90vw] py-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
