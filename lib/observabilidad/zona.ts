export function zonaDesdePath(path: string | undefined): string {
  if (!path) return "general";
  if (/^\/(invitacion|mesa|playlist)\b/.test(path)) return "invitacion-publica";
  if (/^\/(events|dashboard|perfil|admin)\b/.test(path)) return "planner";
  return "general";
}
