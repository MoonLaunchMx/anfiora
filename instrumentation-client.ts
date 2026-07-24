import * as Sentry from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/sentry/config";
import { CURRENT_VERSION } from "@/lib/changelog";
import { zonaDesdePath } from "@/lib/observabilidad/zona";

Sentry.init({
  ...sentryInitOptions({
    nodeEnv: process.env.NODE_ENV,
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    appVersion: CURRENT_VERSION,
  }),
  integrations: [
    // Graba lo que hizo el usuario antes del error. Enmascara todo el texto y
    // bloquea imagenes/video: no capturamos datos personales visibles.
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  // Replay SIEMPRE que ocurra un error (lo mas valioso para depurar). Solo 5% de
  // las sesiones normales para cuidar la cuota del plan.
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  // Ruido que no podemos arreglar: rechazos genericos, storage bloqueado del
  // navegador y errores conocidos de ResizeObserver.
  ignoreErrors: [
    "Non-Error promise rejection captured",
    /localStorage/i,
    /storage is not allowed/i,
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Bug interno de @supabase/auth-js: cuando el renovador de token pierde el
    // candado del navegador reenvia el AbortError crudo desde un setInterval sin
    // catch. No afecta al usuario y no es parcheable desde nuestro codigo.
    /Lock was stolen by another request/i,
  ],
  // Errores originados por extensiones del navegador, no por nuestro codigo.
  denyUrls: [/^chrome-extension:\/\//i, /^moz-extension:\/\//i, /extensions\//i],
  beforeSend(event) {
    event.tags = event.tags ?? {};
    if (!event.tags.zona) {
      event.tags.zona =
        typeof window !== "undefined"
          ? zonaDesdePath(window.location.pathname)
          : "general";
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
