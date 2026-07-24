# Borrar invitado con conversación — diseño

Fecha: 2026-07-01
Estado: spec en revisión
Origen: bug de prod (Sentry/manual) — borrar un invitado con conversación falla en silencio y la UI miente.
Relacionado: [[agente-unificado]], [[nucleo-omnicanal-spec]], [[identidad-multicanal-e-inbound]].

## El problema (causa raíz, ya diagnosticada)

`deleteGuest` (`app/events/[id]/page.tsx`) hoy: borra `guests` **antes** que `party_members`, **ignora el error** de Supabase, y **quita al invitado de la lista de todas formas** (borrado optimista). Cuando el invitado tiene una conversación en la bandeja, la llave foránea `conversations.contact_guest_id -> guests` **bloquea el borrado** (el diseño decía "desvincular, no bloquear", pero esa regla no quedó aplicada). Resultado: el invitado **desaparece de la lista pero sigue en la base** (reaparece al refrescar) y su conversación queda en la bandeja. Evidencia: el invitado de prueba y sus acompañantes siguen en la base pese al borrado; no hay conversación huérfana.

Esto afecta a **cualquier** invitado con conversación: hoy no se pueden borrar.

## Qué se construye

Al borrar un invitado, **preguntar solo cuando hace falta**:

- **Invitado SIN conversación** (0 mensajes) → se borra directo, sin fricción (como hoy, pero con el borrado ya arreglado).
- **Invitado CON conversación** (>= 1 mensaje) → modal:
  > "Este invitado tiene una conversación. ¿Qué hacemos con el chat?"
  > - **Conservar el chat** → se borra el invitado; la conversación se **desvincula** (queda en la bandeja como "sin invitado", con su historial).
  > - **Eliminar también el chat** → se borra el invitado y su conversación (con mensajes).

"Conversación" = existe una fila en `conversations` para ese invitado con al menos un `messages`.

## Arreglo de fondo (para que el borrado funcione)

**1. Base de datos (SQL que corre Diego):** ajustar las llaves foráneas que referencian `guests` para que el borrado no se bloquee:
- Datos **propios** del invitado (`party_members`, `table_seats`, `wa_messages`, `song_recommendations`, y cualquier otra tabla con `guest_id -> guests`) → `ON DELETE CASCADE` (se borran con el invitado). Esto ademas simplifica y arregla el orden actual.
- `conversations.contact_guest_id -> guests` → `ON DELETE SET NULL` (borrar el invitado **desvincula** la conversación, preserva historial). Es el default "conservar".

La lista exacta de tablas/FK se confirma en el plan con un chequeo de solo lectura del esquema; Diego aplica el ALTER.

**2. Código (`deleteGuest`):**
- Antes de borrar, consultar si el invitado tiene conversación con mensajes.
- Si tiene → mostrar el modal de decisión.
- **Conservar:** borrar el invitado (cascade limpia lo propio; SET NULL desvincula la conversación).
- **Eliminar todo:** borrar primero `messages` de esas conversaciones y las `conversations` del invitado, luego borrar el invitado.
- **Verificar el error** de cada borrado; **solo quitar de la lista si la base confirmó** el borrado. Si falla, mostrar aviso y NO removerlo de la UI (fin del borrado optimista que miente).

## Superficies

- `app/events/[id]/page.tsx` — `deleteGuest` + el nuevo modal de decisión. (Los otros puntos de borrado — bulk delete de grupos, `deleteGuestsBulk` — se revisan para el mismo problema de orden/error; al menos deben verificar error. El modal de conversación es para el borrado individual; el bulk puede usar el default "conservar/desvincular" sin preguntar por cada uno, o avisar cuántos tienen chat.)

## Alcance / fuera de alcance

- **En alcance:** borrado individual con la decisión de chat; arreglo del borrado silencioso; FKs correctas.
- **Fuera de alcance:** identidad multicanal y guests inbound (ver [[identidad-multicanal-e-inbound]]); la vista de conversaciones "sin invitado" en la bandeja (hoy la bandeja ya tolera contacto NULL; solo hay que confirmar que las muestra sin romper — se verifica, no se rediseña aquí).

## Pruebas

- **Lógica pura (Vitest):** extraer la decisión "qué borrar según la elección" a una función testeable (dado {tieneConversacion, eleccion} -> plan de borrado). 
- **Manual (I/O):** borrar invitado sin chat → se va. Borrar invitado con chat → modal; "conservar" → invitado fuera, conversación queda sin invitado en la bandeja; "eliminar todo" → invitado y chat fuera. Verificar que si la base rechaza, la UI NO lo quita y avisa. Confirmar en la base que el invitado realmente se borró (no reaparece al refrescar).

## Riesgos

- **Borrado destructivo del historial** (opción "eliminar todo"). Mitigación: es elección explícita del usuario tras un modal claro; el default es conservar.
- **FK mal ajustada deja datos colgados o bloquea.** Mitigación: confirmar la lista real de FKs en el plan (chequeo de esquema) antes del ALTER; Diego corre el SQL con el código ya listo (regla sincronía Supabase<->Vercel).
- **Borrado optimista actual oculta fallas.** Se elimina: verificar error siempre.
