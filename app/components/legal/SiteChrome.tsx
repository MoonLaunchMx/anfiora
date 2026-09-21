import Image from 'next/image'
import Link from 'next/link'
import LegalLinks from '@/app/components/LegalLinks'

// El navbar y el pie de la landing viven dentro de app/page.tsx, que es un
// client component con el modal de auth y el cambio de idioma. Aqui se repiten
// con enlaces en vez de botones para que las paginas legales se vean como una
// pagina mas del sitio sin arrastrar ese estado. Si algun dia la landing saca
// su nav a un componente propio, estas dos piezas se borran.
//
// A diferencia de la landing, que topa en max-w-6xl, aqui van a ancho completo.

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[#f0ede8] bg-white">
      <div className="flex items-center justify-between px-5 py-3.5 lg:px-10">
        <Link href="/" className="shrink-0">
          <Image src="/images/isotipoylogo.svg" alt="Anfiora" width={110} height={32} priority className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/#features" className="hidden text-sm text-[#888] transition hover:text-[#1D1E20] md:block">
            Features
          </Link>
          <Link href="/#compare" className="hidden text-sm text-[#888] transition hover:text-[#1D1E20] md:block">
            Comparativa
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-[#48C9B0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
          >
            Empieza gratis
          </Link>
        </div>
      </div>
    </nav>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-white/10 bg-[#1D1E20] px-5 py-4 lg:px-10">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
        <Image
          src="/images/isotipoylogo.svg"
          alt="Anfiora"
          width={110}
          height={24}
          className="h-6 w-auto shrink-0 brightness-0 invert"
        />
        <LegalLinks tono="oscuro" contacto />
        <p className="shrink-0 whitespace-nowrap text-[10px] text-white/20">
          © 2026 Anfiora. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}
