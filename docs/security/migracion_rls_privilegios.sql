-- Hallazgo S1/S2: privilegios mínimos en tablas financieras y escritura solo vía RPC validada.
-- 1) El rol anónimo no necesita nada sobre datos financieros.
revoke all on public.finance_items, public.finance_values, public.finance_revision, public.finance_collection_state from anon;
-- 2) Los usuarios autenticados solo leen; escriben únicamente a través de finance_apply_changes (SECURITY DEFINER, comprueba auth.uid()).
revoke all on public.finance_items, public.finance_values, public.finance_revision, public.finance_collection_state from authenticated;
grant select on public.finance_items, public.finance_values, public.finance_revision, public.finance_collection_state to authenticated;
-- 3) Las funciones de escritura se ejecutan con los privilegios del propietario, con search_path vacío y control de identidad interno.
alter function public.finance_apply_changes(bigint, jsonb) security definer;
alter function public.finance_write_item(uuid, text, text, integer, jsonb) security definer;
revoke all on function public.finance_write_item(uuid, text, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.finance_apply_changes(bigint, jsonb) from public, anon;
grant execute on function public.finance_apply_changes(bigint, jsonb) to authenticated;
