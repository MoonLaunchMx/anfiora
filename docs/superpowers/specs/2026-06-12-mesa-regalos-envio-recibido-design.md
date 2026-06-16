# Mesa de regalos: direccion de envio, "Ya lo recibi" y checklist de configuracion

**Fecha:** 2026-06-12
**Contexto:** ANF-049 (mesa de regalos) esta en produccion. Falta cerrar el flujo fisico: cuando un invitado aparta un regalo de tienda y lo compra el mismo, nunca ve a donde enviarlo. Tampoco existe forma de marcar que el regalo llego y agradecer en un solo gesto. Ademas, el tab Configuracion no tiene stats y la zona superior brinca de altura al cambiar de tab.

## Alcance

1. Direccion de entrega configurable por el planner.
2. Mostrar la direccion al invitado solo despues de apartar.
3. WhatsApp del invitado obligatorio al reservar.
4. Boton "Ya lo recibi" que marca recibido y abre WhatsApp con agradecimiento.
5. Checklist de setup como fila de stats en el tab Configuracion (altura estable entre tabs).

Fuera de alcance: scraping de Amazon (bloqueado por IP de datacenter, documentado aparte), notificaciones automaticas, tracking de paqueteria.

## Cambio en DB (Supabase)

Una sola columna nueva, aditiva y nullable:

```sql
ALTER TABLE event_settings ADD COLUMN registry_shipping_address TEXT;
```

**Orden de deploy:** correr el ALTER primero (una columna sin uso no rompe el codigo en prod), despues pushear el codigo que la consulta. Es la excepcion correcta a la regla "codigo primero" porque el codigo nuevo falla si la columna no existe, mientras que la columna sin codigo es inocua.

No se toca `gift_reservations`: el flag de recibido reusa la columna existente `purchased` (boolean, default false, hoy sin uso en UI).

## 1. Direccion de entrega (planner)

En `app/events/[id]/mesa-regalos/page.tsx`, tab Configuracion, nueva card **"Direccion de entrega"** junto a metodos de pago y mesas externas:

- Un textarea de texto libre (calle, numero, colonia, CP, ciudad, referencias). Sin campos estructurados: solo se muestra, no se procesa.
- Guarda en `event_settings.registry_shipping_address` via el cliente browser de Supabase (mismo patron que `registry_payment_info`).
- Nota de privacidad bajo el campo: "Solo se muestra a invitados que apartan un regalo".
- Vacio = la mesa funciona igual que hoy (el invitado no ve nada de direccion).

## 2. Direccion visible para el invitado (solo tras apartar)

**Privacidad real:** la direccion NO viaja en el `GET /api/mesa/[token]` (cualquiera con el link puede llamarlo). El `POST /api/mesa/[token]` (crear reservacion) consulta `registry_shipping_address` y la devuelve en su response: `{ ok: true, shipping_address: string | null }`.

En `app/mesa/[token]/page.tsx` (`ReserveModal`):

- En la pantalla de confirmacion (`step === 'done'`), cuando el invitado eligio comprar el mismo (`isBuy && choice !== 'deposit'`, misma condicion que el boton "Ir a la tienda") y `shipping_address` no es null: card **"Envialo a esta direccion"** con la direccion y boton copiar. Mismo patron visual que la card de metodos de pago (`border-[#eee4d6] bg-[#FBF7F0]`).
- En la opcion "Lo compro yo en la tienda" del paso `choose`, el subtexto menciona que al confirmar se muestra la direccion de envio.

## 3. WhatsApp obligatorio

En `ReserveModal`, el telefono pasa de opcional a requerido para todos los tipos (regalo, aporte, sobre):

- Validacion en `handleContinue`: minimo 8 digitos. Error: "Dejanos tu WhatsApp para poder agradecerte".
- Se actualiza el hint bajo el campo (ya no es opcional).

Reservaciones viejas sin telefono siguen siendo validas (la columna sigue nullable).

## 4. "Ya lo recibi" + agradecer en un gesto

En el tab Recibidos del planner (`mesa-regalos/page.tsx`), cada reservacion con `purchased = false` muestra boton **"Ya lo recibi"**:

- Marca `purchased = true` y `thanked = true` en `gift_reservations`.
- Si la reservacion tiene telefono, abre `wa.me` con la plantilla existente de `waThanksUrl` (saludo + gracias por el regalo/aporte/sobre).
- Si no tiene telefono (registros viejos), solo marca recibido y no toca `thanked`.
- Reservaciones ya recibidas muestran badge "Recibido" (check verde `#1a9e88`).
- Aplica a todos los tipos: regalo fisico, deposito, aporte y sobre ("recibi tu deposito").

Stats del tab Recibidos: se agrega contador de entregados (`purchased`) junto a los existentes, manteniendo el grid actual.

## 5. Checklist de setup en tab Configuracion

Hoy las stats se ocultan cuando `tab === 'config'` y el header brinca de altura. El tab Configuracion tendra su propia fila de stats con el mismo patron y altura (`rounded-xl border border-[#e8e8e8] bg-white p-3`), en modo checklist:

| Card | Completo cuando |
|---|---|
| Metodo de pago | `registry_payment_info` tiene al menos un metodo |
| Direccion de entrega | `registry_shipping_address` con valor |
| Mesa externa | `registry_external_links` tiene al menos un link |

- Completo: icono check y acento verde `#1a9e88`.
- Pendiente: gris con icono de pendiente.
- `StatsCollapse`/`StatsToggleButton` aplican igual que en los otros tabs.

## Tipos (lib/types.ts)

- `GiftReservation` ya tiene `purchased` y `thanked`: sin cambios.
- La pagina del planner no usa un tipo compartido para settings (lee campos sueltos del select); agrega un estado local `shippingAddress: string` y suma la columna al select existente.

## Errores y casos borde

- Direccion no configurada: el POST devuelve `shipping_address: null` y el invitado no ve la card.
- El POST sigue respondiendo `{ ok: true }` aunque falle la lectura de settings (la reservacion ya se guardo; la direccion es secundaria).
- `purchased` y `thanked` se actualizan con el patron optimista existente (update + setState local).

## Verificacion

Sin suite de tests (regla MVP). Verificacion manual en local:

1. Configurar direccion en el tab Configuracion y recargar (persiste).
2. Checklist refleja los tres estados al agregar/quitar metodo, direccion y mesa externa; la altura del header no cambia entre tabs.
3. Como invitado: apartar regalo "lo compro yo" sin telefono (bloquea), con telefono (pasa) y ver la card de direccion con copiar.
4. Apartar con "les deposito" no muestra direccion.
5. GET publico del API no contiene la direccion (curl).
6. "Ya lo recibi" abre WhatsApp con plantilla, marca recibido y agradecido; badge y stats se actualizan.
