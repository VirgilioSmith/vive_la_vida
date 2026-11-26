-- APLICADA a producción el 2026-11-26 23:55 UTC. Restos del antiguo sistema de notificaciones (que enviaba a servidores externos):
-- pg_cron (0 trabajos) y pg_net (0 peticiones en cola/respuestas) solo mantenían procesos en segundo plano y conexiones inactivas.
-- También se eliminó el secreto de Vault `f360_push_cron_token` (sin referencias en funciones). Sin datos financieros afectados.
drop extension if exists pg_cron;
drop extension if exists pg_net;
