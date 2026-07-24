# Modo de acceso, cupo y precio en la creacion del evento (diseno)

Fecha: 2026-07-14
Estado: aprobado para plan
Ticket: ANF-054 (el ultimo usado fue ANF-053, la RLS de event_collaborators)

## 1. Problema y objetivo

Anfiora nacio para bodas, donde el anfitrion arma una lista curada y cada invitado recibe su
invitacion. Pero la plataforma ya cubre 17 tipos de evento, y muchos de ellos no funcionan asi:
una conferencia, un congreso o una fiesta no tienen lista curada, tienen un link que se comparte
y una lista que se llena sola.

Hoy el evento no sabe responder la pregunta mas basica de todas: **como entra la gente**. Este
spec agrega esa pregunta a la creacion del evento, junto con las dos cosas que cuelgan de ella:
cuanta gente cabe y cuanto cuesta entrar.

Objetivo de esta fase: **guardar** los tres campos. Nada los lee todavia.

## 2. Decision de fondo: el evento es la puerta

La rama `feat/forms` (13 commits, sin pushear, SQL sin aplicar) construyo un tipo **Registro**:
un link publico sin login donde cualquiera se apunta y se vuelve invitado, con dedupe por
telefono. Su propio spec dice que "arranca abierto" y que "el interruptor de aprobacion queda
para despues".

Eso es **la misma mecanica** que `access_mode='abierta'` / `'aprobacion'`. El interruptor de
aprobacion que Forms dejo pendiente *es* `access_mode`. Y los tipos que Forms decia atacar
(fiestas, despedidas, corporativo, no bodas) son exactamente los que este spec mapea a
`abierta`/`aprobacion`, contra bodas -> `privada`.

**Decision: el evento es el unico dueno del registro publico.**

- El evento tiene UNA puerta de entrada, definida por `access_mode`.
- `guest_cap` y `ticket_price` viven en el evento, no en un formulario.
- **Forms se queda solo con Votacion** (que no crea invitados y no toca la puerta de entrada).
- La rama `feat/forms` se **congela como donante**: no se mergea, no se corre su SQL, no se
  borra. Cuando se construya la pagina publica del evento se canibaliza de ahi el dedupe por
  telefono, el alta de invitado + acompanantes y la pagina publica con tema heredado.
- Votacion sale despues, en su propio PR.

Descartado: que `access_mode='abierta'` auto-cree una fila `forms` type='registro' (deja dos
duenos del cupo y dos caminos que escriben a `guests`), y que ambos convivan (dos links que
crean invitados = carreras de dedupe y confusion para el anfitrion).

## 3. Los tres modos de acceso

| Modo | Que significa | Cupo y precio |
|---|---|---|
| `privada` | Invitacion directa: el planner arma la lista, cada invitado tiene su link. | **No aplican** |
| `aprobacion` | Un link. Se registran solos pero caen como solicitud y el anfitrion aprueba. | Opcionales |
| `abierta` | Un link. Cualquiera se registra, la lista se llena sola. | Opcionales |

**Regla dura:** cupo y precio SOLO existen en `aprobacion` y `abierta`. En `privada` se guardan
como `NULL` siempre, aunque el usuario haya escrito algo antes de cambiar de modo.

- `guest_cap`: maximo de personas que pueden inscribirse. Vacio = sin limite.
- `ticket_price`: precio del boleto en `events.currency`. Vacio = gratis.

## 4. Modelo de pago: captura de intencion

**Anfiora NO procesa pagos, NO cobra, NO retiene dinero.** Solo guarda y muestra el monto. El
anfitrion cobra por fuera. Es el mismo modelo que ya usa la mesa de regalos.

La UI lo dice explicitamente en el campo de precio:

> "Anfiora no procesa el pago. Tú recibes el dinero directo."

Cualquier cobro real (Stripe Connect, tracking de "pagado", conciliacion) esta fuera de alcance
y no se insinua en la UI.

## 5. Mapeo tipo -> acceso (los 17 tipos)

| Acceso | Tipos |
|---|---|
| `privada` | boda, xv, bautizo, graduacion |
| `aprobacion` | despedida, capacitacion, teambuilding, lanzamiento, asamblea, retiro, campamento, otro |
| `abierta` | cumpleanos, fiesta, conferencia, congreso, caridad |

Fallback (tipo desconocido o null): `aprobacion`.

**Dos desviaciones deliberadas de la regla gruesa del ticket**, documentadas para que nadie las
"corrija" despues:

1. **conferencia, congreso y caridad van a `abierta`, no a `aprobacion`.** La regla gruesa decia
   "todo corporativo e impacto -> aprobacion", pero esos tres son justo los eventos que existen
   para vender boletos y llenar un cupo. Mandarlos a `aprobacion` obliga al anfitrion a palomear
   a mano a cientos de personas que ya pagaron.
2. **xv, bautizo y graduacion van a `privada`, no solo boda.** Tienen el mismo perfil exacto que
   la boda: lista curada por la familia, mesas, dress code, invitacion por invitado. La regla
   gruesa solo nombraba bodas porque se escribio pensando en bodas.

El mapeo vive como **dato**, no como cadena de `if`: se agrega `defaultAccessMode` a cada entrada
de `EVENT_TYPES`, igual que ya existe `defaultFeatures`.

## 6. Flujo de creacion: 4 pasos

El modal pasa de 3 a **4 pasos**:

```
1. Tipo  ->  2. Datos  ->  3. Acceso  ->  4. Herramientas
```

**Esto contradice el ticket original**, que decia "mantiene 3 pasos, NO agregar paso 4". La
instruccion se reviso al ver el diseno: meter Acceso dentro del paso de Herramientas junta dos
preguntas que no tienen nada que ver ("como entra la gente" es una decision de producto;
"que herramientas uso" es palomear una lista), y produce una pantalla de 3 tarjetas + 2 campos +
7 toggles que en movil entierra las herramientas bajo el pliegue.

Con 4 pasos cada pantalla es una sola pregunta y cabe sin scroll. El costo es un clic mas en el
camino critico, y se considera aceptable porque los cuatro pasos vienen precargados: el tipo
decide el acceso, el acceso decide su default, y las herramientas ya vienen palomeadas. Se puede
crear un evento dandole "Siguiente" cuatro veces.

### Paso 3 — Acceso

- Titulo: "¿Cómo confirmas invitados?" / subtitulo: "Define quién puede sumarse a tu evento"
- Las 3 tarjetas seleccionables, con `getDefaultAccessMode(tipo)` pre-seleccionada y badge
  "Recomendado" (el mismo badge dorado que ya usan los toggles de herramientas).
- Si el acceso es `aprobacion` u `abierta`: debajo, pegados al acceso, "Cupo máximo" (opcional) y
  "Precio del boleto" (opcional, con la nota de intencion). Inputs numericos nativos.
- Si el acceso es `privada`: ambos campos ocultos, y en su lugar la linea:
  > "Este evento va por lista de invitados: sin cupo ni cobro."

  **El copy es generico a proposito.** El ticket pedia "Las bodas no llevan cobro ni cupo", pero
  `privada` ahora incluye XV, bautizo y graduacion. Un bautizo no es una boda.

### Paso 4 — Herramientas

Los toggles actuales, **intactos**, en su propia pantalla. Sin cambios funcionales.

### Nombre del paso

Se llama **Acceso**, no "Invitación". En este mismo modal, dentro de Herramientas, ya existe una
feature llamada Invitacion (la invitacion digital por invitado). Dos cosas con el mismo nombre en
el mismo modal confunden. "Acceso" ademas es la palabra que usa el modelo de datos.

### Moneda

`ticket_price` se captura en `events.currency`, pero **el modal no captura moneda**: el insert no
manda `currency` y la base cae a su default `MXN`. Por eso el campo va etiquetado `MXN` fijo. Si
algun dia se captura moneda al crear, el campo la sigue sin cambios de schema.

## 7. Modelo de datos

Aditivo, sin tablas nuevas (seguimos en 17), sin RLS nuevo.

```sql
ALTER TABLE event_settings ADD COLUMN access_mode text;
ALTER TABLE events ADD COLUMN guest_cap int;
ALTER TABLE events ADD COLUMN ticket_price numeric;
```

Las tres nullable.

**El split entre las dos tablas es deliberado**, anotado para que nadie lo "arregle":
`access_mode` es configuracion y vive junto a `enabled_features`; `guest_cap` y `ticket_price`
son datos del evento y viven junto a `total_guests` y `currency`.

### Orden de despliegue: migracion PRIMERO, deploy despues

**Esto invierte la regla critica de `CLAUDE.md`** ("nunca modificar el schema en Supabase sin
tener el codigo ya pusheado"), y la inversion es correcta aqui:

- Si el codigo va primero: el insert de `access_mode` en `event_settings` apunta a una columna
  que no existe -> **la creacion de eventos revienta en produccion para todos**.
- Si la migracion va primero: las columnas existen y nadie las escribe todavia. Inofensivo.

La regla de `CLAUDE.md` protege el caso contrario: agregar un valor de enum que el codigo viejo
no sabe pintar (tipo un `rsvp_status` nuevo sin su entrada en `STATUS_LABEL`). Aqui son columnas
nullable que nadie lee y que el codigo nuevo necesita escribir. El criterio real es:
**la migracion va primero cuando el codigo nuevo escribe columnas nuevas; el codigo va primero
cuando el dato nuevo necesita que el codigo viejo ya sepa interpretarlo.**

## 8. Codigo

Sigue el patron que ya existe para features, en vez de inventar uno nuevo.

| Archivo | Cambio |
|---|---|
| `lib/event-types.ts` | Agregar `defaultAccessMode: AccessMode` a `EventTypeConfig` y a los 17 tipos. |
| `lib/features.ts` | `getDefaultAccessMode(type)` (espejo de `getDefaultFeatures`), `resolveAccessMode(type, guardado)` (espejo de `resolveFeatures`, para lecturas tolerantes), `normalizeAccessFields()`. |
| `lib/features.test.ts` | Vitest sobre `normalizeAccessFields`, el mapeo completo y el fallback. |
| `lib/types.ts` | Tipo `AccessMode`; campos `guest_cap`, `ticket_price` en `Event`; `access_mode` en `EventSettings`. |
| `app/components/NewEventModal.tsx` | 4 pasos; estado de acceso/cupo/precio; paso 3 nuevo; insert. |

### Contratos

```ts
export type AccessMode = 'privada' | 'aprobacion' | 'abierta'

// Default por tipo. Lee EVENT_TYPES[].defaultAccessMode. Fallback: 'aprobacion'.
export function getDefaultAccessMode(eventTypeValue: string | null): AccessMode

// Lectura tolerante para eventos viejos (columna null).
export function resolveAccessMode(
  eventTypeValue: string | null,
  stored: string | null | undefined,
): AccessMode

// Logica pura: la regla dura de privada + los vacios, en un solo lugar testeable.
export function normalizeAccessFields(input: {
  accessMode: AccessMode
  guestCap: string
  ticketPrice: string
}): { guest_cap: number | null; ticket_price: number | null }
```

`normalizeAccessFields` devuelve `{ guest_cap: null, ticket_price: null }` si el modo es
`privada`, si el campo viene vacio, o si el valor no es un numero valido. Cupo: entero > 0.
Precio: numero >= 0.

### Insert

```ts
// events  — junto a total_guests
...normalizeAccessFields({ accessMode, guestCap, ticketPrice })

// event_settings — junto a enabled_features
access_mode: accessMode
```

### Lecturas tolerantes

Eventos viejos tienen las tres columnas en `NULL`. Quien las lea usa
`resolveAccessMode(event_type, access_mode)`, `guest_cap ?? null`, `ticket_price ?? null`.
Ningun evento existente cambia de comportamiento: nada consume estos campos en esta fase.

## 9. Fuera de alcance

Todo esto es de fases posteriores y **no entra en este PR**:

- **Editar el acceso en `/events/[id]/configuracion`.** Ver seccion 10: es bloqueante de la fase 2.
- La pagina publica del evento (`/e/[token]`), canibalizando el registro de `feat/forms`.
- Hacer valer el cupo al registrarse (aqui solo se GUARDA).
- La logica de aprobacion de solicitudes.
- Consumir `access_mode` / `guest_cap` / `ticket_price` en la invitacion o el registro publico.
- Cualquier procesamiento de pago, Stripe Connect, cobro real o tracking de "pagado".
- Capturar moneda en la creacion.
- Forms: el PR de Votacion, y la cirugia que quita Registro.

## 10. Fases y la deuda de editabilidad

**Fase 1 (este spec):** guardar `access_mode`, `guest_cap`, `ticket_price` al crear.

**Fase 2 (despues):**
1. **Editar el acceso en `/configuracion` — BLOQUEANTE.** Debe shipear ANTES que cualquier cosa
   que lea `access_mode`.
2. Pagina publica del evento.
3. Hacer valer el cupo.

`access_mode` solo se escribe al crear y no hay forma de cambiarlo despues. Hoy eso no le hace
dano a nadie porque nada lee la columna: un default equivocado es invisible. **El dia que la
pagina publica lea `access_mode`, ese hueco se vuelve una trampa**: un anfitrion cuyo evento
nacio con el modo equivocado queda atorado sin salida, y con `privada` es peor todavia porque la
regla dura le prohibe cupo y precio de forma permanente.

Por eso: **no se puede shipear una puerta que el anfitrion no puede cambiar.**

## 11. Verificacion

- **Vitest** (logica pura): `normalizeAccessFields` (regla dura de privada, vacios, negativos,
  no-numeros), el mapeo de los 17 tipos, el fallback, y `resolveAccessMode` con columna null.
- **`tsc --noEmit`** y **`eslint`** limpios.
- **Manual** (local -> preview -> main): crear una boda y verificar que no aparecen cupo ni
  precio y que las tres columnas quedan `NULL`/`'privada'`; crear una conferencia con cupo y
  precio y verificar que se guardan; llenar cupo y precio y luego cambiar a `privada` para
  confirmar que se guardan `NULL`; crear un evento sin tocar nada para confirmar que los defaults
  entran; confirmar que un evento viejo sigue abriendo bien.

## 12. Reglas de UI

Mobile first. Espanol **con acentos**. Sin emojis. Solo Tailwind. Iconos Lucide. Accent teal
`#48C9B0` solo en CTA y seleccion. Texto `#1D1E20`. Bordes `#e8e8e8`. Inputs numericos nativos
para cupo y precio.

## 13. Git

- Worktree propio (no trabajar en el checkout principal).
- Rama: `feature/ANF-054-event-access-cap-price`, desde `origin/main` (no desde `feat/forms`).
- Commit: `feat(events): add access mode, guest cap and ticket price to creation`
- PR normal, sin plantilla: **el repo no tiene `CONTRIBUTING.md`** (el ticket original lo daba por
  existente). **Sin pushear a main.**
- `feat/forms` no se toca: queda congelada como donante.
