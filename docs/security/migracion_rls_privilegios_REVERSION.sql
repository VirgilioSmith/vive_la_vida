-- Reversión del endurecimiento (vuelve al estado previo del 14-nov-2026).
alter function public.finance_apply_changes(bigint, jsonb) security invoker;
alter function public.finance_write_item(uuid, text, text, integer, jsonb) security invoker;
grant execute on function public.finance_write_item(uuid, text, text, integer, jsonb) to authenticated;
grant all on public.finance_items, public.finance_values, public.finance_revision to anon, authenticated;
grant all on public.finance_collection_state to authenticated;
