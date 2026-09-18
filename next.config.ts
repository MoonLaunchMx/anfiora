import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Solo afecta a `next dev`: sin esto, Next 16 bloquea sus recursos de desarrollo
// (CSS y JS) cuando la app se abre por un tunel para probar en un telefono real.
const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app', '192.168.0.15'],
  // Las rutas viejas de cuenta y perfil viven ahora dentro de /configuracion.
  // Se quedan como redirect y no como borrado porque hay gente con el enlace
  // guardado. `permanent: false` a proposito: si algun dia se reacomodan otra
  // vez, un 308 ya se habria quedado cacheado en el navegador de todos.
  // Encabezados de seguridad en todas las respuestas.
  //
  // El que de verdad importa aqui es Referrer-Policy: las pantallas publicas
  // llevan el token en la direccion, y sin esto, cuando el invitado abre un
  // link de Spotify o de una tienda, el navegador le manda la direccion
  // COMPLETA -con token- a ese sitio. Con same-origin, hacia afuera no viaja.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Nadie nos mete en un iframe: sin esto una pagina ajena puede
          // dibujarnos debajo de sus propios botones.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/cuenta', destination: '/configuracion/equipo', permanent: false },
      { source: '/cuenta/:path*', destination: '/configuracion/equipo', permanent: false },
      { source: '/perfil', destination: '/configuracion/perfil', permanent: false },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});