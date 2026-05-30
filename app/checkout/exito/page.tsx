import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { ANFITRION_PLANS, ORGANIZADOR_PLANS } from '@/lib/pricing'

export const metadata = {
  title: 'Pago confirmado — Anfiora',
  robots: { index: false, follow: false },
}

function planName(tipo?: string, plan?: string): string {
  const list = tipo === 'organizador' ? ORGANIZADOR_PLANS : ANFITRION_PLANS
  const found = list.find(p => p.id === plan)
  return found ? `Anfiora ${found.name}` : 'tu plan'
}

export default async function CheckoutExitoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; plan?: string }>
}) {
  const { tipo, plan } = await searchParams
  const name = planName(tipo, plan)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f8f8f8] px-5 text-center">
      <div className="w-full max-w-md rounded-2xl border border-[#e8e8e8] bg-white p-8 shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f0fff6]">
          <CheckCircle2 className="h-8 w-8 text-[#2a7a50]" />
        </div>
        <h1 className="text-xl font-bold text-[#0a0a0a]">Pago simulado con éxito</h1>
        <p className="mt-2 text-sm text-[#666]">
          Elegiste <strong className="text-[#0a0a0a]">{name}</strong>. En la versión real, aquí Stripe
          confirma el pago y activa tu plan automáticamente.
        </p>

        <div className="mt-5 rounded-lg border border-[#f0c98a] bg-[#fffbf0] px-4 py-3 text-[12.5px] text-[#8a6d1f]">
          Modo prueba: no se realizó ningún cargo y no se modificó tu cuenta.
        </div>

        <Link
          href="/dashboard"
          className="mt-6 block rounded-lg bg-[#48C9B0] py-3 text-sm font-semibold text-white transition hover:bg-[#3ab89f]"
        >
          Ir a mi panel
        </Link>
        <Link href="/precios" className="mt-3 block text-[13px] text-[#666] transition hover:text-[#0a0a0a]">
          Volver a precios
        </Link>
      </div>
    </main>
  )
}
