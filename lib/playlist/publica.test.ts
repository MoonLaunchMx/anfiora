import { describe, expect, it } from 'vitest'
import { cancionesDelInvitado, limpiarCancionPublica, urlSpotifySegura } from './publica'

const base = {
  guest_name: '  Ana López ',
  song_title: 'Cielito Lindo',
  artist: 'Pedro Infante',
  spotify_url: 'https://open.spotify.com/track/abc123',
  thumbnail: 'https://i.scdn.co/image/xyz',
  preview_url: 'https://p.scdn.co/mp3-preview/xyz',
  duration_ms: 185000,
  category: 'Fiesta',
}

describe('urlSpotifySegura', () => {
  it('acepta links de open.spotify.com', () => {
    expect(urlSpotifySegura('https://open.spotify.com/track/abc')).toBe('https://open.spotify.com/track/abc')
  })

  it('rechaza javascript:, http y otros dominios', () => {
    expect(urlSpotifySegura('javascript:alert(document.cookie)')).toBeNull()
    expect(urlSpotifySegura('http://open.spotify.com/track/abc')).toBeNull()
    expect(urlSpotifySegura('https://open.spotify.com.evil.com/track')).toBeNull()
    expect(urlSpotifySegura('https://evil.com/?open.spotify.com')).toBeNull()
    expect(urlSpotifySegura(null)).toBeNull()
    expect(urlSpotifySegura('no es url')).toBeNull()
  })
})

describe('limpiarCancionPublica', () => {
  it('deja pasar una cancion valida y recorta el nombre', () => {
    const r = limpiarCancionPublica(base, ['Fiesta', 'Ceremonia'])
    expect(r).toEqual({
      ok: true,
      fila: {
        guest_name: 'Ana López',
        song_title: 'Cielito Lindo',
        artist: 'Pedro Infante',
        spotify_url: 'https://open.spotify.com/track/abc123',
        thumbnail: 'https://i.scdn.co/image/xyz',
        preview_url: 'https://p.scdn.co/mp3-preview/xyz',
        duration_ms: 185000,
        category: 'Fiesta',
      },
    })
  })

  it('pide nombre y titulo', () => {
    expect(limpiarCancionPublica({ ...base, guest_name: '   ' }, [])).toEqual({ ok: false, error: 'faltan_datos' })
    expect(limpiarCancionPublica({ ...base, song_title: undefined }, [])).toEqual({ ok: false, error: 'faltan_datos' })
  })

  it('rechaza un link que no es de Spotify', () => {
    expect(limpiarCancionPublica({ ...base, spotify_url: 'javascript:fetch(1)' }, [])).toEqual({ ok: false, error: 'link_invalido' })
  })

  it('descarta imagen o preview fuera del CDN de Spotify en vez de rechazar', () => {
    const r = limpiarCancionPublica({ ...base, thumbnail: 'https://tracker.com/pixel.gif', preview_url: 'javascript:x' }, [])
    expect(r.ok && r.fila.thumbnail).toBeNull()
    expect(r.ok && r.fila.preview_url).toBeNull()
  })

  it('una etapa que el evento no tiene se guarda sin etapa', () => {
    const r = limpiarCancionPublica(base, ['Ceremonia'])
    expect(r.ok && r.fila.category).toBeNull()
  })

  it('duracion absurda queda en null', () => {
    const r = limpiarCancionPublica({ ...base, duration_ms: -5 }, [])
    expect(r.ok && r.fila.duration_ms).toBeNull()
    const r2 = limpiarCancionPublica({ ...base, duration_ms: '185000.5' }, [])
    expect(r2.ok && r2.fila.duration_ms).toBeNull()
  })

  it('recorta textos largos', () => {
    const r = limpiarCancionPublica({ ...base, guest_name: 'x'.repeat(500), artist: 'y'.repeat(900) }, [])
    expect(r.ok && r.fila.guest_name.length).toBe(120)
    expect(r.ok && r.fila.artist.length).toBe(300)
  })
})

describe('cancionesDelInvitado', () => {
  const lista = [
    { guest_name: 'Ana', is_host_pick: false },
    { guest_name: 'Ana', is_host_pick: null },
    { guest_name: 'Ana', is_host_pick: true },
    { guest_name: 'Luis', is_host_pick: false },
  ]

  it('cuenta solo las del invitado, sin las de los anfitriones', () => {
    expect(cancionesDelInvitado(lista, ' Ana ')).toBe(2)
    expect(cancionesDelInvitado(lista, 'Pedro')).toBe(0)
  })
})
