import crypto from "node:crypto";

export type SentryAlert = {
  title: string;
  level?: string;
  environment?: string;
  project?: string;
  url?: string;
  culprit?: string;
  rule?: string;
  severity?: string;
  impact?: string;
  zona?: string;
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

function tagValue(node: AnyObj, key: string): string | undefined {
  const tags = node.tags;
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (Array.isArray(t) && t[0] === key) return str(t[1]);
      const o = asObj(t);
      if (o && str(o.key) === key) return str(o.value);
    }
  }
  const obj = asObj(tags);
  if (obj) return str(obj[key]);
  return undefined;
}

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
    severity: tagValue(node, "severity"),
    impact: tagValue(node, "impact"),
    zona: tagValue(node, "zona"),
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

export function severidadDesdeAlerta(a: SentryAlert): {
  emoji: string;
  etiqueta: string;
  silent: boolean;
} {
  if (a.impact === "pantalla-rota" || a.level === "fatal") {
    return { emoji: "🔴🚨", etiqueta: "PANTALLA EN BLANCO", silent: false };
  }
  // level "warning" tambien es cosmetico: el CosmeticBoundary lo emite y el
  // nivel SI viaja en el webhook issue.created, a diferencia del tag severity.
  if (a.severity === "cosmetico" || a.level === "warning") {
    return { emoji: "🟡", etiqueta: "Cosmético", silent: true };
  }
  return { emoji: "🔴", etiqueta: "Error", silent: false };
}

export function formatTelegramMessage(a: SentryAlert): string {
  const sev = severidadDesdeAlerta(a);
  const level = (a.level ?? "error").toUpperCase();
  const lines: string[] = [
    `${sev.emoji} <b>[${escapeHtml(level)}] ${escapeHtml(a.title)}</b>`,
  ];
  const head = [a.project, a.environment].filter(Boolean).join(" · ");
  if (head) lines.push(escapeHtml(head));
  if (a.zona) lines.push(escapeHtml(`Zona: ${a.zona}`));
  if (a.rule) lines.push(escapeHtml(`Regla: ${a.rule}`));
  if (a.culprit) lines.push(`<code>${escapeHtml(a.culprit)}</code>`);
  if (a.url) lines.push(`<a href="${escapeHtml(a.url)}">Ver en Sentry</a>`);
  return lines.join("\n");
}
