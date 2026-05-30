# Paywall — flujo de compra mock (Nivel A)

Fecha: 2026-05-30
Rama: `feature/paywall-monetization`

## Objetivo

Permitir testear en un preview de branch la experiencia de compra completa, end-to-end
y visual, sin Stripe real y sin tocar la base de datos. El usuario debe poder:
landing -> Precios -> elegir plan -> (cuenta primero) -> pantalla de pago tipo Stripe
que lo tope antes del acceso -> exito simulado.

Fuera de alcance (fases futuras): Stripe real (`/api/checkout`, webhooks), gating /
entitlements reales (bloquear limites por plan), account-first como hard gate estricto,
Customer Portal.

## Flujo estandar aplicado (SaaS 2026, account-first)

1. Cuenta primero, sin tarjeta para entrar.
2. El checkout se dispara desde la pricing page:
   - sin sesion -> registro/login -> retoma y va al checkout del plan elegido
   - con sesion -> directo al checkout
3. Stripe Checkout hospedado (pagina completa, redirect). El mock imita esa pagina,
   no construye un form propio (eso seria anti-patron).
4. El webhook sera la fuente de verdad (futuro). Hoy: pantalla de exito simulada.

## Cambios

### 1. Landing (`app/page.tsx`)
Agregar entrada "Precios" / "Pricing" al nav desktop y mobile, es/en, apuntando a
`/precios`. Sin otra logica.

### 2. AuthModal (`app/components/auth/AuthModal.tsx`)
Agregar prop opcional `redirectTo?: string` (default `/dashboard`). Reemplazar los dos
`window.location.href = '/dashboard'` por `window.location.href = redirectTo`. Cambio
aditivo y retrocompatible: los usos actuales siguen yendo a `/dashboard`.

### 3. `/precios` (`PreciosClient.tsx`)
Centralizar la accion "ir a pagar" en `goToCheckout(tipo, plan, billing?)`:
- consulta sesion con `supabase.auth.getUser()`
- con sesion -> `router.push('/checkout?tipo=...&plan=...[&billing=...]')`
- sin sesion -> abre AuthModal (registro) con `redirectTo` = esa URL de checkout
- Free -> registro normal (default `/dashboard`)
- Sin Limites -> ContactSalesModal (igual que hoy)

`goToCheckout` es el unico seam que cambia cuando llegue Stripe real: en vez de
`router.push('/checkout?...')` hara `fetch('/api/checkout')` + redirect a la sesion.

### 4. Checkout mock (`app/checkout/page.tsx` + `CheckoutClient.tsx`)
Server component lee `searchParams` (tipo, plan, billing) y pasa al client. El client
resuelve plan y total desde `lib/pricing.ts` (respeta descuentos fundador/anual).
Layout a dos columnas estilo Stripe Checkout hospedado:
- izquierda: resumen del pedido (plan, que incluye, total, cadencia, descuento)
- derecha: esqueleto de formulario de tarjeta (email, tarjeta, MM/AA, CVC, pais), inerte
- banner "Modo prueba - pago simulado - Stripe aun no conectado"
- boton "Pagar $X" -> spinner breve -> `/checkout/exito?...`
- link volver a `/precios`

### 5. Exito mock (`app/checkout/exito/page.tsx`)
"Pago simulado con exito" + plan + nota "aqui Stripe activara tu plan" + boton a
`/dashboard`. No toca DB, no asigna plan real. `/checkout/exito` queda listo para ser
el `success_url` real de Stripe en la fase siguiente.

## Anexo: muro de invitados del anfitrion (Nivel B-lite, sin DB)

Aprobado despues: aplicar el tope Free de 50 personas en la pagina de invitados.
Trial de planner (14 dias) queda fuera porque exige guardar fecha en DB.

- Limite Free = 50, leido de `lib/pricing.ts` (plan free). Cuenta personas totales
  (1 + acompanantes por invitado), igual que el stat existente.
- Deteccion de plan (solo lectura, sin cambios de schema): en `loadEvent` se lee
  `users.plan` del dueno del evento. `pro`/`agency` -> sin limite; `free`/null -> 50.
  Esto da un switch para testear (cambiar plan en Supabase) y es el seam de entitlements.
- Helper `attemptAdd(n)`: si `totalPersonas + n > limite`, abre el modal de upgrade y
  no inserta. Aplicado en las 4 rutas que suman gente: agregar invitado, acompanantes
  en bloque, importar CSV (bloqueo completo si excede) y editar agregando acompanantes.
- `LimitReachedModal` (componente reutilizable): "Llegaste al limite" + "Ver planes"
  -> `/precios?vista=anfitrion` (usuario ya logueado) -> checkout mock.
- Indicador "X / 50 invitados - plan Free" en el header, con color (neutral/ambar/rojo).

## Restricciones del proyecto
- Sin tocar Supabase (schema ni datos).
- Sin instalar paquetes.
- Tailwind, UI en espanol, CTA teal `#48C9B0`, sin emojis, iconos Lucide.
- Reemplazo de archivo completo. Sin push (lo hace Diego).

## Plan de testing (preview del branch)
1. Push -> abrir preview de Vercel.
2. Landing -> "Precios" (desktop y mobile) -> `/precios`.
3. Toggles Anfitrion/Planner y Mensual/Anual.
4. Elegir plan de pago -> pide cuenta (si no hay sesion) -> `/checkout` con plan y total
   correctos (verificar descuento).
5. "Pagar (simulado)" -> `/checkout/exito`. Topo la tarjeta antes del acceso.
6. Free -> registro; Sin Limites -> modal de contacto.
7. Confirmar: nada cobra, nada cambia en DB, banner dice prueba.
