# ANF-049 — Mesa de regalos — Design Spec

**Fecha:** 2026-06-10
**Branch:** `feature/ANF-049-mesa-regalos` (desde `main`)
**Path:** A — captura de intencion de regalo, SIN procesar pagos. Anfiora nunca toca dinero.

---

## 1. Objetivo
Que el anfitrion arme una mesa de regalos y la comparta; que el invitado **aparte** regalos o **registre intencion** de aporte. La compra/transferencia ocurre **fuera de Anfiora** (honor-system, como un registry de Liverpool/Amazon). No hay pasarela de pago.

## 2. Origen
Prototipo de Cloud Design (React/Babel standalone) con 3 vistas: publica (invitado), recibidos (anfitrion), config. Se **adapta al estilo real de Anfiora** (Tailwind, tokens de globals.css, Lucide, modales, transiciones existentes) — NO se reescribe el look, se viste con lo que ya hay. Se descarta `tweaks-panel.jsx` (chrome del design tool) y `icons.jsx` (hechos a mano -> Lucide).

## 3. Tipos de regalo (reinterpretados como intencion)
- **external:** item con link a tienda externa. Invitado pulsa "Yo lo regalo" -> se marca apartado -> abre el link. Opcional toggle "Ya lo compre" (honor-system, sin verificacion real).
- **fund:** fondo monetario con meta. Invitado registra "me comprometo con $X" (intencion). Progreso = suma de aportes, calculado, no se cobra.
- **cash:** sobre libre. Invitado registra "dare $X en efectivo".

## 4. Modelo de datos (2 tablas + 1 columna; nada de JSONB)

**`gift_registry_items`** (regalos del anfitrion)
`id, event_id (FK events), type ('external'|'fund'|'cash'), title, description, category, image_url, external_url, store, price, target_amount, created_at`

**`gift_reservations`** (intencion del invitado)
`id, item_id (FK items), event_id (FK events), guest_id (FK guests, nullable), guest_name, guest_phone (nullable), amount (nullable), message (nullable), purchased (bool), thanked (bool), created_at`

**`event_settings.registry_token`** (text, nullable) — token del link publico, mismo patron que `playlist_token`.

Derivados (calculados en cliente, no guardados): progreso de fund = suma de `amount` de sus reservations; "apartado" = existe reservation para ese item.

RLS: se replica el patron de `song_recommendations` (tabla que ya permite inserts publicos del invitado sin login). Se confirma con inspeccion read-only antes de finalizar policies.

## 5. Rutas (patrones existentes)
- **Anfitrion:** `/events/[id]/mesa-regalos` (dentro del nav del evento).
- **Invitado (publico, sin login):** `/mesa/[token]` — patron de `playlist/[token]`.

## 6. Tipos TS
Agregar a `lib/types.ts`: `GiftRegistryItem`, `GiftReservation`, `GiftType = 'external'|'fund'|'cash'`. `event_settings.registry_token` al tipo `EventSettings`.

## 7. Fases
1. **Schema** (este doc + SQL) — Diego corre el SQL. Aditivo/inerte (tablas nuevas no las referencia nada hasta shippear).
2. **Vista anfitrion** `/events/[id]/mesa-regalos`: alta de regalos (modal 3 tipos), compartir link, lista admin, agradecer. Local primero.
3. **Vista publica** `/mesa/[token]`: hero, lista, modal de apartar/aportar.
4. **Nav + entrada**: item en el nav del evento.
5. **WhatsNew**: release nuevo en `lib/changelog.ts` -> el `WhatsNewModal` anuncia la feature solo.

## 8. Reglas
- Sin pagos, sin Stripe. Solo Tailwind, UI en espanol, sin emojis, mobile first, Lucide.
- Codigo completo, archivo entero. Commits en ingles sin acentos.
- Local -> preview -> (Diego testea) -> main con su OK. SQL lo corre Diego.
