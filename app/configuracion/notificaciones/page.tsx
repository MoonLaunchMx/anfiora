'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Bell, CheckCircle, AlertCircle } from 'lucide-react'
import { PUSH_TYPES, type PushType, type NotificationPrefs } from '@/lib/types'
import { readPrefs, withPref } from '@/lib/notifications/prefs'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

function Toast({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs
      ${type === 'success'
        ? 'border-[#a0e0c0] bg-[#f0fff6] text-[#2a7a50]'
        : 'border-[#ffc0c0] bg-[#fff0f0] text-[#cc3333]'
      }`}
    >
      {type === 'success'
        ? <CheckCircle size={14} className="shrink-0" />
        : <AlertCircle size={14} className="shrink-0" />
      }
      {message}
    </div>
  )
}

export default function NotificacionesPage() {
  const router = useRouter()

  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const [pushSupported, setPushSupported]   = useState(true)
  const [pushEnabled, setPushEnabled]       = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [pushBusy, setPushBusy]             = useState(false)
  const [pushMsg, setPushMsg]               = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [prefs, setPrefs]                   = useState<NotificationPrefs>({})
  const [prefsBusy, setPrefsBusy]           = useState<PushType | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('users')
        .select('settings')
        .eq('id', user.id)
        .single()

      if (data) setPrefs(readPrefs(data.settings))
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    if (!supported) {
      setPushSupported(false)
      return
    }

    setPushPermission(Notification.permission)

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushEnabled(!!sub))
      .catch(() => setPushEnabled(false))
  }, [])

  const enablePush = async () => {
    setPushMsg(null)
    setPushBusy(true)
    try {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') {
        setPushMsg({ type: 'error', text: 'Permiso de notificaciones bloqueado. Actívalo desde los ajustes del navegador.' })
        setPushBusy(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setPushMsg({ type: 'error', text: 'Falta configuración del servidor. Intenta más tarde.' })
        setPushBusy(false)
        return
      }

      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }))

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      })

      if (!res.ok) throw new Error('subscribe failed')

      setPushEnabled(true)
      setPushMsg({ type: 'success', text: 'Notificaciones activadas en este dispositivo' })
    } catch {
      setPushMsg({ type: 'error', text: 'No se pudieron activar las notificaciones. Intenta de nuevo.' })
    }
    setPushBusy(false)
  }

  const disablePush = async () => {
    setPushMsg(null)
    setPushBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ endpoint }),
        })
      }
      setPushEnabled(false)
      setPushMsg({ type: 'success', text: 'Notificaciones desactivadas en este dispositivo' })
    } catch {
      setPushMsg({ type: 'error', text: 'No se pudieron desactivar. Intenta de nuevo.' })
    }
    setPushBusy(false)
  }

  const sendTestPush = async () => {
    setPushMsg(null)
    setPushBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) throw new Error('test failed')
      setPushMsg({ type: 'success', text: 'Enviamos una notificación de prueba a este dispositivo.' })
    } catch {
      setPushMsg({ type: 'error', text: 'No se pudo enviar la prueba. Intenta de nuevo.' })
    }
    setPushBusy(false)
  }

  const togglePref = async (type: PushType) => {
    const next = prefs[type] === false
    const previous = prefs
    setPrefsBusy(type)
    setPushMsg(null)
    setPrefs({ ...prefs, [type]: next })

    const { data: row } = await supabase.from('users').select('settings').eq('id', userId).single()
    const { data: updated, error } = await supabase
      .from('users')
      .update({ settings: withPref(row?.settings, type, next) })
      .eq('id', userId)
      .select('id')

    // Un UPDATE filtrado por RLS no da error, devuelve cero filas: hay que contarlas.
    if (error || !updated || updated.length === 0) {
      setPrefs(previous)
      setPushMsg({ type: 'error', text: 'No se pudo guardar la preferencia. Intenta de nuevo.' })
    }
    setPrefsBusy(null)
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#48C9B0]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-[#1D1E20]">Notificaciones</h3>
        <p className="text-[13px] text-[#666]">Recibe avisos en este dispositivo cuando pase algo importante en tus eventos.</p>
      </div>

      <div className="max-w-[600px] rounded-xl border border-[#e8e8e8] p-5">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-[#48C9B0]" />
          <h4 className="text-sm font-semibold text-[#1D1E20]">Activar en este dispositivo</h4>
        </div>

        {!pushSupported ? (
          <p className="mt-4 text-xs text-[#888]">
            Este navegador no admite notificaciones. En iPhone o iPad necesitas instalar Anfiora como app desde Safari para activarlas.
          </p>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#1D1E20]">Notificaciones push</p>
              <p className="text-[11px] text-[#999]">
                {pushPermission === 'denied'
                  ? 'Permiso bloqueado. Habilítalo desde los ajustes del navegador.'
                  : pushEnabled
                    ? 'Estás recibiendo notificaciones aquí.'
                    : 'Las notificaciones están desactivadas aquí.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pushEnabled}
              disabled={pushBusy || pushPermission === 'denied'}
              onClick={() => (pushEnabled ? disablePush() : enablePush())}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
                ${pushEnabled ? 'bg-[#48C9B0]' : 'bg-[#d8d8d8]'}
                ${pushBusy || pushPermission === 'denied' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                  ${pushEnabled ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
          </div>
        )}

        {pushSupported && pushEnabled && (
          <button
            type="button"
            onClick={sendTestPush}
            disabled={pushBusy}
            className={`mt-4 rounded-lg border border-[#e0e0e0] bg-white px-4 py-2 text-xs font-semibold text-[#555] transition
              ${pushBusy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[#48C9B0] hover:text-[#48C9B0]'}`}
          >
            Enviar notificación de prueba
          </button>
        )}

        {pushSupported && (
          <div className={`mt-6 border-t border-[#f0f0f0] pt-5 ${pushEnabled ? '' : 'opacity-50'}`}>
            <p className="text-xs font-semibold text-[#555]">Qué quieres recibir</p>
            <div className="mt-3 flex flex-col gap-3">
              {PUSH_TYPES.map(({ type, label, hint }) => {
                const on = prefs[type] !== false
                const disabled = !pushEnabled || prefsBusy !== null
                return (
                  <div key={type} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-[#1D1E20]">{label}</p>
                      <p className="text-[11px] text-[#999]">{hint}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={label}
                      disabled={disabled}
                      onClick={() => togglePref(type)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors
                        ${on ? 'bg-[#48C9B0]' : 'bg-[#d8d8d8]'}
                        ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                          ${on ? 'translate-x-5' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
            {!pushEnabled && (
              <p className="mt-3 text-[11px] text-[#999]">
                Activa las notificaciones en este dispositivo para elegir qué recibir.
              </p>
            )}
          </div>
        )}

        {pushMsg && <div className="mt-4"><Toast type={pushMsg.type} message={pushMsg.text} /></div>}
      </div>
    </div>
  )
}
