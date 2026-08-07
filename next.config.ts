import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Solo afecta a `next dev`: sin esto, Next 16 bloquea sus recursos de desarrollo
// (CSS y JS) cuando la app se abre por un tunel para probar en un telefono real.
const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app', '192.168.0.15'],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});