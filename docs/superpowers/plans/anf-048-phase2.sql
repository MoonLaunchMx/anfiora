-- ANF-048 Fase 2 — credenciales de linea de WhatsApp por planner.
-- Aditivo y nullable: inerte en prod (el codigo de main no lee estas columnas).
-- Lo corre Diego en Supabase. Atomico (BEGIN/COMMIT).

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_sender_phone     text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_phone_number_id  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_waba_id          text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_subaccount_sid   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_sender_status    text;        -- pending | connected | disconnected | error
ALTER TABLE users ADD COLUMN IF NOT EXISTS wa_connected_at     timestamptz;

COMMIT;
