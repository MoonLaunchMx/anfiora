import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  verifySentrySignature,
  shouldNotify,
  parseSentryWebhook,
  formatTelegramMessage,
} from "./format";

describe("verifySentrySignature", () => {
  const secret = "s3cr3t";
  const body = '{"hello":"world"}';
  const good = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

  it("acepta firma correcta", () => {
    expect(verifySentrySignature(body, good, secret)).toBe(true);
  });
  it("rechaza firma incorrecta", () => {
    expect(verifySentrySignature(body, "deadbeef", secret)).toBe(false);
  });
  it("rechaza cuando falta firma o secreto", () => {
    expect(verifySentrySignature(body, "", secret)).toBe(false);
    expect(verifySentrySignature(body, good, "")).toBe(false);
  });
});

describe("shouldNotify", () => {
  it("notifica issue created y alertas", () => {
    expect(shouldNotify("issue", "created")).toBe(true);
    expect(shouldNotify("event_alert", undefined)).toBe(true);
    expect(shouldNotify("error", undefined)).toBe(true);
  });
  it("ignora acciones de issue no relevantes", () => {
    expect(shouldNotify("issue", "resolved")).toBe(false);
    expect(shouldNotify("comment", "created")).toBe(false);
  });
});

describe("parseSentryWebhook", () => {
  it("extrae campos del issue", () => {
    const alert = parseSentryWebhook({
      action: "created",
      data: {
        issue: {
          title: "TypeError: x is not a function",
          level: "error",
          culprit: "app/api/foo/route",
          project: { name: "anfiora", slug: "javascript-nextjs" },
          web_url: "https://sentry.io/issues/1",
        },
      },
    });
    expect(alert?.title).toBe("TypeError: x is not a function");
    expect(alert?.project).toBe("anfiora");
    expect(alert?.url).toBe("https://sentry.io/issues/1");
  });
  it("devuelve null sin data", () => {
    expect(parseSentryWebhook({})).toBe(null);
  });
});

describe("formatTelegramMessage", () => {
  it("arma mensaje HTML con nivel y link, escapando html", () => {
    const msg = formatTelegramMessage({
      title: "Error <script>",
      level: "error",
      project: "anfiora",
      environment: "production",
      url: "https://sentry.io/x",
      culprit: "app/api/foo/route",
    });
    expect(msg).toContain("[ERROR]");
    expect(msg).toContain("&lt;script&gt;");
    expect(msg).toContain("Ver en Sentry");
    expect(msg).toContain("anfiora · production");
  });
});
