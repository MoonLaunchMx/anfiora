/**
 * Sentry solo se activa en PRODUCCION y solo si hay DSN. Asi el dev local
 * (HMR, hot-reload, pruebas de Twilio/Telegram) deja de contaminar el proyecto
 * de Sentry con ruido que no es de clientes reales.
 */
export type SentryEnv = {
  nodeEnv: string | undefined;
  dsn: string | undefined;
  vercelEnv?: string | undefined;
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
  };
}
