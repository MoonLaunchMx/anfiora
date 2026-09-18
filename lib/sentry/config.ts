import { urlSinSecretos } from "@/lib/observabilidad/anonimizar";

/**
 * Sentry solo se activa en PRODUCCION y solo si hay DSN. Asi el dev local
 * (HMR, hot-reload, pruebas de Twilio/Telegram) deja de contaminar el proyecto
 * de Sentry con ruido que no es de clientes reales.
 */
export type SentryEnv = {
  nodeEnv: string | undefined;
  dsn: string | undefined;
  vercelEnv?: string | undefined;
  appVersion?: string | undefined;
};

// Errores que no salen de nuestro codigo: extensiones del navegador y el
// toolbar de comentarios que Vercel inyecta en los previews (_next-live).
export const SENTRY_DENY_URLS: RegExp[] = [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /extensions\//i,
  /\/_next-live\//i,
];

export function isSentryEnabled(env: SentryEnv): boolean {
  return env.nodeEnv === "production" && Boolean(env.dsn);
}

export function sentryInitOptions(env: SentryEnv) {
  return {
    dsn: env.dsn,
    enabled: isSentryEnabled(env),
    environment: env.vercelEnv ?? env.nodeEnv ?? "development",
    sendDefaultPii: false,
    // Muestreo de trazas: 10% de las transacciones. Suficiente para correlacionar
    // navegador -> API -> DB sin quemar la cuota de Sentry.
    tracesSampleRate: 0.1,
    // Etiqueta legible de la version de la app (del changelog). El "release" real
    // sigue siendo el hash de git para no romper el mapeo de source maps.
    initialScope: {
      tags: { app_version: env.appVersion ?? "unknown" },
    },
    beforeSend: limpiarRastros,
  };
}

/**
 * Antes de mandar nada a Sentry, tapa los tokens de las pantallas publicas.
 * Viajan en la direccion, y la direccion va en el evento, en el encabezado
 * Referer y en las migas de navegacion. Un token guardado en el panel de un
 * tercero es una llave de entrada guardada en el panel de un tercero.
 */
export function limpiarRastros<T extends SentryEventoLimpiable>(evento: T): T {
  if (evento.request?.url) evento.request.url = urlSinSecretos(evento.request.url);

  const referer = evento.request?.headers?.Referer ?? evento.request?.headers?.referer;
  if (referer && evento.request?.headers) {
    const clave = evento.request.headers.Referer ? "Referer" : "referer";
    evento.request.headers[clave] = urlSinSecretos(referer);
  }

  for (const miga of evento.breadcrumbs ?? []) {
    if (!miga.data) continue;
    for (const clave of ["url", "to", "from"] as const) {
      const valor = miga.data[clave];
      if (typeof valor === "string") miga.data[clave] = urlSinSecretos(valor);
    }
  }

  return evento;
}

export type SentryEventoLimpiable = {
  request?: { url?: string; headers?: Record<string, string> };
  breadcrumbs?: Array<{ data?: Record<string, unknown> }>;
};
