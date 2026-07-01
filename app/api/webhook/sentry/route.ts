import { NextResponse } from "next/server";
import {
  verifySentrySignature,
  parseSentryWebhook,
  shouldNotify,
  formatTelegramMessage,
  isProductionEnv,
} from "@/lib/sentry-alerts/format";
import { sendTelegramMessage } from "@/lib/sentry-alerts/send";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.SENTRY_WEBHOOK_SECRET;
  const token = process.env.TELEGRAM_ALERT_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!secret || !token || !chatId) {
    return NextResponse.json({ error: "no configurado" }, { status: 503 });
  }

  const raw = await req.text();
  const sig = req.headers.get("sentry-hook-signature") ?? "";
  if (!verifySentrySignature(raw, sig, secret)) {
    return NextResponse.json({ error: "firma invalida" }, { status: 401 });
  }

  const resource = req.headers.get("sentry-hook-resource") ?? "";
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "json invalido" }, { status: 400 });
  }

  const action = (body as { action?: string } | null)?.action;
  if (!shouldNotify(resource, action)) {
    return NextResponse.json({ received: true, ignored: resource || "?" });
  }

  const alert = parseSentryWebhook(body);
  if (!alert) {
    return NextResponse.json({ received: true, ignored: "sin datos" });
  }

  if (!isProductionEnv(alert.environment)) {
    return NextResponse.json({ received: true, ignored: `env:${alert.environment}` });
  }

  try {
    await sendTelegramMessage(formatTelegramMessage(alert), { token, chatId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "telegram fallo";
    console.error("[sentry-webhook] telegram error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json({ received: true });
}
