-- Migrar las resenas viejas. Correr DESPUES de verificar el codigo en produccion.
-- Medido el 6-sep: 7 filas con datos. 4 de diego.garza@moonlaunch.mx se descartan
-- por instruccion suya; 3 de bodasplanner@hotmail.com se conservan.
-- No son resenas de desempeno: el modal viejo decia "Tu experiencia cotizando",
-- asi que entran como review de contratacion.

insert into supplier_reviews (
  user_id, supplier_id, event_id, event_supplier_id,
  review_type, autor,
  comunicacion, comentarios, created_by, created_at
)
select
  e.user_id,
  es.supplier_id,
  es.event_id,
  es.id,
  'contratacion',
  'planner',
  case es.response_speed
    when 'lentisimo' then 2
    when 'normal'    then 3
    when 'bueno'     then 4
    when 'rapidos'   then 5
  end,
  nullif(trim(concat_ws(
    E'\n\n',
    nullif(trim(es.review_text), ''),
    case
      when es.rating is null and es.mood is null then null
      else 'Reseña anterior: ' ||
        concat_ws(', ',
          case when es.rating is not null then es.rating || ' de 5' end,
          case es.mood
            when 'love'   then 'trato excelente'
            when 'normal' then 'trato normal'
            when 'no'     then 'mal trato'
          end
        ) || '.'
    end
  )), ''),
  e.user_id,
  es.created_at
from event_suppliers es
join events e on e.id = es.event_id
join users  u on u.id = e.user_id
where u.email = 'bodasplanner@hotmail.com'
  and (es.rating is not null
       or es.mood is not null
       or es.response_speed is not null
       or nullif(trim(es.review_text), '') is not null)
on conflict (event_supplier_id, review_type, autor) do nothing;

-- Verificar ANTES de seguir: deben ser exactamente 3 filas.
-- Se acota con el mismo join por email que usa el insert: contar TODAS las de
-- contratacion se pasa de largo en cuanto exista una review nueva, y entonces
-- "deben ser 3" deja de ser cierto y la verificacion deja de verificar.
-- select count(*)
--   from supplier_reviews r
--   join users u on u.id = r.user_id
--  where r.review_type = 'contratacion'
--    and u.email = 'bodasplanner@hotmail.com';

-- Solo despues de verificar las 3 filas:
alter table event_suppliers
  drop column if exists rating,
  drop column if exists mood,
  drop column if exists response_speed,
  drop column if exists review_text,
  drop column if exists discard_reason,
  drop column if exists win_reason;
