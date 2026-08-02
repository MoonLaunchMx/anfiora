-- Notificaciones: preferencias por tipo + cron de recordatorios
-- Aplicar en Supabase SOLO despues de pushear el codigo a origin/main
-- (regla de sincronia Supabase <-> Vercel).

-- 1. Anti-duplicado del cron.
ALTER TABLE event_timeline_tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- 2. Indice parcial: solo indexa las filas que el cron puede llegar a tocar.
CREATE INDEX IF NOT EXISTS event_timeline_tasks_reminder_pending_idx
  ON event_timeline_tasks (reminder_date)
  WHERE reminder_sent_at IS NULL AND is_completed = false;

-- 3. Reclamo atomico. Va en una funcion porque supabase.update() no admite
--    LIMIT y el tope por corrida es necesario para acotar el tiempo de
--    ejecucion. FOR UPDATE SKIP LOCKED permite que dos corridas simultaneas
--    tomen filas distintas en vez de bloquearse o pisarse.
CREATE OR REPLACE FUNCTION claim_due_reminders(max_rows INT DEFAULT 200)
RETURNS SETOF event_timeline_tasks
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE event_timeline_tasks
     SET reminder_sent_at = now()
   WHERE id IN (
     SELECT id
       FROM event_timeline_tasks
      WHERE reminder_sent_at IS NULL
        AND reminder_date IS NOT NULL
        AND reminder_date <= now()
        AND is_completed = false
      ORDER BY reminder_date
      LIMIT max_rows
      FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
$$;

-- Solo el service role la ejecuta; el cliente del navegador no debe poder
-- marcar recordatorios como enviados.
REVOKE EXECUTE ON FUNCTION claim_due_reminders(INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION claim_due_reminders(INT) TO service_role;
