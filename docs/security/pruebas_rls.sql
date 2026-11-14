-- Prueba de RLS y privilegios (ejecutar en una transacción que se deshace). Resultado esperado tras la migración:
--   lectura propia OK; insert/update/truncate/write_item directos bloqueados; RPC OK; conflicto 40001; anon sin acceso.
do $$
declare u uuid; r bigint; n bigint; res text := '';
begin
  select user_id, revision into u, r from public.finance_revision order by revision desc limit 1;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  begin perform count(*) from public.finance_values; res := res || 'lectura propia OK; '; exception when others then res := res || 'lectura FALLA; '; end;
  begin insert into public.finance_values(user_id,collection,record_id,path,kind) values(u,'x','x','','null'); res := res || 'INSERT directo PERMITIDO (mal); '; exception when insufficient_privilege then res := res || 'insert directo bloqueado; '; end;
  begin update public.finance_revision set revision=revision+5 where user_id=u; res := res || 'UPDATE directo PERMITIDO (mal); '; exception when insufficient_privilege then res := res || 'update directo bloqueado; '; end;
  begin truncate public.finance_values; res := res || 'TRUNCATE PERMITIDO (mal); '; exception when insufficient_privilege then res := res || 'truncate bloqueado; '; end;
  begin perform public.finance_write_item(u,'x','x',0,'{}'::jsonb); res := res || 'write_item directo PERMITIDO (mal); '; exception when insufficient_privilege then res := res || 'write_item directo bloqueado; '; end;
  begin n := public.finance_apply_changes(r,'[{"collection":"__prueba__","id":"x","action":"upsert","position":0,"data":{"a":1}}]'::jsonb); res := res || 'RPC OK; '; exception when others then res := res || 'RPC FALLA: '||sqlerrm||'; '; end;
  begin perform public.finance_apply_changes(r,'[]'::jsonb); res := res || 'revision vieja ACEPTADA (mal); '; exception when sqlstate '40001' then res := res || 'conflicto 40001; '; end;
  reset role; set local role anon;
  begin perform count(*) from public.finance_values; res := res || 'anon LEE (mal); '; exception when insufficient_privilege then res := res || 'anon sin acceso; '; end;
  reset role;
  raise exception 'RESULTADO: %', res;  -- la excepción deshace todo
end $$;
