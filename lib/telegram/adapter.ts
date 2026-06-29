import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureChannelAccount } from '@/lib/omnichannel/store'

export const TG_CHANNEL = 'telegram'

export function telegramExternalAccountId(): string {
  return (process.env.TELEGRAM_BOT_TOKEN ?? '').split(':')[0] ?? ''
}

export async function ensureTelegramAccount(supabase: SupabaseClient): Promise<string | null> {
  const externalId = telegramExternalAccountId()
  if (!externalId) return null
  return ensureChannelAccount(supabase, {
    channel: TG_CHANNEL,
    externalAccountId: externalId,
    displayLabel: 'Anfiora Telegram (compartido)',
  })
}

export type TelegramUpdate = {
  updateId: number
  chatId: string
  providerMessageId: string   // `${chatId}:${message_id}` (identidad unica en el bot)
  date: string                // ISO 8601
  text: string
  displayName: string | null
  isStart: boolean
  startPayload: string | null
}

export function parseTelegramUpdate(body: unknown): TelegramUpdate | null {
  const update = body as Record<string, any> | null
  if (!update || typeof update.update_id !== 'number') return null
  const msg = update.message ?? update.edited_message
  if (!msg || !msg.chat || typeof msg.message_id === 'undefined') return null

  const text: string = (msg.text ?? '').trim()
  const chatId = String(msg.chat.id)
  const from = msg.from ?? {}
  const displayName =
    [from.first_name, from.username ? `@${from.username}` : null].filter(Boolean).join(' ') || null

  const startMatch = text.match(/^\/start(?:\s+(.+))?$/)
  const isStart = !!startMatch
  const startPayload = startMatch?.[1]?.trim() ?? null

  const dateSec = typeof msg.date === 'number' ? msg.date : 0
  const date = dateSec > 0 ? new Date(dateSec * 1000).toISOString() : new Date().toISOString()

  return {
    updateId: update.update_id,
    chatId,
    providerMessageId: `${chatId}:${String(msg.message_id)}`,
    date,
    text,
    displayName,
    isStart,
    startPayload,
  }
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<{ ok: boolean; messageId: string | null; date: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? ''
  const sentAt = new Date().toISOString()
  if (!token) return { ok: false, messageId: null, date: sentAt }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      console.error('[Telegram] sendMessage fallo:', JSON.stringify(json))
      return { ok: false, messageId: null, date: sentAt }
    }
    const result = json.result
    const date = typeof result?.date === 'number' ? new Date(result.date * 1000).toISOString() : sentAt
    return { ok: true, messageId: result?.message_id != null ? String(result.message_id) : null, date }
  } catch (e) {
    console.error('[Telegram] sendMessage error:', e instanceof Error ? e.message : e)
    return { ok: false, messageId: null, date: sentAt }
  }
}
