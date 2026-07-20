import * as Sentry from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/sentry/config";
import { CURRENT_VERSION } from "@/lib/changelog";

Sentry.init(
  sentryInitOptions({
    nodeEnv: process.env.NODE_ENV,
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    vercelEnv: process.env.VERCEL_ENV,
    appVersion: CURRENT_VERSION,
  })
);
