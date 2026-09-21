import { describe, it, expect } from 'vitest'
import {
  prefijosABorrar,
  rutasBajoPrefijo,
  BUCKET_MEDIA,
  BUCKET_DOCS,
  type ClienteStorage,
  type EntradaStorage,
} from './archivos-usuario'

describe('prefijosABorrar', () => {
  it('una cuenta sin eventos ni workspace solo trae su avatar', () => {
    expect(prefijosABorrar({ userId: 'u1', eventIds: [], workspaceIds: [] })).toEqual([
      { bucket: BUCKET_MEDIA, prefijo: 'avatars/u1' },
    ])
  })

  it('cada evento trae sus tres carpetas de media y su carpeta de documentos', () => {
    const p = prefijosABorrar({ userId: 'u1', eventIds: ['e1'], workspaceIds: [] })
    expect(p).toContainEqual({ bucket: BUCKET_MEDIA, prefijo: 'imagenes/e1' })
    expect(p).toContainEqual({ bucket: BUCKET_MEDIA, prefijo: 'audio/e1' })
    expect(p).toContainEqual({ bucket: BUCKET_MEDIA, prefijo: 'dress-code/e1' })
    expect(p).toContainEqual({ bucket: BUCKET_DOCS, prefijo: 'e1' })
  })

  it('el logo va por workspace, no por usuario', () => {
    const p = prefijosABorrar({ userId: 'u1', eventIds: [], workspaceIds: ['w1', 'w2'] })
    expect(p).toContainEqual({ bucket: BUCKET_MEDIA, prefijo: 'logos/w1' })
    expect(p).toContainEqual({ bucket: BUCKET_MEDIA, prefijo: 'logos/w2' })
  })

  it('no repite prefijos si llegan ids duplicados', () => {
    const p = prefijosABorrar({ userId: 'u1', eventIds: ['e1', 'e1'], workspaceIds: ['w1', 'w1'] })
    expect(new Set(p.map(x => `${x.bucket}:${x.prefijo}`)).size).toBe(p.length)
  })

  it('ignora ids vacios en vez de armar rutas sueltas', () => {
    const p = prefijosABorrar({ userId: 'u1', eventIds: ['', 'e1'], workspaceIds: [''] })
    expect(p.some(x => x.prefijo.endsWith('/'))).toBe(false)
    expect(p.filter(x => x.bucket === BUCKET_DOCS)).toEqual([{ bucket: BUCKET_DOCS, prefijo: 'e1' }])
  })

  it('nunca devuelve un prefijo vacio, que borraria el bucket entero', () => {
    const p = prefijosABorrar({ userId: '', eventIds: [''], workspaceIds: [''] })
    expect(p).toEqual([])
  })
})

function clienteFalso(arbol: Record<string, EntradaStorage[]>): ClienteStorage & { borradas: string[] } {
  const borradas: string[] = []
  return {
    borradas,
    async list(prefijo) { return { data: arbol[prefijo] ?? [], error: null } },
    async remove(rutas) { borradas.push(...rutas); return { error: null } },
  }
}

describe('rutasBajoPrefijo', () => {
  it('devuelve los archivos de una carpeta plana', async () => {
    const cliente = clienteFalso({ 'imagenes/e1': [{ name: 'a.jpg', id: '1' }, { name: 'b.jpg', id: '2' }] })
    const { rutas, error } = await rutasBajoPrefijo(cliente, 'imagenes/e1')
    expect(error).toBeNull()
    expect(rutas).toEqual(['imagenes/e1/a.jpg', 'imagenes/e1/b.jpg'])
  })

  it('baja por las subcarpetas de event-docs', async () => {
    const cliente = clienteFalso({
      'e1': [{ name: 'cotizaciones', id: null }],
      'e1/cotizaciones': [{ name: 'prov-9', id: null }],
      'e1/cotizaciones/prov-9': [{ name: 'uno.pdf', id: '7' }],
    })
    const { rutas } = await rutasBajoPrefijo(cliente, 'e1')
    expect(rutas).toEqual(['e1/cotizaciones/prov-9/uno.pdf'])
  })

  it('una carpeta vacia no es un error', async () => {
    const { rutas, error } = await rutasBajoPrefijo(clienteFalso({}), 'audio/e9')
    expect(error).toBeNull()
    expect(rutas).toEqual([])
  })

  it('propaga el error del bucket en vez de tragarselo', async () => {
    const cliente: ClienteStorage = {
      async list() { return { data: null, error: { message: 'bucket caido' } } },
      async remove() { return { error: null } },
    }
    const { error } = await rutasBajoPrefijo(cliente, 'imagenes/e1')
    expect(error).toBe('bucket caido')
  })

  it('no se cuelga si el bucket devuelve carpetas anidadas sin fin', async () => {
    const cliente: ClienteStorage = {
      async list() { return { data: [{ name: 'otra', id: null }], error: null } },
      async remove() { return { error: null } },
    }
    const { rutas, error } = await rutasBajoPrefijo(cliente, 'e1')
    expect(error).toBeNull()
    expect(rutas).toEqual([])
  })
})
