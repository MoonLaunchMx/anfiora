-- Fase 1 del flujo de invitados publicos y privados.
-- Spec: docs/superpowers/specs/2026-07-14-flujo-invitados-publicos-privados-design.md
--
-- Aditiva y segura: agrega una columna nullable con default. No toca datos.
-- Correr ANTES de mergear el codigo de la fase 1 (el modal la escribe al crear el evento).
--
-- Contexto verificado el 14-jul contra la base real:
--   select count(*) from event_settings where access_mode is not null;  -->  0
-- Nadie tiene access_mode con valor, asi que recolapsar 3 valores a 2 no
-- requiere migracion de datos. Los 46 event_settings existentes tienen NULL
-- y el codigo los resuelve con el default de su tipo de evento
-- (resolveAccessMode / resolveRequiresApproval en lib/features.ts).

alter table event_settings
  add column if not exists requires_approval boolean not null default false;

comment on column event_settings.requires_approval is
  'Candado de aprobacion sobre la puerta publica. Solo aplica cuando access_mode = ''publica''; en ''privada'' va false siempre (lo fuerza normalizeAccessFields).';

-- Verificacion (debe devolver la columna con default false y not null):
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_name = 'event_settings' and column_name = 'requires_approval';
