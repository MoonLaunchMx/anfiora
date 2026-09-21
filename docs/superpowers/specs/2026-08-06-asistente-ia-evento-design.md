# Asistente IA por evento — copiloto del planner

**Estado:** BORRADOR EN CURSO. Brainstorm pausado el 6-ago-2026. Nada está decidido en firme.
**Retomar en:** Pregunta 5 (ver abajo).

---

## La idea

Un asistente de IA dentro de cada evento que le habla al **planner** (no al invitado):
le responde sobre su evento, le da updates y ejecuta cambios cuando se lo pide.

Frase de Diego: *"que la IA fuera tu asistente en cada uno de tus eventos"*.

Posicionamiento comercial tentativo (dicho al aire, NO es decisión): un asistente humano
cuesta $7,000–$10,000 MXN al mes; activar el asistente de IA costaría ~$2,500 MXN.
**No diseñar alrededor de este precio hasta que exista de verdad.**

## Qué ya existe en el repo (no duplicar)

`lib/agent/` es un agente que mira **hacia afuera**: le habla al **invitado** por
WhatsApp/Telegram.

- `context-pack.ts` — arma el contexto del invitado (evento, mesa, acompañantes, alergias, FAQ)
- `pipeline.ts` — respuesta *grounded* + self-check + escalamiento a humano
- `apply.ts` — plan de escritura puro (RSVP, acompañantes, alergias) + resumen de acciones
- `extraction.ts`, `attention.ts`, `config.ts` — extracción, banderas de atención, config por evento
- Modos `autonomo` | `copiloto`, configurable por evento en `event_settings.agent_config`

El asistente nuevo es el **espejo**: mira hacia **adentro**. Es otro producto.

Infra ya disponible que sirve: `@anthropic-ai/sdk` y `zod` instalados, `lib/audit.ts`
(bitácora), cron cada 15 min encendido, push notifications funcionando,
`lib/event-access-context.tsx` (RBAC de colaboradores).

## Decisiones tomadas

### 1. Audiencia: copiloto del planner (opción A)

Vive dentro de la app, en cada evento. NO se fusiona con el agente de invitados.
Fusionar los dos cerebros (opción C) se descartó por ahora: el agente de invitados vive
detrás de un webhook con reglas de honestidad muy estrictas y mezclarlo frenaría a ambos.

Que los colaboradores (admin/editor/viewer) también lo usen queda como consecuencia
natural — mismo asistente respetando `useEventAccess()` — pero el v1 se diseña para el planner.

### 2. El v1 es Preguntar + Actuar (opción A)

Son tres productos que se venden como uno:

1. **Preguntar** — responde con datos reales del evento. Solo lectura.
2. **Actuar** — ejecuta: estatus, pagos, tareas.
3. **Avisar** — proactivo, él te busca a ti. *"Faltan 12 por confirmar y el catering pide números el viernes."*

**V1 = 1 + 2.** El 3 queda para v2, montado sobre el cron que ya corre cada 15 minutos.

Razón de no hacer solo lectura: un "ChatGPT que conoce tu boda" no se siente como una
contratación; el planner dice *"eso ya lo veo en la pantalla"*.

### 3. Seguridad: el asistente propone, el planner dispone

**Decisión de Diego, y es la columna vertebral del diseño.**

El agente NUNCA escribe directo. Arma el cambio, lo muestra en un modal de vista previa,
y el `INSERT`/`UPDATE` sólo ocurre cuando el planner aprieta **Aceptar**.

> *"así ya no se equivoca el agente sino el planner"*

Beneficio extra: con `lib/audit.ts` cada cambio aceptado queda firmado por el **usuario**,
no por un robot. Si un cliente reclama, la bitácora dice quién aprobó qué y a qué hora.

El riesgo real de este producto no son los tokens (con Haiku el margen sobra) — es la
**confianza**. La primera vez que mueva a alguien de mesa mal o registre un pago que no era,
se acaba el producto.

### 4. Alcance: sabe de todo, hace poco (opción A)

- **Lee TODOS los módulos.** No hay decisión que tomar aquí. Un asistente que no sabe de
  presupuesto se siente tonto. La ignorancia mata la confianza; la limitación declarada no
  (*"eso lo veo pero todavía no lo puedo cambiar por ti"*).
- **Ejecuta sólo en unos pocos.** Cada acción de escritura cuesta: vista previa propia,
  validaciones, permisos, bitácora y una historia de deshacer.

### 5. Criterio para elegir los módulos que ejecutan

> **El asistente gana donde la UI de Anfiora es tediosa. Pierde donde la UI ya es buena.**

- Pierde: arrastrar un invitado a una mesa ya es óptimo, hablarlo es más lento.
- Gana: crear una tarea de timeline pide 8 campos (título, fecha, hora, categoría, asignado,
  bloqueante, proveedor, recordatorio) y se vuelve una frase.
- Gana: lo repetitivo sobre muchos registros — *"marca confirmados a todos los de la mesa 4"*
  son 30 clics y una frase.

### 6. Corte propuesto de módulos (Diego dijo "perfecto", pendiente de firma final)

**Ejecuta en tres:**

| Módulo | Acciones | Por qué |
|---|---|---|
| **Timeline** | crear tareas y recordatorios, marcar completadas | Máxima frecuencia, riesgo casi nulo (crear es reversible), modal larguísimo → una frase |
| **Invitados** | cambiar estatus (uno o en lote), registrar acompañantes y alergias | El módulo más vivo; lo tedioso es buscar a la persona entre cientos |
| **Pagos** | registrar un pago a un proveedor que ya existe | El que más se siente como "tengo un asistente"; 5 campos → *"abónale 15 mil al DJ ayer por transferencia"* |

**Sólo lee:** mesas, presupuesto, proveedores, invitación, playlist, álbum.

**Fuera del v1 a propósito:**
- Mover invitados entre mesas — el drag-and-drop ya le gana.
- Dar de alta proveedores nuevos — demasiados campos, catálogo global compartido entre
  eventos, y el riesgo de duplicados es alto.
- Cualquier cosa de la invitación — es visual, el chat no ayuda.

## Preguntas abiertas (retomar aquí)

1. **¿Dónde vive la conversación?** ¿Chat flotante disponible en todas las páginas de
   `/events/[id]/*`? ¿Panel lateral? ¿Página propia? ¿Es consciente de en qué pantalla estás?
   (Ojo: el layout de evento es `overflow-hidden` y el teclado de iOS ya dio guerra.)
2. **¿Cómo lee?** Fork técnico central: ¿un context-pack fijo precocido (como el del agente
   de invitados) o herramientas de consulta con tool-calling? El primero es predecible y
   barato; el segundo contesta preguntas arbitrarias. Aquí van las 2-3 propuestas con trade-offs.
3. **¿Qué modelo?** Haiku vs Sonnet. Haiku es el que ya se usa; tool-calling y agregaciones
   numéricas pueden pedir más músculo.
4. **¿Recuerda?** ¿Historial de conversación por evento persistido, o cada sesión arranca en blanco?
5. **Permisos.** Cómo se cruza con `useEventAccess()`: un `viewer` no debería poder aceptar
   un cambio. Recordar que el RBAC de colaboradores vivía sólo en la UI y aún hay páginas con
   escrituras que fallan mudas contra RLS.
6. **¿Cómo dice que no?** El guion exacto para lo que sabe pero no puede ejecutar todavía.
7. **Deshacer.** Si el planner aceptó y se arrepiente, ¿hay camino de vuelta o se arregla a mano?

## Siguiente paso

Terminar las preguntas abiertas → presentar el diseño por secciones → cerrar este spec →
`writing-plans`.
