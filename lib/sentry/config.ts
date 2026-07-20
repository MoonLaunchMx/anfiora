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
  };
}
