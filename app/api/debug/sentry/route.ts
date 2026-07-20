import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const expected = process.env.SENTRY_TEST_KEY;
  if (!expected || req.nextUrl.searchParams.get("key") !== expected) {
    return new NextResponse("Not found", { status: 404 });
  }

  // caso permite probar cada rama del semaforo desde el navegador:
  // ?caso=cosmetico -> 🟡 silencioso · ?caso=pantalla -> 🔴🚨 · default -> 🔴
  const caso = req.nextUrl.searchParams.get("caso") ?? "error";
  const stamp = new Date().toISOString();
  let eventId = "";
  Sentry.withScope((scope) => {
    scope.setFingerprint(["sentry-smoke-test", caso, stamp]);
    scope.setTag("zona", "smoke-test");
    if (caso === "cosmetico") {
      scope.setTag("severity", "cosmetico");
      scope.setLevel("warning");
    } else if (caso === "pantalla") {
      scope.setTag("impact", "pantalla-rota");
      scope.setLevel("fatal");
    }
    eventId = Sentry.captureException(new Error(`Sentry smoke test [${caso}] ${stamp}`));
  });
  await Sentry.flush(2000);

  return NextResponse.json({
    ok: true,
    caso,
    eventId,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    alertConfig: {
      hasWebhookSecret: Boolean(process.env.SENTRY_WEBHOOK_SECRET),
      hasAlertBotToken: Boolean(process.env.TELEGRAM_ALERT_BOT_TOKEN),
      hasAlertChatId: Boolean(process.env.TELEGRAM_ALERT_CHAT_ID),
    },
  });
}
