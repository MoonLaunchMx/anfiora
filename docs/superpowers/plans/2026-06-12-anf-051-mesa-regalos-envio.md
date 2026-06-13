# ANF-051: Direccion de envio, "Ya lo recibi" y checklist de config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el flujo fisico de mesa de regalos: el planner configura una direccion de entrega, el invitado la ve solo despues de apartar, el WhatsApp del invitado es obligatorio, el planner marca "Ya lo recibi" (abre WhatsApp de agradecimiento) y el tab Configuracion gana una fila de checklist con altura estable.

**Architecture:** Una columna nueva `registry_shipping_address TEXT` en `event_settings` (Supabase). La direccion viaja SOLO en el response del POST de reservacion (`/api/mesa/[token]`), nunca en el GET publico. El flag "recibido" reusa la columna existente `gift_reservations.purchased` (hoy sin uso en UI). Todo lo demas es UI en la pagina del planner (`app/events/[id]/mesa-regalos/page.tsx`) y la publica (`app/mesa/[token]/page.tsx`).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Supabase (browser client + service role en API), Lucide icons. Sin suite de tests (regla MVP): verificacion con `npm run lint`, `npm run build` y prueba manual en `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-06-12-mesa-regalos-envio-recibido-design.md`

---

### Task 0: Columna en Supabase (manual, la corre Diego)

**BLOQUEANTE para ver la feature en local:** el dev local usa la misma DB de Supabase. Sin la columna, el select nuevo del planner falla.

- [ ] **Step 1: Diego corre este SQL en el editor de Supabase**

```sql
ALTER TABLE event_settings ADD COLUMN registry_shipping_address TEXT;
```

Es aditiva y nullable: el codigo actualmente en produccion no la conoce y no se ve afectado. (Excepcion documentada a la regla "codigo primero": codigo nuevo sin columna truena; columna sin codigo es inocua.)

- [ ] **Step 2: Verificar**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'event_settings' AND column_name = 'registry_shipping_address';
```

Expected: 1 fila.

---

### Task 1: API POST devuelve la direccion (solo tras reservar)

**Files:**
- Modify: `app/api/mesa/[token]/route.ts`

El GET publico NO se toca (la direccion nunca se expone ahi). En el POST, la consulta del token se amplia para traer tambien la direccion, y el response final la incluye.

- [ ] **Step 1: Reemplazar la resolucion del token en el POST**

En `POST`, reemplazar estas dos lineas:

```ts
  const db = admin()
  const eventId = await eventIdFromToken(db, token)
  if (!eventId) return NextResponse.json({ error: 'not_found' }, { status: 404 })
```

por:

```ts
  const db = admin()
  const { data: settings } = await db
    .from('event_settings')
    .select('event_id, registry_shipping_address')
    .eq('registry_token', token)
    .maybeSingle()
  const eventId = settings?.event_id || null
  if (!eventId) return NextResponse.json({ error: 'not_found' }, { status: 404 })
```

- [ ] **Step 2: Incluir la direccion en el response de exito**

Reemplazar la ultima linea del POST:

```ts
  return NextResponse.json({ ok: true })
```

por:

```ts
  return NextResponse.json({ ok: true, shipping_address: settings?.registry_shipping_address || null })
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sin errores nuevos en `app/api/mesa/[token]/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/api/mesa/[token]/route.ts
git commit -m "feat(ANF-051): POST de reservacion devuelve direccion de envio"
```

---

### Task 2: Planner — card "Direccion de entrega" en Configuracion

**Files:**
- Modify: `app/events/[id]/mesa-regalos/page.tsx`

- [ ] **Step 1: Importar MapPin**

En el import de lucide-react (linea ~8), agregar `MapPin`:

```ts
import {
  Gift, Plus, Link2, Copy, Check, Trash2, ExternalLink, Coins, Mail, Heart, Eye, Settings, Landmark, Pencil, Clock, MapPin,
} from 'lucide-react'
```

- [ ] **Step 2: Estado nuevo**

Despues de `const [isMobile, setIsMobile] = useState(false)`:

```ts
  const [shippingAddress, setShippingAddress] = useState('')
  const [addrDirty, setAddrDirty]             = useState(false)
  const [addrSaved, setAddrSaved]             = useState(false)
```

- [ ] **Step 3: Cargar la columna**

En `loadData`, ampliar el select de settings:

```ts
        supabase.from('event_settings').select('registry_token, registry_payment_info, registry_external_links, registry_shipping_address').eq('event_id', eventId).maybeSingle(),
```

y despues de `setExtLinks(...)` agregar:

```ts
      setShippingAddress((settings?.registry_shipping_address as string) || '')
```

- [ ] **Step 4: Handler de guardado**

Despues de `handleDeleteExtLink`:

```ts
  const handleSaveAddress = async () => {
    const trimmed = shippingAddress.trim()
    await supabase
      .from('event_settings')
      .update({ registry_shipping_address: trimmed || null })
      .eq('event_id', eventId)
    setShippingAddress(trimmed)
    setAddrDirty(false)
    setAddrSaved(true)
    setTimeout(() => setAddrSaved(false), 2000)
  }
```

- [ ] **Step 5: Card en el tab Configuracion**

La columna derecha del tab config hoy es un solo `<div>` (card de metodos de pago). Envolverla en `<div className="space-y-4">` y agregar la card de direccion debajo. Estructura resultante:

```tsx
          {/* Columna derecha: metodos de pago + direccion de entrega */}
          <div className="space-y-4">
          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
            {/* ...card de metodos de pago existente, sin cambios... */}
          </div>

          <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
            <div className="mb-1 flex items-center gap-2">
              <MapPin size={15} className="text-[#48C9B0]" />
              <h2 className="text-sm font-semibold text-[#1D1E20]">Dirección de entrega</h2>
            </div>
            <p className="mb-3 text-xs text-[#888]">
              Cuando un invitado aparte un regalo y lo compre él mismo, le mostramos esta dirección para el envío.
            </p>
            <textarea
              value={shippingAddress}
              onChange={e => { setShippingAddress(e.target.value); setAddrDirty(true) }}
              rows={3}
              placeholder="Calle y número, colonia, CP, ciudad. Referencias para el repartidor."
              className="w-full resize-none rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1D1E20] outline-none transition focus:border-[#48C9B0]"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[10px] text-[#aaa]">Solo se muestra a invitados que apartan un regalo.</p>
              <button
                onClick={handleSaveAddress}
                disabled={!addrDirty}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#48C9B0] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#3aa896] disabled:opacity-50"
              >
                {addrSaved ? <><Check size={14} /> Guardada</> : 'Guardar dirección'}
              </button>
            </div>
          </div>
          </div>
```

(El cierre del grid `</div>` del tab config queda igual.)

- [ ] **Step 6: Lint + verificacion manual**

Run: `npm run lint`
Manual: en `npm run dev`, tab Configuracion → escribir direccion → Guardar → recargar pagina → persiste.

- [ ] **Step 7: Commit**

```bash
git add app/events/[id]/mesa-regalos/page.tsx
git commit -m "feat(ANF-051): card direccion de entrega en config de mesa de regalos"
```

---

### Task 3: Planner — checklist de setup con altura estable

**Files:**
- Modify: `app/events/[id]/mesa-regalos/page.tsx`

- [ ] **Step 1: Mostrar el toggle de stats tambien en config**

Reemplazar:

```tsx
          {tab !== 'config' && (
            <div className="shrink-0 pt-1 lg:hidden">
              <StatsToggleButton visible={statsToggle.visible} onClick={statsToggle.toggle} />
            </div>
          )}
```

por:

```tsx
          <div className="shrink-0 pt-1 lg:hidden">
            <StatsToggleButton visible={statsToggle.visible} onClick={statsToggle.toggle} />
          </div>
```

- [ ] **Step 2: Fila de checklist para el tab config**

El bloque de stats hoy esta envuelto en `{tab !== 'config' && (<StatsCollapse ...>...)}`. Quitar esa condicion exterior (queda `<StatsCollapse visible={statsToggle.visible}>` siempre) y dentro convertir el ternario `tab === 'regalos' ? (...) : (...)` en:

```tsx
            {tab === 'regalos' ? (
              /* ...grid de stats de regalos existente, sin cambios... */
            ) : tab === 'recibidos' ? (
              /* ...grid de stats de recibidos existente, sin cambios... */
            ) : (
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Método de pago',       done: payMethods.length > 0 },
                  { label: 'Dirección de entrega', done: shippingAddress.trim() !== '' },
                  { label: 'Mesa externa',         done: extLinks.length > 0 },
                ].map(c => (
                  <div key={c.label} className="rounded-xl border border-[#e8e8e8] bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">{c.label}</p>
                    <p className={`mt-1 flex items-center gap-1.5 text-xl font-bold ${c.done ? 'text-[#1a9e88]' : 'text-[#bbb]'}`}>
                      {c.done ? <><Check size={18} /> Listo</> : <><Clock size={18} /> Pendiente</>}
                    </p>
                  </div>
                ))}
              </div>
            )}
```

Nota: la card usa el mismo contenedor y tipografia (`p-3`, label 10px, valor `text-xl font-bold` con `mt-1`) que las stats de los otros tabs, para que la altura del header no cambie al cambiar de tab.

- [ ] **Step 3: Lint + verificacion manual**

Run: `npm run lint`
Manual: cambiar entre los tres tabs → la zona superior no brinca de altura; los checks reflejan metodo de pago / direccion / mesa externa al agregarlos y quitarlos.

- [ ] **Step 4: Commit**

```bash
git add app/events/[id]/mesa-regalos/page.tsx
git commit -m "feat(ANF-051): checklist de setup en tab config con altura estable"
```

---

### Task 4: Invitado — WhatsApp obligatorio + direccion tras apartar

**Files:**
- Modify: `app/mesa/[token]/page.tsx`

- [ ] **Step 1: Importar MapPin**

En el import de lucide-react (linea ~5):

```ts
import { Gift, Coins, Mail, ExternalLink, Check, X, Heart, Copy, Landmark, MapPin } from 'lucide-react'
```

- [ ] **Step 2: Estado para la direccion en ReserveModal**

Despues de `const [copiedId, setCopiedId] = useState<string | null>(null)`:

```ts
  const [shippingAddress, setShippingAddress] = useState<string | null>(null)
```

- [ ] **Step 3: Capturar la direccion del response del POST**

En `submit`, reemplazar:

```ts
      if (!res.ok) { setError('No se pudo registrar. Intenta de nuevo.'); setSubmitting(false); return }
      onReserved(item, amountToSend)
      setStep('done')
```

por:

```ts
      if (!res.ok) { setError('No se pudo registrar. Intenta de nuevo.'); setSubmitting(false); return }
      const data = await res.json().catch(() => null)
      setShippingAddress(data?.shipping_address || null)
      onReserved(item, amountToSend)
      setStep('done')
```

- [ ] **Step 4: WhatsApp obligatorio**

En `handleContinue`, despues de la validacion del nombre, agregar:

```ts
    if (phone.length < 8) { setError('Déjanos tu WhatsApp para poder agradecerte'); return }
```

(El estado `phone` ya guarda solo digitos.)

- [ ] **Step 5: Helper para copiar la direccion**

Despues de `copyValue`:

```ts
  const copyAddress = async () => {
    if (!shippingAddress) return
    await navigator.clipboard.writeText(shippingAddress)
    setCopiedId('address')
    setTimeout(() => setCopiedId(null), 2000)
  }
```

- [ ] **Step 6: Card de direccion en la pantalla de confirmacion**

En el bloque `step === 'done'`, justo ANTES del bloque `{isBuy && choice !== 'deposit' && item.external_url && (` (boton "Ir a la tienda"), insertar:

```tsx
              {isBuy && choice !== 'deposit' && shippingAddress && (
                <div className="mx-auto mt-5 max-w-xs rounded-xl border border-[#eee4d6] bg-[#FBF7F0] p-4 text-left">
                  <div className="mb-2 flex items-center gap-1.5 text-[#1a9e88]">
                    <MapPin size={14} />
                    <p className="text-[11px] font-semibold uppercase tracking-wider">Envíalo a esta dirección</p>
                  </div>
                  <p className="whitespace-pre-line text-xs leading-relaxed text-[#1D1E20]">{shippingAddress}</p>
                  <button
                    onClick={copyAddress}
                    className="mt-2.5 flex items-center gap-1 rounded-md border border-[#e0d9cc] bg-white px-2 py-1 text-[10px] font-medium text-[#666] transition hover:border-[#48C9B0] hover:text-[#48C9B0]"
                  >
                    {copiedId === 'address' ? <><Check size={11} /> Copiada</> : <><Copy size={11} /> Copiar dirección</>}
                  </button>
                </div>
              )}
```

- [ ] **Step 7: Subtexto de "Lo compro yo en la tienda"**

En el paso `choose`, reemplazar:

```tsx
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#888]">
                      Te llevamos al link del producto para que lo compres directo.
                    </span>
```

por:

```tsx
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#888]">
                      Te llevamos al link del producto y te mostramos a dónde enviarlo.
                    </span>
```

- [ ] **Step 8: Lint + verificacion manual**

Run: `npm run lint`
Manual en dev: apartar "lo regalo" sin telefono → bloquea con error; con telefono → confirma y muestra card de direccion con copiar; "les deposito" → NO muestra direccion; `curl http://localhost:3000/api/mesa/<token>` → el JSON no contiene `shipping_address`.

- [ ] **Step 9: Commit**

```bash
git add app/mesa/[token]/page.tsx
git commit -m "feat(ANF-051): whatsapp obligatorio y direccion de envio tras apartar"
```

---

### Task 5: Planner — boton "Ya lo recibi" + agradecer en un gesto

**Files:**
- Modify: `app/events/[id]/mesa-regalos/page.tsx`

- [ ] **Step 1: Handler**

Despues de `thankByWhatsApp`:

```ts
  const handleReceived = async (r: GiftReservation, gift: GiftRegistryItem | undefined) => {
    if (r.guest_phone) window.open(waThanksUrl(r, gift), '_blank', 'noopener,noreferrer')
    const thanked = r.guest_phone ? true : r.thanked
    await supabase.from('gift_reservations').update({ purchased: true, thanked }).eq('id', r.id)
    setReservations(prev => prev.map(x => x.id === r.id ? { ...x, purchased: true, thanked } : x))
  }
```

(Se abre WhatsApp ANTES del await para no perder el gesto del usuario con el popup blocker — mismo orden que `thankByWhatsApp`.)

- [ ] **Step 2: Stat de entregados**

Junto a `const thankedCount = ...`:

```ts
  const receivedCount = reservations.filter(r => r.purchased).length
```

En el grid de stats del tab recibidos, cambiar `sm:grid-cols-4` por `sm:grid-cols-5` y agregar al final:

```tsx
                <div className="rounded-xl border border-[#e8e8e8] bg-white p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">Entregados</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-[#1D1E20]">
                    {receivedCount}<span className="ml-1 text-xs font-medium tabular-nums text-[#aaa]">de {reservations.length}</span>
                  </p>
                </div>
```

- [ ] **Step 3: Boton en cards mobile**

En la card mobile de reservacion, despues del bloque `{r.message && (...)}`, agregar:

```tsx
                    <div className="mt-2">
                      {r.purchased ? (
                        <span className="flex w-full items-center justify-center gap-1 rounded-lg border border-[#c8ede7] bg-[#f0fdfb] px-3 py-1.5 text-[11px] font-semibold text-[#1a9e88]">
                          <Check size={12} /> Recibido
                        </span>
                      ) : (
                        <button
                          onClick={() => handleReceived(r, gift)}
                          className="flex w-full items-center justify-center gap-1 rounded-lg bg-[#48C9B0] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#3aa896]"
                        >
                          <Gift size={12} /> Ya lo recibí
                        </button>
                      )}
                    </div>
```

- [ ] **Step 4: Columna en tabla desktop**

En el `<thead>`, despues de `<th ...>Monto</th>` agregar:

```tsx
                    <th className="px-4 py-2.5 font-semibold">Recibido</th>
```

En el `<tbody>`, despues de la celda de Monto agregar:

```tsx
                        <td className="px-4 py-3">
                          {r.purchased ? (
                            <span className="flex w-fit items-center gap-1 rounded-full border border-[#c8ede7] bg-[#f0fdfb] px-2.5 py-1 text-[11px] font-medium text-[#1a9e88]">
                              <Check size={12} /> Recibido
                            </span>
                          ) : (
                            <button
                              onClick={() => handleReceived(r, gift)}
                              className="flex items-center gap-1 rounded-full bg-[#48C9B0] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#3aa896]"
                            >
                              Ya lo recibí
                            </button>
                          )}
                        </td>
```

- [ ] **Step 5: Lint + verificacion manual**

Run: `npm run lint`
Manual: en tab Recibidos, "Ya lo recibí" abre WhatsApp con la plantilla, el boton pasa a badge "Recibido", el contador Entregados sube y el estado de agradecimiento queda en verde. Reservacion sin telefono: solo marca recibido.

- [ ] **Step 6: Commit**

```bash
git add app/events/[id]/mesa-regalos/page.tsx
git commit -m "feat(ANF-051): boton ya lo recibi con agradecimiento por whatsapp"
```

---

### Task 6: Build final y verificacion end-to-end

- [ ] **Step 1: Build de produccion**

Run: `npm run build`
Expected: build exitoso sin errores de tipos.

- [ ] **Step 2: Recorrido completo en dev**

Run: `npm run dev`

1. Config: guardar direccion, recargar, persiste. Checklist con 3 estados correctos. Altura estable entre tabs.
2. Invitado (`/mesa/<token>`): apartar sin telefono bloquea; con telefono pasa; "lo compro yo" muestra direccion + copiar; "les deposito" no la muestra.
3. `curl http://localhost:3000/api/mesa/<token>` no contiene la direccion.
4. Recibidos: "Ya lo recibí" abre WhatsApp, badge y stats se actualizan.
