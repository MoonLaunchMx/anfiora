import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ponerEncabezados } from '@/lib/seguridad/encabezados'

// Los checks de sesion siguen siendo del lado del cliente, en cada pagina.
// Lo unico que hace este proxy es ponerle a cada respuesta los encabezados de
// seguridad. Tienen que ir aqui: los de next.config.ts no llegaban al
// navegador en Vercel porque este mismo proxy arma la respuesta final.
export async function proxy(req: NextRequest) {
  const res = NextResponse.next()
  ponerEncabezados(res.headers)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
