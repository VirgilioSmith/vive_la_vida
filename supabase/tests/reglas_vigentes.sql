-- Prueba de la migración de vigencias en una base local de Postgres (no en producción).
-- Uso: psql -v ON_ERROR_STOP=1 -f supabase/tests/reglas_vigentes.sql  (con rol que pueda crear bases)
drop database if exists t_reglas; create database t_reglas;
\c t_reglas
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid() to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
\i supabase/migrations/20261115000000_reglas_vigentes_y_instantaneas.sql
set role authenticated; set request.uid='00000000-0000-0000-0000-000000000001';
insert into finance_rule_versions(rule_key,subject_id,value,valid_from) values ('cert.retencion','*','{"pct":10}','2026-01-01');
insert into finance_rule_versions(rule_key,subject_id,value,valid_from) values ('cert.retencion','*','{"pct":15}','2026-09-01');
do $$ begin begin insert into finance_rule_versions(rule_key,subject_id,value,valid_from) values ('cert.retencion','*','{"pct":9}','2026-03-01'); raise exception 'debió bloquear'; exception when sqlstate 'P0001' then raise notice 'OK vigencia retroactiva bloqueada'; end; end $$;
do $$ begin begin update finance_rule_versions set value='{}'; raise exception 'debió bloquear'; exception when insufficient_privilege or sqlstate 'P0001' then raise notice 'OK update bloqueado'; end; end $$;
do $$ begin begin delete from finance_rule_versions; raise exception 'debió bloquear'; exception when insufficient_privilege or sqlstate 'P0001' then raise notice 'OK delete bloqueado'; end; end $$;
reset role;
do $$ begin begin update finance_rule_versions set value='{}'; raise exception 'debió bloquear'; exception when sqlstate 'P0001' then raise notice 'OK el disparador bloquea al rol privilegiado'; end; end $$;
set role anon;
do $$ begin begin perform 1 from finance_rule_versions; raise exception 'debió bloquear'; exception when insufficient_privilege then raise notice 'OK anon sin acceso'; end; end $$;
reset role;
\i supabase/rollback/20261115000000_reglas_vigentes_y_instantaneas.down.sql
