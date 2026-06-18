-- Memoria episodica del agente (CoALA): notas blandas por invitado.
-- Aditiva y nullable: no rompe main/prod (el codigo viejo ignora la columna).
-- La destila una llamada Haiku tras cada intercambio; se inyecta al prompt de
-- generacion (NO al self-check) como contexto blando, nunca como dato oficial.

ALTER TABLE guests ADD COLUMN IF NOT EXISTS agent_memory TEXT;
