-- Restaura finance_apply_changes a su definición anterior (sin límites de tamaño ni de importes).
CREATE OR REPLACE FUNCTION public.finance_apply_changes(p_expected_revision bigint, p_changes jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '5s'
AS $function$
declare uid uuid; current_revision bigint; item jsonb; coll text; rid text; kind text; next_revision bigint; touched text[] := '{}';
begin
  uid:=auth.uid();
  if uid is null then raise exception 'Sesión requerida' using errcode='28000'; end if;
  insert into public.finance_revision(user_id,revision) values(uid,0) on conflict do nothing;
  select revision into current_revision from public.finance_revision where user_id=uid for update;
  if current_revision <> p_expected_revision then raise exception 'CONFLICT: la revisión remota cambió (% vs %)',current_revision,p_expected_revision using errcode='40001'; end if;
  if jsonb_typeof(p_changes) <> 'array' then raise exception 'Cambios inválidos'; end if;
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
