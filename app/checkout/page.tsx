import CheckoutClient from './CheckoutClient'

export const metadata = {
  title: 'Pago — Anfiora',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; plan?: string; billing?: string }>
}) {
  const { tipo, plan, billing } = await searchParams
  return (
    <CheckoutClient
      tipo={tipo === 'organizador' ? 'organizador' : 'anfitrion'}
      plan={plan ?? ''}
      billing={billing === 'anual' ? 'anual' : 'mensual'}
    />
  )
}
