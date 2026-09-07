-- "Quien pago" deja de ser un enum fijo y pasa a texto libre con sugerencias.
-- La lista vieja (novia, novio, papas_novia...) solo tiene sentido en una boda
-- hetero; en un cumpleanos o un corporativo miente.
--
-- Corrido en Supabase el 7-sep-2026. Es SEGURO correrlo antes del deploy:
-- soltar el CHECK solo amplia lo permitido, el codigo viejo sigue mandando
-- valores validos. Lo peligroso seria desplegar el campo libre con el
-- candado puesto.

alter table public.supplier_payments
  drop constraint if exists supplier_payments_paid_by_check;

-- Verificacion (debe dar 0 filas):
-- select conname from pg_constraint
-- where conrelid = 'public.supplier_payments'::regclass
--   and pg_get_constraintdef(oid) ilike '%paid_by%';
