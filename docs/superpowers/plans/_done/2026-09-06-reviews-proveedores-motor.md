# Motor de reviews de proveedores — Plan 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la reseña única de `event_suppliers` por las tres reviews del planner (contratación, descarte, post-evento) sobre una tabla propia, con dos scores que nunca se promedian entre sí.

**Architecture:** Toda la lógica sin I/O vive en `lib/reviews/` con pruebas de Vitest: el vocabulario de ejes y anclas, las reglas de validación por tipo de review, y el cálculo de los scores. La UI son tres modales que comparten un primitivo de escala 1–5 y siguen el patrón de `PagoModal.tsx`. La persistencia es una tabla nueva `supplier_reviews` con RLS por `user_id`, y una migración única convierte las 3 filas históricas de la planner real antes de borrar las columnas viejas.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (browser client), Vitest para lógica pura, Lucide para iconos.

**Spec:** `docs/superpowers/specs/2026-09-06-reviews-proveedores-design.md`

## Global Constraints

- **Idioma de la UI:** español **con acentos**. Los mensajes de commit van **sin acentos ni ñ**.
- **Sentence case en todo. Sin emoji.** Iconos solo de Lucide.
- **Escalas = 5 botones numerados**, nunca estrellas. Las estrellas producen un mar de cincos.
- **Solo Tailwind.** Sin inline styles salvo excepción justificada.
- **Botones CTA en teal `#48C9B0`.** El negro `#1D1E20` es exclusivo de dropdowns de filtro — **no usarlo** para los botones seleccionados de la escala; usar `bg-[var(--text)]` o el token equivalente.
- **Mobile first:** cards en móvil, tabla en escritorio. Los 5 botones de la escala ocupan el ancho completo en móvil.
- **Sin comentarios** en el código salvo cuando el porqué es no obvio.
- **Los valores de enum viven en `lib/types.ts`**, nunca como `CHECK` en la base. Un CHECK fue lo que dejó roto el default de `status`.
- **Permisos:** toda función que escribe corta con `usePermiso('proveedores').editar` **dentro de la función**, no solo en el JSX. Con nivel ver, la ficha abre igual, sin botones.
- **Nunca correr SQL en Supabase antes de que el código esté en `origin/main`.**
- **Rama:** `feat/rolodex-alta` en el worktree `C:\Users\diego\Documents\anfiora-alta`. Nunca `git add -A`: agregar archivo por archivo.
- **Verificar con `npm run build`, no solo `tsc`** — los guardianes reales viven en el prebuild. No buildear con el dev server arriba.

---

### Task 1: Vocabulario de ejes, contextos y anclas

**Files:**
- Create: `lib/reviews/ejes.ts`
- Test: `lib/reviews/ejes.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `EJES` (readonly tuple), `Eje`, `ContextoAnclas`, `ANCLAS: Record<ContextoAnclas, Partial<Record<Eje, string[]>>>`, `NOMBRE_EJE: Record<Eje, string>`, `DESCRIPCION_EJE_PROPUESTA: Partial<Record<Eje, string>>`, `anclasDe(contexto, eje): string[]`, `EJES_PROPUESTA: Eje[]`, `EJES_DESEMPENO: Eje[]`, `ANCLAS_RECONTRATACION: string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/reviews/ejes.test.ts
import { describe, it, expect } from 'vitest'
import {
  EJES, EJES_PROPUESTA, EJES_DESEMPENO, ANCLAS,
  anclasDe, NOMBRE_EJE, ANCLAS_RECONTRATACION,
} from './ejes'

describe('los cinco ejes', () => {
  it('son cinco y siempre en el mismo orden', () => {
    expect(EJES).toEqual([
      'precio_valor', 'calidad', 'comunicacion', 'servicio_trato', 'manejo_imprevistos',
    ])
  })

  it('la propuesta solo observa tres', () => {
    expect(EJES_PROPUESTA).toEqual(['precio_valor', 'calidad', 'comunicacion'])
  })

  it('el desempeno observa los cinco, en el mismo orden', () => {
    expect(EJES_DESEMPENO).toEqual([...EJES])
  })

  it('todos los ejes tienen nombre visible', () => {
    for (const eje of EJES) {
      expect(NOMBRE_EJE[eje]).toBeTruthy()
    }
  })
})

describe('anclasDe', () => {
  it('cada eje observable trae exactamente cinco anclas', () => {
    for (const eje of EJES_PROPUESTA) {
      expect(anclasDe('propuesta', eje)).toHaveLength(5)
    }
    for (const eje of EJES_DESEMPENO) {
      expect(anclasDe('desempeno', eje)).toHaveLength(5)
    }
  })

  it('ningun ancla viene vacia', () => {
    for (const eje of EJES_DESEMPENO) {
      for (const texto of anclasDe('desempeno', eje)) {
        expect(texto.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('el ancla 1 de comunicacion cambia entre contextos', () => {
    expect(anclasDe('propuesta', 'comunicacion')[0]).toBe('Nunca respondió')
    expect(anclasDe('desempeno', 'comunicacion')[0]).toBe('Imposible localizarlo')
  })

  it('un eje que no aplica al contexto devuelve lista vacia', () => {
    expect(anclasDe('propuesta', 'servicio_trato')).toEqual([])
    expect(anclasDe('propuesta', 'manejo_imprevistos')).toEqual([])
  })

  it('recontratacion tiene sus cinco anclas', () => {
    expect(ANCLAS_RECONTRATACION).toHaveLength(5)
    expect(ANCLAS_RECONTRATACION[0]).toBe('No, rotundamente')
    expect(ANCLAS_RECONTRATACION[4]).toBe('Definitivamente sí, es mi primera opción')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/reviews/ejes.test.ts`
Expected: FAIL, no encuentra el módulo `./ejes`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/reviews/ejes.ts
export const EJES = [
  'precio_valor',
  'calidad',
  'comunicacion',
  'servicio_trato',
  'manejo_imprevistos',
] as const

export type Eje = typeof EJES[number]

export type ContextoAnclas = 'propuesta' | 'desempeno'

export const EJES_PROPUESTA: Eje[] = ['precio_valor', 'calidad', 'comunicacion']
export const EJES_DESEMPENO: Eje[] = [...EJES]

export const NOMBRE_EJE: Record<Eje, string> = {
  precio_valor:       'Precio y valor',
  calidad:            'Calidad',
  comunicacion:       'Comunicación',
  servicio_trato:     'Servicio y trato',
  manejo_imprevistos: 'Manejo de imprevistos',
}

export const DESCRIPCION_EJE_PROPUESTA: Partial<Record<Eje, string>> = {
  precio_valor: 'Qué tan razonable fue lo que cotizó frente a lo que ofrecía',
  calidad:      'Nivel del portafolio y de la propuesta presentada',
  comunicacion: 'Durante la cotización',
}

export const ANCLAS: Record<ContextoAnclas, Partial<Record<Eje, string[]>>> = {
  propuesta: {
    precio_valor: [
      'Fuera de toda proporción',
      'Muy por encima del mercado',
      'En precio de mercado',
      'Caro, pero se justifica',
      'Ofrece más de lo que cobra',
    ],
    calidad: [
      'Portafolio pobre o inconsistente',
      'Cumple lo mínimo, nada memorable',
      'Sólido, sin diferenciador',
      'Trabajo notable, se nota el oficio',
      'Referente en su categoría',
    ],
    comunicacion: [
      'Nunca respondió',
      'Tuve que perseguirlo',
      'Respondía lento o incompleto',
      'Contestaba el mismo día',
      'Proactivo, se adelantaba a mis dudas',
    ],
  },
  desempeno: {
    precio_valor: [
      'Cobró de más y entregó de menos',
      'No valió lo que cobró',
      'Justo lo esperado por el precio',
      'Valió lo que cobró',
      'Entregó más de lo que cobró',
    ],
    calidad: [
      'Muy por debajo de lo prometido',
      'Entregó menos de lo prometido',
      'Entregó lo prometido, sin más',
      'Entregó mejor de lo prometido',
      'Superó lo prometido de forma notoria',
    ],
    comunicacion: [
      'Imposible localizarlo',
      'Tuve que perseguirlo todo el proceso',
      'Respondía, pero yo iniciaba siempre',
      'Accesible y claro todo el proceso',
      'Proactivo, avisaba antes de que preguntara',
    ],
    servicio_trato: [
      'Trató mal al cliente o al equipo',
      'Correcto pero frío',
      'Profesional, sin más',
      'Cálido, el cliente lo notó',
      'El cliente lo mencionó sin que le preguntara',
    ],
    manejo_imprevistos: [
      'Empeoró el problema o lo negó',
      'Se paralizó, lo resolví yo',
      'Resolvió a medias o con ayuda',
      'Resolvió solo, sin alarmar a nadie',
      'Resolvió antes de que nadie lo notara',
    ],
  },
}

export const ANCLAS_RECONTRATACION = [
  'No, rotundamente',
  'Solo si no hay otra opción',
  'Sí, pero solo para cierto tipo de evento',
  'Sí, sin reservas',
  'Definitivamente sí, es mi primera opción',
]

export function anclasDe(contexto: ContextoAnclas, eje: Eje): string[] {
  return ANCLAS[contexto][eje] ?? []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/reviews/ejes.test.ts`
Expected: PASS, 8 pruebas.

- [ ] **Step 5: Commit**

```bash
git add lib/reviews/ejes.ts lib/reviews/ejes.test.ts
git commit -m "feat(reviews): vocabulario de ejes y anclas de la escala"
```

---

### Task 2: Motivos, razones y tipos de review en `lib/types.ts`

**Files:**
- Modify: `lib/types.ts` (agregar al final de la zona de proveedores, junto a `SUPPLIER_STATUSES`)
- Create: `lib/reviews/vocabulario.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `ReviewType`, `ReviewAutor`, `MotivoDescarte`, `RazonSeleccion`, `MOTIVOS_DESCARTE`, `RAZONES_SELECCION`, `MOTIVO_DESCARTE_LABEL`, `RAZON_SELECCION_LABEL`, `MAX_RAZONES_SELECCION`, `MAX_COMENTARIOS`.

**Nota:** `lib/types.ts` lo usan todas las páginas. Solo se **agrega**; no se toca ni se renombra nada existente.

- [ ] **Step 1: Write the failing test**

```ts
// lib/reviews/vocabulario.test.ts
import { describe, it, expect } from 'vitest'
import {
  MOTIVOS_DESCARTE, RAZONES_SELECCION,
  MOTIVO_DESCARTE_LABEL, RAZON_SELECCION_LABEL,
  MAX_RAZONES_SELECCION, MAX_COMENTARIOS,
} from '@/lib/types'

describe('motivos de descarte', () => {
  it('son exactamente siete', () => {
    expect(MOTIVOS_DESCARTE).toHaveLength(7)
  })

  it('todos tienen etiqueta visible', () => {
    for (const motivo of MOTIVOS_DESCARTE) {
      expect(MOTIVO_DESCARTE_LABEL[motivo]).toBeTruthy()
    }
  })

  it('incluye el caso de que el cliente eligio a otro', () => {
    expect(MOTIVOS_DESCARTE).toContain('cliente_eligio_otro')
    expect(MOTIVO_DESCARTE_LABEL.cliente_eligio_otro).toBe('El cliente eligió a otro')
  })
})

describe('razones de seleccion', () => {
  it('son exactamente ocho', () => {
    expect(RAZONES_SELECCION).toHaveLength(8)
  })

  it('todas tienen etiqueta visible', () => {
    for (const razon of RAZONES_SELECCION) {
      expect(RAZON_SELECCION_LABEL[razon]).toBeTruthy()
    }
  })

  it('se pueden elegir maximo dos', () => {
    expect(MAX_RAZONES_SELECCION).toBe(2)
  })
})

describe('limite de comentarios', () => {
  it('son 500 caracteres', () => {
    expect(MAX_COMENTARIOS).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/reviews/vocabulario.test.ts`
Expected: FAIL, los exports no existen en `lib/types.ts`.

- [ ] **Step 3: Write minimal implementation**

Agregar al final de `lib/types.ts`:

```ts
export const REVIEW_TYPES = ['contratacion', 'descarte', 'post_evento'] as const
export type ReviewType = typeof REVIEW_TYPES[number]

export const REVIEW_AUTORES = ['planner', 'cliente'] as const
export type ReviewAutor = typeof REVIEW_AUTORES[number]

export const MOTIVOS_DESCARTE = [
  'precio',
  'disponibilidad',
  'comunicacion',
  'calidad',
  'estilo',
  'cliente_eligio_otro',
  'no_respondio',
] as const
export type MotivoDescarte = typeof MOTIVOS_DESCARTE[number]

export const MOTIVO_DESCARTE_LABEL: Record<MotivoDescarte, string> = {
  precio:              'Precio fuera de presupuesto',
  disponibilidad:      'No disponible en la fecha',
  comunicacion:        'Comunicación lenta o poco clara',
  calidad:             'Propuesta o calidad insuficiente',
  estilo:              'No encajaba con el estilo del evento',
  cliente_eligio_otro: 'El cliente eligió a otro',
  no_respondio:        'Se retiró o no respondió',
}

export const RAZONES_SELECCION = [
  'precio',
  'relacion_calidad_precio',
  'calidad',
  'disponibilidad',
  'comunicacion',
  'recomendacion',
  'estilo',
  'decision_cliente',
] as const
export type RazonSeleccion = typeof RAZONES_SELECCION[number]

export const RAZON_SELECCION_LABEL: Record<RazonSeleccion, string> = {
  precio:                  'Mejor precio',
  relacion_calidad_precio: 'Mejor relación calidad/precio',
  calidad:                 'Mejor calidad o portafolio',
  disponibilidad:          'Disponibilidad en la fecha',
  comunicacion:            'Mejor comunicación',
  recomendacion:           'Recomendación o relación previa',
  estilo:                  'Encajaba con el estilo del evento',
  decision_cliente:        'Decisión del cliente',
}

export const MAX_RAZONES_SELECCION = 2
export const MAX_COMENTARIOS = 500

export interface SupplierReview {
  id: string
  user_id: string
  supplier_id: string
  event_id: string
  event_supplier_id: string
  review_type: ReviewType
  autor: ReviewAutor
  precio_valor: number | null
  calidad: number | null
  comunicacion: number | null
  servicio_trato: number | null
  manejo_imprevistos: number | null
  razones_seleccion: RazonSeleccion[] | null
  motivo_descarte: MotivoDescarte | null
  recontratacion: number | null
  cobros_extra: boolean | null
  monto_cobros_extra: number | null
  comentarios: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/reviews/vocabulario.test.ts`
Expected: PASS, 7 pruebas.

- [ ] **Step 5: Verificar que no se rompio nada que ya usaba types**

Run: `npx tsc --noEmit`
Expected: sin errores. Si aparece alguno en una página existente, es porque se tocó algo que ya estaba — revertir esa parte y solo agregar.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/reviews/vocabulario.test.ts
git commit -m "feat(reviews): motivos, razones y tipo SupplierReview"
```

---

### Task 3: Reglas de validación por tipo de review

**Files:**
- Create: `lib/reviews/validacion.ts`
- Test: `lib/reviews/validacion.test.ts`

**Interfaces:**
- Consumes: `Eje`, `EJES_PROPUESTA`, `EJES_DESEMPENO` de `./ejes`; `ReviewType`, `MAX_RAZONES_SELECCION`, `MAX_COMENTARIOS` de `@/lib/types`.
- Produces: `type BorradorReview`, `validarReview(borrador): string[]` — devuelve lista de problemas en español, vacía si está lista para guardar.

**Por qué esta tarea existe:** es la regla que impide que un descarte por fecha contamine el score de propuesta. Sin ella la tabla acepta basura.

- [ ] **Step 1: Write the failing test**

```ts
// lib/reviews/validacion.test.ts
import { describe, it, expect } from 'vitest'
import { validarReview, BorradorReview } from './validacion'

const vacio: BorradorReview = {
  review_type: 'contratacion',
  precio_valor: null, calidad: null, comunicacion: null,
  servicio_trato: null, manejo_imprevistos: null,
  razones_seleccion: [], motivo_descarte: null,
  recontratacion: null, cobros_extra: null, comentarios: null,
}

describe('review de contratacion', () => {
  it('exige los tres ejes de propuesta', () => {
    const problemas = validarReview({ ...vacio, razones_seleccion: ['precio'] })
    expect(problemas.join(' ')).toContain('Califica la propuesta')
  })

  it('exige al menos una razon', () => {
    const problemas = validarReview({
      ...vacio, precio_valor: 4, calidad: 4, comunicacion: 4,
    })
    expect(problemas.join(' ')).toContain('por qué')
  })

  it('no acepta mas de dos razones', () => {
    const problemas = validarReview({
      ...vacio, precio_valor: 4, calidad: 4, comunicacion: 4,
      razones_seleccion: ['precio', 'calidad', 'estilo'],
    })
    expect(problemas.join(' ')).toContain('máximo dos')
  })

  it('pasa con los tres ejes y una razon', () => {
    expect(validarReview({
      ...vacio, precio_valor: 4, calidad: 5, comunicacion: 3,
      razones_seleccion: ['precio'],
    })).toEqual([])
  })
})

describe('review de descarte', () => {
  const base: BorradorReview = { ...vacio, review_type: 'descarte' }

  it('exige el motivo', () => {
    expect(validarReview(base).join(' ')).toContain('por qué lo descartamos')
  })

  it('con solo el motivo ya se puede guardar', () => {
    expect(validarReview({ ...base, motivo_descarte: 'disponibilidad' })).toEqual([])
  })

  it('acepta los tres ejes si los llenaron', () => {
    expect(validarReview({
      ...base, motivo_descarte: 'precio',
      precio_valor: 2, calidad: 3, comunicacion: 4,
    })).toEqual([])
  })

  it('rechaza calificar a medias: o los tres o ninguno', () => {
    const problemas = validarReview({
      ...base, motivo_descarte: 'precio', precio_valor: 2,
    })
    expect(problemas.join(' ')).toContain('los tres')
  })
})

describe('review post evento', () => {
  const base: BorradorReview = {
    ...vacio, review_type: 'post_evento',
    precio_valor: 4, calidad: 4, comunicacion: 4,
    servicio_trato: 4, manejo_imprevistos: 4,
    recontratacion: 5, cobros_extra: false,
  }

  it('pasa con los cinco ejes, recontratacion y el flag', () => {
    expect(validarReview(base)).toEqual([])
  })

  it('acepta imprevistos en null porque no aplico', () => {
    expect(validarReview({ ...base, manejo_imprevistos: null })).toEqual([])
  })

  it('no acepta que falte servicio y trato', () => {
    expect(validarReview({ ...base, servicio_trato: null }).join(' '))
      .toContain('Califica el desempeño')
  })

  it('exige contestar si lo volverias a contratar', () => {
    expect(validarReview({ ...base, recontratacion: null }).join(' '))
      .toContain('volverías a contratar')
  })

  it('exige contestar el flag de cobros extra', () => {
    expect(validarReview({ ...base, cobros_extra: null }).join(' '))
      .toContain('cobros extra')
  })
})

describe('comentarios', () => {
  it('rechaza pasarse de 500 caracteres', () => {
    const problemas = validarReview({
      ...vacio, precio_valor: 4, calidad: 4, comunicacion: 4,
      razones_seleccion: ['precio'], comentarios: 'x'.repeat(501),
    })
    expect(problemas.join(' ')).toContain('500')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/reviews/validacion.test.ts`
Expected: FAIL, no encuentra `./validacion`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/reviews/validacion.ts
import { EJES_PROPUESTA, EJES_DESEMPENO, Eje } from './ejes'
import {
  ReviewType, MotivoDescarte, RazonSeleccion,
  MAX_RAZONES_SELECCION, MAX_COMENTARIOS,
} from '@/lib/types'

export type BorradorReview = {
  review_type: ReviewType
  razones_seleccion: RazonSeleccion[]
  motivo_descarte: MotivoDescarte | null
  recontratacion: number | null
  cobros_extra: boolean | null
  comentarios: string | null
} & Record<Eje, number | null>

const llenos = (b: BorradorReview, ejes: Eje[]) =>
  ejes.filter(eje => b[eje] !== null && b[eje] !== undefined).length

export function validarReview(b: BorradorReview): string[] {
  const problemas: string[] = []

  if (b.comentarios && b.comentarios.length > MAX_COMENTARIOS) {
    problemas.push(`Los comentarios no pueden pasar de ${MAX_COMENTARIOS} caracteres.`)
  }

  if (b.review_type === 'contratacion') {
    if (llenos(b, EJES_PROPUESTA) < EJES_PROPUESTA.length) {
      problemas.push('Califica la propuesta en los tres ejes.')
    }
    if (b.razones_seleccion.length === 0) {
      problemas.push('Dinos por qué elegimos a este proveedor.')
    }
    if (b.razones_seleccion.length > MAX_RAZONES_SELECCION) {
      problemas.push('Puedes elegir máximo dos razones.')
    }
  }

  if (b.review_type === 'descarte') {
    if (!b.motivo_descarte) {
      problemas.push('Dinos por qué lo descartamos.')
    }
    const calificados = llenos(b, EJES_PROPUESTA)
    if (calificados > 0 && calificados < EJES_PROPUESTA.length) {
      problemas.push('Califica los tres ejes o ninguno, no a medias.')
    }
  }

  if (b.review_type === 'post_evento') {
    const obligatorios = EJES_DESEMPENO.filter(eje => eje !== 'manejo_imprevistos')
    if (llenos(b, obligatorios) < obligatorios.length) {
      problemas.push('Califica el desempeño en todos los ejes.')
    }
    if (b.recontratacion === null) {
      problemas.push('Contesta si lo volverías a contratar.')
    }
    if (b.cobros_extra === null) {
      problemas.push('Contesta si hubo cobros extra.')
    }
  }

  return problemas
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/reviews/validacion.test.ts`
Expected: PASS, 14 pruebas.

- [ ] **Step 5: Commit**

```bash
git add lib/reviews/validacion.ts lib/reviews/validacion.test.ts
git commit -m "feat(reviews): reglas de validacion por tipo de review"
```

---

### Task 4: Cálculo de los scores

**Files:**
- Create: `lib/reviews/scores.ts`
- Test: `lib/reviews/scores.test.ts`

**Interfaces:**
- Consumes: `EJES_PROPUESTA`, `EJES_DESEMPENO` de `./ejes`; `SupplierReview` de `@/lib/types`.
- Produces: `calcularScores(reviews: SupplierReview[]): { propuesta: number | null; desempeno: number | null; clientes: number | null }`.

**Por qué esta tarea existe:** es el corazón del principio. Si un descarte puede mover el desempeño, la feature está mal.

- [ ] **Step 1: Write the failing test**

```ts
// lib/reviews/scores.test.ts
import { describe, it, expect } from 'vitest'
import { calcularScores } from './scores'
import type { SupplierReview } from '@/lib/types'

function review(parcial: Partial<SupplierReview>): SupplierReview {
  return {
    id: crypto.randomUUID(),
    user_id: 'u', supplier_id: 's', event_id: 'e', event_supplier_id: 'es',
    review_type: 'post_evento', autor: 'planner',
    precio_valor: null, calidad: null, comunicacion: null,
    servicio_trato: null, manejo_imprevistos: null,
    razones_seleccion: null, motivo_descarte: null,
    recontratacion: null, cobros_extra: null, monto_cobros_extra: null,
    comentarios: null, created_by: null,
    created_at: '2026-09-06', updated_at: '2026-09-06',
    ...parcial,
  }
}

describe('calcularScores', () => {
  it('sin reviews los tres scores son null', () => {
    expect(calcularScores([])).toEqual({ propuesta: null, desempeno: null, clientes: null })
  })

  it('un descarte NUNCA mueve el score de desempeno', () => {
    const scores = calcularScores([
      review({ review_type: 'descarte', precio_valor: 1, calidad: 1, comunicacion: 1 }),
      review({
        review_type: 'post_evento', autor: 'planner',
        precio_valor: 5, calidad: 5, comunicacion: 5,
        servicio_trato: 5, manejo_imprevistos: 5,
      }),
    ])
    expect(scores.desempeno).toBe(5)
    expect(scores.propuesta).toBe(1)
  })

  it('el cliente y el planner nunca se promedian entre si', () => {
    const scores = calcularScores([
      review({
        autor: 'planner',
        precio_valor: 3, calidad: 3, comunicacion: 3, servicio_trato: 3, manejo_imprevistos: 3,
      }),
      review({
        autor: 'cliente',
        precio_valor: 5, calidad: 5, comunicacion: 5, servicio_trato: 5, manejo_imprevistos: 5,
      }),
    ])
    expect(scores.desempeno).toBe(3)
    expect(scores.clientes).toBe(5)
  })

  it('contratacion y descarte caen al mismo score de propuesta', () => {
    const scores = calcularScores([
      review({ review_type: 'contratacion', precio_valor: 5, calidad: 5, comunicacion: 5 }),
      review({ review_type: 'descarte', precio_valor: 1, calidad: 1, comunicacion: 1 }),
    ])
    expect(scores.propuesta).toBe(3)
  })

  it('un eje en null sale del promedio en vez de contar como cero', () => {
    const scores = calcularScores([
      review({
        precio_valor: 4, calidad: 4, comunicacion: 4, servicio_trato: 4,
        manejo_imprevistos: null,
      }),
    ])
    expect(scores.desempeno).toBe(4)
  })

  it('un descarte sin calificar no cuenta para propuesta', () => {
    const scores = calcularScores([
      review({ review_type: 'descarte', motivo_descarte: 'disponibilidad' }),
    ])
    expect(scores.propuesta).toBeNull()
  })

  it('redondea a un decimal', () => {
    const scores = calcularScores([
      review({ review_type: 'contratacion', precio_valor: 4, calidad: 5, comunicacion: 5 }),
    ])
    expect(scores.propuesta).toBe(4.7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/reviews/scores.test.ts`
Expected: FAIL, no encuentra `./scores`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/reviews/scores.ts
import { EJES_PROPUESTA, EJES_DESEMPENO, Eje } from './ejes'
import type { SupplierReview } from '@/lib/types'

function promedio(reviews: SupplierReview[], ejes: Eje[]): number | null {
  const valores: number[] = []
  for (const review of reviews) {
    for (const eje of ejes) {
      const valor = review[eje]
      if (typeof valor === 'number') valores.push(valor)
    }
  }
  if (valores.length === 0) return null
  const suma = valores.reduce((total, valor) => total + valor, 0)
  return Math.round((suma / valores.length) * 10) / 10
}

export function calcularScores(reviews: SupplierReview[]) {
  return {
    propuesta: promedio(
      reviews.filter(r => r.review_type === 'contratacion' || r.review_type === 'descarte'),
      EJES_PROPUESTA,
    ),
    desempeno: promedio(
      reviews.filter(r => r.review_type === 'post_evento' && r.autor === 'planner'),
      EJES_DESEMPENO,
    ),
    clientes: promedio(
      reviews.filter(r => r.review_type === 'post_evento' && r.autor === 'cliente'),
      EJES_DESEMPENO,
    ),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/reviews/scores.test.ts`
Expected: PASS, 7 pruebas.

- [ ] **Step 5: Commit**

```bash
git add lib/reviews/scores.ts lib/reviews/scores.test.ts
git commit -m "feat(reviews): calculo de los tres scores separados"
```

---

### Task 5: El mapeo de las reseñas viejas

**Files:**
- Create: `lib/reviews/migracion.ts`
- Test: `lib/reviews/migracion.test.ts`

**Interfaces:**
- Consumes: `SupplierMood`, `ResponseSpeed` de `@/lib/types`.
- Produces: `velocidadAComunicacion(v: ResponseSpeed): number`, `comentarioHeredado(rating, mood, texto): string | null`.

**Por qué esta tarea existe:** son 3 filas de una planner real. El mapeo va probado antes de tocar producción.

- [ ] **Step 1: Write the failing test**

```ts
// lib/reviews/migracion.test.ts
import { describe, it, expect } from 'vitest'
import { velocidadAComunicacion, comentarioHeredado } from './migracion'

describe('velocidadAComunicacion', () => {
  it('mapea las cuatro velocidades viejas a la escala de cinco', () => {
    expect(velocidadAComunicacion('lentisimo')).toBe(2)
    expect(velocidadAComunicacion('normal')).toBe(3)
    expect(velocidadAComunicacion('bueno')).toBe(4)
    expect(velocidadAComunicacion('rapidos')).toBe(5)
  })

  it('nunca devuelve 1: la escala vieja no tenia ese caso', () => {
    for (const v of ['lentisimo', 'normal', 'bueno', 'rapidos'] as const) {
      expect(velocidadAComunicacion(v)).toBeGreaterThan(1)
    }
  })
})

describe('comentarioHeredado', () => {
  it('conserva las estrellas viejas como texto', () => {
    expect(comentarioHeredado(5, null, null)).toBe('Reseña anterior: 5 de 5.')
  })

  it('traduce el trato', () => {
    expect(comentarioHeredado(null, 'love', null)).toBe('Reseña anterior: trato excelente.')
    expect(comentarioHeredado(null, 'normal', null)).toBe('Reseña anterior: trato normal.')
    expect(comentarioHeredado(null, 'no', null)).toBe('Reseña anterior: mal trato.')
  })

  it('junta estrellas y trato en una sola linea', () => {
    expect(comentarioHeredado(5, 'love', null))
      .toBe('Reseña anterior: 5 de 5, trato excelente.')
  })

  it('el texto original va primero y se conserva completo', () => {
    expect(comentarioHeredado(4, 'normal', 'Llegaron tarde al montaje'))
      .toBe('Llegaron tarde al montaje\n\nReseña anterior: 4 de 5, trato normal.')
  })

  it('sin nada que heredar devuelve null', () => {
    expect(comentarioHeredado(null, null, null)).toBeNull()
    expect(comentarioHeredado(null, null, '   ')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/reviews/migracion.test.ts`
Expected: FAIL, no encuentra `./migracion`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/reviews/migracion.ts
import type { SupplierMood, ResponseSpeed } from '@/lib/types'

const COMUNICACION_POR_VELOCIDAD: Record<ResponseSpeed, number> = {
  lentisimo: 2,
  normal:    3,
  bueno:     4,
  rapidos:   5,
}

const TRATO_HEREDADO: Record<SupplierMood, string> = {
  no:     'mal trato',
  normal: 'trato normal',
  love:   'trato excelente',
}

export function velocidadAComunicacion(velocidad: ResponseSpeed): number {
  return COMUNICACION_POR_VELOCIDAD[velocidad]
}

export function comentarioHeredado(
  rating: number | null,
  mood: SupplierMood | null,
  texto: string | null,
): string | null {
  const partes: string[] = []
  if (rating !== null) partes.push(`${rating} de 5`)
  if (mood !== null) partes.push(TRATO_HEREDADO[mood])

  const original = texto?.trim() || null
  if (partes.length === 0) return original

  const heredado = `Reseña anterior: ${partes.join(', ')}.`
  return original ? `${original}\n\n${heredado}` : heredado
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/reviews/migracion.test.ts`
Expected: PASS, 7 pruebas.

- [ ] **Step 5: Commit**

```bash
git add lib/reviews/migracion.ts lib/reviews/migracion.test.ts
git commit -m "feat(reviews): mapeo de las resenas viejas a la escala nueva"
```

---

### Task 6: El SQL de la tabla, sin correrlo

**Files:**
- Create: `docs/superpowers/plans/sql/2026-09-06-supplier-reviews.sql`

**Interfaces:**
- Consumes: nada.
- Produces: el archivo que Diego correrá en Supabase **después** del merge a `main`.

**Regla de sincronía:** este SQL NO se corre hasta que el código de las tareas 1 a 11 esté en `origin/main`. La tabla nueva es aditiva y no rompe nada, pero el `DROP COLUMN` de la tarea 12 sí.

- [ ] **Step 1: Escribir el archivo**

```sql
-- Reviews de proveedores: una tabla, tres tipos, dos autores.
-- Correr DESPUES de que el codigo este en origin/main.
-- Los valores validos de motivo_descarte y razones_seleccion viven en
-- lib/types.ts, NO como CHECK: un CHECK fue lo que dejo roto el default de status.

create type review_type as enum ('contratacion', 'descarte', 'post_evento');
create type review_autor as enum ('planner', 'cliente');

create table supplier_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  event_supplier_id uuid not null references event_suppliers(id) on delete cascade,

  review_type review_type not null,
  autor review_autor not null default 'planner',

  precio_valor smallint check (precio_valor between 1 and 5),
  calidad smallint check (calidad between 1 and 5),
  comunicacion smallint check (comunicacion between 1 and 5),
  servicio_trato smallint check (servicio_trato between 1 and 5),
  manejo_imprevistos smallint check (manejo_imprevistos between 1 and 5),

  razones_seleccion text[],
  motivo_descarte text,
  recontratacion smallint check (recontratacion between 1 and 5),
  cobros_extra boolean,
  monto_cobros_extra numeric,

  comentarios text check (char_length(comentarios) <= 500),

  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_supplier_id, review_type, autor)
);

create index supplier_reviews_supplier_idx on supplier_reviews (supplier_id);
create index supplier_reviews_event_idx on supplier_reviews (event_id);

alter table supplier_reviews enable row level security;

create policy supplier_reviews_select_own on supplier_reviews
  for select to authenticated
  using (user_id = auth.uid());

create policy supplier_reviews_insert_own on supplier_reviews
  for insert to authenticated
  with check (user_id = auth.uid());

create policy supplier_reviews_update_own on supplier_reviews
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy supplier_reviews_delete_own on supplier_reviews
  for delete to authenticated
  using (user_id = auth.uid());

-- Verificacion (deben salir 4 filas, todas {authenticated}):
-- select policyname, roles from pg_policies where tablename = 'supplier_reviews';
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/sql/2026-09-06-supplier-reviews.sql
git commit -m "feat(reviews): SQL de la tabla supplier_reviews"
```

---

### Task 7: El primitivo de escala 1–5

**Files:**
- Create: `app/components/ui/EscalaCinco.tsx`

**Interfaces:**
- Consumes: nada de las tareas anteriores.
- Produces: `<EscalaCinco nombre anclas valor onChange descripcion? noAplico? etiquetaNoAplico? deshabilitado? />` donde `valor: number | 'na' | null` y `onChange: (v: number | 'na' | null) => void`.

**Patrón a copiar:** `app/events/[id]/proveedores/PagoModal.tsx` para el estilo de campos, y `EstatusProveedor.tsx` para cómo se marca lo activo sin depender solo del color.

- [ ] **Step 1: Escribir el componente**

```tsx
'use client'

interface Props {
  nombre: string
  anclas: string[]
  valor: number | 'na' | null
  onChange: (valor: number | 'na' | null) => void
  descripcion?: string
  noAplico?: boolean
  etiquetaNoAplico?: string
  deshabilitado?: boolean
}

export default function EscalaCinco({
  nombre, anclas, valor, onChange,
  descripcion, noAplico = false,
  etiquetaNoAplico = 'No aplicó',
  deshabilitado = false,
}: Props) {
  const activo = (n: number) => valor === n
  const etiqueta =
    valor === 'na' ? 'No aplicó, no cuenta para el promedio'
    : typeof valor === 'number' ? anclas[valor - 1]
    : ''

  return (
    <div className={deshabilitado ? 'opacity-40' : ''}>
      <div className="text-sm font-medium text-[var(--text)]">{nombre}</div>
      {descripcion && (
        <div className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">{descripcion}</div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 gap-1.5 sm:flex-none">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              disabled={deshabilitado}
              aria-pressed={activo(n)}
              onClick={() => onChange(activo(n) ? null : n)}
              className={`h-9 flex-1 rounded-lg border text-sm font-semibold tabular-nums transition-colors sm:h-[30px] sm:w-[30px] sm:flex-none ${
                activo(n)
                  ? 'border-[var(--text)] bg-[var(--text)] text-white'
                  : 'border-[var(--border)] bg-white text-[var(--text-sec)] hover:bg-[var(--hover)]'
              } disabled:cursor-not-allowed`}
            >
              {n}
            </button>
          ))}
        </div>

        {noAplico && (
          <button
            type="button"
            disabled={deshabilitado}
            aria-pressed={valor === 'na'}
            onClick={() => onChange(valor === 'na' ? null : 'na')}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              valor === 'na'
                ? 'border-[var(--text-muted)] bg-[var(--surface-alt)] font-semibold text-[var(--text)]'
                : 'border-dashed border-[var(--border)] bg-white text-[var(--text-sec)] hover:bg-[var(--hover)]'
            }`}
          >
            {etiquetaNoAplico}
          </button>
        )}
      </div>

      <div className="mt-1.5 min-h-[18px] text-xs leading-snug text-[var(--text-sec)]">
        {etiqueta || <span className="text-[var(--text-muted)]">Sin calificar</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/components/ui/EscalaCinco.tsx
git commit -m "feat(reviews): primitivo de escala de cinco botones"
```

---

### Task 8: Modal de review al contratar

**Files:**
- Create: `app/events/[id]/proveedores/ReviewContratacionModal.tsx`
- Test manual: local en `localhost:3003`

**Interfaces:**
- Consumes: `EscalaCinco`, `anclasDe`, `EJES_PROPUESTA`, `NOMBRE_EJE`, `DESCRIPCION_EJE_PROPUESTA`, `validarReview`, `RAZONES_SELECCION`, `RAZON_SELECCION_LABEL`, `MAX_RAZONES_SELECCION`, `MAX_COMENTARIOS`.
- Produces: `<ReviewContratacionModal eventSupplierId supplierId eventId userId supplierName eventName onSaved onSkip />`.

**Patrón a copiar:** la cáscara (`Modal`, `Modal.Header`, `Modal.Body`, `Modal.Footer`), el `usePermiso('proveedores')` y el manejo de `saving` de `SupplierReviewModal.tsx` — que en la tarea 12 se borra.

- [ ] **Step 1: Escribir el modal**

Estructura, en este orden:

1. **Header:** título `¿Por qué se quedó?`, subtítulo `Cerraste con {supplierName}`, badge `success`.
2. **Pregunta 1 — Califica la propuesta.** Un `<EscalaCinco>` por cada eje de `EJES_PROPUESTA`, con `anclasDe('propuesta', eje)`, `NOMBRE_EJE[eje]` y `DESCRIPCION_EJE_PROPUESTA[eje]`.
3. **Pregunta 2 — ¿Por qué elegimos a este proveedor?** Chips de `RAZONES_SELECCION`. Al llegar a `MAX_RAZONES_SELECCION` los no seleccionados van `disabled` con `opacity-40` — **no se ocultan**. Contador `{n} de 2` debajo.
4. **Pregunta 3 — Comentarios adicionales**, opcional, `maxLength={MAX_COMENTARIOS}`, placeholder `Cualquier cosa que valga la pena recordar de este proveedor`, con contador `{n} / 500`.
5. **Footer:** `Después` (llama `onSkip`) y `Guardar review` en teal.

El guardado:

```tsx
const handleSave = async () => {
  if (!permiso.editar) return
  const borrador = {
    review_type: 'contratacion' as const,
    precio_valor: valores.precio_valor, calidad: valores.calidad,
    comunicacion: valores.comunicacion,
    servicio_trato: null, manejo_imprevistos: null,
    razones_seleccion: razones, motivo_descarte: null,
    recontratacion: null, cobros_extra: null,
    comentarios: comentarios.trim() || null,
  }
  const problemas = validarReview(borrador)
  if (problemas.length > 0) { setProblemas(problemas); return }

  setSaving(true)
  const { error } = await supabase.from('supplier_reviews').upsert({
    user_id: userId, supplier_id: supplierId, event_id: eventId,
    event_supplier_id: eventSupplierId, autor: 'planner',
    ...borrador,
    created_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_supplier_id,review_type,autor' })

  if (error) {
    console.error('Error guardando review:', error)
    setProblemas(['No se pudo guardar la review. Intenta de nuevo.'])
    setSaving(false)
    return
  }
  onSaved()
}
```

**Ojo con el fallo mudo de RLS:** si el `upsert` devuelve `error: null` pero no escribió nada, es una policy filtrando. Encadenar `.select()` y verificar que vuelva al menos una fila antes de llamar `onSaved()`.

- [ ] **Step 2: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos en verde. **No correr con el dev server arriba.**

- [ ] **Step 3: Commit**

```bash
git add app/events/[id]/proveedores/ReviewContratacionModal.tsx
git commit -m "feat(reviews): modal de review al contratar"
```

---

### Task 9: Modal de review al descartar

**Files:**
- Create: `app/events/[id]/proveedores/ReviewDescarteModal.tsx`

**Interfaces:**
- Consumes: lo mismo que la tarea 8, más `MOTIVOS_DESCARTE` y `MOTIVO_DESCARTE_LABEL`.
- Produces: `<ReviewDescarteModal ... />` con las mismas props que el de contratación.

- [ ] **Step 1: Escribir el modal**

Estructura:

1. **Header:** título `¿Por qué se cayó?`, subtítulo `{supplierName} sale del trato`, badge `danger`.
2. **Pregunta 1 — ¿Por qué lo descartamos?** Chips de selección única con `MOTIVOS_DESCARTE`.
3. **Pregunta 2 — Califica la propuesta**, marcada `Opcional`. Los tres ejes de propuesta, más un enlace de texto debajo:

```tsx
<button
  type="button"
  onClick={() => {
    const apagando = !sinOpinion
    setSinOpinion(apagando)
    if (apagando) setValores({ precio_valor: null, calidad: null, comunicacion: null })
  }}
  className="mt-3 border-b border-[var(--border)] pb-0.5 text-xs text-[var(--text-sec)] hover:border-[var(--text-muted)] hover:text-[var(--text)]"
>
  {sinOpinion ? 'Prefiero calificarlo' : 'No tengo opinión'}
</button>
```

Con `sinOpinion` en true, los tres `<EscalaCinco>` van `deshabilitado` y guardan `null`.

4. **Pregunta 3 — Comentarios adicionales**, placeholder `Por qué no funcionó, o qué tendría que cambiar para considerarlo`.
5. **Footer:** `Después` y `Guardar review`.

El guardado es igual al de la tarea 8 con `review_type: 'descarte'`, `motivo_descarte: motivo`, `razones_seleccion: []`.

- [ ] **Step 2: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add app/events/[id]/proveedores/ReviewDescarteModal.tsx
git commit -m "feat(reviews): modal de review al descartar"
```

---

### Task 10: Modal de review post-evento

**Files:**
- Create: `app/events/[id]/proveedores/ReviewDesempenoModal.tsx`

**Interfaces:**
- Consumes: lo mismo, más `EJES_DESEMPENO` y `ANCLAS_RECONTRATACION`.
- Produces: `<ReviewDesempenoModal ... />`.

- [ ] **Step 1: Escribir el modal**

Estructura:

1. **Header:** título `¿Cómo te fue con él?`, subtítulo `{supplierName} · {eventName}`, badge `pro` (gold `#d4a853`).
2. **Pregunta 1 — Califica el desempeño.** Los cinco ejes con `anclasDe('desempeno', eje)`. `manejo_imprevistos` lleva `noAplico` con etiqueta `No aplicó`.

   Debajo de los ejes, dentro del mismo bloque, la fila de cobros extra sobre `bg-[var(--accent-bg)]` con borde `border-[#e8d4a6]`:

```tsx
<div className="mt-4 rounded-lg border border-[#e8d4a6] bg-[var(--accent-bg)] p-3">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <span className="text-sm font-medium">¿Hubo cobros extra no acordados?</span>
    <div className="flex gap-2">
      {[true, false].map(v => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={cobrosExtra === v}
          onClick={() => setCobrosExtra(v)}
          className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors ${
            cobrosExtra === v
              ? 'border-[var(--text)] bg-[var(--text)] text-white'
              : 'border-[var(--border)] bg-white text-[var(--text-sec)] hover:bg-[var(--hover)]'
          }`}
        >
          {v ? 'Sí' : 'No'}
        </button>
      ))}
    </div>
  </div>
  {cobrosExtra === true && (
    <div className="mt-3 flex items-center gap-2">
      <label htmlFor="monto-extra" className="text-xs text-[var(--text-sec)]">Monto</label>
      <input
        id="monto-extra"
        type="text"
        inputMode="decimal"
        value={montoExtra}
        onChange={e => setMontoExtra(e.target.value)}
        placeholder="0.00"
        className="w-32 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm tabular-nums outline-none focus:border-[#48C9B0]"
      />
    </div>
  )}
</div>
```

3. **Pregunta 2 — ¿Lo volverías a contratar?** Un `<EscalaCinco>` con `ANCLAS_RECONTRATACION`. Cuando el valor es `1`, mostrar debajo un aviso sobre `bg-[var(--error-bg)]` con borde `border-[var(--error-border)]`:

   > **Queda vetado.** Deja de aparecer en sugerencias hasta que alguien lo revierta a mano. No es un score bajo, es una exclusión.

4. **Pregunta 3 — Comentarios adicionales**, placeholder `Lo que le dirías a alguien de tu equipo que lo va a coordinar`.
5. **Footer:** `Después` y `Guardar review`.

El guardado usa `review_type: 'post_evento'`, `autor: 'planner'`, y convierte `'na'` a `null` antes de mandar:

```tsx
const aNumero = (v: number | 'na' | null) => (v === 'na' ? null : v)
```

`monto_cobros_extra` se manda como `cobrosExtra ? Number(montoExtra) || null : null`.

- [ ] **Step 2: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add app/events/[id]/proveedores/ReviewDesempenoModal.tsx
git commit -m "feat(reviews): modal de review post evento"
```

---

### Task 11: Enganchar los tres modales y mostrar los scores

**Files:**
- Modify: `app/events/[id]/proveedores/page.tsx` (donde hoy se abre `SupplierReviewModal`, línea ~488)
- Modify: `app/events/[id]/presupuesto/page.tsx` (línea ~998)
- Modify: `app/events/[id]/proveedores/FichaDelEvento.tsx` (la carpeta Reseña y la carpeta Motivo)

**Interfaces:**
- Consumes: los tres modales de las tareas 8, 9 y 10; `calcularScores` de la tarea 4.
- Produces: nada nuevo para tareas posteriores.

- [ ] **Step 1: Cambiar el disparo por estado**

Donde hoy se abre `SupplierReviewModal` al llegar a un estado final, ahora se elige por destino:

- destino `contratado` → `ReviewContratacionModal`
- destino `descartado` → `ReviewDescarteModal`

Se conserva la regla actual de **omitir el modal si ese proveedor ya tiene esa review**, consultando `supplier_reviews` por `event_supplier_id` y `review_type`.

- [ ] **Step 2: La carpeta Reseña abre el modal post-evento**

En `FichaDelEvento.tsx`, la carpeta `Reseña` — que ya aparece sola cuando `bodaPaso` es true, según `lib/rolodex/ficha-por-estado.ts` — muestra la review existente si la hay, y si no, un botón `Calificar el desempeño` que abre `ReviewDesempenoModal`.

- [ ] **Step 3: La carpeta Motivo muestra el motivo del descarte**

La carpeta `Motivo`, que hoy existe pero está vacía, muestra `MOTIVO_DESCARTE_LABEL[review.motivo_descarte]` y los comentarios.

- [ ] **Step 4: Los dos scores en la cabecera de la ficha**

Con `calcularScores(reviewsDelProveedor)`, mostrar `Propuesta` y `Desempeño` como dos números pequeños. `null` se muestra como raya, nunca como cero. El de clientes se agrega en el Plan 2.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: los tres en verde, 35 pruebas nuevas incluidas.

- [ ] **Step 6: Commit**

```bash
git add app/events/[id]/proveedores/page.tsx app/events/[id]/presupuesto/page.tsx app/events/[id]/proveedores/FichaDelEvento.tsx
git commit -m "feat(reviews): enganchar los tres modales y mostrar los scores"
```

---

### Task 12: Retirar la reseña vieja

**Files:**
- Delete: `app/events/[id]/proveedores/SupplierReviewModal.tsx`
- Modify: `lib/types.ts` (marcar `SupplierMood`, `ResponseSpeed` y sus labels como heredados, **sin borrarlos** — los usa la migración)
- Create: `docs/superpowers/plans/sql/2026-09-06-migrar-resenas-viejas.sql`

**Interfaces:**
- Consumes: `velocidadAComunicacion` y `comentarioHeredado` de la tarea 5, aplicados a mano en el SQL.
- Produces: nada.

**Este SQL se corre al final de todo, con el código ya en `main` y verificado en producción.**

- [ ] **Step 1: Borrar el modal viejo y sus usos**

```bash
git rm app/events/[id]/proveedores/SupplierReviewModal.tsx
```

Quitar los `import SupplierReviewModal` de `proveedores/page.tsx` y `presupuesto/page.tsx`.

- [ ] **Step 2: Escribir el SQL de migración**

```sql
-- Migrar las resenas viejas. Correr DESPUES de verificar el codigo en produccion.
-- Medido el 6-sep: 7 filas con datos. 4 de diego.garza@moonlaunch.mx se descartan
-- por instruccion suya; 3 de bodasplanner@hotmail.com se conservan.
-- No son resenas de desempeno: el modal viejo decia "Tu experiencia cotizando",
-- asi que entran como review de contratacion.

insert into supplier_reviews (
  user_id, supplier_id, event_id, event_supplier_id,
  review_type, autor,
  comunicacion, comentarios, created_by, created_at
)
select
  e.user_id,
  es.supplier_id,
  es.event_id,
  es.id,
  'contratacion',
  'planner',
  case es.response_speed
    when 'lentisimo' then 2
    when 'normal'    then 3
    when 'bueno'     then 4
    when 'rapidos'   then 5
  end,
  nullif(trim(concat_ws(
    E'\n\n',
    nullif(trim(es.review_text), ''),
    case
      when es.rating is null and es.mood is null then null
      else 'Reseña anterior: ' ||
        concat_ws(', ',
          case when es.rating is not null then es.rating || ' de 5' end,
          case es.mood
            when 'love'   then 'trato excelente'
            when 'normal' then 'trato normal'
            when 'no'     then 'mal trato'
          end
        ) || '.'
    end
  )), ''),
  e.user_id,
  es.created_at
from event_suppliers es
join events e on e.id = es.event_id
join users  u on u.id = e.user_id
where u.email = 'bodasplanner@hotmail.com'
  and (es.rating is not null
       or es.mood is not null
       or es.response_speed is not null
       or nullif(trim(es.review_text), '') is not null)
on conflict (event_supplier_id, review_type, autor) do nothing;

-- Verificar ANTES de seguir: deben ser exactamente 3 filas.
-- select count(*) from supplier_reviews where review_type = 'contratacion';

-- Solo despues de verificar las 3 filas:
alter table event_suppliers
  drop column if exists rating,
  drop column if exists mood,
  drop column if exists response_speed,
  drop column if exists review_text,
  drop column if exists discard_reason,
  drop column if exists win_reason;
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: verde. Cualquier referencia colgante a `SupplierReviewModal` sale aquí.

- [ ] **Step 4: Commit**

```bash
git add -u
git add docs/superpowers/plans/sql/2026-09-06-migrar-resenas-viejas.sql
git commit -m "feat(reviews): retirar la resena vieja y migrar los datos"
```

---

## Orden de salida a producción

1. Tareas 1 a 12 en la rama, con `npm test` y `npm run build` en verde.
2. Abrir el PR y mergear a `main`.
3. **Correr el SQL de la tarea 6** (crear la tabla). Verificar 4 policies, todas `{authenticated}`.
4. Probar en producción: contratar un proveedor de prueba, descartar otro, y abrir la carpeta Reseña de uno con la boda pasada.
5. **Correr el SQL de la tarea 12** (migrar y borrar columnas). Verificar las 3 filas ANTES del `drop column`.

## Fuera de alcance de este plan

- **El formulario público de los novios** — es el Plan 2. Este plan deja listos la tabla con `autor`, el cálculo de `score_clientes` y los tres modales sobre los que se monta.
- **El disparo automático a 4 días** del evento. Va con el Plan 2 porque comparte motor con el aviso a los novios: los dos son "avisarle a alguien que ya puede calificar", y el cron de recordatorios ya existe.
- El expediente `/rolodex/[id]` y el directorio `/rolodex`.
