-- Restaura las extensiones (vacías; no se restauran trabajos ni el secreto, que ya no existían en uso).
create extension if not exists pg_cron;
create extension if not exists pg_net;
