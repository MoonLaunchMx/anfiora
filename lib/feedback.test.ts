import { describe, it, expect } from 'vitest'
import {
  formatFeedbackMessage,
  isFeedbackType,
  FEEDBACK_TYPES,
  describeClient,
  validateImages,
  shouldCompress,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  COMPRESS_MAX_EDGE,
  COMPRESS_SKIP_BYTES,
} from './feedback'

const baseUser = { name: 'Diego', email: 'd@x.com', plan: 'pro' }

describe('formatFeedbackMessage', () => {
  it('pone el prefijo correcto por tipo', () => {
    expect(formatFeedbackMessage({ type: 'sugerencia', message: 'hola', page: '/x', user: baseUser }))
      .toContain('[SUGERENCIA]')
    expect(formatFeedbackMessage({ type: 'nota', message: 'hola', page: '/x', user: baseUser }))
      .toContain('[NOTA]')
    expect(formatFeedbackMessage({ type: 'error', message: 'hola', page: '/x', user: baseUser }))
      .toContain('[ERROR]')
  })

  it('incluye correo, plan y pagina', () => {
    const out = formatFeedbackMessage({ type: 'nota', message: 'algo', page: '/events/1/timeline', user: baseUser })
    expect(out).toContain('d@x.com')
    expect(out).toContain('pro')
    expect(out).toContain('/events/1/timeline')
    expect(out).toContain('algo')
  })

  it('no rompe con caracteres especiales en el mensaje', () => {
    const msg = 'bug con <script> & "comillas" 100% roto'
    const out = formatFeedbackMessage({ type: 'error', message: msg, page: '/x', user: baseUser })
    expect(out).toContain(msg)
  })

  it('incluye el evento solo si viene', () => {
    const con = formatFeedbackMessage({ type: 'nota', message: 'a', page: '/x', user: baseUser, eventName: 'Boda Ana' })
    expect(con).toContain('Boda Ana')
    const sin = formatFeedbackMessage({ type: 'nota', message: 'a', page: '/x', user: baseUser })
    expect(sin).not.toContain('Evento:')
  })

  it('incluye navegador, sistema y ancho cuando viene el contexto', () => {
    const out = formatFeedbackMessage({
      type: 'error', message: 'a', page: '/x', user: baseUser,
      client: { browser: 'Safari', os: 'iOS', viewport: '390px de ancho' },
    })
    expect(out).toContain('Safari')
    expect(out).toContain('iOS')
    expect(out).toContain('390px de ancho')
  })

  it('omite la linea de contexto si no viene', () => {
    const out = formatFeedbackMessage({ type: 'error', message: 'a', page: '/x', user: baseUser })
    expect(out).not.toContain('Desde:')
  })

  it('anota cuantas imagenes acompanan al reporte', () => {
    const out = formatFeedbackMessage({ type: 'error', message: 'a', page: '/x', user: baseUser, imageCount: 2 })
    expect(out).toContain('2 imagenes')
  })

  it('no menciona imagenes cuando no hay', () => {
    const out = formatFeedbackMessage({ type: 'error', message: 'a', page: '/x', user: baseUser, imageCount: 0 })
    expect(out).not.toContain('imagen')
  })

  it('usa fallback cuando no hay nombre', () => {
    const out = formatFeedbackMessage({ type: 'nota', message: 'a', page: '/x', user: { name: '', email: 'e@x.com', plan: 'free' } })
    expect(out).toContain('Sin nombre')
  })
})

describe('isFeedbackType', () => {
  it('acepta los tres validos y rechaza el resto', () => {
    expect(isFeedbackType('sugerencia')).toBe(true)
    expect(isFeedbackType('nota')).toBe(true)
    expect(isFeedbackType('error')).toBe(true)
    expect(isFeedbackType('otro')).toBe(false)
    expect(isFeedbackType(null)).toBe(false)
    expect(isFeedbackType(3)).toBe(false)
  })
})

describe('FEEDBACK_TYPES', () => {
  it('tiene los tres tipos con label', () => {
    expect(FEEDBACK_TYPES.map(t => t.value)).toEqual(['sugerencia', 'nota', 'error'])
    expect(FEEDBACK_TYPES.every(t => t.label.length > 0)).toBe(true)
  })
})

const png = (size: number) => ({ type: 'image/png', size })

describe('validateImages', () => {
  it('acepta hasta el tope y rechaza una mas', () => {
    const tres = Array.from({ length: MAX_IMAGES }, () => png(1000))
    expect(validateImages(tres).ok).toBe(true)
    const cuatro = [...tres, png(1000)]
    const res = validateImages(cuatro)
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toContain('3')
  })

  it('acepta cero imagenes: el reporte de puro texto sigue siendo valido', () => {
    expect(validateImages([]).ok).toBe(true)
  })

  it('rechaza lo que no es imagen y lo dice sin tecnicismos', () => {
    const res = validateImages([{ type: 'application/pdf', size: 1000 }])
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toMatch(/imagen/i)
  })

  it('rechaza una imagen que pasa el tope de peso', () => {
    const res = validateImages([png(MAX_IMAGE_BYTES + 1)])
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toMatch(/pesa/i)
  })

  it('acepta una imagen justo en el tope de peso', () => {
    expect(validateImages([png(MAX_IMAGE_BYTES)]).ok).toBe(true)
  })

  it('rechaza una imagen vacia', () => {
    expect(validateImages([png(0)]).ok).toBe(false)
  })

  it('acepta jpeg y webp ademas de png', () => {
    expect(validateImages([{ type: 'image/jpeg', size: 500 }]).ok).toBe(true)
    expect(validateImages([{ type: 'image/webp', size: 500 }]).ok).toBe(true)
  })
})

describe('shouldCompress', () => {
  it('deja intacta una captura chica: es la razon de existir de la regla', () => {
    expect(shouldCompress({ size: 280 * 1024, width: 1440, height: 900 })).toBe(false)
  })

  it('comprime una foto pesada de celular', () => {
    expect(shouldCompress({ size: 6 * 1024 * 1024, width: 4032, height: 3024 })).toBe(true)
  })

  it('comprime una imagen liviana pero enorme de lado', () => {
    expect(shouldCompress({ size: 200 * 1024, width: COMPRESS_MAX_EDGE + 1, height: 100 })).toBe(true)
  })

  it('mide el lado largo sin importar la orientacion', () => {
    expect(shouldCompress({ size: 200 * 1024, width: 100, height: COMPRESS_MAX_EDGE + 1 })).toBe(true)
  })

  it('no comprime justo en los dos limites', () => {
    expect(shouldCompress({ size: COMPRESS_SKIP_BYTES, width: COMPRESS_MAX_EDGE, height: COMPRESS_MAX_EDGE })).toBe(false)
  })

  it('comprime apenas se pasa de peso', () => {
    expect(shouldCompress({ size: COMPRESS_SKIP_BYTES + 1, width: 800, height: 600 })).toBe(true)
  })
})

describe('describeClient', () => {
  it('reconoce Chrome en Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
    const c = describeClient(ua, 1440)
    expect(c.browser).toBe('Chrome')
    expect(c.os).toBe('Windows')
  })

  it('reconoce Safari en iPhone sin confundirlo con Chrome', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    const c = describeClient(ua, 390)
    expect(c.browser).toBe('Safari')
    expect(c.os).toBe('iOS')
  })

  it('reconoce Edge sin reportarlo como Chrome', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'
    expect(describeClient(ua, 1920).browser).toBe('Edge')
  })

  it('reconoce Chrome en Android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
    const c = describeClient(ua, 412)
    expect(c.browser).toBe('Chrome')
    expect(c.os).toBe('Android')
  })

  it('reconoce Firefox en Mac', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0'
    const c = describeClient(ua, 1280)
    expect(c.browser).toBe('Firefox')
    expect(c.os).toBe('macOS')
  })

  it('describe el ancho en pixeles', () => {
    expect(describeClient('x', 390).viewport).toBe('390px de ancho')
  })

  it('no truena con user agent vacio ni ancho invalido', () => {
    const c = describeClient('', 0)
    expect(c.browser).toBe('Desconocido')
    expect(c.os).toBe('Desconocido')
    expect(c.viewport).toBe('Desconocido')
  })
})
