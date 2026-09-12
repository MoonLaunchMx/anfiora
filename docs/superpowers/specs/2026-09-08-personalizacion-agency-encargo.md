# Encargo: personalizacion de la app para el plan Agency

**Fecha:** 8 de septiembre de 2026
**Para:** el agente que tome el epic de whitelabel
**Estado:** encargo listo para arrancar. Falta que Diego cierre UNA pregunta (abajo, §6)

Este documento existe para que no vuelvas a investigar lo que ya se investigo. Leelo completo antes de tocar nada. Si algo aqui contradice al codigo, gana el codigo: verifica antes de afirmar.

---

## 1. Que es el epic, en una linea

Que la agencia que paga el plan Agency **vea su marca, no la de Anfiora, en todo lo que le manda a sus clientes e invitados**.

## 2. Lo que YA quedo decidido, y no se re-abre

| # | Decision |
|---|---|
| 1 | **La invitacion NO entra al epic.** Se sigue personalizando por evento con los vibes que escoge la novia, exactamente como hoy. Diego: "lo de la invitacion que es lo mas basico se personaliza como ahorita". No hay pelea de precedencia que resolver: la pregunta no aplica |
| 2 | El alcance son **las superficies publicas y los documentos**: playlist publica, mesa de regalos, puerta, invitacion a colaborador, OG al compartir, PDF y Excel, y el dominio |
| 3 | **Agency ya existe en el catalogo** (`lib/workspace/planes.ts`) con `whitelabel: true`. No hay que inventar el plan ni el precio: Agency $1,990 al mes, 3 asientos incluidos, $290 por asiento extra |
| 4 | El plan vive en `workspaces.plan` a partir del Tramo 5, **no** en `users.plan` |

## 3. Lo que ya esta construido y NO hay que escribir

**El motor de temas existe completo.** Es el hallazgo que abarata el epic entero: no se construye tematizacion, se **sube un nivel** (del evento a la agencia) y se **baja a las otras superficies**.

- `lib/invite/theme.ts` — esquema Zod con colores (fondo, texto, titulo, tarjeta, acento, botonBg, botonTexto), tipografias, boton en 3 formas por 7 estilos, fondo solido/gradiente/imagen/animado con 15 efectos
- `lib/invite/vibes.ts` — 23 presets
- `lib/invite/theme-css.ts` — genera las variables CSS, **con pruebas**
- `lib/invite/fonts.ts` — registro cerrado de tipografias, carga por Google Fonts
- `app/components/invitacion/ThemeProvider.tsx` — el provider
- Pickers ya armados: `VibePicker`, `ButtonStylePicker`, `FondoControls`, `AnimControls`, `CarruselControls`

Hoy lo consumen **solo** los componentes de invitacion. Playlist, mesa de regalos, puerta e invite de colaborador traen colores a mano.

**El almacenamiento de imagenes existe.** Bucket publico `event-media` en Supabase Storage, con patron de subida ya probado en `app/events/[id]/invitacion/SectionForm.tsx` y en el editor de codigo de vestimenta. Devuelve URL publica directa con `getPublicUrl`, sin firmar. El logo de la agencia entra ahi sin infraestructura nueva.

**Los links ya salen del origen, no de una constante.** Configuracion, AccesoPanel, mesa de regalos, playlist e invitados arman sus enlaces con `window.location.origin`. Si el dominio de la agencia apunta a la misma app en Vercel, **todos esos links salen con su dominio sin tocar una linea**. Lo unico con `anfiora.com` escrito a mano es `metadataBase` y el canonical en `app/layout.tsx`, mas `robots.ts`, `sitemap.ts` y las paginas legales.

## 4. Donde vive la marca Anfiora hoy

Verificado contra el repo el 4 de septiembre. Vuelve a grepear antes de editar, el repo se movio desde entonces.

| Superficie | Archivo | Que dice |
|---|---|---|
| Invitacion, pie | `app/components/invitacion/sections/CierreSection.tsx` | "Hecho con Anfiora" |
| Invitacion, OG | `app/invitacion/[slug]/[token]/page.tsx` | `siteName: 'Anfiora'` |
| Playlist publica | `app/playlist/[token]/page.tsx` | logo mas "Ir a Anfiora" |
| Mesa de regalos | `app/mesa/[token]/page.tsx` | logo al pie |
| Invite de colaborador | `app/invite/[token]/page.tsx` | isotipo mas copy |
| Excel y PDF | `presupuesto/lib/exports.ts`, `pagos/lib/exports.ts` | "Generado en Anfiora", "anfiora.com" |
| Canales | `lib/telegram/adapter.ts`, `lib/whatsapp/canonical-mirror.ts` | etiquetas del canal compartido |

## 5. Por donde arrancar: el logo del workspace

El logo es la primera pieza y la mas barata. Todo lo demas cuelga de ella.

1. **La columna.** `workspaces.logo_url text`. Ver §7: puede que ya venga incluida en el SQL del Tramo 5, verificalo antes de escribir una migracion nueva.
2. **La pantalla.** Sube en `/configuracion`, seccion Workspace. Solo el dueno principal. Con plan distinto de Agency, el control se ve y avisa del plan, que es el patron que ya usa la app.
3. **Las superficies, en orden de valor:** los PDF de presupuesto y pagos, la vista del cliente, la playlist publica y la mesa de regalos, y al final el OG al compartir.
4. **El gate.** Una sola funcion que responda "esta agencia puede marcar" leyendo `PLANES[plan].whitelabel`. No repartas el `plan === 'agency'` por las pantallas.

Despues del logo siguen el color y la tipografia, que es donde se enchufa el motor del §3.

## 6. LA PREGUNTA QUE DIEGO TIENE QUE CERRAR ANTES

El brainstorm del 4 de septiembre se paro aqui. **No la contestes tu, preguntala.**

Diego dijo "whitelabel estandar", que apunta a que **la marca de la agencia sustituye a la de Anfiora**. Pero el modelo que trae en la cabeza es Cuantix, su otra app, donde el cliente personaliza colores, tipografias y fondo **y el logo de Cuantix se queda**. Son dos productos distintos:

- **Sustituir:** el invitado nunca ve Anfiora. Es lo que justifica el precio de Agency.
- **Convivir:** la agencia personaliza y queda un "Hecho con Anfiora" discreto. Es marketing gratis para Anfiora y vale menos dinero.

De la respuesta depende el pie de cada pantalla publica y el OG. No arranques las superficies del §5 sin ella. El logo en los PDF y la columna se pueden hacer igual, porque no dependen de esto.

## 7. Trampas y avisos

- **El SQL del Tramo 5 puede no haber corrido todavia.** Vive en `docs/superpowers/plans/sql/`, son dos archivos, cimiento y luego equipo. Si aun no corre, agregar una columna ahi es una linea; si ya corrio, es una migracion nueva. Averigualo antes.
- **Agency hoy no hace nada.** `plan === 'agency'` solo aparece en `/admin` y en una linea de copy que promete numero dedicado de WhatsApp, que sigue trabado por la verificacion de negocio de Meta. **El whitelabel seria la unica razon real para pagar Agency.** Eso sube lo que esta en juego, no lo baja.
- **El motor de temas nunca se ha estresado en varias pantallas a la vez.** Solo lo usa la invitacion. Al bajarlo a la playlist y a la mesa de regalos van a salir dos cosas: el parpadeo de contenido sin tema antes de que carguen las variables, y el contraste cuando la agencia escoge dos colores que no se llevan. `lib/invite/contrast.ts` ya existe, usalo.
- **El correo con remitente propio de la agencia es un epic aparte.** Choca con la misma pared de SMTP y DNS que la confirmacion de correo al registrarse. No lo metas aqui.
- **El dominio propio es el tramo caro** y no por codigo: es comodin en Vercel, marca por hostname, metadata por dominio, y operacion manual por cada cliente. Va al final.

## 8. Estimado

Se dio antes de descubrir que el motor ya existia, asi que **recalcula a la baja** los dos primeros renglones.

| Tramo | Tiempo |
|---|---|
| Marca del invitado: logo, color y nombre en playlist, mesa, puerta y OG, mas pantalla de configuracion y gate | 2 a 3 sesiones |
| Documentos: PDF, Excel, lista de mesas | 1 sesion |
| Texto saliente: WhatsApp y Telegram sin "Anfiora" | 1 sesion |
| Dominio propio | 2 a 3 sesiones mas operacion por cliente |
| Correo con remitente propio | epic aparte, no entra |

**Minimo vendible para lanzar el precio de Agency:** el primer tramo.

## 9. Como trabaja Diego

Leelo, no lo aprendas a golpes.

- **El UI se itera en un mockup antes de codear.** Al primer pixel se para y se levanta el mockup. Nunca se codea una pantalla para que la vea en preview.
- **Un paso a la vez.** No conviertas un detalle en cuatro features.
- **Nunca `git push` a main ni cambios en Supabase sin permiso explicito.**
- **En la interfaz se dice evento, nunca boda**, y se dice workspace, nunca despacho.
- **Sin emojis en la interfaz.** Flat, limpio, Lucide para iconos, teal `#48C9B0` para los botones de accion.
- **Los mensajes de commit van sin acentos ni enes.**
