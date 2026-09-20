/**
 * Errores que NO son de Anfiora: los genera codigo que otro inyecta en nuestra
 * pestana (el mini-navegador de Instagram/Facebook, extensiones del navegador,
 * apps que abren la web adentro de si mismas). Sentry los ve porque escucha
 * toda la pestana, no porque nuestro codigo haya fallado.
 *
 * No los tiramos: los bajamos a nivel "info" (azul) y los marcamos con la
 * etiqueta `origen: externo`. Asi no interrumpen, pero el historial queda.
 */

type MarcoMinimo = { filename?: string | null };

type ExcepcionMinima = {
  value?: string | null;
  stacktrace?: { frames?: MarcoMinimo[] | null } | null;
};

export type EventoMinimo = {
  message?: string | null;
  exception?: { values?: ExcepcionMinima[] | null } | null;
};

/**
 * Esquemas de URL que solo aparecen cuando el script lo inyecto algo ajeno a
 * nuestro dominio. `app://` es el que usan los WebView de Instagram y Facebook.
 */
const ESQUEMAS_AJENOS =
  /^(app|chrome-extension|moz-extension|safari-extension|safari-web-extension|webkit-masked-url):/i;

/**
 * Mensajes ya identificados como de terceros, por si el stacktrace llega vacio
 * (pasa cuando el error cruza el puente nativo del WebView).
 */
const MENSAJES_AJENOS = [
  /Java object is gone/i,
  /navigation_performance_logger/i,
  /instantSearchSDKJSBridgeClearHighlight/i,
];

function textoDelEvento(evento: EventoMinimo): string {
  const valores = evento.exception?.values ?? [];
  const mensajes = valores.map((v) => v?.value ?? "");
  return [evento.message ?? "", ...mensajes].join(" ");
}

function archivosDelEvento(evento: EventoMinimo): string[] {
  const valores = evento.exception?.values ?? [];
  return valores.flatMap((v) =>
    (v?.stacktrace?.frames ?? []).map((f) => f?.filename ?? "")
  );
}

export function esOrigenExterno(evento: EventoMinimo): boolean {
  if (archivosDelEvento(evento).some((a) => ESQUEMAS_AJENOS.test(a))) {
    return true;
  }
  const texto = textoDelEvento(evento);
  return MENSAJES_AJENOS.some((patron) => patron.test(texto));
}
