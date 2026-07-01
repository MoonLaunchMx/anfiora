import crypto from "node:crypto";

export type SentryAlert = {
  title: string;
  level?: string;
  environment?: string;
  project?: string;
  url?: string;
  culprit?: string;
  rule?: string;
};

// Sentry firma el webhook con HMAC-SHA256 (hex) del cuerpo crudo usando el
// Client Secret de la Custom Integration. Comparacion en tiempo constante.
export function verifySentrySignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function shouldNotify(resource: string, action: string | undefined): boolean {
  if (resource === "event_alert" || resource === "metric_alert") return true;
  if (resource === "error") return true;
  if (resource === "issue") {
    return ["created", "unresolved", "escalating", "regression"].includes(
      action ?? ""
    );
  }
  return false;
}

type AnyObj = Record<string, unknown>;
const asObj = (v: unknown): AnyObj | undefined =>
  v && typeof v === "object" ? (v as AnyObj) : undefined;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

export function parseSentryWebhook(body: unknown): SentryAlert | null {
  const data = asObj(asObj(body)?.data);
  if (!data) return null;
  const node = asObj(data.event) ?? asObj(data.issue) ?? asObj(data.metric_alert);
  if (!node) return null;
  const project = asObj(node.project);
  return {
    title: str(node.title) ?? str(node.message) ?? str(node.metric) ?? "Evento de Sentry",
    level: str(node.level),
    environment: str(node.environment),
    project: str(project?.name) ?? str(project?.slug),
    url: str(node.web_url) ?? str(node.url),
    culprit: str(node.culprit),
    rule: str(data.triggered_rule),
  };
}

// Solo notificamos errores de produccion. Fail-open: si el evento no trae
// environment (algunos payloads de issue no lo incluyen), avisamos igual para
// no tragarnos un error real de prod. Si viene 'preview'/otro, lo ignoramos.
export function isProductionEnv(environment: string | undefined): boolean {
  return !environment || environment === "production";
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function formatTelegramMessage(a: SentryAlert): string {
  const level = (a.level ?? "error").toUpperCase();
  const lines: string[] = [`<b>[${escapeHtml(level)}] ${escapeHtml(a.title)}</b>`];
  const head = [a.project, a.environment].filter(Boolean).join(" · ");
  if (head) lines.push(escapeHtml(head));
  if (a.rule) lines.push(escapeHtml(`Regla: ${a.rule}`));
  if (a.culprit) lines.push(`<code>${escapeHtml(a.culprit)}</code>`);
  if (a.url) lines.push(`<a href="${escapeHtml(a.url)}">Ver en Sentry</a>`);
  return lines.join("\n");
}
