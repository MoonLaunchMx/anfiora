import { describe, it, expect } from "vitest";
import { esOrigenExterno } from "./origen-externo";

const conMarcos = (archivos: string[], value = "Boom") => ({
  exception: { values: [{ value, stacktrace: { frames: archivos.map((filename) => ({ filename })) } }] },
});

describe("esOrigenExterno", () => {
  it("marca el error real del WebView de Instagram (JAVASCRIPT-NEXTJS-W)", () => {
    expect(
      esOrigenExterno(
        conMarcos(
          [
            "app://navigation_performance_logger_android",
            "node_modules/@sentry/core/src/tracing/spans/captureSpan.ts",
          ],
          "Error invoking postMessage: Java object is gone"
        )
      )
    ).toBe(true);
  });

  it("marca extensiones del navegador", () => {
    expect(esOrigenExterno(conMarcos(["chrome-extension://abc/content.js"]))).toBe(true);
    expect(esOrigenExterno(conMarcos(["moz-extension://abc/content.js"]))).toBe(true);
    expect(esOrigenExterno(conMarcos(["safari-web-extension://abc/content.js"]))).toBe(true);
  });

  it("marca por mensaje cuando el stacktrace llega vacio", () => {
    expect(esOrigenExterno({ message: "Error invoking postMessage: Java object is gone" })).toBe(true);
    expect(esOrigenExterno({ exception: { values: [{ value: "Java object is gone" }] } })).toBe(true);
  });

  it("NO marca errores de nuestro codigo", () => {
    expect(
      esOrigenExterno(
        conMarcos(
          [
            "https://anfiora.com/_next/static/chunks/app/dashboard/page.js",
            "app/events/[id]/presupuesto/page.tsx",
          ],
          "Cannot read properties of undefined (reading 'id')"
        )
      )
    ).toBe(false);
  });

  it("NO marca un mensaje nuestro que solo menciona una app", () => {
    expect(esOrigenExterno({ message: "No se pudo abrir la app de WhatsApp" })).toBe(false);
  });

  it("aguanta eventos incompletos sin reventar", () => {
    expect(esOrigenExterno({})).toBe(false);
    expect(esOrigenExterno({ exception: { values: null } })).toBe(false);
    expect(esOrigenExterno({ exception: { values: [{ stacktrace: { frames: null } }] } })).toBe(false);
    expect(esOrigenExterno({ exception: { values: [{ value: null, stacktrace: null }] } })).toBe(false);
  });
});
