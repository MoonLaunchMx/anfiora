import * as Sentry from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/sentry/config";

Sentry.init(
  sentryInitOptions({
    nodeEnv: process.env.NODE_ENV,
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
  })
);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
