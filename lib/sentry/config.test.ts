import { describe, it, expect } from "vitest";
import { isSentryEnabled, sentryInitOptions } from "./config";

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
    });
  });

  it("cae a development cuando no hay nodeEnv", () => {
    expect(sentryInitOptions({ nodeEnv: undefined, dsn: undefined })).toEqual({
      dsn: undefined,
      enabled: false,
      environment: "development",
      sendDefaultPii: false,
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
    });
  });
});
