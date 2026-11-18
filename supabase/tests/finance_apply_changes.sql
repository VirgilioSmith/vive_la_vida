-- Prueba de finance_apply_changes antes y después de la migración de validación, en una base LOCAL de Postgres (no en producción).
-- Uso: psql -v ON_ERROR_STOP=1 -f supabase/tests/finance_apply_changes.sql   (con un rol que pueda crear bases; desde la raíz del repositorio)
drop database if exists t_apply; create database t_apply;
\c t_apply
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid() to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
create table public.finance_items(user_id uuid not null references auth.users(id), collection text not null, record_id text not null, position int not null default 0, primary key(user_id,collection,record_id));
create table public.finance_values(user_id uuid not null, collection text not null, record_id text not null, path text not null, kind text not null check (kind = any (array['object','array','string','number','boolean','null'])), text_value text, number_value numeric, boolean_value boolean, primary key(user_id,collection,record_id,path), foreign key(user_id,collection,record_id) references public.finance_items(user_id,collection,record_id) on delete cascade);
create table public.finance_revision(user_id uuid primary key references auth.users(id), revision bigint not null default 0, updated_at timestamptz not null default now());
create table public.finance_collection_state(user_id uuid not null references auth.users(id), collection text not null, revision bigint not null, primary key(user_id,collection));
alter table public.finance_items enable row level security; alter table public.finance_values enable row level security; alter table public.finance_revision enable row level security; alter table public.finance_collection_state enable row level security;
create policy finance_items_owner on public.finance_items for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy finance_values_owner on public.finance_values for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy finance_revision_owner on public.finance_revision for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy estado_select_propio on public.finance_collection_state for select to authenticated using (user_id=(select auth.uid()));
grant select on public.finance_items, public.finance_values, public.finance_revision, public.finance_collection_state to authenticated;
CREATE OR REPLACE FUNCTION public.finance_write_item(p_user uuid, p_collection text, p_id text, p_position integer, p_item jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $f$
BEGIN
  INSERT INTO public.finance_items AS fi (user_id,collection,record_id,position) VALUES(p_user,p_collection,p_id,p_position) ON CONFLICT(user_id,collection,record_id) DO UPDATE SET position=excluded.position WHERE fi.position IS DISTINCT FROM excluded.position;
  DELETE FROM public.finance_values WHERE user_id=p_user AND collection=p_collection AND record_id=p_id;
  INSERT INTO public.finance_values(user_id,collection,record_id,path,kind,text_value,number_value,boolean_value)
  WITH RECURSIVE tree(path,val) AS (SELECT ''::text,p_item UNION ALL SELECT CASE WHEN tree.path='' THEN '/' ELSE tree.path||'/' END || replace(replace(child.k,'~','~0'),'/','~1'),child.v FROM tree CROSS JOIN LATERAL (SELECT k,v FROM jsonb_each(CASE WHEN jsonb_typeof(tree.val)='object' THEN tree.val ELSE '{}'::jsonb END) AS o(k,v) UNION ALL SELECT (ord-1)::text,v FROM jsonb_array_elements(CASE WHEN jsonb_typeof(tree.val)='array' THEN tree.val ELSE '[]'::jsonb END) WITH ORDINALITY AS a(v,ord)) child)
  SELECT p_user,p_collection,p_id,path,jsonb_typeof(val),CASE WHEN jsonb_typeof(val)='string' THEN val #>> '{}' ELSE NULL END,CASE WHEN jsonb_typeof(val)='number' THEN (val #>> '{}')::numeric ELSE NULL END,CASE WHEN jsonb_typeof(val)='boolean' THEN (val #>> '{}')::boolean ELSE NULL END FROM tree;
END $f$;
revoke all on function public.finance_write_item(uuid,text,text,integer,jsonb) from public, anon, authenticated;
\echo '== ANTES de la migración (definición anterior)'
\i supabase/rollback/20261118000000_validacion_cambios_finanzas.down.sql
revoke all on function public.finance_apply_changes(bigint,jsonb) from public, anon; grant execute on function public.finance_apply_changes(bigint,jsonb) to authenticated;
set role authenticated; set request.uid='00000000-0000-0000-0000-000000000001';
do $$ declare r bigint; begin
  r := public.finance_apply_changes(0, '[{"collection":"accounts","id":"a1","action":"upsert","position":0,"data":{"name":"Prueba","balance":1e15}}]'::jsonb);
  raise notice 'ANTES: acepta un saldo de 1e15 (revisión %)', r;
end $$;
reset role;
delete from public.finance_items; delete from public.finance_revision; delete from public.finance_collection_state;
\echo '== DESPUÉS de la migración'
\i supabase/migrations/20261118000000_validacion_cambios_finanzas.sql
set role authenticated; set request.uid='00000000-0000-0000-0000-000000000001';
do $$ declare r bigint; n int; begin
  -- 1. cambio válido: sube la revisión y escribe
  r := public.finance_apply_changes(0, '[{"collection":"accounts","id":"a1","action":"upsert","position":0,"data":{"name":"Cuenta","balance":1250.55}},{"collection":"transactions","id":"t1","action":"upsert","position":0,"data":{"amount":99.99,"currency":"DOP"}}]'::jsonb);
  assert r = 1, 'la revisión debía ser 1'; raise notice 'OK 1 cambio válido escribe y sube la revisión a %', r;
  -- 2. idempotencia: repetir el mismo upsert no duplica filas
  r := public.finance_apply_changes(1, '[{"collection":"transactions","id":"t1","action":"upsert","position":0,"data":{"amount":99.99,"currency":"DOP"}}]'::jsonb);
  select count(*) into n from public.finance_items where collection='transactions'; assert n = 1, 'upsert repetido duplicó el registro';
  raise notice 'OK 2 el mismo upsert dos veces deja un solo registro (revisión %)', r;
  -- 3. conflicto de revisión
  begin perform public.finance_apply_changes(0, '[]'::jsonb); raise exception 'debió fallar'; exception when sqlstate '40001' then raise notice 'OK 3 revisión desactualizada = conflicto 40001'; end;
  -- 4. importe fuera de rango: se rechaza SIN escribir nada y SIN subir la revisión (atomicidad)
  begin perform public.finance_apply_changes(2, '[{"collection":"accounts","id":"a2","action":"upsert","position":1,"data":{"balance":1e15}}]'::jsonb); raise exception 'debió fallar'; exception when sqlstate '22003' then raise notice 'OK 4 importe de 1e15 rechazado (22003)'; end;
  begin perform public.finance_apply_changes(2, '[{"collection":"accounts","id":"a2","action":"upsert","position":1,"data":{"nested":{"lista":[1,-2e13]}}}]'::jsonb); raise exception 'debió fallar'; exception when sqlstate '22003' then raise notice 'OK 4b importe anidado negativo fuera de rango rechazado'; end;
  select count(*) into n from public.finance_items where record_id='a2'; assert n = 0, 'se escribió algo pese al rechazo';
  select revision into r from public.finance_revision; assert r = 2, 'la revisión cambió pese al rechazo';
  raise notice 'OK 4c el rechazo no escribe nada ni cambia la revisión (%)', r;
  -- 5. límite de importes: 1e13 exacto todavía se admite
  r := public.finance_apply_changes(2, '[{"collection":"accounts","id":"a3","action":"upsert","position":2,"data":{"balance":10000000000000}}]'::jsonb); raise notice 'OK 5 el límite exacto de 1e13 se admite (revisión %)', r;
  -- 6. demasiados cambios
  begin perform public.finance_apply_changes(3, (select jsonb_agg(jsonb_build_object('collection','x','id',g::text,'action','delete')) from generate_series(1,10001) g)); raise exception 'debió fallar'; exception when sqlstate '54000' then raise notice 'OK 6 más de 10000 cambios rechazado (54000)'; end;
  -- 7. forma inválida
  begin perform public.finance_apply_changes(3, '{"a":1}'::jsonb); raise exception 'debió fallar'; exception when sqlstate '22023' then raise notice 'OK 7 un objeto en lugar de un arreglo se rechaza (22023)'; end;
  begin perform public.finance_apply_changes(3, '[{"collection":"x","id":"1","action":"borrar"}]'::jsonb); raise exception 'debió fallar'; exception when raise_exception then raise notice 'OK 7b acción desconocida rechazada'; end;
  -- 8. eliminación
  r := public.finance_apply_changes(3, '[{"collection":"transactions","id":"t1","action":"delete"}]'::jsonb);
  select count(*) into n from public.finance_values where record_id='t1'; assert n = 0, 'la eliminación no limpió los valores'; raise notice 'OK 8 eliminar borra el registro y sus valores';
end $$;
-- 9. aislamiento entre usuarios
set request.uid='00000000-0000-0000-0000-000000000002';
do $$ declare n int; begin
  select count(*) into n from public.finance_items; assert n = 0, 'el usuario 2 ve datos del usuario 1'; raise notice 'OK 9 el usuario 2 no ve los datos del usuario 1 (RLS)';
  begin insert into public.finance_items(user_id,collection,record_id) values ('00000000-0000-0000-0000-000000000002','accounts','z'); raise exception 'debió fallar'; exception when insufficient_privilege then raise notice 'OK 9b no hay escritura directa: solo por finance_apply_changes'; end;
end $$;
-- 10. sin sesión
set request.uid='';
do $$ begin begin perform public.finance_apply_changes(0,'[]'::jsonb); raise exception 'debió fallar'; exception when sqlstate '28000' then raise notice 'OK 10 sin sesión se rechaza (28000)'; end; end $$;
reset role;
set role anon;
do $$ begin begin perform public.finance_apply_changes(0,'[]'::jsonb); raise exception 'debió fallar'; exception when insufficient_privilege then raise notice 'OK 11 anon no puede ejecutar la función'; end; end $$;
reset role;
\echo '== Reversión'
\i supabase/rollback/20261118000000_validacion_cambios_finanzas.down.sql
\echo 'FIN: prueba completada'
