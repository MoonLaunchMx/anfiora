"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
// @ts-ignore
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      level: "fatal",
      tags: { impact: "pantalla-rota", zona: "general" },
    });
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#ffffff",
          color: "#0a0a0a",
          padding: "24px",
          fontFamily: "'General Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <img
            src="/images/logo.svg"
            alt="Anfiora"
            width={132}
            height={36}
            style={{ margin: "0 auto 32px", display: "block" }}
          />
          <h1
            style={{
              fontFamily: "'Josefin Sans', sans-serif",
              fontWeight: 700,
              fontSize: 26,
              margin: "0 0 12px",
              letterSpacing: "-0.01em",
            }}
          >
            Algo salió mal
          </h1>
          <p
            style={{
              color: "#666666",
              fontSize: 15,
              lineHeight: 1.5,
              margin: "0 0 28px",
            }}
          >
            Ya recibimos el aviso y estamos trabajando en ello. Intenta de nuevo
            en un momento.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#48C9B0",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              padding: "12px 28px",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
