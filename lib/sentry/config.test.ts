import { describe, it, expect } from "vitest";
import { isSentryEnabled, sentryInitOptions, SENTRY_DENY_URLS } from "./config";

const esAjena = (url: string) => SENTRY_DENY_URLS.some((re) => re.test(url));

describe("SENTRY_DENY_URLS", () => {
  it("ignora el toolbar de Vercel que se inyecta en los previews", () => {
    expect(
      esAjena("app:///_next-live/feedback/instrument.699d724cc73166e3b2f9.js")
    ).toBe(true);
  });

  it("ignora scripts de extensiones del navegador", () => {
    expect(esAjena("chrome-extension://abc/content.js")).toBe(true);
    expect(esAjena("moz-extension://abc/content.js")).toBe(true);
  });

  it("no ignora nuestros chunks", () => {
    expect(esAjena("https://anfiora.com/_next/static/chunks/app/dashboard/page.js")).toBe(false);
  });
});

describe("isSentryEnabled", () => {
  it("solo se activa en produccion y con DSN", () => {
    expect(
      isSentryEnabled({ nodeEnv: "production", dsn: "https://x@o.ingest.sentry.io/1" })
    ).toBe(true);
    expect(
      isSentryEnabled({ nodeEnv: "development", dsn: "https://x@o.ingest.sentry.io/1" })
    ).toBe(false);
    expect(isSentryEnabled({ nodeEnv: "production", dsn: undefined })).toBe(false);
    expect(isSentryEnabled({ nodeEnv: undefined, dsn: undefined })).toBe(false);
  });
});

describe("sentryInitOptions", () => {
  it("propaga dsn, enabled y environment sin PII", () => {
    expect(sentryInitOptions({ nodeEnv: "production", dsn: "d" })).toEqual({
      dsn: "d",
      enabled: true,
      environment: "production",
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      initialScope: { tags: { app_version: "unknown" } },
    });
  });

  it("cae a development cuando no hay nodeEnv", () => {
    expect(sentryInitOptions({ nodeEnv: undefined, dsn: undefined })).toEqual({
      dsn: undefined,
      enabled: false,
      environment: "development",
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      initialScope: { tags: { app_version: "unknown" } },
    });
  });

  it("vercelEnv separa preview de production en la etiqueta", () => {
    expect(
      sentryInitOptions({ nodeEnv: "production", dsn: "d", vercelEnv: "preview" })
    ).toEqual({
      dsn: "d",
      enabled: true,
      environment: "preview",
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      initialScope: { tags: { app_version: "unknown" } },
    });
  });

  it("etiqueta la version de la app cuando se pasa appVersion", () => {
    expect(
      sentryInitOptions({ nodeEnv: "production", dsn: "d", appVersion: "2026-06-15" })
        .initialScope.tags.app_version
    ).toBe("2026-06-15");
  });
});
