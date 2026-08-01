import type { PushType, NotificationPrefs } from '@/lib/types'

export function readPrefs(settings: unknown): NotificationPrefs {
  if (!settings || typeof settings !== 'object') return {}
  const raw = (settings as Record<string, unknown>).notifications
  if (!raw || typeof raw !== 'object') return {}
  return raw as NotificationPrefs
}

// Ausencia significa activado: los usuarios que ya tenian push antes de esta
// feature no se quedan mudos, y no hace falta backfill.
export function isTypeEnabled(settings: unknown, type: PushType): boolean {
  return readPrefs(settings)[type] !== false
}

export function withPref(
  settings: unknown,
  type: PushType,
  value: boolean,
): Record<string, unknown> {
  const base =
    settings && typeof settings === 'object' ? { ...(settings as Record<string, unknown>) } : {}
  base.notifications = { ...readPrefs(settings), [type]: value }
  return base
}
