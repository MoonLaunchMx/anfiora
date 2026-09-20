import { describe, it, expect } from 'vitest'
import { rutaSinTokens, urlSinSecretos } from './anonimizar'

describe('rutaSinTokens', () => {
  it('tapa el token de las pantallas publicas', () => {
    expect(rutaSinTokens('/playlist/abc123')).toBe('/playlist/[token]')
    expect(rutaSinTokens('/mesa/abc123')).toBe('/mesa/[token]')
    expect(rutaSinTokens('/opinion/abc123')).toBe('/opinion/[token]')
    expect(rutaSinTokens('/invite/abc123')).toBe('/invite/[token]')
  })

  it('en la invitacion conserva el slug y tapa el token', () => {
    expect(rutaSinTokens('/invitacion/maria-y-pedro/abc123')).toBe('/invitacion/maria-y-pedro/[token]')
  })

  it('no toca la vista previa de la invitacion, que va por id de evento', () => {
    expect(rutaSinTokens('/invitacion/preview/ev1')).toBe('/invitacion/preview/ev1')
  })

  it('deja en paz las rutas del planner', () => {
    expect(rutaSinTokens('/events/ev1/presupuesto')).toBe('/events/ev1/presupuesto')
    expect(rutaSinTokens('/dashboard')).toBe('/dashboard')
    expect(rutaSinTokens('/')).toBe('/')
  })
})

describe('urlSinSecretos', () => {
  it('tapa el token en una direccion completa', () => {
    expect(urlSinSecretos('https://www.anfiora.com/playlist/abc123'))
      .toBe('https://www.anfiora.com/playlist/[token]')
  })

  it('tapa el token que viene en la query y conserva lo demas', () => {
    expect(urlSinSecretos('https://www.anfiora.com/x?utm_source=ig&token=abc123'))
      .toBe('https://www.anfiora.com/x?utm_source=ig&token=%5Btoken%5D')
  })

  it('tapa tambien lo que viene despues del gato', () => {
    expect(urlSinSecretos('https://www.anfiora.com/auth/reset#access_token=abc123'))
      .toBe('https://www.anfiora.com/auth/reset#access_token=%5Btoken%5D')
  })

  it('aguanta una direccion incompleta sin reventar', () => {
    expect(urlSinSecretos('/playlist/abc123')).toBe('/playlist/[token]')
    expect(urlSinSecretos('')).toBe('')
  })
})
