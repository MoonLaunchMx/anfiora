# Archivos de cotización y comprobantes — plan de implementación

> **Para quien ejecute esto:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans` para implementar tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Meta:** Subirle a un proveedor de una boda sus cotizaciones (varias, con historial) y a cada pago su comprobante, en un bucket privado con enlaces que caducan.

**Arquitectura:** Un bucket privado `event-docs` cuya **ruta decide el permiso** (`{event_id}/cotizaciones|comprobantes/...`), dos columnas JSONB (`event_suppliers.quote_files`, `supplier_payments.receipt_files`) que se modifican con **funciones RPC atómicas** para que dos personas subiendo a la vez no se pisen, y **un solo componente de lista** montado en las dos carpetas de la ficha.

**Stack:** Next.js 16 App Router · React 19 · Supabase Storage + RPC · Tailwind v4 · Vitest para lógica pura · Lucide para íconos.

**Spec:** `docs/superpowers/specs/2026-09-05-archivos-cotizacion-comprobantes-design.md`
**Mockup:** https://claude.ai/code/artifact/f9a4eb58-59d9-4f89-8fd1-8598b8245b04
**SQL (lo corre Diego):** `docs/superpowers/plans/sql/2026-09-05-archivos-event-docs.sql`

## Restricciones globales

- **Rama:** sale de `origin/main` (que ya trae el Fichero, PR #56 `a5931c2`). La rama actual `fix/accesos-pendientes` está atrás; no construir encima de ella.
- **UI en español CON acentos.** Los mensajes de commit sin acentos ni ñ.
- **Cero emojis.** Íconos de `lucide-react`.
- **Solo Tailwind.** Sin estilos en línea salvo excepción justificada.
- **CTA en teal `#48C9B0`.** Negro `#1D1E20` solo para dropdowns de filtro — aquí no aplica ninguno.
- **Móvil primero.** Blancos táctiles de 36px. Sin menús colgantes en el teléfono: hoja desde abajo.
- **Toda escritura cuenta filas.** `.select()` y cero filas = error visible. Nunca fallo mudo.
- **Ningún objeto se borra del bucket.** Quitar marca `borrado` en el JSONB.
- **Sin comentarios en el código** salvo cuando el *por qué* no sea obvio.
- **Verificar con `npm run build`, no solo `tsc`** — los guardianes del repo viven en el prebuild.
- **No correr `npm run build` con el dev server arriba.** Tira la app con un error falso de Jest worker.

Valores exactos, copiados del spec:

| Constante | Valor |
|---|---|
| Bucket | `event-docs` (privado) |
| Tope por archivo | `10 * 1024 * 1024` (10 MB) |
| Tope cotizaciones | 10 por proveedor |
| Tope comprobantes | 5 por pago |
| Tipos | `application/pdf`, `image/jpeg`, `image/png`, `image/heic`, `image/heif` |
| Vida del enlace firmado | 600 segundos |
| Módulo de cotizaciones | `proveedores` |
| Módulo de comprobantes | `pagos` |

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/types.ts` (modificar) | El tipo `ArchivoAdjunto`, las dos columnas nuevas en `EventSupplier` y `SupplierPayment`, y la baja de `external_files_url` y `has_pro_files` |
| `CLAUDE.md` (modificar) | El bloque de esquema de `event_suppliers` y `supplier_payments`, al día |
| `lib/archivos/adjuntos.ts` (crear) | **Lógica pura.** Validar, deducir MIME, armar ruta, filtrar visibles, formatear peso, redactar el mensaje de error |
| `lib/archivos/adjuntos.test.ts` (crear) | Las pruebas de lo anterior |
| `lib/archivos/bucket.ts` (crear) | **El I/O.** Subir, firmar, y las cuatro llamadas RPC |
| `app/events/[id]/proveedores/ListaDeArchivos.tsx` (crear) | El bloque de lista + zona de subida + los estados. **Un solo componente para los dos casos** |
| `app/events/[id]/proveedores/FichaDelEvento.tsx` (modificar) | Monta el bloque en Cotización y el clip por pago en Pagos |
| `app/events/[id]/proveedores/PagoModal.tsx` (modificar) | El campo Comprobante y el id explícito del pago |

`FichaDelEvento.tsx` ya tiene 978 líneas. El bloque de archivos **no se escribe adentro**: sale como componente propio desde el primer día, que es justo lo que permite usarlo en las dos carpetas sin duplicarlo.

---

## Tarea 0: el SQL (lo corre Diego, no un agente)

**Archivo:** `docs/superpowers/plans/sql/2026-09-05-archivos-event-docs.sql`

- [ ] **Paso 1: verificar el requisito**

En el editor SQL de Supabase:

```sql
select proname from pg_proc where proname in ('puede_ver', 'puede_editar');
```

Esperado: las dos filas. Si falta alguna, el cimiento del Tramo 2 no ha corrido y **este script no debe correrse todavía**.

- [ ] **Paso 2: correr el script entero de un jalón**

Es seguro correrlo **antes** de desplegar el código: las columnas nacen con default `'[]'`, el bucket vacío no le estorba a nada y las políticas nuevas aplican a un bucket que el código desplegado ni conoce. Comportamiento cero para producción.

- [ ] **Paso 3: correr las cuatro comprobaciones del pie del script**

La crítica es la primera: `public` tiene que salir en **false**. Un bucket público aquí sería exactamente lo que este trabajo existe para evitar.

- [ ] **Paso 4: avisar que ya corrió**

Las tareas 2 en adelante no se pueden probar sin esto.

---

## Tarea 1: el tipo y la lógica pura

**Archivos:**
- Modificar: `lib/types.ts`
- Crear: `lib/archivos/adjuntos.ts`
- Probar: `lib/archivos/adjuntos.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `ArchivoAdjunto`, `CARPETAS`, `MAX_BYTES`, `TOPE_COTIZACIONES`, `TOPE_COMPROBANTES`, `TIPOS_PERMITIDOS`, `visibles()`, `tipoDeArchivo()`, `extensionDe()`, `rutaDe()`, `validarArchivo()`, `pesoLegible()`, `esImagen()`.

- [ ] **Paso 1: escribir la prueba que falla**

Crear `lib/archivos/adjuntos.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  MAX_BYTES, TOPE_COTIZACIONES,
  esImagen, extensionDe, pesoLegible, rutaDe, tipoDeArchivo, validarArchivo, visibles,
} from './adjuntos'
import type { ArchivoAdjunto } from '@/lib/types'

const archivo = (parche: Partial<ArchivoAdjunto> = {}): ArchivoAdjunto => ({
  path: 'e/cotizaciones/s/1.pdf',
  nombre: 'cotizacion.pdf',
  tipo: 'application/pdf',
  bytes: 1024,
  subido: '2026-09-05T10:00:00.000Z',
  por: null,
  borrado: null,
  ...parche,
})

describe('visibles', () => {
  it('esconde los quitados y deja los demas', () => {
    const lista = [
      archivo({ path: 'a.pdf' }),
      archivo({ path: 'b.pdf', borrado: '2026-09-05T11:00:00.000Z' }),
      archivo({ path: 'c.pdf' }),
    ]
    expect(visibles(lista).map(a => a.path)).toEqual(['a.pdf', 'c.pdf'])
  })

  it('aguanta null y un arreglo vacio', () => {
    expect(visibles(null)).toEqual([])
    expect(visibles([])).toEqual([])
  })
})

describe('tipoDeArchivo', () => {
  it('respeta el tipo que trae el navegador', () => {
    expect(tipoDeArchivo('foto.jpg', 'image/jpeg')).toBe('image/jpeg')
  })

  // El iPhone entrega HEIC con file.type vacio; sin deducirlo, el bucket lo
  // rechaza por content-type y la primera foto que sube una novia rebota.
  it('deduce el tipo desde la extension cuando viene en blanco', () => {
    expect(tipoDeArchivo('IMG_4821.HEIC', '')).toBe('image/heic')
    expect(tipoDeArchivo('recibo.PDF', '')).toBe('application/pdf')
    expect(tipoDeArchivo('captura.png', '')).toBe('image/png')
  })

  it('devuelve cadena vacia cuando no reconoce la extension', () => {
    expect(tipoDeArchivo('contrato.docx', '')).toBe('')
  })
})

describe('extensionDe', () => {
  it('saca la extension en minusculas', () => {
    expect(extensionDe('IMG_4821.HEIC')).toBe('heic')
    expect(extensionDe('cotizacion final.v2.pdf')).toBe('pdf')
  })

  it('devuelve bin cuando no hay extension', () => {
    expect(extensionDe('sinpunto')).toBe('bin')
  })
})

describe('rutaDe', () => {
  it('arma la ruta con el uuid y nunca con el nombre del usuario', () => {
    const ruta = rutaDe('EV', 'cotizaciones', 'PROV', 'Cotización final ñ.pdf', 'UUID')
    expect(ruta).toBe('EV/cotizaciones/PROV/UUID.pdf')
    expect(ruta).not.toContain('Cotización')
  })

  it('arma la de comprobantes', () => {
    expect(rutaDe('EV', 'comprobantes', 'PAGO', 'transfer.jpg', 'UUID'))
      .toBe('EV/comprobantes/PAGO/UUID.jpg')
  })
})

describe('validarArchivo', () => {
  it('acepta un PDF normal', () => {
    expect(validarArchivo('cotizacion.pdf', 'application/pdf', 500_000, 0, TOPE_COTIZACIONES)).toBeNull()
  })

  it('acepta un HEIC sin tipo', () => {
    expect(validarArchivo('IMG_4821.HEIC', '', 3_400_000, 2, TOPE_COTIZACIONES)).toBeNull()
  })

  // El mensaje trae el nombre, el peso real y la salida. "Archivo invalido" no
  // le sirve a nadie.
  it('rechaza lo que pesa de mas nombrando el archivo y su peso', () => {
    const error = validarArchivo('Contrato-escaneado.pdf', 'application/pdf', 24 * 1024 * 1024, 0, TOPE_COTIZACIONES)
    expect(error).toContain('Contrato-escaneado.pdf')
    expect(error).toContain('24 MB')
    expect(error).toContain('10 MB')
  })

  it('rechaza un tipo que no es documento ni imagen', () => {
    const error = validarArchivo('lista.xlsx', 'application/vnd.ms-excel', 1000, 0, TOPE_COTIZACIONES)
    expect(error).toContain('PDF')
  })

  it('rechaza cuando ya se llego al tope', () => {
    const error = validarArchivo('otra.pdf', 'application/pdf', 1000, TOPE_COTIZACIONES, TOPE_COTIZACIONES)
    expect(error).toContain('10')
  })

  it('el tope del navegador es el mismo que el del bucket', () => {
    expect(MAX_BYTES).toBe(10 * 1024 * 1024)
  })
})

describe('pesoLegible', () => {
  it('escribe KB y MB como los lee una persona', () => {
    expect(pesoLegible(820 * 1024)).toBe('820 KB')
    expect(pesoLegible(1.2 * 1024 * 1024)).toBe('1.2 MB')
    expect(pesoLegible(500)).toBe('1 KB')
  })
})

describe('esImagen', () => {
  it('separa el glifo de documento del de imagen', () => {
    expect(esImagen('image/heic')).toBe(true)
    expect(esImagen('application/pdf')).toBe(false)
  })
})
```

- [ ] **Paso 2: correr la prueba y verla fallar**

```bash
npx vitest run lib/archivos/adjuntos.test.ts
```

Esperado: falla porque el módulo no existe.

- [ ] **Paso 3: agregar el tipo a `lib/types.ts`**

Junto al bloque `FINANZAS — SUPPLIER PAYMENTS`:

```ts
export type ArchivoAdjunto = {
  path: string
  nombre: string
  tipo: string
  bytes: number
  subido: string
  por: string | null
  borrado: string | null
}
```

Y agregar el campo a los dos tipos existentes:

- en `EventSupplier`, junto a `external_files_url`: `quote_files: ArchivoAdjunto[]`
- en `SupplierPayment`, junto a `reference`: `receipt_files: ArchivoAdjunto[]`

`EventSupplierUpdate` y `SupplierPaymentUpdate` los heredan solos por ser `Partial<Omit<...>>`; no hay que tocarlos. **Verificar con `npx tsc --noEmit` que agregar los campos no rompa ningún objeto literal existente** — si algún `insert` construye el tipo completo a mano, hay que darle `[]`.

- [ ] **Paso 4: escribir `lib/archivos/adjuntos.ts`**

```ts
import type { ArchivoAdjunto } from '@/lib/types'

export const MAX_BYTES = 10 * 1024 * 1024
export const TOPE_COTIZACIONES = 10
export const TOPE_COMPROBANTES = 5

export const CARPETAS = ['cotizaciones', 'comprobantes'] as const
export type Carpeta = typeof CARPETAS[number]

export const TIPOS_PERMITIDOS = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif',
] as const

const POR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
}

export function visibles(lista: ArchivoAdjunto[] | null | undefined): ArchivoAdjunto[] {
  return (lista ?? []).filter(a => !a.borrado)
}

export function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf('.')
  if (punto < 0 || punto === nombre.length - 1) return 'bin'
  return nombre.slice(punto + 1).toLowerCase()
}

// El navegador entrega file.type vacio para un HEIC mas seguido de lo que
// parece, y el bucket rechaza por content-type: hay que deducirlo o no sube.
export function tipoDeArchivo(nombre: string, tipoDelNavegador: string): string {
  if (tipoDelNavegador) return tipoDelNavegador
  return POR_EXTENSION[extensionDe(nombre)] ?? ''
}

export function esImagen(tipo: string): boolean {
  return tipo.startsWith('image/')
}

export function pesoLegible(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function rutaDe(
  eventId: string, carpeta: Carpeta, dueno: string, nombre: string, uuid: string,
): string {
  return `${eventId}/${carpeta}/${dueno}/${uuid}.${extensionDe(nombre)}`
}

export function validarArchivo(
  nombre: string, tipoDelNavegador: string, bytes: number, yaHay: number, tope: number,
): string | null {
  if (yaHay >= tope) {
    return `Ya tienes ${tope} archivos aquí. Quita alguno antes de subir otro.`
  }

  const tipo = tipoDeArchivo(nombre, tipoDelNavegador)
  if (!TIPOS_PERMITIDOS.includes(tipo as typeof TIPOS_PERMITIDOS[number])) {
    return `${nombre} no se puede guardar. Solo entran PDF y fotos (JPG, PNG o HEIC).`
  }

  if (bytes > MAX_BYTES) {
    return `${nombre} pesa ${pesoLegible(bytes)}. El tope son 10 MB: vuelve a escanearlo en calidad media o mándalo partido en dos.`
  }

  return null
}
```

- [ ] **Paso 5: correr las pruebas**

```bash
npx vitest run lib/archivos/adjuntos.test.ts
npx tsc --noEmit
```

Esperado: todas en verde y `tsc` limpio.

- [ ] **Paso 6: quitar las dos columnas muertas del tipo**

En el mismo `EventSupplier`, **borrar** estas dos líneas:

```ts
  external_files_url: string | null
  has_pro_files: boolean
```

Eran la primera idea de "archivos del proveedor" (commit `666a9d1`, 5-may-2026) y nunca se conectaron a nada: verificado en las 24 ramas locales y remotas, solo existen en esta declaración y en el bloque de esquema de `CLAUDE.md`. Las reemplaza `quote_files`.

Quitarlas también del bloque `event_suppliers` de `CLAUDE.md` (líneas 217-218) y **agregar ahí `quote_files JSONB`** y, en `supplier_payments`, `receipt_files JSONB`.

**Correr `npx tsc --noEmit` inmediatamente después.** Si algo las exigía, aquí truena — es la comprobación real, más confiable que cualquier grep.

- [ ] **Paso 7: commit**

```bash
git add lib/types.ts lib/archivos/adjuntos.ts lib/archivos/adjuntos.test.ts CLAUDE.md
git commit -m "feat(archivos): tipo ArchivoAdjunto, logica pura y baja de dos columnas muertas"
```

**El `DROP COLUMN` en Supabase va después de que esto llegue a `main` y se despliegue.** Para quitar una columna el orden es código primero, base después — al revés que para agregarla. El SQL está en `docs/superpowers/plans/sql/2026-09-05-limpiar-columnas-muertas.sql` y su paso 1 es de solo lectura.

---

## Tarea 2: el I/O contra el bucket

**Archivos:**
- Crear: `lib/archivos/bucket.ts`

**Interfaces:**
- Consume: `rutaDe`, `tipoDeArchivo`, `validarArchivo` de la Tarea 1; `supabase` de `@/lib/supabase`.
- Produce: `subirArchivo()`, `abrirArchivo()`, `quitarArchivo()`, `type ResultadoSubida`.

Sin pruebas de Vitest: es I/O contra Twilio-Supabase y se verifica manual, local → preview → main, como manda `CLAUDE.md`.

- [ ] **Paso 1: escribir `lib/archivos/bucket.ts`**

```ts
import { supabase } from '@/lib/supabase'
import type { ArchivoAdjunto } from '@/lib/types'
import { type Carpeta, rutaDe, tipoDeArchivo } from './adjuntos'

const BUCKET = 'event-docs'
const VIDA_DEL_ENLACE = 600

export type ResultadoSubida =
  | { lista: ArchivoAdjunto[]; error?: undefined }
  | { lista?: undefined; error: string }

const RPC_ADJUNTAR: Record<Carpeta, string> = {
  cotizaciones: 'adjuntar_cotizacion',
  comprobantes: 'adjuntar_comprobante',
}

const RPC_QUITAR: Record<Carpeta, string> = {
  cotizaciones: 'quitar_cotizacion',
  comprobantes: 'quitar_comprobante',
}

const ARG_ID: Record<Carpeta, string> = {
  cotizaciones: 'es_id',
  comprobantes: 'pago_id',
}

export async function subirArchivo(
  eventId: string, carpeta: Carpeta, dueno: string, file: File,
): Promise<ResultadoSubida> {
  const tipo = tipoDeArchivo(file.name, file.type)
  const ruta = rutaDe(eventId, carpeta, dueno, file.name, crypto.randomUUID())

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, file, { upsert: false, contentType: tipo })

  if (errorSubida) {
    console.error('Error subiendo archivo:', errorSubida.message, errorSubida)
    return { error: 'No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo.' }
  }

  const { data: sesion } = await supabase.auth.getUser()

  const adjunto: ArchivoAdjunto = {
    path: ruta,
    nombre: file.name,
    tipo,
    bytes: file.size,
    subido: new Date().toISOString(),
    por: sesion.user?.id ?? null,
    borrado: null,
  }

  const { data, error } = await supabase.rpc(RPC_ADJUNTAR[carpeta], {
    [ARG_ID[carpeta]]: dueno,
    archivo: adjunto,
  })

  // El archivo ya subio pero la lista no lo registro: queda huerfano en el
  // bucket. NO se borra -- unos KB invisibles pesan menos que la posibilidad de
  // destruir un contrato con un borrado automatico mal disparado.
  if (error) {
    console.error('Error registrando archivo:', error.message, error)
    if (error.message.includes('tope_')) {
      return { error: 'Ya llegaste al tope de archivos aquí. Quita alguno antes de subir otro.' }
    }
    return { error: 'No se guardó el archivo. Intenta de nuevo.' }
  }

  if (!data) {
    return { error: 'No se guardó el archivo. Revisa que sigas teniendo permiso en esta boda.' }
  }

  return { lista: data as ArchivoAdjunto[] }
}

export async function quitarArchivo(
  carpeta: Carpeta, dueno: string, path: string,
): Promise<ResultadoSubida> {
  const { data, error } = await supabase.rpc(RPC_QUITAR[carpeta], {
    [ARG_ID[carpeta]]: dueno,
    ruta: path,
  })

  if (error) {
    console.error('Error quitando archivo:', error.message, error)
    return { error: 'No se pudo quitar el archivo. Intenta de nuevo.' }
  }

  if (!data) {
    return { error: 'No se quitó el archivo. Revisa que sigas teniendo permiso en esta boda.' }
  }

  return { lista: data as ArchivoAdjunto[] }
}

// La URL se firma al momento del clic y vive diez minutos. Nunca se guarda.
export async function abrirArchivo(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, VIDA_DEL_ENLACE)

  if (error || !data) {
    console.error('Error firmando archivo:', error?.message, error)
    return null
  }

  return data.signedUrl
}
```

- [ ] **Paso 2: verificar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Paso 3: commit**

```bash
git add lib/archivos/bucket.ts
git commit -m "feat(archivos): subir, firmar y quitar contra el bucket privado"
```

---

## Tarea 3: el componente de lista

**Archivos:**
- Crear: `app/events/[id]/proveedores/ListaDeArchivos.tsx`

**Interfaces:**
- Consume: todo lo de las Tareas 1 y 2.
- Produce: el componente por defecto `ListaDeArchivos` con estas props exactas:

```ts
type Props = {
  eventId: string
  carpeta: Carpeta
  dueno: string                  // event_supplier_id o payment_id
  archivos: ArchivoAdjunto[]
  tope: number
  puedeEditar: boolean
  textoVacio: string
  onCambio: (lista: ArchivoAdjunto[]) => void
}
```

- [ ] **Paso 1: escribir el componente**

```tsx
'use client'

import { useRef, useState } from 'react'
import { FileText, ImageIcon, Plus, SquareArrowOutUpRight, Trash2, Upload, X } from 'lucide-react'
import type { ArchivoAdjunto } from '@/lib/types'
import { useConfirm } from '@/app/components/ui/ConfirmModal'
import {
  type Carpeta, esImagen, pesoLegible, validarArchivo, visibles,
} from '@/lib/archivos/adjuntos'
import { abrirArchivo, quitarArchivo, subirArchivo } from '@/lib/archivos/bucket'

const ACEPTA = 'application/pdf,image/jpeg,image/png,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.heic,.heif'

type Props = {
  eventId: string
  carpeta: Carpeta
  dueno: string
  archivos: ArchivoAdjunto[]
  tope: number
  puedeEditar: boolean
  textoVacio: string
  onCambio: (lista: ArchivoAdjunto[]) => void
}

export default function ListaDeArchivos({
  eventId, carpeta, dueno, archivos, tope, puedeEditar, textoVacio, onCambio,
}: Props) {
  const askConfirm = useConfirm()
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState('')
  const [error, setError] = useState('')

  const lista = visibles(archivos)

  const elegir = async (file: File | undefined) => {
    if (!file) return
    setError('')

    const problema = validarArchivo(file.name, file.type, file.size, lista.length, tope)
    if (problema) { setError(problema); return }

    setSubiendo(file.name)
    const res = await subirArchivo(eventId, carpeta, dueno, file)
    setSubiendo('')

    if (res.error) setError(res.error)
    else if (res.lista) onCambio(res.lista)
  }

  const abrir = async (archivo: ArchivoAdjunto) => {
    const url = await abrirArchivo(archivo.path)
    if (!url) { setError('No se pudo abrir el archivo. Intenta de nuevo.'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const quitar = async (archivo: ArchivoAdjunto) => {
    const ok = await askConfirm({
      title: 'Quitar este archivo',
      message: `${archivo.nombre} deja de verse aquí. El archivo se queda guardado y se puede recuperar.`,
      confirmLabel: 'Quitar',
      tone: 'danger',
    })
    if (!ok) return

    setError('')
    const res = await quitarArchivo(carpeta, dueno, archivo.path)
    if (res.error) setError(res.error)
    else if (res.lista) onCambio(res.lista)
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={entrada}
        type="file"
        accept={ACEPTA}
        className="hidden"
        onChange={e => { elegir(e.target.files?.[0]); e.target.value = '' }}
      />

      {lista.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {lista.map((archivo, i) => (
            <li
              key={archivo.path}
              className={`flex items-center gap-3 rounded-xl border bg-[#fafafa] px-3 py-2 ${
                i === 0 ? 'border-[#a8e0d4] bg-white' : 'border-[#e8e8e8]'
              }`}
            >
              <span className={`flex h-9 w-8 shrink-0 items-center justify-center rounded border bg-white ${
                esImagen(archivo.tipo) ? 'border-[#c3d2e6] text-[#5b7fb5]' : 'border-[#e6c4c1] text-[#c4483f]'
              }`}>
                {esImagen(archivo.tipo) ? <ImageIcon size={15} /> : <FileText size={15} />}
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-semibold text-[#1D1E20]">{archivo.nombre}</span>
                <span className="text-[11px] tabular-nums text-[#999]">
                  {new Date(archivo.subido).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  {' · '}{pesoLegible(archivo.bytes)}
                </span>
              </span>

              {carpeta === 'cotizaciones' && i === 0 && lista.length > 1 && (
                <span className="shrink-0 rounded-full bg-[#e4f7f2] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#2b8b78]">
                  Vigente
                </span>
              )}

              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={() => abrir(archivo)}
                  aria-label={`Abrir ${archivo.nombre}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#999] transition hover:bg-white hover:text-[#1D1E20]"
                >
                  <SquareArrowOutUpRight size={14} />
                </button>
                {puedeEditar && (
                  <button
                    onClick={() => quitar(archivo)}
                    aria-label={`Quitar ${archivo.nombre}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[#999] transition hover:bg-white hover:text-[#cc3333]"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {subiendo && (
        <div className="flex items-center gap-3 rounded-xl border border-[#e8e8e8] bg-white px-3 py-2">
          <span className="h-9 w-8 shrink-0 animate-pulse rounded bg-[#f0f0f0]" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate text-[13px] font-semibold text-[#1D1E20]">{subiendo}</span>
            <span className="h-1 overflow-hidden rounded-full bg-[#f0f0f0]">
              <span className="block h-full w-2/3 animate-pulse rounded-full bg-[#48C9B0]" />
            </span>
          </span>
        </div>
      )}

      {puedeEditar && lista.length === 0 && !subiendo && (
        <button
          onClick={() => entrada.current?.click()}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-[#e0e0e0] bg-[#fcfcfc] px-4 py-5 text-center transition hover:border-[#48C9B0]"
        >
          <Upload size={20} className="text-[#bbb]" />
          <span className="text-[13px] font-bold text-[#1D1E20]">{textoVacio}</span>
          <span className="max-w-[38ch] text-[11.5px] text-[#999]">
            PDF o foto, hasta 10 MB. Se guarda privado: solo lo abre quien tiene acceso a esta boda.
          </span>
        </button>
      )}

      {puedeEditar && lista.length > 0 && !subiendo && (
        <button
          onClick={() => entrada.current?.click()}
          className="flex items-center gap-1 self-start text-[11px] font-bold text-[#48C9B0] transition hover:text-[#3aa896]"
        >
          <Plus size={11} /> Agregar otro
        </button>
      )}

      {!puedeEditar && lista.length === 0 && (
        <p className="text-xs text-[#999]">Todavía no hay archivos aquí.</p>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-[#ffc0c0] bg-[#fff0f0] px-3 py-2 text-xs text-[#cc3333]">
          <X size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Paso 2: verificar la firma de `useConfirm`**

Leer `app/components/ui/ConfirmModal.tsx` y confirmar que `askConfirm` acepta `{ title, message, confirmLabel, tone }` y que `tone` admite `'danger'`. Si el nombre del tono es otro, usar el que exista — **no inventar uno nuevo ni agregarlo**.

- [ ] **Paso 3: compilar**

```bash
npx tsc --noEmit
```

- [ ] **Paso 4: commit**

```bash
git add "app/events/[id]/proveedores/ListaDeArchivos.tsx"
git commit -m "feat(archivos): componente de lista con subida, apertura firmada y quitar"
```

---

## Tarea 4: la carpeta Cotización

**Archivos:**
- Modificar: `app/events/[id]/proveedores/FichaDelEvento.tsx`

**Interfaces:**
- Consume: `ListaDeArchivos` de la Tarea 3, `TOPE_COTIZACIONES` de la Tarea 1.
- Produce: nada nuevo hacia afuera.

- [ ] **Paso 1: montar el bloque**

En el bloque `{carpetas[carpeta] === 'Cotización' && (...)}`, rama de **solo lectura** (la que hoy termina con el `<Bloque titulo="Partida del presupuesto">`), agregar un tercer `<Bloque>` después de la partida:

```tsx
<Bloque titulo={`Cotizaciones guardadas${cotizaciones.length ? ` · ${cotizaciones.length}` : ''}`}>
  <ListaDeArchivos
    eventId={item.event_id}
    carpeta="cotizaciones"
    dueno={item.id}
    archivos={item.quote_files}
    tope={TOPE_COTIZACIONES}
    puedeEditar={permisoFicha.editar}
    textoVacio="Sube la cotización"
    onCambio={lista => onSaved({ ...item, quote_files: lista })}
  />
</Bloque>
```

Y arriba, junto a los otros `useMemo`:

```tsx
const cotizaciones = useMemo(() => visibles(item.quote_files), [item.quote_files])
```

Importar `ListaDeArchivos`, `TOPE_COTIZACIONES` y `visibles`.

`onSaved` ya es la prop con la que la ficha avisa hacia arriba que el `item` cambió — es exactamente lo que hay que llamar para que la lista de proveedores no se quede con datos viejos.

- [ ] **Paso 2: sumar el conteo a la pestaña**

En el `map` de `carpetas`, junto al conteo de Pagos que ya existe:

```tsx
{nombre === 'Cotización' && cotizaciones.length > 0 && (
  <span className={`rounded-full px-1.5 text-[10px] font-bold ${i === carpeta ? 'bg-[#f4f4f4] text-[#666]' : 'bg-white/70 text-[#777]'}`}>
    {cotizaciones.length}
  </span>
)}
```

- [ ] **Paso 3: verificar en local**

```bash
npm run dev
```

Con el dev server arriba, en `/events/<id>/proveedores`, con un proveedor en estado **cotizado** o **contratado** (los únicos que muestran la carpeta Cotización, según `carpetasDe`):

1. Subir un PDF. Aparece en la lista con su peso.
2. Abrirlo: se abre en pestaña nueva. **Copiar esa URL, cerrar sesión y pegarla**: debe seguir abriendo dentro de los 10 minutos (la firma es la credencial) y **dar error pasados los 10 minutos**.
3. Pegar en el navegador la URL pública equivalente (`.../object/public/event-docs/<ruta>`): **tiene que fallar**. Si abre, el bucket quedó público y hay que volver a correr el paso 1 del SQL.
4. Subir una segunda cotización: la nueva queda arriba y con el distintivo **Vigente**.
5. Quitar una: desaparece de la lista. Recargar y comprobar que sigue fuera.

- [ ] **Paso 4: commit**

```bash
git add "app/events/[id]/proveedores/FichaDelEvento.tsx"
git commit -m "feat(proveedores): la carpeta Cotizacion guarda los PDF y fotos del proveedor"
```

---

## Tarea 5: la carpeta Pagos

**Archivos:**
- Modificar: `app/events/[id]/proveedores/FichaDelEvento.tsx`

**Interfaces:**
- Consume: `ListaDeArchivos`, `TOPE_COMPROBANTES`, `visibles`.
- Produce: nada nuevo hacia afuera.

- [ ] **Paso 1: estado para el renglón desplegado**

```tsx
const [pagoAbierto, setPagoAbierto] = useState<string | null>(null)
```

- [ ] **Paso 2: el clip en el renglón del pago**

Dentro del `<li>` de cada pago, entre la descripción y el monto, agregar:

```tsx
<button
  onClick={() => setPagoAbierto(actual => (actual === p.id ? null : p.id))}
  aria-expanded={pagoAbierto === p.id}
  aria-label={`Comprobantes del pago del ${p.payment_date}`}
  className={`flex shrink-0 items-center gap-1 rounded-full border bg-white px-2 py-1 text-[10.5px] font-bold transition ${
    visibles(p.receipt_files).length
      ? 'border-[#e0e0e0] text-[#666] hover:border-[#48C9B0] hover:text-[#3aa896]'
      : 'border-dashed border-[#e0e0e0] text-[#bbb] hover:border-[#48C9B0] hover:text-[#3aa896]'
  }`}
>
  <Paperclip size={12} />
  {visibles(p.receipt_files).length || 'Sin comprobante'}
</button>
```

Importar `Paperclip` de `lucide-react`.

**El `<li>` tiene que dejar de ser `flex` en su raíz** para poder crecer hacia abajo: envolver lo que hoy es su contenido en un `<div className="flex items-center justify-between gap-3 px-3 py-2">` y dejar el `<li>` como `className="group overflow-hidden rounded-lg border border-[#e8e8e8] bg-[#fafafa]"`.

- [ ] **Paso 3: la tira de comprobantes**

Como segundo hijo del `<li>`:

```tsx
{pagoAbierto === p.id && (
  <div className="border-t border-dashed border-[#e0e0e0] bg-white px-3 py-2.5">
    <ListaDeArchivos
      eventId={item.event_id}
      carpeta="comprobantes"
      dueno={p.id}
      archivos={p.receipt_files}
      tope={TOPE_COMPROBANTES}
      puedeEditar={permisoPagos.editar}
      textoVacio="Sube el comprobante de este pago"
      onCambio={lista => setPagos(actuales =>
        actuales.map(otro => (otro.id === p.id ? { ...otro, receipt_files: lista } : otro))
      )}
    />
  </div>
)}
```

El permiso es **`permisoPagos`**, no `permisoFicha`: el comprobante es dinero y vive en su propio módulo.

- [ ] **Paso 4: verificar en local**

1. Un pago sin comprobante enseña el clip punteado con "Sin comprobante".
2. Subirle una foto: el clip pasa a sólido con `1`.
3. Un segundo pago no se ve afectado — el archivo quedó pegado al pago correcto.
4. Con un colaborador que tenga **Proveedores en editar y Pagos en ver**: ve las cotizaciones con botón de subir, y los comprobantes solo para abrir. Ese es el corte que este diseño existe para probar.

- [ ] **Paso 5: commit**

```bash
git add "app/events/[id]/proveedores/FichaDelEvento.tsx"
git commit -m "feat(pagos): cada pago guarda su comprobante en la ficha del proveedor"
```

---

## Tarea 6: el comprobante al registrar el pago

**Archivos:**
- Modificar: `app/events/[id]/proveedores/PagoModal.tsx`

**Interfaces:**
- Consume: `ListaDeArchivos`, `TOPE_COMPROBANTES`.
- Produce: nada nuevo hacia afuera. La prop `onGuardado` sigue igual.

- [ ] **Paso 1: el id explícito**

Hoy el `insert` deja que Postgres invente el id, así que al abrir el modal para un pago nuevo todavía no hay a dónde mandar el archivo. Se genera antes:

```tsx
const [idNuevo] = useState(() => crypto.randomUUID())
const idDelPago = pago?.id ?? idNuevo
```

Y en el `insert`, mandarlo:

```tsx
: await supabase.from('supplier_payments')
    .insert({ id: idNuevo, event_supplier_id: eventSupplierId, ...campos })
    .select().single()
```

`useState` con función inicial, **no `crypto.randomUUID()` a secas en el cuerpo**: si no, cada re-render genera un id distinto y el archivo se sube a una carpeta que el pago nunca va a tener.

- [ ] **Paso 2: guardar los adjuntos en estado local**

```tsx
const [comprobantes, setComprobantes] = useState(pago?.receipt_files ?? [])
```

Y al guardar con éxito, devolver el pago con su lista:

```tsx
if (data) onGuardado({ ...(data as SupplierPayment), receipt_files: comprobantes })
```

- [ ] **Paso 3: el campo en el cuerpo del modal**

Después del campo de Referencia:

```tsx
<div>
  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">
    Comprobante <span className="font-normal normal-case tracking-normal text-[#bbb]">(opcional)</span>
  </label>
  <ListaDeArchivos
    eventId={eventId}
    carpeta="comprobantes"
    dueno={idDelPago}
    archivos={comprobantes}
    tope={TOPE_COMPROBANTES}
    puedeEditar
    textoVacio="Sube el comprobante"
    onCambio={setComprobantes}
  />
</div>
```

`PagoModal` **no recibe hoy el `eventId`**: hay que agregarlo a `Props` y pasárselo desde los dos lugares que lo montan en `FichaDelEvento.tsx` (`setCobrando` y `setPagoEnEdicion`), con `item.event_id`.

- [ ] **Paso 4: verificar en local**

1. Registrar un pago **con** comprobante en un solo golpe: al cerrar, el renglón nuevo ya trae el clip en `1`.
2. Registrar uno **sin** comprobante: se guarda igual, con clip punteado.
3. Subir el archivo y **cancelar** sin guardar el pago: el archivo queda huérfano en el bucket y **no aparece en ningún lado**. Es el intercambio aceptado en el spec §3.2 — bytes de sobra antes que un renglón que apunte a la nada.

- [ ] **Paso 5: commit**

```bash
git add "app/events/[id]/proveedores/PagoModal.tsx" "app/events/[id]/proveedores/FichaDelEvento.tsx"
git commit -m "feat(pagos): el comprobante entra en el mismo golpe que el pago"
```

---

## Tarea 7: avisar antes de borrar un pago con comprobantes

**Archivos:**
- Modificar: `app/events/[id]/proveedores/FichaDelEvento.tsx`

- [ ] **Paso 1: cambiar el mensaje de `borrarPago`**

En la función `borrarPago`, el `askConfirm` de hoy no menciona los archivos. Agregar antes de armarlo:

```tsx
const cuantos = visibles(p.receipt_files).length
```

Y sumarle al `message` existente, cuando `cuantos > 0`:

```
` Este pago tiene ${cuantos} comprobante${cuantos > 1 ? 's' : ''}: se quedan guardados, pero sin este pago ya no habrá dónde verlos.`
```

Es la única pérdida real que deja este diseño y **tiene que decirse antes**, no después.

- [ ] **Paso 2: verificar en local**

Borrar un pago con comprobante: el aviso los menciona. Borrar uno sin comprobante: el aviso es el de siempre.

- [ ] **Paso 3: commit**

```bash
git add "app/events/[id]/proveedores/FichaDelEvento.tsx"
git commit -m "fix(pagos): avisar que los comprobantes se quedan sin dueño al borrar el pago"
```

---

## Tarea 8: verificación completa

- [ ] **Paso 1: matar el dev server**

`npm run build` con el dev server arriba tira la app con un error falso de Jest worker.

- [ ] **Paso 2: los tres guardianes**

```bash
npx tsc --noEmit
npm test
npm run build
```

Los tres en verde. `npm run build` es el que importa: los guardianes reales del repo viven en el prebuild y `tsc` solo no los corre.

- [ ] **Paso 3: la prueba que no puede fallar**

Con el build en verde, y **antes de pedir el merge**, comprobar una vez más en el navegador que la URL pública del bucket devuelve error:

```
https://<proyecto>.supabase.co/storage/v1/object/public/event-docs/<cualquier-ruta-real>
```

Si eso abre un contrato, nada más de este trabajo importa.

- [ ] **Paso 4: abrir el PR**

Contra `main`, con el spec y el mockup enlazados en la descripción, y una línea diciendo que el SQL ya corrió en producción.

---

## Lo que cambió durante la ejecución

Tres cosas que el plan no traía y que quedaron en el código. Anotadas aquí para que el plan no mienta:

1. **El visor** (`VisorDeArchivo.tsx`, Tarea 3b). El plan abría el archivo en pestaña nueva; Diego pidió verlo dentro de la app. Está en el §5.4 del spec, con la advertencia del PDF en Safari de iPhone.
2. **`visibles()` ordena por fecha descendente.** El plan no lo pedía y el bug salió al probar: Postgres agrega al final del arreglo, así que la carpeta marcaba como vigente la cotización **más vieja**. Dos pruebas nuevas.
3. **La baja de las dos columnas muertas** entró en la Tarea 1 (paso 6), no como tanda aparte. El `DROP COLUMN` en Supabase sigue pendiente y va **después** de que esto llegue a `main`.

---

## Autorrevisión del plan

**Cobertura del spec:**

| Sección del spec | Tarea |
|---|---|
| §2.1 comprobante por pago | 5, 6 |
| §2.2 la más reciente manda | 3 (distintivo Vigente), 4 |
| §3.1 agregar atómico | 0 (RPC), 2 |
| §3.2 nunca se borra el objeto | 0 (sin policy de DELETE), 2 (sin compensación destructiva), 3 |
| §3.3 cero filas es error | 2 |
| §3.4 firmar al clic | 2, 4 (paso 3 de verificación) |
| §4.1 bucket y rutas | 0, 1 (`rutaDe`) |
| §4.2 columnas y tipo | 0, 1 |
| §4.3 políticas | 0 |
| §4.4 topes y trampa del HEIC | 0, 1, 3 |
| §5.1 carpeta Cotización | 4 |
| §5.2 carpeta Pagos | 5 |
| §5.3 un solo golpe | 6 |
| §5.4 teléfono | 3 — el `<input type="file">` con `accept` da las tres puertas nativas de iOS y Android sin hoja propia. **Si en el iPhone real no las ofrece, ahí sí se construye la hoja**; se verifica en la Tarea 5 con el túnel de `probar-en-iphone-tunel-cloudflared` |
| §5.5 permisos | 4 (`permisoFicha`), 5 y 6 (`permisoPagos`) |
| §5.6 borrar pago con comprobantes | 7 |

**Nombres, revisados de punta a punta:** `visibles`, `rutaDe`, `validarArchivo`, `tipoDeArchivo`, `extensionDe`, `pesoLegible`, `esImagen`, `subirArchivo`, `quitarArchivo`, `abrirArchivo`, `ListaDeArchivos`, `TOPE_COTIZACIONES`, `TOPE_COMPROBANTES`, `MAX_BYTES` — usados con la misma grafía en las ocho tareas. Los argumentos de las RPC (`es_id`, `pago_id`, `archivo`, `ruta`) coinciden exactamente con las firmas del SQL de la Tarea 0.

**Una decisión que el spec dejaba abierta y aquí se cierra:** *quitar* un archivo pide nivel **`editar`**, no `borrar`. Es una acción reversible —el objeto sobrevive— y quien puede reescribir el monto contratado con nivel `editar` no puede quedarse atorado sin poder corregir un PDF que subió por error. Las políticas del bucket y las RPC lo reflejan: no hay ninguna comprobación de `puede_borrar` en este feature.
