# Primitivo de Modal + base de viewport iOS

**Fecha:** 2026-08-01
**Rama:** `feat/modal-primitivo-viewport-ios`
**Estado:** spec aprobado, pendiente plan de implementación

---

## El problema

En iPhone (Safari), los modales de Anfiora se cortan por abajo: el botón de guardar
queda detrás de la barra del navegador y, al enfocar un campo del fondo, el teclado
lo tapa. Reportado por Diego sobre el uso real de la app.

La causa inmediata es la unidad `vh`. En Safari iOS, `100vh` mide la pantalla **como si
la barra de direcciones no existiera**, así que un modal a `90vh` se calcula sobre un
alto mayor al visible y su parte inferior cae fuera de cuadro.

Pero la causa de fondo es otra: **no existe un primitivo de modal**. Hay **18 archivos
con modales escritos a mano**, cada uno repitiendo overlay, panel, tope de altura y
scroll (17 de ellos con la firma de bottom sheet `rounded-t-2xl`, repartidos en 15
archivos). Cambiar la unidad en todos ellos resuelve hoy y no mañana, porque el modal
siguiente se va a escribir copiando al anterior.

### Dos anatomías incompatibles

El hallazgo que define el alcance: los modales existentes no comparten estructura.

| | Anatomía A (correcta) | Anatomía B (rota) |
|---|---|---|
| Qué scrollea | Solo el cuerpo | El panel completo |
| Header | `shrink-0` | `sticky top-0` |
| Pie | Anclado, fuera del scroll | Parte del contenido |
| Referencia | `SupplierModal.tsx:92` | `TaskModal.tsx:215` |

A los de anatomía A les basta la medida correcta. Los de anatomía B **no se arreglan
solo con `dvh`**: su pie cae al fondo del scroll por diseño, que es justo donde Safari
pone su barra. Necesitan reestructurarse.

### Inventario

Una sola pantalla de la app usa hoy la medida correcta: `app/playlist/[token]/page.tsx`
(`h-[100dvh]`).

| Archivo | Medida actual | Anatomía |
|---|---|---|
| `components/NewEventModal.tsx` | `92vh` + `top-[4vh]` | A |
| `components/OnboardingModal.tsx` | `92vh` | A |
| `events/[id]/timeline/TaskModal.tsx` | `92vh` | B |
| `events/[id]/timeline/MomentModal.tsx` | `92vh` | B |
| `events/[id]/timeline/GenerateItineraryModal.tsx` | `92vh` | B |
| `events/[id]/proveedores/SupplierDetailModal.tsx` | `95vh` / `90vh` | A |
| `events/[id]/proveedores/SupplierModal.tsx` | `92vh` | A |
| `events/[id]/proveedores/SupplierReviewModal.tsx` | `90vh` | A |
| `events/[id]/presupuesto/BudgetItemModal.tsx` | `90vh` | A |
| `events/[id]/presupuesto/BudgetCategoriesModal.tsx` | `85vh` | A |
| `events/[id]/presupuesto/page.tsx` | `90vh` | A |
| `events/[id]/mesa-regalos/AddGiftModal.tsx` | `90vh` | A |
| `events/[id]/mesa-regalos/PaymentMethodModal.tsx` | `90vh` | A |
| `mesa/[token]/page.tsx` | `90vh` | A |
| `events/[id]/playlist/AddSongModal.tsx` | `85vh` | A |
| `events/[id]/invitacion/BlockEditor.tsx` | `88vh` / `85vh` / `70vh` | A |
| `events/[id]/page.tsx` | `90vh` ×2 | B |
| `events/[id]/mesas/page.tsx` | `80vh` / `90vh` | B |
| `components/ui/ConfirmModal.tsx` | sin tope | A |
| `dashboard`, `events/[id]/layout.tsx`, `mensajes` | `h-screen` | — |

---

## Decisiones tomadas

| # | Decisión | Elegida |
|---|---|---|
| 1 | Alcance del safe area | Solo modales (+ bottom nav, ver restricción) |
| 2 | Anatomía B | Una sola forma; los 5 se reestructuran |
| 3 | Candado anti-regresión | Falla el build |
| 4 | Mecanismo del teclado | Medir el viewport real + declararlo en el meta |
| 5 | Accesibilidad | Entra al primitivo, con trampa de foco |
| 6 | Construir vs adoptar Radix | Construir, delgado |

### Sobre la decisión 6

Radix / React Aria / Headless UI resuelven el **comportamiento** (foco, scroll lock,
accesibilidad) y deliberadamente dejan el **tamaño** al consumidor. Es decir, adoptar
una biblioteca arreglaría la mitad que hoy no duele y no arreglaría la mitad que sí.
Sumado a que `CLAUDE.md` prohíbe agregar paquetes sin aprobación, se construye local.

La contrapartida aceptada: nos hacemos cargo nosotros de la accesibilidad, por eso la
decisión 5 la mete al alcance en vez de diferirla.

### Restricción descubierta: el safe area es global o nada

`env(safe-area-inset-*)` devuelve `0` a menos que la app declare `viewport-fit=cover`
**globalmente**. No se puede activar "solo en modales".

Impacto real:

- **Safari normal:** irrelevante. La barra del navegador ya ocupa esa zona y, con la
  medida nueva, el modal se queda por encima de ella.
- **PWA instalada:** sí importa. No hay barra de navegador y la barra de gestos del
  iPhone queda encima del contenido. Anfiora es instalable y tiene banner de instalación
  en producción.

**Resolución:** se activa el interruptor global (es obligatorio para que el pie del modal
funcione) y se le da respiro a **un solo elemento adicional**: el bottom nav de
`/events/[id]/layout.tsx`, único elemento que quedaría pisado en modo PWA. No se audita
el resto de la app; eso queda fuera de este spec.

---

## Arquitectura

Cuatro piezas.

### 1. `app/components/ui/Modal.tsx` — el primitivo

Único dueño de lo que hoy está copiado 17 veces.

**Responsabilidades:**

- Overlay y panel, con bottom sheet en móvil y centrado en desktop
- Alto real disponible, teclado incluido
- Solo el cuerpo scrollea; header y pie anclados
- Respiro de safe area en el pie
- Bloqueo del scroll de fondo mientras está abierto
- Cierre por Escape y por clic en el overlay
- Trampa de foco y devolución del foco al disparador
- `role="dialog"`, `aria-modal`, `aria-labelledby`

**Fuera de alcance a propósito:** manejo de formularios, validación, estado del
contenido. Eso pertenece a cada modal.

**API:**

```tsx
<Modal open={open} onClose={close} size="md">
  <Modal.Header title="Nueva tarea" subtitle="Asigna y agenda" />
  <Modal.Body>
    {/* único elemento que scrollea */}
  </Modal.Body>
  <Modal.Footer>
    <button onClick={close}>Cancelar</button>
    <button onClick={save}>Guardar</button>
  </Modal.Footer>
</Modal>
```

`Modal.Footer` es opcional — hay modales legítimos sin pie (`SupplierDetailModal`, con
pestañas). Lo que no es opcional es que el cuerpo sea el único contenedor con scroll.

**La API no expone** ninguna forma de pedir que el panel completo scrollee, ni de fijar
el tope de altura a mano. La anatomía B deja de ser expresable.

**Tamaños:** `sm` / `md` / `lg` / `xl`, mapeados a los `max-w-*` que ya usan los modales
actuales, para no cambiar el aspecto en desktop durante la migración.

### 2. Alto disponible — el mecanismo

Tres capas, de más a menos confiable:

1. **`dvh` como base en CSS.** Resuelve la barra de Safari sin JavaScript. Es también el
   valor de respaldo si el resto falla.
2. **`interactiveWidget` en el viewport.** Declarativo, gratis, y hace que Chrome en
   Android encoja la página con el teclado. **No se puede confiar en Safari iOS**, así
   que no es el mecanismo principal — es una mejora para Android.
3. **Medición del viewport visual desde el primitivo.** Un listener que observa cuánto
   espacio visible queda de verdad (teclado incluido) y ajusta el alto del panel. Esta es
   la capa que resuelve el caso de Diego en iPhone.

La capa 3 vive **exclusivamente dentro del primitivo**. Ningún modal la implementa.

**Función pura extraíble para test:**

```ts
// lib/viewport.ts
export function panelMaxHeight(visualHeight: number, ratio = 0.92): number
```

Recibe medidas, devuelve píxeles. Sin DOM, testeable con Vitest.

### 3. `export const viewport` en `app/layout.tsx`

Hoy no existe; la app corre con el default de Next. Se declara:

- `width: 'device-width'`, `initialScale: 1`
- `viewportFit: 'cover'` — obligatorio para el safe area (ver restricción)
- `interactiveWidget: 'resizes-content'` — capa 2

**No** se fija `maximumScale` ni `userScalable: false`. Bloquear el zoom es una barrera
de accesibilidad y no hace falta: el zoom automático de iOS al enfocar un campo se evita
con inputs a **16px o más**, que es la regla que adopta el primitivo.

### 4. `scripts/viewport-audit.mjs` — el candado

Corre pegado al build y lo tumba si encuentra, en `app/`:

- `vh` o `h-screen` / `min-h-screen`
- La firma de un bottom sheet a mano: `fixed inset-0` junto con `rounded-t-2xl`

**Lista blanca explícita**, por ruta y con motivo escrito:

- `app/globals.css` — animaciones decorativas del landing, donde `vh` es correcto
- `app/page.tsx`, `app/[segment]/SegmentClient.tsx` — landings públicas de altura completa

**Requisito de diseño:** el script recorre **todo** `app/`, no una muestra. Un auditor
que cubre una parte y reporta verde es peor que no tenerlo, porque genera confianza
infundada. (Lección del auditor de RLS.)

El script es testeable con Vitest contra archivos de muestra.

---

## Plan de migración

### Paso 1 — Base

`layout.tsx` (viewport), `Modal.tsx` (primitivo), `lib/viewport.ts` (función pura),
respiro del bottom nav en `events/[id]/layout.tsx`. **Nada migrado todavía.** La app
funciona igual; solo existe la pieza nueva. Riesgo nulo.

### Paso 2 — Tres pilotos

Elegidos por ser los casos extremos, no al azar:

| Piloto | Por qué |
|---|---|
| `TaskModal` | Anatomía B, la peor. Alto uso. |
| `SupplierModal` | Anatomía A limpia. El caso fácil. |
| `SupplierDetailModal` | El complejo: pestañas, `95vh`, sin pie fijo. |

**Este es el único punto de riesgo real del proyecto y por eso va temprano y barato.**
Si el primitivo aguanta estos tres, aguanta los veinte. Verificación en iPhone real
sobre preview de Vercel antes de continuar.

### Paso 3 — Tandas por dominio

Quedan 15 archivos tras los 3 pilotos. Un PR revisable por tanda:

1. Proveedores + presupuesto — 4 archivos (`SupplierReviewModal`, `BudgetItemModal`,
   `BudgetCategoriesModal`, `presupuesto/page.tsx`)
2. Timeline + invitados + mesas — 4 archivos (`MomentModal`, `GenerateItineraryModal`,
   `events/[id]/page.tsx`, `mesas/page.tsx`). Incluye el resto de anatomía B.
3. Mesa de regalos + playlist + invitación + onboarding + alta de evento — 7 archivos
   (`AddGiftModal`, `PaymentMethodModal`, `mesa/[token]/page.tsx`, `AddSongModal`,
   `BlockEditor`, `OnboardingModal`, `NewEventModal`)

### Paso 4 — El candado

Hasta el final. Antes bloquearía la propia migración.

### Fuera de alcance

- Auditoría de safe area en el resto de la app (solo entra el bottom nav)
- Reescribir `ConfirmModal` sobre el primitivo — funciona, su forma es distinta y está
  recién en producción. Solo se le corrige la trampa de foco.
- Las 3 pantallas con `h-screen` se migran a `dvh`, pero **no** se reestructuran.

---

## Verificación

Según la regla de `CLAUDE.md`: Vitest para lógica pura, manual para UI e I/O, por el
flujo local → preview → main.

### Con test automatizado

- `panelMaxHeight()` — aritmética pura, sin DOM
- `scripts/viewport-audit.mjs` — contra archivos de muestra que deben pasar y fallar

### Manual, en iPhone real, sobre preview

Lista de verificación por modal migrado:

1. Se llega al botón de guardar sin que lo tape la barra de Safari
2. Con el teclado abierto, el último campo sigue visible
3. Enfocar un campo no dispara zoom automático
4. El fondo no scrollea mientras el modal está abierto
5. Escape cierra, y el foco vuelve al elemento que lo abrió
6. En PWA instalada, el pie no queda bajo la barra de gestos

**Ningún paso se mergea sin que Diego lo pruebe en su iPhone en preview.** El simulador
no cuenta.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Reestructurar anatomía B cambia el aspecto de modales muy usados | Van en los pilotos, se verifican a ojo antes de las tandas |
| El listener de viewport se comporta distinto entre iOS y Android | `dvh` queda como respaldo; si la capa 3 falla, el modal sigue usable |
| `viewport-fit=cover` descuadra alguna pantalla en PWA | Solo el bottom nav entra al alcance; el resto se revisa si aparece un reporte |
| 20 archivos tocados en una app en producción | Tandas por dominio, PRs revisables, candado hasta el final |

---

## Referencias

- Mockup interactivo (medición en vivo + demos comparativas):
  https://claude.ai/code/artifact/1576877e-6c6c-4c50-a471-70ae91bb1d76
- Primitivo hermano ya en producción: `app/components/ui/ConfirmModal.tsx` (`useConfirm`)
