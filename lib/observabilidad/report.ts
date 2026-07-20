import * as Sentry from "@sentry/nextjs";

export function reportError(
  error: unknown,
  opts: { zona: string; severity?: string }
): void {
  Sentry.captureException(error, {
    tags: { zona: opts.zona, severity: opts.severity ?? "error" },
  });
}
