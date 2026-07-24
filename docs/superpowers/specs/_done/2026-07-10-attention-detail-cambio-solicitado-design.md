# Camino B — Detalle del cambio solicitado (`attention_detail`)

Fecha: 2026-07-10
Estado: aprobado, listo para plan de implementacion
Autor: Diego + CTO (Claude)

## Contexto

En el fix de honestidad/precision del agente (main `3f1d646`) se introdujo la
pildora **"Cambio solicitado"** clickable en la lista de invitados: cuando el
agente no puede cumplir una peticion (o marca cualquier atencion), levanta la
bandera `needs_attention` con una `attention_reason`, y la pildora abre la
conversacion del invitado (deep-link `/mensajes?guest=<id>`).

Hueco que cierra este Camino B: la pildora dice el TIPO de atencion (Cambio
solicitado, Queja, Alergia...) pero **no dice QUE dijo el invitado**. El planner
tiene que abrir el chat para enterarse. Queremos mostrar el detalle real —el
mensaje literal— ahi mismo en la lista.

## Decisiones tomadas (brainstorming)

1. **Contenido = mensaje literal del invitado.** Se guarda `update.text` /
   `text` tal cual, no un resumen sintetizado. Razon: la pildora existe porque
   el agente NO pudo interpretar con certeza; sintetizar seria adivinar. El
   mensaje literal siempre esta disponible en el punto exacto de escalamiento,
   nunca miente, y sirve de preview ("ah, pregunta por su esposa") antes de
   abrir el chat completo.
2. **Alcance = todas las razones de atencion** (`alergia`, `queja`, `duda`,
   `peticion`, `otro`), no solo `peticion`. Es el mismo punto de codigo y aporta
   valor en todas (ej. ver el texto de una queja).
3. **Front-end = truncado.** Una linea con elipsis en la lista (card mobile +
   tabla desktop); clamp de 2-3 lineas en el modal de editar. El texto completo
   siempre queda a un click en la conversacion (Camino A ya existente). Un
   mensaje largo NO mueve el layout.
4. **Secuencia Supabase INVERTIDA: el ALTER va PRIMERO.** Ver seccion de
   despliegue.

## Dato

Columna nueva, **aditiva y nullable**:

```sql
ALTER TABLE guests ADD COLUMN attention_detail TEXT;
```

Tipo TypeScript (aditivo, no rompe consumidores):

```ts
// lib/types.ts — interface Guest
attention_detail?: string | null
```

No hay tablas nuevas (regla del proyecto: ya hay 17). Es una columna en una
tabla existente.

## Escritura del detalle

El detalle se escribe = mensaje entrante, **solo cuando ese turno marca
`needs_attention`**. Un turno "limpio" (confirma sin problema) NO toca
`attention_detail` (igual que hoy no limpia `needs_attention`). Si llega un
nuevo mensaje que vuelve a marcar atencion, el detalle se **sobre-escribe** con
el mas reciente (refleja el ultimo pedido sin resolver).

### Path agente (Telegram) — `lib/agent/apply.ts` + webhook

- `applyExtraction(result, guest, members, incomingMessage?)` recibe el mensaje
  entrante como nuevo parametro opcional.
- Cuando `applyExtraction` decide poner `guestUpdate.needs_attention = true`,
  tambien pone `guestUpdate.attention_detail = incomingMessage` (recortado a un
  limite defensivo, ver Edge cases).
- `WritePlan['guestUpdate']` gana el campo opcional `attention_detail?: string`.
- `executeWritePlan` ya escribe `guestUpdate` de forma generica: sin cambios de
  logica, solo fluye el campo nuevo.
- `app/api/webhook/telegram/route.ts` pasa `update.text` como cuarto argumento
  de `applyExtraction`.

Este seam mantiene la cohesion "bandera + detalle" en la funcion pura y es
**testeable con TDD** (unit tests en `apply.test.ts`).

### Path legacy (WhatsApp) — `app/api/webhook/whatsapp/route.ts`

En el bloque que ya arma `updates` (linea ~117-120):

```ts
if (res.needsAttention) {
  updates.needs_attention = true
  updates.attention_reason = res.attentionReason
  updates.attention_detail = text
}
```

## Limpieza del detalle

`onResolveAttention` en `app/events/[id]/page.tsx` ya hace
`needs_attention=false, attention_reason=null`. Se agrega `attention_detail=null`
al update de Supabase y al estado local (guests + editGuest).

## Front-end (3 lugares donde vive la pildora)

Regla: mostrar `guest.attention_detail` SOLO si existe, debajo/junto a la
pildora existente.

1. **Card mobile** (`SwipeableGuestCard`): una linea, `truncate`,
   `text-[11px]` tono `--text-sec`, con `title` = texto completo.
2. **Tabla desktop** (fila inline en `EventPage`): igual, una linea truncada.
3. **Modal editar** (`EditGuestModal`): dentro del bloque de atencion existente,
   el texto con `line-clamp-2` o `line-clamp-3`.

No se toca la logica de la pildora ni el deep-link (Camino A intacto).

## Edge cases

- **Mensaje gigante:** se recorta a un limite defensivo al escribir (ej. 500
  chars) para no guardar textos absurdos; la UI ademas trunca visualmente. El
  chat completo queda en la conversacion.
- **Mensaje vacio / no-texto:** si `incomingMessage` es vacio, no se setea
  `attention_detail` (queda null); la pildora sigue mostrando solo la razon.
- **Guest ya marcado de antes (sin detalle):** filas viejas tendran
  `attention_detail = null`; la UI simplemente no muestra la linea de detalle.
  No hay backfill (no tenemos el mensaje historico de forma confiable).
- **Resolver atencion:** limpia el detalle junto con la bandera.

## Testing

- **TDD (unit, `apply.test.ts`):** `applyExtraction` con `incomingMessage`
  setea `guestUpdate.attention_detail` cuando marca atencion (peticion, alergia,
  queja, duda); NO lo setea en turno limpio; respeta el limite de longitud;
  con mensaje vacio deja el detalle sin setear.
- **UI + webhooks (WhatsApp/Telegram/Supabase):** verificacion manual por el
  flujo local -> preview -> main (norma del proyecto).

## Despliegue (SECUENCIA INVERTIDA — critico)

El codigo LEE (`select` de la lista) y ESCRIBE (`webhook`) la columna. Si el
codigo deployea antes de que la columna exista, la lista de invitados truena en
prod. El `ALTER ADD COLUMN` nullable es inofensivo para el codigo hoy en prod
(lo ignora). Por eso, **excepcion a la regla usual "codigo primero":**

1. Diego corre el `ALTER TABLE guests ADD COLUMN attention_detail TEXT;` en
   Supabase prod.
2. CTO confirma que la columna existe (query read-only).
3. CTO pushea el codigo -> Vercel deployea -> funciona.

## Archivos afectados

- `lib/types.ts` — campo `attention_detail?` en `Guest`.
- `lib/agent/apply.ts` — param `incomingMessage`, campo en `WritePlan`, set en
  `applyExtraction`.
- `lib/agent/apply.test.ts` — tests TDD.
- `app/api/webhook/telegram/route.ts` — pasar `update.text`.
- `app/api/webhook/whatsapp/route.ts` — `updates.attention_detail = text`.
- `app/events/[id]/page.tsx` — render (card + tabla), limpieza en
  `onResolveAttention`.

## Fuera de alcance

- Resumen sintetizado / IA para el detalle (se descarto).
- Backfill de mensajes historicos.
- Detalle por acompanante (la atencion vive a nivel guest).
