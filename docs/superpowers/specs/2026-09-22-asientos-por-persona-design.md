# Asientos por persona (PR 2) — diseno cerrado

Decidido con Diego el 21 y 22 de septiembre de 2026 sobre estos mockups:
- Investigacion y flujos: https://claude.ai/artifact/VQNL7SYvSkNcEmeobaF5Zx (opcion A: arrastrar en escritorio, tocar en celular, plano incluido)
- Etiquetas y modelo: https://claude.ai/artifact/7oZ5WE6tmLPSvG4Uh8iwJg (seccion "Acompanantes en otra mesa", etiqueta A)

## La regla

Cada invitado y cada acompanante es **una persona con su propio lugar**. Se sienta, se mueve
y se quita de uno en uno. Nadie se mueve junto con nadie. La familia solo es un atajo
("Sentar a los 4") y una etiqueta ("de Diego Garza").

## Modelo de datos

`table_seats` gana `party_member_id uuid null` (FK a `party_members`, ON DELETE CASCADE).

| Fila | guest_id | party_member_id | party_size |
|---|---|---|---|
| Titular sentado | el invitado | null | 1 |
| Acompanante sentado | su invitado | el acompanante | 1 |
| **Fila legado** (lo que hay hoy) | el invitado | null | N = tamano del grupo |

Una fila legado cuenta N lugares y "sienta" implicitamente a todos los acompanantes de ese
invitado en la misma mesa. Se reconoce porque `party_member_id` es null, `party_size > 1` y
**no existe** ninguna fila con `party_member_id` para ese `guest_id`.

Al primer movimiento individual sobre una familia legado, la app la **expande**: inserta una
fila por acompanante en la misma mesa y deja el titular en `party_size = 1`. Crear antes de
sobrescribir. El SQL 2 hace esa misma expansion para todas las familias ya sentadas, despues
del deploy.

Unicidad: un titular tiene a lo mas una fila (`guest_id` unico donde `party_member_id is null`)
y un acompanante tiene a lo mas una fila (`party_member_id` unico).

## Superficies

**Mesas · escritorio (lista y plano).** Panel "Sin mesa" a la izquierda, agrupado por el Grupo que ya existe en la base (),
con buscador y "Sentar a los N". Arrastrar (solo mouse) una persona del panel a una mesa la
sienta; de una mesa a otra la mueve; al panel la quita. En el plano, cada silla ocupada es una
persona arrastrable con tooltip.

**Mesas · celular.** Tocar la mesa abre Asignar con un renglon por persona y palomitas. Tocar a
una persona sentada abre el menu: Mover a otra mesa / Ver invitado / Quitar de la mesa. Mover
abre la lista de mesas con lugares libres y donde esta su familia; las llenas salen apagadas.
Los tres flujos tambien existen en escritorio.

**Etiqueta A.** El acompanante lleva la etiqueta gris "de Diego Garza". Si su titular esta en
otra mesa, ademas la ambar "Mesa 2". El titular lleva "+2 en Mesa 5" si tiene acompanantes en
otra mesa. Nada de esto sale cuando la familia esta junta o sin mesa.

**Invitados.** Columna Mesa, filtro por mesa y Excel muestran la mesa de cada acompanante.

**Fuera de Mesas.** El asistente (WhatsApp/Telegram) y el hub de Mensajes siguen leyendo la
mesa del titular: sus consultas pasan a `.is('party_member_id', null)` porque `.maybeSingle()`
revienta con mas de una fila por invitado.

## Errores

Los del PR 1: toda escritura pasa por `falloDeEscritura`, el toast con Reintentar y la
pantalla regresa a lo que dice la base. Una mesa llena se apaga, no avisa. Si alguien la
lleno mientras tanto, se recarga y se dice.

## Fuera de alcance

Iconos por estatus en sillas y listas (PR 3). Arrastrar personas con el dedo. Sentar en una
silla especifica (seat_number sigue siendo un correlativo interno).
