// Capa de transporte de WhatsApp. Hoy: Twilio. La interfaz aisla el proveedor
// para que el resto del sistema envie sin conocer a Twilio (multi-tenant: el
// numero emisor `from` llega por parametro, ya no por env global).

export type SendParams = {
  to: string   // formato whatsapp:+52...
  body: string
  from: string // numero emisor en formato whatsapp:+52... (linea del planner)
}

export type SendResult = {
  ok: boolean
  status: 'sent' | 'failed'
  sid: string | null
}

export interface WhatsAppTransport {
  send(params: SendParams): Promise<SendResult>
}

export const twilioTransport: WhatsAppTransport = {
  async send({ to, body, from }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken  = process.env.TWILIO_AUTH_TOKEN!
    const url        = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const creds      = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const params     = new URLSearchParams({ To: to, From: from, Body: body })

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        return { ok: true, status: 'sent', sid: json?.sid ?? null }
      }
      console.error('[WA] Twilio error:', await res.text())
      return { ok: false, status: 'failed', sid: null }
    } catch (err) {
      console.error('[WA] Twilio fetch fallo:', err)
      return { ok: false, status: 'failed', sid: null }
    }
  },
}
