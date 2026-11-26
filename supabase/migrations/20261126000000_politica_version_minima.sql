-- VIVE V1 · Política de versión mínima de cliente para escribir. APLICADA a producción el 2026-11-26 con min_client_version = 0; elevada a 1 a las 23:45 UTC.
-- Principios: una única versión oficial; cero versiones obsoletas autorizadas para escribir; cero reintentos infinitos; Supabase Free
-- (solo una tabla de una fila y una función; sin servicios adicionales, sin Edge Functions, sin Realtime nuevo).
-- Despliegue seguro en dos pasos:
--   1) Aplicar esta migración con min_client_version = 0  → ningún cliente cambia de comportamiento.
--   2) Cuando todos los dispositivos usen la versión nueva (que envía p_client_version = 1):
--        update public.app_policy set min_client_version = 1;   -- desde ese momento un cliente anterior NO puede escribir.
-- No modifica ni borra datos financieros. Rollback: supabase/rollback/20261126000000_politica_version_minima.down.sql

create table if not exists public.app_policy(
  id boolean primary key default true check (id),         -- una sola fila
  min_client_version integer not null default 0 check (min_client_version >= 0),
  updated_at timestamptz not null default now()
);
insert into public.app_policy(id,min_client_version) values (true,0) on conflict (id) do nothing;
alter table public.app_policy enable row level security;   -- sin políticas: inaccesible por la API; solo la función (SECURITY DEFINER) la lee
revoke all on public.app_policy from anon, authenticated;

-- Reemplazo atómico de la función: misma lógica + el control de versión.
drop function if exists public.finance_apply_changes(bigint, jsonb);
CREATE OR REPLACE FUNCTION public.finance_apply_changes(p_expected_revision bigint, p_changes jsonb, p_client_version integer DEFAULT 0)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '5s'
AS $function$
declare uid uuid; current_revision bigint; min_version integer; item jsonb; coll text; rid text; kind text; next_revision bigint; touched text[] := '{}';
begin
  uid:=auth.uid();
  if uid is null then raise exception 'Sesión requerida' using errcode='28000'; end if;
  -- VIVE V1 · Cero versiones obsoletas autorizadas para escribir: un cliente cuya versión es menor que la mínima vigente
  -- recibe un error TERMINAL (VI001), sin tocar datos ni bloquear filas. Los clientes antiguos que no envían versión cuentan como 0.
  select min_client_version into min_version from public.app_policy where id;
  if coalesce(p_client_version,0) < coalesce(min_version,0) then
    raise exception 'VERSION_OBSOLETE: esta versión de Vive ya no puede guardar; actualiza la app (mínima %, la tuya %)',min_version,coalesce(p_client_version,0) using errcode='VI001';
  end if;
  -- Fast preflight: reject known stale versions before scanning JSON or locking.
  -- The original SELECT FOR UPDATE below remains authoritative.
  select revision into current_revision
  from public.finance_revision
  where user_id=uid;
  if found and current_revision <> p_expected_revision then
    raise exception 'CONFLICT: la revisión remota cambió (% vs %)',current_revision,p_expected_revision using errcode='40001';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then raise exception 'Cambios inválidos' using errcode='22023'; end if;
  if jsonb_array_length(p_changes) > 10000 then raise exception 'Demasiados cambios en una operación (máximo 10000)' using errcode='54000'; end if;
  if pg_column_size(p_changes) > 16*1024*1024 then raise exception 'Operación demasiado grande (máximo 16 MB)' using errcode='54000'; end if;
  if jsonb_path_exists(p_changes, '$[*].data.** ? (@.type() == "number" && (@ > 1e13 || @ < -1e13))') then
    raise exception 'Importe fuera de rango (máximo ±10000000000000)' using errcode='22003';
  end if;
  insert into public.finance_revision(user_id,revision) values(uid,0) on conflict do nothing;
  select revision into current_revision from public.finance_revision where user_id=uid for update;
  if current_revision <> p_expected_revision then raise exception 'CONFLICT: la revisión remota cambió (% vs %)',current_revision,p_expected_revision using errcode='40001'; end if;
  for item in select value from jsonb_array_elements(p_changes) loop
    coll:=item->>'collection'; rid:=item->>'id'; kind:=item->>'action';
    if coll is null or rid is null or length(coll)>90 or length(rid)>255 then raise exception 'Identificador inválido'; end if;
    if kind='delete' then
      delete from public.finance_items where user_id=uid and collection=coll and record_id=rid;
    elsif kind='upsert' then
      perform public.finance_write_item(uid,coll,rid,coalesce((item->>'position')::integer,0),item->'data');
    else raise exception 'Operación inválida'; end if;
    if not (coll = any(touched)) then touched := touched || coll; end if;
  end loop;
  update public.finance_revision set revision=revision+1,updated_at=now() where user_id=uid returning revision into next_revision;
  if array_length(touched,1) > 0 then
    insert into public.finance_collection_state(user_id,collection,revision)
    select uid, c, next_revision from unnest(touched) as c
    on conflict (user_id,collection) do update set revision = excluded.revision;
  end if;
  return next_revision;
end $function$;

revoke all on function public.finance_apply_changes(bigint, jsonb, integer) from public, anon;
grant execute on function public.finance_apply_changes(bigint, jsonb, integer) to authenticated;
